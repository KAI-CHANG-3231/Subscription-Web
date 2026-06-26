import { getSettings, getSubscriptions } from "./storage.js";
import { getDaysUntil, formatDate } from "./date.js";

const ALARM_PREFIX = "subtrack_";

function getAlarmName(id, daysAhead) {
  return `${ALARM_PREFIX}${id}_${daysAhead}`;
}

function parseAlarmName(alarmName) {
  if (!alarmName.startsWith(ALARM_PREFIX)) return null;
  const body = alarmName.slice(ALARM_PREFIX.length);
  const separatorIndex = body.lastIndexOf("_");
  if (separatorIndex === -1) return null;
  return {
    id: body.slice(0, separatorIndex),
    daysAhead: Number(body.slice(separatorIndex + 1))
  };
}

export async function scheduleAllAlarms(subscriptions) {
  try {
    const settings = await getSettings();
    const alarms = await chrome.alarms.getAll();
    await Promise.all(
      alarms
        .filter((alarm) => alarm.name.startsWith(ALARM_PREFIX))
        .map((alarm) => chrome.alarms.clear(alarm.name))
    );

    if (!settings.enableNotifications) return;

    const activeSubscriptions = (subscriptions || []).filter((item) => item.isActive !== false);
    for (const item of activeSubscriptions) {
      const reminderDays = Array.isArray(item.reminderDays) && item.reminderDays.length
        ? item.reminderDays
        : [7, 1];

      for (const daysAhead of reminderDays) {
        const daysUntil = getDaysUntil(item.nextBillingDate);
        const fireInDays = daysUntil - Number(daysAhead);
        if (fireInDays < 0) continue;

        const when = Date.now() + fireInDays * 24 * 60 * 60 * 1000;
        await chrome.alarms.create(getAlarmName(item.id, daysAhead), { when });
      }
    }
  } catch (error) {
    console.error("Unable to schedule alarms", error);
  }
}

export async function handleAlarm(alarmName) {
  try {
    const parsed = parseAlarmName(alarmName);
    if (!parsed) return;

    const settings = await getSettings();
    if (!settings.enableNotifications) return;

    const subscriptions = await getSubscriptions();
    const item = subscriptions.find((subscription) => subscription.id === parsed.id);
    if (!item || item.isActive === false) return;

    const message = parsed.daysAhead === 0
      ? `${item.name} 今天扣款。`
      : `${item.name} 將在 ${parsed.daysAhead} 天後扣款，下次扣款日為 ${formatDate(item.nextBillingDate)}。`;
    await showNotification("SubTrack 扣款提醒", message);
  } catch (error) {
    console.error("Unable to handle alarm", error);
  }
}

export async function showNotification(title, message) {
  try {
    await chrome.notifications.create({
      type: "basic",
      iconUrl: chrome.runtime.getURL("icons/icon-128.png"),
      title,
      message
    });
  } catch (error) {
    console.error("Unable to show notification", error);
  }
}
