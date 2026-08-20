#!/usr/bin/env bash
# Charter-check for the democracyos revival (plan WU-M2-2) - CALLER-repo variant.
#
# Shape copied from quality-zero-platform/.quality/charter_check.sh, adapted:
# qzp's script greps its own reusable workflow for gate step names; in this
# CALLER repo the gate steps live in the remote pinned workflow, so the drift
# this script can actually catch is caller-side:
#   (a) the caller workflow must exist and pin reusable-quality.yml by a full
#       40-char SHA (never @main / @v-tag),
#   (b) every charter gate's caller-side config must exist - the pinned
#       workflow SKIPS config-gated gates (4/6) when their config is absent
#       and reports nothing, which is the silent-skip trap M2 exists to close,
#   (c) gate 3's coverage command must be a real npm script,
#   (d) no banned (deleted) gate may creep back in as live config or CI.
#
# Pure bash + grep/sed, no YAML parser - runs identically in CI (invoked by the
# pinned reusable workflow whenever .quality/charter.yml exists) and locally.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHARTER="$ROOT/.quality/charter.yml"
CALLER="$ROOT/.github/workflows/quality.yml"

fail=0
note() { printf '%s\n' "$*"; }

[ -f "$CHARTER" ] || { note "FAIL charter-check: missing $CHARTER"; exit 1; }

# ── (a) caller workflow exists and pins by full SHA ──────────────────────────
if [ ! -f "$CALLER" ]; then
  note "FAIL charter-check: caller workflow .github/workflows/quality.yml is missing"
  fail=1
else
  pin_pattern="$(grep -E '^pin_pattern:' "$CHARTER" | sed -E "s/^pin_pattern:[[:space:]]*'?//; s/'?[[:space:]]*$//")"
  if grep -Eq "$pin_pattern" "$CALLER"; then
    note "PASS caller workflow pins reusable-quality.yml by 40-char SHA"
  else
    note "FAIL caller workflow does not pin reusable-quality.yml by a full 40-char SHA (pattern: $pin_pattern)"
    fail=1
  fi
  if grep -Eq 'reusable-quality\.yml@(main|master|v[0-9])' "$CALLER"; then
    note "FAIL caller workflow uses a mutable ref (@main/@vN) instead of a SHA pin"
    fail=1
  fi
fi

# ── (b) every charter gate's caller-side config exists ───────────────────────
# caller_config entries are the '- "path"' lines nested under caller_config:.
configs="$(awk '
  /^[[:space:]]+caller_config:/ {grab=1; next}
  grab && !/^[[:space:]]+-[[:space:]]*"/ {grab=0}
  grab {sub(/^[[:space:]]+-[[:space:]]*"/,""); sub(/".*$/,""); print}
' "$CHARTER")"
if [ -z "$configs" ]; then
  note "FAIL charter-check: no caller_config entries found in charter"
  exit 1
fi
while IFS= read -r cfg; do
  [ -z "$cfg" ] && continue
  if [ -e "$ROOT/$cfg" ]; then
    note "PASS caller-side gate config present: $cfg"
  else
    note "FAIL caller-side gate config MISSING (its gate would silently skip or degrade): $cfg"
    fail=1
  fi
done <<< "$configs"

# Every shipped opengrep rule file must actually declare rules (an empty file
# would arm gate 4 while checking nothing).
for rules_file in "$ROOT"/.quality/opengrep/*.yml; do
  [ -e "$rules_file" ] || continue
  if grep -Eq '^rules:' "$rules_file" && grep -Eq '^[[:space:]]+- id:' "$rules_file"; then
    note "PASS opengrep ruleset declares rules: ${rules_file#"$ROOT"/}"
  else
    note "FAIL opengrep ruleset declares NO rules (gate 4 would run vacuously): ${rules_file#"$ROOT"/}"
    fail=1
  fi
done

# ── (c) gate 3's coverage command is a real npm script ───────────────────────
if grep -Eq '"test:coverage"[[:space:]]*:' "$ROOT/package.json"; then
  note "PASS package.json exposes test:coverage (gate 3 command)"
else
  note "FAIL package.json does not expose test:coverage - gate 3 cannot run"
  fail=1
fi

# ── (d) no banned gate creeps back in ─────────────────────────────────────────
# Live-config surfaces of the deleted gates. legacy/** is exempt (quarantined
# archaeology, plan WU-M0-1). Checked: root dotfiles + .github/workflows.
banned_files=".snyk .eslintrc .eslintrc.js .eslintrc.cjs .eslintrc.json .eslintrc.yml .eslintrc.yaml renovate.json renovate.json5 .renovaterc .renovaterc.json sonar-project.properties .codacy.yml .codacy.yaml .deepsource.toml codecov.yml .codecov.yml qlty.toml .trivyignore"
for bf in $banned_files; do
  if [ -e "$ROOT/$bf" ]; then
    note "FAIL banned gate config present at repo root: $bf (charter deleted_gates)"
    fail=1
  fi
done
banned_names="$(awk '
  /^deleted_gates:/ {grab=1; next}
  grab && /^[a-zA-Z]/ {grab=0}
  grab && /^[[:space:]]*-[[:space:]]*/ {sub(/^[[:space:]]*-[[:space:]]*/,""); sub(/#.*/,""); gsub(/[[:space:]]/,""); if (length($0)) print}
' "$CHARTER")"
for wf in "$ROOT"/.github/workflows/*.yml "$ROOT"/.github/workflows/*.yaml; do
  [ -e "$wf" ] || continue
  while IFS= read -r bad; do
    [ -z "$bad" ] && continue
    # A banned tool named in `uses:` or `run:` lines is live CI wiring. `sentry`
    # etc. in comments is fine; match only executable lines.
    if grep -E '^\s*(uses|run):' "$wf" | grep -Eiq "(^|[^a-z])${bad}([^a-z]|$)"; then
      note "FAIL banned gate '${bad}' is wired in CI workflow: ${wf#"$ROOT"/}"
      fail=1
    fi
  done <<< "$banned_names"
done

if [ "$fail" -ne 0 ]; then
  note "FAILED: charter-check - caller-side gate surface has drifted from the lean 6-gate charter"
  exit 1
fi
note "SUCCESS: charter-check - all 6 charter gates have their caller-side surface in place, no banned gate present"
