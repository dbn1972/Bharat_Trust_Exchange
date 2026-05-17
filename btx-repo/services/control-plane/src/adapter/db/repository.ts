import { Pool } from 'pg';
import { Consent, ConsentStatus, ConsentGrant, AuditEvent, AuditEventType, OutboxEvent } from '../../domain/consent';

/**
 * ConsentsRepository: Data access layer for consent lifecycle
 */
export class ConsentsRepository {
  constructor(private pool: Pool) {}

  async create(grant: ConsentGrant): Promise<Consent> {
    const result = await this.pool.query(
      `INSERT INTO consents 
       (from_node_id, to_node_id, subject_ref, purpose, status, obligations, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, from_node_id, to_node_id, subject_ref, purpose, status, obligations, 
                 created_at, updated_at, revoked_at, expires_at`,
      [
        grant.fromNodeId,
        grant.toNodeId,
        grant.subjectRef,
        grant.purpose,
        ConsentStatus.PENDING,
        JSON.stringify(grant.obligations || {}),
        grant.expiresAt || null
      ]
    );
    return this.mapToConsent(result.rows[0]);
  }

  async getById(consentId: string): Promise<Consent | null> {
    const result = await this.pool.query(
      'SELECT * FROM consents WHERE id = $1',
      [consentId]
    );
    return result.rows.length > 0 ? this.mapToConsent(result.rows[0]) : null;
  }

  async updateStatus(consentId: string, status: ConsentStatus, revokedAt?: Date): Promise<Consent> {
    const result = await this.pool.query(
      `UPDATE consents 
       SET status = $2, updated_at = NOW(), revoked_at = $3
       WHERE id = $1
       RETURNING *`,
      [consentId, status, revokedAt || null]
    );
    return this.mapToConsent(result.rows[0]);
  }

  async listByFromNode(nodeId: string): Promise<Consent[]> {
    const result = await this.pool.query(
      'SELECT * FROM consents WHERE from_node_id = $1 ORDER BY created_at DESC',
      [nodeId]
    );
    return result.rows.map(r => this.mapToConsent(r));
  }

  async listByToNode(nodeId: string): Promise<Consent[]> {
    const result = await this.pool.query(
      'SELECT * FROM consents WHERE to_node_id = $1 ORDER BY created_at DESC',
      [nodeId]
    );
    return result.rows.map(r => this.mapToConsent(r));
  }

  private mapToConsent(row: any): Consent {
    return {
      id: row.id,
      fromNodeId: row.from_node_id,
      toNodeId: row.to_node_id,
      subjectRef: row.subject_ref,
      purpose: row.purpose,
      status: row.status as ConsentStatus,
      obligations: row.obligations || {},
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
      revokedAt: row.revoked_at ? new Date(row.revoked_at) : undefined,
      expiresAt: row.expires_at ? new Date(row.expires_at) : undefined
    };
  }
}

/**
 * AuditRepository: Append-only audit event persistence
 */
export class AuditRepository {
  constructor(private pool: Pool) {}

  /**
   * Append audit event and outbox row in same transaction (ADR-0021)
   */
  async appendInTransaction(
    auditEvent: Omit<AuditEvent, 'id' | 'createdAt'>,
    outboxEvent: Omit<OutboxEvent, 'id' | 'createdAt'>
  ): Promise<{ auditId: bigint; outboxId: bigint }> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Insert audit event
      const auditResult = await client.query(
        `INSERT INTO audit_events 
         (consent_id, event_type, actor_node_id, subject_ref, details)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [
          auditEvent.consentId || null,
          auditEvent.eventType,
          auditEvent.actorNodeId,
          auditEvent.subjectRef || null,
          JSON.stringify(auditEvent.details)
        ]
      );
      const auditId = auditResult.rows[0].id;

      // Insert outbox event
      const outboxResult = await client.query(
        `INSERT INTO outbox (event_type, aggregate_id, payload)
         VALUES ($1, $2, $3)
         RETURNING id`,
        [
          outboxEvent.eventType,
          outboxEvent.aggregateId,
          JSON.stringify(outboxEvent.payload)
        ]
      );
      const outboxId = outboxResult.rows[0].id;

      await client.query('COMMIT');
      return { auditId, outboxId };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getById(auditId: bigint): Promise<AuditEvent | null> {
    const result = await this.pool.query(
      'SELECT * FROM audit_events WHERE id = $1',
      [auditId]
    );
    return result.rows.length > 0 ? this.mapToAuditEvent(result.rows[0]) : null;
  }

  async listByConsent(consentId: string): Promise<AuditEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM audit_events WHERE consent_id = $1 ORDER BY id DESC',
      [consentId]
    );
    return result.rows.map(r => this.mapToAuditEvent(r));
  }

  async getMerkleRoot(day: Date): Promise<{ rootHash: string; signature: string } | null> {
    const result = await this.pool.query(
      'SELECT root_hash, signature FROM merkle_roots WHERE day = $1',
      [day]
    );
    return result.rows.length > 0
      ? { rootHash: result.rows[0].root_hash, signature: result.rows[0].signature }
      : null;
  }

  private mapToAuditEvent(row: any): AuditEvent {
    return {
      id: BigInt(row.id),
      consentId: row.consent_id,
      eventType: row.event_type as AuditEventType,
      actorNodeId: row.actor_node_id,
      subjectRef: row.subject_ref,
      details: row.details || {},
      merkleIndex: row.merkle_index ? BigInt(row.merkle_index) : undefined,
      createdAt: new Date(row.created_at)
    };
  }
}

/**
 * OutboxRepository: Transactional outbox for Kafka publishing
 */
export class OutboxRepository {
  constructor(private pool: Pool) {}

  async getPending(limit: number = 100): Promise<OutboxEvent[]> {
    const result = await this.pool.query(
      'SELECT * FROM outbox WHERE published_at IS NULL ORDER BY created_at ASC LIMIT $1',
      [limit]
    );
    return result.rows.map(r => this.mapToOutboxEvent(r));
  }

  async markPublished(outboxId: bigint): Promise<void> {
    await this.pool.query(
      'UPDATE outbox SET published_at = NOW() WHERE id = $1',
      [outboxId]
    );
  }

  async markFailed(outboxId: bigint, error: string): Promise<void> {
    await this.pool.query(
      'UPDATE outbox SET payload = jsonb_set(payload, \'{_error}\', $2) WHERE id = $1',
      [outboxId, JSON.stringify(error)]
    );
  }

  private mapToOutboxEvent(row: any): OutboxEvent {
    return {
      id: BigInt(row.id),
      eventType: row.event_type,
      aggregateId: row.aggregate_id,
      payload: row.payload || {},
      publishedAt: row.published_at ? new Date(row.published_at) : undefined,
      createdAt: new Date(row.created_at)
    };
  }
}
