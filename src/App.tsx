/**
 * App.tsx — root application component
 *
 * Fixes vs. original:
 *  1. useEffect([analyze]) was called on every render because `analyze`
 *     is a new function reference each time — replaced with an empty dep
 *     array + getState() call so it fires exactly once on mount.
 *  2. Sound init listener cleaned up correctly for all settings changes.
 *  3. Minor: sidebarOpen toggle logic unified.
 */
import { useEffect, useCallback, useState } from 'react';
import { useChessStore } from '@/store';
import Board from '@/components/Board';
import Keypad from '@/components/Keypad';
import LeftPanel from '@/components/LeftPanel';
import RightPanel, { EvalBar } from '@/components/RightPanel';
import TopBar from '@/components/TopBar';
import PromotionDialog from '@/components/PromotionDialog';
import { initAudio } from '@/sound';

export default function App() {
  const engineAnalysis = useChessStore((s) => s.engineAnalysis);
  const soundEnabled   = useChessStore((s) => s.settings.soundEnabled);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const eval_  = engineAnalysis?.evaluation ?? 0;
  const isMate = engineAnalysis?.isMate     ?? false;
  const mateIn = engineAnalysis?.mateIn     ?? null;

  // Run engine once on mount only
  useEffect(() => {
    useChessStore.getState().analyze();
  }, []);

  // Handle ?action=new URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'new') {
      useChessStore.getState().newGame();
      params.delete('action');
      const newUrl =
        window.location.pathname + (params.toString() ? `?${params.toString()}` : '');
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Initialize audio on first user interaction
  useEffect(() => {
    if (!soundEnabled) return;
    const handleFirstInteraction = () => {
      initAudio();
      window.removeEventListener('click',   handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
    window.addEventListener('click',   handleFirstInteraction);
    window.addEventListener('keydown', handleFirstInteraction);
    return () => {
      window.removeEventListener('click',   handleFirstInteraction);
      window.removeEventListener('keydown', handleFirstInteraction);
    };
  }, [soundEnabled]);

  // Global keyboard shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const isInput =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT';
    if (isInput) return;

    if (e.ctrlKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      useChessStore.getState().undoMove();
    }
    if (e.ctrlKey && (e.key === 'z' || e.key === 'Z') && e.shiftKey) {
      e.preventDefault();
      useChessStore.getState().redoMove();
    }
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      useChessStore.getState().newGame();
    }
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault();
      useChessStore.getState().flipBoard();
    }
  }, []);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="h-screen w-screen bg-[#07070d] flex flex-col overflow-hidden">
      {/* Top Bar */}
      <TopBar onMenuClick={() => setSidebarOpen((o) => !o)} />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel */}
        <div
          className={`
            transition-all duration-300 ease-in-out overflow-y-auto flex-shrink-0
            md:p-3 md:block
            ${sidebarOpen ? 'p-3 w-64 md:w-auto' : '-ml-64 md:ml-0'}
            hidden
          `}
        >
          <LeftPanel />
        </div>

        {/* Center — Board + Keypad */}
        <div className="flex-1 flex flex-col items-center justify-center gap-2 md:gap-3 p-2 md:p-3 min-w-0 overflow-y-auto md:overflow-hidden">
          {/* Board + EvalBar */}
          <div className="flex items-start gap-1 md:gap-3 flex-wrap justify-center md:flex-nowrap">
            <Board />
            <div className="hidden lg:block">
              <EvalBar evaluation={eval_} isMate={isMate} mateIn={mateIn} />
            </div>
          </div>

          {/* Keypad */}
          <div className="w-full max-w-[540px] px-2 md:px-0">
            <Keypad />
          </div>
        </div>

        {/* Right Panel */}
        <div
          className={`
            transition-all duration-300 ease-in-out overflow-y-auto flex-shrink-0
            md:p-3 md:block
            ${sidebarOpen ? 'p-2 md:p-3 w-64 md:w-auto' : '-mr-64 md:mr-0'}
            hidden
          `}
        >
          <RightPanel />
        </div>
      </div>

      {/* Promotion Dialog */}
      <PromotionDialog />

      {/* Mobile Sidebar Overlay */}
      {!sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setSidebarOpen(true)}
        />
      )}

      {/* Bottom Status Bar */}
      <div className="glass-panel-light flex items-center justify-between px-2 md:px-4 py-1 text-[10px] text-white/25 border-x-0 border-b-0 rounded-none flex-wrap gap-2">
        <span className="truncate">Chess Assistant v1.0 — Local Engine Analysis</span>
        <div className="hidden sm:flex items-center gap-2 md:gap-4 text-[9px] md:text-[10px]">
          <span>Ctrl+Z Undo</span>
          <span className="hidden md:inline">·</span>
          <span className="hidden md:inline">Ctrl+Shift+Z Redo</span>
          <span className="hidden md:inline">·</span>
          <span>Ctrl+N New</span>
          <span className="hidden md:inline">·</span>
          <span>Ctrl+F Flip</span>
        </div>
      </div>
    </div>
  );
}