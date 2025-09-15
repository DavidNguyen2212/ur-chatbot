# ---- Stage 1: Build ----
FROM node:22.16.0-alpine AS builder
# Setup pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
# Copy config
COPY package.json pnpm-lock.yaml ./
# Install dependencies (+dev)
RUN pnpm install
# Copy prisma schema & generate client
COPY prisma ./prisma
RUN npx prisma generate
# Copy source
COPY . .
# Build code TypeScript -> JavaScript
RUN pnpm run build

# ---- Stage 2: Production ----
FROM node:22.16.0-alpine
# Setup pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
# Copy essential files from builder
COPY package.json pnpm-lock.yaml ./
COPY --from=builder /app/prisma ./prisma
# Install ALL dependencies first (including @prisma/client)
RUN pnpm install --frozen-lockfile
# Generate Prisma client
RUN npx prisma generate
# Remove dev dependencies but keep Prisma client
RUN pnpm prune --prod
# Copy built dist from builder
COPY --from=builder /app/dist ./dist
# Expose port (ví dụ Express chạy ở 4000)
EXPOSE 4000 50051
# Run app
CMD ["node", "dist/index.js"]
