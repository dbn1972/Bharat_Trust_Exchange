import { Pool } from 'pg';
import { TrustNode, TrustNodeRegistration } from '../domain/trust-node';

/**
 * RegistryRepository: Data access layer for trust node directory
 */
export class RegistryRepository {
  constructor(private pool: Pool) {}

  async register(registration: TrustNodeRegistration): Promise<TrustNode> {
    const result = await this.pool.query(
      `INSERT INTO trust_nodes 
       (node_id, name, endpoint_url, public_key_pem, api_version, capabilities, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (node_id) DO UPDATE SET
         name = EXCLUDED.name,
         endpoint_url = EXCLUDED.endpoint_url,
         public_key_pem = EXCLUDED.public_key_pem,
         api_version = EXCLUDED.api_version,
         capabilities = EXCLUDED.capabilities,
         metadata = EXCLUDED.metadata,
         updated_at = NOW()
       RETURNING *`,
      [
        registration.nodeId,
        registration.name,
        registration.endpointUrl,
        registration.publicKeyPem,
        registration.apiVersion || 'v1',
        JSON.stringify(registration.capabilities || []),
        JSON.stringify(registration.metadata || {})
      ]
    );
    return this.mapToTrustNode(result.rows[0]);
  }

  async getById(nodeId: string): Promise<TrustNode | null> {
    const result = await this.pool.query(
      'SELECT * FROM trust_nodes WHERE node_id = $1',
      [nodeId]
    );
    return result.rows.length > 0 ? this.mapToTrustNode(result.rows[0]) : null;
  }

  async list(status: string = 'active', limit: number = 100): Promise<TrustNode[]> {
    const result = await this.pool.query(
      `SELECT * FROM trust_nodes 
       WHERE status = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [status, limit]
    );
    return result.rows.map(r => this.mapToTrustNode(r));
  }

  async updateLastSeen(nodeId: string): Promise<void> {
    await this.pool.query(
      'UPDATE trust_nodes SET last_seen_at = NOW() WHERE node_id = $1',
      [nodeId]
    );
  }

  async setStatus(nodeId: string, status: string): Promise<TrustNode> {
    const result = await this.pool.query(
      'UPDATE trust_nodes SET status = $2, updated_at = NOW() WHERE node_id = $1 RETURNING *',
      [nodeId, status]
    );
    return this.mapToTrustNode(result.rows[0]);
  }

  private mapToTrustNode(row: any): TrustNode {
    return {
      id: row.id,
      nodeId: row.node_id,
      name: row.name,
      endpointUrl: row.endpoint_url,
      publicKeyPem: row.public_key_pem,
      apiVersion: row.api_version || 'v1',
      status: row.status,
      metadata: row.metadata || {},
      capabilities: row.capabilities || [],
      lastSeenAt: row.last_seen_at ? new Date(row.last_seen_at) : undefined,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at)
    };
  }
}
