# syntax=docker/dockerfile:1

##############################
# Base: Node + pnpm (Corepack)
##############################
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    NEXT_TELEMETRY_DISABLED=1
RUN corepack enable
WORKDIR /app

##############################
# Deps: install node_modules (with native better-sqlite3 build)
##############################
FROM base AS deps
# Build toolchain for better-sqlite3's native addon (used if no prebuilt binary
# matches the platform). Removed automatically — this layer isn't in the runner.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

##############################
# Builder: compile the Next.js standalone server
##############################
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Produces .next/standalone (self-contained server) + .next/static
RUN pnpm build

##############################
# Runner: minimal runtime image
##############################
FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    DATABASE_PATH=/app/data/snippets.db
WORKDIR /app

# Copy the standalone server, static assets, and public files. The `node` user
# (uid 1000, ships with the base image) owns the data dir so a fresh named
# volume inherits writable ownership on first mount.
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
RUN mkdir -p /app/data && chown -R node:node /app/data

USER node
EXPOSE 3000
VOLUME ["/app/data"]

# Lightweight healthcheck. Uses the always-public auth session endpoint, which
# returns 200 without a login (the snippets API now requires auth and redirects).
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/auth/session').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
