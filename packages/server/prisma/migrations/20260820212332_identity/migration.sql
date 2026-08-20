-- Migration 1 (design §13 row 1): identity core — WU-M3a-2.
-- User, Session, Token, Whitelist + enums locale (E1), token_scope (E2),
-- verification_stage (E12). Constraints of record: U1 (citext email UNIQUE —
-- legacy's index was NOT unique, plan §2.4 row 6), U2/U25 (tokenHash UNIQUE),
-- U21 (whitelist email UNIQUE), Token.expiresAt NOT NULL (SEC-3: legacy tokens
-- never expired).
--
-- DEFERRED, pending owner ratification — these arrive in a later migration and
-- are deliberately absent here (no placeholder columns, no guesses):
--   * OD-11 age-gate storage (design M6 recommends an attested-16 timestamp,
--     not a DOB; not yet ratified) — an additive column on "User".
--   * OD-12 phone-verification storage (raw number vs one-way derivation) —
--     lands with "VerificationEvent" (design M29).
--   * ConsentRecord (M28) + consent_purpose (E16) and its partial unique U23 —
--     later work unit.

-- CreateEnum
CREATE TYPE "locale" AS ENUM ('ro', 'en');

-- CreateEnum
CREATE TYPE "token_scope" AS ENUM ('password_reset', 'email_validation');

-- CreateEnum
CREATE TYPE "verification_stage" AS ENUM ('stage1_email', 'stage2_phone', 'stage3_eid');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "firstName" VARCHAR(100),
    "lastName" VARCHAR(100),
    "email" CITEXT NOT NULL,
    "emailValidated" BOOLEAN NOT NULL DEFAULT false,
    "locale" "locale" NOT NULL DEFAULT 'ro',
    "passwordHash" TEXT,
    "profilePictureUrl" TEXT,
    "disabledAt" TIMESTAMPTZ(6),
    "verificationStage" "verification_stage" NOT NULL DEFAULT 'stage1_email',
    "notifyReplies" BOOLEAN NOT NULL DEFAULT true,
    "notifyNewTopic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "revokedAt" TIMESTAMPTZ(6),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Token" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL,
    "scope" "token_scope" NOT NULL,
    "tokenHash" BYTEA NOT NULL,
    "expiresAt" TIMESTAMPTZ(6) NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Token_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Whitelist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" CITEXT NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Whitelist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Token_tokenHash_key" ON "Token"("tokenHash");

-- CreateIndex
CREATE INDEX "Token_userId_scope_idx" ON "Token"("userId", "scope");

-- CreateIndex
CREATE INDEX "Token_expiresAt_idx" ON "Token"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Whitelist_email_key" ON "Whitelist"("email");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Token" ADD CONSTRAINT "Token_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
