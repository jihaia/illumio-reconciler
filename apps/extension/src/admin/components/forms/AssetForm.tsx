import { useState, useEffect } from 'react';
import { getAsset, createAsset, updateAsset, deleteAsset } from '../../api';
import { DeleteConfirm } from '../DeleteConfirm';

interface Props {
  id?: string;
  parentId?: string;
  mode: 'view' | 'create';
  onSaved: () => void;
  onDeleted: () => void;
}

export function AssetForm({ id, parentId, mode, onSaved, onDeleted }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [criticality, setCriticality] = useState('');
  const [environment, setEnvironment] = useState('');
  const [category, setCategory] = useState('');
  const [infrastructure, setInfrastructure] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [entityName, setEntityName] = useState('');
  const isNew = mode === 'create';

  useEffect(() => {
    if (id && !isNew) {
      getAsset(id).then((a) => {
        setName(a.name);
        setDescription(a.description || '');
        setCriticality(a.criticality || '');
        setEnvironment(a.environment || '');
        setCategory(a.category || '');
        setInfrastructure(a.infrastructure || '');
        setEntityName(a.name);
      });
    }
  }, [id, isNew]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isNew) {
        await createAsset({
          name,
          portfolio_id: parentId!,
          description: description || undefined,
          criticality: criticality || undefined,
          environment: environment || undefined,
          category: category || undefined,
          infrastructure: infrastructure || undefined,
        });
      } else {
        await updateAsset(id!, { name, description, criticality, environment, category, infrastructure });
      }
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      await deleteAsset(id!);
      onDeleted();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setShowDelete(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-text">
          {isNew ? 'New Asset' : 'Edit Asset'}
        </h2>
        {!isNew && (
          <button type="button" onClick={() => setShowDelete(true)} className="text-xs text-red-500 hover:text-red-600">
            Delete
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <label className="block">
        <span className="text-xs text-text-muted">Name *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} required className="input mt-1" />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-xs text-text-muted">Criticality</span>
          <input value={criticality} onChange={(e) => setCriticality(e.target.value)} className="input mt-1" />
        </label>
        <label className="block">
          <span className="text-xs text-text-muted">Environment</span>
          <input value={environment} onChange={(e) => setEnvironment(e.target.value)} className="input mt-1" />
        </label>
        <label className="block">
          <span className="text-xs text-text-muted">Category</span>
          <input value={category} onChange={(e) => setCategory(e.target.value)} className="input mt-1" />
        </label>
        <label className="block">
          <span className="text-xs text-text-muted">Infrastructure</span>
          <input value={infrastructure} onChange={(e) => setInfrastructure(e.target.value)} className="input mt-1" />
        </label>
      </div>

      <label className="block">
        <span className="text-xs text-text-muted">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input mt-1" />
      </label>

      <button type="submit" disabled={loading || !name} className="btn btn-primary btn-sm">
        {loading ? 'Saving...' : isNew ? 'Create' : 'Save'}
      </button>

      {showDelete && (
        <DeleteConfirm entityName={entityName} onConfirm={handleDelete} onCancel={() => setShowDelete(false)} loading={loading} />
      )}
    </form>
  );
}
