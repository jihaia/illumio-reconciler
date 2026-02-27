import { useState } from 'react';
import { useIllumio } from '@/shared/hooks/useIllumio';
import type { QueryResult } from '@/shared/types';

interface ResultsListProps {
  results: QueryResult;
  illumioConnected: boolean;
}

export function ResultsList({ results, illumioConnected }: ResultsListProps) {
  const { client } = useIllumio();
  const [creating, setCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [listName, setListName] = useState(`Aperture: ${results.portfolios[0] || 'Query'}`);
  const [createResult, setCreateResult] = useState<'success' | 'error' | null>(null);

  async function handleCreateIPList() {
    if (!client) return;

    setCreating(true);
    setCreateResult(null);
    try {
      const ipRanges = results.servers
        .filter(s => s.ip)
        .map(s => ({
          from_ip: s.ip!,
          description: s.description,
        }));

      const ipList = await client.createIPList(listName, ipRanges);
      setCreateResult('success');

      // Open in Illumio Explorer
      const explorerUrl = client.getExplorerUrl(ipList.href);
      chrome.tabs.create({ url: explorerUrl });
    } catch (err) {
      console.error('Failed to create IP List:', err);
      setCreateResult('error');
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-text">{results.totalCount} Servers</h3>
            <p className="text-xs text-text-muted">
              {results.multiUseCount > 0 && (
                <span className="text-purple-600">{results.multiUseCount} multi-use</span>
              )}
              {results.portfolios.length > 0 && (
                <span> in {results.portfolios.join(', ')}</span>
              )}
            </p>
          </div>
          {illumioConnected && (
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="btn btn-primary btn-sm"
            >
              Create IP List
            </button>
          )}
        </div>

        {/* Create IP List form */}
        {showCreateForm && (
          <div className="mt-3 space-y-2">
            <input
              type="text"
              className="input"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              placeholder="IP List name..."
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateIPList}
                disabled={creating || !listName.trim()}
                className="btn btn-primary btn-sm flex-1"
              >
                {creating ? 'Creating...' : `Create (${results.servers.filter(s => s.ip).length} IPs)`}
              </button>
              <button
                onClick={() => setShowCreateForm(false)}
                className="btn btn-ghost btn-sm"
              >
                Cancel
              </button>
            </div>
            {createResult && (
              <div className={`text-xs p-2 rounded ${createResult === 'success' ? 'bg-success-50 text-success-600' : 'bg-danger-50 text-danger-600'}`}>
                {createResult === 'success' ? 'IP List created and opened in Illumio!' : 'Failed to create IP List'}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Server List */}
      <div className="max-h-64 overflow-y-auto">
        {results.servers.map((server, i) => (
          <div key={i} className="px-4 py-2 border-b border-border last:border-0 hover:bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-mono text-sm text-text">{server.name}</span>
                {server.services && server.services.length > 1 && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded">
                    Multi-use
                  </span>
                )}
              </div>
              <span className="text-sm text-text-muted font-mono">{server.ip || '—'}</span>
            </div>
            {server.services && server.services.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {server.services.map((svc, j) => (
                  <span key={j} className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                    {svc}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
