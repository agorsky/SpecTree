#!/bin/bash
set -e

echo '=== SpecTree Local Docker Entrypoint ==='

# Ensure data directory exists (volume mount point)
mkdir -p /app/data

# Set DATABASE_URL for prisma commands and application
export DATABASE_URL="file:/app/data/spectree.db"

# Run prisma db push (idempotent — safe on every start)
# --skip-generate: Prisma client already generated at build time
# --accept-data-loss: dev flexibility for schema changes
echo 'Pushing database schema...'
/app/node_modules/.pnpm/node_modules/.bin/prisma db push --schema=prisma/schema.prisma --accept-data-loss

# First-boot seeding via sentinel file
if [ ! -f /app/data/.seeded ]; then
  echo 'First boot detected — seeding database...'
  node dist/prisma/seed.js
  touch /app/data/.seeded
  echo 'Seeding complete.'
else
  echo 'Database already seeded — skipping.'
fi

# Start the API server with exec for proper signal propagation (SIGTERM, SIGINT)
echo 'Starting SpecTree API...'
exec node dist/src/index.js
