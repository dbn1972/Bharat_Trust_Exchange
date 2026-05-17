/**
 * TrustNode: Federation member registry entry
 */
export interface TrustNode {
    id: string;
    nodeId: string;
    name: string;
    endpointUrl: string;
    publicKeyPem: string;
    apiVersion: string;
    status: 'active' | 'inactive' | 'revoked';
    metadata: Record<string, unknown>;
    capabilities: string[];
    lastSeenAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export interface TrustNodeRegistration {
    nodeId: string;
    name: string;
    endpointUrl: string;
    publicKeyPem: string;
    apiVersion?: string;
    capabilities?: string[];
    metadata?: Record<string, unknown>;
}
