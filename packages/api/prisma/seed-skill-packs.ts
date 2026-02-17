import { PrismaClient } from "../src/generated/prisma/index.js";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface SkillPackManifest {
  name: string;
  version: string;
  description?: string;
  agents?: Array<{
    name: string;
    path: string;
    description?: string;
  }>;
  skills?: Array<{
    name: string;
    path: string;
    description?: string;
  }>;
  instructions?: Array<{
    name: string;
    path: string;
    description?: string;
  }>;
  dependencies?: Record<string, string>;
}

async function loadManifest(filename: string): Promise<SkillPackManifest> {
  const manifestPath = path.join(__dirname, "seed-data", "skill-packs", filename);
  const content = await fs.readFile(manifestPath, "utf-8");
  return JSON.parse(content) as SkillPackManifest;
}

async function seedSkillPack(
  manifestFile: string,
  displayName: string,
  isOfficial: boolean = true
): Promise<void> {
  const manifest = await loadManifest(manifestFile);

  console.log(`Seeding skill pack: ${manifest.name}`);

  // Check if the pack already exists
  let skillPack = await prisma.skillPack.findUnique({
    where: { name: manifest.name },
  });

  if (skillPack) {
    console.log(`  ✓ Skill pack ${manifest.name} already exists`);
  } else {
    // Create the skill pack
    skillPack = await prisma.skillPack.create({
      data: {
        name: manifest.name,
        displayName,
        description: manifest.description ?? null,
        authorName: "SpecTree Team",
        authorUrl: "https://github.com/spectree",
        homepageUrl: "https://github.com/spectree/spectree",
        isOfficial,
        latestVersion: manifest.version,
      },
    });
    console.log(`  ✓ Created skill pack: ${skillPack.name}`);
  }

  // Check if this version already exists
  const existingVersion = await prisma.skillPackVersion.findFirst({
    where: {
      skillPackId: skillPack.id,
      version: manifest.version,
    },
  });

  if (existingVersion) {
    console.log(`  ✓ Version ${manifest.version} already exists`);
  } else {
    // Create the version
    await prisma.skillPackVersion.create({
      data: {
        skillPackId: skillPack.id,
        version: manifest.version,
        manifest: JSON.stringify(manifest),
        releaseNotes: `Initial release of ${displayName}`,
        isPrerelease: false,
      },
    });
    console.log(`  ✓ Published version ${manifest.version}`);
  }
}

async function seedAllSkillPacks(): Promise<void> {
  console.log("Seeding SpecTree official skill packs...\n");

  try {
    await seedSkillPack("planning.json", "Planning & Scoping");
    await seedSkillPack("orchestration.json", "Orchestration & Execution");
    await seedSkillPack("review.json", "Code Review & QA");
    await seedSkillPack("full.json", "Complete Suite");

    console.log("\n✓ All skill packs seeded successfully!");
  } catch (error) {
    console.error("Error seeding skill packs:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedAllSkillPacks().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

export { seedAllSkillPacks };
