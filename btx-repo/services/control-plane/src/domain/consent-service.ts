import { Consent, ConsentGrant, ConsentRevoke, ConsentStatus, AuditEventType, AuditEvent, OutboxEvent } from '../domain/consent';
import { ConsentsRepository, AuditRepository, OutboxRepository } from '../adapter/db/repository';
import type { ObjectStoreAdapter } from '@btx/adapter-objectstore';
import crypto from 'crypto';

const AUDIT_ARCHIVE_BUCKET = process.env.AUDIT_ARCHIVE_BUCKET || 'btx-audit';

/**
 * ConsentService: Business logic for consent lifecycle
 * Implements policy evaluation, audit trail, and federation propagation
 */
export class ConsentService {
  constructor(
    private consentsRepo: ConsentsRepository,
    private auditRepo: AuditRepository,
    private outboxRepo: OutboxRepository,
    private policyEvaluator?: (ruleId: string, context: Record<string, unknown>) => Promise<boolean>,
    private objectStore?: ObjectStoreAdapter
  ) {}

  /** Archive a single audit event to object store (fire-and-forget; never fails the caller). */
  private archiveAuditEvent(
    consentId: string,
    eventType: string,
    payload: Record<string, unknown>
  ): void {
    if (!this.objectStore) return;
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const key = `${consentId}/${ts}-${eventType}.json`;
    const body = Buffer.from(JSON.stringify({ consentId, eventType, ts, payload }));
    this.objectStore
      .put(AUDIT_ARCHIVE_BUCKET, key, body, { contentType: 'application/json' })
      .catch((err: unknown) => {
        // Log but never propagate — archival must not affect consent state
        console.error('[consent-service] audit archive failed', { key, err });
      });
  }

  /**
   * Grant new consent with policy evaluation
   */
  async grant(grant: ConsentGrant, actorNodeId: string): Promise<Consent> {
    // Evaluate policy rule: consent.grant
    if (this.policyEvaluator) {
      const allowed = await this.policyEvaluator('consent.grant', {
        fromNodeId: grant.fromNodeId,
        toNodeId: grant.toNodeId,
        purpose: grant.purpose
      });
      if (!allowed) {
        throw new Error('Policy denied: consent.grant');
      }
    }

    // Create consent
    const consent = await this.consentsRepo.create(grant);

    // Emit audit event + outbox in same transaction
    await this.auditRepo.appendInTransaction(
      {
        consentId: consent.id,
        eventType: AuditEventType.CONSENT_GRANTED,
        actorNodeId,
        subjectRef: consent.subjectRef,
        details: {
          fromNodeId: grant.fromNodeId,
          toNodeId: grant.toNodeId,
          purpose: grant.purpose
        }
      },
      {
        eventType: 'consent.granted',
        aggregateId: consent.id,
        payload: {
          consentId: consent.id,
          fromNodeId: grant.fromNodeId,
          toNodeId: grant.toNodeId,
          subjectRef: grant.subjectRef,
          purpose: grant.purpose
        }
      }
    );

    this.archiveAuditEvent(consent.id, AuditEventType.CONSENT_GRANTED, {
      fromNodeId: grant.fromNodeId,
      toNodeId: grant.toNodeId,
      purpose: grant.purpose,
      actorNodeId
    });

    return consent;
  }

  /**
   * Revoke consent with cascade option for federation
   */
  async revoke(revoke: ConsentRevoke, actorNodeId: string): Promise<Consent> {
    // Evaluate policy rule: consent.revoke
    if (this.policyEvaluator) {
      const allowed = await this.policyEvaluator('consent.revoke', {
        consentId: revoke.consentId,
        reason: revoke.reason
      });
      if (!allowed) {
        throw new Error('Policy denied: consent.revoke');
      }
    }

    const consent = await this.consentsRepo.getById(revoke.consentId);
    if (!consent) {
      throw new Error(`Consent not found: ${revoke.consentId}`);
    }

    const now = new Date();
    const updated = await this.consentsRepo.updateStatus(revoke.consentId, ConsentStatus.REVOKED, now);

    // Emit audit event + outbox in same transaction
    await this.auditRepo.appendInTransaction(
      {
        consentId: revoke.consentId,
        eventType: AuditEventType.CONSENT_REVOKED,
        actorNodeId,
        subjectRef: consent.subjectRef,
        details: {
          reason: revoke.reason,
          cascadeToFederation: revoke.cascadeToFederation ?? false,
          revokedAt: now.toISOString()
        }
      },
      {
        eventType: 'consent.revoked',
        aggregateId: revoke.consentId,
        payload: {
          consentId: revoke.consentId,
          actorNodeId,
          reason: revoke.reason,
          cascade: revoke.cascadeToFederation ?? false,
          revokedAt: now.toISOString()
        }
      }
    );

    this.archiveAuditEvent(revoke.consentId, AuditEventType.CONSENT_REVOKED, {
      actorNodeId,
      reason: revoke.reason,
      cascade: revoke.cascadeToFederation ?? false,
      revokedAt: now.toISOString()
    });

    return updated;
  }

  /**
   * Query consent with authorization check
   */
  async query(consentId: string, requestorNodeId: string): Promise<Consent> {
    const consent = await this.consentsRepo.getById(consentId);
    if (!consent) {
      throw new Error(`Consent not found: ${consentId}`);
    }

    // Authorization: requestor must be from or to node
    if (consent.fromNodeId !== requestorNodeId && consent.toNodeId !== requestorNodeId) {
      throw new Error('Unauthorized: cannot query this consent');
    }

    // Emit audit event (query is not state-changing, so no outbox)
    await this.auditRepo.appendInTransaction(
      {
        consentId,
        eventType: AuditEventType.CONSENT_QUERIED,
        actorNodeId: requestorNodeId,
        details: { timestamp: new Date().toISOString() }
      },
      {
        eventType: 'consent.queried',
        aggregateId: consentId,
        payload: {
          consentId,
          queriedBy: requestorNodeId,
          timestamp: new Date().toISOString()
        }
      }
    );

    return consent;
  }

  /**
   * Get audit trail for a consent
   */
  async getAuditTrail(consentId: string): Promise<AuditEvent[]> {
    return this.auditRepo.listByConsent(consentId);
  }

  /**
   * Compute daily Merkle root for audit chain commitment
   */
  async computeDailyMerkleRoot(day: Date): Promise<string> {
    const dayStart = new Date(day);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

    // Get all audit events for the day
    const result = await (this as any).auditRepo.pool.query(
      `SELECT id FROM audit_events 
       WHERE created_at >= $1 AND created_at < $2
       ORDER BY id ASC`,
      [dayStart, dayEnd]
    );

    // Compute Merkle tree
    const hashes = result.rows.map((row: any) => {
      return crypto.createHash('sha256').update(row.id.toString()).digest('hex');
    });

    let nodes = hashes;
    while (nodes.length > 1) {
      const nextLevel = [];
      for (let i = 0; i < nodes.length; i += 2) {
        const left = nodes[i];
        const right = nodes[i + 1] || nodes[i];
        const parent = crypto.createHash('sha256').update(left + right).digest('hex');
        nextLevel.push(parent);
      }
      nodes = nextLevel;
    }

    return nodes.length > 0 ? nodes[0] : crypto.createHash('sha256').update('').digest('hex');
  }
}
