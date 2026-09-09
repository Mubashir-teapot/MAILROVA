// DATABASE_URL etc. come from .env.test, loaded by `dotenv-cli` wrapping the
// `test`/`pretest` scripts in package.json — nothing to load here.
import { prisma } from "../src/config/prisma";

// Refuses to run against anything that isn't obviously a disposable test
// database — this file TRUNCATEs every table, so pointing it at dev/prod
// data by mistake (wrong DATABASE_URL) would be a real data-loss bug, not
// just a test failure.
if (!/test/i.test(process.env.DATABASE_URL ?? "")) {
  throw new Error(
    `Refusing to run tests: DATABASE_URL doesn't look like a test database (${process.env.DATABASE_URL}). ` +
      "Copy backend/.env.test.example to .env.test and point it at a dedicated *_test database."
  );
}

export async function resetDb(): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '_prisma%'
  `;
  if (tables.length === 0) return;
  const names = tables.map((t) => `"${t.tablename}"`).join(", ");
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${names} RESTART IDENTITY CASCADE`);
}
