# Go-Live Runbook — Production

Execute on go-live day in order. Do not skip steps.

## T-24h (day before)

- [ ] Confirm staging UAT sign-off ([`UAT-CHECKLIST.md`](UAT-CHECKLIST.md))
- [ ] Confirm production AWS resources ready (RDS Multi-AZ, App Runner, DNS, SSL)
- [ ] Confirm GitHub secrets for production deploy
- [ ] Prepare Excel/CSV master file for import
- [ ] Notify hall staff of maintenance window

## T-1h

### 1. Backup staging DB (reference)

```bash
cd server && npm run backup  # if configured
```

### 2. Deploy latest to production

```bash
git checkout main
git pull
git push origin main   # triggers deploy.yml → production
```

Wait for GitHub Actions deploy + smoke test to pass.

### 3. Backup production DB (before import)

```bash
# Via RDS console: Create snapshot "pre-golive-YYYY-MM-DD"
```

## T-0 — Go-Live

### 4. Import legacy data

```bash
cd server
npm run db:import-legacy -- --file ../data/legacy-2026-2027.csv
```

Review import summary — fix errors before continuing.

### 5. Verify no double bookings

```bash
npm run verify:double-booking
```

Must show 0 duplicates.

### 6. Seed authorized users

```bash
AUTHORIZED_USERS_EMAILS=manager@example.com,staff@example.com npm run seed:authorized-users
```

### 7. Smoke test production

```bash
bash scripts/smoke-test.sh https://app.your-domain.com
```

### 8. Integration checks

- [ ] Google login with manager account
- [ ] WhatsApp test message to real number
- [ ] Open today's calendar — events visible
- [ ] Generate one test PDF

### 9. DNS cutover

- [ ] Point production domain to App Runner URL (Route 53 or registrar)
- [ ] Verify SSL certificate active
- [ ] Confirm `CLIENT_URL` matches live domain

### 10. Final sign-off

- [ ] Manager/owner approval
- [ ] Mark go-live complete in [`GO-LIVE-CHECKLIST.html`](../GO-LIVE-CHECKLIST.html)

## Rollback plan

If critical issues occur within 2 hours:

1. Revert DNS to old system (if applicable)
2. In App Runner: deploy previous ECR image tag
3. Restore RDS snapshot `pre-golive-YYYY-MM-DD`
4. Document incident and root cause

## Post Go-Live (week 1)

- [ ] Monitor Sentry for errors
- [ ] Monitor CloudWatch App Runner metrics
- [ ] Daily `verify:double-booking` check
- [ ] Switch EasyCount to live mode after 1 week stable operation
