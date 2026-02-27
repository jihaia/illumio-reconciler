import { useState } from 'react';

interface HeaderProps {
  view: 'workload' | 'dashboard';
  onToggleView: () => void;
  visitedCount: number;
}

export function Header({ view, onToggleView, visitedCount }: HeaderProps) {
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  function openGraph() {
    chrome.runtime.sendMessage({ action: 'openGraphPage' });
  }

  function openAdmin() {
    chrome.runtime.sendMessage({ action: 'openAdminPage' });
  }

  async function syncWorkloads() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await chrome.runtime.sendMessage({ action: 'syncIllumioWorkloads' });
      if (res?.success) {
        const parts = [];
        if (res.created) parts.push(`${res.created} created`);
        if (res.updated) parts.push(`${res.updated} updated`);
        if (res.errors) parts.push(`${res.errors} errors`);
        setSyncResult(parts.length ? parts.join(', ') : `${res.total} workloads synced`);
      } else {
        setSyncResult(res?.error || 'Sync failed');
      }
    } catch (err: any) {
      setSyncResult(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncResult(null), 5000);
    }
  }

  return (
    <header className="sticky top-0 bg-white border-b border-border z-10">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold text-text">Aperture</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={syncWorkloads}
              disabled={syncing}
              className="btn btn-outline btn-sm"
              title="Sync Illumio workloads to CMDB"
            >
              <svg
                className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 0 1-9 9m9-9a9 9 0 0 0-9-9m9 9H3m0 0a9 9 0 0 1 9-9m-9 9a9 9 0 0 0 9 9" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs">{syncing ? 'Syncing...' : 'Sync'}</span>
            </button>
            <button
              onClick={openGraph}
              className="btn btn-outline btn-sm"
              title="Open Network Graph"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="2" />
                <circle cx="5" cy="19" r="2" />
                <circle cx="19" cy="19" r="2" />
                <path d="M12 7v4M7.5 17.5L11 13M16.5 17.5L13 13" strokeLinecap="round" />
              </svg>
              <span className="text-xs">Graph</span>
            </button>
            <button
              onClick={openAdmin}
              className="btn btn-outline btn-sm"
              title="Open CMDB Admin"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs">Admin</span>
            </button>
            <button
              onClick={onToggleView}
              className="text-sm text-primary hover:text-primary-600 font-medium"
            >
              {view === 'workload' ? 'View All' : '← Back'}
            </button>
          </div>
        </div>
        {syncResult ? (
          <p className="text-xs text-primary font-medium">{syncResult}</p>
        ) : visitedCount > 0 ? (
          <p className="text-xs text-text-muted">
            {visitedCount} workload{visitedCount !== 1 ? 's' : ''} visited this session
          </p>
        ) : (
          <p className="text-xs text-text-muted">
            Navigate to Illumio workloads to begin reconciliation
          </p>
        )}
      </div>
    </header>
  );
}
