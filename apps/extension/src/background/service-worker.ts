// Aperture Background Service Worker
// Handles message passing between content script, popup, and side panel

import { ServiceNowClient } from '@/shared/api/servicenow-client';
import { IllumioClient } from '@/shared/api/illumio-client';
import type { ServiceNowConfig, IllumioConfig, IllumioWorkload, ServerContext, ServiceInfo, AppComponent } from '@/shared/types';
import { db } from '@/shared/db/client';

async function getServiceNowClient(): Promise<ServiceNowClient | null> {
  const { servicenow } = await chrome.storage.local.get('servicenow');
  if (!servicenow) return null;
  const config = servicenow as ServiceNowConfig;
  return new ServiceNowClient(config.instance, config.username, config.password);
}

async function getIllumioClient(): Promise<IllumioClient | null> {
  const { illumio } = await chrome.storage.local.get('illumio');
  if (!illumio) return null;
  const config = illumio as IllumioConfig;
  return new IllumioClient(config.pceUrl, config.apiKeyId, config.apiKeySecret, config.orgId);
}

const CMDB_API = 'http://localhost:8080';

function notify(title: string, message: string) {
  chrome.notifications.create(
    `aperture-${Date.now()}`,
    {
      type: 'basic',
      iconUrl: 'icons/icon128.png',
      title,
      message,
    },
    (id) => {
      if (chrome.runtime.lastError) {
        console.warn('[Aperture] Notification error:', chrome.runtime.lastError.message);
      } else {
        console.log('[Aperture] Notification shown:', id);
      }
    }
  );
}

chrome.runtime.onInstalled.addListener(async () => {
  // Initialize validations storage
  const { validations } = await chrome.storage.local.get('validations');
  if (!validations) {
    await chrome.storage.local.set({ validations: {} });
  }

  // Clear session workloads on install/update
  await chrome.storage.session.set({ visitedWorkloads: {} });

  console.log('[Aperture] Service worker initialized');
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(err => {
      console.error('[Aperture] Message handler error:', err);
      sendResponse({ error: err.message });
    });
  return true; // async response
});

async function handleMessage(
  request: { action: string; payload?: any },
  sender: chrome.runtime.MessageSender
) {
  const { action, payload } = request;

  switch (action) {
    case 'openSidePanel':
      if (sender?.tab?.id) {
        await chrome.sidePanel.open({ tabId: sender.tab.id });
      }
      return { success: true };

    case 'workloadDetected':
      return await handleWorkloadDetected(payload, sender);

    case 'notOnWorkloadPage':
      await chrome.storage.session.set({ _currentWorkloadPage: null });
      return { acknowledged: true };

    case 'lookupCMDB':
      return await lookupCMDBRecord(payload);

    case 'saveValidation':
      return await saveValidation(payload);

    case 'markNoMatch':
      return await markNoMatch(payload);

    case 'getProgress':
      return await getProgress();

    case 'getVisitedWorkloads':
      return await getVisitedWorkloads();

    case 'getValidations':
      return await getValidations();

    case 'getCurrentWorkload':
      return await getCurrentWorkload(sender);

    case 'manualLookup':
      return await manualLookup(payload);

    case 'resetSession':
      await chrome.storage.session.set({ visitedWorkloads: {} });
      return { success: true };

    case 'openGraphPage':
      return await openOrFocusGraphTab(payload);

    case 'openGraphPopup':
      return await openGraphPopupWindow(payload);

    case 'openAdminPage':
      return await openAdminTab();

    case 'getAllCMDBData':
      return await getAllCMDBData(payload);

    case 'getServerContext':
      return await getServerContextAction(payload);

    case 'lookupCMDBWorkload':
      return await lookupCMDBWorkloadAction(payload);

    case 'getWorkloadsForService':
      return await getWorkloadsForServiceAction(payload);

    case 'getWorkloadsForPortfolio':
      return await getWorkloadsForPortfolioAction(payload);

    case 'getServiceCatalog':
      return await getServiceCatalogAction();

    case 'syncIllumioWorkloads':
      return await syncIllumioWorkloadsAction();

    // ─── Database (SQLite via Native Messaging) ─────────────
    case 'dbPing':
      return await dbPingAction();

    case 'dbQuery':
      return await dbQueryAction(payload);

    case 'dbExecute':
      return await dbExecuteAction(payload);

    case 'dbSeed':
      return await dbSeedAction(payload);

    case 'dbSeedFromServiceNow':
      return await dbSeedFromServiceNowAction(payload);

    case 'dbGetSchema':
      return await dbGetSchemaAction();

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

async function handleWorkloadDetected(
  workloadData: any,
  sender: chrome.runtime.MessageSender
) {
  if (!workloadData?.hostname && !workloadData?.workloadId) {
    return { success: false, error: 'No workload identifier' };
  }

  const key = workloadData.hostname || workloadData.workloadId || 'unknown';
  const { visitedWorkloads = {} } = await chrome.storage.session.get('visitedWorkloads');

  visitedWorkloads[key] = {
    ...workloadData,
    firstSeen: visitedWorkloads[key]?.firstSeen || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    tabId: sender?.tab?.id,
  };

  await chrome.storage.session.set({
    visitedWorkloads,
    _currentWorkloadPage: key,
  });

  return { success: true, workload: visitedWorkloads[key] };
}

async function lookupCMDBRecord(payload: { hostname: string }) {
  const client = await getServiceNowClient();
  if (!client) return { record: null, matchType: 'none', error: 'ServiceNow not configured' };

  try {
    const context = await client.getServerContext(payload.hostname);
    if (context) {
      return { record: context, matchType: context.isMultiUse ? 'multi-use' : 'exact' };
    }
    return { record: null, matchType: 'none' };
  } catch (err: any) {
    console.error('[Aperture] CMDB lookup error:', err);
    return { record: null, matchType: 'none', error: err.message };
  }
}

async function manualLookup(payload: { hostname: string }) {
  const hostname = payload?.hostname?.trim();
  if (!hostname) return { success: false, error: 'Hostname required' };

  const workloadData = {
    hostname,
    ip_addresses: [],
    os_type: null,
    labels: null,
    workloadId: null,
    url: null,
    extractedAt: new Date().toISOString(),
    isManualEntry: true,
  };

  const { visitedWorkloads = {} } = await chrome.storage.session.get('visitedWorkloads');
  visitedWorkloads[hostname] = {
    ...workloadData,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };

  await chrome.storage.session.set({ visitedWorkloads });

  const cmdb = await lookupCMDBRecord({ hostname });
  return { success: true, workload: visitedWorkloads[hostname], cmdb };
}

async function getCurrentWorkload(sender: chrome.runtime.MessageSender) {
  const tabId = sender?.tab?.id;
  if (!tabId) return { workload: null };

  const { visitedWorkloads = {} } = await chrome.storage.session.get('visitedWorkloads');
  const workload = Object.values(visitedWorkloads).find(
    (w: any) => w.tabId === tabId
  );

  return { workload: workload || null };
}

async function saveValidation(payload: {
  hostname: string;
  approvedData: any;
  edits: boolean;
}) {
  const { validations = {} } = await chrome.storage.local.get('validations');
  const { visitedWorkloads = {} } = await chrome.storage.session.get('visitedWorkloads');

  const workload = visitedWorkloads[payload.hostname];

  const validation = {
    hostname: payload.hostname,
    status: payload.edits ? 'edited' : 'validated',
    workload_data: workload,
    validated_at: new Date().toISOString(),
    edits_made: !!payload.edits,
    approved_data: payload.approvedData,
  };

  validations[payload.hostname] = validation;
  await chrome.storage.local.set({ validations });

  return validation;
}

async function markNoMatch(payload: { hostname: string; action?: string }) {
  const { validations = {} } = await chrome.storage.local.get('validations');
  const { visitedWorkloads = {} } = await chrome.storage.session.get('visitedWorkloads');

  const workload = visitedWorkloads[payload.hostname];

  const validation = {
    hostname: payload.hostname,
    status: 'no_match',
    workload_data: workload,
    validated_at: new Date().toISOString(),
    edits_made: false,
    approved_data: null,
    no_match_action: payload.action || 'orphan',
  };

  validations[payload.hostname] = validation;
  await chrome.storage.local.set({ validations });

  return validation;
}

async function getProgress() {
  const { validations = {} } = await chrome.storage.local.get('validations');
  const { visitedWorkloads = {} } = await chrome.storage.session.get('visitedWorkloads');

  const visited = Object.keys(visitedWorkloads).length;
  let validated = 0;
  let noMatch = 0;
  let pending = 0;

  for (const hostname of Object.keys(visitedWorkloads)) {
    const validation = (validations as any)[hostname];
    if (!validation || validation.status === 'pending') {
      pending++;
    } else if (validation.status === 'validated' || validation.status === 'edited') {
      validated++;
    } else if (validation.status === 'no_match') {
      noMatch++;
    }
  }

  const totalValidated = Object.values(validations).filter(
    (v: any) => v.status === 'validated' || v.status === 'edited'
  ).length;

  const totalNoMatch = Object.values(validations).filter(
    (v: any) => v.status === 'no_match'
  ).length;

  return {
    visited,
    validated,
    noMatch,
    pending,
    totalValidated,
    totalNoMatch,
    percentComplete: visited > 0 ? Math.round(((validated + noMatch) / visited) * 100) : 0,
  };
}

async function getVisitedWorkloads() {
  const { visitedWorkloads = {} } = await chrome.storage.session.get('visitedWorkloads');
  const { validations = {} } = await chrome.storage.local.get('validations');

  const enriched = Object.entries(visitedWorkloads).map(([hostname, workload]: [string, any]) => ({
    ...workload,
    validation: (validations as any)[hostname] || { status: 'pending' },
  }));

  enriched.sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
  return enriched;
}

async function getValidations() {
  const { validations = {} } = await chrome.storage.local.get('validations');
  return validations;
}

async function openOrFocusGraphTab(payload?: { focus?: string }) {
  const graphUrl = chrome.runtime.getURL('src/graph/index.html');
  const focusHash = payload?.focus ? `#focus=${encodeURIComponent(payload.focus)}` : '';
  const targetUrl = graphUrl + focusHash;
  const tabs = await chrome.tabs.query({ url: graphUrl + '*' });

  if (tabs.length > 0 && tabs[0].id) {
    // Always set the full URL to trigger a page load with the new hash.
    // Adding a timestamp query param forces Chrome to reload even if only the hash changed.
    const reloadUrl = graphUrl + `?t=${Date.now()}` + focusHash;
    await chrome.tabs.update(tabs[0].id, { active: true, url: reloadUrl });
    if (tabs[0].windowId) {
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: targetUrl });
  }

  return { success: true };
}

async function openGraphPopupWindow(payload?: { focus?: string }) {
  const graphUrl = chrome.runtime.getURL('src/graph/index.html');
  const focusHash = payload?.focus ? `#focus=${encodeURIComponent(payload.focus)}` : '';
  const targetUrl = graphUrl + focusHash;

  const width = Math.round(screen.availWidth * 0.9);
  const height = Math.round(screen.availHeight * 0.9);
  const left = Math.round((screen.availWidth - width) / 2);
  const top = Math.round((screen.availHeight - height) / 2);

  await chrome.windows.create({
    url: targetUrl,
    type: 'popup',
    width,
    height,
    left,
    top,
  });

  return { success: true };
}

async function openAdminTab() {
  const adminUrl = chrome.runtime.getURL('src/admin/index.html');
  const tabs = await chrome.tabs.query({ url: adminUrl + '*' });
  if (tabs.length > 0 && tabs[0].id) {
    await chrome.tabs.update(tabs[0].id, { active: true });
    if (tabs[0].windowId) {
      await chrome.windows.update(tabs[0].windowId, { focused: true });
    }
  } else {
    await chrome.tabs.create({ url: adminUrl });
  }
  return { success: true };
}

// ─────────────────────────────────────────────────────────────
// GRAPH DATA
// ─────────────────────────────────────────────────────────────

interface GraphRecord {
  hostname: string;
  ip?: string;
  os?: string;
  environment?: string;
  classType?: string;
  fqdn?: string;
  virtual?: boolean;
  shortDescription?: string;
  services: string[];
  serviceDetails: ServiceInfo[];
  portfolios: string[];
  isMultiUse: boolean;
  components?: AppComponent[];
}

function contextToRecord(ctx: ServerContext): GraphRecord {
  return {
    hostname: ctx.server.name,
    ip: ctx.server.ip,
    os: ctx.server.os,
    environment: ctx.server.environment,
    classType: ctx.server.classType,
    fqdn: ctx.server.fqdn,
    virtual: ctx.server.virtual,
    shortDescription: ctx.server.shortDescription,
    services: ctx.services,
    serviceDetails: ctx.serviceDetails,
    portfolios: ctx.portfolios,
    isMultiUse: ctx.isMultiUse,
    components: ctx.components,
  };
}

async function getAllCMDBData(payload?: { portfolioName?: string }) {
  const client = await getServiceNowClient();
  if (!client) return { records: [], portfolios: [], error: 'ServiceNow not configured' };

  try {
    const portfolios = await client.getPortfolios();

    // If a specific portfolio is requested, only load that
    const targetPortfolios = payload?.portfolioName
      ? portfolios.filter(p => p.name === payload.portfolioName)
      : portfolios;

    const records: GraphRecord[] = [];

    // Load data for each portfolio (limit to avoid timeouts)
    for (const portfolio of targetPortfolios.slice(0, 10)) {
      const services = await client.getServicesByPortfolio(portfolio.sysId);

      for (const service of services.slice(0, 20)) {
        const servers = await client.getServersForService(service.sysId);

        const svcDetail: ServiceInfo = {
          name: service.name,
          fullName: service.fullName,
          description: service.description,
          portfolio: portfolio.name,
          criticality: service.criticality,
          environment: service.environment,
          category: service.category,
          infrastructure: service.infrastructure,
        };

        for (const server of servers) {
          const existing = records.find(r => r.hostname === server.name);
          if (existing) {
            if (!existing.services.includes(service.name)) {
              existing.services.push(service.name);
              existing.serviceDetails.push(svcDetail);
            }
            if (!existing.portfolios.includes(portfolio.name)) {
              existing.portfolios.push(portfolio.name);
            }
            existing.isMultiUse = existing.services.length > 1 || existing.portfolios.length > 1;
          } else {
            records.push({
              hostname: server.name,
              ip: server.ip,
              os: server.type,
              environment: server.environment,
              classType: server.classType,
              fqdn: server.fqdn,
              virtual: server.virtual,
              shortDescription: server.shortDescription,
              services: [service.name],
              serviceDetails: [svcDetail],
              portfolios: [portfolio.name],
              isMultiUse: false,
              components: [], // populated below in parallel
            });
          }
        }
      }
    }

    // Fetch components for all servers in parallel
    const componentResults = await Promise.all(
      records.map(r =>
        client.getComponentsForServer(r.hostname).catch(() => [] as AppComponent[])
      )
    );
    records.forEach((r, i) => { r.components = componentResults[i]; });

    return {
      records,
      portfolios: portfolios.map(p => p.name),
    };
  } catch (err: any) {
    console.error('[Aperture] getAllCMDBData error:', err);
    return { records: [], portfolios: [], error: err.message };
  }
}

async function getServerContextAction(payload: { identifier: string }) {
  const client = await getServiceNowClient();
  if (!client) return { context: null, error: 'ServiceNow not configured' };

  try {
    const context = await client.getServerContext(payload.identifier);
    return { context };
  } catch (err: any) {
    console.error('[Aperture] getServerContext error:', err);
    return { context: null, error: err.message };
  }
}

async function getWorkloadsForServiceAction(payload: { serviceName: string }) {
  const client = await getServiceNowClient();
  if (!client) return { records: [], error: 'ServiceNow not configured' };

  try {
    const service = await client.getServiceByName(payload.serviceName);
    if (!service) return { records: [] };

    const servers = await client.getServersForService(service.sysId);

    // Resolve the portfolio name for this service
    let portfolioName = '';
    if (service.portfolioId) {
      const portfolio = await client.getPortfolioById(service.portfolioId);
      if (portfolio) portfolioName = portfolio.name;
    }

    const svcDetail: ServiceInfo = {
      name: service.name,
      fullName: service.fullName,
      description: service.description,
      portfolio: portfolioName,
      criticality: service.criticality,
      environment: service.environment,
      category: service.category,
      infrastructure: service.infrastructure,
    };

    // Build records scoped to just THIS service — don't fetch full server context
    // which would pull in unrelated services and portfolios.
    // Fetch components in parallel for all servers at once.
    const componentResults = await Promise.all(
      servers.map(server =>
        client.getComponentsForServer(server.name).catch(() => [] as AppComponent[])
      )
    );

    const records: GraphRecord[] = servers.map((server, i) => ({
      hostname: server.name,
      ip: server.ip,
      os: server.type,
      environment: server.environment,
      classType: server.classType,
      fqdn: server.fqdn,
      virtual: server.virtual,
      shortDescription: server.shortDescription,
      services: [service.name],
      serviceDetails: [svcDetail],
      portfolios: portfolioName ? [portfolioName] : [],
      isMultiUse: false,
      components: componentResults[i],
    }));

    return { records };
  } catch (err: any) {
    console.error('[Aperture] getWorkloadsForService error:', err);
    return { records: [], error: err.message };
  }
}

async function getServiceCatalogAction() {
  const client = await getServiceNowClient();
  if (!client) return { catalog: null, error: 'ServiceNow not configured' };

  try {
    const catalog = await client.getServiceCatalog();
    return { catalog };
  } catch (err: any) {
    console.error('[Aperture] getServiceCatalog error:', err);
    return { catalog: null, error: err.message };
  }
}

async function getWorkloadsForPortfolioAction(payload: { portfolioName: string }) {
  const client = await getServiceNowClient();
  if (!client) return { records: [], error: 'ServiceNow not configured' };

  try {
    const portfolio = await client.getPortfolioByName(payload.portfolioName);
    if (!portfolio) return { records: [] };

    // Get all services for this portfolio (single API call)
    const services = await client.getServicesByPortfolio(portfolio.sysId);

    // For each service, get its servers (sequential — each is 1-2 API calls)
    const recordMap = new Map<string, GraphRecord>();
    const serverNames = new Set<string>();

    for (const service of services.slice(0, 20)) {
      const servers = await client.getServersForService(service.sysId);

      const svcDetail: ServiceInfo = {
        name: service.name,
        fullName: service.fullName,
        description: service.description,
        portfolio: payload.portfolioName,
        criticality: service.criticality,
        environment: service.environment,
        category: service.category,
        infrastructure: service.infrastructure,
      };

      for (const server of servers) {
        const existing = recordMap.get(server.name);
        if (existing) {
          if (!existing.services.includes(service.name)) {
            existing.services.push(service.name);
            existing.serviceDetails.push(svcDetail);
          }
          existing.isMultiUse = existing.services.length > 1;
        } else {
          serverNames.add(server.name);
          recordMap.set(server.name, {
            hostname: server.name,
            ip: server.ip,
            os: server.type,
            environment: server.environment,
            classType: server.classType,
            fqdn: server.fqdn,
            virtual: server.virtual,
            shortDescription: server.shortDescription,
            services: [service.name],
            serviceDetails: [svcDetail],
            portfolios: [payload.portfolioName],
            isMultiUse: false,
            components: [],
          });
        }
      }
    }

    // Fetch components for all unique servers in parallel
    const serverNameList = Array.from(serverNames);
    const componentResults = await Promise.all(
      serverNameList.map(name =>
        client.getComponentsForServer(name).catch(() => [] as AppComponent[])
      )
    );
    serverNameList.forEach((name, i) => {
      const record = recordMap.get(name);
      if (record) record.components = componentResults[i];
    });

    return { records: Array.from(recordMap.values()) };
  } catch (err: any) {
    console.error('[Aperture] getWorkloadsForPortfolio error:', err);
    return { records: [], error: err.message };
  }
}

// ─────────────────────────────────────────────────────────────
// DATABASE (SQLite via Native Messaging)
// ─────────────────────────────────────────────────────────────

async function dbPingAction() {
  try {
    const result = await db.ping();
    return { connected: true, ...result };
  } catch (err: any) {
    return { connected: false, error: err.message };
  }
}

async function dbQueryAction(payload: { sql: string; params?: unknown[] }) {
  try {
    const result = await db.query(payload.sql, payload.params);
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function dbExecuteAction(payload: { sql: string; params?: unknown[] }) {
  try {
    const result = await db.execute(payload.sql, payload.params);
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function dbSeedAction(payload: { table: string; rows: Record<string, unknown>[]; upsert?: boolean }) {
  try {
    const result = await db.seed(payload.table, payload.rows, payload.upsert);
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function dbGetSchemaAction() {
  try {
    const result = await db.getSchema();
    return { success: true, ...result };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

async function dbSeedFromServiceNowAction(
  payload?: { scope?: 'portfolios' | 'assets' | 'workloads' | 'all' }
) {
  const client = await getServiceNowClient();
  if (!client) return { success: false, error: 'ServiceNow not configured' };

  const scope = payload?.scope || 'all';
  const results: Record<string, any> = {};

  try {
    // ─── Seed portfolios ──────────────────────────────────────
    if (scope === 'all' || scope === 'portfolios') {
      const portfolios = await client.getPortfolios();
      const rows = portfolios.map(p => ({
        name: p.name,
        snow_sys_id: p.sysId,
        state: p.state || null,
      }));
      results.portfolios = await db.seed('portfolios', rows, true);
    }

    // ─── Seed assets (ServiceNow services → Tier 2) ──────────
    if (scope === 'all' || scope === 'assets') {
      const allServices = await client.getServices('operational_status=1', 1000);

      // Resolve ServiceNow portfolio IDs to local portfolio row IDs
      const pfRows = (await db.query<{ id: number; snow_sys_id: string }>(
        'SELECT id, snow_sys_id FROM portfolios WHERE snow_sys_id IS NOT NULL'
      )).rows;
      const pfMap = new Map(pfRows.map(r => [r.snow_sys_id, r.id]));

      const rows = allServices
        .filter(s => s.portfolioId && pfMap.has(s.portfolioId))
        .map(s => ({
          name: s.name,
          portfolio_id: pfMap.get(s.portfolioId!)!,
          snow_sys_id: s.sysId,
          full_name: s.fullName || null,
          description: s.description || null,
          criticality: s.criticality || null,
          environment: s.environment || null,
          category: s.category || null,
          infrastructure: s.infrastructure || null,
        }));
      results.assets = await db.seed('assets', rows, true);
    }

    // ─── Seed workloads ───────────────────────────────────────
    if (scope === 'all' || scope === 'workloads') {
      const portfolios = await client.getPortfolios();
      const serverMap = new Map<string, any>();

      for (const portfolio of portfolios.slice(0, 10)) {
        const services = await client.getServicesByPortfolio(portfolio.sysId);
        for (const service of services.slice(0, 20)) {
          const servers = await client.getServersForService(service.sysId);
          for (const server of servers) {
            if (!serverMap.has(server.sysId)) {
              serverMap.set(server.sysId, server);
            }
          }
        }
      }

      const rows = Array.from(serverMap.values()).map((s: any) => ({
        hostname: s.name,
        snow_sys_id: s.sysId,
        ip_address: s.ip || null,
        fqdn: s.fqdn || null,
        os: s.os || s.type || null,
        environment: s.environment || null,
        class_type: s.classType || null,
        is_virtual: s.virtual ? 1 : 0,
        description: s.shortDescription || null,
      }));
      results.workloads = await db.seed('workloads', rows, true);
    }

    return { success: true, results };
  } catch (err: any) {
    console.error('[Aperture] dbSeedFromServiceNow error:', err);
    return { success: false, error: err.message, partialResults: results };
  }
}

// ─── CMDB API Lookup ────────────────────────────────────────

async function lookupCMDBWorkloadAction(payload: { hostname?: string; ip?: string }) {
  const hostname = payload?.hostname;
  const ip = payload?.ip;
  console.log('[Aperture] CMDB lookup request:', { hostname, ip });

  if (!hostname && !ip) {
    return { workload: null, error: 'hostname or ip required' };
  }

  try {
    const param = hostname
      ? `hostname=${encodeURIComponent(hostname)}`
      : `ip=${encodeURIComponent(ip!)}`;

    const url = `${CMDB_API}/v1/cmdb/workloads/lookup?${param}`;
    console.log('[Aperture] CMDB lookup URL:', url);

    const res = await fetch(url);
    console.log('[Aperture] CMDB lookup response status:', res.status);

    if (!res.ok) {
      return { workload: null, error: `CMDB API error: ${res.status}` };
    }

    const data = await res.json();
    console.log('[Aperture] CMDB lookup result:', data.workload ? 'found' : 'null', 'hierarchy:', data.hierarchy?.length || 0);
    return data; // { workload, hierarchy }
  } catch (err: any) {
    console.error('[Aperture] CMDB lookup error:', err);
    return { workload: null, error: err.message };
  }
}

// ─── Illumio → CMDB Sync ───────────────────────────────────

function mapIllumioWorkload(w: IllumioWorkload) {
  // Find first IPv4 address from interfaces
  const ipv4 = w.interfaces?.find(
    i => i.address && !i.address.includes(':')
  );

  // Extract labels
  const envLabel = w.labels?.find(l => l.key === 'env');
  const locLabel = w.labels?.find(l => l.key === 'loc');

  return {
    hostname: w.hostname || w.name || '',
    ip_address: ipv4?.address || null,
    fqdn: null,
    os: w.os_detail || w.os_id || null,
    environment: envLabel?.value || null,
    location: locLabel?.value || null,
    class_type: null,
    is_virtual: null,
    description: w.description || null,
  };
}

async function syncIllumioWorkloadsAction() {
  const client = await getIllumioClient();
  if (!client) return { success: false, error: 'Illumio not configured' };

  const log = (msg: string) => console.log(`[Aperture Sync] ${msg}`);

  try {
    log('Starting Illumio workload sync...');
    log('Step 1/4: Requesting async workload export from Illumio...');

    const { workloads, total } = await client.getAllWorkloads();
    log(`Step 2/4: Fetched ${workloads.length} workloads from Illumio (total: ${total})`);

    // Deduplicate by hostname — Illumio often has multiple VEN registrations
    // per host. Keep the first (most recent) entry for each hostname.
    const hostnameMap = new Map<string, ReturnType<typeof mapIllumioWorkload>>();
    for (const w of workloads) {
      const m = mapIllumioWorkload(w);
      if (m.hostname && !hostnameMap.has(m.hostname)) {
        hostnameMap.set(m.hostname, m);
      }
    }
    const mapped = Array.from(hostnameMap.values());
    log(`Step 3/4: Deduped to ${mapped.length} unique hostnames (${workloads.length - mapped.length} duplicates removed)`);

    // Send to CMDB API in batches of 500
    const BATCH_SIZE = 500;
    let created = 0, updated = 0, errors = 0;
    const totalBatches = Math.ceil(mapped.length / BATCH_SIZE);

    log(`Step 4/4: Upserting ${mapped.length} workloads in ${totalBatches} batch(es)...`);

    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const batch = mapped.slice(i, i + BATCH_SIZE);
      log(`  Batch ${batchNum}/${totalBatches}: sending ${batch.length} workloads to CMDB API...`);

      const res = await fetch(`${CMDB_API}/v1/cmdb/workloads/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workloads: batch }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        console.error('[Aperture Sync] Bulk upsert batch failed:', err);
        errors += batch.length;
        log(`  Batch ${batchNum} FAILED: ${JSON.stringify(err)}`);
        continue;
      }

      const result = await res.json();
      created += result.created || 0;
      updated += result.updated || 0;
      errors += result.errors || 0;
      log(`  Batch ${batchNum} done: +${result.created} created, +${result.updated} updated, +${result.errors} errors`);
    }

    log(`Sync complete: ${created} created, ${updated} updated, ${errors} errors out of ${mapped.length} total`);

    notify(
      'Illumio Sync Complete',
      `${created} created, ${updated} updated, ${errors} errors (${mapped.length} total)`,
    );

    return { success: true, created, updated, errors, total: mapped.length };
  } catch (err: any) {
    console.error('[Aperture Sync] Error:', err);
    log(`FAILED: ${err.message}`);

    notify('Illumio Sync Failed', err.message);

    return { success: false, error: err.message };
  }
}
