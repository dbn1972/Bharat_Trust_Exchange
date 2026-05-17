import type { FastifyPluginAsync } from 'fastify';
import type { KmsAdapter } from '../../adapter/kms/src/index.js';
import type { ObjectStoreAdapter } from '../../adapter/objectstore/src/index.js';
type Primitive = string | number | boolean | null;
export type PolicyContext = Record<string, Primitive | Primitive[] | Record<string, unknown>>;
export interface PolicyRule {
    id: string;
    effect: 'allow' | 'deny';
    when: {
        all?: Array<{
            path: string;
            op: 'eq' | 'neq' | 'in' | 'contains';
            value: Primitive | Primitive[];
        }>;
        any?: Array<{
            path: string;
            op: 'eq' | 'neq' | 'in' | 'contains';
            value: Primitive | Primitive[];
        }>;
    };
    obligations?: Record<string, Primitive | Primitive[]>;
}
export interface PolicyBundle {
    bundleId: string;
    issuedAt: string;
    version: string;
    rules: PolicyRule[];
}
export interface SignedBundle {
    payload: PolicyBundle;
    signatureB64: string;
    keyId: string;
}
export interface Decision {
    ruleId: string;
    decision: 'allow' | 'deny';
    obligations: Record<string, Primitive | Primitive[]>;
    reason?: string;
}
export interface PolicyPluginOptions {
    objectStore: ObjectStoreAdapter;
    kms: KmsAdapter;
    bucket: string;
    key: string;
    cacheTtlMs?: number;
}
declare module 'fastify' {
    interface FastifyInstance {
        policy: {
            evaluate: (ruleId: string, ctx: PolicyContext) => Decision;
            reload: () => Promise<void>;
            currentBundleId: () => string | null;
        };
    }
}
export declare const policyPlugin: FastifyPluginAsync<PolicyPluginOptions>;
export declare const btxPolicyPlugin: FastifyPluginAsync<PolicyPluginOptions>;
export default btxPolicyPlugin;
