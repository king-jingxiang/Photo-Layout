import { useEffect } from 'react';
import { useAppStore } from './store/store';
import { TopBar } from './components/TopBar';
import { LeftPanel } from './components/LeftPanel';
import { CanvasToolbar } from './components/CanvasToolbar';
import { CanvasView } from './components/CanvasView';
import { PagesBar } from './components/PagesBar';
import { Inspector } from './components/Inspector';
import { ExportDialog } from './components/ExportDialog';
import { TilingDialog } from './components/TilingDialog';
import { HelpDialog } from './components/HelpDialog';
import { BusyPill, Toast } from './components/Toast';

export default function App() {
  const init = useAppStore((s) => s.init);

  useEffect(() => {
    void init();
  }, [init]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-zinc-100">
      <TopBar />

      <div className="flex min-h-0 flex-1">
        <LeftPanel />
        <main className="flex min-w-0 flex-1 flex-col bg-zinc-100">
          <CanvasToolbar />
          <CanvasView />
          <PagesBar />
        </main>
        <Inspector />
      </div>

      <ExportDialog />
      <TilingDialog />
      <HelpDialog />
      <Toast />
      <BusyPill />
    </div>
  );
}
