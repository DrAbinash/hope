# Synology Container Manager Deployment Guide
**Hope NeuroTrauma & MultiSpeciality Hospital ERP**

---

## 1. Project Overview

| Item | Detail |
|------|--------|
| Frontend | React + Vite (`artifacts/hms`) |
| Backend | Express + TypeScript (`artifacts/api-server`) |
| Database | PostgreSQL 16 |
| Runtime | Node.js 22 |
| Package Manager | pnpm 10 (workspace monorepo) |

The application runs as **two Docker containers** on Synology NAS:

| Container | Image | Purpose |
|-----------|-------|---------|
| `hope_hospital_db` | `postgres:16-alpine` | PostgreSQL database |
| `hope_hospital_app` | `hope_hospital_app:latest` | Express API + static React frontend |

---

## 2. Folder Structure

```
/
├── artifacts/
│   ├── api-server/          # Backend (Express, TypeScript, esbuild)
│   └── hms/                 # Frontend (React, Vite)
├── lib/
│   ├── db/                  # Drizzle ORM schema + migrations
│   ├── api-zod/             # Shared Zod validation schemas
│   ├── api-client-react/    # React Query API client
│   └── api-spec/            # OpenAPI spec (dev/codegen only)
├── scripts/                 # Utility scripts (dev only)
├── Dockerfile
├── docker-compose.yml
├── .env.example             # Template — copy to .env and fill in secrets
├── pnpm-workspace.yaml
└── pnpm-lock.yaml
```

---

## 3. Prerequisites on Synology NAS

- **DSM 7.2+** with **Container Manager** installed
- **SSH access** enabled (Control Panel > Terminal & SNMP)
- **Docker** and **docker compose** available via Container Manager's bundled runtime
- At least **4 GB RAM** and **20 GB free disk** recommended

---

## 4. Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
nano .env   # or use any text editor
```

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_USER` | PostgreSQL username | `postgres` |
| `DB_PASSWORD` | PostgreSQL password (use a strong one) | `MyStr0ngP@ss!` |
| `DB_NAME` | Database name | `hospital_erp` |
| `DATABASE_URL` | Full connection URL (must match DB_* above) | `postgresql://postgres:pass@postgres:5432/hospital_erp` |
| `SESSION_SECRET` | Express session encryption key (32+ chars) | `random_long_string_here` |
| `APP_PORT` | Host port mapped to container port 5000 | `5000` |

### Optional Variables

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | Google OAuth Client ID (for staff Google login) |
| `GOOGLE_CLIENT_SECRET` | Google OAuth secret |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to GCP service account JSON (for GCS backup) |

> **Security rule:** Never commit `.env` to Git. The `.gitignore` excludes it.

---

## 5. First-Time Build and Deploy

### Step 1 — SSH into Synology

```bash
ssh admin@<NAS-IP>
cd /volume1/docker/hope-hospital   # or your chosen directory
```

### Step 2 — Clone or copy the project

```bash
git clone <your-repo-url> .
# OR copy files via File Station / SCP
```

### Step 3 — Create .env

```bash
cp .env.example .env
nano .env
# Fill in DB_PASSWORD and SESSION_SECRET at minimum
```

### Step 4 — Build and start

```bash
docker compose up --build -d
```

This builds the image (builder + production stages) and starts both containers.

### Step 5 — Run database migrations

```bash
docker exec -it hope_hospital_app \
  pnpm --filter @workspace/db run drizzle-kit migrate
```

> **Important:** Always use `migrate` (not `push`) in production. See Section 9.

### Step 6 — Verify

```bash
docker logs -f hope_hospital_app
curl http://localhost:5000/api/health
```

---

## 6. Synology Container Manager GUI Import

If you prefer the GUI over SSH:

1. Open **Container Manager** in DSM
2. Click **Project** > **Create**
3. Set **Project name**: `hope-hospital`
4. Under **Path**, select the folder containing `docker-compose.yml`
5. Container Manager auto-detects the `docker-compose.yml`
6. Set the `.env` file path in the project settings
7. Click **Build** then **Start**

---

## 7. Volume Mapping (Persistent Storage)

| Docker Volume | Mount Path in Container | Purpose |
|---------------|------------------------|---------|
| `pgdata` | `/var/lib/postgresql/data` | PostgreSQL data files |
| `uploads_data` | `/app/uploads` | Patient uploads, documents |
| `reports_data` | `/app/reports` | Generated report files |

Docker volumes are stored on Synology at:
`/var/packages/ContainerManager/var/docker/volumes/`

To map to a specific Synology shared folder instead, edit `docker-compose.yml`:
```yaml
volumes:
  pgdata:
    driver: local
    driver_opts:
      type: none
      o: bind
      device: /volume1/docker/hope-hospital/pgdata
```

---

## 8. Port Mapping

| Host Port | Container Port | Service |
|-----------|---------------|---------|
| `5000` (default) | `5000` | HMS web app + API |

Access the app at: `http://<NAS-IP>:5000`

Change `APP_PORT` in `.env` to use a different host port.

---

## 9. Database Migration Safety

### Safe: `drizzle-kit migrate`
```bash
docker exec -it hope_hospital_app \
  pnpm --filter @workspace/db run drizzle-kit migrate
```
Applies versioned SQL migrations from `lib/db/migrations/`. **Use this in production.**

### Unsafe: `drizzle-kit push` — DO NOT USE IN PRODUCTION
`push` compares current schema and applies diffs directly without migration files. It can drop columns or rename tables destructively.

### Migration checklist (before running):
- [ ] Take a database backup (see Section 10)
- [ ] Confirm no active clinical users on the system
- [ ] Test migration on a staging/local copy first
- [ ] Read the generated SQL diff before applying

---

## 10. Backup Strategy

### Manual backup before any deployment

```bash
# Database dump
docker exec -t hope_hospital_db \
  pg_dump -U postgres hospital_erp > backup_pre_deploy_$(date +%Y%m%d_%H%M%S).sql

# Uploads
cp -r /volume1/docker/hope-hospital/uploads/ /volume1/backups/hope-hospital/uploads_$(date +%Y%m%d)/

# Config
cp .env .env.bak
cp docker-compose.yml docker-compose.yml.bak
```

### Daily automated backup (Synology Task Scheduler)

Create a **Scheduled Task** in DSM Control Panel > Task Scheduler:

```bash
#!/bin/bash
BACKUP_DIR="/volume1/backups/hope-hospital/$(date +%Y%m%d)"
mkdir -p "$BACKUP_DIR"

# Database dump
docker exec hope_hospital_db \
  pg_dump -U postgres hospital_erp > "$BACKUP_DIR/hospital_erp.sql"

# Compress
gzip "$BACKUP_DIR/hospital_erp.sql"

# Uploads backup
rsync -av /var/packages/ContainerManager/var/docker/volumes/hope-hospital_uploads_data/_data/ \
  "$BACKUP_DIR/uploads/"

echo "Backup complete: $BACKUP_DIR"
```

### Hyper Backup (recommended)

Configure **Hyper Backup** in DSM to back up:
- `/volume1/backups/hope-hospital/` to an external drive or cloud destination
- Schedule: daily, retain 30 versions

---

## 11. Restore Procedure

### Restore database from backup

```bash
# Stop the app (not the DB)
docker compose stop app

# Restore
cat backup_20260101_120000.sql.gz | gunzip | \
  docker exec -i hope_hospital_db psql -U postgres -d hospital_erp

# Restart app
docker compose start app
```

### Full system restore

```bash
docker compose down

# Restore data volumes
# (copy backup files into the volume's _data directory)

# Restore config
cp .env.bak .env

docker compose up -d
```

---

## 12. Rollback After a Bad Deployment

```bash
# 1. Stop containers
docker compose down

# 2. Restore database (if migrations were run)
cat backup_pre_deploy_YYYYMMDD_HHMMSS.sql | \
  docker exec -i hope_hospital_db psql -U postgres -d hospital_erp

# 3. Checkout the previous code
git checkout <last-known-good-commit-hash>

# 4. Rebuild and restart
docker compose up --build -d
```

---

## 13. Reverse Proxy / LAN Access

### Direct LAN access
`http://<NAS-IP>:5000`

### Synology built-in reverse proxy (recommended for SSL)
1. DSM > **Control Panel** > **Login Portal** > **Advanced** > **Reverse Proxy**
2. Add rule:
   - Source: HTTPS, `hms.yourdomain.local`, port 443
   - Destination: HTTP, `localhost`, port `5000`
3. Assign an SSL certificate (Let's Encrypt or self-signed)

### Cloudflare Tunnel (optional — remote access without port forwarding)
```bash
cloudflared tunnel --url http://localhost:5000
```
Then set up a named tunnel and DNS record in your Cloudflare dashboard.

### Tailscale (optional — secure remote access via VPN)
Install Tailscale on the NAS and on staff devices. Access via `http://<tailscale-ip>:5000`.

---

## 14. Health Checks

The app container exposes a health endpoint. Check it with:

```bash
curl http://localhost:5000/api/health
```

Docker health check is configured in both Dockerfile and docker-compose.yml to poll every 30s. View status with:

```bash
docker inspect --format='{{.State.Health.Status}}' hope_hospital_app
```

---

## 15. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| App container exits immediately | Missing `SESSION_SECRET` in `.env` | Add to `.env` and restart |
| `DATABASE_URL` connection refused | DB not ready yet | Container depends_on health check; wait 60s |
| Frontend 404 on page refresh | `SERVE_STATIC_DIR` wrong | Confirm `SERVE_STATIC_DIR=/app/artifacts/hms/dist` |
| Build fails with `Cannot find module` | Native binary excluded for musl | Ensure Dockerfile uses `node:22-slim` for builder |
| Port 5000 already in use | Another service | Change `APP_PORT` in `.env` |
| Uploads not persisting | Volume not mounted | Check `docker inspect hope_hospital_app` for volume mounts |
| `pg_isready` fails in healthcheck | Wrong DB credentials in `.env` | Verify `DB_USER` and `DB_PASSWORD` match |

---

## 16. Updating the Application

```bash
# SSH into NAS
git pull origin main

# Pre-deployment backup
docker exec -t hope_hospital_db \
  pg_dump -U postgres hospital_erp > backup_pre_deploy_$(date +%Y%m%d_%H%M%S).sql

# Rebuild and redeploy
docker compose down
docker compose up --build -d

# Run migrations only if schema changed
docker exec -it hope_hospital_app \
  pnpm --filter @workspace/db run drizzle-kit migrate

# Verify
docker logs -f hope_hospital_app
```
