import { DEFAULT_SETTINGS, getSettings, getSubscriptions, saveSettings, saveSubscriptions } from "../utils/storage.js";
import { getDaysUntil, getNextBillingDate } from "../utils/date.js";
import { handleAlarm, scheduleAllAlarms } from "../utils/notification.js";

async function initializeSettings() {
  const settings = await getSettings();
  await saveSettings({ ...DEFAULT_SETTINGS, ...settings });
}

async function rollForwardOverdueSubscriptions() {
  const subscriptions = await getSubscriptions();
  let didUpdate = false;

  const nextList = subscriptions.map((item) => {
    if (item.isActive === false || getDaysUntil(item.nextBillingDate) >= 0) return item;

    let nextBillingDate = item.nextBillingDate;
    let guard = 0;
    while (getDaysUntil(nextBillingDate) < 0 && guard < 24) {
      nextBillingDate = getNextBillingDate(nextBillingDate, item.cycle, item.cycleDays);
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
    .then(getSubscriptions)
    .then(scheduleAllAlarms)
    .catch((error) => console.error("SubTrack installation setup failed", error));
});

chrome.runtime.onStartup.addListener(() => {
  rollForwardOverdueSubscriptions()
    .catch((error) => console.error("SubTrack startup check failed", error));
});

chrome.alarms.onAlarm.addListener((alarm) => {
  handleAlarm(alarm.name)
    .catch((error) => console.error("SubTrack alarm failed", error));
});
