import React from 'react';
import { Button } from '../../../components/Button';

export interface GrantFlowParams {
  principalId: string;
  principalName: string;
  purpose: string;
  dataFields: string[];
  expiresAt: string; // ISO date string
}

type Step = 'notice' | 'detail' | 'confirm' | 'success';

interface GrantFlowState {
  step: Step;
  consentId: string | null;
  error: string | null;
  loading: boolean;
  explicitConsent: boolean;
}

interface NoticeStepProps {
  params: GrantFlowParams;
  onReview: () => void;
  onDismiss: () => void;
}

const NoticeStep: React.FC<NoticeStepProps> = ({ params, onReview, onDismiss }) => (
  <main aria-labelledby="notice-heading">
    <h1 id="notice-heading" className="text-2xl font-bold text-gray-900 mb-4" tabIndex={-1}>
      Data access request from {params.principalName}
    </h1>

    <section aria-label="Data summary" className="bg-gray-50 rounded-lg p-4 mb-4">
      <p className="text-sm font-medium text-gray-700 mb-2">They are requesting access to:</p>
      <ul role="list" aria-label="Data fields requested" className="list-disc list-inside text-sm text-gray-700">
        {params.dataFields.map((f) => <li key={f}>{f}</li>)}
      </ul>
      <div className="mt-3 text-sm text-gray-700">
        <strong>For:</strong> {params.purpose}
      </div>
      <div className="mt-1 text-sm text-gray-700">
        <strong>Until:</strong>{' '}
        <time dateTime={params.expiresAt}>
          {new Date(params.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
        </time>
      </div>
    </section>

    <aside role="note" aria-label="Important information" className="text-sm text-blue-700 bg-blue-50 rounded p-3 mb-6">
      You can revoke this consent at any time from your BTX dashboard.
    </aside>

    <nav aria-label="Consent flow actions" className="flex gap-3">
      <Button variant="primary" onClick={onReview}>Review details</Button>
      <Button variant="ghost" onClick={onDismiss}>Not now</Button>
    </nav>
  </main>
);

interface DetailStepProps {
  params: GrantFlowParams;
  onProceed: () => void;
  onBack: () => void;
}

const DetailStep: React.FC<DetailStepProps> = ({ params, onProceed, onBack }) => (
  <main aria-labelledby="detail-heading">
    <button
      type="button"
      onClick={onBack}
      className="text-sm text-blue-700 mb-4 hover:underline focus-visible:ring-2"
      aria-label="Go back to notice"
    >
      ← Back
    </button>
    <h1 id="detail-heading" className="text-2xl font-bold text-gray-900 mb-4" tabIndex={-1}>
      Data access details
    </h1>

    <section aria-labelledby="fields-heading" className="mb-6">
      <h2 id="fields-heading" className="text-base font-semibold text-gray-800 mb-2">Data fields</h2>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="bg-gray-50">
            <th className="text-left p-2 border border-gray-200">Field</th>
            <th className="text-left p-2 border border-gray-200">Sensitivity</th>
          </tr>
        </thead>
        <tbody>
          {params.dataFields.map((f) => (
            <tr key={f}>
              <td className="p-2 border border-gray-200">{f}</td>
              <td className="p-2 border border-gray-200">🟡 Moderate</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>

    <section aria-labelledby="principal-heading" className="mb-6">
      <h2 id="principal-heading" className="text-base font-semibold text-gray-800 mb-2">Principal details</h2>
      <dl className="text-sm text-gray-700 space-y-1">
        <div className="flex gap-2"><dt className="font-medium">Name:</dt><dd>{params.principalName}</dd></div>
        <div className="flex gap-2"><dt className="font-medium">Reg no:</dt><dd>{params.principalId}</dd></div>
        <div className="flex gap-2"><dt className="font-medium">Retention:</dt><dd>Data deleted 30 days after expiry</dd></div>
      </dl>
    </section>

    <Button variant="primary" onClick={onProceed}>I understand, proceed →</Button>
  </main>
);

interface ConfirmStepProps {
  params: GrantFlowParams;
  explicitConsent: boolean;
  onConsentToggle: () => void;
  onGrant: () => void;
  onBack: () => void;
  loading: boolean;
  error: string | null;
}

const ConfirmStep: React.FC<ConfirmStepProps> = ({
  params, explicitConsent, onConsentToggle, onGrant, onBack, loading, error,
}) => (
  <main aria-labelledby="confirm-heading">
    <h1 id="confirm-heading" className="text-2xl font-bold text-gray-900 mb-4" tabIndex={-1}>
      Confirm your consent
    </h1>

    <section aria-label="Consent summary" role="region" className="bg-gray-50 rounded-lg p-4 mb-6">
      <dl className="text-sm text-gray-700 space-y-1">
        <div className="flex gap-2"><dt className="font-medium">Recipient:</dt><dd>{params.principalName}</dd></div>
        <div className="flex gap-2"><dt className="font-medium">Data:</dt><dd>{params.dataFields.join(', ')}</dd></div>
        <div className="flex gap-2"><dt className="font-medium">Purpose:</dt><dd>{params.purpose}</dd></div>
        <div className="flex gap-2">
          <dt className="font-medium">Expires:</dt>
          <dd>
            <time dateTime={params.expiresAt}>
              {new Date(params.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
            </time>
          </dd>
        </div>
      </dl>
    </section>

    {error && (
      <div role="alert" aria-live="assertive" className="bg-red-50 text-red-700 text-sm rounded p-3 mb-4">
        {error}
      </div>
    )}

    <form
      onSubmit={(e) => { e.preventDefault(); if (explicitConsent) onGrant(); }}
      aria-labelledby="confirm-heading"
      noValidate
    >
      <div role="group" aria-required="true" className="flex items-start gap-2 mb-6">
        <input
          type="checkbox"
          id="explicit-consent"
          name="consent"
          required
          checked={explicitConsent}
          onChange={onConsentToggle}
          className="mt-1"
          aria-describedby="consent-hint"
        />
        <div>
          <label htmlFor="explicit-consent" className="text-sm text-gray-800">
            I give my consent freely and knowingly
          </label>
          <p id="consent-hint" className="text-xs text-gray-400 mt-0.5">
            You must tick this box to proceed.
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="submit"
          variant="primary"
          disabled={!explicitConsent}
          loading={loading}
          aria-disabled={!explicitConsent}
        >
          Grant Consent
        </Button>
        <Button type="button" variant="ghost" onClick={onBack}>Not now</Button>
      </div>
    </form>
  </main>
);

interface SuccessStepProps {
  params: GrantFlowParams;
  consentId: string;
  onViewConsents: () => void;
  onDone: () => void;
}

const SuccessStep: React.FC<SuccessStepProps> = ({ params, consentId, onViewConsents, onDone }) => (
  <main aria-labelledby="success-heading">
    <div className="text-green-600 text-4xl mb-4" aria-hidden="true">✅</div>
    <h1 id="success-heading" className="text-2xl font-bold text-gray-900 mb-2" tabIndex={-1}>
      Consent granted
    </h1>
    <p className="text-sm text-gray-700 mb-4">
      {params.principalName} can now access your data until{' '}
      <time dateTime={params.expiresAt}>
        {new Date(params.expiresAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
      </time>
      .
    </p>
    <dl className="text-xs text-gray-500 mb-6 space-y-1">
      <div className="flex gap-2"><dt className="font-medium">Consent ID:</dt><dd>{consentId}</dd></div>
    </dl>
    <div
      role="status"
      aria-live="polite"
      className="sr-only"
    >
      Consent granted to {params.principalName}. Consent ID: {consentId}.
    </div>
    <div className="flex gap-3">
      <Button variant="primary" onClick={onViewConsents}>View in My Consents</Button>
      <Button variant="ghost" onClick={onDone}>Done</Button>
    </div>
  </main>
);

// GrantFlow orchestrator
interface GrantFlowProps {
  params: GrantFlowParams;
  onGrant: (params: GrantFlowParams) => Promise<{ consentId: string }>;
  onDone: () => void;
  onViewConsents: () => void;
}

export const GrantFlow: React.FC<GrantFlowProps> = ({ params, onGrant, onDone, onViewConsents }) => {
  const [state, setState] = React.useState<GrantFlowState>({
    step: 'notice',
    consentId: null,
    error: null,
    loading: false,
    explicitConsent: false,
  });

  const goTo = (step: Step) =>
    setState((s) => ({ ...s, step, error: null }));

  const handleGrant = async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const { consentId } = await onGrant(params);
      setState((s) => ({ ...s, loading: false, step: 'success', consentId }));
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: 'Could not grant consent. Please check your connection and try again.',
      }));
    }
  };

  switch (state.step) {
    case 'notice':
      return (
        <NoticeStep
          params={params}
          onReview={() => goTo('detail')}
          onDismiss={onDone}
        />
      );
    case 'detail':
      return (
        <DetailStep
          params={params}
          onProceed={() => goTo('confirm')}
          onBack={() => goTo('notice')}
        />
      );
    case 'confirm':
      return (
        <ConfirmStep
          params={params}
          explicitConsent={state.explicitConsent}
          onConsentToggle={() => setState((s) => ({ ...s, explicitConsent: !s.explicitConsent }))}
          onGrant={handleGrant}
          onBack={() => goTo('detail')}
          loading={state.loading}
          error={state.error}
        />
      );
    case 'success':
      return (
        <SuccessStep
          params={params}
          consentId={state.consentId!}
          onViewConsents={onViewConsents}
          onDone={onDone}
        />
      );
    default:
      return null;
  }
};
