import { Kafka } from 'kafkajs';
import { Pool } from 'pg';
import { OutboxRepository } from '../adapter/db/repository';

/**
 * OutboxPublisher: Worker that drains outbox table and publishes to Kafka (ADR-0021)
 * Implements transactional outbox pattern: DB commit implies eventual Kafka publication
 */
export class OutboxPublisher {
  private kafka: Kafka;
  private producer: any;
  private repository: OutboxRepository;
  private running = false;
  private lastError: Error | null = null;

  constructor(
    private pool: Pool,
    kafkaConfig: { brokers: string[] }
  ) {
    this.repository = new OutboxRepository(pool);
    this.kafka = new Kafka({
      clientId: 'btx-outbox-publisher',
      brokers: kafkaConfig.brokers,
      retry: {
        initialRetryTime: 100,
        retries: 3,
        maxRetryTime: 30000
      }
    });
  }

  /**
   * Initialize producer
   */
  async connect(): Promise<void> {
    this.producer = this.kafka.producer({ idempotent: true });
    await this.producer.connect();
  }

  /**
   * Graceful shutdown
   */
  async disconnect(): Promise<void> {
    if (this.producer) {
      await this.producer.disconnect();
    }
  }

  /**
   * Start draining outbox (long-running worker)
   */
  async start(interval: number = 1000): Promise<void> {
    if (this.running) return;
    this.running = true;

    while (this.running) {
      try {
        await this.drainOnce();
      } catch (err) {
        this.lastError = err as Error;
        console.error('[OutboxPublisher] Drain error:', err);
      }

      // Wait before next drain
      await new Promise(resolve => setTimeout(resolve, interval));
    }
  }

  /**
   * Stop the worker
   */
  stop(): void {
    this.running = false;
  }

  /**
   * Drain pending outbox events once
   */
  private async drainOnce(): Promise<void> {
    const pending = await this.repository.getPending(100);

    if (pending.length === 0) {
      return;
    }

    const records = pending.map(event => ({
      topic: this.getTopicForEvent(event.eventType),
      messages: [
        {
          key: event.aggregateId,
          value: JSON.stringify({
            id: event.id.toString(),
            type: event.eventType,
            aggregateId: event.aggregateId,
            payload: event.payload,
            timestamp: event.createdAt.toISOString()
          }),
          headers: {
            'trace-id': this.generateTraceId(),
            'idempotency-key': event.id.toString()
          }
        }
      ]
    }));

    // Publish to Kafka with idempotency
    const result = await this.producer.sendBatch({
      topicMessages: records,
      timeout: 30000,
      compression: 1 // Gzip
    });

    // Mark as published
    for (let i = 0; i < pending.length; i++) {
      if (result[i]?.error) {
        await this.repository.markFailed(pending[i].id, result[i].error.message);
      } else {
        await this.repository.markPublished(pending[i].id);
      }
    }
  }

  /**
   * Map event type to Kafka topic
   */
  private getTopicForEvent(eventType: string): string {
    const topicMap: Record<string, string> = {
      'consent.granted': 'audit.appended',
      'consent.revoked': 'audit.appended',
      'consent.queried': 'audit.appended',
      'federation.sync': 'federation.synced'
    };
    return topicMap[eventType] || 'audit.appended';
  }

  /**
   * Generate trace ID for observability
   */
  private generateTraceId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get health status
   */
  getStatus(): { running: boolean; lastError: Error | null } {
    return { running: this.running, lastError: this.lastError };
  }
}
