import type { KmsAdapter } from './index.js';
import { KmsError } from './index.js';

export interface GcpKmsConfig { project: string; location: string; keyRing: string; signingKey: string; encryptKey: string; }

export function createGcpKms(_cfg: GcpKmsConfig): KmsAdapter {
  const ni = () => { throw new KmsError('not_implemented', 'gcp kms adapter pending CT-CLOUD-GCP pass'); };
  return {
    generateDataKey: ni, decryptDataKey: ni, sign: ni, verify: ni, publicKeyPem: ni,
    healthz: async () => ({ ok: false, provider: 'gcp' })
  };
}
