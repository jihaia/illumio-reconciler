import type { NodeProps, Node } from '@xyflow/react';
import type { SwimlaneNodeData } from '../../types';

type SwimlaneNodeType = Node<SwimlaneNodeData, 'swimlane'>;

export function SwimlaneNode({ data }: NodeProps<SwimlaneNodeType>) {
  return (
    <div
      className="pointer-events-none select-none"
      style={{
        width: data.laneWidth,
        height: data.laneHeight,
        backgroundColor: `${data.color}08`,
        borderLeft: `2px solid ${data.color}20`,
        borderRight: `2px solid ${data.color}20`,
        borderRadius: 12,
      }}
    >
      <div
        className="text-[11px] font-semibold uppercase tracking-widest text-center py-2"
        style={{ color: `${data.color}90` }}
      >
        {data.label}
      </div>
    </div>
  );
}
