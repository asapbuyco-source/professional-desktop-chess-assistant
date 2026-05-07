/**
 * engineWorker.ts
 *
 * Runs the chess engine in a dedicated Web Worker thread so
 * the main UI thread is never blocked during analysis.
 *
 * Message protocol:
 *   IN  → { id: string; fen: string; depth: number; maxTimeMs: number }
 *   OUT → { id: string; result: EngineAnalysis } | { id: string; error: string }
 */

import { analyzePosition } from './engine';

self.onmessage = (e: MessageEvent<{
  id: string;
  fen: string;
  depth: number;
  maxTimeMs: number;
}>) => {
  const { id, fen, depth, maxTimeMs } = e.data;
  try {
    const result = analyzePosition(fen, depth, maxTimeMs);
    (self as unknown as Worker).postMessage({ id, result });
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
