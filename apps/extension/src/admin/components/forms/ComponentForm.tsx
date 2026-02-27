import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getComponent, createComponent, updateComponent, deleteComponent, listComponentClasses, listComponentTypes } from '../../api';
import { DeleteConfirm } from '../DeleteConfirm';

interface Props {
  id?: string;
  parentId?: string;
  mode: 'view' | 'create';
  onSaved: () => void;
  onDeleted: () => void;
}

export function ComponentForm({ id, parentId, mode, onSaved, onDeleted }: Props) {
  const [classId, setClassId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [entityLabel, setEntityLabel] = useState('');
  const isNew = mode === 'create';

  const { data: classesData } = useQuery({
    queryKey: ['component-classes'],
    queryFn: () => listComponentClasses(),
  });

  const { data: typesData } = useQuery({
    queryKey: ['component-types', classId],
    queryFn: () => listComponentTypes(classId),
    enabled: !!classId,
  });

  useEffect(() => {
    if (id && !isNew) {
      getComponent(id).then((c) => {
        setClassId(c.component_class_id || '');
        setTypeId(c.component_type_id || '');
        setDescription(c.description || '');
        setEntityLabel(c.name || c.component_type_id || c.component_id);
      });
    }
  }, [id, isNew]);

  function handleClassChange(newClassId: string) {
    setClassId(newClassId);
    setTypeId(''); // reset type when class changes
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      if (isNew) {
        await createComponent({
          application_id: parentId!,
          component_class_id: classId || undefined,
          component_type_id: typeId || undefined,
          description: description || undefined,
        });
      } else {
        await updateComponent(id!, {
          component_class_id: classId || null,
          component_type_id: typeId || null,
          description: description || null,
        });
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
      await deleteComponent(id!);
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
          {isNew ? 'New Component' : 'Edit Component'}
        </h2>
        {!isNew && (
          <button type="button" onClick={() => setShowDelete(true)} className="text-xs text-red-500 hover:text-red-600">
            Delete
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <label className="block">
        <span className="text-xs text-text-muted">Class</span>
        <select value={classId} onChange={(e) => handleClassChange(e.target.value)} className="input mt-1">
          <option value="">— Select class —</option>
          {classesData?.data?.map((cls) => (
            <option key={cls.component_class_id} value={cls.component_class_id}>
              {cls.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className={`text-xs ${classId ? 'text-text-muted' : 'text-text-muted/50'}`}>Type</span>
        <select
          value={typeId}
          onChange={(e) => setTypeId(e.target.value)}
          disabled={!classId}
          className={`input mt-1 ${!classId ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <option value="">{classId ? '— Select type —' : '— Select a class first —'}</option>
          {typesData?.data?.map((t) => (
            <option key={t.component_type_id} value={t.component_type_id}>
              {t.label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-xs text-text-muted">Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="input mt-1" />
      </label>

      <button type="submit" disabled={loading} className="btn btn-primary btn-sm">
        {loading ? 'Saving...' : isNew ? 'Create' : 'Save'}
      </button>

      {showDelete && (
        <DeleteConfirm entityName={entityLabel} onConfirm={handleDelete} onCancel={() => setShowDelete(false)} loading={loading} />
      )}
    </form>
  );
}
