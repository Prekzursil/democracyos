import { defineConfig, env } from 'prisma/config';

// Prisma 7 does not auto-load .env; load it via Node's built-in loader so the
// CLI keeps working without a dotenv dependency. Missing file is fine — the
// variable may already be set in the environment (e.g. CI).
try {
  process.loadEnvFile('.env');
} catch {
  // .env not present — rely on the ambient environment
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
    // Only needed by `prisma migrate diff --from/to-migrations` (drift checks):
    // the CLI replays the migrations into this scratch database. Optional so
    // every other command keeps working without the variable.
    ...(process.env.SHADOW_DATABASE_URL ? { shadowDatabaseUrl: env('SHADOW_DATABASE_URL') } : {}),
  },
});
