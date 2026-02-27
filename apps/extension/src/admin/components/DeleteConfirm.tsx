interface Props {
  entityName: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteConfirm({ entityName, onConfirm, onCancel, loading }: Props) {
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4">
        <h3 className="text-sm font-semibold text-text mb-2">Delete {entityName}?</h3>
        <p className="text-xs text-text-muted mb-4">
          This will permanently delete <strong>{entityName}</strong> and cannot be undone.
          Any child entities will also be removed.
        </p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="btn btn-outline btn-sm" disabled={loading}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn btn-sm bg-red-500 text-white hover:bg-red-600"
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
