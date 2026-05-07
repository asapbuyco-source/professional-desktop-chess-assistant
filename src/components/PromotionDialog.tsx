import { useChessStore } from '@/store';
import type { PieceType } from '@/types';

const PROMOTION_PIECES: PieceType[] = ['Q', 'R', 'B', 'N'];

const PIECE_SYMBOLS: Partial<Record<PieceType, string>> = {
  Q: '\u2655',
  R: '\u2656',
  B: '\u2657',
  N: '\u2658',
};

export default function PromotionDialog() {
  const { pendingPromotion, makeMove, clearPendingPromotion } = useChessStore();

  if (!pendingPromotion) return null;

  const handleSelect = (piece: PieceType) => {
    makeMove({ from: pendingPromotion.from, to: pendingPromotion.to, promotion: piece.toLowerCase() });
    clearPendingPromotion();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Promotion selection"
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={clearPendingPromotion} />
      <div className="relative glass-panel-light p-4 rounded-lg flex flex-col gap-2">
        <p className="text-xs text-white/50 text-center mb-1">Promote to</p>
        <div className="flex gap-2">
          {PROMOTION_PIECES.map((piece) => (
            <button
              key={piece}
              onClick={() => handleSelect(piece)}
              className="w-12 h-12 rounded-md bg-white/10 hover:bg-white/20 transition-colors text-3xl flex items-center justify-center"
              aria-label={`Promote to ${piece}`}
            >
              {PIECE_SYMBOLS[piece]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}