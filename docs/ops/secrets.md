# Secrets hygiene — history audit and rotation inventory (plan WU-M0-7)

**Audit date:** 20.08.2026 · **Tool:** gitleaks 8.30.1 · **Scope:** entire git history,
all refs (`gitleaks git --log-opts="--all"`), 5,702 commits / ~15.2 MB scanned, plus a
manual sweep of the legacy config surface.

## Principle

Any value that has ever been committed is treated as **public** and must be rotated.
Production secrets are injected at runtime only — never in an image layer, never in
the repo. `DATABASE_URL` is a secret (plan §8.8).

## Findings

### gitleaks (full history): 2 findings, both the same item — assessed NOT a live credential

| Fingerprint | What it is | Assessment |
|---|---|---|
| `77464ee1…:README.md:generic-api-key:73` and `e783fb7b…:README.md:generic-api-key:73` | A Mandrill API key **documentation example** (`Eg: klomFRs7MWASlosCa2q6Y`) in two adjacent September-2013 upstream README revisions | An illustrative placeholder in upstream's install docs, 22 chars, committed by upstream in 2013. It is not a credential of this fork and not ours to rotate. If it ever was live, it belonged to upstream (Democracia en Red) and to a mail product (Mandrill) whose 2013-era keys are long dead. **Action: none possible; recorded here so the finding is never re-litigated.** |

### Manual sweep of the legacy config surface: no committed credential

| File | Content | Verdict |
|---|---|---|
| `legacy/docker/.env` | `MONGO_URL=mongodb://mongo/DemocracyOS-dev` (no username/password) + `DEBUG` | No credential — confirms the prior scout finding. A committed `.env` is still an anti-pattern; the new stack gitignores all `.env*` except `.env.example`. |
| `legacy/config/defaults.json` | `jwtSecret` = the sentinel string "Generate a secret token and paste it here."; `auth.facebook.clientSecret` and `recaptchaSecret` empty | Sentinels/empties, no credential. |
| `legacy/app.json` | `JWT_SECRET` declared with Heroku `"generator": "secret"` — no literal value | No credential. |
| `legacy/Procfile` | Process line only | No credential. |

## Rotation inventory

**Nothing to rotate:** the audit found no credential of this fork ever committed.
This inventory must be re-checked at WU-M8-12 against everything added since M0.

## Standing controls

- gitleaks becomes CI gate 5 at WU-M2-2 (`.gitleaks.toml`).
- Local `.env.local` / `packages/server/.env` are gitignored; `.env.example` carries
  placeholders only.
- History is public (GitHub fork); no history rewrite was performed or is planned.
