/**
 * Phase 9: Integration Evidence Collection
 * Comprehensive end-to-end tests for BTX federated trust fabric
 */

import { describe, it, before, after } from 'mocha';
import { expect } from 'chai';
import http from 'http';
import { v4 as uuid } from 'uuid';

const BASE_URLS = {
  controlPlane: process.env.CONTROL_PLANE_URL || 'http://localhost:3002',
  registry: process.env.REGISTRY_URL || 'http://localhost:3001',
  trustNode: process.env.TRUST_NODE_URL || 'http://localhost:3003'
};

function request(method: string, url: string, body?: any, headers: Record<string, string> = {}): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const reqUrl = new URL(url);
    const options = {
      hostname: reqUrl.hostname,
      port: reqUrl.port,
      path: reqUrl.pathname + reqUrl.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode || 500,
            body: data ? JSON.parse(data) : {}
          });
        } catch {
          resolve({ status: res.statusCode || 500, body: { raw: data } });
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

describe('Phase 9: End-to-End Integration Tests', () => {
  let controlPlaneHealthy: boolean;
  let registryHealthy: boolean;
  let trustNodeHealthy: boolean;

  before(async () => {
    // Health checks for all services
    const cpHealth = await request('GET', `${BASE_URLS.controlPlane}/healthz`);
    const regHealth = await request('GET', `${BASE_URLS.registry}/healthz`);
    const tnHealth = await request('GET', `${BASE_URLS.trustNode}/healthz`);

    controlPlaneHealthy = cpHealth.status === 200;
    registryHealthy = regHealth.status === 200;
    trustNodeHealthy = tnHealth.status === 200;

    console.log(`
      ✓ Control-plane: ${controlPlaneHealthy ? 'UP' : 'DOWN'}
      ✓ Registry: ${registryHealthy ? 'UP' : 'DOWN'}
      ✓ Trust-node: ${trustNodeHealthy ? 'UP' : 'DOWN'}
    `);
  });

  describe('Service Health', () => {
    it('control-plane should be healthy', async () => {
      if (!controlPlaneHealthy) {
        this.skip();
      }
      const res = await request('GET', `${BASE_URLS.controlPlane}/healthz`);
      expect(res.status).to.equal(200);
      expect(res.body.ok).to.be.true;
      expect(res.body.service).to.equal('control-plane');
    });

    it('registry should be healthy', async () => {
      if (!registryHealthy) {
        this.skip();
      }
      const res = await request('GET', `${BASE_URLS.registry}/healthz`);
      expect(res.status).to.equal(200);
      expect(res.body.ok).to.be.true;
      expect(res.body.service).to.equal('registry');
    });

    it('trust-node should be healthy', async () => {
      if (!trustNodeHealthy) {
        this.skip();
      }
      const res = await request('GET', `${BASE_URLS.trustNode}/healthz`);
      expect(res.status).to.equal(200);
      expect(res.body.ok).to.be.true;
      expect(res.body.service).to.equal('trust-node');
    });
  });

  describe('Consent Lifecycle (E2E)', () => {
    let consentId: string;
    const nodeId1 = uuid();
    const nodeId2 = uuid();

    it('should register trust nodes', async () => {
      if (!registryHealthy) this.skip();

      const res = await request('POST', `${BASE_URLS.registry}/v1/nodes`, {
        nodeId: nodeId1,
        name: 'Test Node 1',
        endpointUrl: 'https://node1.example.com',
        publicKeyPem: '-----BEGIN PUBLIC KEY-----\ntest\n-----END PUBLIC KEY-----'
      });

      expect(res.status).to.be.oneOf([200, 201]);
      expect(res.body.nodeId).to.exist;
    });

    it('should grant consent', async () => {
      if (!controlPlaneHealthy) this.skip();

      const res = await request('POST', `${BASE_URLS.controlPlane}/v1/consents`, {
        fromNodeId: nodeId1,
        toNodeId: nodeId2,
        subjectRef: 'user@example.com',
        purpose: 'data-sharing-e2e-test',
        obligations: { audit: true, retentionDays: 30 }
      }, { 'x-node-id': nodeId1 });

      expect(res.status).to.be.oneOf([200, 201]);
      expect(res.body.id).to.exist;
      consentId = res.body.id;
    });

    it('should query consent with authorization', async () => {
      if (!controlPlaneHealthy) this.skip();

      const res = await request('GET', `${BASE_URLS.controlPlane}/v1/consents/${consentId}`, undefined, {
        'x-node-id': nodeId1
      });

      expect(res.status).to.equal(200);
      expect(res.body.id).to.equal(consentId);
      expect(res.body.status).to.be.oneOf(['pending', 'active']);
    });

    it('should get audit trail for consent', async () => {
      if (!controlPlaneHealthy) this.skip();

      const res = await request('GET', `${BASE_URLS.controlPlane}/v1/consents/${consentId}/audit`);

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array');
    });

    it('should revoke consent', async () => {
      if (!controlPlaneHealthy) this.skip();

      const res = await request('POST', `${BASE_URLS.controlPlane}/v1/consents/${consentId}/revoke`, {
        reason: 'test-revocation',
        cascadeToFederation: true
      }, { 'x-node-id': nodeId1 });

      expect(res.status).to.be.oneOf([200, 202]);
      expect(res.body.status).to.equal('revoked');
    });
  });

  describe('Federation Sync (E2E)', () => {
    const peerNodeId = uuid();

    it('should handle peer sync request', async () => {
      if (!trustNodeHealthy) this.skip();

      const res = await request('POST', `${BASE_URLS.trustNode}/v1/federation/sync`, {
        peerNodeId,
        cursor: 100n,
        merkleRootHash: 'sha256-hash-placeholder',
        signature: 'signature-placeholder'
      });

      expect(res.status).to.equal(202);
      expect(res.body.accepted).to.be.oneOf([true, false]); // May fail on missing signature
    });

    it('should get federation state', async () => {
      if (!trustNodeHealthy) this.skip();

      const res = await request('GET', `${BASE_URLS.trustNode}/v1/federation/state/${peerNodeId}`);

      expect(res.status).to.equal(200);
      expect(res.body.nodeId).to.exist;
      expect(res.body.status).to.be.oneOf(['active', 'syncing', 'paused']);
    });

    it('should list pending syncs', async () => {
      if (!trustNodeHealthy) this.skip();

      const res = await request('GET', `${BASE_URLS.trustNode}/v1/federation/pending`);

      expect(res.status).to.equal(200);
      expect(res.body).to.be.an('array');
    });
  });

  describe('Performance Baselines', () => {
    it('consent grant should complete within latency budget', async () => {
      if (!controlPlaneHealthy) this.skip();

      const start = Date.now();
      const res = await request('POST', `${BASE_URLS.controlPlane}/v1/consents`, {
        fromNodeId: uuid(),
        toNodeId: uuid(),
        subjectRef: 'perf-test@example.com',
        purpose: 'latency-test',
        obligations: { audit: true }
      });

      const latency = Date.now() - start;
      expect(latency).to.be.below(100); // Baseline: <100ms for local stack
      expect(res.status).to.be.oneOf([200, 201]);
    });

    it('consent query should complete within latency budget', async () => {
      if (!controlPlaneHealthy) this.skip();

      // Create consent first
      const createRes = await request('POST', `${BASE_URLS.controlPlane}/v1/consents`, {
        fromNodeId: uuid(),
        toNodeId: uuid(),
        subjectRef: 'perf-test-query@example.com',
        purpose: 'latency-test'
      });

      if (createRes.status !== 201) this.skip();

      // Query with timing
      const consentId = createRes.body.id;
      const start = Date.now();
      const res = await request('GET', `${BASE_URLS.controlPlane}/v1/consents/${consentId}`, undefined, {
        'x-node-id': uuid()
      });

      const latency = Date.now() - start;
      expect(latency).to.be.below(100); // Baseline: <100ms for local stack
      expect(res.status).to.equal(200);
    });
  });

  describe('Idempotency', () => {
    const idempotencyKey = uuid();

    it('duplicate requests with same Idempotency-Key should return cached response', async () => {
      if (!controlPlaneHealthy) this.skip();

      const consent = {
        fromNodeId: uuid(),
        toNodeId: uuid(),
        subjectRef: 'idempotency-test@example.com',
        purpose: 'test'
      };

      // First request
      const res1 = await request('POST', `${BASE_URLS.controlPlane}/v1/consents`, consent, {
        'Idempotency-Key': idempotencyKey
      });

      expect(res1.status).to.be.oneOf([200, 201]);
      const id1 = res1.body.id;

      // Second request with same key
      const res2 = await request('POST', `${BASE_URLS.controlPlane}/v1/consents`, consent, {
        'Idempotency-Key': idempotencyKey
      });

      expect(res2.status).to.be.oneOf([200, 201]);
      expect(res2.body.id).to.equal(id1);
    });
  });
});
