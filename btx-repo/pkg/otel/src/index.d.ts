import type { FastifyInstance } from 'fastify';
export interface OtelBootOptions {
    serviceName: string;
    serviceVersion?: string;
    environment?: string;
}
/**
 * Lightweight OTel bootstrap shim.
 * v1 keeps this package tiny and defers SDK wiring to deployment runtime.
 */
export declare function bootstrapFastifyOtel(app: FastifyInstance, opts: OtelBootOptions): void;
export declare function kafkaInjectTrace(headers: Record<string, string>, traceId: string): Record<string, string>;
export declare function kafkaExtractTrace(headers: Record<string, string | undefined>): string | undefined;
