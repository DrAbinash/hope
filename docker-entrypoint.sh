#!/bin/sh
set -e

echo "[entrypoint] Running database schema push..."
# Push schema to DB (creates/alters tables to match Drizzle schema)
# --force skips the interactive confirmation prompt in non-TTY environments
node /app/node_modules/.pnpm/node_modules/.bin/drizzle-kit push --force --config /app/lib/db/drizzle.config.ts || {
  echo "[entrypoint] drizzle-kit push failed — starting server anyway (DB may already be current)"
}

echo "[entrypoint] Starting application server..."
exec node --enable-source-maps /app/artifacts/api-server/dist/index.mjs
