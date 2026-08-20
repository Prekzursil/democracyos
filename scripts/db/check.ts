/**
 * Database reachability check (plan WU-M0-5). Run with: npx tsx scripts/db/check.ts
 * Asserts connectivity via DATABASE_URL, prints server_version, fails loudly below
 * PostgreSQL 16, and reports which dev path (plan §4.1 A/B) appears to be in use.
 * Enters the coverage ratchet at M3a (scripts/db/**).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../packages/server/src/generated/prisma/client.js';

function loadEnvFallback(): void {
  if (process.env.DATABASE_URL) return;
  for (const candidate of ['.env.local', 'packages/server/.env']) {
    try {
      process.loadEnvFile(candidate);
      if (process.env.DATABASE_URL) return;
    } catch {
      // candidate file missing — try the next one
    }
  }
}

async function main(): Promise<void> {
  loadEnvFallback();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set (checked env, .env.local, packages/server/.env)');
  }
  const host = new URL(url).host;
  const adapter = new PrismaPg({ connectionString: url });
  const prisma = new PrismaClient({ adapter });
  try {
    const rows = await prisma.$queryRaw<
      Array<{ version: string }>
    >`SELECT current_setting('server_version') AS version`;
    const version = rows[0]?.version;
    if (!version) {
      throw new Error('connected, but could not read server_version');
    }
    const major = Number.parseInt(version, 10);
    if (Number.isNaN(major) || major < 16) {
      throw new Error(`PostgreSQL ${version} is below the required major version 16`);
    }
    const pathHint =
      host === '127.0.0.1:5432' || host === 'localhost:5432'
        ? 'A (local — docker-compose.dev.yml or a native install on the default port)'
        : 'B (native/hosted)';
    console.log(`OK: PostgreSQL ${version} reachable at ${host} — dev path ${pathHint}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(`DB CHECK FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
