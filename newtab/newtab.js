import { deleteSubscription, getSettings, getSubscriptions } from "../utils/storage.js";
import { calcMonthlyEquivalent, convertToDefault, formatCurrency } from "../utils/currency.js";
import { formatDate, getDaysUntil } from "../utils/date.js";
import { CATEGORIES } from "../utils/presets.js";
import { scheduleAllAlarms } from "../utils/notification.js";

const appEl = document.querySelector("#app");
const todayLabelEl = document.querySelector("#today-label");
const monthlyTotalEl = document.querySelector("#monthly-total");
const categoryTabsEl = document.querySelector("#category-tabs");
const gridEl = document.querySelector("#subscription-grid");
const emptyStateEl = document.querySelector("#empty-state");
const addButton = document.querySelector("#add-subscription");
const optionsButton = document.querySelector("#open-options");

let activeCategory = "all";
let cachedSettings = null;
let cachedSubscriptions = [];

const tabs = [{ value: "all", label: "All" }, ...CATEGORIES];

function openExtensionPage(path) {
  chrome.tabs.create({ url: chrome.runtime.getURL(path) });
}

function getCategoryLabel(category) {
  return CATEGORIES.find((item) => item.value === category)?.label || "Other";
}

function getCountdownLabel(days) {
  if (days < 0) return "已逾期";
  if (days === 0) return "今天扣款";
  return `${days} 天後`;
}

function getCountdownClass(days) {
  if (days < 0) return "overdue";
  if (days <= 3) return "danger";
  if (days <= 7) return "warning";
  return "";
}

function createTab(tab) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = tab.value === activeCategory ? "tab-button active" : "tab-button";
  button.textContent = tab.label;
  button.addEventListener("click", () => {
    activeCategory = tab.value;
    renderTabs();
    renderGrid();
  });
  return button;
}

function renderTabs() {
  categoryTabsEl.replaceChildren(...tabs.map(createTab));
}

function createCard(item) {
  const days = getDaysUntil(item.nextBillingDate);
  const monthly = convertToDefault(
    calcMonthlyEquivalent(item.fee, item.cycle, item.cycleDays),
    item.currency,
    cachedSettings
  );

  const card = document.createElement("article");
  card.className = "subscription-card";

  const top = document.createElement("div");
  top.className = "card-top";

  const color = document.createElement("span");
  color.className = "service-color";
  color.style.backgroundColor = item.color || "#2563eb";

  const category = document.createElement("span");
  category.className = "category-pill";
  category.textContent = getCategoryLabel(item.category);

  top.append(color, category);

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = item.name;

  const meta = document.createElement("div");
  meta.className = "card-meta";

  const fee = document.createElement("span");
  fee.textContent = `${formatCurrency(monthly, cachedSettings.defaultCurrency)} / 月`;

  const date = document.createElement("span");
  date.textContent = `下次扣款：${formatDate(item.nextBillingDate)}`;

  const countdown = document.createElement("span");
  countdown.className = `countdown ${getCountdownClass(days)}`.trim();
  countdown.textContent = getCountdownLabel(days);

  meta.append(fee, date, countdown);

  const actions = document.createElement("div");
  actions.className = "card-actions";

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
    cachedSubscriptions = await getSubscriptions();
    await scheduleAllAlarms(cachedSubscriptions);
    renderGrid();
  });

  actions.append(editButton, deleteButton);
  card.append(top, title, meta, actions);
  return card;
}

function renderGrid() {
  const activeSubscriptions = cachedSubscriptions
    .filter((item) => item.isActive !== false)
    .filter((item) => activeCategory === "all" || item.category === activeCategory)
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));

  gridEl.replaceChildren(...activeSubscriptions.map(createCard));
  emptyStateEl.hidden = activeSubscriptions.length > 0;
}

function renderBlankPage() {
  appEl.className = "newtab-shell blank";
  appEl.replaceChildren();
  const message = document.createElement("p");
  message.className = "blank-message";
  message.textContent = "SubTrack 新分頁已停用，可在擴充功能設定中重新開啟。";
  appEl.append(message);
}

async function render() {
  cachedSettings = await getSettings();
  if (!cachedSettings.enableNewTab) {
    renderBlankPage();
    return;
  }

  cachedSubscriptions = await getSubscriptions();
  const activeSubscriptions = cachedSubscriptions.filter((item) => item.isActive !== false);
  const monthlyTotal = activeSubscriptions.reduce((sum, item) => {
    const monthly = calcMonthlyEquivalent(item.fee, item.cycle, item.cycleDays);
    return sum + convertToDefault(monthly, item.currency, cachedSettings);
  }, 0);

  todayLabelEl.textContent = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date());
  monthlyTotalEl.textContent = formatCurrency(monthlyTotal, cachedSettings.defaultCurrency);

  renderTabs();
  renderGrid();
}

addButton.addEventListener("click", () => openExtensionPage("pages/add-edit.html"));
optionsButton.addEventListener("click", () => openExtensionPage("options/options.html"));

render().catch((error) => {
  console.error("Unable to render new tab", error);
});
