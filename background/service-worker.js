import { DEFAULT_SETTINGS, getSettings, getSubscriptions, saveSettings, saveSubscriptions } from "../utils/storage.js";
import { getDaysUntil, getNextBillingDate, todayString } from "../utils/date.js";
import { handleAlarm, scheduleAllAlarms } from "../utils/notification.js";

async function initializeSettings() {
  const settings = await getSettings();
  await saveSettings({ ...DEFAULT_SETTINGS, ...settings });
}

async function reconcileSubscriptions() {
  const subscriptions = await getSubscriptions();
  let didUpdate = false;

  const nextList = subscriptions.map((item) => {
    if (item.status !== "active" || getDaysUntil(item.nextBillingDate) >= 0) return item;

    if (item.cycle === "once") {
      didUpdate = true;
      return {
        ...item,
        status: "expired",
        statusHistory: [
          ...item.statusHistory,
          { status: "expired", changedAt: todayString(), note: "單次訂閱到期" }
        ]
      };
    }

    let nextBillingDate = item.nextBillingDate;
    let guard = 0;
    while (getDaysUntil(nextBillingDate) < 0 && guard < 36) {
      nextBillingDate = getNextBillingDate(nextBillingDate, item.cycle, item.cycleDays);
      if (!nextBillingDate) break;
      guard += 1;
    }

    didUpdate = true;
    return { ...item, nextBillingDate };
  });

  if (didUpdate) {
    await saveSubscriptions(nextList);
  }

  await scheduleAllAlarms(nextList);
}

chrome.runtime.onInstalled.addListener(() => {
  initializeSettings()
    .then(reconcileSubscriptions)
    .catch((error) => console.error("SubTrack installation setup failed", error));
});

chrome.runtime.onStartup.addListener(() => {
  reconcileSubscriptions()
    .catch((error) => console.error("SubTrack startup check failed", error));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  handleAlarm(alarm.name)
    .then(reconcileSubscriptions)
    .catch((error) => console.error("SubTrack alarm failed", error));
});
