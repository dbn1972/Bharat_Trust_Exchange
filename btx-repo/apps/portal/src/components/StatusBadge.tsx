import React from 'react';

export type ConsentStatus = 'active' | 'revoked' | 'expired' | 'pending';

const badgeClasses: Record<ConsentStatus, string> = {
  active:  'bg-green-100 text-green-800',
  revoked: 'bg-red-100 text-red-800',
  expired: 'bg-gray-100 text-gray-500',
  pending: 'bg-yellow-100 text-yellow-800',
};

const labels: Record<ConsentStatus, string> = {
  active:  'Active',
  revoked: 'Revoked',
  expired: 'Expired',
  pending: 'Pending',
};

export const StatusBadge: React.FC<{ status: ConsentStatus }> = ({ status }) => (
  <span
    className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${badgeClasses[status]}`}
    aria-label={`Status: ${labels[status]}`}
  >
    {labels[status]}
  </span>
);
