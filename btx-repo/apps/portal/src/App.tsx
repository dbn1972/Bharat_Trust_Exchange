import React from 'react';
import { AdminPluginSettingsPage } from './features/admin';

function readEnv(name: string, fallback: string): string {
  const value = (import.meta as any).env?.[name];
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

export const App: React.FC = () => {
  const apiBaseUrl = readEnv('VITE_CONTROL_PLANE_URL', 'http://localhost:3002');
  const apiKey = readEnv('VITE_BTX_API_KEY', '');

  return (
    <div className="portal-shell">
      <header className="portal-header">
        <h1>Bharat Trust Exchange</h1>
        <p>Admin control surface for runtime plugin configuration.</p>
      </header>

      <section className="portal-content">
        <AdminPluginSettingsPage apiBaseUrl={apiBaseUrl} apiKey={apiKey} />
      </section>
    </div>
  );
};
