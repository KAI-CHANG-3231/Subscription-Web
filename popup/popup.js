import { deleteSubscription, getSettings, getSubscriptions } from "../utils/storage.js";
import { calcMonthlyEquivalent, convertToDefault, formatCurrency } from "../utils/currency.js";
import { formatDate, getDaysUntil } from "../utils/date.js";
import { scheduleAllAlarms } from "../utils/notification.js";

const monthlyTotalEl = document.querySelector("#monthly-total");
const countEl = document.querySelector("#subscription-count");
const listEl = document.querySelector("#subscription-list");
const emptyStateEl = document.querySelector("#empty-state");
const addButton = document.querySelector("#add-subscription");
const optionsButton = document.querySelector("#open-options");

function openExtensionPage(path) {
  chrome.tabs.create({ url: chrome.runtime.getURL(path) });
}

function getCountdownLabel(days) {
  if (days < 0) return "已逾期";
  if (days === 0) return "今天";
  return `${days} 天`;
}

function getCountdownClass(days) {
  if (days < 0) return "overdue";
  if (days <= 3) return "danger";
  if (days <= 7) return "warning";
  return "";
}

function createSubscriptionItem(item, settings) {
  const days = getDaysUntil(item.nextBillingDate);
  const itemEl = document.createElement("article");
  itemEl.className = "subscription-item";

  const swatch = document.createElement("span");
  swatch.className = "swatch";
  swatch.style.backgroundColor = item.color || "#2563eb";

  const main = document.createElement("div");
  main.className = "subscription-main";

  const name = document.createElement("div");
  name.className = "subscription-name";
  name.textContent = item.name;

  const meta = document.createElement("div");
  meta.className = "subscription-meta";
  const monthly = convertToDefault(
    calcMonthlyEquivalent(item.fee, item.cycle, item.cycleDays),
    item.currency,
    settings
  );
  meta.textContent = `${formatCurrency(monthly, settings.defaultCurrency)} / 月 · ${formatDate(item.nextBillingDate)}`;

  main.append(name, meta);

  const countdown = document.createElement("div");
  countdown.className = `countdown ${getCountdownClass(days)}`.trim();
  countdown.textContent = getCountdownLabel(days);

  const actions = document.createElement("div");
  actions.className = "item-actions";

  const editButton = document.createElement("button");
  editButton.type = "button";
  editButton.className = "text-button";
  editButton.textContent = "編輯";
  editButton.addEventListener("click", () => {
    openExtensionPage(`pages/add-edit.html?id=${encodeURIComponent(item.id)}`);
  });

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.className = "text-button danger-text";
  deleteButton.textContent = "刪除";
  deleteButton.addEventListener("click", async () => {
    const confirmed = confirm(`刪除 ${item.name}？`);
    if (!confirmed) return;
    await deleteSubscription(item.id);
    await scheduleAllAlarms(await getSubscriptions());
    await render();
  });

  actions.append(editButton, deleteButton);
  itemEl.append(swatch, main, countdown, actions);
  return itemEl;
}

async function render() {
  const [settings, subscriptions] = await Promise.all([getSettings(), getSubscriptions()]);
  const activeSubscriptions = subscriptions
    .filter((item) => item.isActive !== false)
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));

  const monthlyTotal = activeSubscriptions.reduce((sum, item) => {
    const monthly = calcMonthlyEquivalent(item.fee, item.cycle, item.cycleDays);
    return sum + convertToDefault(monthly, item.currency, settings);
  }, 0);

  monthlyTotalEl.textContent = formatCurrency(monthlyTotal, settings.defaultCurrency);
  countEl.textContent = `${activeSubscriptions.length} 項`;
  listEl.replaceChildren();
  emptyStateEl.hidden = activeSubscriptions.length > 0;

  activeSubscriptions.forEach((item) => {
    listEl.append(createSubscriptionItem(item, settings));
  });
}

addButton.addEventListener("click", () => openExtensionPage("pages/add-edit.html"));
optionsButton.addEventListener("click", () => openExtensionPage("options/options.html"));

render().catch((error) => {
  console.error("Unable to render popup", error);
});
