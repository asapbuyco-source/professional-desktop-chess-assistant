/**
 * engine.ts — Production-grade chess engine
 *
 * Architecture: Negamax + Alpha-Beta with:
 *  - Iterative Deepening
 *  - Transposition Table (persisted across iterations)
 *  - Null Move Pruning (NMP)
 *  - Quiescence Search with Delta Pruning
 *  - MVV-LVA move ordering + killer/history heuristics
 *  - Late Move Reductions (LMR)
 *  - Check Extensions
 *  - Endgame-aware King PST
 */

import { Chess } from 'chess.js';
import type { EngineAnalysis, TopMove } from '@/types';
import { PIECE_VALUES } from '@/pieceValues';

// ─── Piece-Square Tables (from White's perspective, rank 0 = rank 8) ────────

const PST: Record<string, readonly number[]> = {
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

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_NODES = 2_000_000;
const MATE_SCORE = 100_000;
const INF = MATE_SCORE + 1;

// ─── Evaluation ──────────────────────────────────────────────────────────────

/**
 * Evaluates the position from the side-to-move's perspective (Negamax convention).
 * Positive = good for side to move.
 */
function evaluate(game: Chess): number {
  const board = game.board();
  const turn = game.turn();

  let whiteScore = 0;
  let blackScore = 0;
  let whiteMaterial = 0;
  let blackMaterial = 0;

  // First pass: count material for endgame detection
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece || piece.type === 'k' || piece.type === 'p') continue;
      const val = PIECE_VALUES[piece.type] || 0;
      if (piece.color === 'w') whiteMaterial += val;
      else blackMaterial += val;
    }
  }

  const totalMaterial = whiteMaterial + blackMaterial;
  const isEndgame = totalMaterial < 2600; // roughly when queens are off + minor piece

  // Second pass: score everything
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece) continue;

      const pieceVal = PIECE_VALUES[piece.type] || 0;
      const tableKey = (piece.type === 'k' && isEndgame) ? 'k_endgame' : piece.type;
      const table = PST[tableKey];
      const idx = piece.color === 'w' ? r * 8 + f : (7 - r) * 8 + f;
      const posVal = table ? table[idx] : 0;

      if (piece.color === 'w') {
        whiteScore += pieceVal + posVal;
      } else {
        blackScore += pieceVal + posVal;
      }
    }
  }

  // Bishop pair bonus
  let whiteBishops = 0, blackBishops = 0;
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (piece?.type === 'b') {
        if (piece.color === 'w') whiteBishops++;
        else blackBishops++;
      }
    }
  }
  if (whiteBishops >= 2) whiteScore += 30;
  if (blackBishops >= 2) blackScore += 30;

  // Rook on open file bonus
  for (let f = 0; f < 8; f++) {
    let hasPawn = false;
    let whiteRookOnFile = false;
    let blackRookOnFile = false;
    for (let r = 0; r < 8; r++) {
      const piece = board[r][f];
      if (piece?.type === 'p') hasPawn = true;
      if (piece?.type === 'r' && piece.color === 'w') whiteRookOnFile = true;
      if (piece?.type === 'r' && piece.color === 'b') blackRookOnFile = true;
    }
    if (!hasPawn) {
      if (whiteRookOnFile) whiteScore += 15;
      if (blackRookOnFile) blackScore += 15;
    }
  }

  // Passed pawn bonus
  for (let r = 0; r < 8; r++) {
    for (let f = 0; f < 8; f++) {
      const piece = board[r][f];
      if (!piece || piece.type !== 'p') continue;
      
      let passed = true;
      if (piece.color === 'w') {
        for (let br = r - 1; br >= 0; br--) {
          for (let bf = Math.max(0, f - 1); bf <= Math.min(7, f + 1); bf++) {
            const blocker = board[br][bf];
            if (blocker?.type === 'p' && blocker.color === 'b') passed = false;
          }
        }
        if (passed) whiteScore += (7 - r) * 10; // closer to promotion = bigger bonus
      } else {
        for (let br = r + 1; br < 8; br++) {
          for (let bf = Math.max(0, f - 1); bf <= Math.min(7, f + 1); bf++) {
            const blocker = board[br][bf];
            if (blocker?.type === 'p' && blocker.color === 'w') passed = false;
          }
        }
        if (passed) blackScore += r * 10;
      }
    }
  }

  const rawScore = whiteScore - blackScore;
  return turn === 'w' ? rawScore : -rawScore;
}

// ─── Move Ordering ───────────────────────────────────────────────────────────

function scoreMoveForOrdering(
  m: ReturnType<Chess['moves']>[number] & { captured?: string; promotion?: string; piece: string },
  ttBestMove: string | null,
  killers: string[],
): number {
  // TT best move gets highest priority
  if (ttBestMove && m.san === ttBestMove) return 1_000_000;

  let score = 0;

  // Captures: MVV-LVA
  if (m.captured) {
    const victimVal = PIECE_VALUES[m.captured] || 0;
    const attackerVal = PIECE_VALUES[m.piece] || 0;
    score += 100_000 + victimVal * 10 - attackerVal;
  }

  // Promotions
  if (m.promotion) {
    score += 90_000 + (PIECE_VALUES[m.promotion] || 0);
  }

  // Check bonus
  if (m.san.includes('+')) score += 50_000;

  // Killer moves
  if (killers.includes(m.san)) score += 40_000;

  return score;
}

// ─── Search State ────────────────────────────────────────────────────────────

interface TTEntry {
  score: number;
  depth: number;
  type: 'EXACT' | 'LOWERBOUND' | 'UPPERBOUND';
  bestMove: string | null;
}

interface SearchState {
  nodes: number;
  startTime: number;
  maxTimeMs: number;
  aborted: boolean;
  tt: Map<string, TTEntry>;
  killers: string[][];  // killers[ply] = [move1, move2]
}

function shouldAbort(state: SearchState): boolean {
  if (state.aborted) return true;
  if (state.nodes >= MAX_NODES) {
    state.aborted = true;
    return true;
  }
  if ((state.nodes & 2047) === 0) {
    if (Date.now() - state.startTime >= state.maxTimeMs) {
      state.aborted = true;
      return true;
    }
  }
  return false;
}

function storeKiller(state: SearchState, ply: number, move: string): void {
  if (!state.killers[ply]) state.killers[ply] = [];
  const k = state.killers[ply];
  if (k[0] !== move) {
    k[1] = k[0];
    k[0] = move;
  }
}

// ─── Quiescence Search ──────────────────────────────────────────────────────

function quiescence(
  game: Chess,
  alpha: number,
  beta: number,
  state: SearchState,
  depthLeft = 6,
): number {
  state.nodes++;
  if (shouldAbort(state)) return 0;

  const standPat = evaluate(game);
  if (standPat >= beta) return beta;
  if (standPat > alpha) alpha = standPat;
  if (depthLeft <= 0) return alpha;

  // Delta pruning threshold: only look at captures that can improve alpha
  const DELTA = 200; // margin
  if (standPat + DELTA + 900 < alpha) return alpha; // even capturing a queen won't help

  const captures = game.moves({ verbose: true }).filter(m => m.captured);
  // Sort by captured piece value (MVV)
  captures.sort((a, b) => (PIECE_VALUES[b.captured!] || 0) - (PIECE_VALUES[a.captured!] || 0));

  for (const m of captures) {
    // Delta pruning per-move
    const capturedVal = PIECE_VALUES[m.captured!] || 0;
    if (standPat + capturedVal + DELTA < alpha && !m.promotion) continue;

    game.move(m.san);
    const score = -quiescence(game, -beta, -alpha, state, depthLeft - 1);
    game.undo();

    if (state.aborted) return 0;
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }

  return alpha;
}

// ─── Negamax with Alpha-Beta ─────────────────────────────────────────────────

function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
  state: SearchState,
  allowNull: boolean,
): number {
  state.nodes++;
  if (shouldAbort(state)) return 0;

  const isRoot = ply === 0;
  const inCheck = game.isCheck();

  // Check extension: don't reduce depth when in check
  if (inCheck) depth++;

  // Terminal nodes
  if (game.isCheckmate()) return -(MATE_SCORE - ply);
  if (game.isDraw() || game.isStalemate() || game.isThreefoldRepetition()) return 0;

  if (depth <= 0) return quiescence(game, alpha, beta, state);

  // TT probe
  const fen = game.fen();
  const ttHit = state.tt.get(fen);
  let ttBestMove: string | null = null;

  if (ttHit) {
    ttBestMove = ttHit.bestMove;
    if (!isRoot && ttHit.depth >= depth) {
      if (ttHit.type === 'EXACT') return ttHit.score;
      if (ttHit.type === 'LOWERBOUND') alpha = Math.max(alpha, ttHit.score);
      else if (ttHit.type === 'UPPERBOUND') beta = Math.min(beta, ttHit.score);
      if (alpha >= beta) return ttHit.score;
    }
  }

  // Null Move Pruning (skip when in check, at root, or in zugzwang-prone endgames)
  if (allowNull && !inCheck && !isRoot && depth >= 3) {
    // Quick material check: don't NMP if only pawns left (zugzwang risk)
    const board = game.board();
    let hasNonPawn = false;
    const turn = game.turn();
    for (let r = 0; r < 8 && !hasNonPawn; r++) {
      for (let f = 0; f < 8 && !hasNonPawn; f++) {
        const p = board[r][f];
        if (p && p.color === turn && p.type !== 'k' && p.type !== 'p') hasNonPawn = true;
      }
    }

    if (hasNonPawn) {
      // Simulate null move by flipping turn in FEN
      const tokens = fen.split(' ');
      tokens[1] = tokens[1] === 'w' ? 'b' : 'w';
      tokens[3] = '-';
      try {
        const nullGame = new Chess(tokens.join(' '));
        const R = depth >= 6 ? 3 : 2;
        const nullScore = -negamax(nullGame, depth - 1 - R, -beta, -beta + 1, ply + 1, state, false);
        if (nullScore >= beta) return beta;
      } catch {
        // Invalid FEN after null move — skip
      }
    }
  }

  // Generate and order moves
  const moves = game.moves({ verbose: true });
  const killers = state.killers[ply] || [];
  const scored = moves.map(m => ({
    move: m,
    score: scoreMoveForOrdering(m as any, ttBestMove, killers),
  }));
  scored.sort((a, b) => b.score - a.score);

  let bestScore = -INF;
  let bestMove: string | null = null;
  let movesSearched = 0;

  for (const { move: m } of scored) {
    const isCapture = !!m.captured;
    const isPromotion = !!(m as any).promotion;
    const givesCheck = m.san.includes('+');

    game.move(m.san);

    let score: number;

    // Late Move Reductions (LMR)
    if (
      movesSearched >= 4 &&
      depth >= 3 &&
      !inCheck &&
      !isCapture &&
      !isPromotion &&
      !givesCheck
    ) {
      // Search with reduced depth first
      score = -negamax(game, depth - 2, -alpha - 1, -alpha, ply + 1, state, true);
      // Re-search at full depth if it might be good
      if (score > alpha) {
        score = -negamax(game, depth - 1, -beta, -alpha, ply + 1, state, true);
      }
    } else {
      score = -negamax(game, depth - 1, -beta, -alpha, ply + 1, state, true);
    }

    game.undo();

    if (state.aborted) return bestScore !== -INF ? bestScore : 0;

    movesSearched++;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m.san;
    }

    if (score > alpha) {
      alpha = score;
    }

    if (alpha >= beta) {
      // Store killer move for non-captures
      if (!isCapture) storeKiller(state, ply, m.san);
      break;
    }
  }

  // TT store
  let type: TTEntry['type'] = 'EXACT';
  if (bestScore <= alpha) type = 'UPPERBOUND';
  if (bestScore >= beta) type = 'LOWERBOUND';

  state.tt.set(fen, { score: bestScore, depth, type, bestMove });

  return bestScore;
}

// ─── Root Search ─────────────────────────────────────────────────────────────

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
  prevBest: string | null,
): RootMove[] {
  const moves = game.moves({ verbose: true });
  const killers = state.killers[0] || [];
  const scored = moves.map(m => ({
    move: m,
    orderScore: scoreMoveForOrdering(m as any, prevBest, killers),
  }));
  scored.sort((a, b) => b.orderScore - a.orderScore);

  let alpha = -INF;
  const beta = INF;
  const results: RootMove[] = [];

  for (const { move: m } of scored) {
    game.move(m.san);
    const score = -negamax(game, depth - 1, -beta, -alpha, 1, state, true);
    game.undo();

    results.push({ san: m.san, from: m.from, to: m.to, score });

    if (state.aborted && results.length > 1) break;

    if (score > alpha) alpha = score;
  }

  // Sort best first
  results.sort((a, b) => b.score - a.score);
  return results;
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function analyzePosition(fen: string, depth: number, maxTimeMs = 5000): EngineAnalysis {
  const game = new Chess(fen);

  if (game.isGameOver()) {
    const isMate = game.isCheckmate();
    return {
      bestMove: null,
      evaluation: isMate ? (game.turn() === 'w' ? -MATE_SCORE : MATE_SCORE) : 0,
      depth: 0,
      nodes: 0,
      pv: [],
      isMate,
      mateIn: isMate ? 0 : null,
      topMoves: [],
    };
  }

  const safeDepth = Math.min(depth, 12);
  const safeTime = Math.min(maxTimeMs, 15000);

  const state: SearchState = {
    nodes: 0,
    startTime: Date.now(),
    maxTimeMs: safeTime,
    aborted: false,
    tt: new Map(),
    killers: [],
  };

  let bestResult: { moves: RootMove[]; depth: number } | null = null;
  let prevBest: string | null = null;

  // Iterative deepening
  for (let d = 1; d <= safeDepth; d++) {
    const elapsed = Date.now() - state.startTime;
    if (d > 1 && elapsed > safeTime * 0.6) break;

    state.aborted = false;
    const moves = searchRoot(game, d, state, prevBest);

    if (moves.length > 0 && !state.aborted) {
      bestResult = { moves, depth: d };
      prevBest = moves[0].san;
    } else if (moves.length > 0 && state.aborted && !bestResult) {
      // Use partial results if we have nothing else
      bestResult = { moves, depth: d };
    }

    if (state.aborted) break;
  }

  if (!bestResult || bestResult.moves.length === 0) {
    return {
      bestMove: null,
      evaluation: 0,
      depth: 0,
      nodes: state.nodes,
      pv: [],
      isMate: false,
      mateIn: null,
      topMoves: [],
    };
  }

  const { moves, depth: reachedDepth } = bestResult;
  const best = moves[0];

  // Convert negamax score back to centipawn (positive = white advantage)
  const evaluation = game.turn() === 'w' ? best.score : -best.score;

  const isMate = Math.abs(best.score) > MATE_SCORE - 100;
  const mateIn = isMate
    ? Math.ceil((MATE_SCORE - Math.abs(best.score)) / 2) * (best.score > 0 ? 1 : -1)
    : null;

  const topMoves: TopMove[] = moves.slice(0, 3).map(m => ({
    san: m.san,
    from: m.from,
    to: m.to,
    evaluation: game.turn() === 'w' ? m.score : -m.score,
  }));

  const pv = moves.slice(0, 5).map(m => m.san);

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