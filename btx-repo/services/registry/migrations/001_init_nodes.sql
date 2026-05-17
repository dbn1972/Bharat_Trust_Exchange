-- Trust node registry: BTX federation member directory
CREATE TABLE IF NOT EXISTS trust_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  node_id UUID NOT NULL UNIQUE,
  name TEXT NOT NULL,
  endpoint_url TEXT NOT NULL,
  public_key_pem TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active, inactive, revoked
  metadata JSONB DEFAULT '{}',
  capabilities JSONB DEFAULT '[]', -- supported federation features
  last_seen_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trust_nodes_status ON trust_nodes(status);
CREATE INDEX idx_trust_nodes_node_id ON trust_nodes(node_id);
CREATE INDEX idx_trust_nodes_last_seen_at ON trust_nodes(last_seen_at DESC);
CREATE INDEX idx_trust_nodes_created_at ON trust_nodes(created_at DESC);
