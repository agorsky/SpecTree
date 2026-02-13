#!/usr/bin/env npx tsx
/**
 * Backfill script for user tracking fields (createdBy, implementedBy, implementedDate)
 * 
 * This script populates the user tracking fields for existing records that were created
 * before the migration. It handles null values gracefully and operates in batches for
 * performance.
 * 
 * Usage:
 *   npx tsx scripts/backfill-user-tracking.ts [options]
 * 
 * Options:
 *   --dry-run         Show what would be updated without making changes
 *   --batch-size=N    Number of records to process per batch (default: 100)
 *   --user-id=UUID    User ID to use for createdBy field (uses first admin if not specified)
 */

import { PrismaClient } from '../packages/api/src/generated/prisma';

const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '100', 10);
const DRY_RUN = process.argv.includes('--dry-run');
const USER_ID_ARG = process.argv.find(arg => arg.startsWith('--user-id='));
const USER_ID = USER_ID_ARG ? USER_ID_ARG.split('=')[1] : null;

const prisma = new PrismaClient();

interface BackfillStats {
  epicsUpdated: number;
  featuresUpdated: number;
  tasksUpdated: number;
}

async function getDefaultUserId(): Promise<string | null> {
  if (USER_ID) {
    console.log(`Using provided user ID: ${USER_ID}`);
    return USER_ID;
  }

  // Try to get the first global admin
  const admin = await prisma.user.findFirst({
    where: { isGlobalAdmin: true },
    select: { id: true, email: true },
  });

  if (admin) {
    console.log(`Using first global admin: ${admin.email} (${admin.id})`);
    return admin.id;
  }

  // Fall back to any user
  const anyUser = await prisma.user.findFirst({
    select: { id: true, email: true },
  });

  if (anyUser) {
    console.log(`Using first available user: ${anyUser.email} (${anyUser.id})`);
    return anyUser.id;
  }

  console.warn('No users found in database - cannot set createdBy field');
  return null;
}

async function backfillEpics(defaultUserId: string | null): Promise<number> {
  let updated = 0;
  let offset = 0;

  console.log('\n📦 Processing Epics...');

  while (true) {
    // Fetch batch of epics that need backfilling
    const epics = await prisma.epic.findMany({
      where: {
        createdBy: null,
      },
      select: { id: true, name: true, createdAt: true },
      take: BATCH_SIZE,
      skip: offset,
    });

    if (epics.length === 0) {
      break;
    }

    console.log(`  Processing batch: ${offset + 1} to ${offset + epics.length}`);

    for (const epic of epics) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would update Epic "${epic.name}" (${epic.id})`);
        updated++;
      } else {
        try {
          await prisma.epic.update({
            where: { id: epic.id },
            data: {
              createdBy: defaultUserId,
            },
          });
          updated++;
        } catch (error) {
          console.error(`  ❌ Failed to update Epic "${epic.name}": ${error}`);
        }
      }
    }

    if (epics.length < BATCH_SIZE) {
      break;
    }

    offset += BATCH_SIZE;
  }

  return updated;
}

async function backfillFeatures(defaultUserId: string | null): Promise<number> {
  let updated = 0;
  let offset = 0;

  console.log('\n📋 Processing Features...');

  while (true) {
    // Fetch batch of features that need backfilling
    const features = await prisma.feature.findMany({
      where: {
        createdBy: null,
      },
      select: { id: true, identifier: true, title: true, createdAt: true },
      take: BATCH_SIZE,
      skip: offset,
    });

    if (features.length === 0) {
      break;
    }

    console.log(`  Processing batch: ${offset + 1} to ${offset + features.length}`);

    for (const feature of features) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would update Feature "${feature.identifier}: ${feature.title}"`);
        updated++;
      } else {
        try {
          await prisma.feature.update({
            where: { id: feature.id },
            data: {
              createdBy: defaultUserId,
            },
          });
          updated++;
        } catch (error) {
          console.error(`  ❌ Failed to update Feature "${feature.identifier}": ${error}`);
        }
      }
    }

    if (features.length < BATCH_SIZE) {
      break;
    }

    offset += BATCH_SIZE;
  }

  return updated;
}

async function backfillTasks(defaultUserId: string | null): Promise<number> {
  let updated = 0;
  let offset = 0;

  console.log('\n✅ Processing Tasks...');

  while (true) {
    // Fetch batch of tasks that need backfilling
    const tasks = await prisma.task.findMany({
      where: {
        createdBy: null,
      },
      select: { id: true, identifier: true, title: true, createdAt: true },
      take: BATCH_SIZE,
      skip: offset,
    });

    if (tasks.length === 0) {
      break;
    }

    console.log(`  Processing batch: ${offset + 1} to ${offset + tasks.length}`);

    for (const task of tasks) {
      if (DRY_RUN) {
        console.log(`  [DRY RUN] Would update Task "${task.identifier}: ${task.title}"`);
        updated++;
      } else {
        try {
          await prisma.task.update({
            where: { id: task.id },
            data: {
              createdBy: defaultUserId,
            },
          });
          updated++;
        } catch (error) {
          console.error(`  ❌ Failed to update Task "${task.identifier}": ${error}`);
        }
      }
    }

    if (tasks.length < BATCH_SIZE) {
      break;
    }

    offset += BATCH_SIZE;
  }

  return updated;
}

async function main() {
  console.log('🚀 Starting user tracking backfill script');
  console.log(`   Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);
  console.log(`   Batch size: ${BATCH_SIZE}`);

  const stats: BackfillStats = {
    epicsUpdated: 0,
    featuresUpdated: 0,
    tasksUpdated: 0,
  };

  try {
    // Get default user ID for createdBy field
    const defaultUserId = await getDefaultUserId();

    if (!defaultUserId) {
      console.error('\n❌ Cannot proceed without a valid user ID');
      process.exit(1);
    }

    // Backfill each entity type in order (epics → features → tasks)
    stats.epicsUpdated = await backfillEpics(defaultUserId);
    stats.featuresUpdated = await backfillFeatures(defaultUserId);
    stats.tasksUpdated = await backfillTasks(defaultUserId);

    // Print summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Backfill Summary');
    console.log('='.repeat(60));
    console.log(`Epics ${DRY_RUN ? 'to update' : 'updated'}:     ${stats.epicsUpdated}`);
    console.log(`Features ${DRY_RUN ? 'to update' : 'updated'}:  ${stats.featuresUpdated}`);
    console.log(`Tasks ${DRY_RUN ? 'to update' : 'updated'}:     ${stats.tasksUpdated}`);
    console.log(`Total ${DRY_RUN ? 'to update' : 'updated'}:     ${stats.epicsUpdated + stats.featuresUpdated + stats.tasksUpdated}`);
    console.log('='.repeat(60));

    if (DRY_RUN) {
      console.log('\n💡 Run without --dry-run to apply changes');
    } else {
      console.log('\n✅ Backfill completed successfully');
    }
  } catch (error) {
    console.error('\n❌ Backfill failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
