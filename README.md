# 統香生產看板

統香蜂蜜工廠的線上生產排程系統：行政輸入訂單、生產端觸控排序、批號自動產生、完成回報、生產紀錄查詢與匯出。

- 網站：Render（Node.js）
- 資料庫：Neon PostgreSQL（資料表在第一次啟動時自動建立）
- 同事開網址即可使用，不需登入；可選擇設定一組公司共用密碼

## 第一次部署（只需做一次）

### 1. 在 Neon 建立資料庫
1. 登入 Neon，進入目前行銷工具用的專案。
2. 左側選 **Databases** → **New database**，名稱填 `production`。
3. 到 **Dashboard** → **Connection string**，資料庫選 `production`，複製整串連線字串（`postgresql://...` 開頭）。

### 2. 在 Render 建立網站
1. 登入 Render → 右上 **New** → **Blueprint**。
2. 選擇 `ts-production-board` 這個 repo。
3. 畫面會要求填兩個值：
   - `DATABASE_URL`：貼上第 1 步複製的連線字串
   - `APP_PIN`：公司共用密碼（例如 4～6 位數字）。留空代表不設密碼，拿到網址的人都能進入。
4. 按 **Apply**，約 2～3 分鐘後完成，Render 會給你網址（`https://ts-production-board.onrender.com` 之類）。

> 這份設定使用 Render 最低階付費方案（每月 7 美元），網站不會休眠。若要改免費方案，把 `render.yaml` 裡的 `plan: starter` 改成 `plan: free`，但 15 分鐘沒人用就會休眠，下次打開要等約一分鐘。

### 3. 開始使用
1. 打開網址 → **設定**：新增生產人員、建立品項（類別與品種代碼已預先建好）。
2. **訂單輸入**：輸入客戶、品項、數量、出貨日。
3. 工廠觸控螢幕打開網址停在 **生產看板**。手機或平板可用瀏覽器的「加入主畫面」。

之後每次程式更新推到 GitHub，Render 會自動重新部署。

## 批號規則

| 類型 | 適用類別 | 格式 | 說明 |
|---|---|---|---|
| 原料批型 | S 糖漿 | `HS0913B-F` | 年份＋類別＋主原料有效日 MMDD＋到貨次序－該原料批第幾批 |
| 月份型 | P 純蜜、J 果樂茶、O 油品、V 蜂蜜醋 | `HP091-A` | 年份＋類別＋生產月份＋品種－該月該品種第幾批 |

- 年份代碼：2026 = H，每年往後一個字母。
- 生產月份與年份依台灣時間計算。
- 序號由伺服器統一產生，兩台裝置同時完成也不會重號。
- 類別、品種代碼可在「設定」頁新增。

## 本機開發

```
npm install
DATABASE_URL=postgres://user:pass@localhost:5432/production npm start
```

環境變數：`DATABASE_URL`（必填）、`APP_PIN`（選填）、`PORT`（預設 3000）。
