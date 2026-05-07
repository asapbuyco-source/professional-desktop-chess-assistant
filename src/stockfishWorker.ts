/**
 * stockfishWorker.ts — Stockfish UCI Web Worker bridge
 *
 * Loads the real Stockfish 18 WASM engine and communicates via UCI protocol.
 * This gives us ~3200+ Elo strength and depth 20+ in under a second.
 */

let sf: Worker | null = null;
let pendingResolve: ((msg: string) => void) | null = null;

interface AnalysisRequest {
  id: string;
  fen: string;
  depth: number;
  maxTimeMs: number;
}

interface AnalysisResult {
  bestMove: string | null;
  evaluation: number;
  depth: number;
  nodes: number;
  pv: string[];
  isMate: boolean;
  mateIn: number | null;
  topMoves: { san: string; from: string; to: string; evaluation: number }[];
}

// Parse UCI "info" lines to extract evaluation data
function parseInfo(line: string): {
  depth?: number;
  score?: number;
  isMate?: boolean;
  mateIn?: number;
  nodes?: number;
  pv?: string[];
  multipv?: number;
} {
  const result: ReturnType<typeof parseInfo> = {};
  const tokens = line.split(' ');

  for (let i = 0; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'depth':
        result.depth = parseInt(tokens[++i]);
        break;
      case 'nodes':
        result.nodes = parseInt(tokens[++i]);
        break;
      case 'multipv':
        result.multipv = parseInt(tokens[++i]);
        break;
      case 'score':
        if (tokens[i + 1] === 'cp') {
          result.score = parseInt(tokens[i + 2]);
          result.isMate = false;
          i += 2;
        } else if (tokens[i + 1] === 'mate') {
          result.mateIn = parseInt(tokens[i + 2]);
          result.isMate = true;
          result.score = result.mateIn > 0 ? 100000 - result.mateIn : -100000 - result.mateIn;
          i += 2;
        }
        break;
      case 'pv': {
        result.pv = tokens.slice(i + 1);
        i = tokens.length; // stop parsing
        break;
      }
    }
  }
  return result;
}

// Convert UCI move (e2e4) to from/to squares
function parseUciMove(uci: string): { from: string; to: string } {
  return {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
  };
}

// Main message handler
self.onmessage = async (e: MessageEvent<AnalysisRequest>) => {
  const { id, fen, depth, maxTimeMs } = e.data;

  try {
    // Initialize Stockfish worker if not yet loaded
    if (!sf) {
      sf = new Worker('/stockfish.js');

      // Wait for Stockfish to be ready
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Stockfish init timeout')), 10000);
        sf!.onmessage = (msg: MessageEvent<string>) => {
          if (typeof msg.data === 'string' && msg.data.includes('uciok')) {
            clearTimeout(timeout);
            resolve();
          }
        };
        sf!.postMessage('uci');
      });

      // Configure Stockfish
      sf.postMessage('setoption name MultiPV value 3');
      sf.postMessage('setoption name Hash value 32');
      sf.postMessage('isready');

      await new Promise<void>((resolve) => {
        sf!.onmessage = (msg: MessageEvent<string>) => {
          if (typeof msg.data === 'string' && msg.data.includes('readyok')) resolve();
        };
      });
    }

    // Set up the position and search
    const safeDepth = Math.min(depth, 25);
    const safeTime = Math.min(maxTimeMs, 30000);

    // Collect all info lines and the bestmove
    const infoLines: ReturnType<typeof parseInfo>[] = [];
    let bestMoveUci = '';

    const searchPromise = new Promise<void>((resolve) => {
      sf!.onmessage = (msg: MessageEvent<string>) => {
        const line = typeof msg.data === 'string' ? msg.data : '';

        if (line.startsWith('info') && line.includes('score') && !line.includes('upperbound') && !line.includes('lowerbound')) {
          const info = parseInfo(line);
          if (info.depth && info.score !== undefined) {
            infoLines.push(info);
          }
        }

        if (line.startsWith('bestmove')) {
          bestMoveUci = line.split(' ')[1] || '';
          resolve();
        }
      };
    });

    sf.postMessage(`position fen ${fen}`);
    sf.postMessage(`go depth ${safeDepth} movetime ${safeTime}`);

    await searchPromise;

    // Build result from collected info
    // Get the best info lines for each multipv at the deepest depth
    const deepestDepth = Math.max(...infoLines.map(i => i.depth || 0));
    const deepLines = infoLines.filter(i => i.depth === deepestDepth);

    // Sort by multipv
    deepLines.sort((a, b) => (a.multipv || 1) - (b.multipv || 1));

    const bestInfo = deepLines[0] || {};
    const bestMove = parseUciMove(bestMoveUci);

    // Build top moves from multipv lines
    const topMoves = deepLines.slice(0, 3).map(info => {
      const pv = info.pv || [];
      const uciMove = pv[0] || bestMoveUci;
      const { from, to } = parseUciMove(uciMove);
      return {
        san: uciMove, // UCI notation (e2e4) — we'll display this
        from,
        to,
        evaluation: info.score || 0,
      };
    });

    // If no topMoves, at least include the best move
    if (topMoves.length === 0 && bestMoveUci) {
      topMoves.push({
        san: bestMoveUci,
        from: bestMove.from,
        to: bestMove.to,
        evaluation: bestInfo.score || 0,
      });
    }

    const evaluation = bestInfo.score || 0;
    const isMate = bestInfo.isMate || false;
    const mateIn = bestInfo.mateIn || null;
    const nodes = bestInfo.nodes || 0;
    const pv = (bestInfo.pv || []).slice(0, 5);

    const result: AnalysisResult = {
      bestMove: bestMoveUci || null,
      evaluation,
      depth: deepestDepth || safeDepth,
      nodes,
      pv,
      isMate,
      mateIn,
      topMoves,
    };

    self.postMessage({ id, result });

  } catch (err) {
    // Stockfish failed — signal error so fallback engine can be used
    self.postMessage({ id, error: (err as Error).message || 'Stockfish error' });
  }
};
