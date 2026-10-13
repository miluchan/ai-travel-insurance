V2.3.0.5
根因修正：
- DB 行程日期可能為 YYYY/MM/DD；原 Travel Mode 用 datetime.fromisoformat 直接解析，解析失敗後誤判「旅程尚未結束」。
- GET Travel Mode 與 close API 統一先將 / 轉為 - 再判斷日期。
- 當旅程已結束且所有服務案件均完成，按右上「結束」會詢問「是否確認結案？」。
- 確認後才寫入 application_journey status/checkpoint=CLOSED。
- 再查投保清單應顯示「已結案」，執行欄空白。
