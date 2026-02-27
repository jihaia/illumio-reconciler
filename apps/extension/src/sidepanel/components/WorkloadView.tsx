import { useState, useEffect } from 'react';

interface CMDBWorkload {
  workload_id: string;
  hostname: string;
  ip_address?: string;
  fqdn?: string;
  os?: string;
  environment?: string;
  location?: string;
  class_type?: string;
  is_virtual?: number;
  description?: string;
}

interface CMDBHierarchyRow {
  component_id: string;
  component_name: string;
  component_description?: string;
  component_type?: string;
  component_color?: string;
  application_id: string;
  application_name: string;
  app_grouping_id: string;
  app_grouping_name: string;
  asset_id: string;
  asset_name: string;
  criticality?: string;
  asset_environment?: string;
  portfolio_id: string;
  portfolio_name: string;
}

interface WorkloadViewProps {
  currentWorkload: any;
  visitedWorkloads: any[];
}

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'no_match' }
  | { status: 'error'; message: string }
  | { status: 'found'; workload: CMDBWorkload; hierarchy: CMDBHierarchyRow[] };

export function WorkloadView({ currentWorkload }: WorkloadViewProps) {
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  // Auto-lookup when workload changes
  useEffect(() => {
    if (!currentWorkload) {
      setLookup({ status: 'idle' });
      return;
    }

    const hostname = currentWorkload.hostname;
    const ip = currentWorkload.ip_addresses?.[0];

    if (!hostname && !ip) {
      setLookup({ status: 'idle' });
      return;
    }

    lookupWorkload(hostname, ip);
  }, [currentWorkload?.hostname, currentWorkload?.ip_addresses?.join(',')]);

  async function lookupWorkload(hostname?: string, ip?: string) {
    setLookup({ status: 'loading' });
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'lookupCMDBWorkload',
        payload: { hostname, ip },
      });

      if (result?.error) {
        setLookup({ status: 'error', message: result.error });
      } else if (result?.workload) {
        setLookup({
          status: 'found',
          workload: result.workload,
          hierarchy: result.hierarchy || [],
        });
      } else {
        setLookup({ status: 'no_match' });
      }
    } catch (err: any) {
      setLookup({ status: 'error', message: err.message || 'Lookup failed' });
    }
  }

  function openGraphForWorkload() {
    // Prefer IP for the lookup since it's more reliable across CMDB subtables
    const focus = currentWorkload?.ip_addresses?.[0] || currentWorkload?.hostname;
    chrome.runtime.sendMessage({
      action: 'openGraphPage',
      payload: { focus },
    });
  }

  if (!currentWorkload) {
    return (
      <div className="card p-8 text-center">
        <svg className="w-12 h-12 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <p className="text-text font-medium mb-2">Navigate to an Illumio Workload</p>
        <p className="text-text-muted text-sm">
          Open a workload detail page in Illumio to see its CMDB context
        </p>
      </div>
    );
  }

  // Determine environments for mismatch comparison
  const cmdbEnv = lookup.status === 'found' ? (lookup.workload.environment ?? null) : null;
  const illumioEnv = currentWorkload.labels?.env;

  return (
    <div className="space-y-4">
      {/* Illumio workload info (from content script) */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-text truncate">
            {currentWorkload.hostname || 'Unknown Workload'}
          </h2>
          {(cmdbEnv || illumioEnv) && (
            <EnvBadge illumioEnv={illumioEnv ?? null} cmdbEnv={cmdbEnv} />
          )}
        </div>
        {currentWorkload.ip_addresses?.length > 0 && (
          <div className="mt-1.5">
            <span className="field-label">IP Addresses</span>
            <div className="font-mono text-xs text-text mt-0.5">
              {currentWorkload.ip_addresses.join(', ')}
            </div>
          </div>
        )}
        {currentWorkload.os_type && (
          <div className="mt-1.5">
            <span className="field-label">OS</span>
            <div className="text-xs text-text mt-0.5">{currentWorkload.os_type}</div>
          </div>
        )}
        {currentWorkload.labels && Object.keys(currentWorkload.labels).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(currentWorkload.labels).map(([key, value]) => (
              <span key={key} className="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                {key}: {value as string}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* CMDB lookup results */}
      <CMDBSection
        lookup={lookup}
        onRetry={() => lookupWorkload(currentWorkload.hostname, currentWorkload.ip_addresses?.[0])}
        onVisualize={openGraphForWorkload}
      />
    </div>
  );
}

function CMDBSection({
  lookup,
  onRetry,
  onVisualize,
}: {
  lookup: LookupState;
  onRetry: () => void;
  onVisualize: () => void;
}) {
  if (lookup.status === 'idle') {
    return null;
  }

  if (lookup.status === 'loading') {
    return (
      <div className="card p-6 text-center">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <p className="text-xs text-text-muted">Looking up in CMDB...</p>
      </div>
    );
  }

  if (lookup.status === 'error') {
    return (
      <div className="card p-4">
        <div className="flex items-start gap-2">
          <svg className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-text">Lookup failed</p>
            <p className="text-xs text-text-muted mt-0.5">{lookup.message}</p>
          </div>
        </div>
        <button onClick={onRetry} className="btn btn-outline btn-sm mt-3 w-full">
          Retry
        </button>
      </div>
    );
  }

  if (lookup.status === 'no_match') {
    return (
      <div className="card p-4">
        <div className="flex items-start gap-2">
          <span className="match-none w-2 h-2 rounded-full mt-1.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-text">No CMDB match found</p>
            <p className="text-xs text-text-muted mt-0.5">
              This workload was not found in the CMDB. Try syncing workloads from Illumio first.
            </p>
          </div>
        </div>
        <button onClick={onRetry} className="btn btn-outline btn-sm mt-3 w-full">
          Retry lookup
        </button>
      </div>
    );
  }

  // Found — build hierarchy from flat rows
  const { workload, hierarchy } = lookup;

  // Group hierarchy by portfolio → asset → app grouping → application → component
  const portfolios = new Map<string, {
    name: string;
    assets: Map<string, {
      name: string;
      criticality?: string;
      environment?: string;
      appGroupings: Map<string, {
        name: string;
        applications: Map<string, {
          name: string;
          components: Array<{ name: string; type?: string; color?: string; description?: string }>;
        }>;
      }>;
    }>;
  }>();

  for (const row of hierarchy) {
    if (!portfolios.has(row.portfolio_id)) {
      portfolios.set(row.portfolio_id, { name: row.portfolio_name, assets: new Map() });
    }
    const portfolio = portfolios.get(row.portfolio_id)!;

    if (!portfolio.assets.has(row.asset_id)) {
      portfolio.assets.set(row.asset_id, {
        name: row.asset_name,
        criticality: row.criticality,
        environment: row.asset_environment,
        appGroupings: new Map(),
      });
    }
    const asset = portfolio.assets.get(row.asset_id)!;

    if (!asset.appGroupings.has(row.app_grouping_id)) {
      asset.appGroupings.set(row.app_grouping_id, { name: row.app_grouping_name, applications: new Map() });
    }
    const appGrouping = asset.appGroupings.get(row.app_grouping_id)!;

    if (!appGrouping.applications.has(row.application_id)) {
      appGrouping.applications.set(row.application_id, { name: row.application_name, components: [] });
    }
    const app = appGrouping.applications.get(row.application_id)!;

    app.components.push({
      name: row.component_name,
      type: row.component_type,
      color: row.component_color,
      description: row.component_description,
    });
  }

  const uniquePortfolios = Array.from(portfolios.values());
  const uniqueComponents = hierarchy.length;
  const isMultiUse = uniquePortfolios.length > 1;

  return (
    <div className="space-y-3">
      {/* Match header */}
      <div className="card p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isMultiUse ? 'bg-amber-500' : hierarchy.length > 0 ? 'bg-green-500' : 'bg-gray-400'
            }`} />
            <span className="text-xs font-medium text-text">
              {hierarchy.length === 0
                ? 'Workload found (not assigned)'
                : isMultiUse
                  ? 'Multi-portfolio workload'
                  : 'CMDB match found'}
            </span>
          </div>
          {uniqueComponents > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-medium">
              {uniqueComponents} component{uniqueComponents !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Workload details */}
      <div className="card p-4 space-y-3">
        <SectionHeader title="Workload (CMDB)" />
        <Field label="Hostname" value={workload.hostname} />
        <Field label="IP" value={workload.ip_address || '—'} mono />
        {workload.fqdn && <Field label="FQDN" value={workload.fqdn} mono />}
        <Field label="OS" value={workload.os || '—'} />
        <Field label="Environment" value={workload.environment || '—'} />
        {workload.location && <Field label="Location" value={workload.location} />}
        {workload.class_type && (
          <Field label="Class" value={workload.class_type.replace(/^cmdb_ci_/, '').replace(/_/g, ' ')} />
        )}
        {workload.is_virtual === 1 && (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text-muted">Virtual</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">VM</span>
          </div>
        )}
        {workload.description && <Field label="Description" value={workload.description} />}
      </div>

      {/* Hierarchy: Portfolios → Assets → App Groupings → Applications → Components */}
      {uniquePortfolios.length > 0 ? (
        <div className="card p-4">
          <SectionHeader title={`Hierarchy (${uniquePortfolios.length} portfolio${uniquePortfolios.length !== 1 ? 's' : ''})`} />
          <div className="space-y-3 mt-2">
            {uniquePortfolios.map((portfolio) => (
              <div key={portfolio.name}>
                {/* Portfolio */}
                <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-blue-50">
                  <span className="w-1.5 h-1.5 rounded-sm rotate-45 bg-blue-500 flex-shrink-0" />
                  <span className="text-xs font-medium text-text">{portfolio.name}</span>
                </div>

                {/* Assets */}
                {Array.from(portfolio.assets.values()).map((asset) => (
                  <div key={asset.name} className="ml-3 mt-1.5">
                    <div className="flex items-center gap-2 px-2 py-1 rounded bg-indigo-50">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                      <span className="text-xs text-text">{asset.name}</span>
                      {asset.criticality && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 ml-auto">
                          {asset.criticality}
                        </span>
                      )}
                    </div>

                    {/* App Groupings → Applications → Components */}
                    {Array.from(asset.appGroupings.values()).map((ag) => (
                      <div key={ag.name} className="ml-3 mt-1">
                        <div className="text-[10px] text-text-muted px-2 py-0.5">{ag.name}</div>
                        {Array.from(ag.applications.values()).map((app) => (
                          <div key={app.name} className="ml-3 mt-0.5">
                            <div className="flex items-center gap-2 px-2 py-1 rounded bg-green-50">
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
                              <span className="text-xs text-text">{app.name}</span>
                            </div>
                            {app.components.map((comp, ci) => (
                              <div key={ci} className="ml-3 mt-0.5 flex items-center gap-2 px-2 py-0.5">
                                <span
                                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                                  style={{ backgroundColor: comp.color || '#9ca3af' }}
                                />
                                <span className="text-[11px] text-text">{comp.name}</span>
                                {comp.type && (
                                  <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 ml-auto">
                                    {comp.type}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="card p-4">
          <SectionHeader title="Hierarchy" />
          <p className="text-xs text-text-muted mt-2">Not assigned to any components yet</p>
        </div>
      )}

      {/* Multi-portfolio warning */}
      {isMultiUse && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div>
            <p className="text-xs font-medium text-amber-700">Multi-portfolio workload</p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              This workload is assigned to {uniquePortfolios.length} portfolios. Illumio can only assign one Application label.
            </p>
          </div>
        </div>
      )}

      {/* Visualize button */}
      <button
        onClick={onVisualize}
        className="btn btn-primary w-full flex items-center justify-center gap-2"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="5" r="2" />
          <circle cx="5" cy="19" r="2" />
          <circle cx="19" cy="19" r="2" />
          <path d="M12 7v4M7.5 17.5L11 13M16.5 17.5L13 13" strokeLinecap="round" />
        </svg>
        Visualize in Graph
      </button>
    </div>
  );
}

function SectionHeader({ title }: { title: string }) {
  return (
    <h3 className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
      {title}
    </h3>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-xs text-text-muted">{label}</span>
      <span className={`text-xs text-text ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

function normalizeEnv(env?: string | null): string | null {
  if (!env) return null;
  const lower = env.toLowerCase().trim();
  if (lower.includes('prod') && !lower.includes('support')) return 'production';
  if (lower.includes('dev')) return 'development';
  if (lower.includes('test') || lower.includes('qa')) return 'test';
  if (lower.includes('stag')) return 'staging';
  if (lower.includes('dr') || lower.includes('disaster')) return 'dr';
  return lower;
}

function EnvBadge({
  illumioEnv,
  cmdbEnv,
}: {
  illumioEnv: string | null;
  cmdbEnv: string | null;
}) {
  const normalizedIllumio = normalizeEnv(illumioEnv);
  const displayEnv = illumioEnv || cmdbEnv;
  if (!displayEnv) return null;

  if (!normalizedIllumio) {
    return (
      <span
        className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 font-medium flex-shrink-0"
        title={`CMDB: ${displayEnv}`}
      >
        {displayEnv}
      </span>
    );
  }

  const hasCmdbData = !!cmdbEnv;
  const isMatch = hasCmdbData && normalizeEnv(cmdbEnv) === normalizedIllumio;
  const hasMismatch = hasCmdbData && !isMatch;

  let title: string;
  if (!hasCmdbData) {
    title = `Illumio: ${illumioEnv} (no CMDB data to compare)`;
  } else if (isMatch) {
    title = `Illumio env "${illumioEnv}" matches CMDB "${cmdbEnv}"`;
  } else {
    title = `Illumio: ${illumioEnv} — CMDB: ${cmdbEnv} (mismatch)`;
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full font-medium bg-blue-50 text-blue-600 flex-shrink-0"
      title={title}
    >
      {hasCmdbData && (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${hasMismatch ? 'bg-red-500' : 'bg-green-500'}`} />
      )}
      {illumioEnv}
    </span>
  );
}
