/**
 * useEngineWorker.ts
 *
 * Manages engine analysis with Stockfish WASM as primary engine
 * and custom JS engine as fallback.
 *
 * Priority: Stockfish WASM > Custom JS engine
 */

import type { EngineAnalysis } from '@/types';
import { analyzePosition } from '@/engine';

type AnalysisCallback = (result: EngineAnalysis | null) => void;

let sfWorker: Worker | null = null;
let sfFailed = false;  // If Stockfish fails once, stop trying
let jsWorker: Worker | null = null;

let pendingId: string | null = null;
let pendingCallback: AnalysisCallback | null = null;

function getStockfishWorker(): Worker | null {
  if (sfFailed) return null;

  if (!sfWorker) {
    try {
      sfWorker = new Worker(
        new URL('../stockfishWorker.ts', import.meta.url),
        { type: 'module' }
      );

      sfWorker.onmessage = (e: MessageEvent<{
        id: string;
        result?: EngineAnalysis;
        error?: string;
      }>) => {
        const { id, result, error } = e.data;

        if (id !== pendingId) return;

        if (error) {
          // Stockfish failed — fall back to JS engine for this request
          console.warn('Stockfish error, falling back to JS engine:', error);
          sfFailed = true;
          sfWorker?.terminate();
          sfWorker = null;

          // Re-dispatch to JS engine
          const cb = pendingCallback;
          if (cb && pendingId) {
            // We don't have fen/depth/maxTimeMs here, so just return null
            // The next request will use JS engine directly
            pendingId = null;
            pendingCallback = null;
            cb(null);
          }
          return;
        }

        pendingId = null;
        const cb = pendingCallback;
        pendingCallback = null;
        if (cb) cb(result ?? null);
      };

      sfWorker.onerror = () => {
        console.warn('Stockfish worker failed to load, using JS engine');
        sfFailed = true;
        sfWorker = null;
        pendingId = null;
        const cb = pendingCallback;
        pendingCallback = null;
        if (cb) cb(null);
      };
    } catch {
      sfFailed = true;
      return null;
    }
  }

  return sfWorker;
}

function getJSWorker(): Worker {
  if (!jsWorker) {
    jsWorker = new Worker(new URL('../engineWorker.ts', import.meta.url), {
      type: 'module',
    });

    jsWorker.onmessage = (e: MessageEvent<{
      id: string;
      result?: EngineAnalysis;
      error?: string;
    }>) => {
      const { id, result, error } = e.data;
      if (id !== pendingId) return;

      pendingId = null;
      const cb = pendingCallback;
      pendingCallback = null;
      if (cb) cb(error ? null : (result ?? null));
    };

    jsWorker.onerror = () => {
      pendingId = null;
      const cb = pendingCallback;
      pendingCallback = null;
      if (cb) cb(null);
    };
  }
  return jsWorker;
}

let idCounter = 0;

/**
 * Request an engine analysis.
 * Uses Stockfish WASM if available, falls back to custom JS engine.
 */
export function requestAnalysis(
  fen: string,
  depth: number,
  maxTimeMs: number,
  callback: AnalysisCallback,
): void {
  const id = String(++idCounter);
  pendingId = id;
  pendingCallback = callback;

  // Try Stockfish first
  const sf = getStockfishWorker();
  if (sf) {
    try {
      sf.postMessage({ id, fen, depth, maxTimeMs });
      return;
    } catch {
      sfFailed = true;
    }
  }

  // Fall back to JS engine worker
  try {
    const w = getJSWorker();
    w.postMessage({ id, fen, depth, maxTimeMs });
  } catch {
    // Worker unavailable — sync fallback on main thread
    pendingId = null;
    pendingCallback = null;
    try {
      callback(analyzePosition(fen, depth, maxTimeMs));
    } catch {
      callback(null);
    }
  }
}

/** Terminate all workers. */
export function terminateWorker(): void {
  sfWorker?.terminate();
  sfWorker = null;
  jsWorker?.terminate();
  jsWorker = null;
  pendingId = null;
  pendingCallback = null;
}
