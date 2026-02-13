// Content script for Illumio CMDB Reconciler
// Detects Illumio workload pages and extracts workload information

(function() {
  'use strict';

  // URL patterns for Illumio workload pages
  // Supports both path-based and hash-based routing
  const WORKLOAD_URL_PATTERNS = [
    // Hash-based routing (e.g., /#/workloads/xxx or /#/workloads)
    /https:\/\/.*\.illum\.io\/.*#.*\/workloads/,
    /https:\/\/.*\.illumio\.com\/.*#.*\/workloads/,
    /https:\/\/console\.illum\.io\/.*#.*\/workloads/,
    // Path-based routing
    /https:\/\/.*\.illum\.io\/.*\/workloads/,
    /https:\/\/.*\.illumio\.com\/.*\/workloads/,
  ];

  // Debug logging
  const DEBUG = true;
  function log(...args) {
    if (DEBUG) console.log('[Illumio Reconciler]', ...args);
  }

  // State
  let currentWorkload = null;
  let isOnWorkloadPage = false;
  let extractionAttempts = 0;
  const MAX_EXTRACTION_ATTEMPTS = 10;

  // Check if current URL is an Illumio workload page
  function isWorkloadPage(url = window.location.href) {
    const matches = WORKLOAD_URL_PATTERNS.some(pattern => pattern.test(url));
    log('URL check:', url, 'isWorkloadPage:', matches);
    return matches;
  }

  // Check if we're on a workload DETAIL page (not just the list)
  function isWorkloadDetailPage() {
    const hash = window.location.hash;

    // Check for workload UUID in hash
    // Pattern: /#/workloads/12104e01-ad0c-4c98-8e9e-6c83ec75fbd8
    const uuidPattern = /\/workloads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
    const match = hash.match(uuidPattern);

    if (match && match[1]) {
      log('Detected workload detail page, UUID:', match[1]);
      return true;
    }

    // Also check for any non-empty workload ID after /workloads/
    const idPattern = /\/workloads\/([a-zA-Z0-9-]+)$/;
    const idMatch = hash.match(idPattern);
    if (idMatch && idMatch[1] && idMatch[1].length > 5) {
      log('Detected workload detail page, ID:', idMatch[1]);
      return true;
    }

    return false;
  }

  // Extract workload UUID from URL
  function extractWorkloadUuidFromUrl() {
    const hash = window.location.hash;
    const uuidPattern = /\/workloads\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
    const match = hash.match(uuidPattern);
    return match ? match[1] : null;
  }

  // Extract workload ID from URL
  function extractWorkloadIdFromUrl() {
    const url = window.location.href;
    // Common patterns: /workloads/xxx or /workloads/detail/xxx
    const match = url.match(/\/workloads\/(?:detail\/)?([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  // Extract hostname from page
  function extractHostname() {
    log('Attempting to extract hostname...');

    // Helper to validate hostname-like strings
    function looksLikeHostname(text) {
      if (!text || text.length < 3 || text.length > 100) return false;
      // Must contain at least one dot (FQDN) or be a short hostname pattern
      const hasDot = text.includes('.');
      const isValidPattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]*[a-zA-Z0-9]$/.test(text);
      const notIllumio = !text.toLowerCase().includes('illumio') && !text.toLowerCase().includes('console.');
      const notGeneric = !text.match(/^(workload|server|host|name|detail|summary|overview)/i);
      const notUrl = !text.startsWith('http') && !text.startsWith('www.');
      return (hasDot || text.length < 30) && isValidPattern && notIllumio && notGeneric && notUrl;
    }

    // Strategy 0: Look for the page's main header/title on detail page (most reliable)
    // On Illumio detail pages, the hostname is often in the main header
    const mainHeaderSelectors = [
      'h1', 'h2',
      '[class*="PageHeader"] [class*="title"]',
      '[class*="page-header"] [class*="title"]',
      '[class*="Header"] [class*="Title"]',
      '[class*="header"] [class*="title"]',
      '[class*="DetailHeader"]',
      '[class*="detail-header"]',
      'header h1', 'header h2',
      'main h1', 'main h2',
    ];

    for (const selector of mainHeaderSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim();
          if (looksLikeHostname(text)) {
            log('Found hostname in main header:', text, 'via selector:', selector);
            return text;
          }
          // Also check direct children
          for (const child of el.children) {
            const childText = child.textContent?.trim();
            if (looksLikeHostname(childText)) {
              log('Found hostname in header child:', childText);
              return childText;
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }

    // Strategy 1: Look for Illumio's detail/sliding panel (highest priority)
    // Illumio typically shows workload details in a side panel
    const panelSelectors = [
      // Look for any visible panel/drawer that might contain workload details
      '[class*="Panel"]:not([style*="display: none"])',
      '[class*="Drawer"]:not([style*="display: none"])',
      '[class*="Modal"]:not([style*="display: none"])',
      '[class*="Detail"]:not([style*="display: none"])',
      '[class*="Sidebar"]:not([style*="display: none"])',
    ];

    for (const panelSelector of panelSelectors) {
      try {
        const panels = document.querySelectorAll(panelSelector);
        for (const panel of panels) {
          // Look for hostname-like text in panel headers or prominent elements
          const headerElements = panel.querySelectorAll('h1, h2, h3, [class*="title"], [class*="header"], [class*="name"]');
          for (const el of headerElements) {
            const text = el.textContent?.trim();
            if (looksLikeHostname(text)) {
              log('Found hostname in panel:', text);
              return text;
            }
          }
        }
      } catch (e) {
        // Continue to next selector
      }
    }

    // Strategy 2: Look for page title containing hostname
    const title = document.title;
    log('Page title:', title);
    if (title && !title.toLowerCase().includes('illumio') && title !== 'Workloads') {
      const titleMatch = title.match(/^([^-|]+)/);
      if (titleMatch) {
        const potentialHostname = titleMatch[1].trim();
        if (looksLikeHostname(potentialHostname)) {
          log('Found hostname in title:', potentialHostname);
          return potentialHostname;
        }
      }
    }

    // Strategy 3: Look for specific Illumio UI patterns
    const detailSelectors = [
      '[class*="DetailHeader"] [class*="name"]',
      '[class*="workload-detail"] [class*="hostname"]',
      '[class*="WorkloadDetail"] h1',
      '[class*="WorkloadDetail"] h2',
      '[data-testid="workload-hostname"]',
      '[data-testid*="hostname"]',
      '[data-testid*="name"]',
      '[class*="hostname"]',
      '[class*="Hostname"]',
      '[class*="workload-name"]',
      '[class*="WorkloadName"]',
      '[class*="resource-name"]',
      '[class*="ResourceName"]',
    ];

    for (const selector of detailSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim();
          if (looksLikeHostname(text)) {
            log('Found hostname via selector', selector, ':', text);
            return text;
          }
        }
      } catch (e) {
        // Selector might be invalid
      }
    }

    // Strategy 3.5: Look for text following "Name" or "Hostname" labels
    const allElements = document.querySelectorAll('*');
    for (const el of allElements) {
      // Check if element contains exactly "Name" or "Hostname" text
      const text = el.textContent?.trim();
      if (text === 'Name' || text === 'Hostname' || text === 'Host' || text === 'FQDN') {
        // Check next sibling or parent's next child for the value
        const nextEl = el.nextElementSibling;
        if (nextEl) {
          const nextText = nextEl.textContent?.trim();
          if (looksLikeHostname(nextText)) {
            log('Found hostname after label:', nextText);
            return nextText;
          }
        }
        // Also check parent's children
        const parent = el.parentElement;
        if (parent) {
          const siblings = Array.from(parent.children);
          const elIndex = siblings.indexOf(el);
          if (elIndex >= 0 && elIndex < siblings.length - 1) {
            const nextSib = siblings[elIndex + 1];
            const sibText = nextSib?.textContent?.trim();
            if (looksLikeHostname(sibText)) {
              log('Found hostname in sibling:', sibText);
              return sibText;
            }
          }
        }
      }
    }

    // Strategy 4: Look for selected/highlighted row in workload list
    const selectedRowSelectors = [
      'tr.selected',
      'tr[class*="selected"]',
      'tr[class*="active"]',
      'tr[class*="highlighted"]',
      '[class*="TableRow"][class*="selected"]',
      '[class*="TableRow"][class*="active"]',
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
              log('Found hostname in selected row:', text);
              return text;
            }
          }
        }
      } catch (e) {
        // Continue
      }
    }

    // Strategy 5: Search all visible text for hostname patterns near "hostname" or "name" labels
    const allText = document.body.innerText;
    const hostnamePatterns = [
      /hostname[:\s]+([a-zA-Z0-9][a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i,
      /name[:\s]+([a-zA-Z0-9][a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i,
      /fqdn[:\s]+([a-zA-Z0-9][a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i,
    ];

    for (const pattern of hostnamePatterns) {
      const match = allText.match(pattern);
      if (match && match[1] && looksLikeHostname(match[1])) {
        log('Found hostname via text pattern:', match[1]);
        return match[1];
      }
    }

    // Strategy 6: Look for any FQDN-like text in prominent positions
    // Search all visible text elements for hostname patterns
    const prominentSelectors = ['h1', 'h2', 'h3', 'h4', 'strong', 'b', '[class*="bold"]', '[class*="primary"]'];
    for (const selector of prominentSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim();
          if (looksLikeHostname(text)) {
            log('Found hostname in prominent element:', text, selector);
            return text;
          }
        }
      } catch (e) {
        // Continue
      }
    }

    // Strategy 7: Scan all span/div elements for FQDN patterns (last resort)
    const fqdnPattern = /^[a-z0-9][a-z0-9-]*\.[a-z0-9.-]+\.[a-z]{2,}$/i;
    const allSpans = document.querySelectorAll('span, div');
    for (const el of allSpans) {
      // Only check direct text content (not nested)
      if (el.children.length === 0 || el.childNodes.length === 1) {
        const text = el.textContent?.trim();
        if (text && fqdnPattern.test(text) && looksLikeHostname(text)) {
          log('Found FQDN in span/div:', text);
          return text;
        }
      }
    }

    log('Could not extract hostname from page');
    return null;
  }

  // Extract IP addresses from page
  function extractIPAddresses() {
    const ips = new Set();

    // Look for IP patterns in the page
    const ipPattern = /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g;

    // Search in specific containers first
    const containers = document.querySelectorAll(
      '[class*="ip"], [class*="address"], [class*="interface"], [class*="network"], [data-testid*="ip"]'
    );

    for (const container of containers) {
      const matches = container.textContent.match(ipPattern);
      if (matches) {
        matches.forEach(ip => {
          // Filter out common non-workload IPs
          if (!ip.startsWith('127.') && !ip.startsWith('0.') && ip !== '255.255.255.255') {
            ips.add(ip);
          }
        });
      }
    }

    // If no IPs found in specific containers, search more broadly
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

  // Extract OS type from page
  function extractOSType() {
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
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  // Extract existing labels from page
  function extractLabels() {
    const labels = {};

    // Look for label elements (often displayed as pills/tags)
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
        // Labels often in format "key:value" or "key: value"
        const labelMatch = text?.match(/^([a-zA-Z_]+)[:\s]+(.+)$/);
        if (labelMatch) {
          labels[labelMatch[1].toLowerCase()] = labelMatch[2].trim();
        }
      }
    }

    // Also look for label patterns in text
    const labelPatterns = [
      /\b(app|env|loc|role)[:\s]+([a-zA-Z0-9_-]+)/gi,
    ];

    const bodyText = document.body.innerText;
    for (const pattern of labelPatterns) {
      let match;
      while ((match = pattern.exec(bodyText)) !== null) {
        const key = match[1].toLowerCase();
        if (!labels[key]) {
          labels[key] = match[2];
        }
      }
    }

    return Object.keys(labels).length > 0 ? labels : null;
  }

  // Main extraction function
  function extractWorkloadData() {
    const hostname = extractHostname();
    const ipAddresses = extractIPAddresses();
    const osType = extractOSType();
    const labels = extractLabels();
    const workloadId = extractWorkloadIdFromUrl();

    return {
      hostname,
      ip_addresses: ipAddresses,
      os_type: osType,
      labels,
      workloadId,
      url: window.location.href,
      extractedAt: new Date().toISOString(),
    };
  }

  // Check if extension context is still valid
  function isExtensionValid() {
    try {
      return chrome.runtime?.id != null;
    } catch (e) {
      return false;
    }
  }

  // Send workload data to background/side panel
  function sendWorkloadData(data) {
    if (!isExtensionValid()) {
      log('Extension context invalidated, skipping send');
      return;
    }
    try {
      chrome.runtime.sendMessage({
        action: 'workloadDetected',
        payload: data,
      }).catch(err => {
        // Extension context may be invalidated
        log('Could not send workload data:', err.message);
      });
    } catch (err) {
      // Synchronous error - extension context invalidated
      log('Extension context error:', err.message);
    }
  }

  // Send "not on workload page" message
  function sendNotOnWorkloadPage() {
    if (!isExtensionValid()) {
      log('Extension context invalidated, skipping send');
      return;
    }
    try {
      chrome.runtime.sendMessage({
        action: 'notOnWorkloadPage',
        payload: { url: window.location.href },
      }).catch(err => {
        log('Could not send navigation update:', err.message);
      });
    } catch (err) {
      log('Extension context error:', err.message);
    }
  }

  // Attempt to extract workload data with retries
  function attemptExtraction() {
    if (!isWorkloadDetailPage()) {
      log('Not on workload detail page, skipping extraction');
      return;
    }

    log('Attempt', extractionAttempts + 1, 'to extract workload data');
    const data = extractWorkloadData();

    // If we got a hostname, we have enough data
    if (data.hostname) {
      if (!currentWorkload || currentWorkload.hostname !== data.hostname) {
        currentWorkload = data;
        sendWorkloadData(data);
        log('SUCCESS: Detected workload', data.hostname);
        // Inject visualize button after a short delay for DOM to settle
        setTimeout(() => injectVisualizeButton(), 300);
      } else {
        // Same workload, but button may have been removed by SPA re-render
        if (!document.getElementById('illumio-reconciler-visualize-btn')) {
          setTimeout(() => injectVisualizeButton(), 300);
        }
      }
      extractionAttempts = 0;
      return;
    }

    // Retry extraction (SPA may still be loading)
    extractionAttempts++;
    if (extractionAttempts < MAX_EXTRACTION_ATTEMPTS) {
      log('No hostname found, retrying in 500ms...');
      setTimeout(attemptExtraction, 500);
    } else {
      // Send partial data anyway
      log('Max attempts reached, sending partial data');
      sendWorkloadData(data);
    }
  }

  // Handle page navigation (including SPA navigation)
  function handleNavigation() {
    log('Navigation detected, URL:', window.location.href);
    log('Hash:', window.location.hash);

    const wasOnWorkloadPage = isOnWorkloadPage;
    const wasOnDetailPage = isWorkloadDetailPage();
    isOnWorkloadPage = isWorkloadPage();
    const isOnDetailPage = isWorkloadDetailPage();

    log('isOnWorkloadPage:', isOnWorkloadPage, 'isOnDetailPage:', isOnDetailPage);

    if (isOnDetailPage) {
      // We're on a workload detail page - definitely try to extract
      const uuid = extractWorkloadUuidFromUrl();
      log('On workload DETAIL page, UUID:', uuid);
      removeVisualizeButton(); // Remove stale button from previous workload
      extractionAttempts = 0;
      currentWorkload = null; // Reset to force new extraction
      // Wait for page to render
      setTimeout(attemptExtraction, 500);
      setTimeout(attemptExtraction, 1000);
      setTimeout(attemptExtraction, 2000);
    } else if (isOnWorkloadPage) {
      // On workload list page (not detail) - clear current workload and notify side panel
      log('On workload list page (not detail)');
      removeVisualizeButton();
      currentWorkload = null;
      sendNotOnWorkloadPage();
    } else if (wasOnWorkloadPage) {
      log('Navigated away from workload page');
      removeVisualizeButton();
      currentWorkload = null;
      sendNotOnWorkloadPage();
    }

    updateToggleButton();
  }

  // Create/update the floating toggle button
  function createToggleButton() {
    let button = document.getElementById('illumio-reconciler-toggle');

    if (!button) {
      button = document.createElement('button');
      button.id = 'illumio-reconciler-toggle';

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

      button.addEventListener('mouseenter', () => {
        button.style.transform = 'scale(1.1)';
      });

      button.addEventListener('mouseleave', () => {
        button.style.transform = 'scale(1)';
      });

      button.addEventListener('click', async () => {
        try {
          chrome.runtime.sendMessage({ action: 'openSidePanel' });
        } catch (err) {
          console.error('Failed to open side panel:', err);
        }
      });

      document.body.appendChild(button);
    }

    return button;
  }

  // Update toggle button appearance based on state
  function updateToggleButton() {
    const button = createToggleButton();

    if (isOnWorkloadPage) {
      // Active state - primary color
      button.style.backgroundColor = '#6366f1';
      button.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
      button.title = currentWorkload?.hostname
        ? `Reconcile: ${currentWorkload.hostname}`
        : 'Open Illumio Reconciler';
      button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>
          <path d="M7 7h0M17 7h0M7 17h0M17 17h0" stroke-linecap="round"/>
        </svg>
      `;
    } else {
      // Inactive state - muted color
      button.style.backgroundColor = '#94a3b8';
      button.style.boxShadow = '0 4px 12px rgba(148, 163, 184, 0.3)';
      button.title = 'Navigate to an Illumio workload page';
      button.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
          <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/>
        </svg>
      `;
    }
  }

  // Set up MutationObserver for SPA navigation detection
  function setupSPAObserver() {
    // Watch for URL changes (for SPAs that use history API)
    let lastUrl = window.location.href;
    let lastHash = window.location.hash;

    const observer = new MutationObserver(() => {
      if (!isExtensionValid()) return;

      // Check for URL or hash change
      if (window.location.href !== lastUrl || window.location.hash !== lastHash) {
        log('URL/Hash changed from', lastUrl, 'to', window.location.href);
        lastUrl = window.location.href;
        lastHash = window.location.hash;
        handleNavigation();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // Also listen for popstate (back/forward navigation)
    window.addEventListener('popstate', handleNavigation);

    // Listen for hashchange events (common in SPAs)
    window.addEventListener('hashchange', () => {
      log('Hash change event detected');
      handleNavigation();
    });
  }

  // Listen for messages from side panel requesting data
  try {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      try {
        if (!isExtensionValid()) {
          sendResponse({ error: 'Extension context invalidated' });
          return true;
        }

        if (request.action === 'getWorkloadData') {
          log('Received getWorkloadData request');
          const isOnDetailPage = isWorkloadDetailPage();

          if (isOnDetailPage && currentWorkload) {
            sendResponse({ workload: currentWorkload, isOnWorkloadPage: true });
          } else if (isOnDetailPage) {
            // On detail page but no current workload - try extraction
            const data = extractWorkloadData();
            if (data.hostname) {
              currentWorkload = data;
              sendResponse({ workload: currentWorkload, isOnWorkloadPage: true });
            } else {
              sendResponse({ workload: null, isOnWorkloadPage: true });
            }
          } else {
            // On list page or not on workload page at all
            sendResponse({ workload: null, isOnWorkloadPage: false });
          }
          return true;
        }

        if (request.action === 'refreshExtraction') {
          log('Received refreshExtraction request');
          extractionAttempts = 0;
          attemptExtraction();
          sendResponse({ success: true });
          return true;
        }
      } catch (err) {
        log('Error handling message:', err.message);
        return true;
      }
    });
  } catch (err) {
    log('Could not register message listener:', err.message);
  }

  // Set up click listener to detect workload row clicks
  function setupClickListener() {
    document.addEventListener('click', (e) => {
      if (!isExtensionValid()) return;

      // Check if clicked on or within a table row
      const row = e.target.closest('tr, [class*="TableRow"], [class*="ListItem"], [class*="Row"]');
      if (!row) return;

      // Try to find hostname in the clicked row
      const cells = row.querySelectorAll('td, [class*="cell"], [class*="Cell"], span, div');
      for (const cell of cells) {
        const text = cell.textContent?.trim();
        // Look for FQDN pattern (hostname with at least one dot)
        if (text && text.includes('.') && /^[a-zA-Z0-9][a-zA-Z0-9._-]+$/.test(text) &&
            text.length > 5 && text.length < 100) {
          log('Clicked on row with hostname:', text);

          // Wait for detail panel to appear, then try multiple times
          let attempts = 0;
          const tryExtract = () => {
            if (!isExtensionValid()) return;
            attempts++;
            log('Post-click extraction attempt', attempts);
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

  // Watch for new panels/modals appearing in the DOM
  function setupPanelObserver() {
    const observer = new MutationObserver((mutations) => {
      if (!isExtensionValid()) return;

      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== Node.ELEMENT_NODE) continue;

          // Check if a panel/drawer/modal was added
          const el = node;
          const className = el.className || '';
          if (typeof className === 'string' &&
              (className.includes('Panel') || className.includes('Drawer') ||
               className.includes('Modal') || className.includes('Detail'))) {
            log('Detected new panel/modal in DOM:', className);
            setTimeout(attemptExtraction, 300);
            return;
          }

          // Also check children
          const panels = el.querySelectorAll?.('[class*="Panel"], [class*="Drawer"], [class*="Modal"], [class*="Detail"]');
          if (panels?.length > 0) {
            log('Detected new panel in added node');
            setTimeout(attemptExtraction, 300);
            return;
          }
        }
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  // --- Open Graph Page ---

  function openGraphPage(hostname) {
    if (!isExtensionValid()) return;
    try {
      chrome.runtime.sendMessage({
        action: 'openGraphPage',
        payload: { focus: hostname },
      }).catch(err => {
        log('Could not open graph page:', err.message);
      });
    } catch (err) {
      log('Extension context error opening graph page:', err.message);
    }
    log('Requested graph page for:', hostname);
  }

  // --- Visualize Button Injection ---

  function injectVisualizeButton() {
    if (!currentWorkload?.hostname) return;

    // Don't duplicate
    if (document.getElementById('illumio-reconciler-visualize-btn')) return;

    const hostname = currentWorkload.hostname;

    // Find the header element to inject next to.
    // Priority order: Illumio-specific data-tid selectors, then generic fallbacks.
    const headerSelectors = [
      // Illumio workload detail page: hostname is in the navbar label
      '[data-tid="comp-navbar-label"]',
      // Generic fallbacks
      'h1', 'h2',
      '[class*="PageHeader"] [class*="title"]',
      '[class*="DetailHeader"]',
      'header h1', 'header h2',
      'main h1', 'main h2',
    ];

    let targetEl = null;
    for (const selector of headerSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          const text = el.textContent?.trim();
          // Match the element containing the hostname (case-insensitive)
          if (text && (text.toLowerCase() === hostname.toLowerCase() || text.toLowerCase().includes(hostname.toLowerCase()))) {
            targetEl = el;
            break;
          }
        }
        if (targetEl) break;
      } catch (e) { /* continue */ }
    }

    // Second pass: try the Illumio navbar label even if hostname doesn't match
    // (the label may show the hostname in a different form)
    if (!targetEl) {
      targetEl = document.querySelector('[data-tid="comp-navbar-label"]');
    }

    // Fallback: find the first visible h1/h2
    if (!targetEl) {
      for (const tag of ['h1', 'h2']) {
        const el = document.querySelector(tag);
        if (el && el.offsetParent !== null) {
          targetEl = el;
          break;
        }
      }
    }

    if (!targetEl) {
      log('Could not find header element to inject visualize button');
      return;
    }

    // Create the button
    const btn = document.createElement('button');
    btn.id = 'illumio-reconciler-visualize-btn';
    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: '4px 12px',
      marginLeft: '10px',
      borderRadius: '6px',
      background: '#eef2ff',
      color: '#6366f1',
      border: '1px solid #c7d2fe',
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
      <span>Visualize</span>
    `;

    btn.addEventListener('mouseenter', () => {
      btn.style.background = '#e0e7ff';
      btn.style.borderColor = '#a5b4fc';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = '#eef2ff';
      btn.style.borderColor = '#c7d2fe';
    });
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      openGraphPage(hostname);
    });

    // Insert after the target element (as a sibling) or append to its parent
    if (targetEl.parentNode) {
      targetEl.parentNode.insertBefore(btn, targetEl.nextSibling);
    }

    log('Injected Visualize button next to:', targetEl.textContent?.trim());
  }

  function removeVisualizeButton() {
    const btn = document.getElementById('illumio-reconciler-visualize-btn');
    if (btn) btn.remove();
  }

  // Initialize
  function init() {
    log('Initializing Illumio Reconciler content script');
    log('Current URL:', window.location.href);

    handleNavigation();
    setupSPAObserver();
    setupClickListener();
    setupPanelObserver();

    // Re-check periodically in case of dynamic content
    setInterval(() => {
      if (!isExtensionValid()) return;
      if (isOnWorkloadPage && (!currentWorkload || !currentWorkload.hostname)) {
        attemptExtraction();
      }
    }, 3000);
  }

  // Wait for DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
