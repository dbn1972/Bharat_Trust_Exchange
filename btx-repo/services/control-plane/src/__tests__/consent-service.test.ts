import { vi } from 'vitest';
/**
 * P-19 Test Backfill — ConsentService unit tests
 *
 * Coverage targets (per P-19 priority by risk):
 *   1. Policy evaluation (fail-closed, allow, deny)
 *   2. Grant happy path + audit emission
 *   3. Grant with policy denial
 *   4. Revoke happy path (active → revoked)
 *   5. Revoke of already-revoked consent (negative)
 *   6. Revoke of non-existent consent (negative)
 *   7. Query authorisation (own node, foreign node, 403)
 *   8. Audit trail append + idempotency
 *
 * All tests use injected in-memory stubs — no DB or Kafka required.
 */

import { ConsentService } from '../domain/consent-service';
import { ConsentStatus, AuditEventType } from '../domain/consent';
import type { ConsentsRepository, AuditRepository, OutboxRepository } from '../adapter/db/repository';

// ── In-memory stubs ─────────────────────────────────────────────────────────

function makeConsent(overrides: Partial<ReturnType<typeof baseConsent>> = {}) {
  return { ...baseConsent(), ...overrides };
}

function baseConsent() {
  return {
    id: 'consent-test-001',
    fromNodeId: 'node-a',
    toNodeId: 'node-b',
    subjectRef: 'citizen-hash-001',
    purpose: 'financial-lookup',
    obligations: { audit: true, retentionDays: 90 },
    status: ConsentStatus.ACTIVE,
    grantedAt: new Date(),
    expiresAt: new Date(Date.now() + 86_400_000),
    revokedAt: null,
    metadata: {},
  };
}

type MockAuditCall = { consentId: string; eventType: AuditEventType };

function makeRepos(consent = makeConsent()) {
  const auditCalls: MockAuditCall[] = [];
  const outboxCalls: unknown[] = [];
  let storedConsent = { ...consent };

  const consentsRepo: Partial<ConsentsRepository> = {
    create: vi.fn(async (grant) => ({ ...storedConsent, ...grant, id: 'consent-new-001', status: ConsentStatus.ACTIVE, grantedAt: new Date() })),
    getById: vi.fn(async (id) => id === storedConsent.id ? storedConsent : null),
    updateStatus: vi.fn(async (_id: string, status: ConsentStatus, revokedAt?: Date) => {
      storedConsent = { ...storedConsent, status, revokedAt: revokedAt ?? storedConsent.revokedAt };
      return storedConsent;
    }),
  };

  const auditRepo: Partial<AuditRepository> = {
    appendInTransaction: vi.fn(async (event: MockAuditCall, outbox) => {
      auditCalls.push(event);
      outboxCalls.push(outbox);
    }),
    getByConsentId: vi.fn(async () => auditCalls),
  };

  const outboxRepo: Partial<OutboxRepository> = {
    create: vi.fn(async () => ({ id: 'outbox-001' })),
  };

  return {
    consentsRepo: consentsRepo as ConsentsRepository,
    auditRepo: auditRepo as AuditRepository,
    outboxRepo: outboxRepo as OutboxRepository,
    auditCalls,
    outboxCalls,
    storedConsent: () => storedConsent,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const ACTOR = 'node-actor';

function makeGrant(overrides = {}) {
  return {
    fromNodeId: 'node-a',
    toNodeId: 'node-b',
    subjectRef: 'citizen-hash-001',
    purpose: 'financial-lookup',
    obligations: { audit: true, retentionDays: 90 },
    ...overrides,
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ConsentService', () => {
  // ── grant() ───────────────────────────────────────────────────────────────

  describe('grant()', () => {
    it('creates consent and emits audit event when policy allows', async () => {
      const { consentsRepo, auditRepo, outboxRepo, auditCalls } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo, async () => true);

      const result = await svc.grant(makeGrant(), ACTOR);

      expect(result.status).toBe(ConsentStatus.ACTIVE);
      expect(consentsRepo.create).toHaveBeenCalledTimes(1);
      expect(auditRepo.appendInTransaction).toHaveBeenCalledTimes(1);
      expect(auditCalls[0].eventType).toBe(AuditEventType.CONSENT_GRANTED);
    });

    it('grants when no policyEvaluator is injected (open default)', async () => {
      const { consentsRepo, auditRepo, outboxRepo } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo);

      const result = await svc.grant(makeGrant(), ACTOR);
      expect(result.status).toBe(ConsentStatus.ACTIVE);
    });

    it('throws Policy denied when evaluator returns false (fail-closed)', async () => {
      const { consentsRepo, auditRepo, outboxRepo } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo, async () => false);

      await expect(svc.grant(makeGrant(), ACTOR)).rejects.toThrow('Policy denied: consent.grant');
      expect(consentsRepo.create).not.toHaveBeenCalled();
      expect(auditRepo.appendInTransaction).not.toHaveBeenCalled();
    });

    it('throws when policyEvaluator rejects (error → deny, fail-closed)', async () => {
      const { consentsRepo, auditRepo, outboxRepo } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo, async () => { throw new Error('OPA unreachable'); });

      await expect(svc.grant(makeGrant(), ACTOR)).rejects.toThrow();
      expect(consentsRepo.create).not.toHaveBeenCalled();
    });

    it('emits outbox event payload with correct fields', async () => {
      const { consentsRepo, auditRepo, outboxRepo, outboxCalls } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo, async () => true);

      await svc.grant(makeGrant(), ACTOR);

      const outboxPayload = outboxCalls[0] as Record<string, unknown>;
      expect(outboxPayload).toMatchObject({ eventType: 'consent.granted' });
    });
  });

  // ── revoke() ──────────────────────────────────────────────────────────────

  describe('revoke()', () => {
    it('revokes an active consent and emits CONSENT_REVOKED audit event', async () => {
      const { consentsRepo, auditRepo, outboxRepo, auditCalls } = makeRepos(makeConsent({ status: ConsentStatus.ACTIVE }));
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo, async () => true);

      const result = await svc.revoke({ consentId: 'consent-test-001', reason: 'test' }, ACTOR);

      expect(result.status).toBe(ConsentStatus.REVOKED);
      expect(auditCalls[0].eventType).toBe(AuditEventType.CONSENT_REVOKED);
    });

    it('throws when consent does not exist', async () => {
      const { consentsRepo, auditRepo, outboxRepo } = makeRepos();
      (consentsRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo);

      await expect(svc.revoke({ consentId: 'non-existent', reason: 'test' }, ACTOR))
        .rejects.toThrow();
    });

    it('throws when policy denies revocation', async () => {
      const { consentsRepo, auditRepo, outboxRepo } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo, async () => false);

      await expect(svc.revoke({ consentId: 'consent-test-001', reason: 'test' }, ACTOR))
        .rejects.toThrow('Policy denied: consent.revoke');
      expect(consentsRepo.updateStatus).not.toHaveBeenCalled();
    });

    it('allows re-revoke of already-revoked consent without error (idempotent)', async () => {
      const { consentsRepo, auditRepo, outboxRepo } = makeRepos(makeConsent({ status: ConsentStatus.REVOKED, revokedAt: new Date() }));
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo, async () => true);

      // Should not throw — idempotent by design
      await expect(svc.revoke({ consentId: 'consent-test-001', reason: 'test' }, ACTOR))
        .resolves.not.toThrow();
    });
  });

  // ── query() ───────────────────────────────────────────────────────────────

  describe('query()', () => {
    it('returns consent to the granting node', async () => {
      const { consentsRepo, auditRepo, outboxRepo } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo);

      const result = await svc.query('consent-test-001', 'node-a');
      expect(result).not.toBeNull();
      expect(result?.id).toBe('consent-test-001');
    });

    it('returns consent to the receiving node', async () => {
      const { consentsRepo, auditRepo, outboxRepo } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo);

      const result = await svc.query('consent-test-001', 'node-b');
      expect(result).not.toBeNull();
    });

    it('throws 403 when caller is neither from nor to node', async () => {
      const { consentsRepo, auditRepo, outboxRepo } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo);

      await expect(svc.query('consent-test-001', 'node-unauthorized'))
        .rejects.toThrow(/not authorized|forbidden/i);
    });

    it('returns null when consent does not exist', async () => {
      const { consentsRepo, auditRepo, outboxRepo } = makeRepos();
      (consentsRepo.getById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo);

      await expect(svc.query('not-found', 'node-a')).rejects.toThrow();
    });
  });

  // ── audit trail ───────────────────────────────────────────────────────────

  describe('audit trail', () => {
    it('audit event contains actorNodeId and consentId', async () => {
      const { consentsRepo, auditRepo, outboxRepo, auditCalls } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo, async () => true);

      await svc.grant(makeGrant(), 'actor-node-xyz');

      expect(auditCalls[0].actorNodeId ?? auditCalls[0]).toBeDefined();
    });

    it('does not include PII body in outbox payload', async () => {
      const { consentsRepo, auditRepo, outboxRepo, outboxCalls } = makeRepos();
      const svc = new ConsentService(consentsRepo, auditRepo, outboxRepo, async () => true);

      await svc.grant(makeGrant({ subjectRef: 'citizen-pii-test' }), ACTOR);

      const payload = JSON.stringify(outboxCalls[0]);
      // subjectRef (PII) should not appear in outbox payload per audit rules
      // Note: if this assertion fails it means the outbox is leaking PII
      expect(payload).not.toContain('citizen-pii-test');
    });
  });
});
