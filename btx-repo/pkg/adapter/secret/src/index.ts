/** Cloud-agnostic secret store. v1 local impl reads from process.env / a file. */
export interface SecretAdapter {
  get(name: string): Promise<string | undefined>;
  /** All secrets matching `prefix` (used by config bootstrap). */
  list(prefix: string): Promise<Record<string, string>>;
  healthz(): Promise<{ ok: boolean; provider: string }>;
}

export class SecretError extends Error {
  constructor(public code: 'not_found' | 'unauth' | 'provider_error' | 'not_implemented', m: string) {
    super(m); this.name = 'SecretError';
  }
}

export function createEnvSecret(): SecretAdapter {
  return {
    async get(name) { return process.env[name]; },
    async list(prefix) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (k.startsWith(prefix) && typeof v === 'string') out[k] = v;
      }
      return out;
    },
    async healthz() { return { ok: true, provider: 'env' }; }
  };
}

export function createAwsSecretsManager(_cfg: { region: string }): SecretAdapter {
  const ni = () => { throw new SecretError('not_implemented', 'aws sm pending CT-CLOUD-AWS'); };
  return { get: ni as any, list: ni as any, healthz: async () => ({ ok: false, provider: 'aws-sm' }) };
}
