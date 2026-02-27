import { useState } from 'react';
import { ConnectionBar } from './components/ConnectionBar';
import { ConnectModal } from './components/ConnectModal';
import { QueryBuilder } from './components/QueryBuilder';
import { ResultsList } from './components/ResultsList';
import { Settings } from './components/Settings';
import { useAuth } from '@/shared/hooks/useAuth';
import type { QueryResult } from '@/shared/types';

type View = 'main' | 'settings';
type ConnectTarget = 'servicenow' | 'illumio' | null;

export default function App() {
  const [view, setView] = useState<View>('main');
  const [connectTarget, setConnectTarget] = useState<ConnectTarget>(null);
  const [results, setResults] = useState<QueryResult | null>(null);
  const { snowConfig, illumioConfig } = useAuth();

  async function openSidePanel() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        await chrome.sidePanel.open({ tabId: tab.id });
        window.close();
      }
    } catch (err) {
      console.error('[Aperture] Failed to open side panel:', err);
    }
  }

  function openGraph() {
    chrome.runtime.sendMessage({ action: 'openGraphPage' });
    window.close();
  }

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <ConnectionBar
        onConnect={(target) => setConnectTarget(target)}
        onSettingsClick={() => setView(view === 'settings' ? 'main' : 'settings')}
      />

      {connectTarget && (
        <ConnectModal
          target={connectTarget}
          onClose={() => setConnectTarget(null)}
        />
      )}

      <div className="flex-1 overflow-y-auto">
        {view === 'settings' ? (
          <Settings onBack={() => setView('main')} />
        ) : (
          <div className="p-4 space-y-4">
            {/* Quick actions */}
            <div className="flex gap-2">
              <button
                onClick={openSidePanel}
                className="btn btn-primary flex-1 flex items-center justify-center gap-2 text-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h7" />
                </svg>
                Open Side Panel
              </button>
              <button
                onClick={openGraph}
                className="btn btn-outline flex-1 flex items-center justify-center gap-2 text-sm"
                title="Open Network Graph"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="5" r="2" />
                  <circle cx="5" cy="19" r="2" />
                  <circle cx="19" cy="19" r="2" />
                  <path d="M12 7v4M7.5 17.5L11 13M16.5 17.5L13 13" strokeLinecap="round" />
                </svg>
                Graph
              </button>
            </div>

            <QueryBuilder
              onResults={setResults}
              disabled={!snowConfig}
            />
            {results && (
              <ResultsList
                results={results}
                illumioConnected={!!illumioConfig}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
