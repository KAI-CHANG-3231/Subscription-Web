const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseLocalDate(dateStr) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateInput(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysInMonth(year, zeroBasedMonth) {
  return new Date(year, zeroBasedMonth + 1, 0).getDate();
}

export function todayString() {
  return formatDateInput(new Date());
}

export function getNextBillingDate(lastDate, cycle, cycleDays) {
  const base = parseLocalDate(lastDate);

  if (cycle === "yearly") {
    const year = base.getFullYear() + 1;
    const month = base.getMonth();
    const day = Math.min(base.getDate(), getDaysInMonth(year, month));
    return formatDateInput(new Date(year, month, day));
  }

  if (cycle === "custom") {
    const days = Number(cycleDays);
    const next = new Date(base);
    next.setDate(next.getDate() + (Number.isFinite(days) && days > 0 ? days : 30));
    return formatDateInput(next);
  }

  const month = base.getMonth() + 1;
  const year = base.getFullYear() + Math.floor(month / 12);
  const nextMonth = month % 12;
  const day = Math.min(base.getDate(), getDaysInMonth(year, nextMonth));
  return formatDateInput(new Date(year, nextMonth, day));
}

export function getDaysUntil(dateStr) {
  const target = parseLocalDate(dateStr);
  const today = parseLocalDate(todayString());
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY);
}

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = parseLocalDate(dateStr);
  return new Intl.DateTimeFormat("zh-TW", {
    month: "long",
    day: "numeric"
  }).format(date);
}

export function isOverdue(dateStr) {
  return getDaysUntil(dateStr) < 0;
}
