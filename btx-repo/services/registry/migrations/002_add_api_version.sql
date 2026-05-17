-- G-05: Add api_version column to trust_nodes (ADR-0024 versioning strategy)
ALTER TABLE trust_nodes
  ADD COLUMN IF NOT EXISTS api_version TEXT NOT NULL DEFAULT 'v1';

COMMENT ON COLUMN trust_nodes.api_version IS
  'Highest API version the node advertises (e.g. v1, v2). Used by ADR-0024 sunset logic.';
