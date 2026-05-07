/**
 * useEngineWorker.ts
 *
 * Singleton manager for the engine Web Worker.
 * Keeps one worker alive for the app's lifetime and cancels
 * any in-flight request when a newer one arrives.
 */

import type { EngineAnalysis } from '@/types';
import { analyzePosition } from '@/engine';

type AnalysisCallback = (result: EngineAnalysis | null) => void;

let worker: Worker | null = null;
let pendingId: string | null = null;
let pendingCallback: AnalysisCallback | null = null;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../engineWorker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = (e: MessageEvent<{
      id: string;
      result?: EngineAnalysis;
      error?: string;
    }>) => {
      const { id, result, error } = e.data;

      // Ignore stale responses
      if (id !== pendingId) return;

      pendingId = null;
      const cb = pendingCallback;
      pendingCallback = null;

      if (cb) {
        cb(error ? null : (result ?? null));
      }
    };

    worker.onerror = () => {
      pendingId = null;
      const cb = pendingCallback;
      pendingCallback = null;
      if (cb) cb(null);
    };
  }
  return worker;
}

let idCounter = 0;

/**
 * Request an engine analysis.
 * Any previously pending request is superseded (its callback is dropped).
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

  try {
    const w = getWorker();
    w.postMessage({ id, fen, depth, maxTimeMs });
  } catch {
    // Worker unavailable (e.g. CSP or old browser) — fallback to sync on main thread
    pendingId = null;
    pendingCallback = null;
    try {
      callback(analyzePosition(fen, depth, maxTimeMs));
    } catch {
      callback(null);
    }
  }
}

/** Terminate the worker (call on app unmount if needed). */
export function terminateWorker(): void {
  worker?.terminate();
  worker = null;
  pendingId = null;
  pendingCallback = null;
}
