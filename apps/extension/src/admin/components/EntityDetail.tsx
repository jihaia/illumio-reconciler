import type { SelectedNode, EntityType } from '../types';
import { PortfolioForm } from './forms/PortfolioForm';
import { AssetForm } from './forms/AssetForm';
import { AppGroupingForm } from './forms/AppGroupingForm';
import { ApplicationForm } from './forms/ApplicationForm';
import { ComponentForm } from './forms/ComponentForm';
import { WorkloadLinker } from './WorkloadLinker';

interface Props {
  selected: SelectedNode | null;
  mode: 'view' | 'create';
  createParent: { type: EntityType; parentId: string } | null;
  onSaved: () => void;
  onDeleted: () => void;
  onEdit: () => void;
}

const TYPE_LABELS: Record<EntityType, string> = {
  portfolio: 'Portfolio',
  asset: 'Asset',
  app_grouping: 'App Grouping',
  application: 'Application',
  component: 'Component',
};

export function EntityDetail({ selected, mode, createParent, onSaved, onDeleted }: Props) {
  const isCreating = mode === 'create' && createParent;
  const entityType = isCreating ? createParent.type : selected?.type;
  const entityId = isCreating ? undefined : selected?.id;
  const parentId = isCreating ? createParent.parentId : undefined;

  if (!entityType && !isCreating) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted">
        <div className="text-center">
          <p className="text-sm">Select an item from the tree to view or edit</p>
          <p className="text-xs mt-1">Or use the + buttons to create new entities</p>
        </div>
      </div>
    );
  }

  const formProps = {
    id: entityId,
    parentId,
    mode: isCreating ? 'create' as const : 'view' as const,
    onSaved,
    onDeleted,
  };

  return (
    <div className="max-w-lg">
      <div className="mb-4">
        <span className="text-[10px] text-text-muted uppercase tracking-wider">
          {TYPE_LABELS[entityType!]}
        </span>
      </div>

      {entityType === 'portfolio' && <PortfolioForm {...formProps} />}
      {entityType === 'asset' && <AssetForm {...formProps} />}
      {entityType === 'app_grouping' && <AppGroupingForm {...formProps} />}
      {entityType === 'application' && <ApplicationForm {...formProps} />}
      {entityType === 'component' && <ComponentForm {...formProps} />}

      {entityType === 'component' && entityId && (
        <WorkloadLinker componentId={entityId} />
      )}
    </div>
  );
}
