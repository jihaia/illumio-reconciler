import { useState, useEffect } from 'react';
import { useServiceNow } from '@/shared/hooks/useServiceNow';
import type { Portfolio, QueryResult } from '@/shared/types';

interface QueryBuilderProps {
  onResults: (results: QueryResult) => void;
  disabled?: boolean;
}

export function QueryBuilder({ onResults, disabled }: QueryBuilderProps) {
  const { client, isConfigured } = useServiceNow();
  const [queryType, setQueryType] = useState<'portfolio' | 'service'>('portfolio');
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingPortfolios, setLoadingPortfolios] = useState(false);

  useEffect(() => {
    if (client && isConfigured) {
      loadPortfolios();
    }
  }, [client, isConfigured]);

  async function loadPortfolios() {
    if (!client) return;
    setLoadingPortfolios(true);
    try {
      const results = await client.getPortfolios();
      setPortfolios(results);
    } catch (err) {
      console.error('Failed to load portfolios:', err);
    } finally {
      setLoadingPortfolios(false);
    }
  }

  async function handleQuery() {
    if (!client) return;

    setLoading(true);
    try {
      if (queryType === 'portfolio' && selectedPortfolio) {
        const data = await client.getIPListForPortfolio(selectedPortfolio);
        if (data) {
          onResults({
            query: { type: 'portfolio', portfolioName: data.portfolio },
            servers: data.servers,
            totalCount: data.serverCount,
            multiUseCount: data.servers.filter(s => s.services.length > 1).length,
            portfolios: [data.portfolio],
            executedAt: Date.now(),
          });
        }
      }
    } catch (err) {
      console.error('Query failed:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!isConfigured || disabled) {
    return (
      <div className="card p-4 text-center">
        <p className="text-text-muted text-sm">
          Connect to ServiceNow to start querying
        </p>
      </div>
    );
  }

  return (
    <div className="card p-4 space-y-3">
      <div>
        <label className="field-label">Query Type</label>
        <select
          value={queryType}
          onChange={(e) => setQueryType(e.target.value as 'portfolio' | 'service')}
          className="input"
        >
          <option value="portfolio">By Portfolio</option>
          <option value="service">By Service</option>
        </select>
      </div>

      {queryType === 'portfolio' && (
        <div>
          <label className="field-label">Portfolio</label>
          <select
            value={selectedPortfolio}
            onChange={(e) => setSelectedPortfolio(e.target.value)}
            className="input"
            disabled={loadingPortfolios}
          >
            <option value="">
              {loadingPortfolios ? 'Loading portfolios...' : 'Select portfolio...'}
            </option>
            {portfolios.map(p => (
              <option key={p.sysId} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      )}

      {queryType === 'service' && (
        <div>
          <label className="field-label">Service Name</label>
          <input
            type="text"
            className="input"
            placeholder="e.g., NMT [M-T #4] (P)"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
          />
        </div>
      )}

      <button
        onClick={handleQuery}
        disabled={loading || (queryType === 'portfolio' ? !selectedPortfolio : !serviceName.trim())}
        className="btn btn-primary w-full"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Querying...
          </span>
        ) : (
          'Run Query'
        )}
      </button>
    </div>
  );
}
