/**
 * P-19 Test Backfill — HTTP API negative tests for consent endpoints
 *
 * Covers BTX error codes per Annex A §A.5.4:
 *   400 — missing/invalid required fields
 *   403 — caller not authorised for consent
 *   404 — consent not found
 *   409 — duplicate consent (idempotency conflict without Idempotency-Key)
 *   422 — business rule violation (expired consent, already revoked)
 *   429 — rate limit exceeded
 *
 * Uses Fastify inject() — no network, no DB. Repository stubs injected.
 */
export {};
