/**
 * Generate an API token for MCP server
 * Run with: npx tsx scripts/generate-api-token.ts
 */
import crypto from "crypto";
import { prisma } from "../src/lib/db.js";

async function main() {
  // Find the first user (you)
  const user = await prisma.user.findFirst();
  if (!user) {
    console.error("No user found in database");
    process.exit(1);
  }

  // Generate token
  const prefix = "st_";
  const randomPart = crypto.randomBytes(32).toString("base64url");
  const plainTextToken = `${prefix}${randomPart}`;
  const tokenHash = crypto.createHash("sha256").update(plainTextToken).digest("hex");

  // Create token in database
  const apiToken = await prisma.apiToken.create({
    data: {
      name: "MCP Server Token",
      tokenHash,
      userId: user.id,
      scopes: null,
      expiresAt: null,
    },
  });

  console.log("\n===========================================");
  console.log("API Token created successfully!");
  console.log("===========================================\n");
  console.log("Token ID:", apiToken.id);
  console.log("User:", user.email);
  console.log("\n⚠️  SAVE THIS TOKEN - IT WILL NOT BE SHOWN AGAIN!\n");
  console.log("API_TOKEN=" + plainTextToken);
  console.log("\n===========================================\n");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
