import { addSubscription, getSubscriptions, updateSubscription } from "../utils/storage.js";
import { todayString } from "../utils/date.js";
import { CATEGORIES, PRESETS } from "../utils/presets.js";
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

function setMessage(message, isSuccess = false) {
  messageEl.textContent = message;
  messageEl.classList.toggle("success", isSuccess);
}

function closePage() {
  window.close();
  setTimeout(() => setMessage("已完成，可關閉此分頁。", true), 150);
}

function populateOptions() {
  CATEGORIES.forEach((category) => {
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

function toggleCycleFields() {
  const isCustom = cycleSelect.value === "custom";
  const isOnce = cycleSelect.value === "once";
  cycleDaysRow.hidden = !isCustom;
  cycleDaysInput.required = isCustom;
  onceHint.hidden = !isOnce;

  if (!editingId) {
    setReminderValues(isOnce ? [3, 1] : [7, 1]);
  }
}

function applyPreset(preset) {
  if (!preset) return;
  nameInput.value = preset.name;
  categorySelect.value = preset.category;
  feeInput.value = String(preset.defaultFee);
  currencySelect.value = preset.defaultCurrency;
  colorInput.value = preset.color;
  presetPreview.style.backgroundColor = preset.color;
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
  categorySelect.value = item.category || "其他";
  feeInput.value = String(item.fee || "");
  currencySelect.value = item.currency || "TWD";
  cycleSelect.value = item.cycle || "monthly";
  cycleDaysInput.value = item.cycleDays ? String(item.cycleDays) : "";
  nextBillingDateInput.value = dateParam || item.nextBillingDate || todayString();
  startDateInput.value = item.startDate || item.createdAt || todayString();
  statusInput.value = item.status || "active";
  colorInput.value = item.color || "#5c4efa";
  presetPreview.style.backgroundColor = colorInput.value;
  notesInput.value = item.notes || "";
  setReminderValues(item.reminderDays || (item.cycle === "once" ? [3, 1] : [7, 1]));
  toggleCycleFields();
}

function validateForm() {
  const name = nameInput.value.trim();
  const fee = Number(feeInput.value);
  const date = nextBillingDateInput.value;
  const startDate = startDateInput.value;
  const cycleDays = Number(cycleDaysInput.value);

  if (!name) return "服務名稱不得空白。";
  if (!Number.isFinite(fee) || fee <= 0) return "費用金額必須大於 0。";
  if (!date) return "請選擇下次扣款日期。";
  if (!startDate) return "請選擇訂閱開始日。";
  if (!editingId && date < todayString()) return "新增訂閱的扣款日期不得為過去日期。";
  if (cycleSelect.value === "custom" && (!Number.isInteger(cycleDays) || cycleDays <= 0)) {
    return "自訂週期天數必須是大於 0 的整數。";
  }
  if (getReminderValues().length === 0) return "請至少選擇一個提醒天數。";
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
    cycle: cycleSelect.value,
    cycleDays: cycleSelect.value === "custom" ? Number(cycleDaysInput.value) : null,
    nextBillingDate: nextBillingDateInput.value,
    startDate: startDateInput.value,
    status,
    statusHistory: editingItem && editingItem.status !== status
      ? [...statusHistory, { status, changedAt: todayString(), note: "表單更新狀態" }]
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
    setMessage("已儲存。", true);
    setTimeout(closePage, 250);
  } catch (error) {
    console.error("Unable to save subscription", error);
    setMessage("儲存失敗，請稍後再試。");
  }
}

async function initialize() {
  populateOptions();
  subscriptions = await getSubscriptions();
  nextBillingDateInput.min = todayString();

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
      nextBillingDate: dateParam || todayString(),
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
cycleSelect.addEventListener("change", toggleCycleFields);
colorInput.addEventListener("input", () => {
  presetPreview.style.backgroundColor = colorInput.value;
});
form.addEventListener("submit", handleSubmit);
closeButton.addEventListener("click", closePage);
cancelButton.addEventListener("click", closePage);

initialize().catch((error) => {
  console.error("Unable to initialize form", error);
  setMessage("載入資料失敗。");
});
