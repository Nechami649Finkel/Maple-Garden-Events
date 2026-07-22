# Google OAuth — Production Setup

## 1. Google Cloud Console

1. Open [Google Cloud Console](https://console.cloud.google.com/) → APIs & Services → Credentials
2. Select your OAuth 2.0 Client ID (same as `GOOGLE_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`)

## 2. Authorized JavaScript origins

Add these origins:

| Environment | Origin |
|-------------|--------|
| Local dev | `http://localhost:5173` |
| Staging | `https://staging.your-domain.com` |
| Production | `https://app.your-domain.com` |

When using `SERVE_CLIENT=true`, the OAuth origin is the App Runner URL (same as `CLIENT_URL`).

## 3. Authorized redirect URIs

For Google Sign-In (popup/one-tap), redirect URIs are typically not required.
If using redirect flow, add:

- `https://app.your-domain.com`
- `https://staging.your-domain.com`

## 4. Environment variables

| Variable | Where | Value |
|----------|-------|-------|
| `GOOGLE_CLIENT_ID` | Server (Secrets Manager) | Client ID from Google Console |
| `VITE_GOOGLE_CLIENT_ID` | Docker build arg / GitHub secret | Same Client ID |

## 5. Authorized users in DB

After deploy, seed authorized emails:

```bash
AUTHORIZED_USERS_EMAILS=admin@example.com,staff@example.com npm run seed:authorized-users
```

Only emails in `AuthorizedUser` table can log in.

## 6. Verification checklist

- [ ] Login works on staging with real Google account
- [ ] Unauthorized email is rejected
- [ ] `CLIENT_URL` matches the browser URL exactly (no trailing slash mismatch)
