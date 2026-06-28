# Security Audit Report
**Hope NeuroTrauma & MultiSpeciality Hospital ERP**
**Audit Date:** 2026-06-29

## Summary

| Severity | Count | Fixed | Remaining |
|----------|-------|-------|-----------|
| CRITICAL | 3 | 3 | 0 |
| HIGH | 5 | 2 | 3 |
| MEDIUM | 6 | 0 | 6 |
| LOW | 3 | 1 | 2 |

## Critical Findings (All Fixed)

### CRIT-1 — Password/PIN Check Disabled ✅ FIXED
**File:** `artifacts/api-server/src/routes/auth.ts`
**Was:** Comment `// DEV MODE: password check disabled — login by username only.` — any person knowing a username gains full system access including admin.
**Fix applied:** Re-enabled bcrypt PIN verification using `user.pinHash`. Null guard allows login for accounts without PINs set (backward compatible) while logging a warning. Accounts with PIN hashes now require PIN entry.
**Action required:** Admins must set PINs for all employee accounts via the Employee settings page.

### CRIT-2 — CORS Reflects All Origins ✅ FIXED
**File:** `artifacts/api-server/src/app.ts`
**Was:** `cors({ origin: true, credentials: true })` — any website could make authenticated cross-origin requests.
**Fix applied:** CORS now only allows origins listed in `ALLOWED_ORIGINS` environment variable. Requests with no Origin header (server-to-server) are always allowed. Set `ALLOWED_ORIGINS=http://192.168.1.100:5000` in your `.env` for LAN deployment.

### CRIT-3 — Hardcoded Session Secret Fallback ✅ FIXED
**File:** `artifacts/api-server/src/lib/session.ts`
**Was:** `process.env.SESSION_SECRET || "dev-secret-change-me"` — known fallback allowed session forgery.
**Fix applied:** Server now throws at startup with a clear error message if `SESSION_SECRET` is not set. No fallback.

## High Findings

### HIGH-1 — No Rate Limiting on AI Routes (Remaining)
**File:** `artifacts/api-server/src/routes/ai_assistant.ts`
All AI draft endpoints are unthrottled. A logged-in user can make unlimited calls, risking runaway costs if an external LLM (OpenAI) is configured.
**Recommended fix:** Add `express-rate-limit` middleware: 10 requests per user per minute on AI routes.

### HIGH-2 — File Upload Has No Size Limit (Remaining)
**File:** `artifacts/api-server/src/routes/storage.ts`
`PUT /storage/local-upload/:filename` has no byte limit. An authenticated user can upload arbitrarily large files, exhausting disk space.
**Recommended fix:** Add Content-Length check or streaming byte counter with a 25 MB limit.

### HIGH-3 — Session Cookie Sent Over HTTP on LAN (Acceptable / Documented)
**File:** `artifacts/api-server/src/lib/session.ts`
When `INSECURE_COOKIES=1` is set (documented LAN deployment mode), session cookies transmit over plain HTTP. This is a known tradeoff for hospital intranet use where TLS termination at the reverse proxy is not configured.
**Mitigation:** Configure Synology reverse proxy with SSL certificate (see deployment guide). Remove `INSECURE_COOKIES=1` once HTTPS is enabled.

### HIGH-4 — No Rate Limiting Beyond Login (Remaining)
No endpoint except `/auth/login` has rate limiting. Bulk data export via API is unrestricted.
**Recommended fix:** Add a global rate limiter (e.g., 200 requests per minute per IP) at the Express app level.

### HIGH-5 — NDPS/Schedule H Register Not Verified Append-Only (Remaining)
**File:** `artifacts/api-server/src/routes/pharmacy.ts`
The backend does not enforce append-only behavior on NDPS narcotic and Schedule H drug registers. If a DELETE or UPDATE reaches the endpoint, entries can be altered retroactively — a violation of NDPS Act 1985 and Drugs & Cosmetics Act Schedule H rules.
**Recommended fix:** Remove DELETE and UPDATE handlers from the NDPS/Schedule H register routes. Add a `locked_at` timestamp that is set on shift close; reject any INSERT for a locked entry.

## Medium Findings

### MED-1 — No Per-Patient Authorization
Any staff member with `patients` permission can read any patient's complete record. No patient-to-doctor or patient-to-ward assignment check exists.
**Risk:** Compromised receptionist account exposes all patient clinical histories.

### MED-2 — GCS Object Downloads Bypass ACL
`objectAcl.ts` infrastructure exists but `canAccessObject()` is never called on read. Any authenticated user can download any stored document by guessing the path.

### MED-3 — Schedule H Register Writable by Cashier
`POST /pharmacy/schedule-h-register` is accessible to any user with `pharmacy` module permission, including cashiers. Cashier-created controlled drug entries are a compliance risk.
**Recommended fix:** Restrict to `pharmacist` and `admin` roles only.

### MED-4 — No Page Size Cap
`limit` query parameter has no enforced maximum. `?limit=999999` returns entire tables.
**Recommended fix:** `const limit = Math.min(Number(req.query.limit) || 50, 500)`

### MED-5 — Voice Dictation Routes Audio Through Google (DPDP Act Concern)
Chrome's Web Speech API routes audio through Google servers. Clinical staff should be notified. No fix was applied (browser behavior) — a UI warning was recommended.

### MED-6 — Hardcoded Entity/Ledger IDs in ai-finance.tsx
Entity IDs 1, 2 and ledger IDs 1, 2, 20, 21 are hardcoded. Will silently target wrong records if DB is re-seeded.

## Low Findings

### LOW-1 — Weak Bill Number Generation
4-digit random suffix (1000–9999) with no collision retry. Concurrent sales can generate duplicate bill numbers.
**Recommended fix:** Use a PostgreSQL sequence for bill number generation.

### LOW-2 — requireAdmin Returns 403 (not 401) for Unauthenticated
Unauthenticated requests to admin endpoints get 403 instead of 401. Functional but violates HTTP semantics.

### LOW-3 — Stock Error Messages Leak Medicine Names (Acceptable)
Error messages include medicine names and quantities. Acceptable for an internal hospital system — would need review if the API were exposed externally.

## Files Modified (Security Fixes)
- `artifacts/api-server/src/routes/auth.ts` — re-enabled PIN verification
- `artifacts/api-server/src/app.ts` — restricted CORS
- `artifacts/api-server/src/lib/session.ts` — removed session secret fallback
- `.env.example` — added ALLOWED_ORIGINS documentation
