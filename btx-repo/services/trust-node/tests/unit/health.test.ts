import { describe, it, expect } from 'vitest';
import app from '../../src/server.js';

describe('trust-node health', () => {
  it('returns healthy response', async () => {
    const res = await app.inject({ method: 'GET', url: '/healthz' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ ok: true, service: 'trust-node' });
  });
});
