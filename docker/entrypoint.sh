#!/bin/sh
# Starts the app: fixes folder ownership, applies database migrations, creates the first login if asked, runs the app.
set -e

if [ "$(id -u)" = "0" ]; then
  mkdir -p /app/data /app/uploads
  # Only walk the (possibly large) uploads folder when its owner is wrong.
  for dir in /app/data /app/uploads; do
    [ "$(stat -c %u "$dir")" = "$(id -u node)" ] || chown -R node:node "$dir"
  done
  exec su-exec node "$0" "$@"
fi

echo "Applying database migrations..."
npx prisma migrate deploy
node docker/bootstrap-admin.mjs
exec "$@"
