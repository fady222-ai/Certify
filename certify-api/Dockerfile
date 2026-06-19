# Certify API — Node.js + headless Chromium for Arabic RTL PDF rendering.
FROM node:20-slim

# System Chromium + Arabic-capable fonts (puppeteer uses this binary).
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium \
      fonts-noto-core fonts-kacst fonts-hosny-amiri \
      libnss3 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 \
      libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 \
      libpango-1.0-0 libcairo2 libasound2 libatspi2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Use the system Chromium; skip puppeteer's bundled download.
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    CERTIFY_CHROME_PATH=/usr/bin/chromium \
    NODE_ENV=production

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Schema targets PostgreSQL (see prisma/schema.prisma).
RUN npx prisma generate

EXPOSE 8000

# Sync schema to the database, seed plans, then start the server.
# --accept-data-loss: this app syncs schema via `db push` on every boot; the flag
# lets destructive syncs (e.g. dropping the legacy public_token column) apply
# without an interactive prompt. Safe for this single-instance, pre-launch deploy.
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss && node prisma/seed.js && node src/server.js"]
