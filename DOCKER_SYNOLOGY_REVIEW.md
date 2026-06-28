# Docker & Synology Deployment Review
**Hope NeuroTrauma & MultiSpeciality Hospital ERP**
**Audit Date:** 2026-06-29

## Summary of Changes Made

| File | Change | Reason |
|------|--------|--------|
| `Dockerfile` | Builder changed from `node:22-alpine` to `node:22-slim` | pnpm-workspace.yaml excludes musl native binaries (rollup, lightningcss, @tailwindcss/oxide); Alpine (musl) build would fail |
| `Dockerfile` | Explicit `--filter` on build command | Prevents future sandbox/demo packages from being built |
| `Dockerfile` | Production stage copies only built artifacts | Smaller image; source files not needed at runtime |
| `Dockerfile` | Added `HEALTHCHECK` | Docker and Synology Container Manager can monitor liveness |
| `docker-compose.yml` | Removed `version: '3.8'` | Deprecated; modern Docker Compose ignores it |
| `docker-compose.yml` | Container names updated to `hope_hospital_db`/`hope_hospital_app` | Match blueprint specification |
| `docker-compose.yml` | Added `NODE_ENV=production` | Ensures production mode |
| `docker-compose.yml` | Added `env_file: .env` | Cleaner env management |
| `docker-compose.yml` | Added app health check | Synology monitors container health |
| `.env.example` | Expanded | All required variables documented |
| `.dockerignore` | Created | Excludes node_modules, .env, build artifacts, backup files |
| `.gitignore` | Created | Excludes .env, node_modules, dist, backups |

## Container Architecture

```
Synology NAS
└── Docker Engine (Container Manager)
    ├── hope_hospital_db  (postgres:16-alpine)
    │   └── Volume: pgdata → /var/lib/postgresql/data
    └── hope_hospital_app  (hope_hospital_app:latest)
        ├── Volume: uploads_data → /app/uploads
        ├── Volume: reports_data → /app/reports
        └── Port: 5000 → NAS:5000
```

## Build Process

```
Stage 1: node:22-slim (Debian/glibc)
  ├── pnpm install --frozen-lockfile
  └── pnpm build (hms + api-server only)

Stage 2: node:22-alpine (runtime, smaller)
  ├── Copy artifacts/api-server/dist
  ├── Copy artifacts/hms/dist (static frontend)
  ├── Copy lib/ (shared schemas)
  └── Copy node_modules
```

## Why node:22-slim for Builder

The `pnpm-workspace.yaml` contains platform overrides that exclude all musl-based native binaries (added for Replit's Debian/glibc environment):
- `rollup>@rollup/rollup-linux-x64-musl: "-"` — Vite depends on rollup; fails on Alpine
- `lightningcss>lightningcss-linux-x64-musl: "-"` — Tailwind CSS v4 native engine; fails on Alpine
- `@tailwindcss/oxide>@tailwindcss/oxide-linux-x64-musl: "-"` — Same; fails on Alpine

Using `node:22-slim` (glibc) matches the platform assumptions. The production runtime stage uses Alpine (fine — no builds happen there).

## Synology Deployment Steps

1. SSH into NAS: `ssh admin@<NAS-IP>`
2. Navigate to project: `cd /volume1/docker/hope-hospital`
3. Copy `.env.example` to `.env` and fill in credentials
4. Run: `docker compose up --build -d`
5. Run migrations: `docker exec -it hope_hospital_app pnpm --filter @workspace/db run drizzle-kit migrate`
6. Verify: `curl http://localhost:5000/api/health`

## Health Checks

| Container | Check | Interval | Retries |
|-----------|-------|----------|---------|
| `hope_hospital_db` | `pg_isready` | 10s | 5 |
| `hope_hospital_app` | `GET /api/health` (includes DB probe) | 30s | 3 |

## Volumes

| Volume | Driver | Purpose |
|--------|--------|---------|
| `pgdata` | local | PostgreSQL data files |
| `uploads_data` | local | Patient documents and uploads |
| `reports_data` | local | Generated reports |

## Remaining Risks

| Risk | Mitigation |
|------|-----------|
| Replit sidecar URL in objectStorage.ts | Set `STORAGE_DRIVER=local` in .env (already supported) |
| pnpm-workspace.yaml musl exclusions | Fixed via `node:22-slim` builder |
| ARM Synology models (220+, 420+) | All pnpm exclusions are for x64; ARM would need different overrides |
| Single-node deployment | Synology Hyper Backup + daily pg_dump cron |
