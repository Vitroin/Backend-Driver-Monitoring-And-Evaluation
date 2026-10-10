# ---------- Stage 1: install all dependencies + build ----------
FROM oven/bun:1-alpine AS builder
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

COPY . .
RUN bun run build

# ---------- Stage 2: install production dependencies only ----------
FROM oven/bun:1-alpine AS deps
WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# ---------- Stage 3: production runtime ----------
FROM node:24-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# don't run as root
USER node

EXPOSE 3000
CMD ["node", "dist/main.js"]