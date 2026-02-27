// Aperture Content Script
// Detects Illumio workload pages and extracts workload information
// Ported from content-script.js to TypeScript

(function () {
  'use strict';

  // URL patterns for Illumio workload pages
  const WORKLOAD_URL_PATTERNS = [
    /https:\/\/.*\.illum\.io\/.*#.*\/workloads/,
    /https:\/\/.*\.illumio\.com\/.*#.*\/workloads/,
    /https:\/\/console\.illum\.io\/.*#.*\/workloads/,
    /https:\/\/.*\.illum\.io\/.*\/workloads/,
    /https:\/\/.*\.illumio\.com\/.*\/workloads/,
  ];

  const DEBUG = true;
  function log(...args: any[]) {
    if (DEBUG) console.log('[Aperture]', ...args);
  }

  // State
  let currentWorkload: any = null;
  let isOnWorkloadPage = false;
  let extractionAttempts = 0;
  const MAX_EXTRACTION_ATTEMPTS = 10;

  // ─────────────────────────────────────────────────────────────
  // URL DETECTION
  // ─────────────────────────────────────────────────────────────

  function isWorkloadPageUrl(url = window.location.href): boolean {
    return WORKLOAD_URL_PATTERNS.some(pattern => pattern.test(url));
  }

  function isWorkloadDetailPage(): boolean {
    const hash = window.location.hash;
    const uuidPattern = /\/workloads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
    if (uuidPattern.test(hash)) return true;
    const idPattern = /\/workloads\/([a-zA-Z0-9-]+)$/;
    const idMatch = hash.match(idPattern);
    return !!(idMatch && idMatch[1] && idMatch[1].length > 5);
  }

  function extractWorkloadIdFromUrl(): string | null {
    const url = window.location.href;
    const match = url.match(/\/workloads\/(?:detail\/)?([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  // ─────────────────────────────────────────────────────────────
  // HOSTNAME EXTRACTION (7 strategies)
  // ─────────────────────────────────────────────────────────────

  function looksLikeHostname(text: string | null | undefined): boolean {
    if (!text || text.length < 3 || text.length > 100) return false;
    const hasDot = text.includes('.');
    const isValidPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$/.test(text);
    const notIllumio = !text.toLowerCase().includes('illumio') && !text.toLowerCase().includes('console.');
    const notGeneric = !text.match(/^(workload|server|host|name|detail|summary|overview)/i);
    const notUrl = !text.startsWith('http') && !text.startsWith('www.');
    return (hasDot || text.length < 30) && isValidPattern && notIllumio && notGeneric && notUrl;
  }

  function extractHostname(): string | null {
    // Strategy 0: Main page headers
    const mainHeaderSelectors = [
      'h1', 'h2',
      '[class*="PageHeader"] [class*="title"]',
      '[class*="page-header"] [class*="title"]',
      '[class*="DetailHeader"]',
      'header h1', 'header h2',
      'main h1', 'main h2',
    ];

    for (const selector of mainHeaderSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim();
          if (looksLikeHostname(text)) return text!;
          for (const child of el.children) {
            const childText = child.textContent?.trim();
            if (looksLikeHostname(childText)) return childText!;
          }
        }
      } catch { /* continue */ }
    }

    // Strategy 1: Panels/drawers
    const panelSelectors = [
      '[class*="Panel"]:not([style*="display: none"])',
      '[class*="Drawer"]:not([style*="display: none"])',
      '[class*="Detail"]:not([style*="display: none"])',
    ];

    for (const panelSelector of panelSelectors) {
      try {
        const panels = document.querySelectorAll(panelSelector);
        for (const panel of panels) {
          const headerElements = panel.querySelectorAll('h1, h2, h3, [class*="title"], [class*="header"], [class*="name"]');
          for (const el of headerElements) {
            const text = el.textContent?.trim();
            if (looksLikeHostname(text)) return text!;
          }
        }
      } catch { /* continue */ }
    }

    // Strategy 2: Page title
    const title = document.title;
    if (title && !title.toLowerCase().includes('illumio') && title !== 'Workloads') {
      const titleMatch = title.match(/^([^-|]+)/);
      if (titleMatch) {
        const potentialHostname = titleMatch[1].trim();
        if (looksLikeHostname(potentialHostname)) return potentialHostname;
      }
    }

    // Strategy 3: Illumio-specific selectors
    const detailSelectors = [
      '[data-testid="workload-hostname"]',
      '[data-testid*="hostname"]',
      '[class*="hostname"]',
      '[class*="Hostname"]',
      '[class*="workload-name"]',
      '[class*="WorkloadName"]',
    ];

    for (const selector of detailSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim();
          if (looksLikeHostname(text)) return text!;
        }
      } catch { /* continue */ }
    }

    // Strategy 3.5: Text following "Name" or "Hostname" labels
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      const text = el.textContent?.trim();
      if (text === 'Name' || text === 'Hostname' || text === 'Host' || text === 'FQDN') {
        const nextEl = el.nextElementSibling;
        if (nextEl) {
          const nextText = nextEl.textContent?.trim();
          if (looksLikeHostname(nextText)) return nextText!;
        }
        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const elIndex = siblings.indexOf(el);
          if (elIndex >= 0 && elIndex < siblings.length - 1) {
            const sibText = siblings[elIndex + 1]?.textContent?.trim();
            if (looksLikeHostname(sibText)) return sibText!;
          }
        }
      }
    }

    // Strategy 4: Selected table row
    const selectedRowSelectors = [
      'tr.selected', 'tr[class*="selected"]', 'tr[class*="active"]',
      '[class*="TableRow"][class*="selected"]',
      '[class*="ListItem"][class*="selected"]',
    ];

    for (const rowSelector of selectedRowSelectors) {
      try {
        const selectedRow = document.querySelector(rowSelector);
        if (selectedRow) {
          const cells = selectedRow.querySelectorAll('td, [class*="cell"], [class*="Cell"]');
          for (const cell of cells) {
            const text = cell.textContent?.trim();
            if (text && text.includes('.') && /^[a-zA-Z0-9][a-zA-Z0-9._-]+$/.test(text) && text.length < 100) {
              return text;
            }
          }
        }
      } catch { /* continue */ }
    }

    // Strategy 5: Text patterns in body
    const allText = document.body.innerText;
    const hostnamePatterns = [
      /hostname[:\s]+([a-zA-Z0-9][a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i,
      /name[:\s]+([a-zA-Z0-9][a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i,
      /fqdn[:\s]+([a-zA-Z0-9][a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i,
    ];

    for (const pattern of hostnamePatterns) {
      const match = allText.match(pattern);
      if (match && match[1] && looksLikeHostname(match[1])) return match[1];
    }

    // Strategy 6: Prominent elements
    const prominentSelectors = ['h1', 'h2', 'h3', 'h4', 'strong', 'b'];
    for (const selector of prominentSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim();
          if (looksLikeHostname(text)) return text!;
        }
      } catch { /* continue */ }
    }

    // Strategy 7: Scan span/div for FQDN
    const fqdnPattern = /^[a-z0-9][a-z0-9-]*\.[a-z0-9.-]+\.[a-z]{2,}$/i;
    const allSpans = document.querySelectorAll('span, div');
    for (const el of allSpans) {
      if (el.children.length === 0 || el.childNodes.length === 1) {
        const text = el.textContent?.trim();
        if (text && fqdnPattern.test(text) && looksLikeHostname(text)) return text;
      }
    }

    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // IP / OS / LABEL EXTRACTION
  // ─────────────────────────────────────────────────────────────

  function extractIPAddresses(): string[] {
    const ips = new Set<string>();
    const ipPattern = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

    const containers = document.querySelectorAll(
      '[class*="ip"], [class*="address"], [class*="interface"], [class*="network"], [data-testid*="ip"]'
    );

    for (const container of containers) {
      const matches = container.textContent?.match(ipPattern);
      if (matches) {
        matches.forEach(ip => {
          if (!ip.startsWith('127.') && !ip.startsWith('0.') && ip !== '255.255.255.255') {
            ips.add(ip);
          }
        });
      }
    }

    if (ips.size === 0) {
      const allMatches = document.body.innerText.match(ipPattern);
      if (allMatches) {
        allMatches.forEach(ip => {
          if (!ip.startsWith('127.') && !ip.startsWith('0.') && ip !== '255.255.255.255') {
            ips.add(ip);
          }
        });
      }
    }

    return Array.from(ips);
  }

  function extractOSType(): string | null {
    const osPatterns = [
      /(?:os|operating\s*system)[:\s]+([^\n,]+)/i,
      /(red\s*hat[^\n,]*)/i,
      /(ubuntu[^\n,]*)/i,
      /(centos[^\n,]*)/i,
      /(windows\s*server[^\n,]*)/i,
      /(debian[^\n,]*)/i,
      /(amazon\s*linux[^\n,]*)/i,
    ];

    const bodyText = document.body.innerText;
    for (const pattern of osPatterns) {
      const match = bodyText.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  function extractLabels(): Record<string, string> | null {
    const labels: Record<string, string> = {};

    // Strategy 1: Illumio pill components (data-tid="comp-pill comp-pill-{type} ...")
    const labelTypes = ['env', 'app', 'loc', 'role'];
    for (const type of labelTypes) {
      const pill = document.querySelector(`[data-tid*="comp-pill-${type}"]`);
      if (pill) {
        const textEl = pill.querySelector('[data-tid="elem-text"]');
        const value = textEl?.textContent?.trim();
        if (value) labels[type] = value;
      }
    }

    // Strategy 2: Aria-label based (e.g., aria-label="Environment Label")
    const ariaMap: Record<string, string> = {
      'environment label': 'env',
      'application label': 'app',
      'location label': 'loc',
      'role label': 'role',
    };
    if (Object.keys(labels).length === 0) {
      for (const [ariaLabel, key] of Object.entries(ariaMap)) {
        const el = document.querySelector(`[aria-label="${ariaLabel}" i]`);
        if (el) {
          const textEl = el.querySelector('[data-tid="elem-text"]') || el;
          const value = textEl?.textContent?.trim();
          if (value && !value.toLowerCase().includes('label')) {
            labels[key] = value;
          }
        }
      }
    }

    // Strategy 3: Generic CSS class selectors
    if (Object.keys(labels).length === 0) {
      const labelSelectors = [
        '[class*="label-pill"]',
        '[class*="label-tag"]',
        '[class*="workload-label"]',
        '[data-testid*="label"]',
        '.label-value',
      ];

      for (const selector of labelSelectors) {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim();
          const labelMatch = text?.match(/^([a-zA-Z_]+)[:\s]+(.+)$/);
          if (labelMatch) {
            labels[labelMatch[1].toLowerCase()] = labelMatch[2].trim();
          }
        }
      }
    }

    // Strategy 4: Regex fallback on page body text
    if (Object.keys(labels).length === 0) {
      const labelPatterns = [/\b(app|env|loc|role)[:\s]+([a-zA-Z0-9_-]+)/gi];
      const bodyText = document.body.innerText;
      for (const pattern of labelPatterns) {
        let match;
        while ((match = pattern.exec(bodyText)) !== null) {
          const key = match[1].toLowerCase();
          if (!labels[key]) labels[key] = match[2];
        }
      }
    }

    return Object.keys(labels).length > 0 ? labels : null;
  }

  // ─────────────────────────────────────────────────────────────
  // COMPOSITE EXTRACTION
  // ─────────────────────────────────────────────────────────────

  function extractWorkloadData() {
    return {
      hostname: extractHostname(),
      ip_addresses: extractIPAddresses(),
      os_type: extractOSType(),
      labels: extractLabels(),
      workloadId: extractWorkloadIdFromUrl(),
      url: window.location.href,
      extractedAt: new Date().toISOString(),
    };
  }

  // ─────────────────────────────────────────────────────────────
  // EXTENSION COMMUNICATION
  // ─────────────────────────────────────────────────────────────

  function isExtensionValid(): boolean {
    try {
      return chrome.runtime?.id != null;
    } catch {
      return false;
    }
  }

  function sendWorkloadData(data: any) {
    if (!isExtensionValid()) return;
    try {
      chrome.runtime.sendMessage({
        action: 'workloadDetected',
        payload: data,
      }).catch(() => {});
    } catch { /* extension context invalidated */ }
  }

  function sendNotOnWorkloadPage() {
    if (!isExtensionValid()) return;
    try {
      chrome.runtime.sendMessage({
        action: 'notOnWorkloadPage',
        payload: { url: window.location.href },
      }).catch(() => {});
    } catch { /* extension context invalidated */ }
  }

  // ─────────────────────────────────────────────────────────────
  // EXTRACTION WITH RETRIES
  // ─────────────────────────────────────────────────────────────

  function attemptExtraction() {
    if (!isWorkloadDetailPage()) return;

    const data = extractWorkloadData();

    if (data.hostname) {
      if (!currentWorkload || currentWorkload.hostname !== data.hostname) {
        currentWorkload = data;
        sendWorkloadData(data);
        log('Detected workload:', data.hostname);
        setTimeout(() => injectVisualizeButton(), 300);
      } else if (!document.getElementById('aperture-visualize-btn')) {
        setTimeout(() => injectVisualizeButton(), 300);
      }
      extractionAttempts = 0;
      return;
    }

    extractionAttempts++;
    if (extractionAttempts < MAX_EXTRACTION_ATTEMPTS) {
      setTimeout(attemptExtraction, 500);
    } else {
      sendWorkloadData(data);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // NAVIGATION HANDLING
  // ─────────────────────────────────────────────────────────────

  function handleNavigation() {
    const wasOnWorkloadPage = isOnWorkloadPage;
    isOnWorkloadPage = isWorkloadPageUrl();
    const isOnDetailPage = isWorkloadDetailPage();

    if (isOnDetailPage) {
      removeVisualizeButton();
      extractionAttempts = 0;
      currentWorkload = null;
      setTimeout(attemptExtraction, 500);
      setTimeout(attemptExtraction, 1000);
      setTimeout(attemptExtraction, 2000);
    } else if (isOnWorkloadPage) {
      removeVisualizeButton();
      currentWorkload = null;
      sendNotOnWorkloadPage();
    } else if (wasOnWorkloadPage) {
      removeVisualizeButton();
      currentWorkload = null;
      sendNotOnWorkloadPage();
    }

    updateToggleButton();
  }

  // ─────────────────────────────────────────────────────────────
  // FLOATING TOGGLE BUTTON
  // ─────────────────────────────────────────────────────────────

  function createToggleButton(): HTMLButtonElement {
    let button = document.getElementById('aperture-toggle') as HTMLButtonElement | null;

    if (!button) {
      button = document.createElement('button');
      button.id = 'aperture-toggle';

      Object.assign(button.style, {
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        width: '56px',
        height: '56px',
        borderRadius: '50%',
        border: 'none',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: '999999',
        transition: 'transform 0.2s, box-shadow 0.2s, background-color 0.2s',
      });

      button.addEventListener('mouseenter', () => { button!.style.transform = 'scale(1.1)'; });
      button.addEventListener('mouseleave', () => { button!.style.transform = 'scale(1)'; });
      button.addEventListener('click', () => {
        try { chrome.runtime.sendMessage({ action: 'openSidePanel' }); } catch { /* */ }
      });

      document.body.appendChild(button);
    }

    return button;
  }

  function updateToggleButton() {
    const button = createToggleButton();

    if (isOnWorkloadPage) {
      button.style.backgroundColor = '#3b82f6';
      button.style.boxShadow = '0 4px 12px rgba(59, 130, 246, 0.4)';
      button.title = currentWorkload?.hostname
        ? `Reconcile: ${currentWorkload.hostname}`
        : 'Open Aperture';
      button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>
          <path d="M7 7h0M17 7h0M7 17h0M17 17h0" stroke-linecap="round"/>
        </svg>`;
    } else {
      button.style.backgroundColor = '#94a3b8';
      button.style.boxShadow = '0 4px 12px rgba(148, 163, 184, 0.3)';
      button.title = 'Navigate to an Illumio workload page';
      button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>
        </svg>`;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // VISUALIZE BUTTON INJECTION
  // ─────────────────────────────────────────────────────────────

  function injectVisualizeButton() {
    if (!currentWorkload?.hostname) return;
    if (document.getElementById('aperture-visualize-btn')) return;

    const hostname = currentWorkload.hostname;

    const headerSelectors = [
      '[data-tid="comp-navbar-label"]',
      'h1', 'h2',
      '[class*="PageHeader"] [class*="title"]',
      '[class*="DetailHeader"]',
      'header h1', 'header h2',
      'main h1', 'main h2',
    ];

    let targetEl: Element | null = null;
    for (const selector of headerSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim();
          if (text && (text.toLowerCase() === hostname.toLowerCase() || text.toLowerCase().includes(hostname.toLowerCase()))) {
            targetEl = el;
            break;
          }
        }
        if (targetEl) break;
      } catch { /* continue */ }
    }

    if (!targetEl) targetEl = document.querySelector('[data-tid="comp-navbar-label"]');
    if (!targetEl) {
      for (const tag of ['h1', 'h2']) {
        const el = document.querySelector(tag) as HTMLElement | null;
        if (el && el.offsetParent !== null) { targetEl = el; break; }
      }
    }
    if (!targetEl) return;

    const btn = document.createElement('button');
    btn.id = 'aperture-visualize-btn';
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 12px',
      marginLeft: '10px',
      borderRadius: '6px',
      background: '#eff6ff',
      color: '#3b82f6',
      border: '1px solid #bfdbfe',
      cursor: 'pointer',
      fontSize: '12px',
      fontWeight: '500',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      lineHeight: '1',
      verticalAlign: 'middle',
      transition: 'background 0.15s, border-color 0.15s',
      whiteSpace: 'nowrap',
    });

    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="5" r="2"/>
        <circle cx="5" cy="19" r="2"/>
        <circle cx="19" cy="19" r="2"/>
        <path d="M12 7v4M7.5 17.5L11 13M16.5 17.5L13 13" stroke-linecap="round"/>
      </svg>
      <span>Visualize</span>`;

    btn.addEventListener('mouseenter', () => { btn.style.background = '#dbeafe'; btn.style.borderColor = '#93c5fd'; });
    btn.addEventListener('mouseleave', () => { btn.style.background = '#eff6ff'; btn.style.borderColor = '#bfdbfe'; });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!isExtensionValid()) return;
      try {
        chrome.runtime.sendMessage({ action: 'openGraphPage', payload: { focus: hostname } }).catch(() => {});
      } catch { /* */ }
    });

    if (targetEl.parentNode) {
      targetEl.parentNode.insertBefore(btn, targetEl.nextSibling);
    }
  }

  function removeVisualizeButton() {
    document.getElementById('aperture-visualize-btn')?.remove();
  }

  // ─────────────────────────────────────────────────────────────
  // SPA OBSERVERS
  // ─────────────────────────────────────────────────────────────

  function setupSPAObserver() {
    let lastUrl = window.location.href;
    let lastHash = window.location.hash;

    const observer = new MutationObserver(() => {
      if (!isExtensionValid()) return;
      if (window.location.href !== lastUrl || window.location.hash !== lastHash) {
        lastUrl = window.location.href;
        lastHash = window.location.hash;
        handleNavigation();
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('popstate', handleNavigation);
    window.addEventListener('hashchange', handleNavigation);
  }

  function setupClickListener() {
    document.addEventListener('click', (e) => {
      if (!isExtensionValid()) return;
      const row = (e.target as Element).closest('tr, [class*="TableRow"], [class*="ListItem"], [class*="Row"]');
      if (!row) return;

      const cells = row.querySelectorAll('td, [class*="cell"], [class*="Cell"], span, div');
      for (const cell of cells) {
        const text = cell.textContent?.trim();
        if (text && text.includes('.') && /^[a-zA-Z0-9][a-zA-Z0-9._-]+$/.test(text) && text.length > 5 && text.length < 100) {
          let attempts = 0;
          const tryExtract = () => {
            if (!isExtensionValid()) return;
            attempts++;
            attemptExtraction();
            if (attempts < 5 && !currentWorkload?.hostname) {
              setTimeout(tryExtract, 500);
            }
          };
          setTimeout(tryExtract, 300);
          break;
        }
      }
    }, true);
  }

  function setupPanelObserver() {
    const observer = new MutationObserver((mutations) => {
      if (!isExtensionValid()) return;
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;
          const el = node as Element;
          const className = el.className || '';
          if (typeof className === 'string' &&
              (className.includes('Panel') || className.includes('Drawer') ||
               className.includes('Modal') || className.includes('Detail'))) {
            setTimeout(attemptExtraction, 300);
            return;
          }
          const panels = el.querySelectorAll?.('[class*="Panel"], [class*="Drawer"], [class*="Modal"], [class*="Detail"]');
          if (panels?.length > 0) {
            setTimeout(attemptExtraction, 300);
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ─────────────────────────────────────────────────────────────
  // MESSAGE LISTENER
  // ─────────────────────────────────────────────────────────────

  try {
    chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
      try {
        if (!isExtensionValid()) {
          sendResponse({ error: 'Extension context invalidated' });
          return true;
        }

        if (request.action === 'getWorkloadData') {
          const isOnDetail = isWorkloadDetailPage();
          if (isOnDetail && currentWorkload) {
            sendResponse({ workload: currentWorkload, isOnWorkloadPage: true });
          } else if (isOnDetail) {
            const data = extractWorkloadData();
            if (data.hostname) {
              currentWorkload = data;
              sendResponse({ workload: currentWorkload, isOnWorkloadPage: true });
            } else {
              sendResponse({ workload: null, isOnWorkloadPage: true });
            }
          } else {
            sendResponse({ workload: null, isOnWorkloadPage: false });
          }
          return true;
        }

        if (request.action === 'refreshExtraction') {
          extractionAttempts = 0;
          attemptExtraction();
          sendResponse({ success: true });
          return true;
        }
      } catch {
        return true;
      }
    });
  } catch { /* could not register listener */ }

  // ─────────────────────────────────────────────────────────────
  // INIT
  // ─────────────────────────────────────────────────────────────

  function init() {
    log('Content script loaded:', window.location.href);
    handleNavigation();
    setupSPAObserver();
    setupClickListener();
    setupPanelObserver();

    setInterval(() => {
      if (!isExtensionValid()) return;
      if (isOnWorkloadPage && (!currentWorkload || !currentWorkload.hostname)) {
        attemptExtraction();
      }
    }, 3000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
