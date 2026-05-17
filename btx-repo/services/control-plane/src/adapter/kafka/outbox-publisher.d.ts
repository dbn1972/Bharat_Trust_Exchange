import { Pool } from 'pg';
/**
 * OutboxPublisher: Worker that drains outbox table and publishes to Kafka (ADR-0021)
 * Implements transactional outbox pattern: DB commit implies eventual Kafka publication
 */
export declare class OutboxPublisher {
    private pool;
    private kafka;
    private producer;
    private repository;
    private running;
    private lastError;
    constructor(pool: Pool, kafkaConfig: {
        brokers: string[];
    });
    /**
     * Initialize producer
     */
    connect(): Promise<void>;
    /**
     * Graceful shutdown
     */
    disconnect(): Promise<void>;
    /**
     * Start draining outbox (long-running worker)
     */
    start(interval?: number): Promise<void>;
    /**
     * Stop the worker
     */
    stop(): void;
    /**
     * Drain pending outbox events once
     */
    private drainOnce;
    /**
     * Map event type to Kafka topic
     */
    private getTopicForEvent;
    /**
     * Generate trace ID for observability
     */
    private generateTraceId;
    /**
     * Get health status
     */
    getStatus(): {
        running: boolean;
        lastError: Error | null;
    };
}
