/**
 * Adds another office/site login (not a subcontractor), e.g. the person who countersigns site diaries.
 *   npm run staff:add -- someone@btb.my "Their Name" "a-password-of-8+-chars"
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    /* file not present */
  }
}

async function main() {
  const [email, name, password] = process.argv.slice(2);
  if (!email || !name || !password || password.length < 8) {
    console.error('Usage: npm run staff:add -- email "Name" "password (8+ characters)"');
    process.exit(1);
  }
  const prisma = new PrismaClient();
  await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: { name, passwordHash: await bcrypt.hash(password, 10) },
    create: { email: email.toLowerCase(), name, passwordHash: await bcrypt.hash(password, 10) },
  });
  console.log(`ok  ${email} can now sign in`);
  await prisma.$disconnect();
}
void main();
