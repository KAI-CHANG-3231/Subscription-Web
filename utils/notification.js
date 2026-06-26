import { getSettings, getSubscriptions } from "./storage.js";
import { formatDate, getDaysUntil } from "./date.js";

const ALARM_PREFIX = "subtrack_";
const NOTIFICATION_LOG_KEY = "notificationLog";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

function getReminderLogKey(item, daysAhead) {
  return `${item.id}|${item.nextBillingDate}|${daysAhead}`;
}

async function getNotificationLog() {
  try {
    const result = await chrome.storage.local.get(NOTIFICATION_LOG_KEY);
    return result[NOTIFICATION_LOG_KEY] && typeof result[NOTIFICATION_LOG_KEY] === "object"
      ? result[NOTIFICATION_LOG_KEY]
      : {};
  } catch (error) {
    console.error("Unable to read notification log", error);
    return {};
  }
}

async function saveNotificationLog(log) {
  try {
    const entries = Object.entries(log).slice(-500);
    await chrome.storage.local.set({ [NOTIFICATION_LOG_KEY]: Object.fromEntries(entries) });
  } catch (error) {
    console.error("Unable to save notification log", error);
  }
}

export async function scheduleAllAlarms(subscriptions) {
  try {
    const settings = await getSettings();
    const notificationLog = await getNotificationLog();
    const alarms = await chrome.alarms.getAll();
    await Promise.all(
      alarms
        .filter((alarm) => alarm.name.startsWith(ALARM_PREFIX))
        .map((alarm) => chrome.alarms.clear(alarm.name))
    );

    if (!settings.enableNotifications) return;

    const activeSubscriptions = (subscriptions || []).filter((item) => item.status === "active");
    for (const item of activeSubscriptions) {
      const reminderDays = Array.isArray(item.reminderDays) && item.reminderDays.length
        ? item.reminderDays
        : item.cycle === "once"
          ? [3, 1]
          : [7, 1];

      for (const daysAhead of reminderDays) {
        const daysUntil = getDaysUntil(item.nextBillingDate);
        const fireInDays = daysUntil - Number(daysAhead);
        if (fireInDays < 0) continue;
        if (notificationLog[getReminderLogKey(item, daysAhead)]) continue;

        const delay = fireInDays === 0 ? 1000 : fireInDays * MS_PER_DAY;
        const when = Date.now() + delay;
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
    if (!item || item.status !== "active") return;

    const notificationLog = await getNotificationLog();
    const logKey = getReminderLogKey(item, parsed.daysAhead);
    if (notificationLog[logKey]) return;

    const message = parsed.daysAhead === 0
      ? `${item.name} 今天扣款。`
      : `${item.name} 將在 ${parsed.daysAhead} 天後扣款，下次扣款日為 ${formatDate(item.nextBillingDate)}。`;
    await showNotification("SubTrack 扣款提醒", message);
    notificationLog[logKey] = new Date().toISOString();
    await saveNotificationLog(notificationLog);
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
