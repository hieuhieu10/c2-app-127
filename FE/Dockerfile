FROM node:20-alpine AS deps

WORKDIR /app

COPY FE/package.json FE/package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder

WORKDIR /app

ARG NEXT_PUBLIC_BE_WEB_URL
ARG NEXT_PUBLIC_AI_URL
ARG NEXT_PUBLIC_API_DEBUG=false

ENV NEXT_PUBLIC_BE_WEB_URL=$NEXT_PUBLIC_BE_WEB_URL
ENV NEXT_PUBLIC_AI_URL=$NEXT_PUBLIC_AI_URL
ENV NEXT_PUBLIC_API_DEBUG=$NEXT_PUBLIC_API_DEBUG
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=deps /app/node_modules ./node_modules
COPY FE/ ./
RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY FE/package.json FE/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["npm", "run", "start"]
