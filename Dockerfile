# syntax=docker/dockerfile:1.7

# ─── Build stage ──────────────────────────────────────────────────────
# Node image builds the Next.js static export → /app/out
FROM node:22-alpine AS builder
WORKDIR /app

# Install deps in their own layer for better caching
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Build the static export
COPY . .
RUN npm run build

# ─── Runtime stage ────────────────────────────────────────────────────
# Tiny nginx image serves the static files. No Node at runtime.
# Using the unprivileged variant so the container runs as UID 101
# instead of root — required by the project's "no root containers" policy.
# The unprivileged image listens on 8080 by default (matches Cloud Run).
FROM nginxinc/nginx-unprivileged:1.31-alpine AS runtime

# Cloud Run injects $PORT (default 8080). The official nginx images
# auto-process /etc/nginx/templates/*.template with envsubst at start,
# so $PORT in nginx.conf gets substituted before nginx launches.
ENV PORT=8080

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 8080

# Local docker / docker-compose / k8s health signal. Cloud Run probes
# /healthz directly via --startup-probe / --liveness-probe in the
# deploy workflow; this HEALTHCHECK is for everything else.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- "http://localhost:${PORT}/healthz" || exit 1
