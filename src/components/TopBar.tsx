import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChessStore } from '@/store';

function ImportModal() {
  const { importType, toggleImportModal, importPgn, importFen } = useChessStore();
  const [text, setText] = useState('');
  const [error, setError] = useState('');

  const handleImport = () => {
    setError('');
    if (importType === 'pgn') {
      const success = importPgn(text);
      if (!success) setError('Invalid PGN. Please check the format.');
      else setText('');
    } else {
      const success = importFen(text);
      if (!success) setError('Invalid FEN. Please check the format.');
      else setText('');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => toggleImportModal()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-modal-title"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-panel rounded-2xl p-6 w-[460px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="import-modal-title" className="text-lg font-bold text-white">
            Import {importType === 'pgn' ? 'PGN' : 'FEN'}
          </h2>
          <button
            onClick={() => toggleImportModal()}
            className="text-white/40 hover:text-white transition-colors text-xl"
            aria-label="Close dialog"
          >
            ✕
          </button>
        </div>

        <div className="flex gap-2 mb-3">
          <button
            onClick={() => toggleImportModal('pgn')}
            aria-pressed={importType === 'pgn'}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              importType === 'pgn'
                ? 'bg-[#00ff88] text-black'
                : 'bg-[#1a1f2e] text-white/60 hover:text-white'
            }`}
          >
            PGN
          </button>
          <button
            onClick={() => toggleImportModal('fen')}
            aria-pressed={importType === 'fen'}
            className={`px-3 py-1 rounded text-xs font-semibold transition-colors ${
              importType === 'fen'
                ? 'bg-[#00ff88] text-black'
                : 'bg-[#1a1f2e] text-white/60 hover:text-white'
            }`}
          >
            FEN
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          placeholder={importType === 'pgn' ? 'Paste PGN here...' : 'Paste FEN position...'}
          className="w-full h-32 bg-[#0a0c14] border border-[#2a3040] rounded-lg p-3 text-sm text-white font-mono resize-none focus:outline-none focus:border-[#00ff88]/40 transition-colors"
          aria-label={`${importType.toUpperCase()} input`}
        />

        {error && <p className="text-xs text-red-400 mt-2" role="alert">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => toggleImportModal()}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-[#1a1f2e] text-white/60 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleImport}
            className="px-4 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{ background: 'linear-gradient(145deg, #00ff88, #00cc6a)', color: '#07070d' }}
          >
            Import
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

function SettingsModal() {
  const { toggleSettings, settings, updateSettings, setEngineDepth } = useChessStore();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => toggleSettings()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="glass-panel rounded-2xl p-6 w-[400px] max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 id="settings-modal-title" className="text-lg font-bold text-white">⚙ Settings</h2>
          <button onClick={() => toggleSettings()} className="text-white/40 hover:text-white text-xl" aria-label="Close settings">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label htmlFor="engine-depth" className="text-xs text-white/50 mb-1 block">Engine Depth</label>
            <div className="flex items-center gap-3">
              <input
                id="engine-depth"
                type="range" 
                min={1} 
                max={12} 
                value={settings.engineDepth}
                onChange={(e) => setEngineDepth(Number(e.target.value))}
                className="flex-1 accent-[#00ff88]"
                aria-valuemin={1}
                aria-valuemax={12}
                aria-valuenow={settings.engineDepth}
              />
              <span className="text-sm text-[#00ff88] font-mono w-6">{settings.engineDepth}</span>
            </div>
            {settings.engineDepth >= 8 && (
              <p className="text-[10px] text-[#00ff88]/60 italic mt-1 ml-1">
                {settings.engineDepth >= 10 ? '⚡ Master Mode: Deep analysis, may take several seconds.' : 'Pro Search: Significantly stronger engine.'}
              </p>
            )}
          </div>

          <ToggleSetting label="Show Engine Arrows" value={settings.showArrows} onChange={(v) => updateSettings({ showArrows: v })} />
          <ToggleSetting label="Show Legal Moves" value={settings.showLegalMoves} onChange={(v) => updateSettings({ showLegalMoves: v })} />
          <ToggleSetting label="Sound Effects" value={settings.soundEnabled} onChange={(v) => updateSettings({ soundEnabled: v })} />
          <ToggleSetting label="Voice Input" value={settings.voiceEnabled} onChange={(v) => updateSettings({ voiceEnabled: v })} />
        </div>
      </motion.div>
    </motion.div>
  );
}

function ToggleSetting({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/60">{label}</span>
      <button
        onClick={() => onChange(!value)}
        role="switch"
        aria-checked={value}
        className={`w-10 h-5 rounded-full transition-colors relative ${value ? 'bg-[#00ff88]' : 'bg-[#2a3040]'}`}
        aria-label={`${label}: ${value ? 'enabled' : 'disabled'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  );
}

export default function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { 
    newGame, toggleImportModal, toggleSettings, 
    undoMove, showImportModal, showSettings,
    userSide, setUserSide
  } = useChessStore();
  const [copied, setCopied] = useState('');

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    }).catch(() => {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(label);
      setTimeout(() => setCopied(''), 2000);
    });
  };

  return (
    <>
      <div className="glass-panel flex items-center justify-between px-2 md:px-4 py-2 m-0 rounded-none border-x-0 border-t-0 gap-2 overflow-x-auto">
        {/* Mobile menu button */}
        <button
          onClick={onMenuClick}
          className="md:hidden px-2 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1f2e] text-white/70 hover:text-white transition-all flex-shrink-0"
          aria-label="Toggle sidebar menu"
        >
          ☰
        </button>

        {/* Left side: Logo + Title */}
        <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
          <div className="text-lg md:text-xl">♞</div>
          <div className="hidden sm:block">
            <h1 className="text-xs md:text-sm font-bold tracking-wide text-white">Chess Assistant</h1>
            <p className="text-[8px] md:text-[10px] text-white/30">Professional Analyzer</p>
          </div>
        </div>

        {/* Center: Assistant Side Selector & Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Side Selector */}
          <div className="hidden md:flex items-center bg-[#0a0c14] rounded-lg p-0.5 border border-white/5">
            <button 
              onClick={() => setUserSide('w')}
              className={`px-2.5 py-1 rounded-md text-[9px] font-bold tracking-tight transition-all ${
                userSide === 'w' 
                  ? 'bg-[#00ff88] text-black shadow-[0_0_10px_rgba(0,255,136,0.3)]' 
                  : 'text-white/40 hover:text-white'
              }`}
            >
              PLAY WHITE
            </button>
            <button 
              onClick={() => setUserSide('b')}
              className={`px-2.5 py-1 rounded-md text-[9px] font-bold tracking-tight transition-all ${
                userSide === 'b' 
                  ? 'bg-[#00ff88] text-black shadow-[0_0_10px_rgba(0,255,136,0.3)]' 
                  : 'text-white/40 hover:text-white'
              }`}
            >
              PLAY BLACK
            </button>
            <button 
              onClick={() => setUserSide('none')}
              className={`px-2 py-1 rounded-md text-[9px] font-bold transition-all ${
                userSide === 'none' 
                  ? 'text-[#00ff88]' 
                  : 'text-white/20 hover:text-white'
              }`}
              title="Analyzer Mode (Calculate for both sides)"
            >
              OFF
            </button>
          </div>

          <div className="hidden md:flex items-center gap-1">
            <button
              onClick={newGame}
              className="px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1f2e] text-white/70 hover:text-white hover:bg-[#222840] border border-white/5 transition-all whitespace-nowrap"
              title="Start a new game (Ctrl+N)"
            >
              ♟ New
            </button>
            <button
              onClick={() => undoMove()}
              className="px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1f2e] text-white/70 hover:text-white hover:bg-[#222840] border border-white/5 transition-all whitespace-nowrap"
              title="Undo last move (Ctrl+Z)"
            >
              ↩ Undo
            </button>
            <button
              onClick={() => toggleImportModal('pgn')}
              className="px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1f2e] text-white/70 hover:text-white hover:bg-[#222840] border border-white/5 transition-all whitespace-nowrap hidden lg:block"
              title="Import PGN or FEN"
            >
              📥 Import
            </button>
          </div>
        </div>

        {/* Export buttons - responsive */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => copyToClipboard(pgn, 'PGN')}
            className="px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1f2e] text-white/70 hover:text-white hover:bg-[#222840] border border-white/5 transition-all whitespace-nowrap"
            title="Copy game as PGN"
          >
            {copied === 'PGN' ? '✓' : '📤'}
          </button>
          <button
            onClick={() => copyToClipboard(fen, 'FEN')}
            className="px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1f2e] text-white/70 hover:text-white hover:bg-[#222840] border border-white/5 transition-all whitespace-nowrap"
            title="Copy position as FEN"
          >
            {copied === 'FEN' ? '✓' : '📋'}
          </button>
        </div>

        {/* Right side: Settings */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => toggleSettings()}
            className="px-2 md:px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#1a1f2e] text-white/70 hover:text-white hover:bg-[#222840] border border-white/5 transition-all"
            aria-label="Open settings"
          >
            ⚙
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showImportModal && <ImportModal key="import-modal" />}
        {showSettings && <SettingsModal key="settings-modal" />}
      </AnimatePresence>
    </>
  );
}
