// App-level fixtures — mirrors docs/develop/fixtures.md ("Forum", "Topics")
// exactly. See e2e/fixtures/users.ts for the drift rule: the contract file is
// the single source of truth for both these fixtures and the seed script.
import { test as base } from '@playwright/test';
import { type FixtureUsers, fixtureUsers } from './users.js';

/** The single multi-forum-hub tenant used by every journey. */
export const fixtureForum = {
  slug: 'agora-fixture',
  name: 'Forumul de test',
  visibility: 'public',
} as const;

// Voting methods per legacy/lib/models/topic.js:73.
export type VotingMethod = 'vote' | 'poll' | 'cause' | 'slider' | 'hierarchy';

export interface FixtureTopic {
  readonly slug: string;
  readonly method: VotingMethod;
  readonly state: 'open' | 'closed';
  /** Only t-closed-outcome carries the mandatory outcome declaration (N11). */
  readonly outcomePublished: boolean;
}

export const fixtureTopics = {
  vote: { slug: 't-vote', method: 'vote', state: 'open', outcomePublished: false },
  poll: { slug: 't-poll', method: 'poll', state: 'open', outcomePublished: false },
  cause: { slug: 't-cause', method: 'cause', state: 'open', outcomePublished: false },
  slider: { slug: 't-slider', method: 'slider', state: 'open', outcomePublished: false },
  hierarchy: { slug: 't-hierarchy', method: 'hierarchy', state: 'open', outcomePublished: false },
  closedOutcome: {
    slug: 't-closed-outcome',
    method: 'vote',
    state: 'closed',
    outcomePublished: true,
  },
} as const satisfies Record<string, FixtureTopic>;

export interface AppFixtures {
  forum: typeof fixtureForum;
  topics: typeof fixtureTopics;
  users: FixtureUsers;
}

// Plain-value fixtures are declared as overridable options so a journey can
// narrow them without redefining the corpus.
export const test = base.extend<AppFixtures>({
  forum: [fixtureForum, { option: true }],
  topics: [fixtureTopics, { option: true }],
  users: [fixtureUsers, { option: true }],
});

export { expect } from '@playwright/test';
