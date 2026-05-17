import { vi } from 'vitest';
/**
 * Unit tests: RegistryRepository (services/registry)
 *
 * All DB calls are mocked via vi.fn() so no real Postgres is needed.
 */

import { RegistryRepository } from '../adapter/db/repository';
import type { Pool } from 'pg';

// ---------- mock pool factory ----------
const mockQuery = vi.fn();
const mockPool = { query: mockQuery } as unknown as Pool;

// ---------- helpers ----------
const nodeRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'internal-uuid-001',
  node_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: 'Node Alpha',
  endpoint_url: 'https://alpha.btx.example',
  public_key_pem: '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----',
  api_version: 'v1',
  status: 'active',
  capabilities: ['federation', 'consent'],
  metadata: { region: 'in-south' },
  last_seen_at: null,
  created_at: new Date('2026-05-01T00:00:00Z'),
  updated_at: new Date('2026-05-01T00:00:00Z'),
  ...overrides,
});

describe('RegistryRepository', () => {
  let repo: RegistryRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new RegistryRepository(mockPool);
  });

  // ------------------------------------------------------------------
  describe('register()', () => {
    it('inserts a new node and returns the mapped TrustNode', async () => {
      const row = nodeRow();
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await repo.register({
        nodeId: row.node_id,
        name: row.name,
        endpointUrl: row.endpoint_url,
        publicKeyPem: row.public_key_pem,
        apiVersion: 'v1',
        capabilities: ['federation', 'consent'],
        metadata: { region: 'in-south' },
      });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/INSERT INTO trust_nodes/i);
      expect(params).toContain('v1'); // apiVersion column (G-05)
      expect(result.nodeId).toBe(row.node_id);
      expect(result.apiVersion).toBe('v1');
      expect(result.status).toBe('active');
    });

    it('upserts on conflict — sql contains ON CONFLICT DO UPDATE', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [nodeRow()] });
      await repo.register({ nodeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'Node Alpha', endpointUrl: 'https://alpha.btx.example', publicKeyPem: 'KEY' });
      const [sql] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/ON CONFLICT.*DO UPDATE/is);
    });

    it('defaults apiVersion to v1 when not provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [nodeRow()] });
      await repo.register({ nodeId: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', name: 'N', endpointUrl: 'https://n.example', publicKeyPem: 'K' });
      const [, params] = mockQuery.mock.calls[0];
      expect(params).toContain('v1');
    });
  });

  // ------------------------------------------------------------------
  describe('getById()', () => {
    it('returns a TrustNode when the row exists', async () => {
      const row = nodeRow();
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await repo.getById(row.node_id);

      expect(result).not.toBeNull();
      expect(result!.nodeId).toBe(row.node_id);
      expect(result!.name).toBe(row.name);
      expect(result!.apiVersion).toBe('v1');
    });

    it('returns null when the node does not exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      const result = await repo.getById('00000000-0000-0000-0000-000000000000');
      expect(result).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  describe('list()', () => {
    it('returns all active nodes', async () => {
      const rows = [nodeRow(), nodeRow({ node_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', name: 'Node Beta' })];
      mockQuery.mockResolvedValueOnce({ rows });

      const result = await repo.list('active', 100);

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('active');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(params).toContain('active');
    });

    it('respects the limit parameter', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.list('active', 5);
      const [, params] = mockQuery.mock.calls[0];
      expect(params).toContain(5);
    });
  });

  // ------------------------------------------------------------------
  describe('updateLastSeen()', () => {
    it('issues an UPDATE statement with the nodeId', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });
      await repo.updateLastSeen('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/UPDATE trust_nodes/i);
      expect(params[0]).toBe('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
    });
  });

  // ------------------------------------------------------------------
  describe('setStatus()', () => {
    it('issues an UPDATE and returns mapped node', async () => {
      const row = nodeRow({ status: 'inactive' });
      mockQuery.mockResolvedValueOnce({ rows: [row] });

      const result = await repo.setStatus('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'inactive');

      expect(result.status).toBe('inactive');
      const [sql, params] = mockQuery.mock.calls[0];
      expect(sql).toMatch(/UPDATE trust_nodes/i);
      expect(params).toContain('inactive');
    });
  });
});
