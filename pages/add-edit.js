import { addSubscription, getSubscriptions, updateSubscription } from "../utils/storage.js";
import { todayString } from "../utils/date.js";
import { CATEGORIES, PRESETS } from "../utils/presets.js";
import { scheduleAllAlarms } from "../utils/notification.js";

const params = new URLSearchParams(location.search);
const editingId = params.get("id");

const form = document.querySelector("#subscription-form");
const titleEl = document.querySelector("#page-title");
const presetSelect = document.querySelector("#preset-select");
const nameInput = document.querySelector("#name");
const categorySelect = document.querySelector("#category");
const feeInput = document.querySelector("#fee");
const currencySelect = document.querySelector("#currency");
const cycleSelect = document.querySelector("#cycle");
const cycleDaysRow = document.querySelector("#cycle-days-row");
const cycleDaysInput = document.querySelector("#cycle-days");
const nextBillingDateInput = document.querySelector("#next-billing-date");
const colorInput = document.querySelector("#color");
const notesInput = document.querySelector("#notes");
const activeInput = document.querySelector("#is-active");
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

function toggleCycleDays() {
  const isCustom = cycleSelect.value === "custom";
  cycleDaysRow.hidden = !isCustom;
  cycleDaysInput.required = isCustom;
}

function applyPreset(preset) {
  if (!preset) return;
  nameInput.value = preset.name;
  categorySelect.value = preset.category;
  feeInput.value = String(preset.defaultFee);
  currencySelect.value = preset.defaultCurrency;
  colorInput.value = preset.color;
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
  categorySelect.value = item.category || "other";
  feeInput.value = String(item.fee || "");
  currencySelect.value = item.currency || "TWD";
  cycleSelect.value = item.cycle || "monthly";
  cycleDaysInput.value = item.cycleDays ? String(item.cycleDays) : "";
  nextBillingDateInput.value = item.nextBillingDate || todayString();
  colorInput.value = item.color || "#ffffff";
  notesInput.value = item.notes || "";
  activeInput.checked = item.isActive !== false;
  setReminderValues(item.reminderDays);
  toggleCycleDays();
}

function validateForm() {
  const name = nameInput.value.trim();
  const fee = Number(feeInput.value);
  const date = nextBillingDateInput.value;
  const cycleDays = Number(cycleDaysInput.value);

  if (!name) return "服務名稱不得空白。";
  if (!Number.isFinite(fee) || fee <= 0) return "費用金額必須大於 0。";
  if (!date) return "請選擇下次扣款日期。";
  if (!editingId && date < todayString()) return "新增訂閱的扣款日期不得為過去日期。";
  if (cycleSelect.value === "custom" && (!Number.isInteger(cycleDays) || cycleDays <= 0)) {
    return "自訂週期天數必須是大於 0 的整數。";
  }
  if (getReminderValues().length === 0) return "請至少選擇一個提醒天數。";
  return "";
}

function buildSubscription() {
  return {
    id: editingItem?.id || crypto.randomUUID(),
    name: nameInput.value.trim(),
    category: categorySelect.value,
    fee: Number(feeInput.value),
    currency: currencySelect.value,
    cycle: cycleSelect.value,
    cycleDays: cycleSelect.value === "custom" ? Number(cycleDaysInput.value) : null,
    nextBillingDate: nextBillingDateInput.value,
    reminderDays: getReminderValues(),
    color: colorInput.value || "#ffffff",
    notes: notesInput.value.trim(),
    createdAt: editingItem?.createdAt || todayString(),
    isActive: activeInput.checked
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
      category: "streaming",
      cycle: "monthly",
      nextBillingDate: todayString(),
      reminderDays: [7, 1],
      color: "#ffffff",
      isActive: true
    });
  }
}

presetSelect.addEventListener("change", () => {
  const preset = PRESETS[Number(presetSelect.value)];
  applyPreset(preset);
});
cycleSelect.addEventListener("change", toggleCycleDays);
form.addEventListener("submit", handleSubmit);
closeButton.addEventListener("click", closePage);
cancelButton.addEventListener("click", closePage);

initialize().catch((error) => {
  console.error("Unable to initialize form", error);
  setMessage("載入資料失敗。");
});
