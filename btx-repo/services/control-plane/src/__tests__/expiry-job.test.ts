/**
 * Unit tests: ConsentExpiryJob (services/control-plane)
 */

import { ConsentExpiryJob } from '../adapter/jobs/expiry-job';
import { ConsentStatus, AuditEventType } from '../domain/consent';
import type { Pool } from 'pg';

// ---------- mocks ----------
const mockQuery = jest.fn();
const mockPool = { query: mockQuery } as unknown as Pool;

const mockConsentsRepo = { getById: jest.fn(), updateStatus: jest.fn() } as any;
const mockAuditRepo = { appendInTransaction: jest.fn() } as any;
const mockOutboxRepo = {} as any;

const makeConsent = (id: string) => ({
  id,
  fromNodeId: 'node-a',
  toNodeId: 'node-b',
  subjectRef: 'citizen-1',
  purpose: 'test',
  status: ConsentStatus.ACTIVE,
  expiresAt: new Date('2026-01-01'),
  obligations: {},
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('ConsentExpiryJob', () => {
  let job: ConsentExpiryJob;

  beforeEach(() => {
    jest.clearAllMocks();
    job = new ConsentExpiryJob(mockPool, mockConsentsRepo, mockAuditRepo, mockOutboxRepo, 60_000);
  });

  it('expires active consents past their expiry date', async () => {
    // Advisory lock → acquired
    mockQuery
      .mockResolvedValueOnce({ rows: [{ locked: true }] })       // pg_try_advisory_lock
      .mockResolvedValueOnce({ rows: [{ id: 'consent-001' }, { id: 'consent-002' }] }) // SELECT expired
      .mockResolvedValueOnce({ rows: [] }); // pg_advisory_unlock

    mockConsentsRepo.getById.mockImplementation((id: string) => Promise.resolve(makeConsent(id)));
    mockConsentsRepo.updateStatus.mockResolvedValue({});
    mockAuditRepo.appendInTransaction.mockResolvedValue(undefined);

    const result = await job.tick();

    expect(result.expired).toBe(2);
    expect(mockConsentsRepo.updateStatus).toHaveBeenCalledTimes(2);
    expect(mockConsentsRepo.updateStatus).toHaveBeenCalledWith('consent-001', ConsentStatus.EXPIRED);
    expect(mockConsentsRepo.updateStatus).toHaveBeenCalledWith('consent-002', ConsentStatus.EXPIRED);
    expect(mockAuditRepo.appendInTransaction).toHaveBeenCalledTimes(2);
    const auditCall = mockAuditRepo.appendInTransaction.mock.calls[0][0];
    expect(auditCall.eventType).toBe(AuditEventType.CONSENT_EXPIRED);
    expect(auditCall.actorNodeId).toBe('system:expiry-job');
  });

  it('skips the tick when advisory lock is not acquired', async () => {
    mockQuery.mockResolvedValueOnce({ rows: [{ locked: false }] });

    const result = await job.tick();

    expect(result.expired).toBe(0);
    expect(mockConsentsRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('does nothing when there are no expired consents', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] }); // unlock

    const result = await job.tick();
    expect(result.expired).toBe(0);
  });

  it('skips a consent that is no longer active (race condition guard)', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 'consent-revoked' }] })
      .mockResolvedValueOnce({ rows: [] });

    const revokedConsent = { ...makeConsent('consent-revoked'), status: ConsentStatus.REVOKED };
    mockConsentsRepo.getById.mockResolvedValue(revokedConsent);

    const result = await job.tick();

    expect(result.expired).toBe(0);
    expect(mockConsentsRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('continues to next consent if one fails to expire', async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [{ id: 'c1' }, { id: 'c2' }] })
      .mockResolvedValueOnce({ rows: [] });

    mockConsentsRepo.getById
      .mockResolvedValueOnce(makeConsent('c1'))
      .mockResolvedValueOnce(makeConsent('c2'));
    mockConsentsRepo.updateStatus
      .mockRejectedValueOnce(new Error('DB error'))
      .mockResolvedValueOnce({});
    mockAuditRepo.appendInTransaction.mockResolvedValue(undefined);

    const result = await job.tick();
    // c1 failed, c2 succeeded
    expect(result.expired).toBe(1);
  });

  it('prevents overlapping ticks via running flag', async () => {
    // Simulate a tick that is already in progress by calling tick() twice concurrently
    mockQuery
      .mockResolvedValueOnce({ rows: [{ locked: true }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });

    const [r1, r2] = await Promise.all([job.tick(), job.tick()]);
    // One of them should have been skipped (running guard)
    expect(r1.expired + r2.expired).toBe(0); // both found 0 expired rows
    // Only one lock acquisition should have happened
    const lockCalls = mockQuery.mock.calls.filter(([sql]) => String(sql).includes('advisory_lock'));
    expect(lockCalls.length).toBeLessThanOrEqual(1);
  });
});
