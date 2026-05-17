import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createIntegrationHarness } from './helpers/integration-harness';

describe('Phase 7: Business Logic Integration', () => {
  let harness: Awaited<ReturnType<typeof createIntegrationHarness>>;

  beforeAll(async () => {
    harness = await createIntegrationHarness();
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('grants consent with audit trail and publishes the outbox event', async () => {
    const fromNodeId = randomUUID();
    const toNodeId = randomUUID();

    const grant = await harness.request('controlPlane', '/v1/consents', {
      method: 'POST',
      headers: { 'x-node-id': fromNodeId },
      body: {
        fromNodeId,
        toNodeId,
        subjectRef: 'citizen-hash-001',
        purpose: 'kyc-verification',
        obligations: { audit: true },
      },
    });

    expect(grant.status).toBe(201);
    const created = grant.body as { id: string; status: string };
    expect(created.status).toBe('pending');

    const auditRows = await harness.query(
      'controlPlane',
      'SELECT event_type, details FROM audit_events WHERE consent_id = $1 ORDER BY id ASC',
      [created.id]
    );
    expect(auditRows.rowCount).toBe(1);
    expect(auditRows.rows[0].event_type).toBe('consent.granted');

    const initialOutbox = await harness.query(
      'controlPlane',
      'SELECT payload, published_at FROM outbox WHERE aggregate_id = $1 ORDER BY id ASC',
      [created.id]
    );
    expect(initialOutbox.rowCount).toBe(1);
    expect(initialOutbox.rows[0].payload.subjectRef).toBeUndefined();

    const publishedRow = await harness.waitFor(
      async () => harness.query(
        'controlPlane',
        'SELECT published_at FROM outbox WHERE aggregate_id = $1 ORDER BY id ASC LIMIT 1',
        [created.id]
      ),
      (result) => Boolean(result.rows[0]?.published_at),
      30000
    );
    expect(publishedRow.rows[0].published_at).toBeTruthy();
  });

  it('revokes consent and appends a second outbox event', async () => {
    const fromNodeId = randomUUID();
    const toNodeId = randomUUID();
    const grant = await harness.request('controlPlane', '/v1/consents', {
      method: 'POST',
      headers: { 'x-node-id': fromNodeId },
      body: {
        fromNodeId,
        toNodeId,
        subjectRef: 'citizen-hash-002',
        purpose: 'benefit-verification',
      },
    });

    const created = grant.body as { id: string };

    const revoke = await harness.request('controlPlane', `/v1/consents/${created.id}/revoke`, {
      method: 'POST',
      headers: { 'x-node-id': fromNodeId },
      body: {
        reason: 'citizen-request',
        cascadeToFederation: true,
      },
    });

    expect(revoke.status).toBe(200);
    expect((revoke.body as { status: string }).status).toBe('revoked');

    const outboxRows = await harness.query(
      'controlPlane',
      'SELECT event_type FROM outbox WHERE aggregate_id = $1 ORDER BY id ASC',
      [created.id]
    );
    expect(outboxRows.rows.map((row) => row.event_type)).toEqual(['consent.granted', 'consent.revoked']);
  });

  it('rejects consent query from an unrelated node', async () => {
    const fromNodeId = randomUUID();
    const toNodeId = randomUUID();
    const grant = await harness.request('controlPlane', '/v1/consents', {
      method: 'POST',
      headers: { 'x-node-id': fromNodeId },
      body: {
        fromNodeId,
        toNodeId,
        subjectRef: 'citizen-hash-003',
        purpose: 'income-proof',
      },
    });
    const created = grant.body as { id: string };

    const unauthorized = await harness.request('controlPlane', `/v1/consents/${created.id}`, {
      method: 'GET',
      headers: { 'x-node-id': randomUUID() },
    });

    expect(unauthorized.status).toBe(403);
    expect((unauthorized.body as { message: string }).message).toContain('Not authorized');
  });

  it('verifies federation sync with a valid peer signature', async () => {
    const peerNodeId = randomUUID();
    const merkleRootHash = `root-${randomUUID()}`;
    const { privateKey, publicKey } = generateKeyPairSync('ed25519');
    const signature = sign(null, Buffer.from(merkleRootHash, 'utf8'), privateKey).toString('base64');

    const sync = await harness.request('trustNode', '/v1/federation/sync', {
      method: 'POST',
      headers: {
        'x-peer-public-key': Buffer.from(publicKey.export({ type: 'spki', format: 'pem' }).toString(), 'utf8').toString('base64'),
      },
      body: {
        peerNodeId,
        cursor: 42,
        merkleRootHash,
        signature,
      },
    });

    expect(sync.status).toBe(202);
    expect((sync.body as { accepted: boolean }).accepted).toBe(true);

    const state = await harness.request('trustNode', `/v1/federation/state/${peerNodeId}`);
    expect(state.status).toBe(200);
    expect((state.body as { syncCursor: number }).syncCursor).toBe(42);
  });

  it('marks federation sync as failed when signature verification fails', async () => {
    const peerNodeId = randomUUID();
    const { publicKey } = generateKeyPairSync('ed25519');

    const sync = await harness.request('trustNode', '/v1/federation/sync', {
      method: 'POST',
      headers: {
        'x-peer-public-key': Buffer.from(publicKey.export({ type: 'spki', format: 'pem' }).toString(), 'utf8').toString('base64'),
      },
      body: {
        peerNodeId,
        cursor: 7,
        merkleRootHash: `root-${randomUUID()}`,
        signature: Buffer.from('invalid-signature').toString('base64'),
      },
    });

    expect(sync.status).toBe(202);
    expect((sync.body as { accepted: boolean }).accepted).toBe(false);

    const failed = await harness.query(
      'trustNode',
      'SELECT status, error_msg FROM peer_syncs WHERE peer_node_id = $1 ORDER BY id DESC LIMIT 1',
      [peerNodeId]
    );
    expect(failed.rows[0].status).toBe('failed');
    expect(failed.rows[0].error_msg).toContain('signature verification failed');
  });
});
