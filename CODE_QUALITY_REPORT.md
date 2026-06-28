# Code Quality Report
**Hope NeuroTrauma & MultiSpeciality Hospital ERP**
**Audit Date:** 2026-06-29

## TypeScript Configuration

| Setting | Status | Risk |
|---------|--------|------|
| `strict: true` | NOT SET | Medium — manually cherry-picked instead |
| `noImplicitAny` | ✅ enabled | — |
| `strictNullChecks` | ✅ enabled | — |
| `strictFunctionTypes` | ❌ DISABLED | Medium — unsound function variance |
| `noUnusedLocals` | ❌ disabled | Low |
| `useUnknownInCatchVariables` | ✅ enabled | — |

**Recommendation:** Add `"strict": true` to `tsconfig.base.json` and remove the individual flags. Fix the `strictFunctionTypes` violations (there are likely several in callback-heavy route handlers).

## `any` Type Usage

Pervasive `any` usage in backend routes — particularly in financial and pharmacy modules:

| File | Severity | Pattern |
|------|----------|---------|
| `routes/ai_assistant.ts` | HIGH | Entire data payload interface typed `any` (20+ uses) |
| `routes/pharmacy-v4.ts` | HIGH | `(req: any, res: any, next: any)` — bypasses Express types entirely |
| `routes/accounting.ts` | HIGH | `const updates: any`, reduce callbacks typed `any` |
| `routes/billing.ts` | MEDIUM | Financial computation callbacks |
| `routes/opd_reports.ts` | MEDIUM | Report aggregation |
| `artifacts/hms/src/pages/opd/[id].tsx` | MEDIUM | `aiDraftOriginalValues: any`, `favorites: any[]` |

**Priority:** pharmacy-v4 and ai_assistant routes — replace with proper interface definitions.

## Dead Code

| Item | Location | Risk |
|------|----------|------|
| Unused lucide imports (`HelpCircle`, `Settings`, `ArrowRight`, `Check`) | `ai-finance.tsx` | Low (bundle bloat) |
| `selectedDepartment` state set but never consumed | `ai-finance.tsx` line ~42 | Medium (dead UI logic) |
| Hardcoded mock reconciliation entry (`matchedPharmacySaleId: 9011`, "Ramesh Kumar") | `ai-finance.tsx` line ~676 | Medium (demo data in production) |
| `TabsContent` missing while `Tabs` is imported | `dashboard.tsx` | Low |

## Large Files Needing Modularization

| File | Lines | Suggestion |
|------|-------|-----------|
| `artifacts/hms/src/pages/opd/[id].tsx` | 1,117 | Split into: `<ClinicalNotesSection>`, `<PrescriptionSection>`, `<AiDraftPanel>`, `<IpdConversionDialog>` |
| `artifacts/hms/src/pages/accounting/ai-finance.tsx` | 742 | Split OCR, reconciliation, and dashboard into separate sub-components |
| `artifacts/hms/src/pages/billing-desk/index.tsx` | 539 | Extract billing item form and summary panel |

## React Anti-Patterns Fixed

| Issue | File | Fix Applied |
|-------|------|-------------|
| `useState` called after conditional return (Rules of Hooks violation) | `opd/[id].tsx` line 309 | Moved `useState` for `favorites` to before early returns |

## React Anti-Patterns Remaining

| Issue | File | Risk |
|-------|------|------|
| Index-based `key` props in dynamically-modified lists | `opd/[id].tsx` rx list | Medium |
| `useCallback` for `saveClinical` may trigger spurious autosaves when AI draft loads | `opd/[id].tsx` | Medium |
| No global error boundary | Fixed: `main.tsx` now wraps App in `ErrorBoundary` | — |

## Build System

| Issue | Status |
|-------|--------|
| `vite.config.ts` threw on missing PORT/BASE_PATH during `vite build` | **FIXED** — defaults to port 3000, base "/" |
| `runtimeErrorOverlay()` unconditionally included in production build | **FIXED** — gated on `isDev` |
| Replit cartographer and dev-banner plugins | OK — were already gated on `REPL_ID` |
| objectStorage.ts Replit sidecar hardcoded | NOT FIXED — storage.ts already has `STORAGE_DRIVER=local` bypass; add `STORAGE_DRIVER=local` to .env |

## Files Reviewed
`tsconfig.base.json`, `artifacts/hms/vite.config.ts`, `artifacts/api-server/build.mjs`, all route files, `lib/api-client-react/src/custom-fetch.ts`, `lib/api-zod/src/index.ts`, `artifacts/hms/src/lib/utils.ts`, `artifacts/api-server/src/lib/logger.ts`.

## Files Modified
- `artifacts/hms/vite.config.ts` — build-time crash fix + runtimeErrorOverlay gate
- `artifacts/hms/src/main.tsx` — added ErrorBoundary wrapper
- `artifacts/hms/src/pages/opd/[id].tsx` — fixed React Hooks violation
