// Network Graph Visualization for Illumio CMDB Reconciler
// Uses vis-network for interactive graph rendering

// Environment color mapping for workload nodes
const ENV_COLORS = {
  production:  { background: '#10b981', border: '#059669', highlight: { background: '#34d399', border: '#059669' } },
  staging:     { background: '#3b82f6', border: '#2563eb', highlight: { background: '#60a5fa', border: '#2563eb' } },
  development: { background: '#f59e0b', border: '#d97706', highlight: { background: '#fbbf24', border: '#d97706' } },
  test:        { background: '#8b5cf6', border: '#7c3aed', highlight: { background: '#a78bfa', border: '#7c3aed' } },
  dr:          { background: '#ec4899', border: '#db2777', highlight: { background: '#f472b6', border: '#db2777' } },
};

const DEFAULT_ENV_COLOR = { background: '#94a3b8', border: '#64748b', highlight: { background: '#cbd5e1', border: '#64748b' } };

// Criticality border widths
const CRITICALITY_BORDER = { tier1: 4, tier2: 3, tier3: 2, tier4: 1 };

// Node group visual config for vis-network
const NODE_GROUPS = {
  portfolio: {
    shape: 'diamond',
    size: 35,
    color: {
      background: '#6366f1',
      border: '#4f46e5',
      highlight: { background: '#818cf8', border: '#4338ca' },
    },
    font: { color: '#ffffff', size: 14, face: 'system-ui, -apple-system, sans-serif', bold: true },
    borderWidth: 3,
    shadow: { enabled: true, color: 'rgba(99, 102, 241, 0.3)', size: 12 },
  },
  application: {
    shape: 'dot',
    size: 24,
    color: {
      background: '#a5b4fc',
      border: '#6366f1',
      highlight: { background: '#c7d2fe', border: '#4f46e5' },
    },
    font: { color: '#1e293b', size: 12, face: 'system-ui, -apple-system, sans-serif' },
    borderWidth: 2,
    shadow: { enabled: true, color: 'rgba(99, 102, 241, 0.15)', size: 8 },
  },
  product: {
    shape: 'box',
    size: 16,
    color: {
      background: '#e0e7ff',
      border: '#a5b4fc',
      highlight: { background: '#eef2ff', border: '#818cf8' },
    },
    font: { color: '#1e293b', size: 11, face: 'system-ui, -apple-system, sans-serif' },
    borderWidth: 1,
    shapeProperties: { borderRadius: 6 },
  },
  workload: {
    shape: 'dot',
    size: 10,
    font: { color: '#64748b', size: 9, face: 'system-ui, -apple-system, sans-serif' },
    borderWidth: 2,
  },
  multiUseWorkload: {
    shape: 'hexagon',
    size: 16,
    font: { color: '#1e293b', size: 10, face: 'system-ui, -apple-system, sans-serif', bold: true },
    borderWidth: 3,
    shadow: { enabled: true, color: 'rgba(245, 158, 11, 0.25)', size: 10 },
  },
};

class NetworkGraph {
  constructor() {
    this.allRecords = [];
    this.applications = [];
    this.allPortfolios = [];

    // Filter state
    this.selectedPortfolio = '';
    this.selectedApplication = '';
    this.selectedProduct = '';
    this.searchQuery = '';

    // vis-network
    this.network = null;
    this.nodesDataSet = null;
    this.edgesDataSet = null;

    // Layout state
    this.isHierarchical = true;

    // Detail panel
    this.selectedNode = null;

    // Hover state for highlighting
    this.highlightActive = false;

    this.init();
  }

  async init() {
    try {
      await this.loadData();
      this.renderFilterBar();
      this.renderStatsBar();
      this.renderLegend();
      this.renderControls();
      this.buildAndRenderGraph();
      this.bindGlobalEvents();
      this.hideLoading();

      // Check URL hash for focus target (e.g., #focus=api-gateway-01)
      this.applyFocusFromHash();
    } catch (err) {
      console.error('[Graph] Init error:', err);
      this.showError('Failed to load graph data. Please try again.');
    }
  }

  async loadData() {
    const response = await chrome.runtime.sendMessage({ action: 'getAllCMDBData' });
    this.allRecords = response?.records || [];
    this.applications = response?.applications || [];
    // Only include portfolios that have actual records in the graph
    const recordPortfolios = new Set(this.allRecords.map(r => r.product_portfolio).filter(Boolean));
    this.allPortfolios = [...recordPortfolios].sort();
  }

  // --- Filtering ---

  getFilteredRecords() {
    return this.allRecords.filter(r => {
      if (this.selectedPortfolio && r.product_portfolio !== this.selectedPortfolio) return false;
      if (this.selectedApplication && r.application !== this.selectedApplication) return false;
      if (this.selectedProduct && r.product !== this.selectedProduct) return false;
      return true;
    });
  }

  // Cascading filters: Portfolio -> Product -> Application
  getFilteredProducts() {
    if (!this.selectedPortfolio) return [];
    const products = new Set();
    this.allRecords.forEach(r => {
      if (r.product_portfolio === this.selectedPortfolio && r.product) products.add(r.product);
    });
    return Array.from(products).sort();
  }

  getFilteredApplications() {
    if (!this.selectedProduct) return [];
    const apps = new Set();
    this.allRecords.forEach(r => {
      if (r.product === this.selectedProduct) apps.add(r.application);
    });
    return Array.from(apps).sort();
  }

  onPortfolioChange(value) {
    this.selectedPortfolio = value;
    this.selectedProduct = '';
    this.selectedApplication = '';
    this.renderFilterBar();
    this.buildAndRenderGraph();
    this.renderStatsBar();
    this.updateBreadcrumb();
  }

  onProductChange(value) {
    this.selectedProduct = value;
    this.selectedApplication = '';
    this.renderFilterBar();
    this.buildAndRenderGraph();
    this.renderStatsBar();
    this.updateBreadcrumb();
  }

  onApplicationChange(value) {
    this.selectedApplication = value;
    this.renderFilterBar();
    this.buildAndRenderGraph();
    this.renderStatsBar();
    this.updateBreadcrumb();
  }

  resetFilters() {
    this.selectedPortfolio = '';
    this.selectedProduct = '';
    this.selectedApplication = '';
    this.searchQuery = '';
    this.renderFilterBar();
    this.buildAndRenderGraph();
    this.renderStatsBar();
    this.updateBreadcrumb();
  }

  setFilter(type, value) {
    if (type === 'portfolio') {
      this.selectedPortfolio = value;
      this.selectedProduct = '';
      this.selectedApplication = '';
    } else if (type === 'product') {
      // Find the portfolio for this product if not already set
      if (!this.selectedPortfolio) {
        const record = this.allRecords.find(r => r.product === value);
        if (record) this.selectedPortfolio = record.product_portfolio;
      }
      this.selectedProduct = value;
      this.selectedApplication = '';
    } else if (type === 'application') {
      // Find the product and portfolio for this app if not already set
      if (!this.selectedProduct) {
        const record = this.allRecords.find(r => r.application === value);
        if (record) {
          this.selectedProduct = record.product;
          if (!this.selectedPortfolio) this.selectedPortfolio = record.product_portfolio;
        }
      }
      this.selectedApplication = value;
    }
    this.renderFilterBar();
    this.buildAndRenderGraph();
    this.renderStatsBar();
    this.updateBreadcrumb();
  }

  // --- Graph Building ---

  buildGraphData(records) {
    if (!records) records = this.getFilteredRecords();
    const nodes = [];
    const edges = [];
    const seen = { portfolios: new Set(), products: new Set(), apps: new Set(), workloads: new Set(), edges: new Set() };

    // First pass: collect workload info to identify multi-use hosts
    const workloadApps = new Map(); // hostname -> Set of application names
    for (const record of records) {
      if (!workloadApps.has(record.hostname)) workloadApps.set(record.hostname, new Set());
      workloadApps.get(record.hostname).add(record.application);
    }

    for (const record of records) {
      // Portfolio node (top level)
      if (record.product_portfolio && !seen.portfolios.has(record.product_portfolio)) {
        seen.portfolios.add(record.product_portfolio);
        nodes.push({
          id: `portfolio:${record.product_portfolio}`,
          label: record.product_portfolio,
          group: 'portfolio',
          title: this.buildTooltip('Portfolio', {
            Name: record.product_portfolio,
            Products: this.countProductsInPortfolio(record.product_portfolio, records),
            Workloads: this.countUniqueWorkloadsInPortfolio(record.product_portfolio, records),
          }),
          nodeType: 'portfolio',
          data: { name: record.product_portfolio },
        });
      }

      // Product node (second level — child of portfolio)
      if (record.product && !seen.products.has(record.product)) {
        seen.products.add(record.product);
        const uniqueApps = new Set(records.filter(r => r.product === record.product).map(r => r.application));
        const uniqueHosts = new Set(records.filter(r => r.product === record.product).map(r => r.hostname));
        nodes.push({
          id: `product:${record.product}`,
          label: record.product,
          group: 'product',
          title: this.buildTooltip('Product', {
            Name: record.product,
            Portfolio: record.product_portfolio,
            Applications: uniqueApps.size,
            Workloads: uniqueHosts.size,
          }),
          nodeType: 'product',
          data: {
            name: record.product,
            portfolio: record.product_portfolio,
          },
        });
        // Edge: portfolio -> product
        const pfEdgeKey = `${record.product_portfolio}->product:${record.product}`;
        if (record.product_portfolio && !seen.edges.has(pfEdgeKey)) {
          seen.edges.add(pfEdgeKey);
          edges.push({
            from: `portfolio:${record.product_portfolio}`,
            to: `product:${record.product}`,
            color: { color: '#c7d2fe', highlight: '#6366f1', opacity: 0.8 },
            width: 2,
            smooth: { type: 'cubicBezier', roundness: 0.3 },
          });
        }
      }

      // Application node (third level — child of product)
      const appKey = `${record.product}|${record.application}`;
      if (record.application && !seen.apps.has(appKey)) {
        seen.apps.add(appKey);
        const uniqueHosts = new Set(records.filter(r => r.product === record.product && r.application === record.application).map(r => r.hostname));
        nodes.push({
          id: `app:${appKey}`,
          label: record.application,
          group: 'application',
          title: this.buildTooltip('Application', {
            Name: record.application,
            Product: record.product,
            Portfolio: record.product_portfolio,
            'App ID': record.application_id,
            Workloads: uniqueHosts.size,
          }),
          nodeType: 'application',
          data: {
            name: record.application,
            product: record.product,
            portfolio: record.product_portfolio,
            application_id: record.application_id,
          },
        });
        // Edge: product -> application
        edges.push({
          from: `product:${record.product}`,
          to: `app:${appKey}`,
          color: { color: '#e0e7ff', highlight: '#a5b4fc', opacity: 0.7 },
          width: 1.5,
          smooth: { type: 'cubicBezier', roundness: 0.3 },
        });
      }

      // Workload node (deduplicated - one node per hostname)
      if (!seen.workloads.has(record.hostname)) {
        seen.workloads.add(record.hostname);
        const isMultiUse = (workloadApps.get(record.hostname)?.size || 0) > 1;
        const appList = [...(workloadApps.get(record.hostname) || [])];
        const envColor = ENV_COLORS[record.environment] || DEFAULT_ENV_COLOR;

        nodes.push({
          id: `workload:${record.hostname}`,
          label: record.hostname,
          group: isMultiUse ? 'multiUseWorkload' : 'workload',
          color: isMultiUse
            ? { background: envColor.background, border: '#f59e0b', highlight: { background: envColor.highlight?.background || envColor.background, border: '#d97706' } }
            : envColor,
          borderWidth: isMultiUse ? 3 : (CRITICALITY_BORDER[record.criticality] || 2),
          title: this.buildTooltip(isMultiUse ? 'Multi-Use Workload' : 'Workload', {
            Hostname: record.hostname,
            FQDN: record.fqdn,
            Environment: record.environment || 'unknown',
            Criticality: record.criticality || 'unknown',
            Applications: isMultiUse ? appList.join(', ') : record.application,
            'Business Owner': record.business_owner,
            Compliance: (record.compliance_scope || []).join(', ') || 'None',
          }),
          nodeType: 'workload',
          data: {
            ...record,
            _multiUse: isMultiUse,
            _allApplications: isMultiUse ? appList : undefined,
          },
        });
      }

      // Edge: application -> workload (one per app mapping, deduplicated)
      if (record.application) {
        const edgeKey = `${record.product}|${record.application}->${record.hostname}`;
        if (!seen.edges.has(edgeKey)) {
          seen.edges.add(edgeKey);
          const isMultiUse = (workloadApps.get(record.hostname)?.size || 0) > 1;
          edges.push({
            from: `app:${record.product}|${record.application}`,
            to: `workload:${record.hostname}`,
            color: isMultiUse
              ? { color: '#fbbf24', highlight: '#f59e0b', opacity: 0.7 }
              : { color: '#e2e8f0', highlight: '#94a3b8', opacity: 0.5 },
            width: isMultiUse ? 1.5 : 1,
            dashes: isMultiUse ? false : [4, 4],
            smooth: { type: 'cubicBezier', roundness: 0.2 },
          });
        }
      }
    }

    return { nodes, edges };
  }

  buildTooltip(type, fields) {
    // vis-network only renders HTML tooltips when given a DOM element, not a string.
    // Create a real DOM element for the tooltip.
    const container = document.createElement('div');
    container.style.cssText = 'font-family: system-ui, -apple-system, sans-serif; padding: 6px 8px; max-width: 280px;';

    const header = document.createElement('div');
    header.style.cssText = 'font-weight: 600; font-size: 11px; color: #6366f1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;';
    header.textContent = type;
    container.appendChild(header);

    for (const [key, value] of Object.entries(fields)) {
      if (value !== undefined && value !== null && value !== '') {
        const row = document.createElement('div');
        row.style.cssText = 'margin-bottom: 3px;';

        const label = document.createElement('span');
        label.style.cssText = 'color: #64748b; font-size: 11px;';
        label.textContent = `${key}: `;

        const val = document.createElement('span');
        val.style.cssText = 'color: #1e293b; font-size: 11px; font-weight: 500;';
        val.textContent = value;

        row.appendChild(label);
        row.appendChild(val);
        container.appendChild(row);
      }
    }

    return container;
  }

  countProductsInPortfolio(portfolio, records) {
    return new Set(records.filter(r => r.product_portfolio === portfolio).map(r => r.product)).size;
  }

  countUniqueWorkloadsInPortfolio(portfolio, records) {
    return new Set(records.filter(r => r.product_portfolio === portfolio).map(r => r.hostname)).size;
  }

  // --- Graph Rendering ---

  buildAndRenderGraph() {
    const records = this.getFilteredRecords();
    const { nodes, edges } = this.buildGraphData(records);

    if (nodes.length === 0) {
      if (this.network) {
        this.network.destroy();
        this.network = null;
      }
      this.showEmpty();
      return;
    }
    this.hideEmpty();

    // Destroy existing network and recreate — vis-network's hierarchical
    // layout can fail to recompute positions when data is swapped in-place.
    if (this.network) {
      this.network.destroy();
      this.network = null;
    }

    this.nodesDataSet = new vis.DataSet(nodes);
    this.edgesDataSet = new vis.DataSet(edges);

    const container = document.getElementById('graph-container');
    this.network = new vis.Network(
      container,
      { nodes: this.nodesDataSet, edges: this.edgesDataSet },
      this.getNetworkOptions()
    );

    this.bindNetworkEvents();

    if (this.isHierarchical) {
      setTimeout(() => this.network.fit({ animation: { duration: 600, easingFunction: 'easeInOutQuad' } }), 200);
    } else {
      this.network.once('stabilizationIterationsDone', () => {
        this.network.fit({ animation: { duration: 600, easingFunction: 'easeInOutQuad' } });
      });
    }
  }

  getNetworkOptions() {
    const options = {
      groups: NODE_GROUPS,
      interaction: {
        hover: true,
        tooltipDelay: 150,
        navigationButtons: false,
        keyboard: { enabled: true },
        multiselect: false,
        zoomView: true,
        dragView: true,
      },
      edges: {
        arrows: { to: { enabled: true, scaleFactor: 0.4, type: 'arrow' } },
        smooth: { type: 'cubicBezier', roundness: 0.3 },
        chosen: {
          edge: (values) => {
            values.width = values.width * 2;
            values.opacity = 1;
          },
        },
      },
      nodes: {
        font: { face: 'system-ui, -apple-system, sans-serif' },
        chosen: {
          node: (values) => {
            values.shadow = true;
            values.shadowSize = 15;
            values.shadowColor = 'rgba(99, 102, 241, 0.3)';
          },
        },
      },
    };

    if (this.isHierarchical) {
      options.layout = {
        hierarchical: {
          enabled: true,
          direction: 'LR',
          sortMethod: 'directed',
          levelSeparation: 220,
          nodeSpacing: 70,
          treeSpacing: 90,
          blockShifting: true,
          edgeMinimization: true,
          parentCentralization: true,
        },
      };
      options.physics = { enabled: false };
    } else {
      options.layout = { hierarchical: false };
      options.physics = {
        enabled: true,
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: -3000,
          centralGravity: 0.2,
          springLength: 150,
          springConstant: 0.03,
          damping: 0.15,
          avoidOverlap: 0.5,
        },
        stabilization: {
          enabled: true,
          iterations: 200,
          updateInterval: 25,
        },
      };
    }

    return options;
  }

  bindNetworkEvents() {
    // Click: show detail panel
    this.network.on('click', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = this.nodesDataSet.get(nodeId);
        if (node) this.showDetailPanel(node);
      } else {
        this.hideDetailPanel();
      }
    });

    // Double-click: drill down
    this.network.on('doubleClick', (params) => {
      if (params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = this.nodesDataSet.get(nodeId);
        if (node) this.drillDown(node);
      }
    });

    // Hover: highlight connected nodes via canvas overlay (no DataSet mutation)
    this._highlightedNodes = null; // Set of node IDs to keep bright, null = no highlight
    this._highlightedEdges = null; // Set of edge IDs to keep visible

    this.network.on('hoverNode', (params) => {
      this._setHoverHighlight(params.node);
    });

    this.network.on('blurNode', () => {
      this._clearHoverHighlight();
    });

    // Canvas overlay: dim non-highlighted nodes/edges after vis-network draws
    this.network.on('afterDrawing', (ctx) => {
      if (!this._highlightedNodes) return;

      const allNodeIds = this.nodesDataSet.getIds();
      for (const id of allNodeIds) {
        if (this._highlightedNodes.has(id)) continue;
        const pos = this.network.getPosition(id);
        const box = this.network.getBoundingBox(id);
        if (!box) continue;
        const w = box.right - box.left + 8;
        const h = box.bottom - box.top + 8;
        ctx.fillStyle = 'rgba(248, 250, 252, 0.82)';
        ctx.fillRect(box.left - 4, box.top - 4, w, h);
      }
    });
  }

  // --- Highlighting ---

  _setHoverHighlight(nodeId) {
    const connectedNodes = new Set(this.network.getConnectedNodes(nodeId));
    connectedNodes.add(nodeId);

    // 2nd-degree connections
    const firstDegree = [...connectedNodes];
    firstDegree.forEach(n => {
      this.network.getConnectedNodes(n).forEach(cn => connectedNodes.add(cn));
    });

    this._highlightedNodes = connectedNodes;
    this._highlightedEdges = new Set(this.network.getConnectedEdges(nodeId));
    this.highlightActive = true;
    this.network.redraw();
  }

  _clearHoverHighlight() {
    if (!this._highlightedNodes) return;
    this._highlightedNodes = null;
    this._highlightedEdges = null;
    this.highlightActive = false;
    this.network.redraw();
  }

  resetHighlight() {
    this._clearHoverHighlight();
  }

  // --- Drill Down ---

  drillDown(node) {
    switch (node.nodeType) {
      case 'portfolio':
        this.setFilter('portfolio', node.data.name);
        break;
      case 'product':
        if (node.data.portfolio) this.selectedPortfolio = node.data.portfolio;
        this.setFilter('product', node.data.name);
        break;
      case 'application':
        if (node.data.product) {
          const rec = this.allRecords.find(r => r.product === node.data.product);
          if (rec) this.selectedPortfolio = rec.product_portfolio;
          this.selectedProduct = node.data.product;
          this.setFilter('application', node.data.name);
        }
        break;
      case 'workload':
        this.showDetailPanel(node);
        break;
    }
  }

  // --- Detail Panel ---

  showDetailPanel(node) {
    this.selectedNode = node;
    const panel = document.getElementById('detail-panel');
    const titleEl = document.getElementById('detail-title');
    const contentEl = document.getElementById('detail-content');

    let typeLabel = '';
    let content = '';

    switch (node.nodeType) {
      case 'portfolio':
        typeLabel = `Portfolio: ${node.data.name}`;
        content = this.getPortfolioDetailHtml(node);
        break;
      case 'application':
        typeLabel = `Application: ${node.data.name}`;
        content = this.getApplicationDetailHtml(node);
        break;
      case 'product':
        typeLabel = `Product: ${node.data.name}`;
        content = this.getProductDetailHtml(node);
        break;
      case 'workload':
        typeLabel = `Workload: ${node.data.hostname}`;
        content = this.getWorkloadDetailHtml(node);
        break;
    }

    titleEl.textContent = typeLabel;
    contentEl.innerHTML = content;
    panel.classList.add('open');
  }

  hideDetailPanel() {
    const panel = document.getElementById('detail-panel');
    panel.classList.remove('open');
    this.selectedNode = null;
  }

  getPortfolioDetailHtml(node) {
    const portfolio = node.data.name;
    const records = this.allRecords.filter(r => r.product_portfolio === portfolio);
    const products = [...new Set(records.map(r => r.product))];
    const apps = [...new Set(records.map(r => r.application))];
    const uniqueHosts = new Set(records.map(r => r.hostname));
    const envCounts = {};
    const seenHostEnvs = new Set();
    records.forEach(r => {
      const key = `${r.hostname}|${r.environment}`;
      if (r.environment && !seenHostEnvs.has(key)) {
        seenHostEnvs.add(key);
        envCounts[r.environment] = (envCounts[r.environment] || 0) + 1;
      }
    });

    return `
      <div class="space-y-4">
        <div class="grid grid-cols-3 gap-3">
          <div class="card p-3 text-center">
            <div class="text-xl font-bold text-primary">${products.length}</div>
            <div class="text-xs text-text-muted">Products</div>
          </div>
          <div class="card p-3 text-center">
            <div class="text-xl font-bold text-primary">${apps.length}</div>
            <div class="text-xs text-text-muted">Applications</div>
          </div>
          <div class="card p-3 text-center">
            <div class="text-xl font-bold text-primary">${uniqueHosts.size}</div>
            <div class="text-xs text-text-muted">Workloads</div>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Environment Distribution</h4>
          <div class="space-y-1.5">
            ${Object.entries(envCounts).map(([env, count]) => `
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <span class="w-2.5 h-2.5 rounded-full" style="background: ${(ENV_COLORS[env] || DEFAULT_ENV_COLOR).background}"></span>
                  <span class="text-sm capitalize">${env}</span>
                </div>
                <span class="text-sm font-medium">${count}</span>
              </div>
            `).join('')}
          </div>
        </div>

        <div>
          <h4 class="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Products</h4>
          <div class="space-y-1">
            ${products.map(prod => `
              <div class="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onclick="window.graph.setFilter('product', '${prod.replace(/'/g, "\\'")}')">
                <span class="text-sm text-text">${prod}</span>
                <span class="text-xs text-text-muted">${new Set(records.filter(r => r.product === prod).map(r => r.hostname)).size} hosts</span>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
  }

  getApplicationDetailHtml(node) {
    const appName = node.data.name;
    const productName = node.data.product;
    // Filter by both application and product to scope to this specific app-under-product
    const records = this.allRecords.filter(r => r.application === appName && r.product === productName);
    const uniqueHosts = [...new Set(records.map(r => r.hostname))];
    const owners = records[0] || {};
    const complianceSet = new Set();
    records.forEach(r => (r.compliance_scope || []).forEach(c => complianceSet.add(c)));

    return `
      <div class="space-y-4">
        ${node.data.application_id ? `
          <div class="field-group">
            <div class="field-label">Application ID</div>
            <div class="field-value font-mono text-xs">${node.data.application_id}</div>
          </div>
        ` : ''}

        <div class="field-group">
          <div class="field-label">Product</div>
          <div class="field-value">${node.data.product || '—'}</div>
        </div>

        <div class="field-group">
          <div class="field-label">Portfolio</div>
          <div class="field-value">${node.data.portfolio || '—'}</div>
        </div>

        <div class="card p-3 text-center">
          <div class="text-xl font-bold text-primary">${uniqueHosts.length}</div>
          <div class="text-xs text-text-muted">Workloads</div>
        </div>

        ${owners.business_owner ? `
          <div class="field-group">
            <div class="field-label">Business Owner</div>
            <div class="field-value">${owners.business_owner}</div>
            <div class="text-xs text-text-muted">${owners.business_owner_email || ''}</div>
          </div>
        ` : ''}

        ${owners.technical_owner ? `
          <div class="field-group">
            <div class="field-label">Technical Owner</div>
            <div class="field-value">${owners.technical_owner}</div>
            <div class="text-xs text-text-muted">${owners.technical_owner_email || ''}</div>
          </div>
        ` : ''}

        ${complianceSet.size > 0 ? `
          <div class="field-group">
            <div class="field-label">Compliance Scope</div>
            <div class="flex flex-wrap gap-1 mt-1">
              ${[...complianceSet].map(c => `<span class="compliance-tag">${c}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        <div>
          <h4 class="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Workloads</h4>
          <div class="space-y-1">
            ${uniqueHosts.map(hostname => {
              const r = records.find(rec => rec.hostname === hostname);
              const isMultiUse = r._multiUse;
              return `
              <div class="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onclick="window.graph.focusNode('workload:${r.hostname}')">
                <div>
                  <div class="text-sm font-medium text-text">${r.hostname}${isMultiUse ? ' <span class="text-xs text-amber-600 font-normal">multi-use</span>' : ''}</div>
                  <div class="text-xs text-text-muted">${r.fqdn || ''}</div>
                </div>
                <div class="flex items-center gap-1.5">
                  <span class="w-2 h-2 rounded-full" style="background: ${(ENV_COLORS[r.environment] || DEFAULT_ENV_COLOR).background}"></span>
                  <span class="text-xs text-text-muted capitalize">${r.environment || '—'}</span>
                </div>
              </div>
            `}).join('')}
          </div>
        </div>
      </div>
    `;
  }

  getProductDetailHtml(node) {
    const records = this.allRecords.filter(r => r.product === node.data.name);
    const apps = [...new Set(records.map(r => r.application))];
    const uniqueHosts = [...new Set(records.map(r => r.hostname))];

    return `
      <div class="space-y-4">
        <div class="field-group">
          <div class="field-label">Portfolio</div>
          <div class="field-value">${node.data.portfolio || '—'}</div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div class="card p-3 text-center">
            <div class="text-xl font-bold text-primary">${apps.length}</div>
            <div class="text-xs text-text-muted">Applications</div>
          </div>
          <div class="card p-3 text-center">
            <div class="text-xl font-bold text-primary">${uniqueHosts.length}</div>
            <div class="text-xs text-text-muted">Workloads</div>
          </div>
        </div>

        <div>
          <h4 class="text-xs font-medium text-text-muted uppercase tracking-wide mb-2">Applications</h4>
          <div class="space-y-1">
            ${apps.map(app => {
              const appHosts = new Set(records.filter(r => r.application === app).map(r => r.hostname));
              return `
              <div class="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer" onclick="window.graph.setFilter('application', '${app.replace(/'/g, "\\'")}')">
                <span class="text-sm text-text">${app}</span>
                <span class="text-xs text-text-muted">${appHosts.size} hosts</span>
              </div>
            `}).join('')}
          </div>
        </div>
      </div>
    `;
  }

  getWorkloadDetailHtml(node) {
    const r = node.data;
    const isMultiUse = r._multiUse;
    const allApps = r._allApplications || [r.application];
    const critLabels = {
      tier1: 'Tier 1 - Mission Critical',
      tier2: 'Tier 2 - Business Critical',
      tier3: 'Tier 3 - Business Operational',
      tier4: 'Tier 4 - Administrative',
    };
    const critClasses = {
      tier1: 'bg-red-100 text-red-700',
      tier2: 'bg-orange-100 text-orange-700',
      tier3: 'bg-yellow-100 text-yellow-700',
      tier4: 'bg-gray-100 text-gray-600',
    };

    // For multi-use workloads, gather all app records for the detail view
    const appRecords = isMultiUse
      ? this.allRecords.filter(rec => rec.hostname === r.hostname)
      : [];

    return `
      <div class="space-y-4">
        ${isMultiUse ? `
          <div class="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <svg class="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
            </svg>
            <span class="text-xs font-medium text-amber-700">Multi-use workload — serves ${allApps.length} applications</span>
          </div>
        ` : ''}

        <div class="flex items-center gap-2">
          <span class="w-3 h-3 rounded-full" style="background: ${(ENV_COLORS[r.environment] || DEFAULT_ENV_COLOR).background}"></span>
          <span class="text-sm font-medium capitalize">${r.environment || 'Unknown'}</span>
          ${r.criticality ? `<span class="badge ${critClasses[r.criticality] || ''} ml-auto">${critLabels[r.criticality] || r.criticality}</span>` : ''}
        </div>

        <div class="field-group">
          <div class="field-label">Hostname</div>
          <div class="field-value font-mono">${r.hostname}</div>
        </div>

        <div class="field-group">
          <div class="field-label">FQDN</div>
          <div class="field-value font-mono text-xs">${r.fqdn || '—'}</div>
        </div>

        <div class="field-group">
          <div class="field-label">CI ID</div>
          <div class="field-value font-mono text-xs">${r.ci_id || '—'}</div>
        </div>

        ${isMultiUse ? `
          <div class="border-t border-border pt-4">
            <div class="field-label mb-2">Connected Applications (${allApps.length})</div>
            <div class="space-y-2">
              ${appRecords.map(ar => `
                <div class="p-2.5 rounded-lg border border-border hover:bg-gray-50 cursor-pointer" onclick="window.graph.setFilter('application', '${ar.application.replace(/'/g, "\\'")}')">
                  <div class="flex items-center justify-between mb-1">
                    <span class="text-sm font-medium text-text">${ar.application}</span>
                    <span class="text-xs text-text-muted">${ar.product_portfolio}</span>
                  </div>
                  <div class="text-xs text-text-muted">${ar.product}</div>
                </div>
              `).join('')}
            </div>
          </div>
        ` : `
          <div class="border-t border-border pt-4">
            <div class="field-group">
              <div class="field-label">Portfolio</div>
              <div class="field-value">${r.product_portfolio || '—'}</div>
            </div>
          </div>

          <div class="field-group">
            <div class="field-label">Product</div>
            <div class="field-value">${r.product || '—'}</div>
          </div>

          <div class="field-group">
            <div class="field-label">Application</div>
            <div class="field-value">${r.application || '—'}</div>
          </div>
        `}

        <div class="border-t border-border pt-4">
          <div class="field-group">
            <div class="field-label">Business Owner</div>
            <div class="field-value">${r.business_owner || '—'}</div>
            ${r.business_owner_email ? `<div class="text-xs text-text-muted">${r.business_owner_email}</div>` : ''}
          </div>
        </div>

        <div class="field-group">
          <div class="field-label">Technical Owner</div>
          <div class="field-value">${r.technical_owner || '—'}</div>
          ${r.technical_owner_email ? `<div class="text-xs text-text-muted">${r.technical_owner_email}</div>` : ''}
        </div>

        <div class="field-group">
          <div class="field-label">Cost Center</div>
          <div class="field-value">${r.cost_center || '—'}</div>
        </div>

        ${(r.compliance_scope || []).length > 0 ? `
          <div class="field-group">
            <div class="field-label">Compliance Scope</div>
            <div class="flex flex-wrap gap-1 mt-1">
              ${r.compliance_scope.map(c => `<span class="compliance-tag">${c}</span>`).join('')}
            </div>
          </div>
        ` : ''}

        ${r.last_updated ? `
          <div class="border-t border-border pt-4">
            <div class="text-xs text-text-muted">
              Last updated ${new Date(r.last_updated).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
              ${r.last_updated_by ? ` by ${r.last_updated_by}` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  focusNode(nodeId) {
    const node = this.nodesDataSet.get(nodeId);
    if (!node) return;

    this.network.focus(nodeId, {
      scale: 1.5,
      animation: { duration: 500, easingFunction: 'easeInOutQuad' },
    });
    this.network.selectNodes([nodeId]);
    this.showDetailPanel(node);
  }

  // --- Focus from URL hash ---

  async applyFocusFromHash() {
    const hash = location.hash;
    if (!hash || !hash.startsWith('#focus=')) return;

    const hostname = decodeURIComponent(hash.slice('#focus='.length));
    if (!hostname) return;

    console.log('[Graph] Focus from hash:', hostname);

    // Find the workload's record to set portfolio + product filters
    let record = this.allRecords.find(r => r.hostname === hostname);

    // If not in allRecords, look it up via the background (handles generated/demo records)
    if (!record) {
      try {
        const cmdbResult = await chrome.runtime.sendMessage({
          action: 'lookupCMDB',
          payload: { hostname },
        });
        if (cmdbResult?.record) {
          record = cmdbResult.record;
          // Inject the looked-up record so it appears in the graph
          this.allRecords.push(record);
          // Add its portfolio to the filter list if new
          if (record.product_portfolio && !this.allPortfolios.includes(record.product_portfolio)) {
            this.allPortfolios.push(record.product_portfolio);
            this.allPortfolios.sort();
          }
        }
      } catch (err) {
        console.warn('[Graph] Could not look up hostname for focus:', err);
      }
    }

    if (record) {
      // Set portfolio first, then drill into product — shows the full connected model
      if (record.product_portfolio) {
        this.selectedPortfolio = record.product_portfolio;
      }
      if (record.product) {
        this.selectedProduct = record.product;
      }
      this.renderFilterBar();
      this.buildAndRenderGraph();
      this.renderStatsBar();
      this.updateBreadcrumb();
    }

    // After a short delay (to let the graph stabilize/layout), focus & select the workload node
    const workloadNodeId = `workload:${hostname}`;
    const delay = this.isHierarchical ? 400 : 800;
    setTimeout(() => {
      const node = this.nodesDataSet.get(workloadNodeId);
      if (node) {
        this.focusNode(workloadNodeId);
        // Highlight the workload's connections
        this._setHoverHighlight(workloadNodeId);
      }
    }, delay);

    // Clear the hash so a page refresh doesn't re-trigger
    history.replaceState(null, '', location.pathname);
  }

  // --- UI Rendering ---

  renderFilterBar() {
    const bar = document.getElementById('filter-bar');
    const products = this.getFilteredProducts();
    const apps = this.getFilteredApplications();

    bar.innerHTML = `
      <div class="filter-group">
        <label class="filter-label">Portfolio</label>
        <select id="filter-portfolio" class="filter-select">
          <option value="">All Portfolios</option>
          ${this.allPortfolios.map(p => `<option value="${p}" ${this.selectedPortfolio === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Product</label>
        <select id="filter-product" class="filter-select" ${!this.selectedPortfolio ? 'disabled' : ''}>
          <option value="">All Products</option>
          ${products.map(p => `<option value="${p}" ${this.selectedProduct === p ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label class="filter-label">Application</label>
        <select id="filter-application" class="filter-select" ${!this.selectedProduct ? 'disabled' : ''}>
          <option value="">All Applications</option>
          ${apps.map(a => `<option value="${a}" ${this.selectedApplication === a ? 'selected' : ''}>${a}</option>`).join('')}
        </select>
      </div>
      <div class="flex-1"></div>
      <div class="relative">
        <input type="text" id="graph-search" placeholder="Search nodes..." class="search-input" value="${this.searchQuery}">
      </div>
      <button id="btn-reset-filters" class="btn btn-ghost btn-sm text-xs" ${!this.selectedPortfolio && !this.searchQuery ? 'disabled style="opacity:0.5"' : ''}>
        Reset
      </button>
    `;

    this.bindFilterEvents();
  }

  renderStatsBar() {
    const records = this.getFilteredRecords();
    const portfolios = new Set(records.map(r => r.product_portfolio).filter(Boolean));
    const apps = new Set(records.map(r => r.application).filter(Boolean));
    const products = new Set(records.map(r => r.product).filter(Boolean));
    const uniqueHosts = new Set(records.map(r => r.hostname));
    const multiUseCount = [...uniqueHosts].filter(h => {
      const hostApps = new Set(records.filter(r => r.hostname === h).map(r => r.application));
      return hostApps.size > 1;
    }).length;
    const envs = {};
    const seenHostEnvs = new Set();
    records.forEach(r => {
      const key = `${r.hostname}|${r.environment}`;
      if (r.environment && !seenHostEnvs.has(key)) {
        seenHostEnvs.add(key);
        envs[r.environment] = (envs[r.environment] || 0) + 1;
      }
    });

    const bar = document.getElementById('stats-bar');
    bar.innerHTML = `
      <div class="stat-item">
        <span class="stat-value">${portfolios.size}</span> Portfolios
      </div>
      <div class="stat-item">
        <span class="stat-value">${products.size}</span> Products
      </div>
      <div class="stat-item">
        <span class="stat-value">${apps.size}</span> Applications
      </div>
      <div class="stat-item">
        <span class="stat-value">${uniqueHosts.size}</span> Workloads
        ${multiUseCount > 0 ? `<span class="text-amber-600 ml-1">(${multiUseCount} multi-use)</span>` : ''}
      </div>
      <div class="flex-1"></div>
      ${Object.entries(envs).map(([env, count]) => `
        <div class="stat-item">
          <span class="w-2 h-2 rounded-full inline-block" style="background: ${(ENV_COLORS[env] || DEFAULT_ENV_COLOR).background}"></span>
          <span class="capitalize">${env}</span>
          <span class="stat-value">${count}</span>
        </div>
      `).join('')}
    `;
  }

  renderLegend() {
    const legend = document.getElementById('graph-legend');
    legend.classList.remove('hidden');
    legend.innerHTML = `
      <div class="legend-title">Legend</div>
      <div class="legend-section">
        <div class="legend-section-title">Node Types</div>
        <div class="legend-item">
          <span class="legend-diamond" style="background: #6366f1;"></span>
          <span>Portfolio</span>
        </div>
        <div class="legend-item">
          <span class="legend-box" style="background: #e0e7ff; border: 1px solid #a5b4fc;"></span>
          <span>Product</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #a5b4fc; border: 2px solid #6366f1;"></span>
          <span>Application</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #10b981; border: 3px solid #f59e0b; box-sizing: border-box;"></span>
          <span>Multi-Use Workload</span>
        </div>
      </div>
      <div class="legend-section">
        <div class="legend-section-title">Environment</div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #10b981;"></span>
          <span>Production</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #3b82f6;"></span>
          <span>Staging</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #f59e0b;"></span>
          <span>Development</span>
        </div>
        <div class="legend-item">
          <span class="legend-dot" style="background: #8b5cf6;"></span>
          <span>Test</span>
        </div>
      </div>
      <div class="legend-section">
        <div class="legend-section-title">Interactions</div>
        <div class="text-text-muted" style="line-height: 1.5;">
          Click: View details<br>
          Double-click: Drill down<br>
          Hover: Highlight connections
        </div>
      </div>
    `;
  }

  renderControls() {
    const controls = document.getElementById('graph-controls');
    controls.classList.remove('hidden');
    controls.innerHTML = `
      <button id="btn-fit" class="graph-control-btn" title="Fit to view">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"/>
        </svg>
      </button>
      <button id="btn-zoom-in" class="graph-control-btn" title="Zoom in">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
        </svg>
      </button>
      <button id="btn-zoom-out" class="graph-control-btn" title="Zoom out">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 12H6"/>
        </svg>
      </button>
      <button id="btn-layout" class="graph-control-btn ${this.isHierarchical ? '' : 'active'}" title="Toggle layout (hierarchical / force)">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          ${this.isHierarchical ? `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"/>
          ` : `
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z"/>
          `}
        </svg>
      </button>
    `;

    this.bindControlEvents();
  }

  updateBreadcrumb() {
    const el = document.getElementById('breadcrumb');
    if (!this.selectedPortfolio) {
      el.innerHTML = '';
      return;
    }

    let html = `<span class="breadcrumb-item" onclick="window.graph.resetFilters()">All</span>`;
    html += `<span class="breadcrumb-separator">/</span>`;

    if (this.selectedProduct) {
      html += `<span class="breadcrumb-item" onclick="window.graph.setFilter('portfolio', '${this.selectedPortfolio.replace(/'/g, "\\'")}')">${this.selectedPortfolio}</span>`;
      html += `<span class="breadcrumb-separator">/</span>`;

      if (this.selectedApplication) {
        html += `<span class="breadcrumb-item" onclick="window.graph.setFilter('product', '${this.selectedProduct.replace(/'/g, "\\'")}')">${this.selectedProduct}</span>`;
        html += `<span class="breadcrumb-separator">/</span>`;
        html += `<span class="breadcrumb-current">${this.selectedApplication}</span>`;
      } else {
        html += `<span class="breadcrumb-current">${this.selectedProduct}</span>`;
      }
    } else {
      html += `<span class="breadcrumb-current">${this.selectedPortfolio}</span>`;
    }

    el.innerHTML = html;
  }

  // --- Search ---

  searchNodes(query) {
    this.searchQuery = query.trim().toLowerCase();
    if (!this.searchQuery) {
      this.resetHighlight();
      return;
    }

    const allNodes = this.nodesDataSet.get();
    const matchingIds = new Set();

    allNodes.forEach(n => {
      const label = (n.label || '').toLowerCase();
      if (label.includes(this.searchQuery)) {
        matchingIds.add(n.id);
      }
    });

    if (matchingIds.size === 0) return;

    // Highlight matching nodes via canvas overlay (no DataSet mutation)
    this._highlightedNodes = matchingIds;
    this.highlightActive = true;
    this.network.redraw();

    // Focus on first match
    const firstMatch = [...matchingIds][0];
    if (firstMatch) {
      this.network.focus(firstMatch, {
        scale: 1.2,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' },
      });
    }
  }

  // --- Event Binding ---

  bindFilterEvents() {
    document.getElementById('filter-portfolio')?.addEventListener('change', (e) => {
      this.onPortfolioChange(e.target.value);
    });
    document.getElementById('filter-application')?.addEventListener('change', (e) => {
      this.onApplicationChange(e.target.value);
    });
    document.getElementById('filter-product')?.addEventListener('change', (e) => {
      this.onProductChange(e.target.value);
    });
    document.getElementById('btn-reset-filters')?.addEventListener('click', () => {
      this.resetFilters();
    });

    let searchTimeout;
    document.getElementById('graph-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => this.searchNodes(e.target.value), 300);
    });
  }

  bindControlEvents() {
    document.getElementById('btn-fit')?.addEventListener('click', () => {
      this.network?.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    });
    document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
      const scale = this.network.getScale();
      this.network.moveTo({ scale: scale * 1.3, animation: { duration: 300 } });
    });
    document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
      const scale = this.network.getScale();
      this.network.moveTo({ scale: scale / 1.3, animation: { duration: 300 } });
    });
    document.getElementById('btn-layout')?.addEventListener('click', () => {
      this.isHierarchical = !this.isHierarchical;
      this.renderControls();
      this.buildAndRenderGraph();
    });
  }

  bindGlobalEvents() {
    document.getElementById('close-detail')?.addEventListener('click', () => {
      this.hideDetailPanel();
    });

    // Close detail panel on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.hideDetailPanel();
      }
    });

    // Resize graph on window resize
    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        if (this.network) {
          this.network.redraw();
          this.network.fit({ animation: { duration: 300, easingFunction: 'easeInOutQuad' } });
        }
      }, 200);
    });
  }

  // --- Utility ---

  hideLoading() {
    const el = document.getElementById('graph-loading');
    if (el) el.style.display = 'none';
  }

  showEmpty() {
    let el = document.getElementById('graph-empty');
    if (!el) {
      el = document.createElement('div');
      el.id = 'graph-empty';
      el.className = 'graph-empty';
      document.getElementById('graph-container').parentElement.appendChild(el);
    }
    el.innerHTML = `
      <div class="graph-empty-content">
        <svg class="w-16 h-16 mx-auto text-text-muted mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
        </svg>
        <p class="text-lg font-medium text-text mb-1">No matching workloads</p>
        <p class="text-sm text-text-muted">Try adjusting your filters or search query</p>
        <button onclick="window.graph.resetFilters()" class="btn btn-primary btn-sm mt-4">Reset Filters</button>
      </div>
    `;
    el.style.display = 'flex';
  }

  hideEmpty() {
    const el = document.getElementById('graph-empty');
    if (el) el.style.display = 'none';
  }

  showError(message) {
    this.hideLoading();
    const container = document.getElementById('graph-container');
    container.innerHTML = `
      <div class="flex items-center justify-center h-full">
        <div class="text-center">
          <svg class="w-16 h-16 mx-auto text-danger mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
          </svg>
          <p class="text-lg font-medium text-text mb-1">Error</p>
          <p class="text-sm text-text-muted">${message}</p>
        </div>
      </div>
    `;
  }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  window.graph = new NetworkGraph();
});
