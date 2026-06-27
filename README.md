# SubTrack

SubTrack 是一個 Manifest V3 Chrome Extension，用來手動記錄個人數位訂閱、估算有效月費，並在扣款前透過 Chrome 通知提醒。資料全部儲存在本機 `chrome.storage.local`，不需要後端、帳號或 npm 套件。

## 功能

- Popup 快速查看本月有效訂閱總支出，支援更清楚的卡片操作選單
- 訂閱狀態：訂閱中、已暫停、已到期
- 單次訂閱：到期後自動標記為已到期，不再續期
- Dashboard 總覽頁：分類篩選、狀態篩選、最近 3 筆扣款、7 天內扣款與已到期摘要
- 新增、編輯、暫停、停止、恢復、重新啟用訂閱
- 自訂分類：可新增或刪除分類，Dashboard 分類 tab 會跟著更新
- 共同訂閱：可記錄共同成員、分攤人數與個人負擔金額
- 付款方式：信用卡、金融卡、銀行轉帳、行動支付、現金或其他
- 支援 TWD、USD、JPY、EUR 與手動匯率，可指定主畫面總支出的主要顯示幣別
- 匯入、匯出、清除資料
- Bright fintech 視覺設計：Spend Bar、倒數 chip、滑動式 tab indicator、精品化表單分段與清楚空狀態

## 安裝

1. 開啟 Chrome，進入 `chrome://extensions`
2. 開啟右上角「開發人員模式」
3. 點選「載入未封裝項目」
4. 選擇本專案根目錄，也就是包含 `manifest.json` 的資料夾：

```text
.
```

SubTrack 目前不覆蓋 Chrome 原生新分頁，這是為了保留你平常使用 Chrome 主頁的習慣。完整 Dashboard 可從 popup 右上角的總覽按鈕開啟。

## 專案結構

```text
.
├── manifest.json
├── background/service-worker.js
├── popup/
├── newtab/
├── pages/
├── options/
├── styles/
├── utils/
└── icons/
```

## 訂閱資料格式

```json
{
  "id": "crypto.randomUUID()",
  "name": "Netflix",
  "category": "影音串流",
  "fee": 390,
  "currency": "TWD",
  "cycle": "monthly",
  "cycleDays": null,
  "nextBillingDate": "2026-07-15",
  "startDate": "2026-06-26",
  "status": "active",
  "statusHistory": [
    {
      "status": "active",
      "changedAt": "2026-06-26",
      "note": "建立訂閱"
    }
  ],
  "reminderDays": [7, 1],
  "isShared": true,
  "sharedWith": ["小美", "小華"],
  "splitCount": 3,
  "personalFee": 130,
  "paymentMethod": "credit_card",
  "color": "#e50914",
  "notes": "",
  "createdAt": "2026-06-26"
}
```

## 設定資料格式

```json
{
  "defaultCurrency": "TWD",
  "exchangeRates": {
    "USD": 32,
    "JPY": 0.22,
    "EUR": 35
  },
  "enableNotifications": true,
  "enableNewTab": false,
  "showExpiredInDashboard": true,
  "summaryAmountMode": "personal",
  "categories": [
    { "value": "影音串流", "label": "影音串流" },
    { "value": "音樂", "label": "音樂" },
    { "value": "其他", "label": "其他" }
  ]
}
```

## 狀態邏輯

- `active`：正常計費與提醒
- `paused`：保留資料，不計費、不提醒
- `expired`：到期或停止，不計費、不提醒
- `once` 單次訂閱到期後，service worker 會自動改為 `expired`
- 恢復或重新啟用時，需要指定新的下次扣款日期
- 設定頁可選擇總金額顯示方式：`personal` 顯示分攤後個人金額，`gross` 顯示未分攤總金額
- Popup 與 Dashboard 會依原始幣別先加總，再使用設定頁保存的匯率換算成 `defaultCurrency`
- 總支出下方會顯示公式，例如 `390 TWD + 1200 JPY + 9.99 USD = 977 TWD`；沒有訂閱項目的幣種不會顯示
- 卡片金額會優先使用 `personalFee`，若共同訂閱未填個人金額，則以 `fee / splitCount` 估算
- TWD 與 JPY 的分攤金額不允許小數；不能整除時，個人負擔預設為多 1 元的那份
- 刪除分類時，使用該分類的訂閱會自動移到「其他」

## 開發備註

- 純原生 JavaScript ES Modules
- 不使用 CSS framework、npm 套件、`innerHTML` 或 `eval()`
- Chrome API 呼叫集中在 storage、notification 與 service worker
- 通知排程使用 `chrome.alarms`
- UI 支援 `prefers-reduced-motion: reduce`
- Dashboard / Popup 使用 inline SVG icon，不使用 emoji icon
- 共用視覺 token 與基礎互動樣式集中在 `styles/theme.css`

## 驗證

已使用 bundled Node 對所有 `.js` 檔案執行語法檢查，並確認專案內沒有 `innerHTML`、`eval()`、emoji icon、Bootstrap 類型陰影或 `cursor: default`。
