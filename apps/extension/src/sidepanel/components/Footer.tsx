interface FooterProps {
  visitedWorkloads: any[];
  currentWorkload: any;
}

export function Footer({ visitedWorkloads, currentWorkload }: FooterProps) {
  const currentIndex = currentWorkload
    ? visitedWorkloads.findIndex((w: any) => w.hostname === currentWorkload.hostname)
    : -1;

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-4 py-3">
      <div className="flex items-center justify-between">
        <button
          className="btn btn-ghost btn-sm"
          disabled={currentIndex <= 0}
        >
          ← Previous
        </button>
        {visitedWorkloads.length > 0 && (
          <span className="text-xs text-text-muted">
            {currentIndex + 1} / {visitedWorkloads.length}
          </span>
        )}
        <button
          className="btn btn-ghost btn-sm text-primary"
          disabled={visitedWorkloads.length === 0}
        >
          Next Pending →
        </button>
      </div>
    </footer>
  );
}
