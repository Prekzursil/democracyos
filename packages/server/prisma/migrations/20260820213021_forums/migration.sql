-- Migration 2 (design §13 row 2): forums + permissions — WU-M3a-3.
-- Forum, ForumPermission, ForumTopicAttr, ForumTopicAttrOption + enums
-- forum_role (E3), forum_visibility (E4), topic_attr_kind (E13) — role and
-- visibility values verbatim from legacy/lib/models/forum/{roles,visibilities}.js
-- (`owner` is not a role — FR-1; `moderator` omitted until the config flag's
-- fate is decided). Tag lands with topics (design §13 row 3): Topic.tagId is
-- the FK that needs it.
-- The Prisma-generated DDL above the "raw SQL" marker is followed by the parts
-- Prisma cannot express: U3 (partial unique on lower(name) — kills DI-4),
-- C8 (name format FR-4 + reserved names), C9 (summary ≤ 300 inclusive —
-- COR-12; live-forum-has-owner C9b), T2 (owner-cannot-hold-a-role trigger).

-- CreateEnum
CREATE TYPE "forum_role" AS ENUM ('admin', 'collaborator', 'author', 'participant');

-- CreateEnum
CREATE TYPE "forum_visibility" AS ENUM ('private', 'closed', 'public', 'collaborative');

-- CreateEnum
CREATE TYPE "topic_attr_kind" AS ENUM ('number', 'string', 'long_string', 'enum', 'boolean');

-- CreateTable
CREATE TABLE "Forum" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "coverUrl" TEXT,
    "ownerId" UUID,
    "visibility" "forum_visibility" NOT NULL DEFAULT 'public',
    "deletedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Forum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumPermission" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "forumId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "role" "forum_role" NOT NULL,
    "grantedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForumPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumTopicAttr" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "forumId" UUID NOT NULL,
    "name" VARCHAR(32) NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "description" VARCHAR(256),
    "mandatory" BOOLEAN NOT NULL DEFAULT false,
    "kind" "topic_attr_kind" NOT NULL,
    "min" INTEGER,
    "max" INTEGER,

    CONSTRAINT "ForumTopicAttr_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ForumTopicAttrOption" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "attrId" UUID NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "title" VARCHAR(128) NOT NULL,

    CONSTRAINT "ForumTopicAttrOption_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ForumPermission_userId_idx" ON "ForumPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumPermission_forumId_userId_key" ON "ForumPermission"("forumId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "ForumTopicAttr_forumId_name_key" ON "ForumTopicAttr"("forumId", "name");

-- AddForeignKey
ALTER TABLE "Forum" ADD CONSTRAINT "Forum_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPermission" ADD CONSTRAINT "ForumPermission_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumPermission" ADD CONSTRAINT "ForumPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicAttr" ADD CONSTRAINT "ForumTopicAttr_forumId_fkey" FOREIGN KEY ("forumId") REFERENCES "Forum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ForumTopicAttrOption" ADD CONSTRAINT "ForumTopicAttrOption_attrId_fkey" FOREIGN KEY ("attrId") REFERENCES "ForumTopicAttr"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── raw SQL (design §4 — what Prisma cannot express) ────────────────────────

-- U3: live-forum name uniqueness (kills DI-4 — the pre-save find-then-save race
-- at legacy/lib/models/forum/index.js:76-88). Partial: deletion frees the name
-- (P-9). lower(name) is belt-and-braces on top of C8's lowercase format.
CREATE UNIQUE INDEX forum_name_live ON "Forum" (lower(name)) WHERE "deletedAt" IS NULL;

-- C8 (format): FR-4 — 1–80 chars, lowercase alphanumeric or '-', no edge
-- hyphens. Accepts the same string set as legacy's case-insensitive regex
-- (legacy/lib/regexps/index.js:14-17) once input is lowercased, which storage
-- already guaranteed (forum/index.js:39 lowercases). The friendly naming of
-- the error (COR-13) stays an API concern; this is the backstop.
ALTER TABLE "Forum" ADD CONSTRAINT forum_name_format
  CHECK (name ~ '^[a-z0-9]([a-z0-9-]{0,78}[a-z0-9])?$');

-- C8 (reserved): verbatim from legacy/lib/models/forum/reserved-names.js:5-24.
ALTER TABLE "Forum" ADD CONSTRAINT forum_name_not_reserved
  CHECK (name <> ALL (ARRAY['admin','dashboard','forum','forums','login','logout','mine','profiles','register','settings','signin','signout','signup','status','topic','topics','user','users']));

-- C9: summary limit is 300 INCLUSIVE — kills COR-12 (legacy's `< 300`
-- off-by-one at forum/index.js:43-53 broke the UI's promised 300).
ALTER TABLE "Forum" ADD CONSTRAINT forum_summary_length
  CHECK (char_length(summary) <= 300);

-- C9b: a LIVE forum always has an owner; erasure may orphan only a deleted one
-- (pairs with F3's ON DELETE SET NULL — the DB makes silent orphaning
-- impossible; refuse-vs-auto-soft-delete is WU-M6-14's UX call, design §15 O5).
ALTER TABLE "Forum" ADD CONSTRAINT forum_live_has_owner
  CHECK ("deletedAt" IS NOT NULL OR "ownerId" IS NOT NULL);

-- T2: FR-8's FORUM_OWNER_CANT_HAVE_ANOTHER_ROLE
-- (legacy/lib/models/forum/index.js:157-162) — cross-table, so a trigger, not
-- a CHECK. Owner authority lives on Forum.ownerId alone (FR-1).
CREATE FUNCTION forum_permission_not_owner() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."userId" = (SELECT "ownerId" FROM "Forum" WHERE id = NEW."forumId") THEN
    RAISE EXCEPTION 'FORUM_OWNER_CANT_HAVE_ANOTHER_ROLE: user % is the owner of forum %',
      NEW."userId", NEW."forumId";
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER forum_permission_not_owner
  BEFORE INSERT OR UPDATE ON "ForumPermission"
  FOR EACH ROW EXECUTE FUNCTION forum_permission_not_owner();
