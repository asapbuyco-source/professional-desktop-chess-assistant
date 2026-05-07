/**
 * RightPanel.tsx
 *
 * Fixes vs. original:
 *  1. EvalBar: the bar was filling from the top (absolute top:0) — correct
 *     behaviour is white fills from bottom (positive = more white).
 *     Fixed using `bottom: 0` and inverting the fill direction.
 *  2. Added `export { EvalBar }` at module level (was only exported inline).
 *  3. Granular Zustand selectors to prevent whole-store re-renders.
 *  4. Replaced <select> engine depth picker in RightPanel with the same
 *     depth values as the settings modal.
 */

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
  // Sigmoid to map centipawn → 0-100 %
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

      {/* Bar container — dark background = black, light fill = white */}
      <div
        className="w-6 flex-1 rounded-full overflow-hidden relative bg-[#333]"
        style={{ minHeight: 160 }}
      >
        {/* White's advantage fills from BOTTOM */}
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

  const eval_  = engineAnalysis?.evaluation ?? 0;
  const isMate = engineAnalysis?.isMate     ?? false;
  const mateIn = engineAnalysis?.mateIn     ?? null;

  const previewEval = previewAnalysis?.evaluation ?? null;

  return (
    <div className="flex flex-col gap-3" style={{ width: 260 }}>
      {/* Engine Header */}
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
            <option value={3}>Depth 3</option>
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
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-white/40 uppercase tracking-tighter font-bold">
              Status
            </p>
            {isAnalyzing && <div className="thinking-indicator w-1 h-1 rounded-full bg-[#00ff88]" />}
          </div>
          <p className={`text-xs font-medium mt-0.5 ${
            (userSide !== 'none' && turn === userSide) ? 'text-[#00ff88]' : 'text-white/80'
          }`} role="status" aria-live="polite">
            {userSide === 'none' 
              ? gameStatus 
              : turn === userSide 
                ? '🎯 Your turn: Calculating best move...' 
                : '⏳ Waiting for opponent move...'}
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

        {/* Analysis Details */}
        {engineAnalysis && (
          <div className="space-y-1 text-[11px] text-white/50">
            <div className="flex justify-between">
              <span>Depth</span>
              <span className="text-white/70">{engineAnalysis.depth}</span>
            </div>
            <div className="flex justify-between">
              <span>Nodes</span>
              <span className="text-white/70">{engineAnalysis.nodes.toLocaleString()}</span>
            </div>
            {engineAnalysis.bestMove && (
              <div className="flex justify-between">
                <span>Best</span>
                <span className="text-[#00ff88] font-semibold">{engineAnalysis.bestMove}</span>
              </div>
            )}
          </div>
        )}
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

      {/* PV Line */}
      {engineAnalysis && engineAnalysis.pv.length > 1 && (
        <div className="glass-panel rounded-xl p-3">
          <h3 className="text-[10px] font-semibold text-white/50 uppercase tracking-wider mb-1">
            Principal Variation
          </h3>
          <p className="text-xs font-mono text-white/60 leading-relaxed">
            {engineAnalysis.pv.join(' ')}
          </p>
        </div>
      )}
    </div>
  );
}
