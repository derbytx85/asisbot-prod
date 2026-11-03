// Seed ejecutable: bun prisma/seed.ts
import { PrismaClient } from "@prisma/client";
import { seedDemoData } from "../src/lib/seed-data";

const db = new PrismaClient();

seedDemoData(db)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
