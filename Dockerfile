FROM node:22-alpine AS builder

# Install pnpm
RUN npm install -g pnpm@10

WORKDIR /app

# Copy root configurations
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY tsconfig.json tsconfig.base.json ./

# Copy directories
COPY artifacts ./artifacts
COPY lib ./lib
COPY scripts ./scripts

# Install dependencies (ignoring scripts if necessary, but we might need them)
RUN pnpm install --frozen-lockfile

# Build the project (frontend and backend)
RUN pnpm -r --if-present run build

# Prune dev dependencies
RUN pnpm store prune

# Production image
FROM node:22-alpine

RUN npm install -g pnpm@10

WORKDIR /app

# We only need the built artifacts and production dependencies
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/artifacts ./artifacts
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/scripts ./scripts

# Expose the API port
# Create uploads and reports directories and set ownership to node
RUN mkdir -p /app/uploads /app/reports && chown -R node:node /app

USER node

EXPOSE 5000

# Set production environment and static dir for the backend
ENV NODE_ENV=production
ENV PORT=5000
ENV HOST=0.0.0.0
ENV SERVE_STATIC_DIR=/app/artifacts/hms/dist

# Start the API server
CMD ["pnpm", "--filter", "@workspace/api-server", "run", "start"]
