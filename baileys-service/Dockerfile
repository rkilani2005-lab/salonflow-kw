FROM node:22-alpine

WORKDIR /app

# Install deps first (layer cache)
COPY package*.json tsconfig.json ./
RUN npm ci

# Build
COPY src ./src
RUN npx tsc

# Auth state volume
VOLUME ["/app/auth"]

ENV NODE_ENV=production
ENV AUTH_DIR=/app/auth
ENV PORT=3001
EXPOSE 3001

CMD ["node", "dist/index.js"]
