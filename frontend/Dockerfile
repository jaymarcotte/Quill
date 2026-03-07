FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

# ---- Development stage (hot reload) ----
FROM base AS development
RUN npm install
COPY . .
EXPOSE 5174
ENV PORT=5174
CMD ["npm", "run", "dev", "--", "-p", "5174"]

# ---- Builder ----
FROM base AS builder
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- Production (Nginx) ----
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
EXPOSE 3000
CMD ["node", "server.js"]
