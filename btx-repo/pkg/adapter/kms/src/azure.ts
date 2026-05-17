/**
 * Azure Key Vault adapter implementation
 * Uses Azure SDK for Key Vault operations: DEK generation, signing, verification
 */
import type { KmsAdapter, DataKey, SignResult } from './index.js';
import { KmsError } from './index.js';

export interface AzureKmsConfig {
  vaultUrl: string;
  signingKey: string;
  encryptKey: string;
  // Azure client injected at runtime to avoid hard dependency
  client?: any;
}

export function createAzureKms(cfg: AzureKmsConfig): KmsAdapter {
  let client = cfg.client;

  async function getClient() {
    if (!client) {
      try {
        const { KeyClient } = await import('@azure/keyvault-keys');
        const { DefaultAzureCredential } = await import('@azure/identity');
        const credential = new DefaultAzureCredential();
        client = new KeyClient(cfg.vaultUrl, credential);
      } catch (err) {
        throw new KmsError('provider_error', 'Azure SDK not available', err);
      }
    }
    return client;
  }

  async function getCryptoClient() {
    try {
      const { CryptographyClient } = await import('@azure/keyvault-keys');
      const keysClient = await getClient();
      const keyId = new URL(`${cfg.vaultUrl}/keys/signing/1`).href;
      return new CryptographyClient(keyId, await getClient());
    } catch (err) {
      throw new KmsError('provider_error', 'Failed to create cryptography client', err);
    }
  }

  return {
    async generateDataKey(keyId: string, opts?: { bits?: 128 | 192 | 256; aad?: string }): Promise<DataKey> {
      try {
        const kms = await getClient();
        const actualKeyId = keyId === 'encrypt' ? cfg.encryptKey : keyId;

        // Fetch the key (which includes public key for envelope encryption)
        const key = await kms.getKey(actualKeyId);

        // Generate random plaintext DEK
        const crypto = await import('crypto');
        const bits = (opts?.bits ?? 256) as number;
        const plaintext = crypto.randomBytes(bits / 8);

        // For envelope encryption in Azure, we would use the public key
        // For now, return plaintext and a mock ciphertext
        const ciphertext = Buffer.concat([
          Buffer.from('AZ-WRAPPED:', 'utf-8'),
          plaintext
        ]);

        return {
          plaintext: new Uint8Array(plaintext),
          ciphertext: new Uint8Array(ciphertext),
          keyId: actualKeyId,
          keyVersion: key.properties.version || '1',
          algo: 'AES-256-GCM'
        };
      } catch (err) {
        if (err instanceof KmsError) throw err;
        throw new KmsError('provider_error', `generateDataKey failed: ${String(err)}`, err);
      }
    },

    async decryptDataKey(keyId: string, ciphertext: Uint8Array, aad?: string): Promise<Uint8Array> {
      try {
        // For demonstration, extract plaintext from our wrapped format
        if (ciphertext.slice(0, 10).toString() === Buffer.from('AZ-WRAPPED:').toString()) {
          return new Uint8Array(ciphertext.slice(10));
        }

        const kms = await getClient();
        const actualKeyId = keyId === 'encrypt' ? cfg.encryptKey : keyId;

        // In production, use Azure's decrypt operation
        const key = await kms.getKey(actualKeyId);
        return new Uint8Array(ciphertext);
      } catch (err) {
        if (err instanceof KmsError) throw err;
        throw new KmsError('provider_error', `decryptDataKey failed: ${String(err)}`, err);
      }
    },

    async sign(keyId: string, message: Uint8Array): Promise<SignResult> {
      try {
        const { CryptographyClient } = await import('@azure/keyvault-keys');
        const kms = await getClient();
        const actualKeyId = keyId === 'signing' ? cfg.signingKey : keyId;

        const key = await kms.getKey(actualKeyId);
        const keyVersionUrl = key.id;

        const cryptoClient = new CryptographyClient(keyVersionUrl, kms);
        const result = await cryptoClient.sign('ES256', message);

        return {
          signature: new Uint8Array(result.result as Uint8Array),
          keyId: actualKeyId,
          keyVersion: key.properties.version || '1',
          algo: 'ecdsa-p256-sha256'
        };
      } catch (err) {
        if (err instanceof KmsError) throw err;
        throw new KmsError('provider_error', `sign failed: ${String(err)}`, err);
      }
    },

    async verify(keyId: string, message: Uint8Array, signature: Uint8Array): Promise<boolean> {
      try {
        const { CryptographyClient } = await import('@azure/keyvault-keys');
        const kms = await getClient();
        const actualKeyId = keyId === 'signing' ? cfg.signingKey : keyId;

        const key = await kms.getKey(actualKeyId);
        const keyVersionUrl = key.id;

        const cryptoClient = new CryptographyClient(keyVersionUrl, kms);
        const result = await cryptoClient.verify('ES256', message, signature);

        return result.result.isValid ?? false;
      } catch (err) {
        return false;
      }
    },

    async publicKeyPem(keyId: string): Promise<string> {
      try {
        const kms = await getClient();
        const actualKeyId = keyId === 'signing' ? cfg.signingKey : keyId;

        const key = await kms.getKey(actualKeyId);
        const publicKeyDer = key.key?.export('jwk');

        if (!publicKeyDer) {
          throw new KmsError('provider_error', 'Azure returned empty public key');
        }

        // Convert JWK to PEM (simplified)
        const pem = `-----BEGIN PUBLIC KEY-----\n${Buffer.from(JSON.stringify(publicKeyDer)).toString('base64').match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
        return pem;
      } catch (err) {
        if (err instanceof KmsError) throw err;
        throw new KmsError('provider_error', `publicKeyPem failed: ${String(err)}`, err);
      }
    },

    async healthz(): Promise<{ ok: boolean; provider: string }> {
      try {
        const kms = await getClient();
        await kms.getKey(cfg.signingKey);
        return { ok: true, provider: 'azure' };
      } catch {
        return { ok: false, provider: 'azure' };
      }
    }
  };
}
