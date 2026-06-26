import {
  getSettings,
  getSubscriptions,
  reactivateSubscription,
  updateStatus
} from "../utils/storage.js";
import { calcMonthlyEquivalent, convertToDefault, formatCurrency } from "../utils/currency.js";
import { formatDate, getDaysUntil, todayString } from "../utils/date.js";
import { scheduleAllAlarms } from "../utils/notification.js";

const monthlyTotalEl = document.querySelector("#monthly-total");
const monthlyChangeEl = document.querySelector("#monthly-change");
const countEl = document.querySelector("#subscription-count");
const listTitleEl = document.querySelector("#list-title");
const listEl = document.querySelector("#subscription-list");
const emptyStateEl = document.querySelector("#empty-state");
const addButton = document.querySelector("#add-subscription");
const dashboardButton = document.querySelector("#open-dashboard");
const optionsButton = document.querySelector("#open-options");
const statusTabs = Array.from(document.querySelectorAll(".status-tab"));

let activeStatus = "active";

function openExtensionPage(path) {
  chrome.tabs.create({ url: chrome.runtime.getURL(path) });
}

function getCountdownLabel(days) {
  if (days < 0) return "已逾期";
  if (days === 0) return "今天扣款";
  return `${days} 天後扣款`;
}

function getCountdownClass(days) {
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days <= 3) return "danger";
  if (days <= 7) return "warning";
  return "";
}

function getCycleLabel(item) {
  if (item.cycle === "yearly") return "每年";
  if (item.cycle === "custom") return `每 ${item.cycleDays || 30} 天`;
  if (item.cycle === "once") return "單次";
  return "每月";
}

function getStatusLabel(status) {
  if (status === "paused") return "已暫停";
  if (status === "expired") return "已到期";
  return "訂閱中";
}

function createMenuButton() {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "menu-button";
  button.setAttribute("aria-label", "更多操作");
  button.title = "更多操作";

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  [5, 12, 19].forEach((cy) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("cx", "12");
    circle.setAttribute("cy", String(cy));
    circle.setAttribute("r", "1");
    svg.append(circle);
  });

  button.append(svg);
  return button;
}

function createCountdownChip(item) {
  const days = getDaysUntil(item.nextBillingDate);
  const chip = document.createElement("span");
  chip.className = `countdown-chip ${getCountdownClass(days)}`.trim();

  if (days > 0 && days <= 7) {
    const dot = document.createElement("span");
    dot.className = "pulse-dot";
    chip.append(dot);
  }

  const label = document.createElement("span");
  label.textContent = item.status === "active" ? getCountdownLabel(days) : getStatusLabel(item.status);
  chip.append(label);

  if (item.cycle === "once") {
    const oncePill = document.createElement("span");
    oncePill.className = "once-pill";
    oncePill.textContent = "單次";
    chip.append(oncePill);
  }

  return chip;
}

async function pauseSubscription(item) {
  await updateStatus(item.id, "paused", "使用者手動暫停");
  await scheduleAllAlarms(await getSubscriptions());
  await render();
}

async function stopSubscription(item) {
  const confirmed = confirm(`停止 ${item.name}？此項目會移到已到期。`);
  if (!confirmed) return;
  await updateStatus(item.id, "expired", "使用者手動停止");
  await scheduleAllAlarms(await getSubscriptions());
  await render();
}

async function reactivate(item) {
  const nextDate = prompt("請輸入新的下次扣款日期（YYYY-MM-DD）", todayString());
  if (!nextDate || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
  await reactivateSubscription(item.id, nextDate);
  await scheduleAllAlarms(await getSubscriptions());
  activeStatus = "active";
  await render();
}

function appendAction(actions, label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", handler);
  actions.append(button);
}

function createSubscriptionItem(item, settings, index) {
  const card = document.createElement("article");
  card.className = `subscription-card status-${item.status}`;
  card.style.setProperty("--spend-color", item.color || "#5c4efa");
  card.style.animationDelay = `${index * 40}ms`;

  const spendBar = document.createElement("span");
  spendBar.className = "spend-bar";

  const content = document.createElement("div");
  content.className = "subscription-content";

  const titleRow = document.createElement("div");
  titleRow.className = "subscription-row";

  const name = document.createElement("div");
  name.className = "subscription-name";
  name.textContent = item.name;

  const category = document.createElement("span");
  category.className = "category-pill";
  category.textContent = item.category;

  titleRow.append(name, category);

  const feeRow = document.createElement("div");
  feeRow.className = "fee-row";

  const feeValue = document.createElement("span");
  feeValue.className = "fee-value";
  const monthly = convertToDefault(
    calcMonthlyEquivalent(item.fee, item.cycle, item.cycleDays),
    item.currency,
    settings
  );
  feeValue.textContent = item.cycle === "once"
    ? formatCurrency(item.fee, item.currency)
    : formatCurrency(monthly, settings.defaultCurrency);

  const cycleLabel = document.createElement("span");
  cycleLabel.className = "cycle-label";
  cycleLabel.textContent = `${getCycleLabel(item)} · ${formatDate(item.nextBillingDate)}`;

  feeRow.append(feeValue, cycleLabel);
  content.append(titleRow, feeRow, createCountdownChip(item));

  const menu = document.createElement("div");
  menu.className = "card-menu";
  const menuButton = createMenuButton();
  menuButton.addEventListener("click", (event) => {
    event.stopPropagation();
    card.classList.toggle("menu-open");
  });
  menu.append(menuButton);

  const actions = document.createElement("div");
  actions.className = "card-actions";
  appendAction(actions, "編輯", "text-button", () => {
    openExtensionPage(`pages/add-edit.html?id=${encodeURIComponent(item.id)}`);
  });

  if (item.status === "active") {
    appendAction(actions, "暫停訂閱", "text-button", () => pauseSubscription(item));
    appendAction(actions, "停止訂閱", "text-button danger-text", () => stopSubscription(item));
  } else if (item.status === "paused") {
    appendAction(actions, "恢復訂閱", "text-button", () => reactivate(item));
    appendAction(actions, "停止訂閱", "text-button danger-text", () => stopSubscription(item));
  } else {
    appendAction(actions, "重新啟用", "text-button", () => reactivate(item));
  }

  card.append(spendBar, content, menu, actions);
  return card;
}

function setActiveTab() {
  statusTabs.forEach((button) => {
    const isActive = button.dataset.status === activeStatus;
    button.classList.toggle("active", isActive);
  });
  listTitleEl.textContent = getStatusLabel(activeStatus);
}

async function render() {
  const [settings, subscriptions] = await Promise.all([getSettings(), getSubscriptions()]);
  const activeSubscriptions = subscriptions
    .filter((item) => item.status === "active" && item.cycle !== "once")
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));

  const monthlyTotal = activeSubscriptions.reduce((sum, item) => {
    const monthly = calcMonthlyEquivalent(item.fee, item.cycle, item.cycleDays);
    return sum + convertToDefault(monthly, item.currency, settings);
  }, 0);

  const visibleSubscriptions = subscriptions
    .filter((item) => item.status === activeStatus)
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate));

  monthlyTotalEl.textContent = formatCurrency(monthlyTotal, settings.defaultCurrency);
  monthlyChangeEl.textContent = "只計算訂閱中且非單次項目";
  countEl.textContent = `${visibleSubscriptions.length} 項`;
  setActiveTab();
  listEl.replaceChildren();
  emptyStateEl.hidden = visibleSubscriptions.length > 0;

  visibleSubscriptions.forEach((item, index) => {
    listEl.append(createSubscriptionItem(item, settings, index));
  });
}

statusTabs.forEach((button) => {
  button.addEventListener("click", async () => {
    activeStatus = button.dataset.status;
    await render();
  });
});
addButton.addEventListener("click", () => openExtensionPage("pages/add-edit.html"));
dashboardButton.addEventListener("click", () => openExtensionPage("newtab/newtab.html"));
optionsButton.addEventListener("click", () => openExtensionPage("options/options.html"));

render().catch((error) => {
  console.error("Unable to render popup", error);
});
