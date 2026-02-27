#!/bin/bash
set -e

echo '=== Dispatcher Local Docker Entrypoint ==='

# Ensure data directory exists (volume mount point)
mkdir -p /app/data

# Use DATABASE_URL from environment if set, otherwise default to dispatcher.db
if [ -z "$DATABASE_URL" ]; then
  export DATABASE_URL="file:/app/data/dispatcher.db"
fi

echo "Using database: $DATABASE_URL"

# Run prisma db push (idempotent — safe on every start)
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

# Start the API server
echo 'Starting Dispatcher API...'
exec node dist/src/index.js
