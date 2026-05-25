FROM node:22-alpine

WORKDIR /app

# Install deps first (layer cache)
COPY package*.json tsconfig.json ./
RUN npm ci

# Build
COPY src ./src
RUN npx tsc

# Auth state persistence is handled by Railway's managed Volume mounted at /app/auth
# (Dockerfile VOLUME instruction is not supported on Railway and would block builds)

ENV NODE_ENV=production
ENV AUTH_DIR=/app/auth
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/index.js"]
