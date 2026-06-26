export const DEFAULT_CATEGORIES = [
  { value: "影音串流", label: "影音串流" },
  { value: "音樂", label: "音樂" },
  { value: "生產工具", label: "生產工具" },
  { value: "遊戲", label: "遊戲" },
  { value: "AI服務", label: "AI服務" },
  { value: "雲端儲存", label: "雲端儲存" },
  { value: "其他", label: "其他" }
];

export const CATEGORIES = DEFAULT_CATEGORIES;

export const STATUS_OPTIONS = [
  { value: "active", label: "訂閱中" },
  { value: "paused", label: "已暫停" },
  { value: "expired", label: "已到期" }
];

export const PRESETS = [
  { name: "Netflix", category: "影音串流", color: "#e50914", defaultFee: 390, defaultCurrency: "TWD" },
  { name: "YouTube Premium", category: "影音串流", color: "#ff0033", defaultFee: 179, defaultCurrency: "TWD" },
  { name: "Spotify", category: "音樂", color: "#1db954", defaultFee: 149, defaultCurrency: "TWD" },
  { name: "Apple Music", category: "音樂", color: "#fa586a", defaultFee: 165, defaultCurrency: "TWD" },
  { name: "Disney+", category: "影音串流", color: "#113ccf", defaultFee: 270, defaultCurrency: "TWD" },
  { name: "ChatGPT Plus", category: "AI服務", color: "#10a37f", defaultFee: 20, defaultCurrency: "USD" },
  { name: "Claude Pro", category: "AI服務", color: "#d97757", defaultFee: 20, defaultCurrency: "USD" },
  { name: "GitHub Copilot", category: "生產工具", color: "#24292f", defaultFee: 10, defaultCurrency: "USD" },
  { name: "Adobe Creative Cloud", category: "生產工具", color: "#ff0000", defaultFee: 1888, defaultCurrency: "TWD" },
  { name: "Microsoft 365", category: "生產工具", color: "#0078d4", defaultFee: 219, defaultCurrency: "TWD" },
  { name: "iCloud+", category: "雲端儲存", color: "#4aa3ff", defaultFee: 30, defaultCurrency: "TWD" },
  { name: "Google One", category: "雲端儲存", color: "#4285f4", defaultFee: 65, defaultCurrency: "TWD" },
  { name: "Amazon Prime", category: "影音串流", color: "#00a8e1", defaultFee: 14.99, defaultCurrency: "USD" },
  { name: "Nintendo Switch Online", category: "遊戲", color: "#e60012", defaultFee: 306, defaultCurrency: "TWD" },
  { name: "PS Plus", category: "遊戲", color: "#006fcd", defaultFee: 188, defaultCurrency: "TWD" },
  { name: "Notion", category: "生產工具", color: "#0f0e1a", defaultFee: 10, defaultCurrency: "USD" },
  { name: "Figma", category: "生產工具", color: "#a259ff", defaultFee: 15, defaultCurrency: "USD" },
  { name: "Canva Pro", category: "生產工具", color: "#00c4cc", defaultFee: 120, defaultCurrency: "USD" }
];
