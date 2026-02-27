import { useState, useEffect } from 'react';

interface WorkloadData {
  hostname: string | null;
  ip_addresses: string[];
  os_type: string | null;
  labels: Record<string, string> | null;
  workloadId: string | null;
  url: string;
  extractedAt: string;
  isManualEntry?: boolean;
  firstSeen: string;
  lastSeen: string;
  tabId?: number;
  validation?: {
    status: string;
    validated_at?: string;
    approved_data?: any;
  };
}

export function useCurrentWorkload() {
  const [currentWorkload, setCurrentWorkload] = useState<WorkloadData | null>(null);
  const [visitedWorkloads, setVisitedWorkloads] = useState<WorkloadData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    init();

    // Listen for workload updates via session storage changes
    const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
      if (changes._currentWorkloadPage) {
        const newVal = changes._currentWorkloadPage.newValue;
        if (newVal === null) {
          setCurrentWorkload(null);
          return;
        }
      }
      if (changes.visitedWorkloads) {
        handleStorageChange(changes.visitedWorkloads.newValue || {});
      }
    };

    chrome.storage.session.onChanged.addListener(listener);
    return () => chrome.storage.session.onChanged.removeListener(listener);
  }, []);

  async function init() {
    try {
      await loadVisitedWorkloads();
      await checkCurrentTab();
    } finally {
      setLoading(false);
    }
  }

  async function loadVisitedWorkloads() {
    const result = await chrome.runtime.sendMessage({ action: 'getVisitedWorkloads' });
    setVisitedWorkloads(result || []);
  }

  async function checkCurrentTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getWorkloadData' });
        if (response?.workload) {
          setCurrentWorkload(response.workload);
        }
      }
    } catch {
      // Content script may not be loaded
    }
  }

  function handleStorageChange(visitedWorkloads: Record<string, WorkloadData>) {
    const entries = Object.entries(visitedWorkloads);
    if (entries.length === 0) return;

    let latest: WorkloadData | null = null;
    let latestTime = 0;
    for (const [, data] of entries) {
      const time = new Date(data.lastSeen).getTime();
      if (time > latestTime) {
        latestTime = time;
        latest = data;
      }
    }

    if (latest) {
      setCurrentWorkload(latest);
      loadVisitedWorkloads();
    }
  }

  return {
    currentWorkload,
    visitedWorkloads,
    loading,
  };
}
