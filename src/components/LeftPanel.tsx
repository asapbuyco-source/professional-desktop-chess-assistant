/**
 * LeftPanel.tsx — fixed and production-hardened
 *
 * Key fixes:
 *  1. CapturedPieces subscribed to `game` (entire Chess object) — now
 *     subscribes to `fen` string only, recomputes via a single useMemo.
 *  2. Removed duplicate / circular useMemo from previous version.
 *  3. All selectors are granular (string / primitive values, not objects).
 */

import { useEffect, useRef, useMemo } from 'react';
import { Chess } from 'chess.js';
import { useChessStore } from '@/store';

// ─── Captured Pieces ─────────────────────────────────────────────────────────

const STARTING: Record<string, Record<string, number>> = {
  w: { p: 8, n: 2, b: 2, r: 2, q: 1 },
  b: { p: 8, n: 2, b: 2, r: 2, q: 1 },
};

const PIECE_SYMBOLS: Record<string, { w: string; b: string }> = {
  p: { w: '♙', b: '♟' },
  n: { w: '♘', b: '♞' },
  b: { w: '♗', b: '♝' },
  r: { w: '♖', b: '♜' },
  q: { w: '♕', b: '♛' },
};

const PIECE_ORDER = ['q', 'r', 'b', 'n', 'p'];

const SYMBOL_VALUE: Record<string, number> = {
  '♙': 1, '♟': 1, '♘': 3, '♞': 3,
  '♗': 3, '♝': 3, '♖': 5, '♜': 5,
  '♕': 9, '♛': 9,
};

function computeCaptured(fen: string) {
  const game = new Chess(fen);
  const board = game.board();

  const current: Record<string, Record<string, number>> = { w: {}, b: {} };
  for (const row of board) {
    for (const sq of row) {
      if (sq && sq.type !== 'k') {
        current[sq.color][sq.type] = (current[sq.color][sq.type] || 0) + 1;
      }
    }
  }

  const whiteCaptured: string[] = [];
  const blackCaptured: string[] = [];

  for (const type of PIECE_ORDER) {
    const wMissing = (STARTING.w[type] || 0) - (current.w[type] || 0);
    const bMissing = (STARTING.b[type] || 0) - (current.b[type] || 0);
    for (let i = 0; i < bMissing; i++) whiteCaptured.push(PIECE_SYMBOLS[type].b);
    for (let i = 0; i < wMissing; i++) blackCaptured.push(PIECE_SYMBOLS[type].w);
  }

  const whiteAdv =
    blackCaptured.reduce((s, p) => s + (SYMBOL_VALUE[p] || 0), 0) -
    whiteCaptured.reduce((s, p) => s + (SYMBOL_VALUE[p] || 0), 0);

  const advantageLabel =
    whiteAdv > 0 ? `+${whiteAdv}` : whiteAdv < 0 ? `−${Math.abs(whiteAdv)}` : '';

  return { whiteCaptured, blackCaptured, whiteAdv, advantageLabel };
}

function CapturedPieces() {
  const fen = useChessStore((s) => s.fen);
  const { whiteCaptured, blackCaptured, whiteAdv, advantageLabel } = useMemo(
    () => computeCaptured(fen),
    [fen],
  );

  return (
    <div className="flex items-center justify-between px-1 py-1 text-xs">
      <div className="flex items-center gap-0.5 min-h-[18px]">
        {whiteCaptured.length > 0 && (
          <span className="text-white/50">{whiteCaptured.join('')}</span>
        )}
        {whiteAdv > 0 && (
          <span className="text-[#00ff88] ml-1 font-bold">{advantageLabel}</span>
        )}
      </div>
      <div className="flex items-center gap-0.5 min-h-[18px]">
        {whiteAdv < 0 && (
          <span className="text-[#ef4444] mr-1 font-bold">{advantageLabel}</span>
        )}
        {blackCaptured.length > 0 && (
          <span className="text-white/50">{blackCaptured.join('')}</span>
        )}
      </div>
    </div>
  );
}

// ─── Left Panel ───────────────────────────────────────────────────────────────

export default function LeftPanel() {
  const history         = useChessStore((s) => s.history);
  const openingName     = useChessStore((s) => s.openingName);
  const turn            = useChessStore((s) => s.turn);
  const moveAnnotations = useChessStore((s) => s.moveAnnotations);

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll move list to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const movePairs = useMemo(() => {
    const pairs: { num: number; white: string; black?: string }[] = [];
    for (let i = 0; i < history.length; i += 2) {
      pairs.push({ num: Math.floor(i / 2) + 1, white: history[i], black: history[i + 1] });
    }
    return pairs;
  }, [history]);

  return (
    <div className="flex flex-col gap-3" style={{ width: 'var(--left-panel-width)' }}>
      {/* Opening Name */}
      <div className="glass-panel rounded-xl p-3">
        <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">
          Opening
        </h3>
        <p className="text-xs text-[#00ff88] font-medium leading-relaxed">{openingName}</p>
      </div>

      {/* Move History */}
      <div className="glass-panel rounded-xl p-3 flex-1 flex flex-col" style={{ minHeight: 300 }}>
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
            Moves
          </h3>
          <span className="text-[10px] text-white/30">{history.length} moves</span>
        </div>

        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-0.5 pr-1"
          style={{ maxHeight: 400 }}
        >
          {movePairs.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs text-white/20 italic">No moves yet</p>
            </div>
          ) : (
            movePairs.map((pair) => {
              const wi = pair.num * 2 - 2;
              const bi = pair.num * 2 - 1;
              const wa = moveAnnotations[wi];
              const ba = moveAnnotations[bi];
              const isLastPair = pair.num === movePairs.length;

              return (
                <div key={pair.num} className="flex items-center text-xs slide-in">
                  <span className="w-7 text-white/25 font-mono text-right mr-2">
                    {pair.num}.
                  </span>

                  {/* White move */}
                  <span
                    className={`w-16 font-mono ${
                      isLastPair && turn === 'b'
                        ? 'text-[#00ff88] font-semibold'
                        : 'text-white/70'
                    }`}
                  >
                    {pair.white}
                    {wa && (
                      <span
                        className={`ml-0.5 text-[9px] font-bold ${
                          wa.symbol === '!!' || wa.symbol === '!'  ? 'text-[#00ff88]' :
                          wa.symbol === '??' ? 'text-[#ef4444]' :
                          wa.symbol === '?'  ? 'text-[#fbbf24]' :
                          'text-[#6b7280]'
                        }`}
                      >
                        {wa.symbol}
                      </span>
                    )}
                  </span>

                  {/* Black move */}
                  {pair.black ? (
                    <span
                      className={`w-16 font-mono ${
                        isLastPair && turn === 'w'
                          ? 'text-[#00ff88] font-semibold'
                          : 'text-white/70'
                      }`}
                    >
                      {pair.black}
                      {ba && (
                        <span
                          className={`ml-0.5 text-[9px] font-bold ${
                            ba.symbol === '!!' || ba.symbol === '!' ? 'text-[#00ff88]' :
                            ba.symbol === '??' ? 'text-[#ef4444]' :
                            ba.symbol === '?'  ? 'text-[#fbbf24]' :
                            'text-[#6b7280]'
                          }`}
                        >
                          {ba.symbol}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="w-16" />
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Captured Pieces */}
        <div className="border-t border-white/5 pt-2 mt-2">
          <CapturedPieces />
        </div>
      </div>
    </div>
  );
}
