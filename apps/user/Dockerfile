# ---- Stage 1: Build ----
FROM node:22.16.0-alpine AS builder
# Setup pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
# Copy config
COPY package.json pnpm-lock.yaml ./
# Install dependencies
RUN pnpm install
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
# Install dependency production
RUN pnpm install --prod --frozen-lockfile
# Copy built code
COPY --from=builder /app/dist ./dist
# Expose port (ví dụ Express chạy ở 4000)
EXPOSE 4000 50051
# Run app
CMD ["node", "dist/index.js"]
