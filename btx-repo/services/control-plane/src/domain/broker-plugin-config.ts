export type MessageBrokerProvider = 'redpanda' | 'kafka';

export interface MessageBrokerPluginConfig {
  provider: MessageBrokerProvider;
  brokers: string[];
  source: 'env' | 'admin';
  updatedAt: string;
}

interface BrokerPluginUpdate {
  provider: MessageBrokerProvider;
  brokers?: string[];
}

function parseProvider(raw: string | undefined): MessageBrokerProvider {
  if (!raw) return 'redpanda';
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'redpanda' || normalized === 'kafka') return normalized;
  throw new Error(`Unsupported broker provider: ${raw}`);
}

function sanitizeBrokers(brokers: string[] | undefined, allowEmpty: boolean = true): string[] {
  if (!brokers || brokers.length === 0) return [];

  const clean = brokers.map((b) => b.trim()).filter(Boolean);
  if (!allowEmpty && clean.length === 0) {
    throw new Error('Broker list must contain at least one non-empty broker');
  }
  return clean;
}

export function defaultBrokersForProvider(provider: MessageBrokerProvider): string[] {
  return provider === 'kafka' ? ['kafka:9092'] : ['redpanda:9092'];
}

export function buildInitialBrokerPluginConfig(env: NodeJS.ProcessEnv): MessageBrokerPluginConfig {
  const provider = parseProvider(env.MESSAGE_BROKER_PROVIDER);
  const envBrokers = sanitizeBrokers((env.KAFKA_BROKERS || '').split(','), true);

  return {
    provider,
    brokers: envBrokers.length > 0 ? envBrokers : defaultBrokersForProvider(provider),
    source: 'env',
    updatedAt: new Date().toISOString(),
  };
}

export interface BrokerPluginConfigStore {
  get: () => MessageBrokerPluginConfig;
  update: (update: BrokerPluginUpdate) => MessageBrokerPluginConfig;
}

export function createBrokerPluginConfigStore(initial: MessageBrokerPluginConfig): BrokerPluginConfigStore {
  let current = initial;

  return {
    get: () => current,
    update: (update) => {
      const provider = parseProvider(update.provider);
      const brokers = sanitizeBrokers(update.brokers, true);
      current = {
        provider,
        brokers: brokers.length > 0 ? brokers : defaultBrokersForProvider(provider),
        source: 'admin',
        updatedAt: new Date().toISOString(),
      };
      return current;
    },
  };
}
