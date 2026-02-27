import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { listComponentWorkloads, linkWorkload, unlinkWorkload, searchWorkloads } from '../api';

interface Props {
  componentId: string;
}

export function WorkloadLinker({ componentId }: Props) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [linking, setLinking] = useState(false);

  const { data: linked, isLoading } = useQuery({
    queryKey: ['component-workloads', componentId],
    queryFn: () => listComponentWorkloads(componentId),
  });

  const { data: searchResults } = useQuery({
    queryKey: ['workload-search', search],
    queryFn: () => searchWorkloads(search),
    enabled: search.length >= 2,
  });

  async function handleLink(workloadId: string) {
    setLinking(true);
    try {
      await linkWorkload(componentId, workloadId);
      queryClient.invalidateQueries({ queryKey: ['component-workloads', componentId] });
      setSearch('');
    } catch (err: any) {
      console.error('Link failed:', err);
    } finally {
      setLinking(false);
    }
  }

  async function handleUnlink(workloadId: string) {
    try {
      await unlinkWorkload(componentId, workloadId);
      queryClient.invalidateQueries({ queryKey: ['component-workloads', componentId] });
    } catch (err: any) {
      console.error('Unlink failed:', err);
    }
  }

  // Filter out already-linked workloads from search results
  const linkedIds = new Set(linked?.data?.map((w: any) => w.workload_id) || []);
  const suggestions = searchResults?.data?.filter((w) => !linkedIds.has(w.workload_id)) || [];

  return (
    <div className="mt-6 border-t border-border pt-4">
      <h3 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-3">
        Linked Workloads
      </h3>

      {isLoading && <p className="text-xs text-text-muted">Loading...</p>}

      {linked?.data && linked.data.length > 0 && (
        <ul className="space-y-1 mb-3">
          {linked.data.map((w: any) => (
            <li key={w.workload_id} className="flex items-center justify-between text-xs bg-gray-50 rounded px-2 py-1.5">
              <span className="truncate text-text">{w.hostname || w.ip_address || w.workload_id}</span>
              <button
                onClick={() => handleUnlink(w.workload_id)}
                className="text-red-400 hover:text-red-600 flex-shrink-0 ml-2"
                title="Unlink"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
      )}

      {linked?.data?.length === 0 && !isLoading && (
        <p className="text-xs text-text-muted italic mb-3">No workloads linked</p>
      )}

      <div className="relative">
        <input
          type="text"
          placeholder="Search workloads to link..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="input text-xs"
          disabled={linking}
        />
        {suggestions.length > 0 && (
          <ul className="absolute top-full left-0 right-0 bg-white border border-border rounded shadow-lg mt-1 max-h-40 overflow-y-auto z-10">
            {suggestions.map((w) => (
              <li key={w.workload_id}>
                <button
                  onClick={() => handleLink(w.workload_id)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 truncate"
                >
                  {w.hostname || w.ip_address}
                  {w.environment && <span className="text-text-muted ml-1">({w.environment})</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
