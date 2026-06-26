import { todayString } from "./date.js";

export const DEFAULT_SETTINGS = {
  defaultCurrency: "TWD",
  exchangeRates: {
    USD: 32,
    JPY: 0.22,
    EUR: 35
  },
  enableNotifications: true,
  enableNewTab: false,
  showExpiredInDashboard: true
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

const VALID_CATEGORIES = new Set([
  "影音串流",
  "音樂",
  "生產工具",
  "遊戲",
  "AI服務",
  "雲端儲存",
  "其他"
]);

const VALID_STATUS = new Set(["active", "paused", "expired"]);

function mergeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    enableNewTab: false,
    exchangeRates: {
      ...DEFAULT_SETTINGS.exchangeRates,
      ...(settings.exchangeRates || {})
    }
  };
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
  const category = CATEGORY_MAP[item.category] || item.category;
  const cycle = ["monthly", "yearly", "custom", "once"].includes(item.cycle)
    ? item.cycle
    : "monthly";
  const reminderDays = Array.isArray(item.reminderDays) && item.reminderDays.length
    ? item.reminderDays.map(Number).filter((day) => Number.isFinite(day) && day >= 0)
    : cycle === "once"
      ? [3, 1]
      : [7, 1];

  return {
    id: typeof item.id === "string" && item.id ? item.id : crypto.randomUUID(),
    name: String(item.name || "").trim(),
    category: VALID_CATEGORIES.has(category) ? category : "其他",
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
