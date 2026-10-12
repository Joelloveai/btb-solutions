# syntax=docker/dockerfile:1

# ---- build: install everything, generate the database client, build the app ----
FROM node:20-alpine AS build
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# "build" runs `prisma generate` and then `next build`.
RUN npx prisma generate && npm run build && rm -rf .next/cache

# ---- production: only what runs ----
FROM node:20-alpine
RUN apk add --no-cache openssl libc6-compat curl su-exec
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    UPLOAD_DIR=/app/uploads
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY next.config.js ./
COPY docker ./docker
RUN chmod +x docker/entrypoint.sh && mkdir -p /app/data /app/uploads && chown -R node:node /app/data /app/uploads /app/.next

# The container starts as root only long enough to make the mounted folders writable (a Synology
# creates them owned by root), then the entrypoint hands over to the unprivileged "node" user.
EXPOSE 3000
ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["npm", "start"]
