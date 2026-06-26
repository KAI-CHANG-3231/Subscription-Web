export const DEFAULT_SETTINGS = {
  defaultCurrency: "TWD",
  exchangeRates: {
    USD: 32,
    JPY: 0.22,
    EUR: 35
  },
  enableNotifications: true,
  enableNewTab: true
};

const STORAGE_KEYS = {
  subscriptions: "subscriptions",
  settings: "settings"
};

function mergeSettings(settings = {}) {
  return {
    ...DEFAULT_SETTINGS,
    ...settings,
    exchangeRates: {
      ...DEFAULT_SETTINGS.exchangeRates,
      ...(settings.exchangeRates || {})
    }
  };
}

export async function getSubscriptions() {
  try {
    const result = await chrome.storage.local.get(STORAGE_KEYS.subscriptions);
    return Array.isArray(result.subscriptions) ? result.subscriptions : [];
  } catch (error) {
    console.error("Unable to read subscriptions", error);
    return [];
  }
}

export async function saveSubscriptions(list) {
  try {
    const safeList = Array.isArray(list) ? list : [];
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
  await saveSubscriptions([...subscriptions, item]);
}

export async function updateSubscription(id, updates) {
  const subscriptions = await getSubscriptions();
  const nextList = subscriptions.map((item) => (
    item.id === id ? { ...item, ...updates } : item
  ));
  await saveSubscriptions(nextList);
}

export async function deleteSubscription(id) {
  const subscriptions = await getSubscriptions();
  await saveSubscriptions(subscriptions.filter((item) => item.id !== id));
}
