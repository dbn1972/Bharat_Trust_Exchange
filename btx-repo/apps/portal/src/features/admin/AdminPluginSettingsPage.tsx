import React from 'react';
import {
  MessageBrokerPluginPanel,
  type MessageBrokerPluginState,
  type MessageBrokerProvider,
} from './MessageBrokerPluginPanel';

interface AdminPluginSettingsPageProps {
  apiBaseUrl?: string;
  apiKey?: string;
}

function buildHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (apiKey) headers.authorization = `Bearer ${apiKey}`;
  return headers;
}

export const AdminPluginSettingsPage: React.FC<AdminPluginSettingsPageProps> = ({
  apiBaseUrl = '',
  apiKey,
}) => {
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [state, setState] = React.useState<MessageBrokerPluginState>({
    provider: 'redpanda',
    brokers: ['redpanda:9092'],
  });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${apiBaseUrl}/v1/admin/plugins/message-broker`, {
        method: 'GET',
        headers: buildHeaders(apiKey),
      });

      if (!res.ok) throw new Error(`Failed to load broker plugin config: HTTP ${res.status}`);

      const json = (await res.json()) as {
        provider: MessageBrokerProvider;
        brokers: string[];
        updatedAt: string;
      };

      setState({ provider: json.provider, brokers: json.brokers, updatedAt: json.updatedAt });
    } catch (err) {
      setError((err as Error).message || 'Failed to load plugin settings');
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl, apiKey]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const save = async (next: MessageBrokerPluginState): Promise<void> => {
    const res = await fetch(`${apiBaseUrl}/v1/admin/plugins/message-broker`, {
      method: 'PUT',
      headers: buildHeaders(apiKey),
      body: JSON.stringify({
        provider: next.provider,
        brokers: next.brokers,
      }),
    });

    if (!res.ok) {
      throw new Error(`Failed to save broker plugin config: HTTP ${res.status}`);
    }

    const json = (await res.json()) as {
      provider: MessageBrokerProvider;
      brokers: string[];
      updatedAt: string;
    };

    setState({ provider: json.provider, brokers: json.brokers, updatedAt: json.updatedAt });
  };

  return (
    <main className="mx-auto max-w-3xl p-6" aria-labelledby="admin-plugin-settings-title">
      <h1 id="admin-plugin-settings-title" className="mb-2 text-2xl font-bold text-gray-900">
        Admin Plugin Settings
      </h1>
      <p className="mb-6 text-sm text-gray-600">
        Configure backend plugin providers used by BTX control-plane.
      </p>

      {error && (
        <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-700" role="alert" aria-live="assertive">
          {error}
        </div>
      )}

      <MessageBrokerPluginPanel initial={state} loading={loading} onSave={save} />
    </main>
  );
};
