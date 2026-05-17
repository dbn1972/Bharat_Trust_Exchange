/**
 * Cloud-agnostic KMS adapter contract (ADR-0007, ADR-0020).
 *
 * All BTX components MUST use this interface for sign/verify/encrypt/decrypt
 * and DEK generation. No code may import a cloud KMS SDK directly.
 */
export class KmsError extends Error {
    code;
    cause;
    constructor(code, message, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = 'KmsError';
    }
}
export { createStubKms } from './stub.js';
export { createAwsKms } from './aws.js';
export { createGcpKms } from './gcp.js';
export { createAzureKms } from './azure.js';
//# sourceMappingURL=index.js.map