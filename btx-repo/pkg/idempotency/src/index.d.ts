export interface RedisLike {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode?: 'EX', ttlSec?: number): Promise<unknown>;
}
export interface IdempotencyPluginOptions {
    redis: RedisLike;
    ttlSec?: number;
    keyPrefix?: string;
}
export declare const idempotencyPlugin: FastifyPluginAsync<IdempotencyPluginOptions>;
export default idempotencyPlugin;
