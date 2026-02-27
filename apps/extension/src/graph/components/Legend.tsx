import { ENV_COLORS } from '../utils/colors';

interface LegendProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Legend({ collapsed, onToggle }: LegendProps) {
  return (
    <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 text-xs z-10">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center justify-between font-medium text-gray-700 hover:bg-gray-50 rounded-t-lg"
      >
        <span>Legend</span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {!collapsed && (
        <div className="px-3 pb-3 space-y-3">
          <div>
            <div className="text-gray-400 uppercase tracking-wider mb-1.5 font-medium">Node Types</div>
            <div className="space-y-1.5">
              <LegendItem>
                <span className="w-3 h-3 rounded-sm rotate-45" style={{ background: '#3b82f6' }} />
                <span>Portfolio</span>
              </LegendItem>
              <LegendItem>
                <span className="w-3 h-3 rounded-sm border" style={{ background: '#dbeafe', borderColor: '#93c5fd' }} />
                <span>Product</span>
              </LegendItem>
              <LegendItem>
                <span className="w-3 h-3 rounded-sm border" style={{ background: '#f5f3ff', borderColor: '#c4b5fd' }} />
                <span>Component</span>
              </LegendItem>
              <LegendItem>
                <span className="w-3 h-3 rounded-full" style={{ background: '#10b981', border: '2px solid #f59e0b' }} />
                <span>Multi-Use Workload</span>
              </LegendItem>
            </div>
          </div>

          <div>
            <div className="text-gray-400 uppercase tracking-wider mb-1.5 font-medium">Environment</div>
            <div className="space-y-1.5">
              {Object.entries(ENV_COLORS).map(([env, color]) => (
                <LegendItem key={env}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
                  <span className="capitalize">{env}</span>
                </LegendItem>
              ))}
            </div>
          </div>

          <div>
            <div className="text-gray-400 uppercase tracking-wider mb-1.5 font-medium">Interactions</div>
            <div className="text-gray-500 leading-relaxed">
              Click: View details<br />
              Scroll: Zoom<br />
              Drag: Pan
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LegendItem({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-gray-600">{children}</div>;
}
