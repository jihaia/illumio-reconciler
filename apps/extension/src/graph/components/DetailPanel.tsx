import type { SelectedNodeInfo, PortfolioNodeData, ServiceNodeData, ComponentNodeData, WorkloadNodeData } from '../types';
import { getEnvColor } from '../utils/colors';

const NODE_TYPE_LABELS: Record<string, string> = {
  portfolio: 'Portfolio',
  service: 'Product',
  component: 'Component',
  workload: 'Workload',
};

interface DetailPanelProps {
  node: SelectedNodeInfo;
  onClose: () => void;
  onDrillDown: (type: string, value: string) => void;
  onExpand?: (nodeId: string) => void;
  isExpanded?: boolean;
  isFocusedMode?: boolean;
}

export function DetailPanel({ node, onClose, onDrillDown, onExpand, isExpanded, isFocusedMode }: DetailPanelProps) {
  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-white shadow-xl border-l border-gray-200 z-20 flex flex-col">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <div>
          <div className="text-[10px] font-medium text-blue-500 uppercase tracking-wider">
            {NODE_TYPE_LABELS[node.type] ?? node.type}
          </div>
          <h3 className="text-sm font-semibold text-gray-900 truncate max-w-[220px]">
            {node.data.label}
          </h3>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {node.type === 'portfolio' && (
          <PortfolioDetail
            data={node.data as PortfolioNodeData}
            nodeId={node.id}
            onDrillDown={onDrillDown}
            onExpand={onExpand}
            isExpanded={isExpanded}
            isFocusedMode={isFocusedMode}
          />
        )}
        {node.type === 'service' && (
          <ServiceDetail
            data={node.data as ServiceNodeData}
            nodeId={node.id}
            onDrillDown={onDrillDown}
            onExpand={onExpand}
            isExpanded={isExpanded}
            isFocusedMode={isFocusedMode}
          />
        )}
        {node.type === 'component' && (
          <ComponentDetail data={node.data as ComponentNodeData} />
        )}
        {node.type === 'workload' && (
          <WorkloadDetail data={node.data as WorkloadNodeData} onDrillDown={onDrillDown} />
        )}
      </div>
    </div>
  );
}

function PortfolioDetail({
  data,
  nodeId,
  onDrillDown,
  onExpand,
  isExpanded,
  isFocusedMode,
}: {
  data: PortfolioNodeData;
  nodeId: string;
  onDrillDown: (type: string, value: string) => void;
  onExpand?: (nodeId: string) => void;
  isExpanded?: boolean;
  isFocusedMode?: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <StatCard value={data.productCount} label="Products" />
        <StatCard value={data.workloadCount} label="Workloads" />
      </div>

      {isFocusedMode && onExpand && !isExpanded && (
        <button
          onClick={() => onExpand(nodeId)}
          className="w-full text-xs text-white bg-blue-600 hover:bg-blue-700 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Expand portfolio — show all products & workloads
        </button>
      )}

      {isExpanded && (
        <div className="text-xs text-green-600 font-medium py-2 px-3 bg-green-50 border border-green-200 rounded-lg text-center">
          Expanded — showing all connected nodes
        </div>
      )}

      {!isFocusedMode && (
        <button
          onClick={() => onDrillDown('portfolio', data.name)}
          className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Filter to this portfolio
        </button>
      )}
    </div>
  );
}

function ServiceDetail({
  data,
  nodeId,
  onDrillDown,
  onExpand,
  isExpanded,
  isFocusedMode,
}: {
  data: ServiceNodeData;
  nodeId: string;
  onDrillDown: (type: string, value: string) => void;
  onExpand?: (nodeId: string) => void;
  isExpanded?: boolean;
  isFocusedMode?: boolean;
}) {
  return (
    <div className="space-y-4">
      {data.fullName && data.fullName !== data.name && (
        <Field label="Full Name" value={data.fullName} />
      )}
      {data.description && data.description !== data.fullName && (
        <div>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">Description</div>
          <div className="text-xs text-gray-600 mt-0.5 leading-relaxed">{data.description}</div>
        </div>
      )}
      <Field label="Portfolio" value={data.portfolio || '—'} />
      {data.environment && (
        <Field label="Environment" value={data.environment} />
      )}
      <StatCard value={data.workloadCount} label="Workloads" />

      {(data.criticality || data.infrastructure || data.category) && (
        <div className="space-y-2">
          {data.criticality && (
            <Field label="Criticality" value={data.criticality} />
          )}
          {data.category && (
            <Field label="Category" value={data.category} />
          )}
          {data.infrastructure && (
            <Field label="Infrastructure" value={data.infrastructure.replace(/_/g, ' ')} />
          )}
        </div>
      )}

      {isFocusedMode && onExpand && !isExpanded && (
        <button
          onClick={() => onExpand(nodeId)}
          className="w-full text-xs text-white bg-blue-600 hover:bg-blue-700 font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-1.5"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
          </svg>
          Expand product — show other workloads
        </button>
      )}

      {isExpanded && (
        <div className="text-xs text-green-600 font-medium py-2 px-3 bg-green-50 border border-green-200 rounded-lg text-center">
          Expanded — showing all connected workloads
        </div>
      )}

      {!isFocusedMode && (
        <button
          onClick={() => onDrillDown('service', data.name)}
          className="w-full text-xs text-blue-600 hover:text-blue-800 font-medium py-2 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Filter to this product
        </button>
      )}
    </div>
  );
}

function ComponentDetail({ data }: { data: ComponentNodeData }) {
  return (
    <div className="space-y-4">
      <Field label="Component Type" value={data.componentType} />
      <Field label="Class" value={data.className.replace(/^cmdb_ci_/, '').replace(/_/g, ' ')} />
      <Field label="Server" value={data.serverName} mono />
      {data.shortDescription && (
        <Field label="Description" value={data.shortDescription} />
      )}
    </div>
  );
}

const CLASS_TYPE_LABELS: Record<string, string> = {
  cmdb_ci_linux_server: 'Linux Server',
  cmdb_ci_win_server: 'Windows Server',
  cmdb_ci_esx_server: 'ESXi Host',
  cmdb_ci_server: 'Server',
  cmdb_ci_lb_bigip: 'F5 Load Balancer',
  cmdb_ci_lb: 'Load Balancer',
};

function getClassLabel(classType?: string): string | null {
  if (!classType) return null;
  return CLASS_TYPE_LABELS[classType] ?? classType.replace(/^cmdb_ci_/, '').replace(/_/g, ' ');
}

function WorkloadDetail({
  data,
}: {
  data: WorkloadNodeData;
  onDrillDown: (type: string, value: string) => void;
}) {
  const envColor = getEnvColor(data.environment);
  const classLabel = getClassLabel(data.classType);

  return (
    <div className="space-y-4">
      {data.isFocused && (
        <div className="text-xs text-blue-600 font-medium py-2 px-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
          Focused workload
        </div>
      )}

      {data.isMultiUse && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
          <svg className="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span className="text-xs font-medium text-amber-700">
            Multi-use — serves {data.services.length} products
          </span>
        </div>
      )}

      {data.envMismatches && data.envMismatches.length > 0 && (
        <div className="px-3 py-2 bg-orange-50 border border-orange-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1.5">
            <svg className="w-4 h-4 text-orange-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium text-orange-700">
              Environment Mismatch
            </span>
          </div>
          <div className="text-[11px] text-orange-600 space-y-1">
            <div>Workload: <span className="font-medium">{data.environment || 'unknown'}</span></div>
            {data.envMismatches.map((m) => (
              <div key={m.service}>
                {m.service}: <span className="font-medium">{m.serviceEnv}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: envColor }} />
        <span className="text-sm font-medium capitalize">{data.environment || 'Unknown'}</span>
      </div>

      <Field label="Hostname" value={data.hostname} mono />
      <Field label="IP Address" value={data.ip || '—'} mono />
      {data.fqdn && <Field label="FQDN" value={data.fqdn} mono />}
      <Field label="OS / Type" value={data.os || '—'} />
      {classLabel && (
        <div className="flex items-center gap-2">
          <Field label="Server Class" value={classLabel} />
          {data.virtual && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600 font-medium mt-3">
              Virtual
            </span>
          )}
        </div>
      )}
      {data.shortDescription && (
        <Field label="Description" value={data.shortDescription} />
      )}

      <div>
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Products ({data.services.length})
        </div>
        <div className="space-y-1">
          {data.services.map((s) => (
            <div key={s} className="text-xs text-gray-700 px-2 py-1 bg-gray-50 rounded">
              {s}
            </div>
          ))}
        </div>
      </div>

      {data.components && data.components.length > 0 && (
        <div>
          <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
            Components ({data.components.length})
          </div>
          <div className="space-y-1">
            {data.components.map((c) => (
              <div key={c} className="text-xs text-gray-700 px-2 py-1 bg-purple-50 rounded">
                {c}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Portfolios ({data.portfolios.length})
        </div>
        <div className="space-y-1">
          {data.portfolios.map((p) => (
            <div key={p} className="text-xs text-gray-700 px-2 py-1 bg-gray-50 rounded">
              {p}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider">{label}</div>
      <div className={`text-sm text-gray-800 ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}

function StatCard({ value, label }: { value: number; label: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3 text-center">
      <div className="text-xl font-bold text-blue-600">{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
    </div>
  );
}
