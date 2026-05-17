import { Pool } from 'pg';
import { ConsentsRepository, AuditRepository, OutboxRepository } from '../db/repository';
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
export declare class ConsentExpiryJob {
    private pool;
    private consentsRepo;
    private auditRepo;
    private outboxRepo;
    private intervalMs;
    private timer;
    private running;
    constructor(pool: Pool, consentsRepo: ConsentsRepository, auditRepo: AuditRepository, outboxRepo: OutboxRepository, intervalMs?: number);
    start(): void;
    stop(): void;
    /** Exposed for testing */
    tick(): Promise<{
        expired: number;
    }>;
    private expireOne;
}
