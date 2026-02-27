import { useAuth } from '@/shared/hooks/useAuth';

interface SettingsProps {
  onBack: () => void;
}

export function Settings({ onBack }: SettingsProps) {
  const { snowConfig, illumioConfig, clearSnowConfig, clearIllumioConfig } = useAuth();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-text">Settings</h2>
        <button onClick={onBack} className="text-sm text-primary hover:text-primary-600">
          ← Back
        </button>
      </div>

      <div className="card p-4 space-y-3">
        <h3 className="text-sm font-medium text-text">Connections</h3>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-text">ServiceNow</div>
            <div className="text-xs text-text-muted">
              {snowConfig ? snowConfig.instance : 'Not connected'}
            </div>
          </div>
          {snowConfig && (
            <button onClick={clearSnowConfig} className="text-xs text-danger hover:text-danger-600">
              Disconnect
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-text">Illumio PCE</div>
            <div className="text-xs text-text-muted">
              {illumioConfig ? illumioConfig.pceUrl : 'Not connected'}
            </div>
          </div>
          {illumioConfig && (
            <button onClick={clearIllumioConfig} className="text-xs text-danger hover:text-danger-600">
              Disconnect
            </button>
          )}
        </div>
      </div>

      <div className="card p-4">
        <h3 className="text-sm font-medium text-text mb-2">About</h3>
        <p className="text-xs text-text-muted">
          Aperture v1.0.0 — Infrastructure context bridge connecting ServiceNow CMDB to Illumio PCE.
        </p>
      </div>
    </div>
  );
}
