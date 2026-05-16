/**
 * HTTP-backed KMS adapter that targets the local `kms-stub` Fastify service
 * (see docker/kms-stub). Conforms to the same wire shape that real cloud
 * KMS adapters use, so the only swap to go live is `createStubKms` →
 * `createAwsKms` (etc.) via service config.
 */
import type { KmsAdapter, DataKey, SignResult } from './index.js';
import { KmsError } from './index.js';

export interface StubKmsConfig {
  endpoint: string;          // e.g. http://kms-stub:8080
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export function createStubKms(cfg: StubKmsConfig): KmsAdapter {
  const f = cfg.fetch ?? fetch;
  const base = cfg.endpoint.replace(/\/$/, '');
  const timeoutMs = cfg.timeoutMs ?? 2000;

  async function call<T>(path: string, body?: unknown): Promise<T> {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await f(base + path, {
        method: body ? 'POST' : 'GET',
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal
      });
      if (!res.ok) throw new KmsError('provider_error', `kms-stub ${path} ${res.status}`);
      return await res.json() as T;
    } catch (e) {
      if (e instanceof KmsError) throw e;
      throw new KmsError('provider_error', `kms-stub transport: ${(e as Error).message}`, e);
    } finally {
      clearTimeout(t);
    }
  }

  function b64(u: Uint8Array): string { return Buffer.from(u).toString('base64'); }
  function fromB64(s: string): Uint8Array { return new Uint8Array(Buffer.from(s, 'base64')); }

  return {
    async generateDataKey(keyId, opts) {
      const r = await call<{ plaintext: string; ciphertext: string; keyVersion: number }>(
        '/v1/generate-dek', { keyId, bits: opts?.bits ?? 256, aad: opts?.aad });
      return {
        plaintext: fromB64(r.plaintext),
        ciphertext: fromB64(r.ciphertext),
        keyId, keyVersion: r.keyVersion, algo: 'AES-256-GCM'
      } satisfies DataKey;
    },

    async decryptDataKey(keyId, ciphertext, aad) {
      const r = await call<{ plaintext: string }>(
        '/v1/decrypt', { keyId, ciphertext: b64(ciphertext), aad });
      return fromB64(r.plaintext);
    },

    async sign(keyId, message) {
      const r = await call<{ signature: string; algo: 'ed25519'; keyVersion: number }>(
        '/v1/sign', { keyId, message: b64(message) });
      return { signature: fromB64(r.signature), keyId, keyVersion: r.keyVersion, algo: r.algo } satisfies SignResult;
    },

    async verify(keyId, message, signature) {
      const r = await call<{ valid: boolean }>(
        '/v1/verify', { keyId, message: b64(message), signature: b64(signature) });
      return r.valid === true;
    },

    async publicKeyPem(keyId) {
      const r = await call<{ publicKeyPem: string }>(`/v1/public-key/${encodeURIComponent(keyId)}`);
      return r.publicKeyPem;
    },

    async healthz() {
      try {
        await call('/healthz');
        return { ok: true, provider: 'stub' };
      } catch {
        return { ok: false, provider: 'stub' };
      }
    }
  };
}
