# SubTrack

SubTrack 是一個純原生 JavaScript 開發的 Chrome Extension，用來手動管理個人訂閱服務、估算每月支出，並在扣款前透過 Chrome 通知提醒。

所有資料都儲存在本機 `chrome.storage.local`，不需要後端、帳號或 npm 套件。

## 功能

- Manifest V3 Chrome 擴充功能
- Popup 快速查看本月總支出與即將扣款項目
- 新分頁 Dashboard，支援分類篩選與系統 Dark Mode
- 新增、編輯、刪除訂閱
- 自訂月繳、年繳、固定天數週期
- 支援 TWD、USD、JPY、EUR，匯率可手動設定
- 扣款前 1、3、7、14 天提醒
- 設定頁可匯入、匯出、清除資料
- 常見服務 presets：Netflix、Spotify、ChatGPT Plus、Claude Pro、GitHub Copilot 等

## 安裝方式

1. 開啟 Chrome，進入 `chrome://extensions`
2. 開啟右上角「開發人員模式」
3. 點選「載入未封裝項目」
4. 選擇本專案資料夾：

```text
C:\Users\momoi\OneDrive\Desktop\codex專案\Subscription-Web
```

載入後可從工具列開啟 popup，也可直接打開擴充功能的設定頁調整匯率與功能開關。

## 專案結構

```text
.
├── manifest.json
├── background/
│   └── service-worker.js
├── popup/
│   ├── popup.html
│   ├── popup.js
│   └── popup.css
├── newtab/
│   ├── newtab.html
│   ├── newtab.js
│   └── newtab.css
├── pages/
│   ├── add-edit.html
│   ├── add-edit.js
│   └── add-edit.css
├── options/
│   ├── options.html
│   ├── options.js
│   └── options.css
├── utils/
│   ├── storage.js
│   ├── date.js
│   ├── currency.js
│   ├── notification.js
│   └── presets.js
└── icons/
    ├── icon-16.png
    ├── icon-48.png
    └── icon-128.png
```

## 資料格式

訂閱資料儲存在 `chrome.storage.local` 的 `subscriptions` key：

```json
{
  "id": "uuid-v4",
  "name": "Netflix",
  "category": "streaming",
  "fee": 390,
  "currency": "TWD",
  "cycle": "monthly",
  "cycleDays": null,
  "nextBillingDate": "2026-07-15",
  "reminderDays": [7, 1],
  "color": "#e50914",
  "notes": "",
  "createdAt": "2026-06-26",
  "isActive": true
}
```

設定資料儲存在 `settings` key：

```json
{
  "defaultCurrency": "TWD",
  "exchangeRates": {
    "USD": 32,
    "JPY": 0.22,
    "EUR": 35
  },
  "enableNotifications": true,
  "enableNewTab": true
}
```

## 開發備註

- 不使用外部框架或 npm 套件
- JavaScript 使用 ES Modules
- Chrome API 操作集中在 `utils/storage.js` 與 `utils/notification.js`
- 日期計算使用原生 `Date`
- UI 不使用 `innerHTML` 或 `eval()`
- 通知排程由 `chrome.alarms` 建立，新增、編輯、刪除或調整設定後會重新排程

## 驗證

已使用 bundled Node 對所有 `.js` 檔案執行語法檢查，並確認專案內沒有 `innerHTML` 或 `eval()`。
