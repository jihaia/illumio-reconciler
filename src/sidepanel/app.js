// Vanilla JavaScript app for Illumio CMDB Reconciler Side Panel
// Replaces Alpine.js to avoid CSP issues in Chrome extensions

class ReconcilerApp {
  constructor() {
    // View state
    this.view = 'workload'; // 'workload' | 'dashboard'

    // Data
    this.visitedWorkloads = [];
    this.currentWorkload = null;
    this.currentIndex = -1;
    this.cmdbRecord = null;
    this.cmdbMatchType = 'none';
    this.cmdbMatchedKey = null;

    // Manual entry
    this.manualHostname = '';

    // Edit state
    this.editMode = false;
    this.editedFields = {};

    // UI state
    this.loading = true;
    this.saving = false;
    this.isOnDetailPage = false; // Track if we're on a workload detail page vs list page

    // Progress
    this.progress = {
      visited: 0,
      validated: 0,
      pending: 0,
      noMatch: 0,
      totalValidated: 0,
      totalNoMatch: 0,
      percentComplete: 0,
    };

    this.init();
  }

  async init() {
    console.log('[SidePanel] Initializing...');
    try {
      await this.loadVisitedWorkloads();
      console.log('[SidePanel] Loaded visited workloads:', this.visitedWorkloads.length);
      await this.loadProgress();
      console.log('[SidePanel] Loaded progress:', this.progress);

      // Listen for workload updates via session storage changes
      // (background writes to session storage when workloads are detected/cleared)
      chrome.storage.session.onChanged.addListener((changes) => {
        if (changes._currentWorkloadPage) {
          const newVal = changes._currentWorkloadPage.newValue;
          if (newVal === null) {
            console.log('[SidePanel] Storage: navigated away from workload page');
            this.isOnDetailPage = false;
            this.currentWorkload = null;
            this.cmdbRecord = null;
            this.render();
            return;
          }
        }
        if (changes.visitedWorkloads) {
          console.log('[SidePanel] Storage changed: visitedWorkloads updated');
          this.handleStorageChange(changes.visitedWorkloads.newValue || {});
        }
      });

      // Check if there's already a workload in the current tab
      await this.checkCurrentTab();
    } catch (err) {
      console.error('[SidePanel] Init error:', err);
    } finally {
      this.loading = false;
      console.log('[SidePanel] Init complete');
      this.render();
    }
  }

  async checkCurrentTab() {
    console.log('[SidePanel] Checking current tab for workload...');
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      console.log('[SidePanel] Current tab:', tab?.id, tab?.url);
      if (tab?.id) {
        const response = await chrome.tabs.sendMessage(tab.id, { action: 'getWorkloadData' });
        console.log('[SidePanel] Response from content script:', response);
        if (response?.workload) {
          console.log('[SidePanel] Got workload from tab:', response.workload.hostname);
          this.isOnDetailPage = true;
          await this.handleWorkloadUpdate(response.workload);
        } else {
          // Check if we're on an Illumio page but not a detail page (e.g., list view)
          this.isOnDetailPage = response?.isOnWorkloadPage === true;
          console.log('[SidePanel] Is on detail page:', this.isOnDetailPage);
        }
      }
    } catch (e) {
      console.log('[SidePanel] Could not query current tab:', e.message);
    }
  }

  async handleWorkloadUpdate(workloadData) {
    console.log('[SidePanel] handleWorkloadUpdate:', workloadData?.hostname);
    if (!workloadData) return;

    await this.loadVisitedWorkloads();
    console.log('[SidePanel] Refreshed visited workloads:', this.visitedWorkloads.length);

    const workload = this.visitedWorkloads.find(w => w.hostname === workloadData.hostname);
    console.log('[SidePanel] Found workload in list:', !!workload);
    if (workload) {
      await this.selectWorkload(workload);
    }
  }

  async handleStorageChange(visitedWorkloads) {
    // Find the most recently updated workload
    const entries = Object.entries(visitedWorkloads);
    if (entries.length === 0) return;

    // Sort by lastSeen to find the most recent
    let latest = null;
    let latestTime = 0;
    for (const [hostname, data] of entries) {
      const time = new Date(data.lastSeen).getTime();
      if (time > latestTime) {
        latestTime = time;
        latest = data;
      }
    }

    if (!latest) return;

    // Only update if this is a genuinely new/changed workload
    // (avoid re-rendering when nothing relevant changed)
    const currentHostname = this.currentWorkload?.hostname;
    const latestHostname = latest.hostname;

    // If we already show this workload and it hasn't changed, skip
    if (currentHostname === latestHostname && this.cmdbRecord) return;

    console.log('[SidePanel] Storage-based update, latest workload:', latestHostname);
    this.isOnDetailPage = true;
    await this.handleWorkloadUpdate(latest);
  }

  async loadVisitedWorkloads() {
    this.visitedWorkloads = await chrome.runtime.sendMessage({ action: 'getVisitedWorkloads' }) || [];
  }

  async loadProgress() {
    this.progress = await chrome.runtime.sendMessage({ action: 'getProgress' }) || this.progress;
  }

  async selectWorkload(workload) {
    console.log('[SidePanel] selectWorkload:', workload?.hostname);
    if (!workload) {
      this.currentWorkload = null;
      this.cmdbRecord = null;
      this.currentIndex = -1;
      this.render();
      return;
    }

    this.editMode = false;
    this.editedFields = {};
    this.currentWorkload = workload;
    this.currentIndex = this.visitedWorkloads.findIndex(w => w.hostname === workload.hostname);
    console.log('[SidePanel] Set currentWorkload:', this.currentWorkload?.hostname, 'index:', this.currentIndex);

    // Lookup CMDB record
    console.log('[SidePanel] Looking up CMDB for:', workload.hostname);
    const cmdbResponse = await chrome.runtime.sendMessage({
      action: 'lookupCMDB',
      payload: { hostname: workload.hostname },
    });
    console.log('[SidePanel] CMDB response:', cmdbResponse);

    this.cmdbRecord = cmdbResponse?.record;
    this.cmdbMatchType = cmdbResponse?.matchType || 'none';
    this.cmdbMatchedKey = cmdbResponse?.matchedKey;
    console.log('[SidePanel] Set cmdbRecord:', !!this.cmdbRecord, 'matchType:', this.cmdbMatchType);

    if (workload.validation?.approved_data) {
      this.editedFields = { ...workload.validation.approved_data };
    }

    this.render();
  }

  clearWorkload() {
    this.currentWorkload = null;
    this.cmdbRecord = null;
    this.cmdbMatchType = 'none';
    this.cmdbMatchedKey = null;
    this.currentIndex = -1;
    this.editMode = false;
    this.editedFields = {};
    this.render();
  }

  async lookupManual() {
    const hostname = this.manualHostname.trim();
    if (!hostname) return;

    this.loading = true;
    this.render();

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'manualLookup',
        payload: { hostname },
      });

      if (response?.success) {
        await this.loadVisitedWorkloads();
        await this.loadProgress();

        const workload = this.visitedWorkloads.find(w => w.hostname === hostname);
        if (workload) {
          await this.selectWorkload(workload);
          this.view = 'workload';
        }
      }

      this.manualHostname = '';
    } catch (err) {
      console.error('Manual lookup error:', err);
    } finally {
      this.loading = false;
      this.render();
    }
  }

  async confirmAndSave() {
    if (!this.currentWorkload || !this.cmdbRecord) return;

    this.saving = true;
    this.render();

    try {
      const approvedData = {
        application: this.editedFields.application ?? this.cmdbRecord.application,
        product_portfolio: this.editedFields.product_portfolio ?? this.cmdbRecord.product_portfolio,
        business_owner: this.editedFields.business_owner ?? this.cmdbRecord.business_owner,
        business_owner_email: this.editedFields.business_owner_email ?? this.cmdbRecord.business_owner_email,
        technical_owner: this.editedFields.technical_owner ?? this.cmdbRecord.technical_owner,
        technical_owner_email: this.editedFields.technical_owner_email ?? this.cmdbRecord.technical_owner_email,
        criticality: this.editedFields.criticality ?? this.cmdbRecord.criticality,
        environment: this.editedFields.environment ?? this.cmdbRecord.environment,
        compliance_scope: this.editedFields.compliance_scope ?? this.cmdbRecord.compliance_scope,
      };

      const hasEdits = Object.keys(this.editedFields).length > 0;

      await chrome.runtime.sendMessage({
        action: 'saveValidation',
        payload: {
          hostname: this.currentWorkload.hostname,
          approvedData,
          edits: hasEdits,
        },
      });

      await this.loadVisitedWorkloads();
      await this.loadProgress();

      const updated = this.visitedWorkloads.find(w => w.hostname === this.currentWorkload.hostname);
      if (updated) {
        this.currentWorkload = updated;
      }

      this.editMode = false;
    } catch (err) {
      console.error('Save error:', err);
    } finally {
      this.saving = false;
      this.render();
    }
  }

  async markAsOrphan() {
    if (!this.currentWorkload) return;

    this.saving = true;
    this.render();

    try {
      await chrome.runtime.sendMessage({
        action: 'markNoMatch',
        payload: {
          hostname: this.currentWorkload.hostname,
          action: 'orphan',
        },
      });

      await this.loadVisitedWorkloads();
      await this.loadProgress();

      const updated = this.visitedWorkloads.find(w => w.hostname === this.currentWorkload.hostname);
      if (updated) {
        this.currentWorkload = updated;
      }

      if (this.hasNextPending()) {
        this.nextPending();
      }
    } catch (err) {
      console.error('Mark orphan error:', err);
    } finally {
      this.saving = false;
      this.render();
    }
  }

  hasNextPending() {
    return this.visitedWorkloads.some((w, i) =>
      i !== this.currentIndex && (!w.validation || w.validation.status === 'pending')
    );
  }

  nextPending() {
    let nextIndex = this.visitedWorkloads.findIndex((w, i) =>
      i > this.currentIndex && (!w.validation || w.validation.status === 'pending')
    );

    if (nextIndex === -1) {
      nextIndex = this.visitedWorkloads.findIndex(w =>
        !w.validation || w.validation.status === 'pending'
      );
    }

    if (nextIndex !== -1) {
      this.selectWorkload(this.visitedWorkloads[nextIndex]);
    }
  }

  previousWorkload() {
    if (this.currentIndex > 0) {
      this.selectWorkload(this.visitedWorkloads[this.currentIndex - 1]);
    }
  }

  toggleView() {
    this.view = this.view === 'workload' ? 'dashboard' : 'workload';
    this.render();
  }

  getLabelPreview() {
    if (!this.cmdbRecord) return [];

    const c = this.cmdbRecord;
    const fields = { ...c, ...this.editedFields };
    const labels = [];

    labels.push({ key: 'validated', value: 'yes' });
    labels.push({ key: 'validated_by', value: 'demo.user@acme.com' });

    if (fields.application) {
      labels.push({ key: 'app', value: this.normalizeLabel(fields.application) });
    }
    if (fields.product_portfolio) {
      labels.push({ key: 'portfolio', value: this.normalizeLabel(fields.product_portfolio) });
    }

    // Add labels for additional applications (multi-use workloads)
    if (c.applications && c.applications.length > 0) {
      labels.push({ key: 'multi_use', value: 'true' });
      c.applications.forEach((app, i) => {
        labels.push({ key: `app_${i + 2}`, value: this.normalizeLabel(app.application) });
        if (app.product_portfolio && app.product_portfolio !== fields.product_portfolio) {
          labels.push({ key: `portfolio_${i + 2}`, value: this.normalizeLabel(app.product_portfolio) });
        }
      });
    }

    if (fields.criticality) {
      labels.push({ key: 'criticality', value: fields.criticality });
    }
    if (fields.business_owner) {
      labels.push({ key: 'business_owner', value: this.normalizeLabel(fields.business_owner) });
    }
    if (fields.compliance_scope?.length > 0) {
      labels.push({ key: 'compliance', value: fields.compliance_scope.join('-').toLowerCase() });
    }

    return labels;
  }

  normalizeLabel(value) {
    if (!value) return '';
    return value
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;

    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;

    return this.formatDate(dateStr);
  }

  getStatusLabel(status) {
    const labels = {
      pending: 'Pending',
      validated: 'Validated',
      edited: 'Validated (Edited)',
      no_match: 'No Match',
    };
    return labels[status] || 'Pending';
  }

  getStatusBadgeClass(status) {
    const classes = {
      pending: 'badge-pending',
      validated: 'badge-validated',
      edited: 'badge-edited',
      no_match: 'badge-no-match',
    };
    return classes[status] || 'badge-pending';
  }

  getCriticalityLabel(tier) {
    const labels = {
      tier1: 'Tier 1 - Mission Critical',
      tier2: 'Tier 2 - Business Critical',
      tier3: 'Tier 3 - Business Operational',
      tier4: 'Tier 4 - Administrative',
    };
    return labels[tier] || '—';
  }

  getCriticalityClass(tier) {
    const classes = {
      tier1: 'criticality-tier1',
      tier2: 'criticality-tier2',
      tier3: 'criticality-tier3',
      tier4: 'criticality-tier4',
    };
    return classes[tier] || '';
  }

  getMatchIndicatorHtml() {
    if (this.cmdbMatchType === 'exact') {
      return `<span class="flex items-center gap-1">
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
        Exact CMDB match
      </span>`;
    } else if (this.cmdbMatchType === 'generated') {
      return `<span class="flex items-center gap-1">
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>
        CMDB match (demo data)
      </span>`;
    } else if (this.cmdbMatchType === 'partial' || this.cmdbMatchType === 'pattern') {
      return `<span class="flex items-center gap-1">
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>
        Partial match (CMDB: ${this.cmdbMatchedKey})
      </span>`;
    } else {
      return `<span class="flex items-center gap-1">
        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
        No CMDB match
      </span>`;
    }
  }

  getMatchIndicatorClass() {
    if (this.cmdbMatchType === 'none') return 'match-none';
    if (this.cmdbMatchType === 'exact' || this.cmdbMatchType === 'generated') return 'match-hostname';
    return 'match-ip';
  }

  render() {
    const app = document.getElementById('app');
    if (!app) return;

    app.innerHTML = this.getHtml();
    this.bindEvents();
  }

  getHtml() {
    return `
      ${this.getHeaderHtml()}
      <main class="p-4 pb-24">
        ${this.loading ? this.getLoadingHtml() : ''}
        ${!this.loading && this.view === 'dashboard' ? this.getDashboardHtml() : ''}
        ${!this.loading && this.view === 'workload' ? this.getWorkloadViewHtml() : ''}
      </main>
      ${this.getFooterHtml()}
    `;
  }

  getHeaderHtml() {
    return `
      <header class="sticky top-0 bg-white border-b border-border z-10">
        <div class="px-4 py-3">
          <div class="flex items-center justify-between mb-3">
            <h1 class="text-lg font-semibold text-text">ServiceNow <span class="ml-1 inline-flex items-center px-1.5 h-4 rounded-full text-[10px] font-medium bg-green-100 text-green-800">Connected</span></h1>
            <div class="flex items-center gap-2">
              <button id="openGraphBtn" class="btn btn-sm btn-outline flex items-center gap-1 py-1" title="Open Network Graph">
                <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="5" r="2"/>
                  <circle cx="5" cy="19" r="2"/>
                  <circle cx="19" cy="19" r="2"/>
                  <path d="M12 7v4M7.5 17.5L11 13M16.5 17.5L13 13" stroke-linecap="round"/>
                </svg>
                <span class="text-xs">Graph</span>
              </button>
              <button id="toggleViewBtn" class="text-sm text-primary hover:text-primary-600 font-medium">
                ${this.view === 'workload' ? 'View All' : '← Back'}
              </button>
            </div>
          </div>
          ${this.progress.visited > 0 ? `
            <div class="space-y-1">
              <div class="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div class="progress-bar bg-primary" style="width: ${this.progress.percentComplete}%"></div>
              </div>
              <p class="text-xs text-text-muted">
                ${this.progress.validated + this.progress.noMatch} of ${this.progress.visited} visited workloads processed (${this.progress.percentComplete}%)
              </p>
            </div>
          ` : `
            <p class="text-xs text-text-muted">Navigate to Illumio workloads to begin reconciliation</p>
          `}
        </div>
      </header>
    `;
  }

  getLoadingHtml() {
    return `
      <div class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </div>
    `;
  }

  getDashboardHtml() {
    return `
      <div class="grid grid-cols-3 gap-3 mb-4">
        <div class="card p-3 text-center">
          <div class="text-2xl font-bold text-success">${this.progress.validated}</div>
          <div class="text-xs text-text-muted">Validated</div>
        </div>
        <div class="card p-3 text-center">
          <div class="text-2xl font-bold text-warning">${this.progress.pending}</div>
          <div class="text-xs text-text-muted">Pending</div>
        </div>
        <div class="card p-3 text-center">
          <div class="text-2xl font-bold text-danger">${this.progress.noMatch}</div>
          <div class="text-xs text-text-muted">No Match</div>
        </div>
      </div>

      <div class="text-xs text-text-muted mb-4 px-1">
        All time: ${this.progress.totalValidated} validated, ${this.progress.totalNoMatch} no match
      </div>

      <div class="mb-4">
        <h3 class="text-sm font-medium text-text mb-2">Recent Workloads This Session</h3>
        ${this.visitedWorkloads.length > 0 ? `
          <div class="card overflow-hidden">
            ${this.visitedWorkloads.map(w => `
              <div class="workload-item ${this.currentWorkload?.hostname === w.hostname ? 'active' : ''}" data-hostname="${w.hostname}">
                <div>
                  <div class="font-medium text-sm text-text">${w.hostname}</div>
                  <div class="text-xs text-text-muted">
                    ${w.ip_addresses?.join(', ') || 'No IPs'}
                    ${w.isManualEntry ? '<span class="ml-1 text-warning">(manual)</span>' : ''}
                  </div>
                </div>
                <span class="badge ${this.getStatusBadgeClass(w.validation?.status)}">${this.getStatusLabel(w.validation?.status)}</span>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="card p-6 text-center text-text-muted">
            <p>No workloads visited yet</p>
            <p class="text-xs mt-2">Navigate to workload pages in Illumio or use manual entry below</p>
          </div>
        `}
      </div>

      <div class="card p-4">
        <h3 class="text-sm font-medium text-text mb-2">Manual Hostname Lookup</h3>
        <div class="flex gap-2">
          <input type="text" id="manualHostnameInput" value="${this.manualHostname}" placeholder="Enter hostname..." class="input flex-1">
          <button id="manualLookupBtn" class="btn btn-primary btn-sm" ${!this.manualHostname.trim() ? 'disabled' : ''}>Lookup</button>
        </div>
      </div>
    `;
  }

  getWorkloadViewHtml() {
    if (!this.currentWorkload) {
      return this.getNoWorkloadHtml();
    }
    return this.getWorkloadDetailHtml();
  }

  getNoWorkloadHtml() {
    // Different messaging for list page vs not on Illumio at all
    const isOnListPage = !this.isOnDetailPage;

    return `
      <div class="space-y-4">
        <div class="card p-8 text-center">
          <svg class="w-12 h-12 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            ${isOnListPage ? `
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"/>
            ` : `
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
            `}
          </svg>
          <p class="text-text font-medium mb-2">${isOnListPage ? 'Select a Workload' : 'Navigate to an Illumio Workload'}</p>
          <p class="text-text-muted text-sm">${isOnListPage ? 'Click on a workload in the list to view its details and CMDB record' : 'Open a workload detail page in Illumio to begin reconciliation'}</p>
        </div>

        <div class="card p-4">
          <div class="flex items-center gap-2 mb-3">
            <svg class="w-4 h-4 text-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
            </svg>
            <span class="text-sm text-text-muted">Can't detect workload automatically?</span>
          </div>
          <div class="flex gap-2">
            <input type="text" id="manualHostnameInput" value="${this.manualHostname}" placeholder="Enter hostname manually..." class="input flex-1">
            <button id="manualLookupBtn" class="btn btn-outline btn-sm" ${!this.manualHostname.trim() ? 'disabled' : ''}>Lookup</button>
          </div>
        </div>

        ${this.visitedWorkloads.length > 0 ? `
          <div>
            <h3 class="text-sm font-medium text-text mb-2">Recent Workloads</h3>
            <div class="card overflow-hidden">
              ${this.visitedWorkloads.slice(0, 5).map(w => `
                <div class="workload-item" data-hostname="${w.hostname}">
                  <div>
                    <div class="font-medium text-sm text-text">${w.hostname}</div>
                    <div class="text-xs text-text-muted">${this.formatTimeAgo(w.lastSeen)}</div>
                  </div>
                  <span class="badge ${this.getStatusBadgeClass(w.validation?.status)}">${this.getStatusLabel(w.validation?.status)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  getWorkloadDetailHtml() {
    const w = this.currentWorkload;
    const c = this.cmdbRecord;
    const isValidated = w.validation?.status === 'validated' || w.validation?.status === 'edited';

    return `
      <div class="space-y-4">
        <!-- Workload Card -->
        <div class="card p-4">
          <div class="flex items-start justify-between mb-3">
            <div>
              <h2 class="text-lg font-semibold text-text">${w.hostname || 'Unknown Hostname'}</h2>
              <div class="match-indicator mt-1 ${this.getMatchIndicatorClass()}">
                ${this.getMatchIndicatorHtml()}
              </div>
            </div>
            <span class="badge ${this.getStatusBadgeClass(w.validation?.status)}">${this.getStatusLabel(w.validation?.status)}</span>
          </div>

          <div class="grid grid-cols-2 gap-4 text-sm">
            ${w.ip_addresses?.length ? `
              <div class="field-group">
                <div class="field-label">IP Addresses</div>
                <div class="field-value font-mono text-xs">${w.ip_addresses?.join(', ')}</div>
              </div>
            ` : ''}
            ${w.os_type ? `
              <div class="field-group">
                <div class="field-label">OS Type</div>
                <div class="field-value">${w.os_type}</div>
              </div>
            ` : ''}
          </div>

          ${w.isManualEntry ? `
            <div class="mt-3 text-xs text-warning flex items-center gap-1">
              <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>
              Manual entry - limited workload data
            </div>
          ` : ''}
        </div>

        ${c ? this.getCmdbCardHtml() : this.getNoMatchCardHtml()}

        ${c ? `
          <button class="visualize-btn w-full" data-hostname="${c.hostname}" title="Visualize this workload's connected model in the network graph">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="5" r="2"/>
              <circle cx="5" cy="19" r="2"/>
              <circle cx="19" cy="19" r="2"/>
              <path d="M12 7v4M7.5 17.5L11 13M16.5 17.5L13 13" stroke-linecap="round"/>
            </svg>
            <span>Visualize Connected Model</span>
          </button>
        ` : ''}

        ${c ? this.getLabelPreviewHtml() : ''}

        ${isValidated ? this.getValidatedInfoHtml() : ''}

        ${c ? this.getActionButtonsHtml() : ''}
      </div>
    `;
  }

  getCmdbCardHtml() {
    const c = this.cmdbRecord;
    const e = this.editedFields;
    const isMultiUse = c.applications && c.applications.length > 0;
    const totalApps = isMultiUse ? c.applications.length + 1 : 1;

    return `
      <div class="card">
        <div class="px-4 py-3 border-b border-border">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4"/>
            </svg>
            <h3 class="font-semibold text-text">ServiceNow CMDB Record</h3>
          </div>
          <p class="text-xs text-text-muted mt-1">
            Last updated ${this.formatDate(c.last_updated)} by ${c.last_updated_by}
          </p>
        </div>

        ${isMultiUse ? `
          <div class="multi-use-banner">
            <div class="flex items-center gap-2">
              <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/>
              </svg>
              <span class="text-xs font-medium">Shared Infrastructure &mdash; serves ${totalApps} applications</span>
            </div>
          </div>
        ` : ''}

        <div class="p-4 space-y-4">
          <div class="field-group">
            <label class="field-label">Portfolio</label>
            ${this.editMode ? `
              <input type="text" class="input" id="edit_product_portfolio" value="${e.product_portfolio ?? c.product_portfolio ?? ''}">
            ` : `
              <div class="field-value">${e.product_portfolio ?? c.product_portfolio ?? '—'}</div>
            `}
          </div>

          <div class="field-group">
            <label class="field-label">Product</label>
            <div class="field-value">${c.product ?? '—'}</div>
          </div>

          <div class="field-group">
            <label class="field-label">Primary Application</label>
            ${this.editMode ? `
              <input type="text" class="input" id="edit_application" value="${e.application ?? c.application ?? ''}">
            ` : `
              <div class="field-value">${e.application ?? c.application ?? '—'}</div>
            `}
          </div>

          ${isMultiUse ? this.getAdditionalAppsHtml(c.applications) : ''}

          <div class="field-group">
            <label class="field-label">Business Owner</label>
            ${this.editMode ? `
              <div class="space-y-2">
                <input type="text" class="input" id="edit_business_owner" placeholder="Name" value="${e.business_owner ?? c.business_owner ?? ''}">
                <input type="email" class="input" id="edit_business_owner_email" placeholder="Email" value="${e.business_owner_email ?? c.business_owner_email ?? ''}">
              </div>
            ` : `
              <div>
                <div class="field-value">${e.business_owner ?? c.business_owner ?? '—'}</div>
                <div class="text-xs text-text-muted">${e.business_owner_email ?? c.business_owner_email ?? ''}</div>
              </div>
            `}
          </div>

          <div class="field-group">
            <label class="field-label">Technical Owner</label>
            ${this.editMode ? `
              <div class="space-y-2">
                <input type="text" class="input" id="edit_technical_owner" placeholder="Name" value="${e.technical_owner ?? c.technical_owner ?? ''}">
                <input type="email" class="input" id="edit_technical_owner_email" placeholder="Email" value="${e.technical_owner_email ?? c.technical_owner_email ?? ''}">
              </div>
            ` : `
              <div>
                <div class="field-value">${e.technical_owner ?? c.technical_owner ?? '—'}</div>
                <div class="text-xs text-text-muted">${e.technical_owner_email ?? c.technical_owner_email ?? ''}</div>
              </div>
            `}
          </div>

          <div class="field-group">
            <label class="field-label">Criticality</label>
            ${this.editMode ? `
              <select class="input" id="edit_criticality">
                <option value="">Select...</option>
                <option value="tier1" ${(e.criticality ?? c.criticality) === 'tier1' ? 'selected' : ''}>Tier 1 - Mission Critical</option>
                <option value="tier2" ${(e.criticality ?? c.criticality) === 'tier2' ? 'selected' : ''}>Tier 2 - Business Critical</option>
                <option value="tier3" ${(e.criticality ?? c.criticality) === 'tier3' ? 'selected' : ''}>Tier 3 - Business Operational</option>
                <option value="tier4" ${(e.criticality ?? c.criticality) === 'tier4' ? 'selected' : ''}>Tier 4 - Administrative</option>
              </select>
            ` : `
              <span class="badge ${this.getCriticalityClass(e.criticality ?? c.criticality)}">${this.getCriticalityLabel(e.criticality ?? c.criticality)}</span>
            `}
          </div>

          <div class="field-group">
            <label class="field-label">Environment</label>
            ${this.editMode ? `
              <select class="input" id="edit_environment">
                <option value="">Select...</option>
                <option value="production" ${(e.environment ?? c.environment) === 'production' ? 'selected' : ''}>Production</option>
                <option value="staging" ${(e.environment ?? c.environment) === 'staging' ? 'selected' : ''}>Staging</option>
                <option value="development" ${(e.environment ?? c.environment) === 'development' ? 'selected' : ''}>Development</option>
                <option value="test" ${(e.environment ?? c.environment) === 'test' ? 'selected' : ''}>Test</option>
                <option value="dr" ${(e.environment ?? c.environment) === 'dr' ? 'selected' : ''}>Disaster Recovery</option>
              </select>
            ` : `
              <div class="field-value capitalize">${e.environment ?? c.environment ?? '—'}</div>
            `}
          </div>

          <div class="field-group">
            <label class="field-label">Compliance Scope</label>
            ${this.editMode ? `
              <div class="flex flex-wrap gap-2">
                ${['PCI', 'SOX', 'HIPAA', 'GDPR'].map(scope => {
                  const checked = (e.compliance_scope ?? c.compliance_scope ?? []).includes(scope);
                  return `
                    <label class="inline-flex items-center gap-1.5 cursor-pointer">
                      <input type="checkbox" class="compliance-checkbox rounded border-border text-primary focus:ring-primary" data-scope="${scope}" ${checked ? 'checked' : ''}>
                      <span class="text-sm">${scope}</span>
                    </label>
                  `;
                }).join('')}
              </div>
            ` : `
              <div class="flex flex-wrap gap-1">
                ${(e.compliance_scope ?? c.compliance_scope ?? []).length === 0 ? '<span class="text-text-muted text-sm">None</span>' : ''}
                ${(e.compliance_scope ?? c.compliance_scope ?? []).map(scope => `<span class="compliance-tag">${scope}</span>`).join('')}
              </div>
            `}
          </div>
        </div>
      </div>
    `;
  }

  getAdditionalAppsHtml(applications) {
    return `
      <div class="field-group">
        <label class="field-label">Additional Applications (${applications.length})</label>
        <div class="additional-apps-list">
          ${applications.map(app => `
            <div class="additional-app-item">
              <div class="flex items-center gap-2">
                <svg class="w-3.5 h-3.5 text-primary-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                </svg>
                <div>
                  <div class="text-sm font-medium text-text">${app.application}</div>
                  <div class="text-xs text-text-muted">${app.product_portfolio}${app.product ? ` &rsaquo; ${app.product}` : ''}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  getNoMatchCardHtml() {
    return `
      <div class="card border-danger-200 bg-danger-50">
        <div class="p-4">
          <div class="flex items-start gap-3">
            <svg class="w-6 h-6 text-danger flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
            </svg>
            <div>
              <h3 class="font-semibold text-danger-600">No CMDB Record Found</h3>
              <p class="text-sm text-danger-600 mt-1">
                This workload exists in Illumio but has no corresponding record in ServiceNow CMDB.
                This may indicate a shadow IT asset or a CMDB data gap.
              </p>
            </div>
          </div>
          <div class="flex gap-3 mt-4">
            <button id="markOrphanBtn" class="btn btn-sm bg-danger-100 text-danger-600 hover:bg-danger-200" ${this.saving ? 'disabled' : ''}>
              Mark as Orphan
            </button>
            <button id="skipBtn" class="btn btn-sm btn-ghost" ${this.saving ? 'disabled' : ''}>
              Skip for Now
            </button>
          </div>
        </div>
      </div>
    `;
  }

  getLabelPreviewHtml() {
    const labels = this.getLabelPreview();
    return `
      <div class="card">
        <div class="px-4 py-3 border-b border-border">
          <div class="flex items-center gap-2">
            <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
            </svg>
            <h3 class="font-semibold text-text">Illumio Labels (Preview)</h3>
          </div>
          <p class="text-xs text-text-muted mt-1">These labels would be applied to the workload upon confirmation</p>
        </div>
        <div class="p-4">
          <div class="flex flex-wrap gap-2">
            ${labels.map(l => `<div class="label-item"><span class="opacity-60">${l.key}:</span><span>${l.value}</span></div>`).join('')}
          </div>
        </div>
      </div>
    `;
  }

  getValidatedInfoHtml() {
    const w = this.currentWorkload;
    return `
      <div class="card border-success-200 bg-success-50">
        <div class="p-4">
          <div class="flex items-center gap-2 text-success-600">
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
            </svg>
            <span class="font-medium">Previously Validated</span>
          </div>
          <p class="text-sm text-success-600 mt-1">
            Validated by ${w.validation?.validated_by} on ${this.formatDate(w.validation?.validated_at)}
            ${w.validation?.edits_made ? '<span class="ml-1">(with edits)</span>' : ''}
          </p>
        </div>
      </div>
    `;
  }

  getActionButtonsHtml() {
    return `
      <div class="flex gap-3">
        <button id="confirmSaveBtn" class="btn btn-success flex-1 ${this.saving ? 'saving' : ''}" ${this.saving ? 'disabled' : ''}>
          ${this.saving ? `
            <span class="flex items-center justify-center gap-2">
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Saving...
            </span>
          ` : `
            <span class="flex items-center justify-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
              </svg>
              Confirm & Save
            </span>
          `}
        </button>
        <button id="toggleEditBtn" class="btn btn-outline" ${this.saving ? 'disabled' : ''}>
          ${this.editMode ? 'Done Editing' : `
            <span class="flex items-center gap-2">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
              </svg>
              Edit
            </span>
          `}
        </button>
      </div>
    `;
  }

  getFooterHtml() {
    const canGoPrev = this.currentIndex > 0;
    const hasNext = this.hasNextPending();

    return `
      <footer class="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-3">
        <div class="flex items-center justify-between">
          <button id="prevBtn" class="btn btn-ghost btn-sm ${!canGoPrev ? 'opacity-50 cursor-not-allowed' : ''}" ${!canGoPrev ? 'disabled' : ''}>
            ← Previous
          </button>
          <span class="text-xs text-text-muted" ${this.visitedWorkloads.length === 0 ? 'style="display:none"' : ''}>
            ${this.currentIndex + 1} / ${this.visitedWorkloads.length}
          </span>
          <button id="nextBtn" class="btn btn-ghost btn-sm text-primary ${!hasNext ? 'opacity-50' : ''}" ${!hasNext ? 'disabled' : ''}>
            Next Pending →
          </button>
        </div>
      </footer>
    `;
  }

  bindEvents() {
    // Toggle view button
    document.getElementById('toggleViewBtn')?.addEventListener('click', () => this.toggleView());

    // Open graph page (reuses existing tab if already open)
    document.getElementById('openGraphBtn')?.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: 'openGraphPage' });
    });

    // Manual lookup
    const manualInput = document.getElementById('manualHostnameInput');
    const manualBtn = document.getElementById('manualLookupBtn');

    manualInput?.addEventListener('input', (e) => {
      this.manualHostname = e.target.value;
      if (manualBtn) {
        manualBtn.disabled = !this.manualHostname.trim();
      }
    });
    manualInput?.addEventListener('keyup', (e) => {
      if (e.key === 'Enter') this.lookupManual();
    });
    manualBtn?.addEventListener('click', () => this.lookupManual());

    // Workload items
    document.querySelectorAll('.workload-item[data-hostname]').forEach(el => {
      el.addEventListener('click', () => {
        const hostname = el.dataset.hostname;
        const workload = this.visitedWorkloads.find(w => w.hostname === hostname);
        if (workload) {
          this.selectWorkload(workload);
          this.view = 'workload';
        }
      });
    });

    // Visualize button - open graph page focused on this workload
    document.querySelectorAll('.visualize-btn[data-hostname]').forEach(btn => {
      btn.addEventListener('click', () => {
        const hostname = btn.dataset.hostname;
        chrome.runtime.sendMessage({ action: 'openGraphPage', payload: { focus: hostname } });
      });
    });

    // Action buttons
    document.getElementById('confirmSaveBtn')?.addEventListener('click', () => this.confirmAndSave());
    document.getElementById('toggleEditBtn')?.addEventListener('click', () => {
      this.collectEditedFields();
      this.editMode = !this.editMode;
      this.render();
    });
    document.getElementById('markOrphanBtn')?.addEventListener('click', () => this.markAsOrphan());
    document.getElementById('skipBtn')?.addEventListener('click', () => this.clearWorkload());

    // Navigation
    document.getElementById('prevBtn')?.addEventListener('click', () => this.previousWorkload());
    document.getElementById('nextBtn')?.addEventListener('click', () => this.nextPending());

    // Compliance checkboxes
    document.querySelectorAll('.compliance-checkbox').forEach(cb => {
      cb.addEventListener('change', () => this.updateComplianceScope());
    });
  }

  collectEditedFields() {
    if (!this.editMode) return;

    const fields = ['application', 'product_portfolio', 'business_owner', 'business_owner_email',
                    'technical_owner', 'technical_owner_email', 'criticality', 'environment'];

    fields.forEach(field => {
      const el = document.getElementById(`edit_${field}`);
      if (el && el.value !== (this.cmdbRecord[field] ?? '')) {
        this.editedFields[field] = el.value;
      }
    });
  }

  updateComplianceScope() {
    const checkboxes = document.querySelectorAll('.compliance-checkbox');
    const scope = [];
    checkboxes.forEach(cb => {
      if (cb.checked) scope.push(cb.dataset.scope);
    });
    this.editedFields.compliance_scope = scope;
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.app = new ReconcilerApp();
});
