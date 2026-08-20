-- Migration 3 (design §13 row 3): topics + tags — WU-M3a-4.
-- Tag, Topic, Clause, TopicLink, TopicOption, TopicAttrValue + enums
-- voting_method (E5 — legacy's '' member becomes votingMethod IS NULL),
-- content_type (E6), lifecycle (E7), tag_image (E14). Uniques of record:
-- U5 (Tag.slug — P-12 dedupe), U6 (Topic forumId+slug), U8 (Clause
-- topicId+position — TL-9), U9/U10 (TopicOption position/label), U12
-- (TopicAttrValue topicId+attrId — AD-6), U13b (ForumTopicAttrOption
-- attrId+name — added by the WU-M3a-3 review: duplicate option names
-- inserted freely), plus the Forum(ownerId) index from the same review
-- (Postgres does not index FK columns; erasure fan-out would seq-scan).
-- The Prisma-generated DDL is followed by the parts the design marks raw:
-- C1 (the two outcome-declaration CHECKs — C3/N11 + the TL-8 reading),
-- U7/U11 (composite-unique FK targets for migration 4's Vote FKs), the
-- mediaTitle length CHECK (COR-11) and the Tag hex-color CHECK (M25).
-- DEFERRED (design §13): Vote/VoteRanking/TallyCounter/AuditEntry/
-- ConsultationKeyRef and trigger T6 (migration 4); comments (5);
-- notifications (6); RLS (7). T2b stays deferred per the design's own row.

-- CreateEnum
CREATE TYPE "voting_method" AS ENUM ('vote', 'poll', 'cause', 'slider', 'hierarchy');

-- CreateEnum
CREATE TYPE "content_type" AS ENUM ('debate', 'proposal', 'poll');

-- CreateEnum
CREATE TYPE "lifecycle" AS ENUM ('open', 'closed', 'outcome_published');

-- CreateEnum
CREATE TYPE "tag_image" AS ENUM ('arts', 'scale', 'police', 'signs', 'transportation', 'people', 'parks', 'agora', 'internet');

-- CreateTable
CREATE TABLE "Tag" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" TEXT NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "color" TEXT,
    "image" "tag_image" NOT NULL DEFAULT 'arts',
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "forumId" UUID NOT NULL,
    "authorId" UUID,
    "tagId" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "mediaTitle" TEXT NOT NULL,
    "externalAuthor" VARCHAR(100),
    "externalAuthorUrl" VARCHAR(250),
    "source" VARCHAR(250),
    "coverUrl" VARCHAR(250),
    "votingMethod" "voting_method",
    "contentType" "content_type" NOT NULL,
    "lifecycle" "lifecycle" NOT NULL DEFAULT 'open',
    "outcomeDeclaration" TEXT,
    "requiredStageToVote" "verification_stage" NOT NULL DEFAULT 'stage2_phone',
    "closingAt" TIMESTAMPTZ(6),
    "publishedAt" TIMESTAMPTZ(6),
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Clause" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topicId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "markup" TEXT,
    "empty" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Clause_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicLink" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topicId" UUID NOT NULL,
    "text" TEXT,
    "url" VARCHAR(250),
    "position" INTEGER NOT NULL,

    CONSTRAINT "TopicLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicOption" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topicId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "TopicOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopicAttrValue" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "topicId" UUID NOT NULL,
    "attrId" UUID NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "TopicAttrValue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tag_slug_key" ON "Tag"("slug");

-- CreateIndex
CREATE INDEX "Topic_forumId_publishedAt_idx" ON "Topic"("forumId", "publishedAt");

-- CreateIndex
CREATE INDEX "Topic_closingAt_idx" ON "Topic"("closingAt");

-- CreateIndex
CREATE INDEX "Topic_tagId_idx" ON "Topic"("tagId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_forumId_slug_key" ON "Topic"("forumId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Clause_topicId_position_key" ON "Clause"("topicId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TopicOption_topicId_position_key" ON "TopicOption"("topicId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "TopicOption_topicId_label_key" ON "TopicOption"("topicId", "label");

-- CreateIndex
CREATE UNIQUE INDEX "TopicAttrValue_topicId_attrId_key" ON "TopicAttrValue"("topicId", "attrId");

-- CreateIndex
CREATE INDEX "Forum_ownerId_idx" ON "Forum"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumTopicAttrOption_attrId_name_key" ON "ForumTopicAttrOption"("attrId", "name");

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Clause" ADD CONSTRAINT "Clause_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicLink" ADD CONSTRAINT "TopicLink_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicOption" ADD CONSTRAINT "TopicOption_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicAttrValue" ADD CONSTRAINT "TopicAttrValue_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopicAttrValue" ADD CONSTRAINT "TopicAttrValue_attrId_fkey" FOREIGN KEY ("attrId") REFERENCES "ForumTopicAttr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── raw SQL (design §4 — what Prisma cannot express, or the design marks raw) ─

-- C1 (first clause): C3/N11 — a topic may leave the 'open' lifecycle only
-- with a non-blank outcome declaration; the close attempt without one is
-- refused BY THE DATABASE (plan WU-M3a-4), not by a bypassable code path.
ALTER TABLE "Topic" ADD CONSTRAINT topic_closed_requires_outcome
  CHECK (lifecycle = 'open' OR ("outcomeDeclaration" IS NOT NULL AND btrim("outcomeDeclaration") <> ''));

-- C1 (second clause): the TL-8 resolution — legacy "closed" is DERIVED from
-- closingAt passing, with no human at the moment of transition, so the
-- declaration must exist BEFORE closingAt may be set. Q-8's owner decision
-- (design §15 O4) can only tighten the UX above this floor.
ALTER TABLE "Topic" ADD CONSTRAINT topic_closing_requires_outcome
  CHECK ("closingAt" IS NULL OR ("outcomeDeclaration" IS NOT NULL AND btrim("outcomeDeclaration") <> ''));

-- COR-11 (M13): ONE mediaTitle limit — legacy had two (form 200, model 225).
-- The single constant lands in packages/shared at WU-M3b; this CHECK mirrors
-- the design's recommended 200 (the user-visible form limit).
ALTER TABLE "Topic" ADD CONSTRAINT topic_media_title_length
  CHECK (char_length("mediaTitle") <= 200);

-- M25: hex color backstop, verbatim from legacy/lib/regexps/index.js:5
-- (legacy validated app-side only; NULL stays allowed — color is optional).
ALTER TABLE "Tag" ADD CONSTRAINT tag_color_hex
  CHECK (color ~ '^#[0-9a-fA-F]{6}$');

-- U7: FK-support target for migration 4's composite FK
-- Vote(topicId, method) → Topic(id, votingMethod) — a vote's method can never
-- disagree with its topic's method (the structural half of DI-3). Kept raw by
-- the design's stated preference (§4 note, N10): the FK target ships next to
-- the CHECKs it cooperates with, versioned as one reviewable unit.
ALTER TABLE "Topic" ADD CONSTRAINT topic_id_voting_method_fk_target
  UNIQUE (id, "votingMethod");

-- U11: FK-support target for migration 4's Vote(topicId, pollOptionId) →
-- TopicOption(topicId, id) — a poll ballot can only reference an option of
-- its OWN topic; DI-3's off-option ballot becomes an FK violation.
ALTER TABLE "TopicOption" ADD CONSTRAINT topic_option_own_topic_fk_target
  UNIQUE ("topicId", id);

