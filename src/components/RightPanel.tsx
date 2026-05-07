/**
 * RightPanel.tsx — Engine analysis panel with Quick Move Input for chess.com workflow
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useChessStore } from '@/store';

export function EvalBar({
  evaluation,
  isMate,
  mateIn,
}: {
  evaluation: number;
  isMate: boolean;
  mateIn: number | null;
}) {
  const sigmoid = (x: number) => 1 / (1 + Math.exp(-x * 0.003));
  let whitePct = sigmoid(evaluation) * 100;

  if (isMate && mateIn !== null) {
    whitePct = mateIn > 0 ? 98 : 2;
  }

  const evalText =
    isMate && mateIn !== null
      ? `M${Math.abs(mateIn)}`
      : `${evaluation >= 0 ? '+' : ''}${(evaluation / 100).toFixed(1)}`;

  return (
    <div
      className="glass-panel rounded-xl p-2 flex flex-col items-center gap-1"
      style={{ width: 56 }}
      role="meter"
      aria-label={`Evaluation: ${evalText}`}
      aria-valuenow={whitePct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <span
        className="text-[10px] font-bold"
        style={{ color: evaluation >= 0 ? '#e8e8e8' : '#aaa' }}
      >
        {evalText}
      </span>

      <div
        className="w-6 flex-1 rounded-full overflow-hidden relative bg-[#333]"
        style={{ minHeight: 160 }}
      >
        <motion.div
          className="absolute bottom-0 w-full rounded-full bg-[#e8e8e8]"
          animate={{ height: `${whitePct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="text-[9px] font-bold whitespace-nowrap"
            style={{
              color: whitePct > 50 ? '#111' : '#ddd',
              textShadow: '0 1px 2px rgba(0,0,0,0.5)',
            }}
          >
            {evalText}
          </span>
        </div>
      </div>
    </div>
  );
}

export default function RightPanel() {
  const engineAnalysis = useChessStore((s) => s.engineAnalysis);
  const isAnalyzing    = useChessStore((s) => s.isAnalyzing);
  const settings       = useChessStore((s) => s.settings);
  const setEngineDepth = useChessStore((s) => s.setEngineDepth);
  const gameStatus     = useChessStore((s) => s.gameStatus);
  const previewAnalysis = useChessStore((s) => s.previewAnalysis);
  const userSide       = useChessStore((s) => s.userSide);
  const turn           = useChessStore((s) => s.turn);
  const makeMove       = useChessStore((s) => s.makeMove);

  const [moveText, setMoveText] = useState('');
  const [moveError, setMoveError] = useState('');

  const eval_  = engineAnalysis?.evaluation ?? 0;
  const isMate = engineAnalysis?.isMate     ?? false;
  const mateIn = engineAnalysis?.mateIn     ?? null;
  const previewEval = previewAnalysis?.evaluation ?? null;

  const handleQuickMove = () => {
    const trimmed = moveText.trim();
    if (!trimmed) return;
    setMoveError('');
    const success = makeMove(trimmed);
    if (success) {
      setMoveText('');
    } else {
      setMoveError(`"${trimmed}" is not a legal move`);
      setTimeout(() => setMoveError(''), 2000);
    }
  };

  return (
    <div className="flex flex-col gap-3" style={{ width: 260 }}>

      {/* ── Quick Move Input (for chess.com workflow) ──────────────────── */}
      <div className="glass-panel rounded-xl p-3">
        <label htmlFor="quick-move" className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1.5 block">
          ⚡ Quick Move Input
        </label>
        <div className="flex gap-1.5">
          <input
            id="quick-move"
            type="text"
            value={moveText}
            onChange={(e) => { setMoveText(e.target.value); setMoveError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleQuickMove(); }}
            placeholder="e4, Nf3, O-O..."
            className="flex-1 bg-[#0a0c14] border border-[#2a3040] rounded-lg px-3 py-1.5 text-sm text-white font-mono placeholder:text-white/20 focus:outline-none focus:border-[#00ff88]/50 transition-colors"
            autoComplete="off"
            spellCheck={false}
          />
          <button
            onClick={handleQuickMove}
            className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            style={{ background: 'linear-gradient(145deg, #00ff88, #00cc6a)', color: '#07070d' }}
          >
            ↵
          </button>
        </div>
        {moveError && (
          <p className="text-[10px] text-red-400 mt-1" role="alert">{moveError}</p>
        )}
      </div>

      {/* ── BEST MOVE Hero Display ────────────────────────────────────── */}
      <div className="glass-panel rounded-xl p-3">
        <div className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">
          {isAnalyzing ? '🔍 Calculating...' : '🎯 Play This Move'}
        </div>

        {engineAnalysis?.bestMove ? (
          <div className="flex items-center gap-3">
            <div
              className="px-4 py-2.5 rounded-xl text-2xl font-black font-mono tracking-tight"
              style={{
                background: 'linear-gradient(145deg, #00ff88, #00cc6a)',
                color: '#07070d',
                boxShadow: '0 0 20px rgba(0,255,136,0.3)',
                minWidth: 80,
                textAlign: 'center',
              }}
            >
              {engineAnalysis.bestMove}
            </div>
            <div className="flex flex-col gap-0.5">
              <span
                className="text-lg font-bold"
                style={{ color: eval_ >= 0 ? '#00ff88' : '#ef4444' }}
              >
                {isMate && mateIn !== null
                  ? `${mateIn > 0 ? '+' : '-'}M${Math.abs(mateIn)}`
                  : `${eval_ >= 0 ? '+' : ''}${(eval_ / 100).toFixed(2)}`}
              </span>
              <span className="text-[10px] text-white/40">
                d{engineAnalysis.depth} · {engineAnalysis.nodes.toLocaleString()}n
              </span>
            </div>
          </div>
        ) : (
          <div className="text-sm text-white/30 italic">
            {isAnalyzing ? 'Thinking...' : 'Make a move to start'}
          </div>
        )}
      </div>

      {/* ── Engine Header ─────────────────────────────────────────────── */}
      <div className="glass-panel rounded-xl p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isAnalyzing ? 'bg-[#00ff88] thinking-indicator' : 'bg-gray-500'
              }`}
            />
            <span className="text-xs font-semibold text-white/70 uppercase tracking-wider">
              Engine
            </span>
          </div>
          <select
            value={settings.engineDepth}
            onChange={(e) => setEngineDepth(Number(e.target.value))}
            className="bg-[#0d0f18] border border-[#2a3040] rounded px-2 py-0.5 text-xs text-white/70 focus:outline-none focus:border-[#00ff88]/30"
            aria-label="Engine search depth"
          >
            <option value={1}>Depth 1</option>
            <option value={2}>Depth 2</option>
            <option value={4}>Depth 4</option>
            <option value={6}>Depth 6</option>
            <option value={8}>Depth 8 (Pro)</option>
            <option value={10}>Depth 10 (Master)</option>
            <option value={12}>Depth 12 (Max)</option>
          </select>
        </div>

        {/* Assistant Status */}
        <div className={`rounded-lg px-3 py-2 mb-2 transition-colors ${
          (userSide !== 'none' && turn === userSide) 
            ? 'bg-[#00ff88]/10 border border-[#00ff88]/20' 
            : 'bg-[#0a0c14] border border-white/5'
        }`}>
          <p className={`text-xs font-medium ${
            (userSide !== 'none' && turn === userSide) ? 'text-[#00ff88]' : 'text-white/80'
          }`} role="status" aria-live="polite">
            {userSide === 'none' 
              ? gameStatus 
              : turn === userSide 
                ? '🎯 Your turn: Best move above!' 
                : '⏳ Type opponent move above...'}
          </p>
        </div>

        {/* Evaluation Display */}
        <div className="bg-[#0a0c14] rounded-lg px-3 py-2 mb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-white/50">Eval</span>
            <span
              className="text-lg font-bold neon-text"
              style={{ color: eval_ >= 0 ? '#00ff88' : '#ef4444' }}
            >
              {isMate && mateIn !== null
                ? `${mateIn > 0 ? '+' : '-'}M${Math.abs(mateIn)}`
                : `${eval_ >= 0 ? '+' : ''}${(eval_ / 100).toFixed(2)}`}
            </span>
          </div>
          {previewEval !== null && (
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
              <span className="text-[10px] text-white/30">Preview</span>
              <span
                className="text-sm font-bold"
                style={{ color: previewEval >= 0 ? '#00ff88' : '#ef4444' }}
              >
                {previewEval >= 0 ? '+' : ''}
                {(previewEval / 100).toFixed(2)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Top Moves */}
      {engineAnalysis && engineAnalysis.topMoves.length > 0 && (
        <div className="glass-panel rounded-xl p-3">
          <h3 className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-2">
            Top Moves
          </h3>
          <div className="space-y-1.5">
            {engineAnalysis.topMoves.map((m, i) => (
              <div
                key={m.san}
                className="flex items-center justify-between bg-[#0a0c14] rounded-lg px-3 py-1.5"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-4 h-4 rounded flex items-center justify-center text-[9px] font-bold ${
                      i === 0
                        ? 'bg-[#00ff88] text-black'
                        : i === 1
                        ? 'bg-[#fbbf24] text-black'
                        : 'bg-[#3b82f6]/30 text-[#3b82f6]'
                    }`}
                  >
                    {i + 1}
                  </span>
                  <span
                    className={`text-sm font-mono font-semibold ${
                      i === 0 ? 'text-[#00ff88]' : 'text-white/70'
                    }`}
                  >
                    {m.san}
                  </span>
                </div>
                <span
                  className={`text-xs font-mono ${
                    m.evaluation >= 0 ? 'text-white/60' : 'text-red-400/60'
                  }`}
                >
                  {m.evaluation >= 0 ? '+' : ''}
                  {(m.evaluation / 100).toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
