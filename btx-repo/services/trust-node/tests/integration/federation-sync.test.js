import { describe, it, expect } from 'vitest';
import app from '../../src/server.js';
describe('trust-node federation sync', () => {
    it('accepts sync requests', async () => {
        const res = await app.inject({
            method: 'POST',
            url: '/v1/federation/sync',
            payload: { peerNodeId: 'node-a', cursor: '0' }
        });
        expect(res.statusCode).toBe(202);
        expect(res.json()).toEqual({ accepted: true });
    });
});
//# sourceMappingURL=federation-sync.test.js.map