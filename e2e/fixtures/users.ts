// Fixture users — mirrors docs/develop/fixtures.md ("Users — one per role")
// exactly. That file is the shared contract (plan WU-M0-6): the seed script
// (WU-M3a-10) must produce this corpus and these specs must assert against it;
// neither side may drift. Synthetic values only — never personal data (§4.1).

// Roles follow legacy/lib/models/forum/roles.js; `visitor` is the
// unauthenticated state and has no account (represented by absence here).
export type FixtureRole = 'registered' | 'collaborator' | 'admin' | 'owner';

export interface FixtureUser {
  readonly handle: string;
  readonly role: FixtureRole;
  readonly email: string;
  readonly password: string;
  /** All fixture accounts are e-mail-validated; J1 creates its own
   *  pre-validation account inside the journey (fixtures stay immutable). */
  readonly emailValidated: true;
}

// docs/develop/fixtures.md: passwords are per-seed random and never reused
// outside fixtures. Until the seed exists (WU-M3a-10) there is nothing to
// read them from, so activation-time runs inject them via environment
// (E2E_PASSWORD_<HANDLE>); the defaults below are synthetic placeholders that
// only keep the harness runnable today. They are not credentials to anything.
function fixturePassword(handle: string): string {
  const envKey = `E2E_PASSWORD_${handle.toUpperCase().replaceAll('-', '_')}`;
  return process.env[envKey] ?? `${handle}-synthetic-fixture-password`;
}

export const fixtureUsers = {
  registered: {
    handle: 'ana-registered',
    role: 'registered',
    email: 'ana@example.test',
    password: fixturePassword('ana-registered'),
    emailValidated: true,
  },
  collaborator: {
    handle: 'bogdan-collaborator',
    role: 'collaborator',
    email: 'bogdan@example.test',
    password: fixturePassword('bogdan-collaborator'),
    emailValidated: true,
  },
  admin: {
    handle: 'carmen-admin',
    role: 'admin',
    email: 'carmen@example.test',
    password: fixturePassword('carmen-admin'),
    emailValidated: true,
  },
  owner: {
    handle: 'dan-owner',
    role: 'owner',
    email: 'dan@example.test',
    password: fixturePassword('dan-owner'),
    emailValidated: true,
  },
} as const satisfies Record<FixtureRole, FixtureUser>;

export type FixtureUsers = typeof fixtureUsers;
