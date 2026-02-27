interface DashboardViewProps {
  visitedWorkloads: any[];
  onSelectWorkload: () => void;
}

export function DashboardView({ visitedWorkloads, onSelectWorkload }: DashboardViewProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-success">0</div>
          <div className="text-xs text-text-muted">Validated</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-warning">{visitedWorkloads.length}</div>
          <div className="text-xs text-text-muted">Pending</div>
        </div>
        <div className="card p-3 text-center">
          <div className="text-2xl font-bold text-danger">0</div>
          <div className="text-xs text-text-muted">No Match</div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-medium text-text mb-2">Recent Workloads</h3>
        {visitedWorkloads.length > 0 ? (
          <div className="card overflow-hidden">
            {visitedWorkloads.map((w: any, i: number) => (
              <div
                key={i}
                className="workload-item"
                onClick={onSelectWorkload}
              >
                <div>
                  <div className="font-medium text-sm text-text">{w.hostname}</div>
                  <div className="text-xs text-text-muted">
                    {w.ip_addresses?.join(', ') || 'No IPs'}
                  </div>
                </div>
                <span className="badge badge-pending">
                  {w.validation?.status || 'Pending'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="card p-6 text-center text-text-muted text-sm">
            No workloads visited yet
          </div>
        )}
      </div>
    </div>
  );
}
