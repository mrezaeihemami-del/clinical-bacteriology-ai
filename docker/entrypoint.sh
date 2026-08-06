#!/bin/sh
set -eu

echo "Applying database migrations..."
npx prisma migrate deploy --schema prisma/schema.prisma

if [ "${SEED_DEMO_DATA:-true}" = "true" ]; then
  echo "Creating/updating local demo users..."
  NODE_ENV=development npx tsx prisma/seed.ts
fi

echo "Starting CBAI on container port ${PORT:-3000}..."
exec node apps/server/dist/index.js
