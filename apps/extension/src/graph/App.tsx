import { useState, useCallback, useEffect } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { GraphCanvas } from './components/GraphCanvas';
import { FilterBar } from './components/FilterBar';
import { DetailPanel } from './components/DetailPanel';
import { Legend } from './components/Legend';
import { useGraphData } from './hooks/useGraphData';
import type { SelectedNodeInfo } from './types';

export default function App() {
  const {
    nodes,
    edges,
    allPortfolios,
    availableServices,
    filters,
    setFilter,
    resetFilters,
    stats,
    loading,
    expanding,
    error,
    reload,
    focusedNodeId,
    focusedHostname,
    clearFocus,
    expandNode,
    expandedNodes,
    collapseToFocus,
    exitFocusMode,
  } = useGraphData();

  const [selectedNode, setSelectedNode] = useState<SelectedNodeInfo | null>(null);
  const [legendCollapsed, setLegendCollapsed] = useState(true);

  const isFocusedMode = !!focusedHostname;

  // Clear the focus hash once data has loaded (don't auto-open detail panel)
  useEffect(() => {
    if (!focusedNodeId || nodes.length === 0) return;
    clearFocus();
  }, [focusedNodeId, nodes, clearFocus]);

  const handleDrillDown = useCallback(
    (type: string, value: string) => {
      if (type === 'portfolio') {
        setFilter('portfolio', value);
      } else if (type === 'service') {
        setFilter('service', value);
      }
      setSelectedNode(null);
    },
    [setFilter]
  );

  const handleExpand = useCallback(
    (nodeId: string) => {
      expandNode(nodeId);
    },
    [expandNode]
  );

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">Loading CMDB data from ServiceNow...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <svg className="w-12 h-12 mx-auto text-red-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="text-sm font-medium text-gray-700 mb-1">Failed to load graph data</p>
          <p className="text-xs text-gray-500 mb-4">{error}</p>
          <button onClick={reload} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-50">
      {/* In focused mode, show a focus bar instead of the filter bar */}
      {isFocusedMode ? (
        <FocusBar
          hostname={focusedHostname!}
          expandedCount={expandedNodes.size}
          expanding={expanding}
          onCollapse={collapseToFocus}
          onShowAll={exitFocusMode}
        />
      ) : (
        <FilterBar
          portfolios={allPortfolios}
          services={availableServices}
          filters={filters}
          onFilterChange={setFilter}
          onReset={resetFilters}
          stats={stats}
        />
      )}

      <div className="flex-1 relative">
        {nodes.length === 0 ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-center">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <p className="text-sm font-medium text-gray-600 mb-1">No matching workloads</p>
              <p className="text-xs text-gray-400 mb-4">
                {allPortfolios.length === 0
                  ? 'Connect to ServiceNow in the popup to load CMDB data'
                  : 'Try adjusting your filters or search query'}
              </p>
              {(filters.portfolio || filters.service || filters.search) && (
                <button
                  onClick={resetFilters}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>
        ) : (
          <ReactFlowProvider>
            <GraphCanvas
              initialNodes={nodes}
              initialEdges={edges}
              onNodeSelect={setSelectedNode}
              onNodeExpand={isFocusedMode ? handleExpand : undefined}
            />
          </ReactFlowProvider>
        )}

        {/* Hint overlay for focused mode */}
        {isFocusedMode && nodes.length > 0 && expandedNodes.size === 0 && (
          <div className="absolute bottom-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-lg shadow-md border border-gray-200 px-3 py-2 text-xs text-gray-600 max-w-[260px]">
            <span className="font-medium text-blue-600">Tip:</span> Double-click a product or portfolio node to expand and see other connected workloads.
          </div>
        )}

        <Legend
          collapsed={legendCollapsed}
          onToggle={() => setLegendCollapsed(!legendCollapsed)}
        />

        {selectedNode && (
          <DetailPanel
            node={selectedNode}
            onClose={() => setSelectedNode(null)}
            onDrillDown={handleDrillDown}
            onExpand={handleExpand}
            isExpanded={expandedNodes.has(selectedNode.id)}
            isFocusedMode={isFocusedMode}
          />
        )}
      </div>
    </div>
  );
}

function FocusBar({
  hostname,
  expandedCount,
  expanding,
  onCollapse,
  onShowAll,
}: {
  hostname: string;
  expandedCount: number;
  expanding: boolean;
  onCollapse: () => void;
  onShowAll: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        <span className="text-sm font-medium text-gray-900 truncate">
          Focused on: <span className="font-mono text-blue-600">{hostname}</span>
        </span>
        {expanding && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-[10px] text-blue-600 font-medium">Loading...</span>
          </div>
        )}
        {!expanding && expandedCount > 0 && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium flex-shrink-0">
            {expandedCount} expanded
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {expandedCount > 0 && (
          <button
            onClick={onCollapse}
            className="text-xs text-gray-600 hover:text-gray-800 font-medium px-2.5 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Reset view
          </button>
        )}
        <button
          onClick={onShowAll}
          className="text-xs text-blue-600 hover:text-blue-800 font-medium px-2.5 py-1.5 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Show all
        </button>
      </div>
    </div>
  );
}
