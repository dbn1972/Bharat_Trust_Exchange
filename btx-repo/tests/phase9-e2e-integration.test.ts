import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import { createIntegrationHarness } from './helpers/integration-harness';

describe('Phase 9: End-to-End Integration Tests', () => {
  let harness: Awaited<ReturnType<typeof createIntegrationHarness>>;

  beforeAll(async () => {
    harness = await createIntegrationHarness({ requireKafka: true });
  });

  afterAll(async () => {
    await harness?.stop();
  });

  it('reports healthy service status across all modules', async () => {
    const registry = await harness.request('registry', '/healthz', { method: 'GET' }, false);
    const controlPlane = await harness.request('controlPlane', '/healthz', { method: 'GET' }, false);
    const trustNode = await harness.request('trustNode', '/healthz', { method: 'GET' }, false);

    expect(registry.status).toBe(200);
    expect((registry.body as { service: string }).service).toBe('registry');
    expect(controlPlane.status).toBe(200);
    expect((controlPlane.body as { service: string }).service).toBe('control-plane');
    expect(trustNode.status).toBe(200);
    expect((trustNode.body as { service: string }).service).toBe('trust-node');
  });

  it('registers and retrieves a trust node through the registry API', async () => {
    const nodeId = randomUUID();
    const register = await harness.request('registry', '/v1/nodes', {
      method: 'POST',
      body: {
        nodeId,
        name: 'Registry E2E Node',
        endpointUrl: 'https://node.example.com',
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\nMFYwEAYHKoZIzj0CAQYFK4EEAAoDQgAEtesttesttesttesttesttesttesttest\n-----END PUBLIC KEY-----',
        apiVersion: 'v2',
        capabilities: ['federation.sync'],
      },
    });

    expect(register.status).toBe(201);
    expect((register.body as { nodeId: string }).nodeId).toBe(nodeId);

    const fetchNode = await harness.request('registry', `/v1/nodes/${nodeId}`, { method: 'GET' });
    expect(fetchNode.status).toBe(200);
    expect((fetchNode.body as { nodeId: string; apiVersion: string }).nodeId).toBe(nodeId);
    expect((fetchNode.body as { apiVersion: string }).apiVersion).toBe('v2');
  });

  it('executes the full consent lifecycle including audit retrieval', async () => {
    const fromNodeId = randomUUID();
    const toNodeId = randomUUID();

    const grant = await harness.request('controlPlane', '/v1/consents', {
      method: 'POST',
      headers: { 'x-node-id': fromNodeId },
      body: {
        fromNodeId,
        toNodeId,
        subjectRef: 'citizen-e2e-001',
        purpose: 'income-validation',
        obligations: { retentionDays: 30 },
      },
    });

    expect(grant.status).toBe(201);
    const consentId = (grant.body as { id: string }).id;

    const query = await harness.request('controlPlane', `/v1/consents/${consentId}`, {
      method: 'GET',
      headers: { 'x-node-id': fromNodeId },
    });
    expect(query.status).toBe(200);
    expect((query.body as { id: string }).id).toBe(consentId);

    const audit = await harness.request('controlPlane', `/v1/consents/${consentId}/audit`, { method: 'GET' });
    expect(audit.status).toBe(200);
    expect(Array.isArray(audit.body)).toBe(true);
    expect((audit.body as Array<{ eventType: string }>).some((event) => event.eventType === 'consent.granted')).toBe(true);

    const revoke = await harness.request('controlPlane', `/v1/consents/${consentId}/revoke`, {
      method: 'POST',
      headers: { 'x-node-id': fromNodeId },
      body: { reason: 'citizen-request', cascadeToFederation: true },
    });
    expect(revoke.status).toBe(200);
    expect((revoke.body as { status: string }).status).toBe('revoked');
  });

  it('replays duplicate consent creation requests through the idempotency plugin', async () => {
    const fromNodeId = randomUUID();
    const payload = {
      fromNodeId,
      toNodeId: randomUUID(),
      subjectRef: 'citizen-e2e-idem',
      purpose: 'idempotency-check',
    };
    const idempotencyKey = randomUUID();

    const first = await harness.request('controlPlane', '/v1/consents', {
      method: 'POST',
      headers: {
        'x-node-id': fromNodeId,
        'idempotency-key': idempotencyKey,
      },
      body: payload,
    });

    const second = await harness.request('controlPlane', '/v1/consents', {
      method: 'POST',
      headers: {
        'x-node-id': fromNodeId,
        'idempotency-key': idempotencyKey,
      },
      body: payload,
    });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect((second.body as { id: string }).id).toBe((first.body as { id: string }).id);
    expect(second.headers.get('x-idempotency-replayed')).toBe('true');
  });

  it('switches the broker plugin between Redpanda and Kafka through the admin API', async () => {
    const initial = await harness.request('controlPlane', '/v1/admin/plugins/message-broker', { method: 'GET' });
    expect(initial.status).toBe(200);

    const kafka = await harness.request('controlPlane', '/v1/admin/plugins/message-broker', {
      method: 'PUT',
      body: {
        provider: 'kafka',
        brokers: ['127.0.0.1:29092'],
      },
    });
    expect(kafka.status).toBe(200);
    expect((kafka.body as { provider: string }).provider).toBe('kafka');

    const redpanda = await harness.request('controlPlane', '/v1/admin/plugins/message-broker', {
      method: 'PUT',
      body: {
        provider: 'redpanda',
        brokers: ['127.0.0.1:19092'],
      },
    });
    expect(redpanda.status).toBe(200);
    expect((redpanda.body as { provider: string }).provider).toBe('redpanda');
  });

  it('handles a signed federation sync end to end', async () => {
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
        cursor: 99,
        merkleRootHash,
        signature,
      },
    });

    expect(sync.status).toBe(202);
    expect((sync.body as { accepted: boolean }).accepted).toBe(true);

    const state = await harness.request('trustNode', `/v1/federation/state/${peerNodeId}`, { method: 'GET' });
    expect(state.status).toBe(200);
    expect((state.body as { nodeId: string; syncCursor: number }).nodeId).toBe(peerNodeId);
    expect((state.body as { syncCursor: number }).syncCursor).toBe(99);

    const pending = await harness.request('trustNode', '/v1/federation/pending', { method: 'GET' });
    expect(pending.status).toBe(200);
    expect(Array.isArray(pending.body)).toBe(true);
  });
});
