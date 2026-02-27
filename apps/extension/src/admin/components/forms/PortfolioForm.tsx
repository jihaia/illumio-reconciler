import { useState, useEffect } from 'react';
import { getPortfolio, createPortfolio, updatePortfolio, deletePortfolio } from '../../api';
import { DeleteConfirm } from '../DeleteConfirm';

interface Props {
  id?: string;
  parentId?: string;
  mode: 'view' | 'create';
  onSaved: () => void;
  onDeleted: () => void;
}

export function PortfolioForm({ id, mode, onSaved, onDeleted }: Props) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [state, setState] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [entityName, setEntityName] = useState('');
  const isNew = mode === 'create';

  useEffect(() => {
    if (id && !isNew) {
      getPortfolio(id).then((p) => {
        setName(p.name);
        setDescription(p.description || '');
        setState(p.state || '');
        setEntityName(p.name);
      });
    }
  }, [id, isNew]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isNew) {
        await createPortfolio({ name, description: description || undefined, state: state || undefined });
      } else {
        await updatePortfolio(id!, { name, description, state });
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
      await deletePortfolio(id!);
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
          {isNew ? 'New Portfolio' : 'Edit Portfolio'}
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

      <label className="block">
        <span className="text-xs text-text-muted">State</span>
        <input value={state} onChange={(e) => setState(e.target.value)} className="input mt-1" />
      </label>

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
