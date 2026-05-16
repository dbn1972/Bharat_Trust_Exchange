import type { KmsAdapter } from './index.js';
import { KmsError } from './index.js';

export interface AzureKmsConfig { vaultUrl: string; signingKey: string; encryptKey: string; }

export function createAzureKms(_cfg: AzureKmsConfig): KmsAdapter {
  const ni = () => { throw new KmsError('not_implemented', 'azure kms adapter pending CT-CLOUD-AZURE pass'); };
  return {
    generateDataKey: ni, decryptDataKey: ni, sign: ni, verify: ni, publicKeyPem: ni,
    healthz: async () => ({ ok: false, provider: 'azure' })
  };
}
