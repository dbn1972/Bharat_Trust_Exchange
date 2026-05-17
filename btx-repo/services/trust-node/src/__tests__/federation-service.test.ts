/**
 * Unit tests: FederationService (services/trust-node)
 *
 * All DB calls are mocked via jest.fn() so no real Postgres is needed.
 * kmsVerify is injected as a jest mock for full control over signature outcomes.
 */

import { FederationService } from '../domain/federation-service';
import { FederationRepository } from '../adapter/db/repository';

// ---------- mock repository ----------
const mockRepo = {
  recordPeerSync: jest.fn(),
  markPeerSyncFailed: jest.fn(),
  markPeerSyncVerified: jest.fn(),
  updateSyncCursor: jest.fn(),
  getState: jest.fn(),
  getPendingSyncs: jest.fn(),
  initializeFederationState: jest.fn(),
} as unknown as FederationRepository;

const mockKmsVerify = jest.fn<Promise<boolean>, [string, string, string]>();

// ---------- fixtures ----------
const baseSyncRequest = {
  peerNodeId: 'cccccccc-cccc-cccc-cccc-cccccccccccc',
  cursor: 42,
  merkleRootHash: 'abc123hash',
  signature: 'c2lnbmF0dXJl', // base64 "signature"
};

const baseSyncEvent = {
  id: 1,
  peerNodeId: baseSyncRequest.peerNodeId,
  cursor: 42,
  status: 'pending',
  createdAt: new Date(),
};

describe('FederationService', () => {
  let service: FederationService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRepo.recordPeerSync = jest.fn().mockResolvedValue(baseSyncEvent);
    mockRepo.markPeerSyncFailed = jest.fn().mockResolvedValue(undefined);
    mockRepo.markPeerSyncVerified = jest.fn().mockResolvedValue(undefined);
    mockRepo.updateSyncCursor = jest.fn().mockResolvedValue(undefined);
    service = new FederationService(mockRepo, mockKmsVerify);
  });

  // ------------------------------------------------------------------
  describe('syncFromPeer()', () => {
    it('records sync and updates cursor when no signature is provided', async () => {
      const request = { peerNodeId: baseSyncRequest.peerNodeId, cursor: 42 };
      const result = await service.syncFromPeer(request);

      expect(mockRepo.recordPeerSync).toHaveBeenCalledWith(request);
      expect(mockRepo.updateSyncCursor).toHaveBeenCalledWith(baseSyncRequest.peerNodeId, 42);
      expect(mockRepo.markPeerSyncVerified).toHaveBeenCalledWith(1);
      expect(result.status).toBe('verified');
    });

    it('verifies signature via injected kmsVerify when signature + publicKey provided', async () => {
      mockKmsVerify.mockResolvedValueOnce(true);

      const result = await service.syncFromPeer(baseSyncRequest, '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----');

      expect(mockKmsVerify).toHaveBeenCalledWith(
        baseSyncRequest.signature,
        baseSyncRequest.merkleRootHash,
        expect.stringContaining('BEGIN PUBLIC KEY')
      );
      expect(result.status).toBe('verified');
      expect(mockRepo.markPeerSyncFailed).not.toHaveBeenCalled();
    });

    it('marks sync failed when kmsVerify returns false (invalid signature)', async () => {
      mockKmsVerify.mockResolvedValueOnce(false);

      const result = await service.syncFromPeer(baseSyncRequest, '-----BEGIN PUBLIC KEY-----\nBAD\n-----END PUBLIC KEY-----');

      expect(mockRepo.markPeerSyncFailed).toHaveBeenCalledWith(
        1,
        'Merkle root signature verification failed'
      );
      expect(mockRepo.updateSyncCursor).not.toHaveBeenCalled();
      expect(result.status).toBe('failed');
    });

    it('marks sync failed when kmsVerify throws', async () => {
      mockKmsVerify.mockRejectedValueOnce(new Error('KMS unreachable'));

      await expect(
        service.syncFromPeer(baseSyncRequest, '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----')
      ).rejects.toThrow('KMS unreachable');

      expect(mockRepo.markPeerSyncFailed).toHaveBeenCalledWith(1, 'KMS unreachable');
      expect(mockRepo.updateSyncCursor).not.toHaveBeenCalled();
    });

    it('proceeds without calling kmsVerify when publicKeyPem is absent', async () => {
      // signature present but no publicKey — skip verify, treat as no-sig path
      const result = await service.syncFromPeer({ ...baseSyncRequest });
      // No public key passed → no verify call
      expect(mockKmsVerify).not.toHaveBeenCalled();
      expect(result.status).toBe('verified');
    });

    it('updates cursor to the value from the request', async () => {
      const result = await service.syncFromPeer({ peerNodeId: baseSyncRequest.peerNodeId, cursor: 99 });
      expect(mockRepo.updateSyncCursor).toHaveBeenCalledWith(baseSyncRequest.peerNodeId, 99);
      expect(result.status).toBe('verified');
    });
  });

  // ------------------------------------------------------------------
  describe('getState()', () => {
    it('returns the federation state for a known node', async () => {
      const state = { nodeId: baseSyncRequest.peerNodeId, syncCursor: 42, status: 'active', lastSyncAt: new Date() };
      mockRepo.getState = jest.fn().mockResolvedValue(state);

      const result = await service.getState(baseSyncRequest.peerNodeId);

      expect(mockRepo.getState).toHaveBeenCalledWith(baseSyncRequest.peerNodeId);
      expect(result).toEqual(state);
    });

    it('returns null for an unknown node', async () => {
      mockRepo.getState = jest.fn().mockResolvedValue(null);
      const result = await service.getState('unknown-node');
      expect(result).toBeNull();
    });
  });

  // ------------------------------------------------------------------
  describe('getPendingSyncs()', () => {
    it('returns list of pending sync events', async () => {
      const pending = [baseSyncEvent, { ...baseSyncEvent, id: 2 }];
      mockRepo.getPendingSyncs = jest.fn().mockResolvedValue(pending);

      const result = await service.getPendingSyncs();

      expect(result).toHaveLength(2);
      expect(result[0].status).toBe('pending');
    });

    it('returns empty array when no pending syncs', async () => {
      mockRepo.getPendingSyncs = jest.fn().mockResolvedValue([]);
      const result = await service.getPendingSyncs();
      expect(result).toEqual([]);
    });
  });
});
