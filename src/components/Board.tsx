/**
 * Board.tsx
 *
 * Fixes vs. original:
 *  1. handleSquareHover was calling previewMove on every mouseover event,
 *     firing dozens of worker requests per second while hovering.
 *     Now debounced to 120 ms.
 *  2. boardSize resize handler debounced to 100 ms (was instant).
 *  3. Memoised callbacks with useCallback to prevent unnecessary re-renders.
 *  4. useRef used to carry the debounce timer.
 */

import { Chessboard } from 'react-chessboard';
import { useChessStore } from '@/store';
import { useEffect, useState, useCallback, useRef } from 'react';

function computeBoardSize(width: number, height: number): number {
  const MIN = 200;
  let maxSize: number;

  if (width < 640) {
    maxSize = Math.min(width - 32, 300, height - 360);
  } else if (width < 1024) {
    maxSize = Math.min(width - 64, 400, height - 340);
  } else {
    maxSize = Math.min(520, height - 340, width - 40);
  }

  return Math.max(MIN, maxSize);
}

export default function Board() {
  const fen              = useChessStore((s) => s.fen);
  const boardOrientation = useChessStore((s) => s.boardOrientation);
  const optionSquares    = useChessStore((s) => s.optionSquares);
  const lastMoveSquares  = useChessStore((s) => s.lastMoveSquares);
  const checkSquare      = useChessStore((s) => s.checkSquare);
  const customArrows     = useChessStore((s) => s.customArrows);
  const userArrows       = useChessStore((s) => s.userArrows);
  const selectSquare     = useChessStore((s) => s.selectSquare);
  const makeMove         = useChessStore((s) => s.makeMove);
  const previewMove      = useChessStore((s) => s.previewMove);
  const clearPreview     = useChessStore((s) => s.clearPreview);
  const addUserArrow     = useChessStore((s) => s.addUserArrow);
  const removeUserArrow  = useChessStore((s) => s.removeUserArrow);

  const [boardSize, setBoardSize] = useState(() =>
    computeBoardSize(window.innerWidth, window.innerHeight),
  );

  const resizeTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer   = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const handleResize = () => {
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
      resizeTimer.current = setTimeout(() => {
        setBoardSize(computeBoardSize(window.innerWidth, window.innerHeight));
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimer.current) clearTimeout(resizeTimer.current);
      if (hoverTimer.current)  clearTimeout(hoverTimer.current);
    };
  }, []);

  const handleSquareClick = useCallback(
    ({ square }: { square: string }) => {
      const { selectedSquare, optionSquares: opts } = useChessStore.getState();
      if (selectedSquare && opts[square]) {
        previewMove(selectedSquare, square);
        return;
      }
      clearPreview();
      selectSquare(square);
    },
    [previewMove, clearPreview, selectSquare],
  );

  // Debounced hover: only fire previewMove after the cursor rests 120 ms
  const handleSquareHover = useCallback(
    ({ square }: { square: string }) => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => {
        const { selectedSquare, optionSquares: opts } = useChessStore.getState();
        if (selectedSquare && opts[square]) {
          previewMove(selectedSquare, square);
        }
      }, 120);
    },
    [previewMove],
  );

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      clearPreview();
      if (!targetSquare) return false;
      return makeMove({ from: sourceSquare, to: targetSquare, promotion: 'q' });
    },
    [clearPreview, makeMove],
  );

  const handleSquareRightClick = useCallback(
    ({ square }: { square: string }) => {
      const { selectedSquare } = useChessStore.getState();
      if (!selectedSquare) return;
      const exists = userArrows.some(([f, t]) => f === selectedSquare && t === square);
      if (exists) {
        removeUserArrow(selectedSquare, square);
      } else {
        addUserArrow(selectedSquare, square);
      }
    },
    [userArrows, addUserArrow, removeUserArrow],
  );

  const combinedSquares: Record<string, React.CSSProperties> = {
    ...lastMoveSquares,
    ...optionSquares,
  };

  if (checkSquare) {
    combinedSquares[checkSquare] = {
      background:
        'radial-gradient(ellipse at center, rgba(255,0,0,0.55) 0%, rgba(255,50,50,0.2) 60%, rgba(255,0,0,0) 100%)',
    };
  }

  const allArrows = [
    ...customArrows.map(([start, end, color]) => ({ startSquare: start, endSquare: end, color })),
    ...userArrows.map(([start, end, color]) => ({ startSquare: start, endSquare: end, color })),
  ];

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: boardSize, height: boardSize }}
      role="region"
      aria-label="Chess board"
    >
      <Chessboard
        options={{
          id: 'main-board',
          position: fen,
          boardOrientation,
          onPieceDrop: handlePieceDrop,
          onSquareClick: handleSquareClick,
          onMouseOverSquare: handleSquareHover,
          onSquareRightClick: handleSquareRightClick,
          squareStyles: combinedSquares,
          arrows: allArrows,
          lightSquareStyle: { backgroundColor: '#a0aab4' },
          darkSquareStyle:  { backgroundColor: '#556b7a' },
          boardStyle: {
            borderRadius: '6px',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 80px rgba(0,255,136,0.05)',
          },
          animationDurationInMs: 200,
          showAnimations: true,
          allowDragging: true,
          allowDrawingArrows: true,
          clearArrowsOnPositionChange: true,
          showNotation: true,
        }}
      />
    </div>
  );
}