// Popup menu for Illumio CMDB Reconciler
// Provides quick access to ServiceNow side panel and Visualization graph

(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const tabUrl = tab?.url || '';
  const isIllumioConsole = tabUrl.startsWith('https://console.illum.io/');

  const sidepanelBtn = document.getElementById('open-sidepanel');
  const graphBtn = document.getElementById('open-graph');

  if (!isIllumioConsole) {
    sidepanelBtn.classList.add('disabled');
    sidepanelBtn.querySelector('.menu-desc').textContent = 'Requires Illumio console';
    graphBtn.classList.add('disabled');
    graphBtn.querySelector('.menu-desc').textContent = 'Requires Illumio console';
  }

  sidepanelBtn.addEventListener('click', async () => {
    if (!isIllumioConsole || !tab) return;
    await chrome.sidePanel.open({ tabId: tab.id });
    window.close();
  });

  graphBtn.addEventListener('click', async () => {
    if (!isIllumioConsole) return;
    await chrome.runtime.sendMessage({ action: 'openGraphPage' });
    window.close();
  });
})();
