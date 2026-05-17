/**
 * Cloud-agnostic KMS adapter contract (ADR-0007, ADR-0020).
 *
 * All BTX components MUST use this interface for sign/verify/encrypt/decrypt
 * and DEK generation. No code may import a cloud KMS SDK directly.
 */
export interface DataKey {
    /** raw plaintext DEK (caller must clear from memory after use) */
    plaintext: Uint8Array;
    /** ciphertext blob, wrapped by the KEK; opaque to caller */
    ciphertext: Uint8Array;
    keyId: string;
    keyVersion: number;
    algo: 'AES-256-GCM';
}
export interface SignResult {
    signature: Uint8Array;
    keyId: string;
    keyVersion: number;
    algo: 'ed25519' | 'ecdsa-p256-sha256' | 'rsa-pss-sha256';
}
export interface KmsAdapter {
    /** Generate a new DEK wrapped by `keyId`. */
    generateDataKey(keyId: string, opts?: {
        bits?: 128 | 192 | 256;
        aad?: string;
    }): Promise<DataKey>;
    /** Unwrap a previously generated DEK ciphertext. */
    decryptDataKey(keyId: string, ciphertext: Uint8Array, aad?: string): Promise<Uint8Array>;
    /** Sign `message` with the asymmetric key `keyId`. */
    sign(keyId: string, message: Uint8Array): Promise<SignResult>;
    /** Verify a signature. */
    verify(keyId: string, message: Uint8Array, signature: Uint8Array): Promise<boolean>;
    /** Fetch the SPKI-encoded public key (PEM). */
    publicKeyPem(keyId: string): Promise<string>;
    /** Health probe (used by readiness). */
    healthz(): Promise<{
        ok: boolean;
        provider: string;
    }>;
}
export declare class KmsError extends Error {
    readonly code: 'unauth' | 'not_found' | 'invalid_arg' | 'provider_error' | 'not_implemented';
    readonly cause?: unknown | undefined;
    constructor(code: 'unauth' | 'not_found' | 'invalid_arg' | 'provider_error' | 'not_implemented', message: string, cause?: unknown | undefined);
}
export { createStubKms } from './stub.js';
export { createAwsKms } from './aws.js';
export { createGcpKms } from './gcp.js';
export { createAzureKms } from './azure.js';
