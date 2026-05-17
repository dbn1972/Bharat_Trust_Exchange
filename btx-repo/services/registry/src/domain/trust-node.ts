/**
 * TrustNode: Federation member registry entry
 */

export interface TrustNode {
  id: string; // Internal UUID
  nodeId: string; // External node identifier (also UUID)
  name: string;
  endpointUrl: string;
  publicKeyPem: string;
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
  capabilities?: string[];
  metadata?: Record<string, unknown>;
}
