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
| `upstream/add/api-tests` | **2 commits**, 11 files (+54/−231) | `09d74848` "Add create forum to api-v2" (a forum-creation API test + api-v2 route work), `e3f00031` "remove useless test files" | WU-M1-13 |
| `upstream/add/i18next` | **314 commits** | i18next groundwork on top of a long-diverged development lineage (`72acb381` package installs, `4f555e41` server wrapping, `9f2e049c` utils, `a241199a` WIP SSR experiments) | WU-M3b-6 |

**Correction to the plan's assumption (flagged for WU-M1-13):** the plan calls
`add/api-tests` "the single most valuable characterization input", but measured
against `master` it carries only the 2 commits above. The larger API/DB-API test
corpus visible in upstream's history (settings/posts/reactions test commits such as
`26adcc0e`, `2cd3fb00`, `428407eb`) lives in the **`add/i18next` lineage** (314
commits ahead, shared with upstream `development`). WU-M1-13 should harvest
characterization material from that lineage too, not only from `add/api-tests`.

## Re-verification

`git remote -v` must always show `DISABLED` as the upstream push URL. Re-check at
milestone exits; a pushable upstream is a configuration bug.
