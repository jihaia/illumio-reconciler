import { useState } from 'react';
import { Header } from './components/Header';
import { WorkloadView } from './components/WorkloadView';
import { DashboardView } from './components/DashboardView';
import { Footer } from './components/Footer';
import { useCurrentWorkload } from './hooks/useCurrentWorkload';

export default function App() {
  const [view, setView] = useState<'workload' | 'dashboard'>('workload');
  const { currentWorkload, visitedWorkloads, loading } = useCurrentWorkload();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-xs text-text-muted">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen pb-14">
      <Header
        view={view}
        onToggleView={() => setView(view === 'workload' ? 'dashboard' : 'workload')}
        visitedCount={visitedWorkloads.length}
      />

      <main className="flex-1 p-4">
        {view === 'workload' ? (
          <WorkloadView
            currentWorkload={currentWorkload}
            visitedWorkloads={visitedWorkloads}
          />
        ) : (
          <DashboardView
            visitedWorkloads={visitedWorkloads}
            onSelectWorkload={() => setView('workload')}
          />
        )}
      </main>

      <Footer
        visitedWorkloads={visitedWorkloads}
        currentWorkload={currentWorkload}
      />
    </div>
  );
}
