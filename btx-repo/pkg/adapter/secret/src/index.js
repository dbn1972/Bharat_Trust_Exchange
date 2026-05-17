export class SecretError extends Error {
    code;
    constructor(code, m) {
        super(m);
        this.code = code;
        this.name = 'SecretError';
    }
}
export function createEnvSecret() {
    return {
        async get(name) { return process.env[name]; },
        async list(prefix) {
            const out = {};
            for (const [k, v] of Object.entries(process.env)) {
                if (k.startsWith(prefix) && typeof v === 'string')
                    out[k] = v;
            }
            return out;
        },
        async healthz() { return { ok: true, provider: 'env' }; }
    };
}
export function createAwsSecretsManager(_cfg) {
    const ni = () => { throw new SecretError('not_implemented', 'aws sm pending CT-CLOUD-AWS'); };
    return { get: ni, list: ni, healthz: async () => ({ ok: false, provider: 'aws-sm' }) };
}
//# sourceMappingURL=index.js.map