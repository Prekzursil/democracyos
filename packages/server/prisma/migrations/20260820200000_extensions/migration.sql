-- Migration 0 (design §13 row 0): extensions the schema depends on.
-- citext backs case-insensitive email identity (AU-7) with a real UNIQUE (U1).
-- pgcrypto is NOT needed on PostgreSQL 16: gen_random_uuid() and sha256() are
-- built in.
CREATE EXTENSION IF NOT EXISTS citext;
