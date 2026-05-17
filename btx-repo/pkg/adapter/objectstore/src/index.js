/** Cloud-agnostic object store (ADR-0007). Used for policy bundles, audit
 *  evidence packs, signed connector manifests. */
export class ObjectStoreError extends Error {
    code;
    constructor(code, m) {
        super(m);
        this.code = code;
        this.name = 'ObjectStoreError';
    }
}
export { createMinioStore } from './minio.js';
export { createAwsS3Store } from './aws.js';
export { createGcsStore } from './gcp.js';
export { createAzureBlobStore } from './azure.js';
//# sourceMappingURL=index.js.map