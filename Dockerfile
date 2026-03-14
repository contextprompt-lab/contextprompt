FROM node:20-slim

WORKDIR /app

# Install build dependencies for better-sqlite3
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .
RUN npm run build

# Create data directory for SQLite
RUN mkdir -p /data

ENV NODE_ENV=production
ENV CONTEXTPROMPT_DB_PATH=/data/contextprompt.db
ENV PORT=3847

EXPOSE 3847

CMD ["node", "dist/bin/contextprompt.js", "dashboard", "--port", "3847"]
