import { KmsError } from './index.js';
export function createGcpKms(cfg) {
    let client = cfg.client;
    async function getClient() {
        if (!client) {
            try {
                const { KeyManagementServiceClient } = await import('@google-cloud/kms');
                client = new KeyManagementServiceClient();
            }
            catch (err) {
                throw new KmsError('provider_error', 'Google Cloud KMS SDK not available', err);
            }
        }
        return client;
    }
    function buildKeyPath(keyId) {
        const actualKeyId = keyId === 'signing' ? cfg.signingKey : keyId === 'encrypt' ? cfg.encryptKey : keyId;
        return `projects/${cfg.project}/locations/${cfg.location}/keyRings/${cfg.keyRing}/cryptoKeys/${actualKeyId}`;
    }
    return {
        async generateDataKey(keyId, opts) {
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
            }
            catch (err) {
                if (err instanceof KmsError)
                    throw err;
                throw new KmsError('provider_error', `generateDataKey failed: ${String(err)}`, err);
            }
        },
        async decryptDataKey(keyId, ciphertext, aad) {
            try {
                const kms = await getClient();
                const keyPath = buildKeyPath(keyId);
                const [result] = await kms.decrypt({
                    name: keyPath,
                    ciphertext: Buffer.from(ciphertext),
                    additionalAuthenticatedData: aad ? Buffer.from(aad) : undefined
                });
                return new Uint8Array(result.plaintext || Buffer.alloc(0));
            }
            catch (err) {
                if (err instanceof KmsError)
                    throw err;
                throw new KmsError('provider_error', `decryptDataKey failed: ${String(err)}`, err);
            }
        },
        async sign(keyId, message) {
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
            }
            catch (err) {
                if (err instanceof KmsError)
                    throw err;
                throw new KmsError('provider_error', `sign failed: ${String(err)}`, err);
            }
        },
        async verify(keyId, message, signature) {
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
            }
            catch (err) {
                return false;
            }
        },
        async publicKeyPem(keyId) {
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
            }
            catch (err) {
                if (err instanceof KmsError)
                    throw err;
                throw new KmsError('provider_error', `publicKeyPem failed: ${String(err)}`, err);
            }
        },
        async healthz() {
            try {
                const kms = await getClient();
                const keyPath = `projects/${cfg.project}/locations/${cfg.location}/keyRings/${cfg.keyRing}`;
                await kms.listCryptoKeys({ parent: keyPath });
                return { ok: true, provider: 'gcp' };
            }
            catch {
                return { ok: false, provider: 'gcp' };
            }
        }
    };
}
//# sourceMappingURL=gcp.js.map