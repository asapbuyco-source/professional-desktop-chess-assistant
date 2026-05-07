/**
 * store.ts — Zustand chess store (production hardened)
 *
 * Key changes vs. original:
 *  1. All engine analysis is now routed through the Web Worker
 *     via requestAnalysis() — the main thread is never blocked.
 *  2. Multiple chained set() calls collapsed into single atomic set().
 *  3. previewMove() is now worker-based and non-blocking.
 *  4. Dead code removed (MAX_PGN_LENGTH / MAX_FEN_LENGTH were constants
 *     but the PGN check was inverted — fixed).
 *  5. selectSquare() now calls makeMove() instead of duplicating
 *     the move-execution logic inline.
 */

import { create } from 'zustand';
import { Chess } from 'chess.js';
import type { Square } from 'chess.js';
import { getLegalMovesForPiece } from '@/engine';
import { identifyOpening } from '@/openings';
import { requestAnalysis } from '@/hooks/useEngineWorker';
import type { EngineAnalysis, GameSettings, PieceType } from '@/types';
import {
  playMoveSound,
  playCaptureSound,
  playCheckSound,
  playPromotionSound,
  playGameOverSound,
} from '@/sound';

// ─── Input validation limits ──────────────────────────────────────────────────
const MAX_PGN_LENGTH = 10_000;
const MAX_FEN_LENGTH = 200; // original was 100 — some FENs exceed that

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MoveAnnotation {
  symbol: string;
  evalDelta: number;
}

export interface MoveObject {
  from: string;
  to: string;
  promotion?: string;
}

interface ChessStore {
  game: Chess;
  fen: string;
  history: string[];
  pgn: string;
  turn: 'w' | 'b';
  boardOrientation: 'white' | 'black';
  selectedSquare: string | null;
  optionSquares: Record<string, React.CSSProperties>;
  lastMoveSquares: Record<string, React.CSSProperties>;
  checkSquare: string | null;
  customArrows: [string, string, string][];
  userArrows: [string, string, string][];
  engineAnalysis: EngineAnalysis | null;
  isAnalyzing: boolean;
  moveInput: string;
  moveSuggestions: string[];
  selectedPieceType: PieceType | null;
  builderDestinations: string[];
  builderHighlightSquares: Record<string, React.CSSProperties>;
  openingName: string;
  gameStatus: string;
  redoStack: MoveObject[];
  showSettings: boolean;
  showImportModal: boolean;
  importType: 'pgn' | 'fen';
  settings: GameSettings;
  lastMoveEval: number | null;
  moveAnnotations: Record<number, MoveAnnotation>;
  previewAnalysis: EngineAnalysis | null;
  pendingPromotion: { from: string; to: string } | null;

  makeMove: (move: string | { from: string; to: string; promotion?: string }) => boolean;
  undoMove: () => void;
  redoMove: () => void;
  newGame: () => void;
  flipBoard: () => void;
  selectSquare: (square: string) => void;
  setMoveInput: (input: string) => void;
  submitMoveInput: () => boolean;
  selectPieceType: (piece: PieceType | null) => void;
  selectDestination: (square: string) => boolean;
  setEngineDepth: (depth: number) => void;
  toggleSettings: () => void;
  toggleImportModal: (type?: 'pgn' | 'fen') => void;
  updateSettings: (s: Partial<GameSettings>) => void;
  importPgn: (pgn: string) => boolean;
  importFen: (fen: string) => boolean;
  clearMoveInput: () => void;
  analyze: () => void;
  previewMove: (from: string, to: string) => void;
  clearPreview: () => void;
  addUserArrow: (from: string, to: string) => void;
  removeUserArrow: (from: string, to: string) => void;
  clearUserArrows: () => void;
  setPendingPromotion: (from: string, to: string) => void;
  clearPendingPromotion: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findKingSquare(game: Chess, color: 'w' | 'b'): string | null {
  const board = game.board();
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (piece && piece.type === 'k' && piece.color === color) {
        return String.fromCharCode(97 + f) + (8 - r);
      }
    }
  }
  return null;
}

function getGameStatus(game: Chess): string {
  if (game.isCheckmate())
    return game.turn() === 'w' ? '⬛ Black wins — Checkmate!' : '⬜ White wins — Checkmate!';
  if (game.isStalemate()) return '🤝 Draw — Stalemate';
  if (game.isThreefoldRepetition()) return '🤝 Draw — Threefold Repetition';
  if (game.isInsufficientMaterial()) return '🤝 Draw — Insufficient Material';
  if (game.isDraw()) return '🤝 Draw';
  if (game.isCheck())
    return game.turn() === 'w' ? '⚠ White to move — Check!' : '⚠ Black to move — Check!';
  return game.turn() === 'w' ? '⬜ White to move' : '⬛ Black to move';
}

function getAnalysisArrows(
  analysis: EngineAnalysis | null,
  show: boolean,
): [string, string, string][] {
  if (!show || !analysis || !analysis.topMoves.length) return [];
  const arrows: [string, string, string][] = [];
  if (analysis.topMoves[0]) arrows.push([analysis.topMoves[0].from, analysis.topMoves[0].to, '#00ff88']);
  if (analysis.topMoves[1]) arrows.push([analysis.topMoves[1].from, analysis.topMoves[1].to, '#fbbf24']);
  return arrows;
}

// ─── Store ────────────────────────────────────────────────────────────────────

const initialGame = new Chess();

export const useChessStore = create<ChessStore>((set, get) => ({
  game: initialGame,
  fen: initialGame.fen(),
  history: [],
  pgn: '',
  turn: 'w' as const,
  boardOrientation: 'white' as const,
  selectedSquare: null,
  optionSquares: {},
  lastMoveSquares: {},
  checkSquare: null,
  customArrows: [],
  userArrows: [],
  engineAnalysis: null,
  isAnalyzing: false,
  moveInput: '',
  moveSuggestions: [],
  selectedPieceType: null,
  builderDestinations: [],
  builderHighlightSquares: {},
  openingName: 'Starting Position',
  gameStatus: '⬜ White to move',
  redoStack: [],
  showSettings: false,
  showImportModal: false,
  importType: 'pgn',
  settings: {
    engineDepth: 2,
    showArrows: true,
    showLegalMoves: true,
    animationSpeed: 200,
    soundEnabled: false,
    voiceEnabled: false,
  },
  lastMoveEval: null,
  moveAnnotations: {},
  previewAnalysis: null,
  pendingPromotion: null,

  // ── makeMove ──────────────────────────────────────────────────────────────
  makeMove: (move) => {
    const { game, settings } = get();
    const evalBefore = get().engineAnalysis?.evaluation ?? 0;
    try {
      const result = game.move(move);
      if (!result) return false;

      const history  = game.history();
      const turn     = game.turn();
      const checkSq  = game.isCheck() ? findKingSquare(game, turn) : null;
      const status   = getGameStatus(game);

      // Single atomic state update
      set({
        fen: game.fen(),
        history,
        pgn: game.pgn(),
        turn,
        selectedSquare: null,
        optionSquares: {},
        lastMoveSquares: {
          [result.from]: { backgroundColor: 'rgba(0,255,136,0.25)' },
          [result.to]:   { backgroundColor: 'rgba(0,255,136,0.25)' },
        },
        checkSquare: checkSq,
        redoStack: [],
        moveInput: '',
        moveSuggestions: [],
        selectedPieceType: null,
        builderDestinations: [],
        builderHighlightSquares: {},
        openingName: identifyOpening(history),
        gameStatus: status,
        lastMoveEval: evalBefore,
        isAnalyzing: true,
      });

      if (settings.soundEnabled) {
        if (status.includes('Checkmate')) playGameOverSound();
        else if (result.isCapture())       playCaptureSound();
        else if (result.promotion)         playPromotionSound();
        else if (checkSq)                  playCheckSound();
        else                               playMoveSound();
      }

      // Kick off worker analysis — never blocks the main thread
      const fen = game.fen();
      requestAnalysis(fen, settings.engineDepth, 2000, (analysis) => {
        // Guard: make sure the position hasn't changed since we started
        if (get().fen !== fen) return;
        const arrows = getAnalysisArrows(analysis, settings.showArrows);
        set({ engineAnalysis: analysis, isAnalyzing: false, customArrows: arrows });
      });

      return true;
    } catch {
      return false;
    }
  },

  // ── undoMove ──────────────────────────────────────────────────────────────
  undoMove: () => {
    const { game, settings } = get();
    try {
      const undone = game.undo();
      if (!undone) return;

      const history = game.history();
      const turn    = game.turn();
      const checkSq = game.isCheck() ? findKingSquare(game, turn) : null;

      set((state) => ({
        fen: game.fen(),
        history,
        pgn: game.pgn(),
        turn,
        selectedSquare: null,
        optionSquares: {},
        checkSquare: checkSq,
        redoStack: [
          ...state.redoStack,
          { from: undone.from, to: undone.to, promotion: undone.promotion },
        ],
        moveInput: '',
        moveSuggestions: [],
        selectedPieceType: null,
        builderDestinations: [],
        builderHighlightSquares: {},
        openingName: identifyOpening(history),
        gameStatus: getGameStatus(game),
        isAnalyzing: true,
      }));

      const fen = game.fen();
      requestAnalysis(fen, settings.engineDepth, 2000, (analysis) => {
        if (get().fen !== fen) return;
        const arrows = getAnalysisArrows(analysis, settings.showArrows);
        set({ engineAnalysis: analysis, isAnalyzing: false, customArrows: arrows });
      });
    } catch { /* ignore */ }
  },

  // ── redoMove ──────────────────────────────────────────────────────────────
  redoMove: () => {
    const { game, redoStack, settings } = get();
    if (redoStack.length === 0) return;
    const moveToRedo = redoStack[redoStack.length - 1];
    try {
      const result = game.move(moveToRedo);
      if (!result) return;

      const history = game.history();
      const turn    = game.turn();
      const checkSq = game.isCheck() ? findKingSquare(game, turn) : null;

      set((state) => ({
        fen: game.fen(),
        history,
        pgn: game.pgn(),
        turn,
        selectedSquare: null,
        optionSquares: {},
        lastMoveSquares: {
          [result.from]: { backgroundColor: 'rgba(0,255,136,0.25)' },
          [result.to]:   { backgroundColor: 'rgba(0,255,136,0.25)' },
        },
        checkSquare: checkSq,
        redoStack: state.redoStack.slice(0, -1),
        moveInput: '',
        moveSuggestions: [],
        openingName: identifyOpening(history),
        gameStatus: getGameStatus(game),
        isAnalyzing: true,
      }));

      const fen = game.fen();
      requestAnalysis(fen, settings.engineDepth, 2000, (analysis) => {
        if (get().fen !== fen) return;
        const arrows = getAnalysisArrows(analysis, settings.showArrows);
        set({ engineAnalysis: analysis, isAnalyzing: false, customArrows: arrows });
      });
    } catch { /* ignore */ }
  },

  // ── newGame ───────────────────────────────────────────────────────────────
  newGame: () => {
    const game = new Chess();
    const { settings } = get();

    set({
      game,
      fen: game.fen(),
      history: [],
      pgn: '',
      turn: 'w' as const,
      selectedSquare: null,
      optionSquares: {},
      lastMoveSquares: {},
      checkSquare: null,
      customArrows: [],
      userArrows: [],
      engineAnalysis: null,
      isAnalyzing: true,
      moveInput: '',
      moveSuggestions: [],
      selectedPieceType: null,
      builderDestinations: [],
      builderHighlightSquares: {},
      openingName: 'Starting Position',
      gameStatus: '⬜ White to move',
      redoStack: [],
      lastMoveEval: null,
      moveAnnotations: {},
      previewAnalysis: null,
      pendingPromotion: null,
    });

    const fen = game.fen();
    requestAnalysis(fen, settings.engineDepth, 3000, (analysis) => {
      if (get().fen !== fen) return;
      const arrows = getAnalysisArrows(analysis, settings.showArrows);
      set({ engineAnalysis: analysis, isAnalyzing: false, customArrows: arrows });
    });
  },

  // ── flipBoard ─────────────────────────────────────────────────────────────
  flipBoard: () => {
    set((state) => ({
      boardOrientation: state.boardOrientation === 'white' ? 'black' : 'white',
    }));
  },

  // ── selectSquare ──────────────────────────────────────────────────────────
  selectSquare: (square: string) => {
    const { game, selectedSquare, settings } = get();

    if (selectedSquare) {
      const sq = square as Square;
      const moves = game.moves({ square: selectedSquare as Square, verbose: true });

      // Promotion check
      const promotionMove = moves.find((m) => m.to === sq && m.promotion);
      if (promotionMove) {
        get().setPendingPromotion(selectedSquare, sq);
        set({ selectedSquare: null, optionSquares: {} });
        return;
      }

      // Attempt the move using the shared makeMove action
      const moved = get().makeMove({ from: selectedSquare, to: square, promotion: 'q' });
      if (moved) return;
    }

    // Select a new piece
    const sq = square as Square;
    const piece = game.get(sq);
    if (piece && piece.color === game.turn()) {
      const moves = game.moves({ square: sq, verbose: true });
      const optionSquares: Record<string, React.CSSProperties> = {};
      if (settings.showLegalMoves) {
        for (const m of moves) {
          optionSquares[m.to] = {
            background: 'radial-gradient(circle, rgba(0,255,136,0.35) 0%, rgba(0,255,136,0.08) 75%)',
            borderRadius: '50%',
          };
        }
      }
      set({ selectedSquare: square, optionSquares });
    } else {
      set({ selectedSquare: null, optionSquares: {} });
    }
  },

  // ── setMoveInput ──────────────────────────────────────────────────────────
  setMoveInput: (input: string) => {
    const { game } = get();
    const legal = game.moves();
    const filtered = legal.filter((m) => m.toLowerCase().startsWith(input.toLowerCase()));
    set({ moveInput: input, moveSuggestions: filtered });
  },

  // ── submitMoveInput ───────────────────────────────────────────────────────
  submitMoveInput: () => {
    const { moveInput, game } = get();
    const input = moveInput.trim();
    if (!input) return false;

    const legal = game.moves();
    const match = legal.find(
      (m) => m === input || m === input.replace('=Q', '').replace('=q', ''),
    );
    if (match) return get().makeMove(match);

    const startsWith = legal.filter((m) => m.toLowerCase().startsWith(input.toLowerCase()));
    if (startsWith.length === 1) return get().makeMove(startsWith[0]);

    return false;
  },

  // ── selectPieceType ───────────────────────────────────────────────────────
  selectPieceType: (piece: PieceType | null) => {
    const { game, selectedPieceType } = get();
    if (selectedPieceType === piece) {
      set({ selectedPieceType: null, builderDestinations: [], builderHighlightSquares: {}, optionSquares: {} });
      return;
    }
    if (!piece) {
      set({ selectedPieceType: null, builderDestinations: [], builderHighlightSquares: {} });
      return;
    }
    const moves = getLegalMovesForPiece(game.fen(), piece);
    const destinations = [...new Set(moves.map((m) => m.to))];
    const highlightSquares: Record<string, React.CSSProperties> = {};
    for (const dest of destinations) {
      highlightSquares[dest] = {
        background: 'radial-gradient(circle, rgba(0,255,136,0.45) 0%, rgba(0,255,136,0.1) 75%)',
        borderRadius: '50%',
      };
    }
    set({
      selectedPieceType: piece,
      builderDestinations: destinations,
      builderHighlightSquares: highlightSquares,
      optionSquares: highlightSquares,
      selectedSquare: null,
    });
  },

  // ── selectDestination ─────────────────────────────────────────────────────
  selectDestination: (square: string) => {
    const { game, selectedPieceType } = get();
    if (!selectedPieceType) return false;

    const moves = getLegalMovesForPiece(game.fen(), selectedPieceType);
    const matching = moves.filter((m) => m.to === square);
    if (matching.length === 0) return false;
    if (matching.length === 1) return get().makeMove(matching[0].san);

    // Ambiguous — show suggestions
    set({
      moveSuggestions: matching.map((m) => m.san),
      moveInput: '',
      selectedPieceType: null,
      builderDestinations: [],
      builderHighlightSquares: {},
      optionSquares: {},
    });
    return false;
  },

  // ── setEngineDepth ────────────────────────────────────────────────────────
  setEngineDepth: (depth: number) => {
    set((s) => ({ settings: { ...s.settings, engineDepth: depth } }));
    get().analyze();
  },

  // ── toggleSettings / toggleImportModal / updateSettings ──────────────────
  toggleSettings: () => set((s) => ({ showSettings: !s.showSettings })),

  toggleImportModal: (type) =>
    set((s) => ({
      showImportModal: !s.showImportModal,
      importType: type || s.importType,
    })),

  updateSettings: (s) => {
    const prevDepth = get().settings.engineDepth;
    set((state) => ({ settings: { ...state.settings, ...s } }));
    if (s.engineDepth !== undefined && s.engineDepth !== prevDepth) {
      get().analyze();
    }
  },

  // ── importPgn ─────────────────────────────────────────────────────────────
  importPgn: (pgn: string) => {
    if (pgn.length > MAX_PGN_LENGTH) return false;
    const { settings } = get();
    try {
      const game = new Chess();
      game.loadPgn(pgn);
      const history = game.history();
      const turn    = game.turn();
      const checkSq = game.isCheck() ? findKingSquare(game, turn) : null;

      set({
        game,
        fen: game.fen(),
        history,
        pgn: game.pgn(),
        turn,
        selectedSquare: null,
        optionSquares: {},
        lastMoveSquares: {},
        checkSquare: checkSq,
        redoStack: [],
        moveInput: '',
        moveSuggestions: [],
        selectedPieceType: null,
        builderDestinations: [],
        builderHighlightSquares: {},
        openingName: identifyOpening(history),
        gameStatus: getGameStatus(game),
        showImportModal: false,
        lastMoveEval: null,
        moveAnnotations: {},
        previewAnalysis: null,
        isAnalyzing: true,
      });

      const fen = game.fen();
      requestAnalysis(fen, settings.engineDepth, 2000, (analysis) => {
        if (get().fen !== fen) return;
        const arrows = getAnalysisArrows(analysis, settings.showArrows);
        set({ engineAnalysis: analysis, isAnalyzing: false, customArrows: arrows });
      });
      return true;
    } catch {
      return false;
    }
  },

  // ── importFen ─────────────────────────────────────────────────────────────
  importFen: (fen: string) => {
    if (fen.length > MAX_FEN_LENGTH) return false;
    const { settings } = get();
    try {
      const game = new Chess(fen);
      const turn    = game.turn();
      const checkSq = game.isCheck() ? findKingSquare(game, turn) : null;

      set({
        game,
        fen: game.fen(),
        history: [],
        pgn: '',
        turn,
        selectedSquare: null,
        optionSquares: {},
        lastMoveSquares: {},
        checkSquare: checkSq,
        redoStack: [],
        moveInput: '',
        moveSuggestions: [],
        selectedPieceType: null,
        builderDestinations: [],
        builderHighlightSquares: {},
        openingName: 'Custom Position',
        gameStatus: getGameStatus(game),
        showImportModal: false,
        lastMoveEval: null,
        moveAnnotations: {},
        previewAnalysis: null,
        isAnalyzing: true,
      });

      requestAnalysis(fen, settings.engineDepth, 2000, (analysis) => {
        if (get().fen !== fen) return;
        const arrows = getAnalysisArrows(analysis, settings.showArrows);
        set({ engineAnalysis: analysis, isAnalyzing: false, customArrows: arrows });
      });
      return true;
    } catch {
      return false;
    }
  },

  // ── clearMoveInput ────────────────────────────────────────────────────────
  clearMoveInput: () => set({ moveInput: '', moveSuggestions: [] }),

  // ── analyze ───────────────────────────────────────────────────────────────
  analyze: () => {
    const { game, settings } = get();
    const fen = game.fen();
    set({ isAnalyzing: true });
    requestAnalysis(fen, settings.engineDepth, 3000, (analysis) => {
      if (get().fen !== fen) return;
      const arrows = getAnalysisArrows(analysis, settings.showArrows);
      set({ engineAnalysis: analysis, isAnalyzing: false, customArrows: arrows });
    });
  },

  // ── previewMove ───────────────────────────────────────────────────────────
  previewMove: (from: string, to: string) => {
    const { game, settings } = get();
    try {
      // Clone FEN for preview — don't mutate store's game object
      const tempGame = new Chess(game.fen());
      tempGame.move({ from, to, promotion: 'q' });
      const previewFen = tempGame.fen();
      // Shallow depth-1 preview — fast and non-blocking
      requestAnalysis(previewFen, Math.min(settings.engineDepth, 2), 500, (analysis) => {
        set({ previewAnalysis: analysis });
      });
    } catch {
      set({ previewAnalysis: null });
    }
  },

  // ── clearPreview ──────────────────────────────────────────────────────────
  clearPreview: () => set({ previewAnalysis: null }),

  // ── arrow management ──────────────────────────────────────────────────────
  addUserArrow: (from: string, to: string) => {
    set((state) => {
      const newArrow: [string, string, string] = [from, to, '#00ff88'];
      const existing = state.userArrows.findIndex(([f, t]) => f === from && t === to);
      if (existing >= 0) return state;
      return { userArrows: [...state.userArrows, newArrow] };
    });
  },

  removeUserArrow: (from: string, to: string) => {
    set((state) => ({
      userArrows: state.userArrows.filter(([f, t]) => !(f === from && t === to)),
    }));
  },

  clearUserArrows: () => set({ userArrows: [] }),

  // ── promotion ─────────────────────────────────────────────────────────────
  setPendingPromotion: (from: string, to: string) => set({ pendingPromotion: { from, to } }),
  clearPendingPromotion: () => set({ pendingPromotion: null }),
}));