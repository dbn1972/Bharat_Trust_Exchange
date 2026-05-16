import type { ObjectStoreAdapter } from './index.js';
import { ObjectStoreError } from './index.js';
export function createAzureBlobStore(_cfg: { account: string }): ObjectStoreAdapter {
  const ni = () => { throw new ObjectStoreError('not_implemented', 'azure blob pending CT-CLOUD-AZURE'); };
  return { put: ni as any, get: ni as any, head: ni as any, signUrl: ni as any, delete: ni as any,
    healthz: async () => ({ ok: false, provider: 'azure-blob' }) };
}
