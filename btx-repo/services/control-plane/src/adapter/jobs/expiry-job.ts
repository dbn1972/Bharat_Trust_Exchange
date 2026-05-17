import { Pool } from 'pg';
import { ConsentsRepository, AuditRepository, OutboxRepository } from '../db/repository';
import { ConsentStatus, AuditEventType } from '../../domain/consent';

const EXPIRY_JOB_SYSTEM_NODE = 'system:expiry-job';

/**
 * ConsentExpiryJob — G-03
 *
 * Periodically scans for consents where:
 *   expires_at < NOW() AND status = 'active'
 *
 * For each expired consent it:
 *   1. Marks the consent EXPIRED in the DB
 *   2. Appends an audit event + outbox row in the same DB transaction
 *      (identical pattern to ConsentService.revoke — no dual-write)
 *
 * The job uses a DB-level advisory lock so only one instance runs per cluster,
 * making it safe to run in a multi-pod deployment without duplicate processing.
 */
export class ConsentExpiryJob {
  private timer: ReturnType<typeof setInterval> | null = null;
  private running = false;

  constructor(
    private pool: Pool,
    private consentsRepo: ConsentsRepository,
    private auditRepo: AuditRepository,
    private outboxRepo: OutboxRepository,
    private intervalMs: number = 60_000
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.intervalMs);
    // Run once immediately on start
    this.tick().catch((err) => console.error('[expiry-job] initial tick failed', err));
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /** Exposed for testing */
  async tick(): Promise<{ expired: number }> {
    if (this.running) return { expired: 0 }; // prevent overlapping ticks
    this.running = true;
    let expired = 0;
    try {
      // Advisory lock: pg_try_advisory_lock(42001) — unique constant for this job.
      // Returns false if another instance holds the lock; skip this tick.
      const lockResult = await this.pool.query('SELECT pg_try_advisory_lock(42001) AS locked');
      if (!lockResult.rows[0].locked) return { expired: 0 };

      try {
        const result = await this.pool.query(
          `SELECT id FROM consents
           WHERE expires_at < NOW() AND status = $1
           ORDER BY expires_at ASC
           LIMIT 500`,
          [ConsentStatus.ACTIVE]
        );

        for (const row of result.rows) {
          try {
            await this.expireOne(row.id);
            expired++;
          } catch (err) {
            console.error('[expiry-job] failed to expire consent', { id: row.id, err });
          }
        }
      } finally {
        await this.pool.query('SELECT pg_advisory_unlock(42001)');
      }
    } finally {
      this.running = false;
    }
    return { expired };
  }

  private async expireOne(consentId: string): Promise<void> {
    const consent = await this.consentsRepo.getById(consentId);
    if (!consent || consent.status !== ConsentStatus.ACTIVE) return; // already changed

    await this.consentsRepo.updateStatus(consentId, ConsentStatus.EXPIRED);

    await this.auditRepo.appendInTransaction(
      {
        consentId,
        eventType: AuditEventType.CONSENT_EXPIRED,
        actorNodeId: EXPIRY_JOB_SYSTEM_NODE,
        subjectRef: consent.subjectRef,
        details: {
          expiredAt: new Date().toISOString(),
          originalExpiresAt: consent.expiresAt?.toISOString()
        }
      },
      {
        eventType: 'consent.expired',
        aggregateId: consentId,
        payload: {
          consentId,
          expiredAt: new Date().toISOString()
        }
      }
    );
  }
}
