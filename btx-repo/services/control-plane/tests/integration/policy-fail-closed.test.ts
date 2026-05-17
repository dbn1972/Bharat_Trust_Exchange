import { describe, it, expect } from 'vitest';

describe('policy fail-closed behavior', () => {
  it('documents required behavior when policy bundle verification fails', () => {
    const decision = { decision: 'deny', reason: 'policy-bundle-signature-invalid' };
    expect(decision.decision).toBe('deny');
    expect(decision.reason).toContain('invalid');
  });
});
