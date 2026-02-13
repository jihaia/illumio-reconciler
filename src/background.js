// Service Worker for Illumio CMDB Reconciler
// Handles message passing and storage operations

import { lookupCMDB, getAllCMDBRecords, APPLICATIONS, getPortfolios, getApplicationsByPortfolio, getProductsByPortfolio, getApplicationsByProduct, getProductsByApplication, getRecordsByFilters } from './mock-data.js';

// Storage keys
const STORAGE_KEYS = {
  VALIDATIONS: 'validations',
  VISITED_WORKLOADS: 'visitedWorkloads',
};

// Initialize storage on install
chrome.runtime.onInstalled.addListener(async () => {
  // Initialize validations if not present
  const { validations } = await chrome.storage.local.get(STORAGE_KEYS.VALIDATIONS);
  if (!validations) {
    await chrome.storage.local.set({ [STORAGE_KEYS.VALIDATIONS]: {} });
  }

  // Clear session workloads on install/update
  await chrome.storage.session.set({ [STORAGE_KEYS.VISITED_WORKLOADS]: {} });

  console.log('Illumio Reconciler: Service worker initialized');
});

// Message handler
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(err => {
      console.error('Message handler error:', err);
      sendResponse({ error: err.message });
    });

  // Return true to indicate async response
  return true;
});

async function handleMessage(request, sender) {
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
      // Store navigation state so side panel can detect via storage listener
      await chrome.storage.session.set({ _currentWorkloadPage: null });
      return { acknowledged: true };

    case 'lookupCMDB':
      return lookupCMDBRecord(payload);

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
      return await resetSession();

    case 'getAllCMDBData':
      return {
        records: getAllCMDBRecords(),
        applications: APPLICATIONS,
        portfolios: getPortfolios(),
      };

    case 'getFilteredCMDBData':
      return {
        records: getRecordsByFilters(payload),
        products: payload?.portfolio
          ? getProductsByPortfolio(payload.portfolio)
          : [],
        applications: payload?.product
          ? getApplicationsByProduct(payload.product).map(name => ({ name }))
          : payload?.portfolio
            ? getApplicationsByPortfolio(payload.portfolio).map(name => ({ name }))
            : APPLICATIONS,
      };

    case 'openGraphPage':
      return await openOrFocusGraphTab(payload);

    case 'openGraphPopup':
      return await openGraphPopupWindow(payload);

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// Handle workload detected from content script
async function handleWorkloadDetected(workloadData, sender) {
  if (!workloadData?.hostname && !workloadData?.workloadId) {
    return { success: false, error: 'No workload identifier' };
  }

  const key = workloadData.hostname || workloadData.workloadId || 'unknown';

  // Store in session storage (visited workloads this session)
  const { visitedWorkloads = {} } = await chrome.storage.session.get(STORAGE_KEYS.VISITED_WORKLOADS);

  visitedWorkloads[key] = {
    ...workloadData,
    firstSeen: visitedWorkloads[key]?.firstSeen || new Date().toISOString(),
    lastSeen: new Date().toISOString(),
    tabId: sender?.tab?.id,
  };

  await chrome.storage.session.set({
    [STORAGE_KEYS.VISITED_WORKLOADS]: visitedWorkloads,
    _currentWorkloadPage: key,
  });

  // Side panel is notified via chrome.storage.session.onChanged listener
  return { success: true, workload: visitedWorkloads[key] };
}

// Lookup CMDB record
function lookupCMDBRecord({ hostname }) {
  const record = lookupCMDB(hostname);

  if (record) {
    return {
      record,
      matchType: record._matchType || 'exact',
      matchedKey: record._matchedKey,
    };
  }

  return { record: null, matchType: 'none' };
}

// Manual hostname lookup
async function manualLookup({ hostname }) {
  if (!hostname) {
    return { success: false, error: 'Hostname required' };
  }

  // Create a workload entry from manual input
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

  // Store in visited workloads
  const { visitedWorkloads = {} } = await chrome.storage.session.get(STORAGE_KEYS.VISITED_WORKLOADS);

  visitedWorkloads[hostname] = {
    ...workloadData,
    firstSeen: new Date().toISOString(),
    lastSeen: new Date().toISOString(),
  };

  await chrome.storage.session.set({ [STORAGE_KEYS.VISITED_WORKLOADS]: visitedWorkloads });

  // Lookup CMDB
  const cmdbResult = lookupCMDBRecord({ hostname });

  return {
    success: true,
    workload: visitedWorkloads[hostname],
    cmdb: cmdbResult,
  };
}

// Get current workload for active tab
async function getCurrentWorkload(sender) {
  const tabId = sender?.tab?.id;
  if (!tabId) return { workload: null };

  const { visitedWorkloads = {} } = await chrome.storage.session.get(STORAGE_KEYS.VISITED_WORKLOADS);

  // Find workload for this tab
  const workload = Object.values(visitedWorkloads).find(w => w.tabId === tabId);

  return { workload: workload || null };
}

// Save validation
async function saveValidation({ hostname, approvedData, edits }) {
  const { validations = {} } = await chrome.storage.local.get(STORAGE_KEYS.VALIDATIONS);
  const { visitedWorkloads = {} } = await chrome.storage.session.get(STORAGE_KEYS.VISITED_WORKLOADS);

  const workload = visitedWorkloads[hostname];
  const cmdbRecord = lookupCMDB(hostname);

  const validation = {
    hostname,
    status: edits ? 'edited' : 'validated',
    cmdb_source: cmdbRecord,
    workload_data: workload,
    validated_by: 'demo.user@acme.com',
    validated_at: new Date().toISOString(),
    edits_made: !!edits,
    approved_data: approvedData,
  };

  validations[hostname] = validation;
  await chrome.storage.local.set({ [STORAGE_KEYS.VALIDATIONS]: validations });

  return validation;
}

// Mark workload as having no CMDB match
async function markNoMatch({ hostname, action = 'orphan' }) {
  const { validations = {} } = await chrome.storage.local.get(STORAGE_KEYS.VALIDATIONS);
  const { visitedWorkloads = {} } = await chrome.storage.session.get(STORAGE_KEYS.VISITED_WORKLOADS);

  const workload = visitedWorkloads[hostname];

  const validation = {
    hostname,
    status: 'no_match',
    cmdb_source: null,
    workload_data: workload,
    validated_by: 'demo.user@acme.com',
    validated_at: new Date().toISOString(),
    edits_made: false,
    approved_data: null,
    no_match_action: action,
  };

  validations[hostname] = validation;
  await chrome.storage.local.set({ [STORAGE_KEYS.VALIDATIONS]: validations });

  return validation;
}

// Get progress statistics
async function getProgress() {
  const { validations = {} } = await chrome.storage.local.get(STORAGE_KEYS.VALIDATIONS);
  const { visitedWorkloads = {} } = await chrome.storage.session.get(STORAGE_KEYS.VISITED_WORKLOADS);

  const visited = Object.keys(visitedWorkloads).length;
  let validated = 0;
  let noMatch = 0;
  let pending = 0;

  // Count validations for visited workloads
  for (const hostname of Object.keys(visitedWorkloads)) {
    const validation = validations[hostname];

    if (!validation || validation.status === 'pending') {
      pending++;
    } else if (validation.status === 'validated' || validation.status === 'edited') {
      validated++;
    } else if (validation.status === 'no_match') {
      noMatch++;
    }
  }

  // Also count any previously validated workloads
  const totalValidated = Object.values(validations).filter(
    v => v.status === 'validated' || v.status === 'edited'
  ).length;

  const totalNoMatch = Object.values(validations).filter(
    v => v.status === 'no_match'
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

// Get visited workloads for this session
async function getVisitedWorkloads() {
  const { visitedWorkloads = {} } = await chrome.storage.session.get(STORAGE_KEYS.VISITED_WORKLOADS);
  const { validations = {} } = await chrome.storage.local.get(STORAGE_KEYS.VALIDATIONS);

  // Enrich with validation status
  const enriched = Object.entries(visitedWorkloads).map(([hostname, workload]) => ({
    ...workload,
    validation: validations[hostname] || { status: 'pending' },
  }));

  // Sort by lastSeen (most recent first)
  enriched.sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

  return enriched;
}

// Get all validations
async function getValidations() {
  const { validations = {} } = await chrome.storage.local.get(STORAGE_KEYS.VALIDATIONS);
  return validations;
}

// Reset session (clear visited workloads)
async function resetSession() {
  await chrome.storage.session.set({ [STORAGE_KEYS.VISITED_WORKLOADS]: {} });
  return { success: true };
}

// Open graph tab or focus existing one
// If payload.focus is provided, the graph page will auto-focus on that hostname
async function openOrFocusGraphTab(payload) {
  const graphUrl = chrome.runtime.getURL('graph/index.html');
  const focusHash = payload?.focus ? `#focus=${encodeURIComponent(payload.focus)}` : '';
  const targetUrl = graphUrl + focusHash;
  const tabs = await chrome.tabs.query({ url: graphUrl });

  if (tabs.length > 0) {
    // Update existing tab with the new hash to trigger focus
    await chrome.tabs.update(tabs[0].id, { active: true, url: targetUrl });
    await chrome.windows.update(tabs[0].windowId, { focused: true });
  } else {
    await chrome.tabs.create({ url: targetUrl });
  }

  return { success: true };
}

// Open graph in a popup window (for content script visualize button)
async function openGraphPopupWindow(payload) {
  const graphUrl = chrome.runtime.getURL('graph/index.html');
  const focusHash = payload?.focus ? `#focus=${encodeURIComponent(payload.focus)}` : '';
  const targetUrl = graphUrl + focusHash;

  // Size the popup to ~90% of the screen
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
