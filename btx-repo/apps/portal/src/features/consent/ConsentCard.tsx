import React from 'react';
import { StatusBadge, ConsentStatus } from '../../components/StatusBadge';
import { Button } from '../../components/Button';

export interface ConsentCardProps {
  principalName: string;
  purpose: string;
  dataFields: string[];
  expiresAt: Date | null;
  status: ConsentStatus;
  onRevoke?: () => void;
}

export const ConsentCard: React.FC<ConsentCardProps> = ({
  principalName,
  purpose,
  dataFields,
  expiresAt,
  status,
  onRevoke,
}) => (
  <article
    className="bg-white border border-gray-200 rounded-lg shadow-sm p-6"
    aria-label={`Consent to ${principalName}`}
  >
    <div className="flex items-start justify-between mb-3">
      <h2 className="text-base font-semibold text-gray-900">{principalName}</h2>
      <StatusBadge status={status} />
    </div>
    <p className="text-sm text-gray-600 mb-3">{purpose}</p>
    <ul
      className="text-sm text-gray-700 list-disc list-inside mb-3"
      role="list"
      aria-label="Data fields"
    >
      {dataFields.map((field) => (
        <li key={field}>{field}</li>
      ))}
    </ul>
    {expiresAt && (
      <p className="text-xs text-gray-400">
        Expires{' '}
        <time dateTime={expiresAt.toISOString()}>
          {expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </time>
      </p>
    )}
    {status === 'active' && onRevoke && (
      <Button
        variant="danger"
        size="sm"
        onClick={onRevoke}
        className="mt-4"
        aria-label={`Revoke consent to ${principalName}`}
      >
        Revoke
      </Button>
    )}
  </article>
);
