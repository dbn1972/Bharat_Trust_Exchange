import { KmsError } from './index.js';
export function createAwsKms(cfg) {
    // Lazy-load AWS SDK to allow optional dependency
    let client = cfg.client;
    async function getClient() {
        if (!client) {
            try {
                const { KMSClient } = await import('@aws-sdk/client-kms');
                client = new KMSClient({ region: cfg.region });
            }
            catch (err) {
                throw new KmsError('provider_error', 'AWS SDK not available', err);
            }
        }
        return client;
    }
    return {
        async generateDataKey(keyId, opts) {
            try {
                const kms = await getClient();
                const { GenerateDataKeyCommand } = await import('@aws-sdk/client-kms');
                const bits = (opts?.bits ?? 256);
                const cmd = new GenerateDataKeyCommand({
                    KeyId: keyId,
                    KeySpec: bits === 256 ? 'AES_256' : bits === 192 ? 'AES_192' : 'AES_128',
                    EncryptionContext: opts?.aad ? { aad: opts.aad } : undefined
                });
                const result = await kms.send(cmd);
                if (!result.Plaintext || !result.CiphertextBlob) {
                    throw new KmsError('provider_error', 'AWS returned empty plaintext/ciphertext');
                }
                return {
                    plaintext: new Uint8Array(result.Plaintext),
                    ciphertext: new Uint8Array(result.CiphertextBlob),
                    keyId: result.KeyId || keyId,
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
                const { DecryptCommand } = await import('@aws-sdk/client-kms');
                const cmd = new DecryptCommand({
                    CiphertextBlob: ciphertext,
                    KeyId: keyId,
                    EncryptionContext: aad ? { aad } : undefined
                });
                const result = await kms.send(cmd);
                if (!result.Plaintext) {
                    throw new KmsError('provider_error', 'AWS returned empty plaintext');
                }
                return new Uint8Array(result.Plaintext);
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
                const { SignCommand } = await import('@aws-sdk/client-kms');
                const cmd = new SignCommand({
                    KeyId: keyId === 'signing' ? cfg.signingKeyArn : keyId,
                    Message: message,
                    SigningAlgorithm: 'ECDSA_SHA_256'
                });
                const result = await kms.send(cmd);
                if (!result.Signature) {
                    throw new KmsError('provider_error', 'AWS returned empty signature');
                }
                return {
                    signature: new Uint8Array(result.Signature),
                    keyId: result.KeyId || keyId,
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
                const { VerifyCommand } = await import('@aws-sdk/client-kms');
                const cmd = new VerifyCommand({
                    KeyId: keyId === 'signing' ? cfg.signingKeyArn : keyId,
                    Message: message,
                    Signature: signature,
                    SigningAlgorithm: 'ECDSA_SHA_256'
                });
                const result = await kms.send(cmd);
                return result.SignatureValid ?? false;
            }
            catch (err) {
                if (err instanceof KmsError)
                    throw err;
                throw new KmsError('provider_error', `verify failed: ${String(err)}`, err);
            }
        },
        async publicKeyPem(keyId) {
            try {
                const kms = await getClient();
                const { GetPublicKeyCommand } = await import('@aws-sdk/client-kms');
                const cmd = new GetPublicKeyCommand({
                    KeyId: keyId === 'signing' ? cfg.signingKeyArn : keyId
                });
                const result = await kms.send(cmd);
                if (!result.PublicKey) {
                    throw new KmsError('provider_error', 'AWS returned empty public key');
                }
                // AWS returns DER-encoded public key; convert to PEM
                const derBuffer = Buffer.from(result.PublicKey);
                const base64 = derBuffer.toString('base64');
                const pem = `-----BEGIN PUBLIC KEY-----\n${base64.match(/.{1,64}/g)?.join('\n')}\n-----END PUBLIC KEY-----`;
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
                const { DescribeKeyCommand } = await import('@aws-sdk/client-kms');
                const cmd = new DescribeKeyCommand({ KeyId: cfg.signingKeyArn });
                await kms.send(cmd);
                return { ok: true, provider: 'aws' };
            }
            catch {
                return { ok: false, provider: 'aws' };
            }
        }
    };
}
//# sourceMappingURL=aws.js.map