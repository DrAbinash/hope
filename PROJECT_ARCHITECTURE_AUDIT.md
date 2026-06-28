# Project Architecture Audit
**Hope NeuroTrauma & MultiSpeciality Hospital ERP**
**Audit Date:** 2026-06-29

## Executive Summary
A 296-file TypeScript monorepo (pnpm workspaces) with React/Vite frontend, Express backend, PostgreSQL via Drizzle ORM, and 37 database schema files. Architecture is sound; key risks are in deployment portability (Replit artifacts), security configuration, and missing database indexes.

## Folder Structure

```
hope/
├── artifacts/
│   ├── api-server/          # Express backend (69 source files, 59 route handlers)
│   └── hms/                 # React/Vite frontend (186 source files, 106 pages)
├── lib/
│   ├── api-client-react/    # Generated React Query client
│   ├── api-spec/            # OpenAPI spec + Orval codegen
│   ├── api-zod/             # Generated Zod validators
│   └── db/                  # Drizzle ORM schemas (37 tables)
├── scripts/                 # Utility scripts (dev only)
├── Dockerfile               # Multi-stage: node:22-slim builder + node:22-alpine runtime
├── docker-compose.yml       # Synology Container Manager compatible
└── pnpm-workspace.yaml      # Monorepo config with platform exclusions
```

## Package Analysis

| Package | Type | Production Required | Notes |
|---------|------|---------------------|-------|
| `@workspace/hms` | Frontend | YES | React + Vite + Tailwind CSS v4 |
| `@workspace/api-server` | Backend | YES | Express + pino + bcryptjs |
| `@workspace/db` | Shared lib | YES (bundled into api-server) | Drizzle ORM schemas |
| `@workspace/api-zod` | Shared lib | YES (bundled into api-server) | Generated Zod schemas |
| `@workspace/api-client-react` | Shared lib | YES (bundled into hms) | React Query generated client |
| `@workspace/api-spec` | Dev only | NO | OpenAPI + Orval codegen tool |
| `@workspace/scripts` | Dev only | NO | Utility scripts |

No `mockup-sandbox` package exists in this repository.

## Architecture Strengths
- Clean monorepo separation: API contract (OpenAPI spec) → generated Zod validators → generated React Query client
- All route handlers use pino logger — no console.log in backend
- Database schemas use numeric precision for all financial columns (no float)
- Session-based auth with PostgreSQL session store (connect-pg-simple)
- Fine-grained RBAC at both API and frontend route level

## Architecture Risks

| Risk | Severity | Location |
|------|----------|----------|
| Replit-specific sidecar hardcoded in objectStorage.ts | HIGH | `api-server/src/lib/objectStorage.ts` |
| Replit platform overrides in pnpm-workspace.yaml block Alpine musl builds | HIGH | `pnpm-workspace.yaml` (builder now fixed to `node:22-slim`) |
| All 5 pharmacy route versions (v1–v5) mounted simultaneously | MEDIUM | `routes/index.ts` |
| No drizzle migrations — push-only schema management | HIGH | `lib/db/` (no migrations/ folder) |
| No secondary DB indexes on any clinical or financial table | HIGH | All schema files |
| 12+ date columns stored as `text` instead of `date`/`timestamptz` | MEDIUM | `lib/db/src/schema/` |
| All timestamps are timezone-naive (timestamp not timestamptz) | MEDIUM | All schema files |

## Files Reviewed
All 296 source files catalogued. Key files: `app.ts`, `index.ts`, `routes/auth.ts`, `routes/index.ts`, `lib/session.ts`, `lib/objectStorage.ts`, all 37 schema files, `vite.config.ts`, `package.json`, `pnpm-workspace.yaml`, `Dockerfile`, `docker-compose.yml`.

## Files Modified (This Audit)
- `artifacts/api-server/src/routes/auth.ts` — re-enabled PIN verification
- `artifacts/api-server/src/app.ts` — restricted CORS to configured origins
- `artifacts/api-server/src/lib/session.ts` — fail-fast on missing SESSION_SECRET
- `artifacts/api-server/src/routes/health.ts` — added DB connectivity check
- `artifacts/hms/vite.config.ts` — removed build-time PORT/BASE_PATH crash; gated Replit plugins
- `artifacts/hms/src/lib/permissions-catalog.ts` — added 7 missing pharmacy route entries
- `artifacts/hms/src/main.tsx` — wrapped app in ErrorBoundary
- `artifacts/hms/src/pages/opd/[id].tsx` — fixed React Hooks violation
- `Dockerfile` — builder stage changed to node:22-slim; explicit --filter for production packages
- `docker-compose.yml` — updated container names, added NODE_ENV, health checks, env_file
- `.env.example` — expanded with all required variables

## Recommendations

### Immediate
1. Set up Drizzle Kit migrations: run `drizzle-kit generate` to create baseline migration files from current schema. Never use `drizzle-kit push` in production again.
2. Add database indexes (see DATABASE_REVIEW.md).
3. Remove or namespace-separate pharmacy v2–v5 routes to prevent overlap.

### Short Term
4. Replace `objectStorage.ts` Replit sidecar with standard GCS service account credentials when cloud backup is needed.
5. Convert all `text` date columns to proper `date` type via migration.
6. Convert all `timestamp` to `timestamptz`.
