import { useQuery } from '@tanstack/react-query';
import { listPortfolios } from '../api';
import { TreeNode } from './TreeNode';
import type { SelectedNode } from '../types';

interface Props {
  selected: SelectedNode | null;
  onSelect: (node: SelectedNode) => void;
  onCreate: (childType: SelectedNode['type'], parentId: string) => void;
}

export function TreeView({ selected, onSelect, onCreate }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['portfolios'],
    queryFn: () => listPortfolios(),
  });

  return (
    <aside className="w-80 border-r border-border bg-white overflow-y-auto flex-shrink-0 flex flex-col">
      <div className="p-3 border-b border-border flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Hierarchy</span>
        <button
          onClick={() => onCreate('portfolio', '')}
          className="text-xs text-primary hover:text-primary-600 font-medium"
          title="Add Portfolio"
        >
          + Portfolio
        </button>
      </div>
      <div className="flex-1 overflow-y-auto py-1">
        {isLoading && (
          <div className="p-4 text-center">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          </div>
        )}
        {data?.data?.map((p) => (
          <TreeNode
            key={p.portfolio_id}
            type="portfolio"
            id={p.portfolio_id}
            name={p.name}
            depth={0}
            selected={selected}
            onSelect={onSelect}
            onCreate={onCreate}
          />
        ))}
        {!isLoading && (!data?.data || data.data.length === 0) && (
          <p className="text-xs text-text-muted text-center p-4">No portfolios yet</p>
        )}
      </div>
    </aside>
  );
}
