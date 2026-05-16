import type { ObjectStoreAdapter } from './index.js';
import { ObjectStoreError } from './index.js';
export function createGcsStore(_cfg: { project: string }): ObjectStoreAdapter {
  const ni = () => { throw new ObjectStoreError('not_implemented', 'gcs pending CT-CLOUD-GCP'); };
  return { put: ni as any, get: ni as any, head: ni as any, signUrl: ni as any, delete: ni as any,
    healthz: async () => ({ ok: false, provider: 'gcs' }) };
}
