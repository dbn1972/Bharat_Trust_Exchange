-- BTX local Postgres init
-- Creates per-service databases and a btx_app role.
CREATE ROLE btx_app LOGIN PASSWORD 'btx_app';
CREATE DATABASE btx_registry      OWNER btx_app;
CREATE DATABASE btx_control_plane OWNER btx_app;
CREATE DATABASE btx_trust_node    OWNER btx_app;

-- conventions: append-only audit_events; outbox; idempotency_keys table
-- per-service migrations create their own schemas
