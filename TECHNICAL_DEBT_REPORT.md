# Technical Debt Report
**Hope NeuroTrauma & MultiSpeciality Hospital ERP**
**Audit Date:** 2026-06-29

## Debt Inventory

### Category 1: Database & Schema Debt

| Item | Severity | Effort to Fix | Notes |
|------|----------|---------------|-------|
| No drizzle migrations — push-only | CRITICAL | Medium | Generate baseline with `drizzle-kit generate` |
| 12+ date columns stored as `text` | HIGH | Medium | Requires migration with data validation |
| All timestamps timezone-naive | MEDIUM | High | Significant migration; affects all tables |
| No secondary indexes | HIGH | Low | `CREATE INDEX CONCURRENTLY` — no downtime |
| 20+ missing FK constraints | MEDIUM | Medium | Requires data consistency check first |
| Pharmacy stock dual source of truth | HIGH | Medium | Needs transactional pairing or view |
| `bank_details.is_active` wrong type | LOW | Low | `ALTER COLUMN` after backup |
| `numeric(10,2)` vs `numeric(14,2)` mismatch | MEDIUM | Low | Standardize to `numeric(12,2)` minimum |

### Category 2: Security Debt

| Item | Severity | Effort | Status |
|------|----------|--------|--------|
| PIN check disabled | CRITICAL | Low | **FIXED** |
| CORS wildcard | CRITICAL | Low | **FIXED** |
| Session secret fallback | CRITICAL | Low | **FIXED** |
| No rate limiting on AI routes | HIGH | Low | Remaining |
| No file upload size limit | HIGH | Low | Remaining |
| Schedule H writable by cashier | MEDIUM | Low | Remaining |
| NDPS register not append-only | HIGH | Medium | Remaining |
| MAR allows backdated entries | HIGH | Medium | Remaining |
| No page size cap on list endpoints | MEDIUM | Low | Remaining |

### Category 3: Code Quality Debt

| Item | Severity | Effort | Status |
|------|----------|--------|--------|
| `strictFunctionTypes` disabled | MEDIUM | Medium | Remaining |
| Pervasive `any` in pharmacy-v4.ts | HIGH | Medium | Remaining |
| `any` in ai_assistant.ts payload | HIGH | Medium | Remaining |
| `any` in accounting.ts | MEDIUM | Medium | Remaining |
| OPD page 1,117 lines | MEDIUM | High | Remaining (documented) |
| React Hooks violation in opd/[id].tsx | HIGH | Low | **FIXED** |
| No React ErrorBoundary | HIGH | Low | **FIXED** |
| 7 pharmacy routes unguarded | HIGH | Low | **FIXED** |
| vite.config.ts crashes on build | HIGH | Low | **FIXED** |
| Demo data in ai-finance.tsx | MEDIUM | Low | Remaining |
| `selectedDepartment` dead state | LOW | Low | Remaining |

### Category 4: Architecture Debt

| Item | Severity | Effort | Notes |
|------|----------|--------|-------|
| objectStorage.ts Replit-hardcoded | HIGH | Medium | Set `STORAGE_DRIVER=local` as workaround |
| pharmacy v1–v5 all mounted simultaneously | MEDIUM | High | Risk of overlapping routes |
| No request timeout middleware | MEDIUM | Low | `express-timeout-handler` or manual |
| Dashboard full table scan | HIGH | Medium | Push date filter to SQL |
| N+1 queries in reports.ts | HIGH | Medium | Rewrite as GROUP BY queries |
| Search using ILIKE leading wildcard | HIGH | Medium | Add pg_trgm + GIN index |
| No API response caching | MEDIUM | Medium | Redis or in-memory LRU cache |
| Inconsistent API response envelopes | LOW | High | Would require API versioning |

### Category 5: Deployment Debt

| Item | Severity | Effort | Status |
|------|----------|--------|--------|
| Dockerfile used Alpine for build | CRITICAL | Low | **FIXED** (node:22-slim) |
| No production-safe build filter | HIGH | Low | **FIXED** (explicit --filter) |
| Missing .dockerignore | HIGH | Low | **FIXED** |
| Missing .gitignore | HIGH | Low | **FIXED** |
| docker-compose VERSION deprecated | LOW | Low | **FIXED** |
| Health check returned no DB status | MEDIUM | Low | **FIXED** |
| runtimeErrorOverlay in prod bundle | LOW | Low | **FIXED** |

## Prioritized Roadmap

### Week 1 (Immediate)
1. ✅ Re-enable PIN authentication
2. ✅ Fix CORS, session secret
3. ✅ Fix Docker build (Alpine → slim)
4. ✅ Fix React Hooks violation
5. ✅ Add React ErrorBoundary
6. Set `STORAGE_DRIVER=local` in production `.env`
7. Run `drizzle-kit generate` to create baseline migrations

### Month 1
8. Add database indexes (CONCURRENTLY — no downtime)
9. Add `pg_trgm` for patient search
10. Fix dashboard date filtering (push to SQL)
11. Add file upload size limit (25 MB)
12. Add rate limiting to AI routes
13. Restrict Schedule H register to pharmacist/admin roles
14. Remove demo data from ai-finance.tsx

### Month 2–3
15. Fix N+1 queries in reports.ts
16. Add MAR backdating prevention
17. Add NDPS register append-only enforcement
18. Convert text date columns to proper `date` type (migration)
19. Fix pharmacy stock dual source of truth
20. Modularize OPD page (split into sub-components)

### Month 4–6
21. Convert timestamps to `timestamptz`
22. Add missing FK constraints
23. Enable `strictFunctionTypes` and fix violations
24. Replace `any` with proper types in pharmacy-v4 and ai_assistant routes
25. Evaluate pharmacy v2–v5 route overlap and consolidate
