-- Migration: add_ai_embeddings_and_blockchain
-- Adds:
--   1. pgvector extension (required for vector column + cosine similarity search)
--   2. ai_embeddings table (text + metadata columns via Prisma)
--   3. embedding vector(1536) column (pgvector native type — not in Prisma schema DSL)
--   4. IVFFlat index on embedding column for fast cosine similarity search
--   5. blockchain_records table for on-chain deal hash proofs

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. pgvector extension
-- ─────────────────────────────────────────────────────────────────────────────
-- Requires pgvector to be installed on the PostgreSQL server.
-- On Supabase / Railway / Render it is pre-installed.
-- On a self-hosted Postgres: install with `apt install postgresql-15-pgvector`
-- then run `CREATE EXTENSION IF NOT EXISTS vector;` as superuser.
CREATE EXTENSION IF NOT EXISTS "vector";

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ai_embeddings table (non-vector columns — Prisma manages these)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "ai_embeddings" (
    "id"          TEXT         NOT NULL,
    "tenantId"    TEXT         NOT NULL,
    "entityType"  TEXT         NOT NULL,
    "entityId"    TEXT         NOT NULL,
    "content"     TEXT         NOT NULL,
    "metadata"    JSONB        NOT NULL DEFAULT '{}',
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_embeddings_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one embedding per (tenant, entityType, entityId)
CREATE UNIQUE INDEX "ai_embeddings_tenantId_entityType_entityId_key"
    ON "ai_embeddings"("tenantId", "entityType", "entityId");

-- Standard indexes (used by Prisma queries + pgvector WHERE clauses)
CREATE INDEX "ai_embeddings_tenantId_idx"
    ON "ai_embeddings"("tenantId");

CREATE INDEX "ai_embeddings_tenantId_entityType_idx"
    ON "ai_embeddings"("tenantId", "entityType");

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. embedding column (vector type — pgvector only, not expressible in Prisma DSL)
-- ─────────────────────────────────────────────────────────────────────────────
-- 1536 dimensions = OpenAI text-embedding-3-small output size
ALTER TABLE "ai_embeddings"
    ADD COLUMN "embedding" vector(1536);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. IVFFlat index for cosine similarity search
-- ─────────────────────────────────────────────────────────────────────────────
-- IVFFlat is efficient up to ~1M rows.
-- lists = 100 is a good default; increase to sqrt(rows) as data grows.
-- CONCURRENTLY avoids locking the table during index build (safe for production).
-- NOTE: IVFFlat requires at least one row to exist before indexing.
--       The index will be created but not trained until data is inserted.
CREATE INDEX CONCURRENTLY IF NOT EXISTS "ai_embeddings_embedding_idx"
    ON "ai_embeddings" USING ivfflat ("embedding" vector_cosine_ops)
    WITH (lists = 100);

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. blockchain_records table
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE "blockchain_records" (
    "id"          TEXT         NOT NULL,
    "tenantId"    TEXT         NOT NULL,
    "entityType"  TEXT         NOT NULL DEFAULT 'DEAL',
    "entityId"    TEXT         NOT NULL,
    "dataHash"    TEXT         NOT NULL,
    "txHash"      TEXT,
    "network"     TEXT         NOT NULL DEFAULT 'polygon-mumbai',
    "status"      TEXT         NOT NULL DEFAULT 'PENDING',
    "blockNumber" BIGINT,
    "gasUsed"     TEXT,
    "error"       TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "blockchain_records_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one record per (tenant, entityType, entityId)
-- Ensures idempotent upserts from the BlockchainWorker
CREATE UNIQUE INDEX "blockchain_records_tenantId_entityType_entityId_key"
    ON "blockchain_records"("tenantId", "entityType", "entityId");

-- Index for tenant-scoped queries
CREATE INDEX "blockchain_records_tenantId_idx"
    ON "blockchain_records"("tenantId");

-- Index for status-based queries (e.g. "find all PENDING records for retry")
CREATE INDEX "blockchain_records_tenantId_status_idx"
    ON "blockchain_records"("tenantId", "status");
