import { useCallback, useRef, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ControlButton,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type NodeMouseHandler,
  type Edge,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { PortfolioNode } from './nodes/PortfolioNode';
import { ServiceNode } from './nodes/ServiceNode';
import { ComponentNode } from './nodes/ComponentNode';
import { WorkloadNode } from './nodes/WorkloadNode';
import { SwimlaneNode } from './nodes/SwimlaneNode';
import type { AppNode, AppEdge, SelectedNodeInfo, SelectedNodeType } from '../types';

const nodeTypes = {
  portfolio: PortfolioNode,
  service: ServiceNode,
  component: ComponentNode,
  workload: WorkloadNode,
  swimlane: SwimlaneNode,
} as const;

type EdgeStyle = 'smoothstep' | 'bezier' | 'straight' | 'step';

const EDGE_STYLES: EdgeStyle[] = ['bezier', 'smoothstep', 'straight', 'step'];

const EDGE_STYLE_ICONS: Record<EdgeStyle, { label: string; path: string }> = {
  smoothstep: {
    label: 'Smooth step',
    path: 'M3 18 L3 12 Q3 6 9 6 L15 6 Q21 6 21 12 L21 18',
  },
  bezier: {
    label: 'Bezier curve',
    path: 'M3 18 C3 6 21 18 21 6',
  },
  straight: {
    label: 'Straight line',
    path: 'M3 18 L21 6',
  },
  step: {
    label: 'Step',
    path: 'M3 18 L3 12 L21 12 L21 6',
  },
};

function applyEdgeType(edges: AppEdge[], edgeType: EdgeStyle): AppEdge[] {
  return edges.map((e) => ({ ...e, type: edgeType }));
}

// ─── Path highlighting ───────────────────────────────────────

const HIGHLIGHT_COLOR = '#f59e0b'; // amber-500
const DIM_EDGE_COLOR = '#e2e8f0';  // slate-200
const DIM_NODE_OPACITY = 0.25;

/** Walk edges upstream (toward sources/parents) and downstream (toward targets/children)
 *  separately, so clicking a service shows its portfolio above and workloads below,
 *  but does NOT traverse back down from the portfolio to sibling services. */
function getConnectedPath(nodeId: string, edges: Edge[]): Set<string> {
  const connected = new Set<string>([nodeId]);

  // Walk upstream: follow edges from target → source (portfolio direction)
  const upQueue = [nodeId];
  const upVisited = new Set<string>();
  while (upQueue.length > 0) {
    const current = upQueue.shift()!;
    if (upVisited.has(current)) continue;
    upVisited.add(current);
    for (const edge of edges) {
      if (edge.target === current && !connected.has(edge.source)) {
        connected.add(edge.source);
        upQueue.push(edge.source);
      }
    }
  }

  // Walk downstream: follow edges from source → target (workload direction)
  const downQueue = [nodeId];
  const downVisited = new Set<string>();
  while (downQueue.length > 0) {
    const current = downQueue.shift()!;
    if (downVisited.has(current)) continue;
    downVisited.add(current);
    for (const edge of edges) {
      if (edge.source === current && !connected.has(edge.target)) {
        connected.add(edge.target);
        downQueue.push(edge.target);
      }
    }
  }

  return connected;
}

interface GraphCanvasProps {
  initialNodes: AppNode[];
  initialEdges: AppEdge[];
  onNodeSelect: (node: SelectedNodeInfo | null) => void;
  onNodeExpand?: (nodeId: string) => void;
}

export function GraphCanvas({ initialNodes, initialEdges, onNodeSelect, onNodeExpand }: GraphCanvasProps) {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [edgeStyle, setEdgeStyle] = useState<EdgeStyle>('bezier');
  const [highlightedNode, setHighlightedNode] = useState<string | null>(null);
  const reactFlowInstance = useReactFlow();
  const prevDataRef = useRef({ nodes: initialNodes, edges: initialEdges });
  // Keep a ref to the "base" edges (before highlight styling) so we can restore
  const baseEdgesRef = useRef<AppEdge[]>(applyEdgeType(initialEdges, 'bezier'));

  // Sync when data changes from parent (filter changes, expansion)
  if (
    initialNodes !== prevDataRef.current.nodes ||
    initialEdges !== prevDataRef.current.edges
  ) {
    prevDataRef.current = { nodes: initialNodes, edges: initialEdges };
    const styled = applyEdgeType(initialEdges, edgeStyle);
    baseEdgesRef.current = styled;
    setNodes(initialNodes);
    setEdges(styled);
    setHighlightedNode(null);
    // Fit view after a brief delay to let the layout settle
    setTimeout(() => {
      reactFlowInstance.fitView({ padding: 0.1, duration: 400 });
    }, 50);
  }

  /** Apply path highlighting for the given node. */
  const applyHighlight = useCallback(
    (nodeId: string) => {
      const connectedNodes = getConnectedPath(nodeId, baseEdgesRef.current);

      setEdges(
        baseEdgesRef.current.map((e) => {
          const isOnPath = connectedNodes.has(e.source) && connectedNodes.has(e.target);
          return {
            ...e,
            style: isOnPath
              ? { stroke: HIGHLIGHT_COLOR, strokeWidth: 2.5 }
              : { stroke: DIM_EDGE_COLOR, strokeWidth: 1, opacity: 0.4 },
            animated: isOnPath,
            zIndex: isOnPath ? 10 : 0,
          };
        })
      );

      setNodes((nds) =>
        nds.map((n) => ({
          ...n,
          style: n.type === 'swimlane' || connectedNodes.has(n.id)
            ? { opacity: 1 }
            : { opacity: DIM_NODE_OPACITY },
        }))
      );
    },
    [setEdges, setNodes]
  );

  /** Clear all highlight styling back to defaults. */
  const clearHighlight = useCallback(() => {
    setEdges(baseEdgesRef.current);
    setNodes((nds) => nds.map((n) => ({ ...n, style: { opacity: 1 } })));
    setHighlightedNode(null);
  }, [setEdges, setNodes]);

  const cycleEdgeStyle = useCallback(() => {
    setEdgeStyle((prev) => {
      const idx = EDGE_STYLES.indexOf(prev);
      const next = EDGE_STYLES[(idx + 1) % EDGE_STYLES.length];
      // Update the base edges with the new type (preserving original styles)
      baseEdgesRef.current = applyEdgeType(baseEdgesRef.current, next);
      // If a node is highlighted, re-apply highlight with new edge type
      if (highlightedNode) {
        applyHighlight(highlightedNode);
      } else {
        setEdges(baseEdgesRef.current);
      }
      return next;
    });
  }, [setEdges, highlightedNode, applyHighlight]);

  const onNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      if (node.type === 'swimlane') return; // ignore lane background clicks
      const type = node.type as SelectedNodeType;
      onNodeSelect({ type, id: node.id, data: node.data as any });
      setHighlightedNode(node.id);
      applyHighlight(node.id);
    },
    [onNodeSelect, applyHighlight]
  );

  const onNodeDoubleClick: NodeMouseHandler = useCallback((_event, node) => {
    // Double-click expands service/portfolio nodes in focused mode
    if (onNodeExpand && (node.type === 'service' || node.type === 'portfolio')) {
      onNodeExpand(node.id);
    }
  }, [onNodeExpand]);

  const onPaneClick = useCallback(() => {
    onNodeSelect(null);
    clearHighlight();
  }, [onNodeSelect, clearHighlight]);

  const currentIcon = EDGE_STYLE_ICONS[edgeStyle];

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onPaneClick={onPaneClick}
      nodeTypes={nodeTypes}
      fitView
      fitViewOptions={{ padding: 0.1 }}
      minZoom={0.1}
      maxZoom={2}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} color="#f1f5f9" />
      <Controls position="top-right" showInteractive={false}>
        <ControlButton
          onClick={cycleEdgeStyle}
          title={`Edge style: ${currentIcon.label} (click to cycle)`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d={currentIcon.path} />
            <circle cx="3" cy="18" r="2" fill="currentColor" stroke="none" />
            <circle cx="21" cy="6" r="2" fill="currentColor" stroke="none" />
          </svg>
        </ControlButton>
      </Controls>
      <MiniMap
        position="bottom-right"
        pannable
        zoomable
        nodeColor={(node) => {
          if (node.type === 'swimlane') return 'transparent';
          switch (node.type) {
            case 'portfolio': return '#3b82f6';
            case 'service': return '#38bdf8';
            case 'component': return '#8b5cf6';
            case 'workload': return '#94a3b8';
            default: return '#e2e8f0';
          }
        }}
        style={{ border: '1px solid #e2e8f0', borderRadius: 8 }}
      />
    </ReactFlow>
  );
}
