/**
 * Seed script for Agent Scores
 *
 * Initializes the 9 named crew agents with totalScore=100.
 * Idempotent — uses upsert on agentName.
 *
 * Usage: npx tsx prisma/seed-agents.ts
 */

import { PrismaClient } from "../src/generated/prisma/index.js";

const prisma = new PrismaClient();

interface AgentSeed {
  agentName: string;
  agentTitle: string;
}

const agents: AgentSeed[] = [
  { agentName: "barney", agentTitle: "The Fed" },
  { agentName: "bobby", agentTitle: "The Builder" },
  { agentName: "tommy", agentTitle: "The Consigliere" },
  { agentName: "silvio", agentTitle: "The Scribe" },
  { agentName: "sal", agentTitle: "The Keeper" },
  { agentName: "paulie", agentTitle: "The Tailor" },
  { agentName: "henry", agentTitle: "The Ghostwriter" },
  { agentName: "the-claw-father", agentTitle: "The Boss" },
  { agentName: "the-judge", agentTitle: "The Arbiter" },
];

async function seedAgents(): Promise<void> {
  console.log("Seeding agent scores...");

  for (const agent of agents) {
    await prisma.agentScore.upsert({
      where: { agentName: agent.agentName },
      update: { agentTitle: agent.agentTitle },
      create: {
        agentName: agent.agentName,
        agentTitle: agent.agentTitle,
        totalScore: 100,
      },
    });
    console.log(`  ${agent.agentName} (${agent.agentTitle})`);
  }

  console.log(`\nSeeded ${agents.length} agents successfully.`);
}

seedAgents()
  .catch((error) => {
    console.error("Failed to seed agents:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
