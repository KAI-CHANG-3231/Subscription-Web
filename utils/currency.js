const CURRENCY_OPTIONS = {
  TWD: { locale: "zh-TW", currency: "TWD", maximumFractionDigits: 0 },
  USD: { locale: "en-US", currency: "USD", maximumFractionDigits: 2 },
  JPY: { locale: "ja-JP", currency: "JPY", maximumFractionDigits: 0 },
  EUR: { locale: "de-DE", currency: "EUR", maximumFractionDigits: 2 }
};

export const SUPPORTED_CURRENCIES = ["TWD", "JPY", "USD", "EUR"];

const ZERO_DECIMAL_CURRENCIES = new Set(["TWD", "JPY"]);

function toTwd(amount, currency, settings) {
  if (currency === "TWD") return amount;
  const rate = Number(settings.exchangeRates?.[currency]);
  return amount * (Number.isFinite(rate) && rate > 0 ? rate : 1);
}

function fromTwd(amount, currency, settings) {
  if (currency === "TWD") return amount;
  const rate = Number(settings.exchangeRates?.[currency]);
  return amount / (Number.isFinite(rate) && rate > 0 ? rate : 1);
}

export function convertToDefault(fee, fromCurrency, settings) {
  const amount = Number(fee) || 0;
  const targetCurrency = settings.defaultCurrency || "TWD";
  return convertCurrency(amount, fromCurrency, targetCurrency, settings);
}

export function convertCurrency(fee, fromCurrency, targetCurrency, settings) {
  const amount = Number(fee) || 0;
  const safeTargetCurrency = CURRENCY_OPTIONS[targetCurrency] ? targetCurrency : "TWD";
  const twd = toTwd(amount, fromCurrency, settings);
  return fromTwd(twd, safeTargetCurrency, settings);
}

export function formatCurrency(amount, currency) {
  const options = CURRENCY_OPTIONS[currency] || CURRENCY_OPTIONS.TWD;
  return new Intl.NumberFormat(options.locale, {
    style: "currency",
    currency: options.currency,
    maximumFractionDigits: options.maximumFractionDigits
  }).format(Number(amount) || 0);
}

export function formatCurrencyCodeAmount(amount, currency) {
  const options = CURRENCY_OPTIONS[currency] || CURRENCY_OPTIONS.TWD;
  return `${new Intl.NumberFormat(options.locale, {
    maximumFractionDigits: options.maximumFractionDigits
  }).format(Number(amount) || 0)} ${options.currency}`;
}

export function summarizeMonthlyByCurrency(subscriptions, settings, getItemFee) {
  const displayCurrency = CURRENCY_OPTIONS[settings.defaultCurrency]
    ? settings.defaultCurrency
    : "TWD";
  const subtotals = SUPPORTED_CURRENCIES.reduce((result, currency) => {
    result[currency] = 0;
    return result;
  }, {});

  subscriptions
    .filter((item) => item.status === "active" && item.cycle !== "once")
    .forEach((item) => {
      const currency = CURRENCY_OPTIONS[item.currency] ? item.currency : "TWD";
      const fee = typeof getItemFee === "function" ? getItemFee(item, settings) : item.fee;
      const monthly = calcMonthlyEquivalent(fee, item.cycle, item.cycleDays);
      subtotals[currency] += monthly;
    });

  const parts = SUPPORTED_CURRENCIES
    .filter((currency) => subtotals[currency] > 0)
    .map((currency) => ({
      currency,
      amount: subtotals[currency]
    }));
  const total = parts.reduce((sum, part) => (
    sum + convertCurrency(part.amount, part.currency, displayCurrency, settings)
  ), 0);

  return { displayCurrency, parts, total };
}

export function formatCurrencyFormula(summary) {
  if (!summary.parts.length) return "沒有有效訂閱項目";

  const leftSide = summary.parts
    .map((part) => formatCurrencyCodeAmount(part.amount, part.currency))
    .join(" + ");
  return `${leftSide} = ${formatCurrencyCodeAmount(summary.total, summary.displayCurrency)}`;
}

export function calcMonthlyEquivalent(fee, cycle, cycleDays) {
  const amount = Number(fee) || 0;
  if (cycle === "once") return 0;
  if (cycle === "yearly") return amount / 12;
  if (cycle === "custom") {
    const days = Number(cycleDays);
    return days > 0 ? amount * (30 / days) : amount;
  }
  return amount;
}

export function isZeroDecimalCurrency(currency) {
  return ZERO_DECIMAL_CURRENCIES.has(currency);
}

export function calcSplitPersonalFee(fee, splitCount, currency) {
  const amount = Number(fee) || 0;
  const count = Math.max(1, Number(splitCount) || 1);
  const split = amount / count;

  if (isZeroDecimalCurrency(currency)) {
    return Math.ceil(split);
  }

  return Number(split.toFixed(2));
}

export function getPersonalFee(item) {
  const fee = Number(item?.fee) || 0;
  if (!item?.isShared) return fee;

  const personalFee = Number(item.personalFee);
  if (Number.isFinite(personalFee) && personalFee > 0) {
    return isZeroDecimalCurrency(item.currency) ? Math.ceil(personalFee) : personalFee;
  }

  const splitCount = Math.max(1, Number(item.splitCount) || 1);
  return calcSplitPersonalFee(fee, splitCount, item.currency);
}
