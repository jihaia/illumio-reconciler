import { useState, useEffect } from 'react';
import { checkHealth } from '../api';

interface Props {
  onImportCsv: () => void;
  onRefresh: () => void;
}

export function AdminHeader({ onImportCsv, onRefresh }: Props) {
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    checkHealth().then(() => setHealthy(true)).catch(() => setHealthy(false));
  }, []);

  return (
    <header className="bg-white border-b border-border px-6 py-3 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-text">Aperture CMDB Admin</h1>
        <span
          className={`w-2 h-2 rounded-full ${healthy === true ? 'bg-green-500' : healthy === false ? 'bg-red-500' : 'bg-gray-300'}`}
          title={healthy === true ? 'API connected' : healthy === false ? 'API unreachable' : 'Checking...'}
        />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={onImportCsv} className="btn btn-outline btn-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          <span className="text-xs">Import CSV</span>
        </button>
        <button onClick={onRefresh} className="btn btn-outline btn-sm" title="Refresh">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </header>
  );
}
