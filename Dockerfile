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
FROM nginx:1.27-alpine AS runtime

# Cloud Run injects $PORT (defaults to 8080). The nginx:alpine image
# automatically runs envsubst on /etc/nginx/templates/* before launching,
# so $PORT in nginx.conf gets substituted at container start.
ENV PORT=8080

COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=builder /app/out /usr/share/nginx/html

EXPOSE 8080
