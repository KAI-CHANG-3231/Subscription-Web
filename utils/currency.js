const CURRENCY_OPTIONS = {
  TWD: { locale: "zh-TW", currency: "TWD", maximumFractionDigits: 0 },
  USD: { locale: "en-US", currency: "USD", maximumFractionDigits: 2 },
  JPY: { locale: "ja-JP", currency: "JPY", maximumFractionDigits: 0 },
  EUR: { locale: "de-DE", currency: "EUR", maximumFractionDigits: 2 }
};

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
  const twd = toTwd(amount, fromCurrency, settings);
  return fromTwd(twd, targetCurrency, settings);
}

export function formatCurrency(amount, currency) {
  const options = CURRENCY_OPTIONS[currency] || CURRENCY_OPTIONS.TWD;
  return new Intl.NumberFormat(options.locale, {
    style: "currency",
    currency: options.currency,
    maximumFractionDigits: options.maximumFractionDigits
  }).format(Number(amount) || 0);
}

export function calcMonthlyEquivalent(fee, cycle, cycleDays) {
  const amount = Number(fee) || 0;
  if (cycle === "yearly") return amount / 12;
  if (cycle === "custom") {
    const days = Number(cycleDays);
    return days > 0 ? amount * (30 / days) : amount;
  }
  return amount;
}
