import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { ServiceNodeData } from '../../types';

type ServiceNodeType = Node<ServiceNodeData, 'service'>;

const CRITICALITY_COLORS: Record<string, { bg: string; text: string }> = {
  '1': { bg: '#fef2f2', text: '#dc2626' },
  '2': { bg: '#fff7ed', text: '#ea580c' },
  '3': { bg: '#fefce8', text: '#ca8a04' },
  '4': { bg: '#f0fdf4', text: '#16a34a' },
};

function getCritLabel(crit?: string): string | null {
  if (!crit) return null;
  const num = crit.charAt(0);
  if (num === '1') return 'Critical';
  if (num === '2') return 'High';
  if (num === '3') return 'Medium';
  if (num === '4') return 'Low';
  return crit;
}

function getInfraLabel(infra?: string): string | null {
  if (!infra) return null;
  if (infra.startsWith('cloud_')) return infra.replace('cloud_', '').replace(/_/g, ' ');
  if (infra.startsWith('hosted_')) return 'Hosted';
  return infra.replace(/_/g, ' ');
}

const ENV_COLORS: Record<string, { bg: string; text: string }> = {
  production:           { bg: '#dbeafe', text: '#1d4ed8' },
  development:          { bg: '#fef3c7', text: '#92400e' },
  'test / qa':          { bg: '#dbeafe', text: '#1d4ed8' },
  staging:              { bg: '#f3e8ff', text: '#7c3aed' },
  'production support': { bg: '#dcfce7', text: '#166534' },
  'disaster recovery':  { bg: '#fee2e2', text: '#991b1b' },
};

function getEnvLabel(env?: string): { label: string; colors: { bg: string; text: string } } | null {
  if (!env) return null;
  const key = env.toLowerCase();
  const colors = ENV_COLORS[key] ?? { bg: '#f3f4f6', text: '#4b5563' };
  // Shorten common labels
  if (key === 'production') return { label: 'Prod', colors };
  if (key === 'development') return { label: 'Dev', colors };
  if (key === 'test / qa') return { label: 'Test', colors };
  if (key === 'production support') return { label: 'Prod Support', colors };
  if (key === 'disaster recovery') return { label: 'DR', colors };
  return { label: env, colors };
}

export function ServiceNode({ data, selected }: NodeProps<ServiceNodeType>) {
  const critLabel = getCritLabel(data.criticality);
  const critNum = data.criticality?.charAt(0);
  const critColors = critNum ? CRITICALITY_COLORS[critNum] : null;
  const infraLabel = getInfraLabel(data.infrastructure);
  const envInfo = getEnvLabel(data.environment);

  return (
    <div
      className={`rounded-xl bg-white shadow-sm border transition-shadow min-w-[170px] max-w-[220px] ${
        selected ? 'shadow-lg border-sky-300' : 'border-gray-200'
      }`}
    >
      {/* Type header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 rounded-t-xl border-b border-sky-100">
        <svg className="w-3 h-3 text-sky-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        <span className="text-[10px] font-semibold text-sky-600 uppercase tracking-wider">
          Product
        </span>
        {envInfo && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium ml-auto"
            style={{ backgroundColor: envInfo.colors.bg, color: envInfo.colors.text }}
          >
            {envInfo.label}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2.5">
        <div className="text-sm font-medium text-gray-900 truncate max-w-[190px]">
          {data.label}
        </div>
        {data.fullName && data.fullName !== data.name && (
          <div className="text-[10px] text-gray-500 mt-0.5 truncate max-w-[190px]" title={data.fullName}>
            {data.fullName}
          </div>
        )}
        <div className="text-[10px] text-gray-400 mt-1">
          {data.workloadCount} host{data.workloadCount !== 1 ? 's' : ''}
        </div>
        {(critLabel || infraLabel) && (
          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {critLabel && critColors && (
              <span
                className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: critColors.bg, color: critColors.text }}
              >
                {critLabel}
              </span>
            )}
            {infraLabel && (
              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium capitalize">
                {infraLabel}
              </span>
            )}
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-300 !border-gray-400 !w-2.5 !h-2.5"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-300 !border-gray-400 !w-2.5 !h-2.5"
      />
    </div>
  );
}
