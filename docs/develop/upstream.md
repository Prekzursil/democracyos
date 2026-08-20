# Upstream posture — hard fork, read-only remote (plan WU-M0-8, N19)

**Verified 20.08.2026.**

## Remote configuration

```
origin    https://github.com/Prekzursil/democracyos   (fetch + push)
upstream  https://github.com/DemocracyOS/democracyos  (fetch)
upstream  DISABLED                                    (push — set via git remote set-url --push upstream DISABLED)
```

Rules: **cherry-pick only, never merge upstream `master`** (N19). Upstream is dead
(last human commit 2020); the remote exists solely to harvest the two branches below.

## Harvest inventory (measured, not assumed)

| Branch | Ahead of master | Contents | Consumed by |
|---|---|---|---|
| `upstream/add/api-tests` | **2 commits**, 11 files (+54/−231) | `e3f00031` "remove useless test files" — **deletes** the jasmine suite (`test/api/forum/index.js`, `test/utils/`, fixtures, the gulp task) and starts an ava migration that was never completed; `09d74848` "Add create forum to api-v2" — an api-v2 `db-api/forums` function plus two empty fixture stubs, **containing no test at all** | WU-M1-13 — **CLOSED, nothing harvested** |
| `upstream/add/i18next` | **314 commits** | i18next groundwork on a long-diverged lineage. **Its test corpus belongs to the DemocracyOS v3 rewrite, not to this application** — see below | WU-M3b-6 (i18n approach only) |

## WU-M1-13 outcome — closed 20.08.2026, nothing cherry-picked

The plan called `add/api-tests` "the highest-value characterization input". Measured, it is
the opposite: the branch's net effect is **−231 lines of test code**. Findings:

- The only genuine upstream API test, `test/api/forum/index.js` (2015-12-11, forum
  permissions), lives on `master` and is **already vendored here** at
  `legacy/test/api/forum/index.js`. Nothing needed fetching.
- That test is **stale three ways against upstream's own tip**: the routes were renamed to
  plural `…/permissions` five days after it was written (only its `describe` title was
  updated), the tip handlers return an empty 200 so its `res.body.permissions` assertions
  match nothing, and `FORUM_OWNER_CANT_HAVE_ANOTHER_ROLE` (2018-08) reverses its
  grant-role-to-owner expectation.
- Cherry-picking either commit would be actively harmful: `e3f00031` would **delete**
  `legacy/test/api/**`, and `09d74848` would add a `db-api/forums.create` that is broken
  copy-paste from topics (it references `Topic`, `updateClauses`, `setAttributes` and
  `scopes`, none imported — a `ReferenceError` on first call) into a tree that is never
  executed anyway.
- **Retraction:** the earlier note here recommended harvesting the settings/posts/reactions
  test commits from the `add/i18next` lineage (`26adcc0e`, `2cd3fb00`, `428407eb`). That was
  wrong. The tree at `26adcc0e` is `cms/`, `reactions/`, `users/`, `services/`, `pages/` with
  no `lib/` — it is the **v3 rewrite, a different application**, and none of its routes exist
  in `legacy/`. Those ~2,100 lines characterize software we are not reviving. Do not mine
  them for behaviour; `add/i18next` remains useful only as a reference for the *i18n
  approach* (WU-M3b-6).

**Value delivered instead of a cherry-pick:** the harvest served as the only external check
on our characterization method, since J1–J10 were derived by *reading* legacy source rather
than by running it. Every assertion the upstream test makes is already covered by J1 (session
cookie, password minimum) or J3 (grant, revoke, read-back visibility), and the one apparent
contradiction resolved in our favour — the upstream test predates the owner-proofing guard by
nine months, so J3's refusal correctly characterizes tip behaviour. **No J1–J10 derivation was
contradicted.** Dispositions are recorded in `docs/CHARACTERIZATION.md` (WU-M1-14).

Upstream also carries ~90 `snyk-fix-*` branches. None are harvested: they patch dependencies
of a codebase this project does not build. Dependency security for the new tree is
osv-scanner + Dependabot (WU-M2-2, WU-M2-5).

## Re-verification

`git remote -v` must always show `DISABLED` as the upstream push URL. Re-check at
milestone exits; a pushable upstream is a configuration bug.
