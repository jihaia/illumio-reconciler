import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { listAssets, listAppGroupings, listApplications, listComponents } from '../api';
import type { SelectedNode, EntityType } from '../types';

interface Props {
  type: EntityType;
  id: string;
  name: string;
  depth: number;
  selected: SelectedNode | null;
  onSelect: (node: SelectedNode) => void;
  onCreate: (childType: EntityType, parentId: string) => void;
}

function componentDisplayName(child: Record<string, any>): string {
  // Components may not have a name — fall back to type/class info or ID
  return child.name || child.component_id?.slice(0, 8) || 'Component';
}

const CHILD_CONFIG: Record<EntityType, {
  childType: EntityType;
  label: string;
  fetcher: (parentId: string) => Promise<{ data: Array<Record<string, any>>; count: number }>;
  idField: string;
  nameField?: (child: Record<string, any>) => string;
} | null> = {
  portfolio: {
    childType: 'asset',
    label: 'Asset',
    fetcher: (id) => listAssets(id),
    idField: 'asset_id',
  },
  asset: {
    childType: 'app_grouping',
    label: 'Group',
    fetcher: (id) => listAppGroupings(id),
    idField: 'app_grouping_id',
  },
  app_grouping: {
    childType: 'application',
    label: 'App',
    fetcher: (id) => listApplications(id),
    idField: 'application_id',
  },
  application: {
    childType: 'component',
    label: 'Component',
    fetcher: (id) => listComponents(id),
    idField: 'component_id',
    nameField: componentDisplayName,
  },
  component: null, // leaf node
};

const TYPE_COLORS: Record<EntityType, string> = {
  portfolio: 'bg-blue-500',
  asset: 'bg-indigo-400',
  app_grouping: 'bg-violet-400',
  application: 'bg-green-400',
  component: 'bg-gray-400',
};

export function TreeNode({ type, id, name, depth, selected, onSelect, onCreate }: Props) {
  const [expanded, setExpanded] = useState(false);
  const config = CHILD_CONFIG[type];
  const isLeaf = !config;
  const isSelected = selected?.id === id && selected?.type === type;

  const { data: children, isLoading } = useQuery({
    queryKey: [config?.childType, id],
    queryFn: () => config!.fetcher(id),
    enabled: expanded && !!config,
  });

  return (
    <div>
      <div
        className={`flex items-center gap-1 px-2 py-1.5 cursor-pointer hover:bg-gray-50 group ${isSelected ? 'bg-primary/5 border-r-2 border-primary' : ''}`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => onSelect({ type, id, name })}
      >
        {/* Expand/collapse chevron */}
        {!isLeaf ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="w-4 h-4 flex items-center justify-center text-text-muted hover:text-text flex-shrink-0"
          >
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Color dot */}
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${TYPE_COLORS[type]}`} />

        {/* Name */}
        <span className={`text-xs truncate flex-1 ${isSelected ? 'font-medium text-primary' : 'text-text'}`}>
          {name}
        </span>

        {/* Child count */}
        {children && children.count > 0 && (
          <span className="text-[10px] text-text-muted">{children.count}</span>
        )}

        {/* Add child button */}
        {config && (
          <button
            onClick={(e) => { e.stopPropagation(); onCreate(config.childType, id); }}
            className="opacity-0 group-hover:opacity-100 text-text-muted hover:text-primary text-xs flex-shrink-0"
            title={`Add ${config.label}`}
          >
            +
          </button>
        )}
      </div>

      {/* Children */}
      {expanded && config && (
        <div>
          {isLoading && (
            <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-1">
              <span className="text-[10px] text-text-muted">Loading...</span>
            </div>
          )}
          {children?.data?.map((child: any) => (
            <TreeNode
              key={child[config.idField]}
              type={config.childType}
              id={child[config.idField]}
              name={config.nameField ? config.nameField(child) : child.name}
              depth={depth + 1}
              selected={selected}
              onSelect={onSelect}
              onCreate={onCreate}
            />
          ))}
          {!isLoading && children?.data?.length === 0 && (
            <div style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }} className="py-1">
              <span className="text-[10px] text-text-muted italic">empty</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
