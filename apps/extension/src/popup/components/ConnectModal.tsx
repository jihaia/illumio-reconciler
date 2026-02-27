import { useState } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { ServiceNowClient } from '@/shared/api/servicenow-client';
import { IllumioClient } from '@/shared/api/illumio-client';

interface ConnectModalProps {
  target: 'servicenow' | 'illumio';
  onClose: () => void;
}

export function ConnectModal({ target, onClose }: ConnectModalProps) {
  const { snowConfig, illumioConfig, saveSnowConfig, saveIllumioConfig, clearSnowConfig, clearIllumioConfig } = useAuth();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-start justify-center pt-12 z-50">
      <div className="bg-white rounded-lg shadow-xl w-[360px] max-h-[420px] overflow-y-auto">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h2 className="font-semibold text-text">
            Connect to {target === 'servicenow' ? 'ServiceNow' : 'Illumio PCE'}
          </h2>
          <button onClick={onClose} className="text-text-muted hover:text-text">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-4">
          {target === 'servicenow' ? (
            <ServiceNowForm
              initial={snowConfig}
              onSave={async (config) => { await saveSnowConfig(config); onClose(); }}
              onDisconnect={async () => { await clearSnowConfig(); onClose(); }}
            />
          ) : (
            <IllumioForm
              initial={illumioConfig}
              onSave={async (config) => { await saveIllumioConfig(config); onClose(); }}
              onDisconnect={async () => { await clearIllumioConfig(); onClose(); }}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ServiceNowForm({
  initial,
  onSave,
  onDisconnect,
}: {
  initial: { instance: string; username: string; password: string } | null;
  onSave: (config: { instance: string; username: string; password: string }) => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const [instance, setInstance] = useState(initial?.instance || '');
  const [username, setUsername] = useState(initial?.username || '');
  const [password, setPassword] = useState(initial?.password || '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const client = new ServiceNowClient(instance, username, password);
      const ok = await client.testConnection();
      setTestResult(ok ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ instance, username, password });
    } finally {
      setSaving(false);
    }
  }

  const canTest = instance.trim() && username.trim() && password.trim();

  return (
    <div className="space-y-3">
      <div>
        <label className="field-label">Instance</label>
        <input
          type="text"
          className="input"
          placeholder="yourcompany.service-now.com"
          value={instance}
          onChange={(e) => setInstance(e.target.value)}
        />
      </div>
      <div>
        <label className="field-label">Username</label>
        <input
          type="text"
          className="input"
          placeholder="admin"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div>
        <label className="field-label">Password</label>
        <input
          type="password"
          className="input"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {testResult && (
        <div className={`text-xs p-2 rounded ${testResult === 'success' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'}`}>
          {testResult === 'success' ? 'Connection successful!' : 'Connection failed. Check credentials.'}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleTest}
          disabled={!canTest || testing}
          className="btn btn-outline btn-sm flex-1"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          onClick={handleSave}
          disabled={!canTest || saving}
          className="btn btn-primary btn-sm flex-1"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {initial && (
        <button
          onClick={onDisconnect}
          className="w-full text-xs text-danger hover:text-danger-600 mt-2"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}

function IllumioForm({
  initial,
  onSave,
  onDisconnect,
}: {
  initial: { pceUrl: string; apiKeyId: string; apiKeySecret: string; orgId: number } | null;
  onSave: (config: { pceUrl: string; apiKeyId: string; apiKeySecret: string; orgId: number }) => Promise<void>;
  onDisconnect: () => Promise<void>;
}) {
  const [pceUrl, setPceUrl] = useState(initial?.pceUrl || '');
  const [apiKeyId, setApiKeyId] = useState(initial?.apiKeyId || '');
  const [apiKeySecret, setApiKeySecret] = useState(initial?.apiKeySecret || '');
  const [orgId, setOrgId] = useState(initial?.orgId ?? 1);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const client = new IllumioClient(pceUrl, apiKeyId, apiKeySecret, orgId);
      const ok = await client.testConnection();
      setTestResult(ok ? 'success' : 'error');
    } catch {
      setTestResult('error');
    } finally {
      setTesting(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({ pceUrl, apiKeyId, apiKeySecret, orgId });
    } finally {
      setSaving(false);
    }
  }

  const canTest = pceUrl.trim() && apiKeyId.trim() && apiKeySecret.trim();

  return (
    <div className="space-y-3">
      <div>
        <label className="field-label">PCE URL</label>
        <input
          type="text"
          className="input"
          placeholder="https://pce.company.com:8443"
          value={pceUrl}
          onChange={(e) => setPceUrl(e.target.value)}
        />
      </div>
      <div>
        <label className="field-label">API Key ID</label>
        <input
          type="text"
          className="input"
          placeholder="api_xxxxxxxxx"
          value={apiKeyId}
          onChange={(e) => setApiKeyId(e.target.value)}
        />
      </div>
      <div>
        <label className="field-label">API Key Secret</label>
        <input
          type="password"
          className="input"
          placeholder="Secret"
          value={apiKeySecret}
          onChange={(e) => setApiKeySecret(e.target.value)}
        />
      </div>
      <div>
        <label className="field-label">Org ID</label>
        <input
          type="number"
          className="input"
          value={orgId}
          onChange={(e) => setOrgId(parseInt(e.target.value) || 1)}
        />
      </div>

      {testResult && (
        <div className={`text-xs p-2 rounded ${testResult === 'success' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'}`}>
          {testResult === 'success' ? 'Connection successful!' : 'Connection failed. Check credentials.'}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={handleTest}
          disabled={!canTest || testing}
          className="btn btn-outline btn-sm flex-1"
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </button>
        <button
          onClick={handleSave}
          disabled={!canTest || saving}
          className="btn btn-primary btn-sm flex-1"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {initial && (
        <button
          onClick={onDisconnect}
          className="w-full text-xs text-danger hover:text-danger-600 mt-2"
        >
          Disconnect
        </button>
      )}
    </div>
  );
}
