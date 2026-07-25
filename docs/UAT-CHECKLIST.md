# UAT Checklist — Staging

Run all tests on the **staging** environment before promoting to production.

## Automated (CI / scripts)

- [ ] GitHub CI passes: lint, typecheck, unit tests, security tests, build
- [ ] Deploy workflow succeeds on `miriam` branch
- [ ] Smoke test: `bash scripts/smoke-test.sh https://staging.your-domain.com`
- [ ] `npm run verify:double-booking` on staging DB — 0 duplicates

## Golden Path — Booking

- [ ] Create option on calendar
- [ ] Convert option to booking
- [ ] Fill booking form (clients, menu, upgrades)
- [ ] Sign contract digitally
- [ ] Generate and download PDF contract
- [ ] Upload deposit check (via S3 if configured)

## Event Form & Floor Plan

- [ ] Complete event form (הפקה)
- [ ] Build seating plan
- [ ] Export floor plan

## LIVE Reception

- [ ] Event shows LIVE badge on event day
- [ ] Check-in flow works
- [ ] Add live additions
- [ ] Customer signature on additions

## Integrations

- [ ] Google login with authorized email
- [ ] Unauthorized email rejected
- [ ] Email notification (or logged in staging)
- [ ] WhatsApp message (test number)
- [ ] EasyCount mock invoice flow
- [ ] Cron reminders (verify at 09:00 or trigger manually)

## Feedback

- [ ] Send feedback link via admin
- [ ] Client fills feedback form (public page)
- [ ] Stats appear in admin

## Devices

- [ ] Desktop Chrome — full flow
- [ ] iPad Safari — LIVE + seating plan

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Manager | | | [ ] |
| Dev | | | [ ] |

After all items pass, set `EASYCOUNT_MOCK_MODE=false` and `EASYCOUNT_MODE=live` in production secrets (when ready).
