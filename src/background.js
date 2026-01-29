// Service Worker for Illumio CMDB Reconciler
// Handles message passing and storage operations

import { lookupCMDB } from './mock-data.js';

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

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
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
      // Notify side panel that we're not on a workload detail page
      try {
        await chrome.runtime.sendMessage({
          action: 'notOnWorkloadPage',
          payload: payload,
        });
      } catch (e) {
        // Side panel may not be open
      }
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

  await chrome.storage.session.set({ [STORAGE_KEYS.VISITED_WORKLOADS]: visitedWorkloads });

  // Notify side panel of new workload
  try {
    await chrome.runtime.sendMessage({
      action: 'workloadUpdated',
      payload: visitedWorkloads[key],
    });
  } catch (e) {
    // Side panel may not be open
  }

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
