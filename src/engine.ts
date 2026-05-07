/**
 * engine.ts — Production-grade chess engine (main-thread variant)
 *
 * Key fixes vs. original:
 *  1. Removed the catastrophic makeResult() re-evaluation loop that
 *     evaluated every legal move a second time at full depth — this was
 *     the primary cause of UI freezes.
 *  2. Hard node-budget cap prevents runaway searches.
 *  3. Quiescence sort fixed (was ascending, now descending by capture value).
 *  4. Time budget is checked inside minimax, not only at root.
 *  6. topMoves are derived from root-move scores already computed by
 *     searchRoot — no second pass needed.
 *  7. Transposition table (Simple Map) stores search results to avoid
 *     redundant work.
 *  8. Opening Book: Curated responses for common positions.
 *  9. Null Move Pruning (NMP): Search depth reduction for dominant positions.
 */

import { Chess, type Move } from 'chess.js';
import type { EngineAnalysis, TopMove } from '@/types';
import { PIECE_VALUES } from '@/pieceValues';

// ─── Opening Book ───────────────────────────────────────────────────────────

const OPENING_BOOK: Record<string, string> = {
  // Start position
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1': 'e4',
  // After e4
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR b KQkq e3 0 1': 'c5', // Sicilian
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPPPPPP/RNBQKBNR b KQkq e3 0 1 ': 'e5', // e4 e5
  // e4 c5 (Sicilian)
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPPPPPP/RNBQKBNR w KQkq c6 0 2': 'Nf3',
  // e4 e5 (King's Pawn)
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPPPPPP/RNBQKBNR w KQkq e6 0 2': 'Nf3',
  // d4
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPPPPPPP/RNBQKBNR w KQkq d3 0 1': 'd4',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPPPPPPP/RNBQKBNR b KQkq d3 0 1': 'Nf6', // Indian
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPPPPPPP/RNBQKBNR b KQkq d3 0 1 ': 'd5', // d4 d5
};

// ─── Piece-Square Tables ────────────────────────────────────────────────────

const PST: Record<string, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
     0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
  k_endgame: [
    -50,-40,-30,-20,-20,-30,-40,-50,
    -30,-20,-10,  0,  0,-10,-20,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 30, 40, 40, 30,-10,-30,
    -30,-10, 20, 30, 30, 20,-10,-30,
    -30,-30,  0,  0,  0,  0,-30,-30,
    -50,-30,-30,-30,-30,-30,-30,-50,
  ],
};

const KING_SAFETY = {
  openFilePenalty: -15,
  noPawnShieldPenalty: -30,
  weakSquares: -10,
};

// ─── Hard limits ─────────────────────────────────────────────────────────────

/** Absolute node cap — prevents runaway searches. Increased for higher depth. */
const MAX_NODES = 1_500_000;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function evaluateKingSafety(game: Chess): number {
  let safetyScore = 0;
  const board = game.board();

  for (const color of ['w', 'b'] as const) {
    let kingRow = -1, kingCol = -1;

    for (let r = 0; r < 8; r++) {
      for (let f = 0; f < 8; f++) {
        const piece = board[r][f];
        if (piece && piece.type === 'k' && piece.color === color) {
          kingRow = r;
          kingCol = f;
        }
      }
    }

    if (kingRow === -1) continue;

    const forwardDir = color === 'w' ? -1 : 1;

    const hasPawnShield = (file: number) => {
      const shieldRank = kingRow + forwardDir;
      if (shieldRank < 0 || shieldRank > 7) return false;
      const shieldPiece = board[shieldRank]?.[file];
      return !!shieldPiece && shieldPiece.type === 'p' && shieldPiece.color === color;
    };

    const isFileOpen = (file: number) => {
      for (let r = 0; r < 8; r++) {
        const sq = board[r]?.[file];
        if (sq && sq.type === 'p') return false;
      }
      return true;
    };

    if (!hasPawnShield(kingCol) && !hasPawnShield(kingCol - 1) && !hasPawnShield(kingCol + 1)) {
      safetyScore += KING_SAFETY.noPawnShieldPenalty * (color === 'w' ? 1 : -1);
    }

    if (isFileOpen(kingCol)) {
      safetyScore += KING_SAFETY.openFilePenalty * (color === 'w' ? 1 : -1);
    }

    const weakSquareFiles = [kingCol - 1, kingCol + 1].filter(f => f >= 0 && f <= 7 && isFileOpen(f));
    for (const _f of weakSquareFiles) {
      safetyScore += KING_SAFETY.weakSquares * (color === 'w' ? 1 : -1);
    }
  }

  return safetyScore;
}

function evaluate(game: Chess): number {
  if (game.isCheckmate()) {
    return game.turn() === 'w' ? -100_000 : 100_000;
  }
  if (game.isDraw() || game.isStalemate()) return 0;

  let score = 0;
  const board = game.board();
  let totalMaterial = 0;
  let pieceCount = 0;

  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;

      pieceCount++;
      const pieceVal = PIECE_VALUES[piece.type] || 0;
      if (piece.type !== 'p' && piece.type !== 'k') totalMaterial += pieceVal;

      const isEndgame = totalMaterial < 1500;
      const tableKey = (piece.type === 'k' && isEndgame) ? 'k_endgame' : piece.type;
      const table = PST[tableKey];
      const idx = piece.color === 'w' ? r * 8 + f : (7 - r) * 8 + f;
      const posVal = table ? table[idx] : 0;
      const multiplier = piece.color === 'w' ? 1 : -1;
      score += multiplier * (pieceVal + posVal);
    }
  }

  score += evaluateKingSafety(game);

  return score;
}

/** MVV-LVA score for move ordering */
function mvvLvaScore(capturedType: string | undefined, pieceType: string): number {
  if (!capturedType) return 0;
  return (PIECE_VALUES[capturedType] || 0) * 10 - (PIECE_VALUES[pieceType] || 0);
}

function sortMoves(moves: ReturnType<Chess['moves']>[number][]): void {
  moves.sort((a, b) => {
    let sa = 0, sb = 0;
    // Captures (MVV-LVA)
    if ('captured' in a && a.captured) sa += mvvLvaScore(a.captured, a.piece) * 10;
    if ('captured' in b && b.captured) sb += mvvLvaScore(b.captured, b.piece) * 10;
    // Checks
    if (a.san.includes('+')) sa += 500;
    if (b.san.includes('+')) sb += 500;
    // Promotions
    if ('promotion' in a && a.promotion) sa += (PIECE_VALUES[a.promotion] || 0);
    if ('promotion' in b && b.promotion) sb += (PIECE_VALUES[b.promotion] || 0);
    return sb - sa;
  });
}

// ─── Search ──────────────────────────────────────────────────────────────────

interface TTEntry {
  score: number;
  depth: number;
  type: 'EXACT' | 'LOWERBOUND' | 'UPPERBOUND';
}

interface SearchState {
  nodes: number;
  startTime: number;
  maxTimeMs: number;
  aborted: boolean;
  tt: Map<string, TTEntry>;
}

function shouldAbort(state: SearchState): boolean {
  if (state.aborted) return true;
  if (state.nodes >= MAX_NODES) {
    state.aborted = true;
    return true;
  }
  // Only check wall clock every 1024 nodes to avoid Date.now() overhead
  if ((state.nodes & 1023) === 0) {
    if (Date.now() - state.startTime >= state.maxTimeMs) {
      state.aborted = true;
      return true;
    }
  }
  return false;
}

function quiescence(
  game: Chess,
  alpha: number,
  beta: number,
  state: SearchState,
  depthLeft = 4,
): number {
  state.nodes++;
  if (shouldAbort(state)) return 0;

  const standPat = evaluate(game);
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;
  if (depthLeft <= 0) return alpha;

  const moves = game.moves({ verbose: true }).filter(m => m.captured);
  if (moves.length === 0) return standPat;

  // FIX: was sorting ascending — captures should be sorted descending (best first)
  moves.sort((a, b) => (PIECE_VALUES[b.captured!] || 0) - (PIECE_VALUES[a.captured!] || 0));

  for (const m of moves) {
    game.move(m.san);
    const score = -quiescence(game, -beta, -alpha, state, depthLeft - 1);
    game.undo();
    if (state.aborted) return 0;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

function minimax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  maxDepth: number,
  state: SearchState,
  allowNullMove = true,
): number {
  state.nodes++;
  if (shouldAbort(state)) return 0;

  const fen = game.fen();
  const ttHit = state.tt.get(fen);
  if (ttHit && ttHit.depth >= depth) {
    if (ttHit.type === 'EXACT') return ttHit.score;
    if (ttHit.type === 'LOWERBOUND') alpha = Math.max(alpha, ttHit.score);
    else if (ttHit.type === 'UPPERBOUND') beta = Math.min(beta, ttHit.score);
    if (alpha >= beta) return ttHit.score;
  }

  if (game.isGameOver()) {
    if (game.isCheckmate()) {
      const mateDist = maxDepth - depth;
      return game.turn() === 'w' ? -100_000 + mateDist : 100_000 - mateDist;
    }
    return 0;
  }

  if (depth === 0) {
    return quiescence(game, alpha, beta, state);
  }

  // Null Move Pruning
  if (allowNullMove && depth >= 3 && !game.isCheck()) {
    const R = 2; // Reduction
    const dummy = new Chess(game.fen());
    // Make a null move (switch turns)
    const tokens = dummy.fen().split(' ');
    tokens[1] = tokens[1] === 'w' ? 'b' : 'w';
    tokens[3] = '-'; // En passant reset
    const nullFen = tokens.join(' ');
    const nullGame = new Chess(nullFen);
    
    const val = -minimax(nullGame, depth - 1 - R, -beta, -beta + 1, maxDepth, state, false);
    if (val >= beta) return beta;
  }

  const moves = game.moves({ verbose: true });
  sortMoves(moves as Parameters<typeof sortMoves>[0]);

  let bestVal = game.turn() === 'w' ? -Infinity : Infinity;
  let oldAlpha = alpha;

  for (const m of moves) {
    game.move(m.san);
    const val = minimax(game, depth - 1, alpha, beta, maxDepth, state);
    game.undo();
    if (state.aborted) return bestVal;

    if (game.turn() === 'w') {
      bestVal = Math.max(bestVal, val);
      alpha = Math.max(alpha, val);
    } else {
      bestVal = Math.min(bestVal, val);
      beta = Math.min(beta, val);
    }
    if (beta <= alpha) break;
  }

  // Store in TT
  let type: TTEntry['type'] = 'EXACT';
  if (bestVal <= oldAlpha) type = 'UPPERBOUND';
  else if (bestVal >= beta) type = 'LOWERBOUND';
  
  state.tt.set(fen, { score: bestVal, depth, type });

  return bestVal;
}

interface RootMove {
  san: string;
  from: string;
  to: string;
  score: number;
}

function searchRoot(
  game: Chess,
  depth: number,
  state: SearchState,
): RootMove[] {
  const moves = game.moves({ verbose: true });
  sortMoves(moves as Parameters<typeof sortMoves>[0]);

  const isWhite = game.turn() === 'w';
  const scored: RootMove[] = [];

  for (const m of moves) {
    game.move(m.san);
    const val = minimax(game, depth - 1, -Infinity, Infinity, depth, state);
    game.undo();

    scored.push({ san: m.san, from: m.from, to: m.to, score: val });

    if (state.aborted) break;
  }

  // Sort: white wants high scores, black wants low scores
  scored.sort((a, b) => isWhite ? b.score - a.score : a.score - b.score);
  return scored;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function analyzePosition(fen: string, depth: number, maxTimeMs = 3000): EngineAnalysis {
  // 1. Check Opening Book first
  const bookMove = OPENING_BOOK[fen] || OPENING_BOOK[fen.trim()];
  if (bookMove) {
    const g = new Chess(fen);
    try {
      const m = g.move(bookMove);
      return {
        bestMove: m.san,
        evaluation: 0,
        depth: 0,
        nodes: 0,
        pv: [m.san],
        topMoves: [{ move: m.san, score: 0, pv: [m.san] }],
      };
    } catch { /* ignore */ }
  }

  const game = new Chess(fen);

  if (game.isGameOver()) {
    const isMate = game.isCheckmate();
    return {
      bestMove: null,
      evaluation: isMate ? (game.turn() === 'w' ? -100_000 : 100_000) : 0,
      depth: 0,
      nodes: 0,
      pv: [],
      isMate,
      mateIn: isMate ? 0 : null,
      topMoves: [],
    };
  }

  // Clamp depth and time to safe production values
  const safeDepth = Math.min(depth, 8);
  const safeTime  = Math.min(maxTimeMs, 10000);

  const state: SearchState = {
    nodes: 0,
    startTime: Date.now(),
    maxTimeMs: safeTime,
    aborted: false,
    tt: new Map(),
  };

  let bestResult: { moves: RootMove[]; depth: number } | null = null;

  // Iterative deepening
  for (let d = 1; d <= safeDepth; d++) {
    const elapsed = Date.now() - state.startTime;
    // Reserve at least 20 % of budget for each deeper ply
    if (elapsed > safeTime * 0.8) break;

    const moves = searchRoot(game, d, state);
    if (moves.length > 0) {
      bestResult = { moves, depth: d };
    }
    if (state.aborted) break;
  }

  if (!bestResult || bestResult.moves.length === 0) {
    return {
      bestMove: null,
      evaluation: 0,
      depth: safeDepth,
      nodes: state.nodes,
      pv: [],
      isMate: false,
      mateIn: null,
      topMoves: [],
    };
  }

  const { moves, depth: reachedDepth } = bestResult;
  const best = moves[0];
  const evaluation = best.score;

  const isMate = Math.abs(evaluation) > 90_000;
  const mateIn = isMate
    ? Math.round((100_000 - Math.abs(evaluation)) / 2) * (evaluation > 0 ? 1 : -1)
    : null;

  // Top 3 moves from root scores — no second pass needed
  const topMoves: TopMove[] = moves.slice(0, 3).map(m => ({
    san: m.san,
    from: m.from,
    to: m.to,
    evaluation: m.score,
  }));

  // Principal variation: just the best move for now (could be extended with
  // recursive best-reply extraction without extra cost)
  const pv = topMoves.slice(0, 5).map(m => m.san);

  return {
    bestMove: best.san,
    evaluation,
    depth: reachedDepth,
    nodes: state.nodes,
    pv,
    isMate,
    mateIn,
    topMoves,
  };
}

export function getLegalMoves(fen: string): string[] {
  try {
    const game = new Chess(fen);
    return game.moves();
  } catch {
    return [];
  }
}

export function getLegalMovesForPiece(
  fen: string,
  pieceType: string,
): { from: string; to: string; san: string }[] {
  try {
    const game = new Chess(fen);
    const verbose = game.moves({ verbose: true });
    const typeMap: Record<string, string> = {
      K: 'k', Q: 'q', R: 'r', B: 'b', N: 'n', P: 'p',
    };
    const target = typeMap[pieceType];
    if (!target) return [];
    return verbose
      .filter(m => m.piece === target)
      .map(m => ({ from: m.from, to: m.to, san: m.san }));
  } catch {
    return [];
  }
}