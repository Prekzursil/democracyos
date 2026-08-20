// Fixture users — mirrors docs/develop/fixtures.md ("Users") exactly. That file
// is the shared contract (plan WU-M0-6): the seed script (WU-M3a-10) must produce
// this corpus and these specs must assert against it; neither side may drift.
// Synthetic values only — never personal data (§4.1).
//
// TWO ORTHOGONAL AXES. Conflating them produced a false citation in the first
// version of this file (M1 harness review, finding N1) — a `registered` "role"
// that exists nowhere in the legacy source.
//
//  1. FORUM ROLE — authorization inside a forum. Taken verbatim from
//     legacy/lib/models/forum/roles.js:7-13 = admin, collaborator, author,
//     participant; `owner` is not in that array because it lives on
//     `forum.owner` (see the comment on line 8); `moderator` is appended only
//     when `config.moderatorEnabled` (line 15) and is therefore omitted here
//     until the new app decides whether that flag survives.
//
//  2. VERIFICATION STAGE — how strongly the person is identified. This is NEW
//     (decision G-10, grill ledger): stage 1 e-mail + Turnstile may read and
//     comment; stage 2 phone is required to VOTE; stage 3 Romanian eID is
//     reserved for high-stakes consultations. It has no legacy counterpart —
//     legacy gated voting on forum privileges alone.
//
// `visitor` is the unauthenticated state: no account, no role, no stage. It is
// represented by the absence of a session, not by an entry here.

/** Forum roles, verbatim from legacy/lib/models/forum/roles.js:7-13 + forum.owner. */
export type FixtureRole = 'owner' | 'admin' | 'collaborator' | 'author' | 'participant';

/** Verification ladder stages (decision G-10). Voting requires stage2 or above. */
export type FixtureVerificationStage = 'stage1-email' | 'stage2-phone' | 'stage3-eid';

export interface FixtureUser {
  readonly handle: string;
  readonly role: FixtureRole;
  readonly verification: FixtureVerificationStage;
  readonly email: string;
  readonly password: string;
  /** All fixture accounts are e-mail-validated; J1 creates its own
   *  pre-validation account inside the journey (fixtures stay immutable). */
  readonly emailValidated: true;
}

// docs/develop/fixtures.md: passwords are per-seed random and never reused
// outside fixtures. Until the seed exists (WU-M3a-10) there is nothing to read
// them from, so activation-time runs inject them via environment
// (E2E_PASSWORD_<HANDLE>); the defaults below are synthetic placeholders that
// only keep the harness runnable today. They are not credentials to anything.
function fixturePassword(handle: string): string {
  const envKey = `E2E_PASSWORD_${handle.toUpperCase().replaceAll('-', '_')}`;
  return process.env[envKey] ?? `${handle}-synthetic-fixture-password`;
}

export const fixtureUsers = {
  /** Ordinary participant at stage 1: may read and comment, may NOT vote (G-10).
   *  This is the negative case every voting journey needs. */
  participant: {
    handle: 'ana-participant',
    role: 'participant',
    verification: 'stage1-email',
    email: 'ana@example.test',
    password: fixturePassword('ana-participant'),
    emailValidated: true,
  },
  /** Participant escalated to stage 2 (phone): the canonical eligible VOTER.
   *  Voting journeys (J5-J7) use this account for their happy paths. */
  voter: {
    handle: 'elena-voter',
    role: 'participant',
    verification: 'stage2-phone',
    email: 'elena@example.test',
    password: fixturePassword('elena-voter'),
    emailValidated: true,
  },
  /** legacy roles.js `author` — authored content, used by the comment journey. */
  author: {
    handle: 'flavia-author',
    role: 'author',
    verification: 'stage2-phone',
    email: 'flavia@example.test',
    password: fixturePassword('flavia-author'),
    emailValidated: true,
  },
  /** Elevated but not admin — the boundary case that catches over-broad checks. */
  collaborator: {
    handle: 'bogdan-collaborator',
    role: 'collaborator',
    verification: 'stage2-phone',
    email: 'bogdan@example.test',
    password: fixturePassword('bogdan-collaborator'),
    emailValidated: true,
  },
  admin: {
    handle: 'carmen-admin',
    role: 'admin',
    verification: 'stage2-phone',
    email: 'carmen@example.test',
    password: fixturePassword('carmen-admin'),
    emailValidated: true,
  },
  /** forum.owner — the only role that may DELETE the forum. Ownership transfer does not
   *  exist in legacy for any role (J3; corrected 20.08.2026 per WU-M1-14). */
  owner: {
    handle: 'dan-owner',
    role: 'owner',
    verification: 'stage3-eid',
    email: 'dan@example.test',
    password: fixturePassword('dan-owner'),
    emailValidated: true,
  },
} as const satisfies Record<string, FixtureUser>;

export type FixtureUsers = typeof fixtureUsers;

/** Every forum role is represented by exactly one canonical account, so a
 *  role-permission journey (J3) can iterate roles without hand-picking users. */
export const fixtureUserByRole: Record<FixtureRole, FixtureUser> = {
  owner: fixtureUsers.owner,
  admin: fixtureUsers.admin,
  collaborator: fixtureUsers.collaborator,
  author: fixtureUsers.author,
  participant: fixtureUsers.participant,
};
