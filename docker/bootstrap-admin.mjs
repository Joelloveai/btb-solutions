// Creates the first office login on a brand-new database, once. Does nothing if any office login exists.
// Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (8+ characters) in the .env next to docker-compose.yml.
import bcrypt from "bcryptjs";
import pkg from "@prisma/client";

const { PrismaClient } = pkg;
const prisma = new PrismaClient();
try {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const existing = await prisma.user.count({ where: { subcontractorId: null } });
  if (existing > 0) {
    // nothing to do
  } else if (!email || !password || password.length < 8) {
    console.warn("No office login exists yet. Set INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD (8+ characters) and restart.");
  } else {
    await prisma.user.create({ data: { email, name: "BTB Builders", passwordHash: await bcrypt.hash(password, 10) } });
    console.log(`Created the first login: ${email}`);
  }
} finally {
  await prisma.$disconnect();
}
