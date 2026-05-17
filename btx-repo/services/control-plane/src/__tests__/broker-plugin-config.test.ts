import {
  buildInitialBrokerPluginConfig,
  createBrokerPluginConfigStore,
  defaultBrokersForProvider,
} from '../domain/broker-plugin-config';

describe('broker-plugin-config', () => {
  it('defaults to redpanda when provider is not set', () => {
    const cfg = buildInitialBrokerPluginConfig({});
    expect(cfg.provider).toBe('redpanda');
    expect(cfg.brokers).toEqual(['redpanda:9092']);
    expect(cfg.source).toBe('env');
  });

  it('uses kafka defaults when provider is kafka', () => {
    const cfg = buildInitialBrokerPluginConfig({ MESSAGE_BROKER_PROVIDER: 'kafka' });
    expect(cfg.provider).toBe('kafka');
    expect(cfg.brokers).toEqual(['kafka:9092']);
  });

  it('uses explicit KAFKA_BROKERS when provided', () => {
    const cfg = buildInitialBrokerPluginConfig({
      MESSAGE_BROKER_PROVIDER: 'redpanda',
      KAFKA_BROKERS: 'a:9092,b:9092',
    });
    expect(cfg.provider).toBe('redpanda');
    expect(cfg.brokers).toEqual(['a:9092', 'b:9092']);
  });

  it('rejects unsupported provider', () => {
    expect(() =>
      buildInitialBrokerPluginConfig({ MESSAGE_BROKER_PROVIDER: 'rabbitmq' })
    ).toThrow(/Unsupported broker provider/i);
  });

  it('store update switches provider and sets admin source', () => {
    const store = createBrokerPluginConfigStore(buildInitialBrokerPluginConfig({}));

    const updated = store.update({ provider: 'kafka' });

    expect(updated.provider).toBe('kafka');
    expect(updated.brokers).toEqual(['kafka:9092']);
    expect(updated.source).toBe('admin');
  });

  it('store update accepts explicit brokers', () => {
    const store = createBrokerPluginConfigStore(buildInitialBrokerPluginConfig({}));

    const updated = store.update({ provider: 'redpanda', brokers: ['rp-1:9092', 'rp-2:9092'] });

    expect(updated.provider).toBe('redpanda');
    expect(updated.brokers).toEqual(['rp-1:9092', 'rp-2:9092']);
  });

  it('defaultBrokersForProvider returns expected defaults', () => {
    expect(defaultBrokersForProvider('redpanda')).toEqual(['redpanda:9092']);
    expect(defaultBrokersForProvider('kafka')).toEqual(['kafka:9092']);
  });
});
