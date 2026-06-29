# ============================================================
# Stage 1: Builder
# Uses node:22-slim (Debian/glibc) because pnpm-workspace.yaml
# excludes musl-based native binaries (rollup, tailwindcss/oxide,
# lightningcss). Alpine (musl) would break the Vite/Rollup build.
# ============================================================
FROM node:22-slim AS builder

RUN npm install -g pnpm@10

WORKDIR /app

# Copy workspace manifests first (layer cache: only re-installs deps when these change)
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./

# Copy only production source packages (exclude mockup-sandbox — not in artifacts/ anyway)
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts
COPY startup.mjs ./startup.mjs

RUN pnpm install --frozen-lockfile

# Build production packages only: hms (Vite) and api-server (esbuild)
# --if-present skips packages that have no "build" script (lib/db, scripts, etc.)
RUN pnpm -r --filter "@workspace/hms" --filter "@workspace/api-server" --if-present run build

# Bundle startup.mjs with all deps inlined — avoids pnpm symlink issues in Alpine runtime
RUN node_modules/.bin/esbuild startup.mjs \
      --bundle \
      --platform=node \
      --format=cjs \
      --outfile=startup.bundle.cjs

# ============================================================
# Stage 2: Production runtime
# Uses node:22-alpine for a smaller final image.
# No native build tools needed here — JS is already compiled.
# ============================================================
FROM node:22-alpine

RUN npm install -g pnpm@10

WORKDIR /app

COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/pnpm-lock.yaml ./

# Copy only what the runtime needs:
#   - artifacts/api-server/dist  (compiled backend)
#   - artifacts/hms/dist         (compiled frontend, served as static files)
#   - lib/                       (shared packages imported by api-server at runtime via tsx/node)
COPY --from=builder /app/artifacts/api-server ./artifacts/api-server
COPY --from=builder /app/artifacts/hms/dist/public ./artifacts/hms/dist/public
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/node_modules ./node_modules

# Startup script: bundled with all deps inlined (no external module resolution needed)
COPY --from=builder /app/startup.bundle.cjs /app/startup.bundle.cjs
COPY lib/db/migrations /app/lib/db/migrations

# Entrypoint: runs startup.mjs then starts the server
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

# Persistent storage mount points
RUN mkdir -p /app/uploads /app/reports && chown -R node:node /app

USER node

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
ENV SERVE_STATIC_DIR=/app/artifacts/hms/dist/public

# Health check — hits the /api/health endpoint (requires the route to exist; falls back gracefully)
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget -qO- http://localhost:5000/api/health || exit 1

CMD ["/app/docker-entrypoint.sh"]
