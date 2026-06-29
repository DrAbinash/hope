#!/bin/sh
set -e

echo "[entrypoint] Running database schema push..."
# Resolve drizzle-kit from node_modules — works for both pnpm flat and hoisted layouts
DRIZZLE_KIT=$(node -e "require.resolve('drizzle-kit/bin')" 2>/dev/null) \
  || DRIZZLE_KIT=$(find /app/node_modules -name "drizzle-kit" -type f -path "*/bin/*" 2>/dev/null | head -1)

if [ -n "$DRIZZLE_KIT" ]; then
  node "$DRIZZLE_KIT" push --force --config /app/lib/db/drizzle.config.ts || \
    echo "[entrypoint] drizzle-kit push failed — starting server anyway (DB may already be current)"
else
  echo "[entrypoint] drizzle-kit not found — skipping schema push"
fi

echo "[entrypoint] Starting application server..."
exec node --enable-source-maps /app/artifacts/api-server/dist/index.mjs
