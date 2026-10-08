import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

async function main() {
  const email = (process.env.SEED_EMAIL ?? "boss@btb.my").toLowerCase();
  const password = process.env.SEED_PASSWORD ?? "btb12345";

  await prisma.user.upsert({
    where: { email },
    update: { passwordHash: await bcrypt.hash(password, 10) },
    create: {
      email,
      name: "BTB Builders",
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  await prisma.project.deleteMany();

  await prisma.project.create({
    data: {
      name: "Taman Desa Terrace Renovation",
      clientName: "En. Hafiz",
      contractValue: "280000.00",
      startDate: day("2026-08-03"),
      costs: {
        create: [
          { date: day("2026-08-10"), category: "MATERIAL", description: "Cement 200 bags", amount: "5600.00", vendor: "Kedai Bina Maju" },
          { date: day("2026-08-14"), category: "LABOR", description: "Tiling crew, week 1", amount: "4200.00" },
          { date: day("2026-08-21"), category: "SUBCON", description: "Electrical rewiring", amount: "18500.00", vendor: "Ah Seng Electrical", reference: "INV-0231" },
        ],
      },
      payments: {
        create: [{ date: day("2026-08-05"), amount: "56000.00", reference: "Deposit 20%" }],
      },
      changeOrders: {
        create: [
          { date: day("2026-08-25"), description: "Add extra kitchen cabinet", amount: "6500.00", status: "APPROVED", approvedAt: day("2026-08-26") },
        ],
      },
    },
  });

  await prisma.project.create({
    data: {
      name: "Bangsar Shop Lot Fit-Out",
      clientName: "Madam Lim",
      contractValue: "120000.00",
      startDate: day("2026-09-01"),
      costs: {
        create: [
          { date: day("2026-09-05"), category: "EQUIPMENT", description: "Scaffolding rental", amount: "2400.00", vendor: "Sewa Perancah" },
          { date: day("2026-09-12"), category: "MATERIAL", description: "Plasterboard and studs", amount: "7350.50" },
        ],
      },
    },
  });

  console.log(`Seeded user ${email} and 2 projects`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
