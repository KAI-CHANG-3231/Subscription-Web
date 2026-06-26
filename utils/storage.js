import { todayString } from "./date.js";
import { DEFAULT_CATEGORIES } from "./presets.js";

export const DEFAULT_SETTINGS = {
  defaultCurrency: "TWD",
  exchangeRates: {
    USD: 32,
    JPY: 0.22,
    EUR: 35
  },
  enableNotifications: true,
  enableNewTab: false,
  showExpiredInDashboard: true,
  summaryAmountMode: "personal",
  categories: DEFAULT_CATEGORIES
};

const STORAGE_KEYS = {
  subscriptions: "subscriptions",
  settings: "settings"
};

const CATEGORY_MAP = {
  streaming: "影音串流",
  music: "音樂",
  tools: "生產工具",
  gaming: "遊戲",
  ai: "AI服務",
  other: "其他"
};

const VALID_STATUS = new Set(["active", "paused", "expired"]);
const VALID_PAYMENT_METHODS = new Set([
  "credit_card",
  "debit_card",
  "bank_transfer",
  "mobile_payment",
  "cash",
  "other"
]);

function mergeSettings(settings = {}) {
  const defaultCurrency = ["TWD", "USD", "JPY", "EUR"].includes(settings.defaultCurrency)
    ? settings.defaultCurrency
    : DEFAULT_SETTINGS.defaultCurrency;
  const summaryAmountMode = ["personal", "gross"].includes(settings.summaryAmountMode)
    ? settings.summaryAmountMode
    : DEFAULT_SETTINGS.summaryAmountMode;
  const categories = normalizeCategories(settings.categories);
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    defaultCurrency,
    enableNewTab: false,
    summaryAmountMode,
    categories,
    exchangeRates: {
      ...DEFAULT_SETTINGS.exchangeRates,
      ...(settings.exchangeRates || {})
    }
  };
}

export function normalizeCategories(categories) {
  const source = Array.isArray(categories) && categories.length ? categories : DEFAULT_CATEGORIES;
  const seen = new Set();
  const normalized = source
    .map((category) => {
      const label = typeof category === "string" ? category : category?.label || category?.value;
      const value = String(label || "").trim();
      return value ? { value, label: value } : null;
    })
    .filter(Boolean)
    .filter((category) => {
      if (seen.has(category.value)) return false;
      seen.add(category.value);
      return true;
    });

  if (!seen.has("其他")) normalized.push({ value: "其他", label: "其他" });
  return normalized;
}

function normalizeStatusHistory(item, status) {
  if (Array.isArray(item.statusHistory) && item.statusHistory.length) {
    return item.statusHistory
      .filter((entry) => VALID_STATUS.has(entry.status))
      .map((entry) => ({
        status: entry.status,
        changedAt: entry.changedAt || item.createdAt || todayString(),
        note: String(entry.note || "")
      }));
  }

  return [{
    status,
    changedAt: item.createdAt || todayString(),
    note: "建立訂閱"
  }];
}

export function normalizeSubscription(item = {}) {
  const status = VALID_STATUS.has(item.status)
    ? item.status
    : item.isActive === false
      ? "paused"
      : "active";
  const category = CATEGORY_MAP[item.category] || item.category || "其他";
  const cycle = ["monthly", "yearly", "custom", "once"].includes(item.cycle)
    ? item.cycle
    : "monthly";
  const reminderDays = Array.isArray(item.reminderDays) && item.reminderDays.length
    ? item.reminderDays.map(Number).filter((day) => Number.isFinite(day) && day >= 0)
    : cycle === "once"
      ? [3, 1]
      : [7, 1];
  const sharedWith = Array.isArray(item.sharedWith)
    ? item.sharedWith.map((name) => String(name).trim()).filter(Boolean)
    : String(item.sharedWith || "")
      .split(",")
      .map((name) => name.trim())
      .filter(Boolean);
  const isShared = Boolean(item.isShared || sharedWith.length);
  const splitCount = isShared ? Math.max(2, Number(item.splitCount) || sharedWith.length + 1) : 1;
  const personalFee = Number(item.personalFee);

  return {
    id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
    name: String(item.name || "").trim(),
    category: String(category).trim() || "其他",
    fee: Math.max(0, Number(item.fee) || 0),
    currency: ["TWD", "USD", "JPY", "EUR"].includes(item.currency) ? item.currency : "TWD",
    cycle,
    cycleDays: cycle === "custom" ? Math.max(1, Number(item.cycleDays) || 30) : null,
    nextBillingDate: /^\d{4}-\d{2}-\d{2}$/.test(item.nextBillingDate || "")
      ? item.nextBillingDate
      : todayString(),
    startDate: /^\d{4}-\d{2}-\d{2}$/.test(item.startDate || "")
      ? item.startDate
      : item.createdAt || todayString(),
    status,
    statusHistory: normalizeStatusHistory(item, status),
    reminderDays,
    isShared,
    sharedWith,
    splitCount,
    personalFee: isShared && Number.isFinite(personalFee) && personalFee > 0 ? personalFee : null,
    paymentMethod: VALID_PAYMENT_METHODS.has(item.paymentMethod) ? item.paymentMethod : "credit_card",
    color: /^#[0-9a-f]{6}$/i.test(item.color || "") ? item.color : "#5c4efa",
    notes: String(item.notes || ""),
    createdAt: /^\d{4}-\d{2}-\d{2}$/.test(item.createdAt || "") ? item.createdAt : todayString()
  };
}

export async function getSubscriptions() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.subscriptions);
    return Array.isArray(result.subscriptions)
      ? result.subscriptions.map(normalizeSubscription)
      : [];
  } catch (error) {
    console.error("Unable to read subscriptions", error);
    return [];
  }
}

export async function saveSubscriptions(list) {
  try {
    const safeList = Array.isArray(list) ? list.map(normalizeSubscription) : [];
    await chrome.storage.local.set({ [STORAGE_KEYS.subscriptions]: safeList });
  } catch (error) {
    console.error("Unable to save subscriptions", error);
    throw error;
  }
}

export async function getSettings() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
    return mergeSettings(result.settings);
  } catch (error) {
    console.error("Unable to read settings", error);
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(settings) {
  try {
    await chrome.storage.local.set({ [STORAGE_KEYS.settings]: mergeSettings(settings) });
  } catch (error) {
    console.error("Unable to save settings", error);
    throw error;
  }
}

export async function addSubscription(item) {
  const subscriptions = await getSubscriptions();
  await saveSubscriptions([...subscriptions, normalizeSubscription(item)]);
}

export async function updateSubscription(id, updates) {
  const subscriptions = await getSubscriptions();
  const nextList = subscriptions.map((item) => (
    item.id === id ? normalizeSubscription({ ...item, ...updates, id: item.id }) : item
  ));
  await saveSubscriptions(nextList);
}

export async function deleteSubscription(id) {
  const subscriptions = await getSubscriptions();
  await saveSubscriptions(subscriptions.filter((item) => item.id !== id));
}

export async function updateStatus(id, newStatus, note = "") {
  if (!VALID_STATUS.has(newStatus)) return;

  const subscriptions = await getSubscriptions();
  const nextList = subscriptions.map((item) => {
    if (item.id !== id || item.status === newStatus) return item;
    return {
      ...item,
      status: newStatus,
      statusHistory: [
        ...item.statusHistory,
        { status: newStatus, changedAt: todayString(), note: String(note || "") }
      ]
    };
  });
  await saveSubscriptions(nextList);
}

export async function reactivateSubscription(id, newNextBillingDate) {
  const subscriptions = await getSubscriptions();
  const nextList = subscriptions.map((item) => {
    if (item.id !== id) return item;
    return {
      ...item,
      status: "active",
      nextBillingDate: newNextBillingDate,
      statusHistory: [
        ...item.statusHistory,
        { status: "active", changedAt: todayString(), note: "重新啟用" }
      ]
    };
  });
  await saveSubscriptions(nextList);
}
