/**
 * Google Cloud KMS adapter implementation
 * Uses Google Cloud KMS client library for DEK generation, signing, verification
 */
import type { KmsAdapter } from './index.js';
export interface GcpKmsConfig {
    project: string;
    location: string;
    keyRing: string;
    signingKey: string;
    encryptKey: string;
    client?: any;
}
export declare function createGcpKms(cfg: GcpKmsConfig): KmsAdapter;
