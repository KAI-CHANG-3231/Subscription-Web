import {
  DEFAULT_SETTINGS,
  getSettings,
  getSubscriptions,
  normalizeSubscription,
  saveSettings,
  saveSubscriptions
} from "../utils/storage.js";
import { scheduleAllAlarms } from "../utils/notification.js";

const settingsForm = document.querySelector("#settings-form");
const defaultCurrencyInput = document.querySelector("#default-currency");
const summaryAmountModeInputs = Array.from(document.querySelectorAll('input[name="summaryAmountMode"]'));
const rateUsdInput = document.querySelector("#rate-usd");
const rateJpyInput = document.querySelector("#rate-jpy");
const rateEurInput = document.querySelector("#rate-eur");
const enableNotificationsInput = document.querySelector("#enable-notifications");
const enableNewTabInput = document.querySelector("#enable-newtab");
const showExpiredInput = document.querySelector("#show-expired");
const messageEl = document.querySelector("#settings-message");
const exportButton = document.querySelector("#export-data");
const importFileInput = document.querySelector("#import-file");
const importButton = document.querySelector("#import-data");
const clearButton = document.querySelector("#clear-data");

function setMessage(message, isSuccess = false) {
  messageEl.textContent = message;
  messageEl.classList.toggle("success", isSuccess);
}

function getImportMode() {
  return document.querySelector('input[name="importMode"]:checked')?.value || "merge";
}

function validateSettings(settings) {
  const rates = settings.exchangeRates;
  if (!["TWD", "USD", "JPY", "EUR"].includes(settings.defaultCurrency)) {
    return "請選擇有效的預設幣別。";
  }
  if ([rates.USD, rates.JPY, rates.EUR].some((rate) => !Number.isFinite(rate) || rate <= 0)) {
    return "匯率必須大於 0。";
  }
  return "";
}

function readSettingsFromForm() {
  const summaryAmountMode = summaryAmountModeInputs.find((input) => input.checked)?.value || "personal";
  return {
    defaultCurrency: defaultCurrencyInput.value,
    exchangeRates: {
      USD: Number(rateUsdInput.value),
      JPY: Number(rateJpyInput.value),
      EUR: Number(rateEurInput.value)
    },
    enableNotifications: enableNotificationsInput.checked,
    enableNewTab: false,
    showExpiredInDashboard: showExpiredInput.checked,
    summaryAmountMode
  };
}

function fillSettings(settings) {
  defaultCurrencyInput.value = settings.defaultCurrency;
  summaryAmountModeInputs.forEach((input) => {
    input.checked = input.value === (settings.summaryAmountMode || "personal");
  });
  rateUsdInput.value = String(settings.exchangeRates.USD);
  rateJpyInput.value = String(settings.exchangeRates.JPY);
  rateEurInput.value = String(settings.exchangeRates.EUR);
  enableNotificationsInput.checked = settings.enableNotifications;
  enableNewTabInput.checked = false;
  showExpiredInput.checked = settings.showExpiredInDashboard;
}

async function handleSettingsSubmit(event) {
  event.preventDefault();
  setMessage("");

  const settings = readSettingsFromForm();
  const validationMessage = validateSettings(settings);
  if (validationMessage) {
    setMessage(validationMessage);
    return;
  }

  try {
    await saveSettings(settings);
    await scheduleAllAlarms(await getSubscriptions());
    setMessage("設定已儲存。", true);
  } catch (error) {
    console.error("Unable to save settings", error);
    setMessage("儲存設定失敗。");
  }
}

async function exportData() {
  const payload = {
    exportedAt: new Date().toISOString(),
    settings: await getSettings(),
    subscriptions: await getSubscriptions()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "subtrack-backup.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function importData() {
  const file = importFileInput.files?.[0];
  if (!file) {
    setMessage("請先選擇 JSON 檔案。");
    return;
  }

  try {
    const content = await file.text();
    const parsed = JSON.parse(content);
    const importedSubscriptions = Array.isArray(parsed) ? parsed : parsed.subscriptions;
    if (!Array.isArray(importedSubscriptions)) {
      setMessage("JSON 內容必須包含 subscriptions 陣列。");
      return;
    }

    const normalized = importedSubscriptions
      .map(normalizeSubscription)
      .filter((item) => item.name && item.fee > 0);
    const current = await getSubscriptions();
    const nextSubscriptions = getImportMode() === "replace"
      ? normalized
      : [...current.filter((item) => !normalized.some((next) => next.id === item.id)), ...normalized];

    await saveSubscriptions(nextSubscriptions);

    if (!Array.isArray(parsed) && parsed.settings) {
      await saveSettings({ ...(await getSettings()), ...parsed.settings, enableNewTab: false });
      fillSettings(await getSettings());
    }

    await scheduleAllAlarms(nextSubscriptions);
    setMessage(`已匯入 ${normalized.length} 筆資料。`, true);
  } catch (error) {
    console.error("Unable to import data", error);
    setMessage("匯入失敗，請確認 JSON 格式。");
  }
}

async function clearData() {
  const confirmed = confirm("確定清除所有 SubTrack 資料？此操作無法復原。");
  if (!confirmed) return;

  try {
    await saveSubscriptions([]);
    await saveSettings(DEFAULT_SETTINGS);
    await scheduleAllAlarms([]);
    fillSettings(DEFAULT_SETTINGS);
    setMessage("所有資料已清除。", true);
  } catch (error) {
    console.error("Unable to clear data", error);
    setMessage("清除資料失敗。");
  }
}

async function initialize() {
  fillSettings(await getSettings());
}

settingsForm.addEventListener("submit", handleSettingsSubmit);
exportButton.addEventListener("click", exportData);
importButton.addEventListener("click", importData);
clearButton.addEventListener("click", clearData);

initialize().catch((error) => {
  console.error("Unable to initialize options", error);
  setMessage("載入設定失敗。");
});
