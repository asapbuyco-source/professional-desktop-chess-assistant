/**
 * Board.tsx — production hardened
 *
 * Fixes:
 *  1. "Pieces don't move" bug: Corrected Chessboard options and memoised them.
 *     Added logs to verify move success.
 *  2. Search speed: optimized engine.ts (TT + no mobility).
 *  3. boardStyle, lightSquareStyle, darkSquareStyle memoised.
 */

import { Chessboard } from 'react-chessboard';
import { useChessStore } from '@/store';
import { useEffect, useState, useCallback, useRef, useMemo } from 'react';

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

const LIGHT_SQUARE_STYLE = { backgroundColor: '#a0aab4' };
const DARK_SQUARE_STYLE  = { backgroundColor: '#556b7a' };
const BOARD_STYLE = {
  borderRadius: '6px',
  boxShadow: '0 8px 40px rgba(0,0,0,0.6), 0 0 80px rgba(0,255,136,0.05)',
};
const CHECK_STYLE = {
  background: 'radial-gradient(ellipse at center, rgba(255,0,0,0.55) 0%, rgba(255,50,50,0.2) 60%, rgba(255,0,0,0) 100%)',
};

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

  const resizeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      console.log('Board: handleSquareClick', square);
      clearPreview();
      selectSquare(square);
    },
    [clearPreview, selectSquare],
  );

  const handleSquareHover = useCallback(
    ({ square }: { square: string }) => {
      if (hoverTimer.current) clearTimeout(hoverTimer.current);
      hoverTimer.current = setTimeout(() => {
        const { selectedSquare, optionSquares: opts } = useChessStore.getState();
        if (selectedSquare && opts[square]) {
          console.log('Board: handleSquareHover preview', square);
          previewMove(selectedSquare, square);
        }
      }, 150);
    },
    [previewMove],
  );

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      console.log('Board: handlePieceDrop', sourceSquare, '->', targetSquare);
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

  const combinedSquares = useMemo(() => {
    const combined: Record<string, React.CSSProperties> = {
      ...lastMoveSquares,
      ...optionSquares,
    };
    if (checkSquare) {
      combined[checkSquare] = CHECK_STYLE;
    }
    return combined;
  }, [lastMoveSquares, optionSquares, checkSquare]);

  const allArrows = useMemo(() => [
    ...customArrows.map(([start, end, color]) => ({ startSquare: start, endSquare: end, color })),
    ...userArrows.map(([start,  end, color]) => ({ startSquare: start, endSquare: end, color })),
  ], [customArrows, userArrows]);

  const chessboardOptions = useMemo(() => ({
    id: 'main-board',
    position: fen,
    boardOrientation,
    onPieceDrop: handlePieceDrop,
    onSquareClick: handleSquareClick,
    onMouseOverSquare: handleSquareHover,
    onSquareRightClick: handleSquareRightClick,
    squareStyles: combinedSquares,
    arrows: allArrows,
    lightSquareStyle: LIGHT_SQUARE_STYLE,
    darkSquareStyle:  DARK_SQUARE_STYLE,
    boardStyle: BOARD_STYLE,
    animationDurationInMs: 150,
    showAnimations: true,
    allowDragging: true,
    allowDrawingArrows: true,
    clearArrowsOnPositionChange: true,
    showNotation: true,
  }), [
    fen, boardOrientation, handlePieceDrop, handleSquareClick,
    handleSquareHover, handleSquareRightClick, combinedSquares, allArrows
  ]);

  return (
    <div
      className="relative flex-shrink-0"
      style={{ width: boardSize, height: boardSize }}
      role="region"
      aria-label="Chess board"
    >
      <Chessboard options={chessboardOptions} />
    </div>
  );
}