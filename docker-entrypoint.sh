#!/bin/sh
set -e

echo "[entrypoint] Running startup (migrate + seed)..."
node /app/startup.bundle.cjs

echo "[entrypoint] Starting application server..."
exec node --enable-source-maps /app/artifacts/api-server/dist/index.mjs
