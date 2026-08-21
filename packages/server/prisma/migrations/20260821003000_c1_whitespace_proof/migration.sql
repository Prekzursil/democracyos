-- Migration 3b (WU-M3a-4 adversarial review, F3): make both C1 CHECKs
-- whitespace-proof. The review measured that bare btrim() strips only
-- SPACES — btrim(E'\t') = '' is FALSE — so a closed topic could satisfy
-- decision C3/N11 ("declare what happens with the result") with a single
-- TAB (or newline), defeating the requirement. Reproduced on dev before
-- this migration: a closed topic with outcomeDeclaration = E'\t' inserted
-- successfully.
--
-- Replacement condition: "outcomeDeclaration" IS NOT NULL AND
-- "outcomeDeclaration" ~ '[^[:space:]]' — the POSIX class covers ALL
-- whitespace (space, tab, CR, LF, vertical tab, form feed, and
-- locale-defined whitespace) rather than a hand-listed charset, so the
-- declaration must contain at least one real character. The explicit
-- IS NOT NULL guard is REQUIRED, not decorative: a CHECK passes when its
-- expression is NULL (three-valued logic), and NULL ~ '[^[:space:]]' is
-- NULL — a bare-regex CHECK was proven by execution to ACCEPT a NULL
-- declaration on a closed topic.
--
-- Same names as before (topic_closed_requires_outcome /
-- topic_closing_requires_outcome): the probes assert by constraint name
-- and the design record keys on them; only the condition tightens.
-- Tightening is safe against existing rows: any row valid under the old
-- btrim() condition and invalid under this one carried a declaration made
-- exclusively of non-space whitespace — exactly the loophole rows this
-- migration exists to make unrepresentable.

ALTER TABLE "Topic" DROP CONSTRAINT topic_closed_requires_outcome;
ALTER TABLE "Topic" ADD CONSTRAINT topic_closed_requires_outcome
  CHECK (lifecycle = 'open' OR ("outcomeDeclaration" IS NOT NULL AND "outcomeDeclaration" ~ '[^[:space:]]'));

ALTER TABLE "Topic" DROP CONSTRAINT topic_closing_requires_outcome;
ALTER TABLE "Topic" ADD CONSTRAINT topic_closing_requires_outcome
  CHECK ("closingAt" IS NULL OR ("outcomeDeclaration" IS NOT NULL AND "outcomeDeclaration" ~ '[^[:space:]]'));
