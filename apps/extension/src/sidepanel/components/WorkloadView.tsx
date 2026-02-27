import { useState, useEffect } from 'react';
import type { ServerContext } from '@/shared/types';

interface WorkloadViewProps {
  currentWorkload: any;
  visitedWorkloads: any[];
}

type LookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'not_configured' }
  | { status: 'no_match' }
  | { status: 'error'; message: string }
  | { status: 'found'; context: ServerContext; matchType: string };

export function WorkloadView({ currentWorkload }: WorkloadViewProps) {
  const [lookup, setLookup] = useState<LookupState>({ status: 'idle' });

  // Auto-lookup when workload changes
  useEffect(() => {
    if (!currentWorkload) {
      setLookup({ status: 'idle' });
      return;
    }

    // Try to find an identifier to look up: first IP, then hostname
    const identifier =
      currentWorkload.ip_addresses?.[0] || currentWorkload.hostname;

    if (!identifier) {
      setLookup({ status: 'idle' });
      return;
    }

    lookupWorkload(identifier);
  }, [currentWorkload?.hostname, currentWorkload?.ip_addresses?.join(',')]);

  async function lookupWorkload(identifier: string) {
    setLookup({ status: 'loading' });
    try {
      const result = await chrome.runtime.sendMessage({
        action: 'getServerContext',
        payload: { identifier },
      });

      if (result?.error === 'ServiceNow not configured') {
        setLookup({ status: 'not_configured' });
      } else if (result?.error) {
        setLookup({ status: 'error', message: result.error });
      } else if (result?.context) {
        setLookup({
          status: 'found',
          context: result.context,
          matchType: result.context.isMultiUse ? 'multi-use' : 'exact',
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
          Open a workload detail page in Illumio to see its ServiceNow CMDB context
        </p>
      </div>
    );
  }

  // Determine CMDB environments for mismatch comparison
  const cmdbServerEnv = lookup.status === 'found' ? (lookup.context.server.environment ?? null) : null;
  const cmdbServiceEnvs = lookup.status === 'found'
    ? lookup.context.serviceDetails
        .map(s => s.environment)
        .filter((e): e is string => !!e)
    : [];
  const illumioEnv = currentWorkload.labels?.env;

  return (
    <div className="space-y-4">
      {/* Illumio workload info (from content script) */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-base font-semibold text-text truncate">
            {currentWorkload.hostname || 'Unknown Workload'}
          </h2>
          {(cmdbServerEnv || illumioEnv || cmdbServiceEnvs.length > 0) && (
            <EnvBadge
              illumioEnv={illumioEnv ?? null}
              cmdbServerEnv={cmdbServerEnv}
              cmdbServiceEnvs={cmdbServiceEnvs}
              serviceDetails={lookup.status === 'found' ? lookup.context.serviceDetails : []}
            />
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

      {/* ServiceNow CMDB lookup results */}
      <CMDBSection
        lookup={lookup}
        onRetry={() => {
          const id = currentWorkload.ip_addresses?.[0] || currentWorkload.hostname;
          if (id) lookupWorkload(id);
        }}
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
        <p className="text-xs text-text-muted">Looking up in ServiceNow CMDB...</p>
      </div>
    );
  }

  if (lookup.status === 'not_configured') {
    return (
      <div className="card p-4 text-center">
        <svg className="w-8 h-8 mx-auto text-text-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
        </svg>
        <p className="text-sm font-medium text-text mb-1">ServiceNow not connected</p>
        <p className="text-xs text-text-muted">
          Open the Aperture popup and connect to ServiceNow to see CMDB context
        </p>
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
              This workload was not found in ServiceNow CMDB. It may be unmanaged or use a different identifier.
            </p>
          </div>
        </div>
        <button onClick={onRetry} className="btn btn-outline btn-sm mt-3 w-full">
          Retry lookup
        </button>
      </div>
    );
  }

  // Found
  const { context, matchType } = lookup;

  return (
    <div className="space-y-3">
      {/* Match header */}
      <div className="card p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
              matchType === 'multi-use' ? 'bg-amber-500' : 'bg-green-500'
            }`} />
            <span className="text-xs font-medium text-text">
              {matchType === 'multi-use' ? 'Multi-use workload' : 'CMDB match found'}
            </span>
          </div>
          {context.isMultiUse && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium">
              {context.services.length} services
            </span>
          )}
        </div>
      </div>

      {/* Server details from ServiceNow */}
      <div className="card p-4 space-y-3">
        <SectionHeader title="Server (CMDB)" />
        <Field label="Name" value={context.server.name} />
        <Field label="IP" value={context.server.ip || '—'} mono />
        {context.server.fqdn && (
          <Field label="FQDN" value={context.server.fqdn} mono />
        )}
        <Field label="OS" value={context.server.os || '—'} />
        <Field label="Environment" value={context.server.environment || '—'} />
        {context.server.classType && (
          <Field label="Class" value={context.server.classType.replace(/^cmdb_ci_/, '').replace(/_/g, ' ')} />
        )}
        {context.server.virtual && (
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-text-muted">Virtual</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 font-medium">VM</span>
          </div>
        )}
        {context.server.shortDescription && (
          <Field label="Description" value={context.server.shortDescription} />
        )}
      </div>

      {/* Services */}
      <div className="card p-4">
        <SectionHeader title={`Services (${context.services.length})`} />
        {context.services.length > 0 ? (
          <div className="space-y-1.5 mt-2">
            {(context.serviceDetails ?? context.services.map(s => ({ name: s }))).map((svc) => {
              const detail = typeof svc === 'string' ? { name: svc } : svc;
              return (
                <div
                  key={detail.name}
                  className="px-2 py-1.5 rounded-lg bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                    <span className="text-xs text-text">{detail.name}</span>
                  </div>
                  {detail.fullName && detail.fullName !== detail.name && (
                    <div className="text-[10px] text-gray-500 ml-3.5 mt-0.5">{detail.fullName}</div>
                  )}
                  {(detail.environment || detail.criticality || detail.infrastructure) && (
                    <div className="flex items-center gap-1.5 ml-3.5 mt-1 flex-wrap">
                      {detail.environment && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-blue-50 text-blue-600">
                          {detail.environment}
                        </span>
                      )}
                      {detail.criticality && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500">
                          {detail.criticality}
                        </span>
                      )}
                      {detail.infrastructure && (
                        <span className="text-[10px] px-1 py-0.5 rounded bg-gray-100 text-gray-500 capitalize">
                          {detail.infrastructure.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-text-muted mt-2">No services linked</p>
        )}
      </div>

      {/* Portfolios */}
      <div className="card p-4">
        <SectionHeader title={`Portfolios (${context.portfolios.length})`} />
        {context.portfolios.length > 0 ? (
          <div className="space-y-1.5 mt-2">
            {context.portfolios.map((portfolio) => (
              <div
                key={portfolio}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-blue-50"
              >
                <span className="w-1.5 h-1.5 rounded-sm rotate-45 bg-blue-500 flex-shrink-0" />
                <span className="text-xs font-medium text-text">{portfolio}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-text-muted mt-2">No portfolios found</p>
        )}
      </div>

      {/* Multi-use warning */}
      {context.isMultiUse && (
        <div className="flex items-start gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <div>
            <p className="text-xs font-medium text-amber-700">Multi-use workload detected</p>
            <p className="text-[10px] text-amber-600 mt-0.5">
              This server supports {context.services.length} service{context.services.length !== 1 ? 's' : ''} across {context.portfolios.length} portfolio{context.portfolios.length !== 1 ? 's' : ''}. Illumio can only assign one Application label.
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
  cmdbServerEnv,
  cmdbServiceEnvs,
  serviceDetails,
}: {
  illumioEnv: string | null;
  cmdbServerEnv: string | null;
  cmdbServiceEnvs: string[];
  serviceDetails: import('@/shared/types').ServiceInfo[];
}) {
  const normalizedIllumio = normalizeEnv(illumioEnv);

  // Determine display label: prefer Illumio label, fall back to CMDB server env
  const displayEnv = illumioEnv || cmdbServerEnv;
  if (!displayEnv) return null;

  // If no Illumio env to compare against, show badge without status dot
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

  // Compare Illumio env against CMDB server env and all service envs
  const mismatches: string[] = [];

  if (cmdbServerEnv && normalizeEnv(cmdbServerEnv) !== normalizedIllumio) {
    mismatches.push(`Server: ${cmdbServerEnv}`);
  }

  for (let i = 0; i < cmdbServiceEnvs.length; i++) {
    if (normalizeEnv(cmdbServiceEnvs[i]) !== normalizedIllumio) {
      const svcName = serviceDetails[i]?.name || `Service ${i + 1}`;
      mismatches.push(`${svcName}: ${cmdbServiceEnvs[i]}`);
    }
  }

  const hasCmdbData = cmdbServerEnv || cmdbServiceEnvs.length > 0;
  const isMatch = hasCmdbData && mismatches.length === 0;
  const hasMismatch = mismatches.length > 0;

  // Build tooltip
  let title: string;
  if (!hasCmdbData) {
    title = `Illumio: ${illumioEnv} (no CMDB data to compare)`;
  } else if (isMatch) {
    title = `Illumio env "${illumioEnv}" matches all CMDB environments`;
  } else {
    title = `Illumio: ${illumioEnv} — Mismatches: ${mismatches.join(', ')}`;
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
