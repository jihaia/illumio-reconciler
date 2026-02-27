import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { GraphRecord, GraphFilters, AppNode, AppEdge } from '../types';
import { getLayoutedElements } from '../utils/layout';

function parseFocusHash(): string | null {
  const hash = location.hash;
  if (!hash || !hash.startsWith('#focus=')) return null;
  const hostname = decodeURIComponent(hash.slice('#focus='.length));
  // Clear the hash so it doesn't re-apply
  history.replaceState(null, '', location.pathname + location.search);
  return hostname || null;
}

export function useGraphData() {
  const [allRecords, setAllRecords] = useState<GraphRecord[]>([]);
  const [allPortfolios, setAllPortfolios] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanding, setExpanding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);
  const [focusedHostname, setFocusedHostname] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<GraphFilters>({
    portfolio: '',
    service: '',
    search: '',
  });

  // Read hash on mount
  const initialFocus = useRef(parseFocusHash());

  useEffect(() => {
    if (initialFocus.current) {
      loadFocusedData(initialFocus.current);
    } else {
      loadAllData();
    }
  }, []);

  // Listen for hash changes (e.g. when "Visualize in Graph" is clicked again
  // with a different workload while this tab is already open)
  useEffect(() => {
    function onHashChange() {
      const focus = parseFocusHash();
      if (focus) {
        setExpandedNodes(new Set());
        loadFocusedData(focus);
      }
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // ─── Focused mode: load just the single workload's context ───
  async function loadFocusedData(hostname: string) {
    setLoading(true);
    setError(null);
    setFocusedHostname(hostname);
    setFocusedNodeId(`workload:${hostname}`);

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'getServerContext',
        payload: { identifier: hostname },
      });

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (!result?.context) {
        setError(`No CMDB record found for "${hostname}"`);
        return;
      }

      const ctx = result.context;
      const record: GraphRecord = {
        hostname: ctx.server.name,
        ip: ctx.server.ip,
        os: ctx.server.os,
        environment: ctx.server.environment,
        classType: ctx.server.classType,
        fqdn: ctx.server.fqdn,
        virtual: ctx.server.virtual,
        shortDescription: ctx.server.shortDescription,
        services: ctx.services ?? [],
        serviceDetails: ctx.serviceDetails ?? [],
        portfolios: ctx.portfolios ?? [],
        isMultiUse: ctx.isMultiUse,
        components: ctx.components,
      };

      setAllRecords([record]);
      setAllPortfolios(ctx.portfolios);
      // Update focusedNodeId with actual server name (may differ in case)
      setFocusedNodeId(`workload:${ctx.server.name}`);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load workload context');
    } finally {
      setLoading(false);
    }
  }

  // ─── Non-focused: load all CMDB data ───
  async function loadAllData() {
    setLoading(true);
    setError(null);
    try {
      const response = await chrome.runtime.sendMessage({ action: 'getAllCMDBData' });
      if (response?.error) {
        setError(response.error);
        return;
      }
      const records: GraphRecord[] = response?.records ?? [];
      const portfolios: string[] = response?.portfolios ?? [];
      setAllRecords(records);
      setAllPortfolios(portfolios);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  // ─── Expand a service or portfolio: fetch and merge new records ───
  const expandNode = useCallback(async (nodeId: string) => {
    // Don't expand if already expanded
    if (expandedNodes.has(nodeId)) return;

    setExpanding(true);
    try {
      let newRecords: GraphRecord[] = [];

      if (nodeId.startsWith('service:')) {
        const serviceName = nodeId.slice('service:'.length);
        const result = await chrome.runtime.sendMessage({
          action: 'getWorkloadsForService',
          payload: { serviceName },
        });
        newRecords = result?.records ?? [];
      } else if (nodeId.startsWith('portfolio:')) {
        const portfolioName = nodeId.slice('portfolio:'.length);
        const result = await chrome.runtime.sendMessage({
          action: 'getWorkloadsForPortfolio',
          payload: { portfolioName },
        });
        newRecords = result?.records ?? [];
      }

      // Merge new records into existing, deduplicating by hostname
      if (newRecords.length > 0) {
        setAllRecords((prev) => {
          const merged = [...prev];
          for (const newRec of newRecords) {
            const existing = merged.find(
              (r) => r.hostname.toLowerCase() === newRec.hostname.toLowerCase()
            );
            if (existing) {
              // Merge services, service details, and portfolios
              for (const s of newRec.services ?? []) {
                if (!existing.services.includes(s)) existing.services.push(s);
              }
              for (const sd of newRec.serviceDetails ?? []) {
                if (!existing.serviceDetails.some((d) => d.name === sd.name)) {
                  existing.serviceDetails.push(sd);
                }
              }
              for (const p of newRec.portfolios ?? []) {
                if (!existing.portfolios.includes(p)) existing.portfolios.push(p);
              }
              existing.isMultiUse = existing.services.length > 1 || existing.portfolios.length > 1;
            } else {
              merged.push(newRec);
            }
          }
          return merged;
        });
      }

      // Mark as expanded
      setExpandedNodes((prev) => {
        const next = new Set(prev);
        next.add(nodeId);
        return next;
      });
    } catch (err: any) {
      console.error('[Aperture] Expand error:', err);
    } finally {
      setExpanding(false);
    }
  }, [expandedNodes]);

  // In focused mode, allRecords only contains what we've loaded,
  // so visibleRecords = allRecords (no further filtering needed).
  // In non-focused mode, apply filters.
  const visibleRecords = useMemo(() => {
    if (focusedHostname) {
      return allRecords;
    }

    return allRecords.filter((r) => {
      if (filters.portfolio && !(r.portfolios ?? []).includes(filters.portfolio)) return false;
      if (filters.service && !(r.services ?? []).includes(filters.service)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        const matches =
          r.hostname.toLowerCase().includes(q) ||
          r.ip?.toLowerCase().includes(q) ||
          (r.services ?? []).some((s) => s.toLowerCase().includes(q)) ||
          (r.portfolios ?? []).some((p) => p.toLowerCase().includes(q));
        if (!matches) return false;
      }
      return true;
    });
  }, [allRecords, focusedHostname, filters]);

  // Available services based on current portfolio filter (for non-focused mode)
  const availableServices = useMemo(() => {
    const services = new Set<string>();
    const source = filters.portfolio
      ? allRecords.filter((r) => (r.portfolios ?? []).includes(filters.portfolio))
      : allRecords;
    source.forEach((r) => (r.services ?? []).forEach((s) => services.add(s)));
    return [...services].sort();
  }, [allRecords, filters.portfolio]);

  // Build React Flow nodes and edges from visible records
  const { nodes, edges } = useMemo(() => {
    return buildGraph(visibleRecords, focusedHostname);
  }, [visibleRecords, focusedHostname]);

  // Apply dagre layout
  const layouted = useMemo(() => {
    if (nodes.length === 0) return { nodes: [], edges: [] };
    return getLayoutedElements(nodes, edges, 'LR');
  }, [nodes, edges]);

  const setFilter = useCallback((key: keyof GraphFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'portfolio') {
        next.service = '';
      }
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({ portfolio: '', service: '', search: '' });
  }, []);

  const clearFocus = useCallback(() => {
    setFocusedNodeId(null);
  }, []);

  const collapseToFocus = useCallback(() => {
    if (!focusedHostname) return;
    // Reset to just the focused workload's record
    const focusRecord = allRecords.find(
      (r) => r.hostname.toLowerCase() === focusedHostname.toLowerCase()
    );
    if (focusRecord) {
      setAllRecords([focusRecord]);
    }
    setExpandedNodes(new Set());
  }, [focusedHostname, allRecords]);

  const exitFocusMode = useCallback(() => {
    setFocusedHostname(null);
    setFocusedNodeId(null);
    setExpandedNodes(new Set());
    // Reload all data for browse mode
    loadAllData();
  }, []);

  const stats = useMemo(() => {
    const portfolios = new Set<string>();
    const services = new Set<string>();
    const hostnames = new Set<string>();
    let multiUse = 0;
    visibleRecords.forEach((r) => {
      (r.portfolios ?? []).forEach((p) => portfolios.add(p));
      (r.services ?? []).forEach((s) => services.add(s));
      if (!hostnames.has(r.hostname)) {
        hostnames.add(r.hostname);
        if (r.isMultiUse) multiUse++;
      }
    });
    return {
      portfolios: portfolios.size,
      services: services.size,
      workloads: hostnames.size,
      multiUse,
    };
  }, [visibleRecords]);

  return {
    nodes: layouted.nodes,
    edges: layouted.edges,
    allPortfolios,
    availableServices,
    filters,
    setFilter,
    resetFilters,
    stats,
    loading,
    expanding,
    error,
    reload: focusedHostname ? () => loadFocusedData(focusedHostname) : loadAllData,
    focusedNodeId,
    focusedHostname,
    clearFocus,
    expandNode,
    expandedNodes,
    collapseToFocus,
    exitFocusMode,
  };
}

/** Normalize environment strings from different CMDB fields for comparison.
 *  Server `classification` and service `used_for` may use different labels
 *  for the same environment (e.g., "Production" vs "production"). */
function normalizeEnv(env?: string): string | null {
  if (!env) return null;
  const lower = env.toLowerCase().trim();
  if (lower.includes('prod') && !lower.includes('support')) return 'production';
  if (lower.includes('dev')) return 'development';
  if (lower.includes('test') || lower.includes('qa')) return 'test';
  if (lower.includes('stag')) return 'staging';
  if (lower.includes('dr') || lower.includes('disaster')) return 'dr';
  return lower;
}

/** Map component sys_class_name to a human-readable type label */
function getComponentType(className: string): string {
  // App servers
  if (className.includes('tomcat')) return 'Tomcat';
  if (className.includes('weblogic')) return 'WebLogic';
  if (className.includes('jboss')) return 'JBoss';
  if (className.includes('app_server')) return 'App Server';
  // Web servers
  if (className.includes('nginx')) return 'NGINX';
  if (className.includes('apache')) return 'Apache';
  if (className.includes('iis') || className.includes('microsoft_iis')) return 'IIS';
  if (className.includes('web_server')) return 'Web Server';
  // Databases
  if (className.includes('db_mssql')) return 'MSSQL';
  if (className.includes('db_ora_listener')) return 'Oracle Listener';
  if (className.includes('db_ora')) return 'Oracle DB';
  if (className.includes('db_postgresql')) return 'PostgreSQL';
  if (className.includes('db_mysql')) return 'MySQL';
  if (className.includes('db_mongodb')) return 'MongoDB';
  if (className.includes('db_syb')) return 'Sybase';
  if (className.includes('db_instance')) return 'Database';
  // Containers & runtime
  if (className.includes('docker')) return 'Docker';
  // Load balancers
  if (className.includes('lb_service')) return 'Load Balancer';
  // Applications
  if (className.includes('appl_license')) return 'License Server';
  if (className.includes('appl')) return 'Application';
  return className.replace(/^cmdb_ci_/, '').replace(/_/g, ' ');
}

function buildGraph(
  records: GraphRecord[],
  focusedHostname: string | null
): { nodes: AppNode[]; edges: AppEdge[] } {
  const nodes: AppNode[] = [];
  const edges: AppEdge[] = [];
  const seenPortfolios = new Set<string>();
  const seenServices = new Set<string>();
  const seenComponents = new Set<string>();
  const seenWorkloads = new Set<string>();
  const seenEdges = new Set<string>();

  for (const record of records) {
    // Portfolio nodes
    for (const portfolio of record.portfolios ?? []) {
      if (!seenPortfolios.has(portfolio)) {
        seenPortfolios.add(portfolio);
        const pfRecords = records.filter((r) => (r.portfolios ?? []).includes(portfolio));
        const pfServices = new Set<string>();
        pfRecords.forEach((r) => (r.services ?? []).forEach((s) => pfServices.add(s)));
        const pfHosts = new Set(pfRecords.map((r) => r.hostname));

        nodes.push({
          id: `portfolio:${portfolio}`,
          type: 'portfolio',
          position: { x: 0, y: 0 },
          data: {
            label: portfolio,
            name: portfolio,
            productCount: pfServices.size,
            workloadCount: pfHosts.size,
          },
        });
      }
    }

    // Service (Product) nodes
    for (const service of record.services ?? []) {
      if (!seenServices.has(service)) {
        seenServices.add(service);
        const svcRecords = records.filter((r) => (r.services ?? []).includes(service));
        const svcHosts = new Set(svcRecords.map((r) => r.hostname));

        // Find enriched service detail from any record that has it
        const svcDetail = records
          .flatMap((r) => r.serviceDetails ?? [])
          .find((d) => d.name === service);

        // Use the service's own portfolio (from ServiceInfo), not the workload's portfolios
        const svcPortfolio = svcDetail?.portfolio ?? (svcRecords[0]?.portfolios ?? [])[0] ?? '';

        nodes.push({
          id: `service:${service}`,
          type: 'service',
          position: { x: 0, y: 0 },
          data: {
            label: service,
            name: service,
            fullName: svcDetail?.fullName,
            description: svcDetail?.description,
            portfolio: svcPortfolio,
            workloadCount: svcHosts.size,
            criticality: svcDetail?.criticality,
            environment: svcDetail?.environment,
            category: svcDetail?.category,
            infrastructure: svcDetail?.infrastructure,
          },
        });

        // Edge: portfolio -> service (each service belongs to exactly one portfolio)
        if (svcPortfolio) {
          const edgeKey = `${svcPortfolio}->svc:${service}`;
          if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
            edges.push({
              id: edgeKey,
              source: `portfolio:${svcPortfolio}`,
              target: `service:${service}`,
              type: 'bezier',
              style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
              animated: false,
            });
          }
        }
      }
    }

    // Component nodes (children of this workload/server)
    const hasComponents = record.components && record.components.length > 0;
    if (hasComponents) {
      for (const comp of record.components!) {
        // Dedup by name (not sys_id) — ServiceNow may have duplicate CIs with
        // different sys_ids but the same name (e.g. 3x "Tomcat@denwebarcgis01d")
        const compId = `component:${comp.name}`;
        if (!seenComponents.has(compId)) {
          seenComponents.add(compId);
          const compType = getComponentType(comp.className);

          nodes.push({
            id: compId,
            type: 'component',
            position: { x: 0, y: 0 },
            data: {
              label: comp.name,
              name: comp.name,
              className: comp.className,
              componentType: compType,
              shortDescription: comp.shortDescription,
              serverName: record.hostname,
            },
          });
        }

        // Edge: component -> workload
        const compWlEdgeKey = `comp:${comp.name}->wl:${record.hostname}`;
        if (!seenEdges.has(compWlEdgeKey)) {
          seenEdges.add(compWlEdgeKey);
          edges.push({
            id: compWlEdgeKey,
            source: compId,
            target: `workload:${record.hostname}`,
            type: 'bezier',
            style: { stroke: '#a5b4fc', strokeWidth: 1.5 },
            animated: false,
          });
        }
      }
    }

    // Workload nodes
    if (!seenWorkloads.has(record.hostname)) {
      seenWorkloads.add(record.hostname);
      const isFocused =
        focusedHostname &&
        record.hostname.toLowerCase() === focusedHostname.toLowerCase();

      // Detect environment mismatches between workload and its services
      const envMismatches: Array<{ service: string; serviceEnv: string }> = [];
      const workloadEnv = normalizeEnv(record.environment);
      if (workloadEnv) {
        for (const svcName of record.services ?? []) {
          const svcDetail = (record.serviceDetails ?? []).find((d) => d.name === svcName);
          const svcEnv = normalizeEnv(svcDetail?.environment);
          if (svcEnv && svcEnv !== workloadEnv) {
            envMismatches.push({ service: svcName, serviceEnv: svcDetail!.environment! });
          }
        }
      }

      nodes.push({
        id: `workload:${record.hostname}`,
        type: 'workload',
        position: { x: 0, y: 0 },
        data: {
          label: record.hostname,
          hostname: record.hostname,
          ip: record.ip,
          os: record.os,
          environment: record.environment,
          classType: record.classType,
          fqdn: record.fqdn,
          virtual: record.virtual,
          shortDescription: record.shortDescription,
          services: record.services ?? [],
          portfolios: record.portfolios ?? [],
          isMultiUse: record.isMultiUse,
          isFocused: !!isFocused,
          envMismatches: envMismatches.length > 0 ? envMismatches : undefined,
          components: hasComponents ? record.components!.map((c) => c.name) : undefined,
        },
      });
    }

    // Edges: service -> component (if components exist) or service -> workload (direct)
    for (const service of record.services ?? []) {
      if (hasComponents) {
        // Connect service to each component on this server
        for (const comp of record.components!) {
          const edgeKey = `svc:${service}->comp:${comp.name}`;
          if (!seenEdges.has(edgeKey)) {
            seenEdges.add(edgeKey);
            edges.push({
              id: edgeKey,
              source: `service:${service}`,
              target: `component:${comp.name}`,
              type: 'bezier',
              style: { stroke: '#cbd5e1', strokeWidth: 1.5 },
              animated: false,
            });
          }
        }
      } else {
        // No components: direct service -> workload edge
        const edgeKey = `svc:${service}->wl:${record.hostname}`;
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey);
          edges.push({
            id: edgeKey,
            source: `service:${service}`,
            target: `workload:${record.hostname}`,
            type: 'bezier',
            style: {
              stroke: record.isMultiUse ? '#fbbf24' : '#cbd5e1',
              strokeWidth: record.isMultiUse ? 2 : 1.5,
            },
            animated: false,
          });
        }
      }
    }
  }

  return { nodes, edges };
}
