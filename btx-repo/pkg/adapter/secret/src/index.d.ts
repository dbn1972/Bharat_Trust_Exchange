/** Cloud-agnostic secret store. v1 local impl reads from process.env / a file. */
export interface SecretAdapter {
    get(name: string): Promise<string | undefined>;
    /** All secrets matching `prefix` (used by config bootstrap). */
    list(prefix: string): Promise<Record<string, string>>;
    healthz(): Promise<{
        ok: boolean;
        provider: string;
    }>;
}
export declare class SecretError extends Error {
    code: 'not_found' | 'unauth' | 'provider_error' | 'not_implemented';
    constructor(code: 'not_found' | 'unauth' | 'provider_error' | 'not_implemented', m: string);
}
export declare function createEnvSecret(): SecretAdapter;
export declare function createAwsSecretsManager(_cfg: {
    region: string;
}): SecretAdapter;
