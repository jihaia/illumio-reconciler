import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AdminHeader } from './components/AdminHeader';
import { TreeView } from './components/TreeView';
import { EntityDetail } from './components/EntityDetail';
import { CsvImport } from './components/CsvImport';
import type { SelectedNode } from './types';

export default function App() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<SelectedNode | null>(null);
  const [mode, setMode] = useState<'view' | 'create' | 'csv'>('view');
  const [createParent, setCreateParent] = useState<{ type: SelectedNode['type']; parentId: string } | null>(null);

  const refresh = useCallback(() => {
    queryClient.invalidateQueries();
  }, [queryClient]);

  function handleSelect(node: SelectedNode) {
    setSelected(node);
    setMode('view');
    setCreateParent(null);
  }

  function handleCreate(childType: SelectedNode['type'], parentId: string) {
    setSelected(null);
    setMode('create');
    setCreateParent({ type: childType, parentId });
  }

  function handleSaved() {
    refresh();
    setMode('view');
    setCreateParent(null);
  }

  function handleDeleted() {
    setSelected(null);
    refresh();
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      <AdminHeader
        onImportCsv={() => setMode('csv')}
        onRefresh={refresh}
      />
      <div className="flex flex-1 overflow-hidden">
        <TreeView
          selected={selected}
          onSelect={handleSelect}
          onCreate={handleCreate}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {mode === 'csv' ? (
            <CsvImport
              onDone={() => { setMode('view'); refresh(); }}
              onCancel={() => setMode('view')}
            />
          ) : (
            <EntityDetail
              selected={selected}
              mode={mode}
              createParent={createParent}
              onSaved={handleSaved}
              onDeleted={handleDeleted}
              onEdit={() => setMode('view')}
            />
          )}
        </main>
      </div>
    </div>
  );
}
