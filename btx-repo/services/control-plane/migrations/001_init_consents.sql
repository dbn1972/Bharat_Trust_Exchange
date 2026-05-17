CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Consents table: core domain entity for BTX consent lifecycle
CREATE TABLE IF NOT EXISTS consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_node_id UUID NOT NULL,
  to_node_id UUID NOT NULL,
  subject_ref TEXT NOT NULL,
  purpose TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, active, revoked, expired
  obligations JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMP,
  expires_at TIMESTAMP
);

CREATE INDEX idx_consents_from_node_id ON consents(from_node_id);
CREATE INDEX idx_consents_to_node_id ON consents(to_node_id);
CREATE INDEX idx_consents_status ON consents(status);
CREATE INDEX idx_consents_created_at ON consents(created_at DESC);

-- Audit events table: append-only audit trail (partitioned by month)
CREATE TABLE IF NOT EXISTS audit_events (
  id BIGSERIAL,
  consent_id UUID,
  event_type TEXT NOT NULL, -- consent.granted, consent.revoked, consent.queried, etc.
  actor_node_id UUID NOT NULL,
  subject_ref TEXT,
  details JSONB DEFAULT '{}',
  merkle_index BIGINT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id, created_at)
) PARTITION BY RANGE (created_at);

-- Create first partition for May 2026
CREATE TABLE IF NOT EXISTS audit_events_202605
  PARTITION OF audit_events
  FOR VALUES FROM ('2026-05-01'::timestamp) TO ('2026-06-01'::timestamp);

CREATE INDEX idx_audit_events_consent_id ON audit_events(consent_id);
CREATE INDEX idx_audit_events_event_type ON audit_events(event_type);
CREATE INDEX idx_audit_events_created_at ON audit_events(created_at DESC);

-- Outbox table: transactional outbox for audit events → Kafka (ADR-0021)
CREATE TABLE IF NOT EXISTS outbox (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  aggregate_id UUID NOT NULL,
  payload JSONB NOT NULL,
  published_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_outbox_published_at ON outbox(published_at) WHERE published_at IS NULL;
CREATE INDEX idx_outbox_created_at ON outbox(created_at ASC);

-- Merkle root signatures: daily signed commitment (ADR-0021)
CREATE TABLE IF NOT EXISTS merkle_roots (
  day DATE PRIMARY KEY,
  root_hash TEXT NOT NULL,
  signature TEXT NOT NULL,
  event_count BIGINT NOT NULL,
  signed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_merkle_roots_signed_at ON merkle_roots(signed_at DESC);
