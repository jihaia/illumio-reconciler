import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { WorkloadNodeData } from '../../types';
import { getEnvColor } from '../../utils/colors';

type WorkloadNodeType = Node<WorkloadNodeData, 'workload'>;

const CLASS_TYPE_LABELS: Record<string, string> = {
  cmdb_ci_linux_server: 'Linux',
  cmdb_ci_win_server: 'Windows',
  cmdb_ci_esx_server: 'ESXi',
  cmdb_ci_server: 'Server',
  cmdb_ci_lb_bigip: 'F5 LB',
  cmdb_ci_lb: 'Load Balancer',
};

function getClassLabel(classType?: string): string | null {
  if (!classType) return null;
  return CLASS_TYPE_LABELS[classType] ?? classType.replace(/^cmdb_ci_/, '').replace(/_/g, ' ');
}

export function WorkloadNode({ data, selected }: NodeProps<WorkloadNodeType>) {
  const envColor = getEnvColor(data.environment);
  const isMultiUse = data.isMultiUse;
  const isFocused = data.isFocused;
  const classLabel = getClassLabel(data.classType);
  const hasEnvMismatch = data.envMismatches && data.envMismatches.length > 0;

  return (
    <div
      className={`rounded-xl bg-white shadow-sm border transition-shadow min-w-[160px] max-w-[280px] ${
        selected ? 'shadow-lg' : ''
      } ${isFocused ? 'ring-2 ring-blue-400 ring-offset-2 shadow-lg' : ''}`}
      style={{
        borderColor: selected
          ? envColor
          : isFocused
            ? '#60a5fa'
            : '#e5e7eb',
      }}
    >
      {/* Type header */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-t-xl border-b"
        style={{
          backgroundColor: `${envColor}12`,
          borderBottomColor: `${envColor}30`,
        }}
      >
        <svg className="w-3 h-3 flex-shrink-0" style={{ color: envColor }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="3" />
          <path d="M7 8h10M7 12h6M7 16h8" />
        </svg>
        <span
          className="text-[10px] font-semibold uppercase tracking-wider"
          style={{ color: envColor }}
        >
          {classLabel ?? 'Workload'}
        </span>
        {data.virtual && (
          <span className="text-[9px] font-medium text-gray-400 ml-0.5">VM</span>
        )}
        {isMultiUse && (
          <svg className="w-3 h-3 text-amber-500 flex-shrink-0 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      </div>

      {/* Content */}
      <div className="px-3 py-2.5">
        <div className="text-sm font-medium text-gray-900 truncate max-w-[140px]">
          {data.label}
        </div>
        {data.ip && (
          <div className="text-[10px] font-mono text-gray-400 mt-0.5">{data.ip}</div>
        )}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          <span
            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium"
            style={{
              backgroundColor: `${envColor}18`,
              color: envColor,
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: envColor }} />
            {data.environment || 'unknown'}
          </span>
          {isMultiUse && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium">
              multi-use
            </span>
          )}
          {hasEnvMismatch && (
            <span
              className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium"
              title={`Environment mismatch: workload is ${data.environment || 'unknown'}, but ${data.envMismatches!.map(m => `${m.service} is ${m.serviceEnv}`).join(', ')}`}
            >
              <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              env mismatch
            </span>
          )}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="!bg-gray-300 !border-gray-400 !w-2.5 !h-2.5"
      />
    </div>
  );
}
