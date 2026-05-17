-- Federation sync state for trust-node
CREATE TABLE IF NOT EXISTS federation_state (
  node_id UUID PRIMARY KEY,
  sync_cursor BIGINT DEFAULT 0,
  last_sync_at TIMESTAMP,
  merkle_root_verified_at TIMESTAMP,
  status TEXT NOT NULL DEFAULT 'active', -- active, syncing, paused
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Peer sync events: track federation sync requests from peer nodes
CREATE TABLE IF NOT EXISTS peer_syncs (
  id BIGSERIAL PRIMARY KEY,
  peer_node_id UUID NOT NULL,
  cursor BIGINT NOT NULL,
  merkle_root_hash TEXT,
  signature TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, verified, failed
  error_msg TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP
);

CREATE INDEX idx_peer_syncs_peer_node_id ON peer_syncs(peer_node_id);
CREATE INDEX idx_peer_syncs_status ON peer_syncs(status);
CREATE INDEX idx_peer_syncs_created_at ON peer_syncs(created_at DESC);

-- Audit chain for federation verification
CREATE TABLE IF NOT EXISTS audit_chain (
  index BIGSERIAL PRIMARY KEY,
  event_hash TEXT NOT NULL UNIQUE,
  previous_hash TEXT,
  parent_hashes JSONB,
  verified_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_chain_verified_at ON audit_chain(verified_at);
CREATE INDEX idx_audit_chain_created_at ON audit_chain(created_at DESC);
