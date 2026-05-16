import type { ObjectStoreAdapter } from './index.js';
import { ObjectStoreError } from './index.js';
export function createAwsS3Store(_cfg: { region: string; bucketDefault?: string }): ObjectStoreAdapter {
  const ni = () => { throw new ObjectStoreError('not_implemented', 'aws s3 pending CT-CLOUD-AWS'); };
  return { put: ni as any, get: ni as any, head: ni as any, signUrl: ni as any, delete: ni as any,
    healthz: async () => ({ ok: false, provider: 'aws-s3' }) };
}
