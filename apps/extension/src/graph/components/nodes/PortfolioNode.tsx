import { Handle, Position } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import type { PortfolioNodeData } from '../../types';

type PortfolioNodeType = Node<PortfolioNodeData, 'portfolio'>;

export function PortfolioNode({ data, selected }: NodeProps<PortfolioNodeType>) {
  return (
    <div
      className={`rounded-xl bg-white shadow-sm border transition-shadow min-w-[180px] ${
        selected ? 'shadow-lg border-blue-300' : 'border-gray-200'
      }`}
    >
      {/* Type header */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 rounded-t-xl border-b border-blue-100">
        <svg className="w-3 h-3 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
        <span className="text-[10px] font-semibold text-blue-600 uppercase tracking-wider">
          Portfolio
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2.5">
        <div className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">
          {data.label}
        </div>
        <div className="flex items-center gap-3 mt-1.5">
          <span className="text-[10px] text-gray-500">
            {data.productCount} product{data.productCount !== 1 ? 's' : ''}
          </span>
          <span className="text-[10px] text-gray-400">|</span>
          <span className="text-[10px] text-gray-500">
            {data.workloadCount} host{data.workloadCount !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-gray-300 !border-gray-400 !w-2.5 !h-2.5"
      />
    </div>
  );
}
