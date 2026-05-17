/**
 * TrustNode: Federation member registry entry
 */

export interface TrustNode {
  id: string; // Internal UUID
  nodeId: string; // External node identifier (also UUID)
  name: string;
  endpointUrl: string;
  publicKeyPem: string;
  apiVersion: string; // Highest API version advertised (ADR-0024)
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
  apiVersion?: string; // defaults to 'v1'
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}
