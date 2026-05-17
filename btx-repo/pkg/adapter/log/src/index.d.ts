/** Minimal log adapter. Concrete impl uses pino; this file declares the
 *  shape so service code stays decoupled. Compatible with Fastify's logger
 *  contract. */
export interface Logger {
    level?: string;
    info: (obj: unknown, msg?: string) => void;
    warn: (obj: unknown, msg?: string) => void;
    error: (obj: unknown, msg?: string) => void;
    debug: (obj: unknown, msg?: string) => void;
    child: (bindings: Record<string, unknown>) => Logger;
}
export declare function createConsoleLogger(level?: 'info' | 'debug' | 'warn' | 'error'): Logger;
