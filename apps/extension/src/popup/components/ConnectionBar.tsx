import { useState, useEffect } from 'react';
import { useAuth } from '@/shared/hooks/useAuth';
import { ServiceNowClient } from '@/shared/api/servicenow-client';
import { IllumioClient } from '@/shared/api/illumio-client';

interface ConnectionBarProps {
  onConnect: (target: 'servicenow' | 'illumio') => void;
  onSettingsClick: () => void;
}

type ConnectionStatus = 'disconnected' | 'testing' | 'connected' | 'error';

const API_BASE = 'http://localhost:8080';

export function ConnectionBar({ onConnect, onSettingsClick }: ConnectionBarProps) {
  const { snowConfig, illumioConfig } = useAuth();
  const [snowStatus, setSnowStatus] = useState<ConnectionStatus>('disconnected');
  const [illumioStatus, setIllumioStatus] = useState<ConnectionStatus>('disconnected');
  const [apiStatus, setApiStatus] = useState<ConnectionStatus>('disconnected');

  useEffect(() => {
    testApiConnection();
  }, []);

  useEffect(() => {
    if (snowConfig) {
      testSnowConnection();
    } else {
      setSnowStatus('disconnected');
    }
  }, [snowConfig]);

  useEffect(() => {
    if (illumioConfig) {
      testIllumioConnection();
    } else {
      setIllumioStatus('disconnected');
    }
  }, [illumioConfig]);

  async function testSnowConnection() {
    if (!snowConfig) return;
    setSnowStatus('testing');
    try {
      const client = new ServiceNowClient(snowConfig.instance, snowConfig.username, snowConfig.password);
      const ok = await client.testConnection();
      setSnowStatus(ok ? 'connected' : 'error');
    } catch {
      setSnowStatus('error');
    }
  }

  async function testApiConnection() {
    setApiStatus('testing');
    try {
      const res = await fetch(`${API_BASE}/v1/cmdb/health`);
      if (res.ok) {
        setApiStatus('connected');
      } else {
        setApiStatus('error');
      }
    } catch {
      setApiStatus('error');
    }
  }

  async function testIllumioConnection() {
    if (!illumioConfig) return;
    setIllumioStatus('testing');
    try {
      const client = new IllumioClient(illumioConfig.pceUrl, illumioConfig.apiKeyId, illumioConfig.apiKeySecret, illumioConfig.orgId);
      const ok = await client.testConnection();
      setIllumioStatus(ok ? 'connected' : 'error');
    } catch {
      setIllumioStatus('error');
    }
  }

  return (
    <header className="sticky top-0 bg-white border-b border-border z-10">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-text">Aperture</h1>
          <button
            onClick={onSettingsClick}
            className="p-1.5 text-text-muted hover:text-text rounded-lg hover:bg-gray-100"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>

        <div className="flex items-center gap-3 mt-2">
          <ConnectionDot
            label="ServiceNow"
            status={snowStatus}
            detail={snowConfig?.instance}
            onClick={() => onConnect('servicenow')}
          />
          <ConnectionDot
            label="Illumio"
            status={illumioStatus}
            detail={illumioConfig ? 'PCE' : undefined}
            onClick={() => onConnect('illumio')}
          />
          <ConnectionDot
            label="CMDB API"
            status={apiStatus}
            detail={apiStatus === 'connected' ? ':8080' : undefined}
            onClick={testApiConnection}
          />
        </div>
      </div>
    </header>
  );
}

function ConnectionDot({
  label,
  status,
  detail,
  onClick,
}: {
  label: string;
  status: ConnectionStatus;
  detail?: string;
  onClick: () => void;
}) {
  const dotColor = {
    disconnected: 'bg-gray-300',
    testing: 'bg-yellow-400 animate-pulse',
    connected: 'bg-green-500',
    error: 'bg-red-500',
  }[status];

  const statusText = {
    disconnected: 'Not connected',
    testing: 'Testing...',
    connected: detail || 'Connected',
    error: 'Connection failed',
  }[status];

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 text-xs text-text-muted hover:text-text transition-colors"
      title={`${label}: ${statusText}`}
    >
      <span className={`w-2 h-2 rounded-full ${dotColor}`} />
      <span>{label}</span>
      {status === 'connected' && detail && (
        <span className="text-text-muted truncate max-w-[80px]">({detail})</span>
      )}
    </button>
  );
}
