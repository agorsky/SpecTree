import { prisma } from "../lib/db.js";

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "aaron.gorsky@toro.com" },
    select: { id: true, email: true, name: true, isActive: true, passwordHash: true }
  });
  console.log("User found:", user ? JSON.stringify({...user, passwordHash: user.passwordHash ? "[HASH EXISTS]" : "[NO HASH]"}, null, 2) : "NOT FOUND");
  
  const allUsers = await prisma.user.findMany({ select: { email: true, name: true, isActive: true } });
  console.log("\nAll users:", JSON.stringify(allUsers, null, 2));
}
main().finally(() => prisma.$disconnect());
