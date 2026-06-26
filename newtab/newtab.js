import {
  deleteSubscription,
  getSettings,
  getSubscriptions,
  reactivateSubscription,
  updateStatus
} from "../utils/storage.js";
import { calcMonthlyEquivalent, convertToDefault, formatCurrency, getPersonalFee } from "../utils/currency.js";
import { formatDate, getDaysUntil, todayString } from "../utils/date.js";
import { CATEGORIES } from "../utils/presets.js";
import { scheduleAllAlarms } from "../utils/notification.js";

const todayLabelEl = document.querySelector("#today-label");
const monthlyTotalEl = document.querySelector("#monthly-total");
const monthlyChangeEl = document.querySelector("#monthly-change");
const subscriptionCountEl = document.querySelector("#subscription-count");
const nearestBillingListEl = document.querySelector("#nearest-billing-list");
const categoryTabsEl = document.querySelector("#category-tabs");
const tabIndicatorEl = document.querySelector("#tab-indicator");
const statusFilterEl = document.querySelector("#status-filter");
const gridEl = document.querySelector("#subscription-grid");
const emptyStateEl = document.querySelector("#empty-state");
const addButton = document.querySelector("#add-subscription");
const optionsButton = document.querySelector("#open-options");

let activeCategory = "all";
let activeStatus = "active";
let cachedSettings = null;
let cachedSubscriptions = [];

const tabs = [{ value: "all", label: "全部" }, ...CATEGORIES];

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
  if (status === "paused") return "暫停中";
  if (status === "expired") return "已到期";
  return "訂閱中";
}

function getPaymentLabel(method) {
  const labels = {
    credit_card: "信用卡",
    debit_card: "金融卡",
    bank_transfer: "銀行轉帳",
    mobile_payment: "行動支付",
    cash: "現金",
    other: "其他"
  };
  return labels[method] || labels.other;
}

function getSharedLabel(item) {
  if (!item.isShared) return "";
  const names = Array.isArray(item.sharedWith) ? item.sharedWith : [];
  if (names.length) return `與 ${names.join("、")} 共用`;
  return `${item.splitCount || 2} 人共同訂閱`;
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
  categoryTabsEl.replaceChildren(tabIndicatorEl, ...tabs.map(createTab));
  requestAnimationFrame(updateTabIndicator);
}

function updateTabIndicator() {
  const activeButton = categoryTabsEl.querySelector(".tab-button.active");
  if (!activeButton) return;
  categoryTabsEl.style.setProperty("--indicator-width", `${activeButton.offsetWidth}px`);
  categoryTabsEl.style.setProperty("--indicator-x", `${activeButton.offsetLeft}px`);
}

async function pauseSubscription(item) {
  await updateStatus(item.id, "paused", "使用者手動暫停");
  cachedSubscriptions = await getSubscriptions();
  await scheduleAllAlarms(cachedSubscriptions);
  await render();
}

async function stopSubscription(item) {
  const confirmed = confirm(`停止 ${item.name}？此項目會移到已到期。`);
  if (!confirmed) return;
  await updateStatus(item.id, "expired", "使用者手動停止");
  cachedSubscriptions = await getSubscriptions();
  await scheduleAllAlarms(cachedSubscriptions);
  await render();
}

async function permanentlyDeleteSubscription(item) {
  const confirmed = confirm(`永久刪除 ${item.name}？此操作無法復原。`);
  if (!confirmed) return;
  await deleteSubscription(item.id);
  cachedSubscriptions = await getSubscriptions();
  await scheduleAllAlarms(cachedSubscriptions);
  await render();
}

async function reactivate(item) {
  const nextDate = prompt("請輸入新的下次扣款日期（YYYY-MM-DD）", todayString());
  if (!nextDate || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) return;
  await reactivateSubscription(item.id, nextDate);
  cachedSubscriptions = await getSubscriptions();
  await scheduleAllAlarms(cachedSubscriptions);
  activeStatus = "active";
  statusFilterEl.value = activeStatus;
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

function createCard(item, index) {
  const monthly = convertToDefault(
    calcMonthlyEquivalent(getPersonalFee(item), item.cycle, item.cycleDays),
    item.currency,
    cachedSettings
  );

  const card = document.createElement("article");
  card.className = `subscription-card status-${item.status}`;
  card.style.setProperty("--spend-color", item.color || "#5c4efa");
  card.style.animationDelay = `${index * 40}ms`;

  const spendBar = document.createElement("span");
  spendBar.className = "spend-bar";

  const content = document.createElement("div");
  content.className = "card-content";

  const top = document.createElement("div");
  top.className = "card-top";

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = item.name;

  const category = document.createElement("span");
  category.className = "category-pill";
  category.textContent = item.category;

  top.append(title, category);

  if (item.status !== "active") {
    const badge = document.createElement("span");
    badge.className = `status-badge ${item.status}`;
    badge.textContent = getStatusLabel(item.status);
    top.append(badge);
  }

  const feeRow = document.createElement("div");
  feeRow.className = "fee-row";

  const fee = document.createElement("span");
  fee.className = "fee-value";
  fee.textContent = item.cycle === "once"
    ? formatCurrency(getPersonalFee(item), item.currency)
    : formatCurrency(monthly, cachedSettings.defaultCurrency);

  const cycle = document.createElement("span");
  cycle.className = "cycle-label";
  cycle.textContent = getCycleLabel(item);

  feeRow.append(fee, cycle);

  const date = document.createElement("span");
  date.className = "date-line";
  date.textContent = `下次扣款：${formatDate(item.nextBillingDate)}`;

  const detail = document.createElement("span");
  detail.className = "date-line";
  detail.textContent = [getPaymentLabel(item.paymentMethod), getSharedLabel(item)].filter(Boolean).join(" · ");

  content.append(top, feeRow, date, detail, createCountdownChip(item));

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
    appendAction(actions, "暫停", "text-button", () => pauseSubscription(item));
    appendAction(actions, "停止", "text-button danger-text", () => stopSubscription(item));
  } else if (item.status === "paused") {
    appendAction(actions, "恢復", "text-button", () => reactivate(item));
    appendAction(actions, "停止", "text-button danger-text", () => stopSubscription(item));
  } else {
    appendAction(actions, "重新啟用", "text-button", () => reactivate(item));
    appendAction(actions, "永久刪除", "text-button danger-text", () => permanentlyDeleteSubscription(item));
  }

  card.append(spendBar, content, menu, actions);
  return card;
}

function getVisibleSubscriptions() {
  return cachedSubscriptions
    .filter((item) => activeCategory === "all" || item.category === activeCategory)
    .filter((item) => activeStatus === "all" || item.status === activeStatus)
    .filter((item) => item.status !== "expired" || cachedSettings.showExpiredInDashboard)
    .sort((a, b) => {
      if (a.status === "expired" && b.status !== "expired") return 1;
      if (a.status !== "expired" && b.status === "expired") return -1;
      return a.nextBillingDate.localeCompare(b.nextBillingDate);
    });
}

function renderGrid() {
  const visibleSubscriptions = getVisibleSubscriptions();
  gridEl.replaceChildren(...visibleSubscriptions.map(createCard));
  emptyStateEl.hidden = visibleSubscriptions.length > 0;
}

function renderNearest(activeSubscriptions) {
  const nearest = [...activeSubscriptions]
    .sort((a, b) => a.nextBillingDate.localeCompare(b.nextBillingDate))
    .slice(0, 3);

  nearestBillingListEl.replaceChildren();
  if (!nearest.length) {
    const empty = document.createElement("em");
    empty.textContent = "最近扣款 --";
    nearestBillingListEl.append(empty);
    return;
  }

  nearest.forEach((item) => {
    const row = document.createElement("div");
    row.className = "nearest-row";
    const name = document.createElement("span");
    name.textContent = item.name;
    const date = document.createElement("time");
    date.textContent = formatDate(item.nextBillingDate);
    row.append(name, date);
    nearestBillingListEl.append(row);
  });
}

async function render() {
  cachedSettings = await getSettings();
  cachedSubscriptions = await getSubscriptions();
  const activeSubscriptions = cachedSubscriptions.filter((item) => item.status === "active");
  const recurringActive = activeSubscriptions.filter((item) => item.cycle !== "once");
  const monthlyTotal = recurringActive.reduce((sum, item) => {
    const monthly = calcMonthlyEquivalent(getPersonalFee(item), item.cycle, item.cycleDays);
    return sum + convertToDefault(monthly, item.currency, cachedSettings);
  }, 0);

  todayLabelEl.textContent = new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  }).format(new Date());
  monthlyTotalEl.textContent = formatCurrency(monthlyTotal, cachedSettings.defaultCurrency);
  monthlyChangeEl.textContent = "只計算訂閱中且非單次項目";
  subscriptionCountEl.textContent = `${activeSubscriptions.length} 項`;
  renderNearest(activeSubscriptions);

  renderTabs();
  renderGrid();
}

statusFilterEl.addEventListener("change", () => {
  activeStatus = statusFilterEl.value;
  renderGrid();
});
addButton.addEventListener("click", () => openExtensionPage("pages/add-edit.html"));
optionsButton.addEventListener("click", () => openExtensionPage("options/options.html"));

render().catch((error) => {
  console.error("Unable to render dashboard", error);
});
