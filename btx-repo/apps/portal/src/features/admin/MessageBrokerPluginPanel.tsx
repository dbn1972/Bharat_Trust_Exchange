import React from 'react';
import { Button } from '../../components/Button';

export type MessageBrokerProvider = 'redpanda' | 'kafka';

export interface MessageBrokerPluginState {
  provider: MessageBrokerProvider;
  brokers: string[];
  updatedAt?: string;
}

interface MessageBrokerPluginPanelProps {
  initial: MessageBrokerPluginState;
  loading?: boolean;
  onSave: (next: MessageBrokerPluginState) => Promise<void>;
}

/**
 * Admin plugin panel for selecting event broker provider.
 * Supports both Redpanda and Apache Kafka using the same Kafka protocol.
 */
export const MessageBrokerPluginPanel: React.FC<MessageBrokerPluginPanelProps> = ({
  initial,
  loading = false,
  onSave,
}) => {
  const [provider, setProvider] = React.useState<MessageBrokerProvider>(initial.provider);
  const [brokersText, setBrokersText] = React.useState(initial.brokers.join(', '));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState(initial.updatedAt || null);

  const effectiveLoading = loading || saving;

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    try {
      const brokers = brokersText
        .split(',')
        .map((b) => b.trim())
        .filter(Boolean);

      const next = { provider, brokers };
      await onSave(next);
      setSavedAt(new Date().toISOString());
    } catch (err) {
      setError((err as Error).message || 'Failed to save broker plugin settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-4" aria-labelledby="broker-plugin-heading">
      <h2 id="broker-plugin-heading" className="mb-3 text-lg font-semibold text-gray-900">
        Message Broker Plugin
      </h2>

      <p className="mb-4 text-sm text-gray-600">
        Choose broker provider for outbox publishing. Both options use the Kafka protocol.
      </p>

      <div className="mb-4">
        <label htmlFor="broker-provider" className="mb-1 block text-sm font-medium text-gray-700">
          Provider
        </label>
        <select
          id="broker-provider"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          value={provider}
          onChange={(e) => setProvider(e.target.value as MessageBrokerProvider)}
          disabled={effectiveLoading}
        >
          <option value="redpanda">Redpanda</option>
          <option value="kafka">Apache Kafka</option>
        </select>
      </div>

      <div className="mb-4">
        <label htmlFor="broker-list" className="mb-1 block text-sm font-medium text-gray-700">
          Brokers (comma-separated)
        </label>
        <input
          id="broker-list"
          type="text"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder={provider === 'kafka' ? 'kafka:9092' : 'redpanda:9092'}
          value={brokersText}
          onChange={(e) => setBrokersText(e.target.value)}
          disabled={effectiveLoading}
        />
      </div>

      {error && (
        <p className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700" role="alert" aria-live="assertive">
          {error}
        </p>
      )}

      {savedAt && (
        <p className="mb-3 text-xs text-gray-500">
          Last saved at {new Date(savedAt).toLocaleString('en-IN')}
        </p>
      )}

      <Button onClick={handleSave} loading={effectiveLoading} disabled={effectiveLoading}>
        Save Plugin Settings
      </Button>
    </section>
  );
};
