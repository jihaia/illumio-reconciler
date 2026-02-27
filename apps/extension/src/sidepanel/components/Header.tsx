interface HeaderProps {
  view: 'workload' | 'dashboard';
  onToggleView: () => void;
  visitedCount: number;
}

export function Header({ view, onToggleView, visitedCount }: HeaderProps) {
  function openGraph() {
    chrome.runtime.sendMessage({ action: 'openGraphPage' });
  }

  return (
    <header className="sticky top-0 bg-white border-b border-border z-10">
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold text-text">Aperture</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={openGraph}
              className="btn btn-outline btn-sm"
              title="Open Network Graph"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="5" r="2" />
                <circle cx="5" cy="19" r="2" />
                <circle cx="19" cy="19" r="2" />
                <path d="M12 7v4M7.5 17.5L11 13M16.5 17.5L13 13" strokeLinecap="round" />
              </svg>
              <span className="text-xs">Graph</span>
            </button>
            <button
              onClick={onToggleView}
              className="text-sm text-primary hover:text-primary-600 font-medium"
            >
              {view === 'workload' ? 'View All' : '← Back'}
            </button>
          </div>
        </div>
        {visitedCount > 0 ? (
          <p className="text-xs text-text-muted">
            {visitedCount} workload{visitedCount !== 1 ? 's' : ''} visited this session
          </p>
        ) : (
          <p className="text-xs text-text-muted">
            Navigate to Illumio workloads to begin reconciliation
          </p>
        )}
      </div>
    </header>
  );
}
