import { addSubscription, getSettings, getSubscriptions, updateSubscription } from "../utils/storage.js";
import { calcSplitPersonalFee, formatCurrency, isZeroDecimalCurrency } from "../utils/currency.js";
import { getNextBillingDate, todayString } from "../utils/date.js";
import { PRESETS } from "../utils/presets.js";
import { scheduleAllAlarms } from "../utils/notification.js";

const params = new URLSearchParams(location.search);
const editingId = params.get("id");
const dateParam = params.get("date");

const form = document.querySelector("#subscription-form");
const titleEl = document.querySelector("#page-title");
const presetSelect = document.querySelector("#preset-select");
const presetPreview = document.querySelector("#preset-preview");
const nameInput = document.querySelector("#name");
const categorySelect = document.querySelector("#category");
const feeInput = document.querySelector("#fee");
const currencySelect = document.querySelector("#currency");
const paymentMethodInput = document.querySelector("#payment-method");
const subscriptionScopeSelect = document.querySelector("#subscription-scope");
const sharedFields = document.querySelector("#shared-fields");
const sharedWithInput = document.querySelector("#shared-with");
const splitCountInput = document.querySelector("#split-count");
const personalFeeInput = document.querySelector("#personal-fee");
const splitPreview = document.querySelector("#split-preview");
const cycleSelect = document.querySelector("#cycle");
const cycleDaysRow = document.querySelector("#cycle-days-row");
const cycleDaysInput = document.querySelector("#cycle-days");
const onceHint = document.querySelector("#once-hint");
const nextBillingDateInput = document.querySelector("#next-billing-date");
const startDateInput = document.querySelector("#start-date");
const statusInput = document.querySelector("#status");
const colorInput = document.querySelector("#color");
const notesInput = document.querySelector("#notes");
const messageEl = document.querySelector("#form-message");
const closeButton = document.querySelector("#close-page");
const cancelButton = document.querySelector("#cancel");

let subscriptions = [];
let editingItem = null;
let settings = null;

function setMessage(message, isSuccess = false) {
  messageEl.textContent = message;
  messageEl.classList.toggle("success", isSuccess);
}

function closePage() {
  window.close();
  setTimeout(() => {
    location.href = chrome.runtime.getURL("newtab/newtab.html");
  }, 120);
}

function populateOptions() {
  categorySelect.replaceChildren();
  settings.categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.value;
    option.textContent = category.label;
    categorySelect.append(option);
  });

  PRESETS.forEach((preset, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = preset.name;
    presetSelect.append(option);
  });
}

function syncMonthlyNextBillingDate() {
  if (cycleSelect.value !== "monthly" || !startDateInput.value) return;
  nextBillingDateInput.value = getNextBillingDate(startDateInput.value, "monthly", null);
}

function toggleCycleFields(options = {}) {
  const isCustom = cycleSelect.value === "custom";
  const isOnce = cycleSelect.value === "once";
  cycleDaysRow.hidden = !isCustom;
  cycleDaysInput.required = isCustom;
  onceHint.hidden = !isOnce;

  if (options.syncDate) syncMonthlyNextBillingDate();
  if (!editingId) setReminderValues(isOnce ? [3, 1] : [7, 1]);
}

function getSharedNames() {
  return sharedWithInput.value
    .split(/[,\n，、]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function updateSplitPreview(isShared) {
  if (!isShared) return;
  const fee = Number(feeInput.value);
  const splitCount = Number(splitCountInput.value);
  if (!Number.isFinite(fee) || fee <= 0 || !Number.isFinite(splitCount) || splitCount < 2) {
    splitPreview.textContent = "輸入金額與分攤人數後，系統會自動估算你的個人負擔。";
    return;
  }

  const calculated = calcSplitPersonalFee(fee, splitCount, currencySelect.value);
  const unevenHint = isZeroDecimalCurrency(currencySelect.value) && fee % splitCount !== 0
    ? "因為這個幣別不使用小數，系統會把你的那份預設為多 1 元的分攤結果。"
    : "你仍然可以手動調整個人負擔金額。";
  splitPreview.textContent = `建議個人負擔：${formatCurrency(calculated, currencySelect.value)}。${unevenHint}`;
}

function syncSharedFields(options = {}) {
  const isShared = subscriptionScopeSelect.value === "shared";
  sharedFields.hidden = !isShared;
  splitCountInput.required = isShared;
  personalFeeInput.required = false;
  personalFeeInput.step = isZeroDecimalCurrency(currencySelect.value) ? "1" : "0.01";

  if (!isShared) return;

  const memberCount = getSharedNames().length + 1;
  const currentSplitCount = Number(splitCountInput.value);
  if (!Number.isFinite(currentSplitCount) || currentSplitCount < memberCount) {
    splitCountInput.value = String(Math.max(2, memberCount));
  }

  const fee = Number(feeInput.value);
  const splitCount = Number(splitCountInput.value);
  if (Number.isFinite(fee) && fee > 0 && Number.isFinite(splitCount) && splitCount > 0) {
    if (options.forcePersonalFee || !personalFeeInput.value) {
      personalFeeInput.value = String(calcSplitPersonalFee(fee, splitCount, currencySelect.value));
    }
  }
  updateSplitPreview(isShared);
}

function applyPreset(preset) {
  if (!preset) return;
  nameInput.value = preset.name;
  categorySelect.value = Array.from(categorySelect.options).some((option) => option.value === preset.category)
    ? preset.category
    : "其他";
  feeInput.value = String(preset.defaultFee);
  currencySelect.value = preset.defaultCurrency;
  colorInput.value = preset.color;
  presetPreview.style.backgroundColor = preset.color;
  syncSharedFields({ forcePersonalFee: true });
}

function setReminderValues(values) {
  const reminders = new Set((values || [7, 1]).map(String));
  form.querySelectorAll('input[name="reminderDays"]').forEach((input) => {
    input.checked = reminders.has(input.value);
  });
}

function getReminderValues() {
  return Array.from(form.querySelectorAll('input[name="reminderDays"]:checked'))
    .map((input) => Number(input.value))
    .sort((a, b) => b - a);
}

function fillForm(item) {
  nameInput.value = item.name || "";
  categorySelect.value = Array.from(categorySelect.options).some((option) => option.value === item.category)
    ? item.category
    : "其他";
  feeInput.value = item.fee ? String(item.fee) : "";
  currencySelect.value = item.currency || "TWD";
  paymentMethodInput.value = item.paymentMethod || "credit_card";
  subscriptionScopeSelect.value = item.isShared ? "shared" : "personal";
  sharedWithInput.value = Array.isArray(item.sharedWith) ? item.sharedWith.join("\n") : "";
  splitCountInput.value = String(item.splitCount || Math.max(2, (item.sharedWith?.length || 0) + 1));
  personalFeeInput.value = item.personalFee
    ? String(isZeroDecimalCurrency(item.currency) ? Math.ceil(Number(item.personalFee)) : item.personalFee)
    : "";
  cycleSelect.value = item.cycle || "monthly";
  cycleDaysInput.value = item.cycleDays ? String(item.cycleDays) : "";
  nextBillingDateInput.value = dateParam || item.nextBillingDate || todayString();
  startDateInput.value = item.startDate || item.createdAt || todayString();
  statusInput.value = item.status || "active";
  colorInput.value = item.color || "#5c4efa";
  presetPreview.style.backgroundColor = colorInput.value;
  notesInput.value = item.notes || "";
  setReminderValues(item.reminderDays || (item.cycle === "once" ? [3, 1] : [7, 1]));
  syncSharedFields();
  toggleCycleFields();
}

function validateForm() {
  const name = nameInput.value.trim();
  const fee = Number(feeInput.value);
  const date = nextBillingDateInput.value;
  const startDate = startDateInput.value;
  const cycleDays = Number(cycleDaysInput.value);
  const splitCount = Number(splitCountInput.value);
  const personalFee = Number(personalFeeInput.value);

  if (!name) return "請輸入服務名稱。";
  if (!Number.isFinite(fee) || fee <= 0) return "訂閱金額必須大於 0。";
  if (!date) return "請選擇下次扣款日期。";
  if (!startDate) return "請選擇訂閱開始日。";
  if (startDate > date) return "訂閱開始日不可以晚於下次扣款日期。";
  if (!editingId && date < todayString()) return "新增訂閱的下次扣款日期不可以早於今天。";
  if (cycleSelect.value === "custom" && (!Number.isInteger(cycleDays) || cycleDays <= 0)) {
    return "自訂週期天數必須是大於 0 的整數。";
  }
  if (subscriptionScopeSelect.value === "shared") {
    if (!Number.isInteger(splitCount) || splitCount < 2) return "共同訂閱的分攤人數至少需要 2 人。";
    if (personalFeeInput.value && (!Number.isFinite(personalFee) || personalFee <= 0)) {
      return "個人負擔金額必須大於 0。";
    }
    if (personalFeeInput.value && isZeroDecimalCurrency(currencySelect.value) && !Number.isInteger(personalFee)) {
      return "TWD 與 JPY 的個人負擔金額不可使用小數。";
    }
  }
  if (getReminderValues().length === 0) return "請至少選擇一個扣款提醒時間。";
  return "";
}

function buildSubscription() {
  const status = statusInput.value;
  const createdAt = editingItem?.createdAt || todayString();
  const statusHistory = editingItem?.statusHistory || [{
    status,
    changedAt: todayString(),
    note: "建立訂閱"
  }];

  return {
    id: editingItem?.id || crypto.randomUUID(),
    name: nameInput.value.trim(),
    category: categorySelect.value,
    fee: Number(feeInput.value),
    currency: currencySelect.value,
    paymentMethod: paymentMethodInput.value,
    isShared: subscriptionScopeSelect.value === "shared",
    sharedWith: subscriptionScopeSelect.value === "shared" ? getSharedNames() : [],
    splitCount: subscriptionScopeSelect.value === "shared" ? Number(splitCountInput.value) : 1,
    personalFee: subscriptionScopeSelect.value === "shared" && personalFeeInput.value ? Number(personalFeeInput.value) : null,
    cycle: cycleSelect.value,
    cycleDays: cycleSelect.value === "custom" ? Number(cycleDaysInput.value) : null,
    nextBillingDate: nextBillingDateInput.value,
    startDate: startDateInput.value,
    status,
    statusHistory: editingItem && editingItem.status !== status
      ? [...statusHistory, { status, changedAt: todayString(), note: "手動變更狀態" }]
      : statusHistory,
    reminderDays: getReminderValues(),
    color: colorInput.value || "#5c4efa",
    notes: notesInput.value.trim(),
    createdAt
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  setMessage("");

  const validationMessage = validateForm();
  if (validationMessage) {
    setMessage(validationMessage);
    return;
  }

  const item = buildSubscription();

  try {
    if (editingId) {
      await updateSubscription(editingId, item);
    } else {
      await addSubscription(item);
    }
    await scheduleAllAlarms(await getSubscriptions());
    setMessage("已儲存訂閱。", true);
    setTimeout(closePage, 250);
  } catch (error) {
    console.error("Unable to save subscription", error);
    setMessage("儲存失敗，請確認資料後再試一次。");
  }
}

async function initialize() {
  settings = await getSettings();
  populateOptions();
  subscriptions = await getSubscriptions();
  if (!editingId) nextBillingDateInput.min = todayString();

  if (editingId) {
    editingItem = subscriptions.find((item) => item.id === editingId);
    titleEl.textContent = "編輯訂閱";
    if (editingItem) {
      fillForm(editingItem);
    } else {
      setMessage("找不到要編輯的訂閱。");
    }
  } else {
    fillForm({
      category: "影音串流",
      cycle: "monthly",
      nextBillingDate: dateParam || getNextBillingDate(todayString(), "monthly", null),
      startDate: todayString(),
      status: "active",
      reminderDays: [7, 1],
      color: "#5c4efa"
    });
  }
}

presetSelect.addEventListener("change", () => {
  const preset = PRESETS[Number(presetSelect.value)];
  applyPreset(preset);
});
cycleSelect.addEventListener("change", () => toggleCycleFields({ syncDate: true }));
startDateInput.addEventListener("change", syncMonthlyNextBillingDate);
subscriptionScopeSelect.addEventListener("change", () => syncSharedFields({ forcePersonalFee: true }));
sharedWithInput.addEventListener("input", () => syncSharedFields());
splitCountInput.addEventListener("input", () => syncSharedFields({ forcePersonalFee: true }));
feeInput.addEventListener("input", () => syncSharedFields({ forcePersonalFee: true }));
currencySelect.addEventListener("change", () => syncSharedFields({ forcePersonalFee: true }));
colorInput.addEventListener("input", () => {
  presetPreview.style.backgroundColor = colorInput.value;
});
form.addEventListener("submit", handleSubmit);
closeButton.addEventListener("click", closePage);
cancelButton.addEventListener("click", closePage);

initialize().catch((error) => {
  console.error("Unable to initialize form", error);
  setMessage("載入訂閱資料時發生問題，請稍後再試。");
});
