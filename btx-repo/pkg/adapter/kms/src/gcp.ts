/**
 * Google Cloud KMS adapter implementation
 * Uses Google Cloud KMS client library for DEK generation, signing, verification
 */
import type { KmsAdapter, DataKey, SignResult } from './index.js';
import { KmsError } from './index.js';

export interface GcpKmsConfig {
  project: string;
  location: string;
  keyRing: string;
  signingKey: string;
  encryptKey: string;
  // GCP client injected at runtime to avoid hard dependency
  client?: any;
}

export function createGcpKms(cfg: GcpKmsConfig): KmsAdapter {
  let client = cfg.client;

  async function getClient() {
    if (!client) {
      try {
        const { KeyManagementServiceClient } = await import('@google-cloud/kms');
        client = new KeyManagementServiceClient();
      } catch (err) {
        throw new KmsError('provider_error', 'Google Cloud KMS SDK not available', err);
      }
    }
    return client;
  }

  function buildKeyPath(keyId: string): string {
    const actualKeyId = keyId === 'signing' ? cfg.signingKey : keyId === 'encrypt' ? cfg.encryptKey : keyId;
    return `projects/${cfg.project}/locations/${cfg.location}/keyRings/${cfg.keyRing}/cryptoKeys/${actualKeyId}`;
  }

  return {
    async generateDataKey(keyId: string, opts?: { bits?: 128 | 192 | 256; aad?: string }): Promise<DataKey> {
      try {
        const kms = await getClient();
        const keyPath = buildKeyPath(keyId);

        const [result] = await kms.generateRandomBytes({
          location: `projects/${cfg.project}/locations/${cfg.location}`,
          lengthBytes: (opts?.bits ?? 256) / 8
        });

        const plaintext = result.randomBytes || Buffer.alloc(32);

        // Encrypt the DEK
        const [encryptResult] = await kms.encrypt({
          name: keyPath,
          plaintext,
          additionalAuthenticatedData: opts?.aad ? Buffer.from(opts.aad) : undefined
        });

        return {
          plaintext: new Uint8Array(plaintext),
          ciphertext: new Uint8Array(encryptResult.ciphertext || Buffer.alloc(0)),
          keyId,
          keyVersion: 1,
          algo: 'AES-256-GCM'
        };
      } catch (err) {
        if (err instanceof KmsError) throw err;
        throw new KmsError('provider_error', `generateDataKey failed: ${String(err)}`, err);
      }
    },

    async decryptDataKey(keyId: string, ciphertext: Uint8Array, aad?: string): Promise<Uint8Array> {
      try {
        const kms = await getClient();
        const keyPath = buildKeyPath(keyId);

        const [result] = await kms.decrypt({
          name: keyPath,
          ciphertext: Buffer.from(ciphertext),
          additionalAuthenticatedData: aad ? Buffer.from(aad) : undefined
        });

        return new Uint8Array(result.plaintext || Buffer.alloc(0));
      } catch (err) {
        if (err instanceof KmsError) throw err;
        throw new KmsError('provider_error', `decryptDataKey failed: ${String(err)}`, err);
      }
    },

    async sign(keyId: string, message: Uint8Array): Promise<SignResult> {
      try {
        const kms = await getClient();
        const keyPath = buildKeyPath(keyId === 'signing' ? cfg.signingKey : keyId);

        const [result] = await kms.asymmetricSign({
          name: `${keyPath}/versions/1`,
          data: Buffer.from(message),
          digest: { sha256: Buffer.from('') }
        });

        return {
          signature: new Uint8Array(result.signature || Buffer.alloc(0)),
          keyId,
          keyVersion: 1,
          algo: 'ecdsa-p256-sha256'
        };
      } catch (err) {
        if (err instanceof KmsError) throw err;
        throw new KmsError('provider_error', `sign failed: ${String(err)}`, err);
      }
    },

    async verify(keyId: string, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
      try {
        const kms = await getClient();
        const keyPath = buildKeyPath(keyId === 'signing' ? cfg.signingKey : keyId);

        const [result] = await kms.asymmetricDecrypt({
          name: `${keyPath}/versions/1`,
          ciphertext: Buffer.from(signature)
        });

        // For verification, compare the decrypted data with the message
        const decrypted = result.plaintext || Buffer.alloc(0);
        return Buffer.from(message).equals(Buffer.from(decrypted));
      } catch (err) {
        return false;
      }
    },

    async publicKeyPem(keyId: string): Promise<string> {
      try {
        const kms = await getClient();
        const keyPath = buildKeyPath(keyId === 'signing' ? cfg.signingKey : keyId);

        const [result] = await kms.getPublicKey({
          name: `${keyPath}/versions/1`
        });

        const pem = result.pem || '';
        if (!pem) {
          throw new KmsError('provider_error', 'GCP returned empty public key');
        }
        return pem;
      } catch (err) {
        if (err instanceof KmsError) throw err;
        throw new KmsError('provider_error', `publicKeyPem failed: ${String(err)}`, err);
      }
    },

    async healthz(): Promise<{ ok: boolean; provider: string }> {
      try {
        const kms = await getClient();
        const keyPath = `projects/${cfg.project}/locations/${cfg.location}/keyRings/${cfg.keyRing}`;
        await kms.listCryptoKeys({ parent: keyPath });
        return { ok: true, provider: 'gcp' };
      } catch {
        return { ok: false, provider: 'gcp' };
      }
    }
  };
}
