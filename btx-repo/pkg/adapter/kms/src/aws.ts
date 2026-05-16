// AWS KMS adapter — skeleton. v1 is stub-only (ADR-0023). Real adapter is
// wired during the per-cloud certification job (CT-CLOUD-AWS-*). Until then
// every method throws KmsError('not_implemented').
import type { KmsAdapter } from './index.js';
import { KmsError } from './index.js';

export interface AwsKmsConfig {
  region: string;
  signingKeyArn: string;
  encryptKeyArn: string;
  // intentionally do not import @aws-sdk here; injected at runtime
  client?: unknown;
}

export function createAwsKms(_cfg: AwsKmsConfig): KmsAdapter {
  const ni = () => { throw new KmsError('not_implemented', 'aws kms adapter pending CT-CLOUD-AWS pass'); };
  return {
    generateDataKey: ni, decryptDataKey: ni, sign: ni, verify: ni, publicKeyPem: ni,
    healthz: async () => ({ ok: false, provider: 'aws' })
  };
}
