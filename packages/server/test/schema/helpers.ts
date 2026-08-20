/**
 * Shared plumbing for the schema constraint probes (WU-M3a-2 / WU-M3a-3).
 *
 * These suites prove — against the live dev database — that every unique,
 * CHECK and trigger shipped by the M3a migrations actually BITES: each
 * constraint gets a probe that violates it (asserting the real Postgres
 * SQLSTATE + constraint name) and a probe that legitimately succeeds.
 *
 * They connect via DATABASE_URL (loaded from packages/server/.env when not
 * already in the environment, same fallback as scripts/db/check.ts). When no
 * DATABASE_URL is available — e.g. the CI quality workflow, which provisions
 * no Postgres service — the suites SKIP loudly rather than fake a pass.
 * Re-run locally with: npm test --workspace @dosrevival/server
 */
import { fileURLToPath } from 'node:url';
import pg from 'pg';

export function loadDatabaseUrl(): string | undefined {
  if (!process.env.DATABASE_URL) {
    try {
      process.loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
    } catch {
      // no .env — rely on the ambient environment (may legitimately be empty in CI)
    }
  }
  return process.env.DATABASE_URL;
}

export function newPool(url: string): pg.Pool {
  return new pg.Pool({ connectionString: url, max: 4 });
}

export interface SqlFailure {
  code: string | undefined;
  constraint: string | undefined;
  message: string;
}

/** Runs a statement that MUST fail; returns the real Postgres error fields. */
export async function expectSqlFailure(
  pool: pg.Pool,
  sql: string,
  params: unknown[] = [],
): Promise<SqlFailure> {
  try {
    await pool.query(sql, params);
  } catch (error) {
    const e = error as Error & { code?: string; constraint?: string };
    return { code: e.code, constraint: e.constraint, message: e.message };
  }
  throw new Error(`expected failure but statement succeeded: ${sql}`);
}
