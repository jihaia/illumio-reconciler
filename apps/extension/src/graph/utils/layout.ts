import type { AppNode, AppEdge } from '../types';

const LANE_PADDING = 40;
const LANE_GAP = 30;
const HEADER_HEIGHT = 32;
const NODE_V_GAP = 30;

const LANE_ORDER = ['portfolio', 'service', 'component', 'workload'] as const;

const LANE_CONFIG: Record<string, { label: string; color: string }> = {
  portfolio:  { label: 'Portfolios',  color: '#3b82f6' },
  service:    { label: 'Products',    color: '#38bdf8' },
  component:  { label: 'Components',  color: '#8b5cf6' },
  workload:   { label: 'Workloads',   color: '#94a3b8' },
};

const nodeDimensions: Record<string, { width: number; height: number }> = {
  portfolio: { width: 210, height: 80 },
  service: { width: 230, height: 110 },
  component: { width: 200, height: 70 },
  workload: { width: 290, height: 100 },
};

/**
 * Sort nodes within a lane so that nodes sharing the same parent (source) in the
 * previous lane are grouped together. This minimises edge crossings.
 */
function sortByParentAffinity(
  laneNodes: AppNode[],
  edges: AppEdge[],
  parentOrder: Map<string, number>
): AppNode[] {
  if (laneNodes.length === 0 || parentOrder.size === 0) return laneNodes;

  // Build target→sources index
  const targetParents = new Map<string, string[]>();
  for (const edge of edges) {
    const list = targetParents.get(edge.target) ?? [];
    list.push(edge.source);
    targetParents.set(edge.target, list);
  }

  // Score each node by the minimum parent position (keeps children near their parent)
  return [...laneNodes].sort((a, b) => {
    const aParents = targetParents.get(a.id) ?? [];
    const bParents = targetParents.get(b.id) ?? [];
    const aMinPos = aParents.length > 0
      ? Math.min(...aParents.map(p => parentOrder.get(p) ?? Infinity))
      : Infinity;
    const bMinPos = bParents.length > 0
      ? Math.min(...bParents.map(p => parentOrder.get(p) ?? Infinity))
      : Infinity;
    return aMinPos - bMinPos;
  });
}

export function getLayoutedElements(
  nodes: AppNode[],
  edges: AppEdge[],
  _direction: 'LR' | 'TB' = 'LR'
): { nodes: AppNode[]; edges: AppEdge[] } {
  // ─── Step 1: Bucket nodes into lanes ──────────────────────────
  const laneNodes = new Map<string, AppNode[]>();
  for (const lane of LANE_ORDER) {
    laneNodes.set(lane, []);
  }
  for (const node of nodes) {
    const lane = (node.type ?? 'workload') as string;
    if (laneNodes.has(lane)) {
      laneNodes.get(lane)!.push(node);
    }
  }

  // ─── Step 2: Sort each lane by parent affinity (left to right) ─
  // Process lanes in order; each lane's sort uses the previous lane's positions.
  let parentOrder = new Map<string, number>();

  for (const lane of LANE_ORDER) {
    const nodesInLane = laneNodes.get(lane)!;
    const sorted = sortByParentAffinity(nodesInLane, edges, parentOrder);
    laneNodes.set(lane, sorted);

    // Build position index for the next lane to use
    const nextOrder = new Map<string, number>();
    sorted.forEach((n, i) => nextOrder.set(n.id, i));
    // Merge with previous (upstream lanes are still valid parents for later lanes)
    parentOrder = new Map([...parentOrder, ...nextOrder]);
  }

  // ─── Step 3: Compute fixed lane x positions ───────────────────
  const laneWidths = new Map<string, number>();
  for (const lane of LANE_ORDER) {
    const dims = nodeDimensions[lane] ?? { width: 180, height: 50 };
    laneWidths.set(lane, dims.width + LANE_PADDING * 2);
  }

  const laneXStart = new Map<string, number>();
  let currentX = 0;
  for (const lane of LANE_ORDER) {
    laneXStart.set(lane, currentX);
    currentX += laneWidths.get(lane)! + LANE_GAP;
  }

  // ─── Step 4: Position nodes within each lane ──────────────────
  const layoutedNodes: AppNode[] = [];
  const laneContentHeights = new Map<string, number>();

  for (const lane of LANE_ORDER) {
    const entries = laneNodes.get(lane)!;
    const dims = nodeDimensions[lane] ?? { width: 180, height: 50 };
    const laneX = laneXStart.get(lane)!;
    const laneWidth = laneWidths.get(lane)!;
    // Center the node within the lane
    const nodeX = laneX + (laneWidth - dims.width) / 2;

    let y = HEADER_HEIGHT + LANE_PADDING;
    for (const node of entries) {
      layoutedNodes.push({
        ...node,
        position: { x: nodeX, y },
      });
      y += dims.height + NODE_V_GAP;
    }

    laneContentHeights.set(lane, entries.length > 0
      ? y - NODE_V_GAP + LANE_PADDING
      : HEADER_HEIGHT + LANE_PADDING * 2 + 60
    );
  }

  // ─── Step 5: Generate swimlane background nodes ───────────────
  const maxHeight = Math.max(...laneContentHeights.values());

  const swimlaneNodes: AppNode[] = LANE_ORDER.map((lane) => {
    const cfg = LANE_CONFIG[lane];
    const laneX = laneXStart.get(lane)!;
    const laneWidth = laneWidths.get(lane)!;

    return {
      id: `lane:${lane}`,
      type: 'swimlane',
      position: { x: laneX, y: 0 },
      data: {
        label: cfg.label,
        color: cfg.color,
        laneWidth,
        laneHeight: maxHeight,
      },
      draggable: false,
      selectable: false,
      connectable: false,
      zIndex: -1,
    } as AppNode;
  });

  return { nodes: [...swimlaneNodes, ...layoutedNodes], edges };
}
