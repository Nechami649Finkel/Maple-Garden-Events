# החלטות Go-Live — מיפל

**תאריך אישור:** 14 ביולי 2026  
**סטטוס:** מאושר ליישום

## 1. RBAC — כולם Manager (ל-Go-Live מהיר)

- **החלטה:** לשלב הראשון כל המשתמשים המורשים יקבלו תפקיד `manager`.
- **רationale:** RBAC מיושם בשרת; ל-Go-Live אין צורך בהגבלות UI לפי תפקיד.
- **יישום:** `npm run seed:authorized-users` — ראה [`server/scripts/seed-authorized-users.ts`](../server/scripts/seed-authorized-users.ts).
- **לאחר Go-Live:** ניתן לעדכן תפקידים דרך הגדרות → משתמשים מורשים.

## 2. LIVE — אוטומטי (כמו היום)

- **החלטה:** מצב LIVE נקבע אוטומטית לפי תאריך האירוע (`isEventLive`) — ללא כפתור ידני.
- **רationale:** ההתנהגות הקיימת בלוח השנה מספקת; אין פיתוח נוסף נדרש.

## 3. EasyCount — Mock ב-staging, Live רק אחרי UAT

- **החלטה:**
  - **Staging:** `EASY_COUNT_MOCK_MODE=true`
  - **Production (Go-Live):** `EASY_COUNT_MOCK_MODE=true` עד סיום UAT מלא
  - **Production (לאחר UAT):** `EASY_COUNT_MOCK_MODE=false` + מפתחות אמיתיים
- **יישום:** ראה [`infra/env.staging.example`](../infra/env.staging.example) ו-[`infra/env.production.example`](../infra/env.production.example).

## 4. הגשת Client — SERVE_CLIENT=true

- **החלטה:** App Runner מריץ שרת אחד שמגיש גם API וגם React build (`SERVE_CLIENT=true`).
- **רationale:** פשטות ל-MVP — דומיין אחד, ללא CloudFront נפרד.
- **יישום:** מוגדר ב-Dockerfile ובמשתני staging/production.
