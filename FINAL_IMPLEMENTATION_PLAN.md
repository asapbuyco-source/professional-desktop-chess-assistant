# FINAL IMPLEMENTATION PLAN — Professional Desktop Chess Assistant

---

## PHASE 1: CRITICAL BUG FIXES

### Step 1: Fix Board.tsx TDZ Reference Error

In `src/components/Board.tsx`, move `const minSize = 200` from line 37 to above line 34 (before `setBoardSize(Math.max(minSize, maxSize))`). Move it outside the `handleResize` function body to module scope or to the top of the function.

**Verify:** Open the app in a browser. Board renders without `ReferenceError`. Resize window — board resizes correctly between min 200px and calculated max.

---

### Step 2: Fix Evaluation Perspective Display

In `src/engine.ts`, change line 191 from `const relativeEval = isWhiteTurn ? val : -val` to always return evaluation from White's perspective: `return val;` (remove the perspective flip). Remove the `isWhiteTurn` variable on line 184.

In `src/store.ts`, remove the `relativeEval` variable from `analyzePosition` usage — the evaluation is now always from White's perspective.

In `src/components/RightPanel.tsx`, ensure evaluation display is labeled clearly: add text "White's perspective" or use color coding where green = White advantage, red = Black advantage. In `EvalBar`, the bar fills from bottom (Black) to top (White). Positive values = White advantage. This now aligns consistently.

In `src/App.tsx`, pass `engineAnalysis` to `EvalBar` without perspective transformation.

**Verify:** Play as Black. When Black is winning, eval bar shows Black advantage (bar fills toward Black's side). Evaluation number displays as negative (from White's perspective). Colors are unambiguous.

---

### Step 3: Fix Mobile Sidebar Toggle

In `src/App.tsx`:
1. Remove `showMobileMenu` state variable (line 12).
2. The hamburger button `onMenuClick` already toggles `sidebarOpen` — connect it: `<TopBar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />`.
3. The mobile overlay `<div>` on line 89-91 should set `sidebarOpen = false` on click.
4. For desktop (`md:` and above), panels should always be visible regardless of `sidebarOpen`. Use `md:!flex` or `md:!block` to override mobile hiding.
5. For mobile, add transition animation: panels slide in/out with `transform: translateX`.

**Verify:** On mobile viewport (375px wide), tap hamburger → left panel appears. Tap again or tap overlay → left panel disappears. On desktop, panels are always visible.

---

### Step 4: Remove Duplicate CSS

In `src/index.css`:
1. Delete lines 103–147 (the first `.keypad-btn` block, `:hover`, `:active`, `:disabled`, `.neon-text`, `.thinking-indicator`, and `@keyframes pulse`).
2. Keep lines 221–311 (the second `.keypad-btn` block with `.active`, `.action`, `.danger` variants, `.neon-text`, `.thinking-indicator`, `@keyframes thinking-pulse`, `.eval-bar`, `@keyframes pulse-glow`, `.slide-in`, `.move-highlight`, `.last-move-highlight`, `.check-highlight`).
3. After deletion, verify no class definitions are orphaned: search for `.keypad-btn`, `.neon-text`, `.thinking-indicator`, `.eval-bar`, `.slide-in` in all `*.tsx` and `*.css` files.
4. Remove unused `@keyframes pulse` definition if not referenced by any remaining `.thinking-indicator` rule.

**Verify:** Keypad buttons render with gradient backgrounds, hover effects show green glow. `.neon-text` renders with green shadow. Thinking indicator pulses.

---

### Step 5: Deduplicate Analysis Invocation

In `src/store.ts`:
1. At module level, create:

```
function scheduleAnalysis(game: Chess, depth: number, settings: GameSettings) {
  set({ isAnalyzing: true });
  setTimeout(() => {
    try {
      const analysis = analyzePosition(game.fen(), depth);
      const arrows = getAnalysisArrows(analysis, settings.showArrows);
      set({ engineAnalysis: analysis, isAnalyzing: false, customArrows: arrows });
    } catch {
      set({ isAnalyzing: false });
    }
  }, 50);
}
```

2. Replace all 7 duplicated `setTimeout` + `analyzePosition` blocks (in `makeMove`, `undoMove`, `redoMove`, `newGame`, `importPgn`, `importFen`, `analyze`) with `scheduleAnalysis(get().game, get().engineDepth, get().settings)`.

3. Remove the `set({ isAnalyzing: true })` calls that now exist inside `scheduleAnalysis`.

**Verify:** `npm run type-check` passes. Make a move, undo, redo — analysis updates after each action with no console errors.

---

## PHASE 2: ENGINE IMPROVEMENTS

### Step 6: Add Quiescence Search to Engine

In `src/engine.ts`:
1. Add a `quiescence` function below `evaluate`:

```
function quiescence(game: Chess, alpha: number, beta: number, nodes: { count: number }): number {
  nodes.count++;
  const standPat = evaluate(game);
  if (standPat >= beta) return beta;
  if (alpha < standPat) alpha = standPat;
  const moves = game.moves({ verbose: true }).filter(m => m.captured);
  for (const m of moves) {
    game.move(m.san);
    const score = quiescence(game, -beta, -alpha, nodes);
    game.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}
```

2. In `minimax`, replace `return evaluate(game)` (line 121) with `return quiescence(game, -Infinity, Infinity, nodes)`.

3. Adjust `minimax` to use negamax style for clarity: the quiescence call should negate properly for the current player.

**Verify:** Test positions: (a) a position where a queen captures a pawn but is recaptured — engine should not evaluate as +850; (b) a position with a hanging piece — quiescence should see the recapture.

---

### Step 7: Add Iterative Deepening with Time Control

In `src/engine.ts`:
1. Modify `analyzePosition` to perform iterative deepening from depth 1 up to the requested depth:

```
export function analyzePosition(fen: string, maxDepth: number, maxTimeMs: number = 5000): EngineAnalysis {
  const game = new Chess(fen);
  if (game.isGameOver()) { /* already handled */ }

  const startTime = Date.now();
  let bestResult: EngineAnalysis | null = null;

  for (let d = 1; d <= maxDepth; d++) {
    const elapsed = Date.now() - startTime;
    if (elapsed > maxTimeMs * 0.8) break;
    const nodes = { count: 0 };
    const result = searchRoot(game, d, nodes);
    if (result) bestResult = result;
  }
  return bestResult || fallbackResult(game);
}
```

2. Extract `searchRoot` from the current root-level loop in `analyzePosition`.

3. The UI should display the best result found so far (depth 1, then depth 2, etc.) immediately, updating as deeper results arrive.

4. In `src/store.ts`, update `scheduleAnalysis` to pass the time limit (default 3000ms for depth ≤ 3, 5000ms for depth 4).

**Verify:** Set depth to 4. Analysis should show results within 0.5 seconds (depth 1 or 2), then update with deeper results. UI should not freeze for more than 100ms at a time.

---

### Step 8: Improve Evaluation — King Safety and Mobility

In `src/engine.ts`:
1. Add king safety evaluation:

```
const KING_PENALTY = { openFile: -15, noPawnShield: -30 };
```

2. In `evaluate`, after the material + PST loop, add a king safety check:
   - Find both kings.
   - For each king: check if pawns are in front (pawn shield). If no pawn shield, apply penalty.
   - Check if the file in front of the king is open (no pawns of either color). If open, apply penalty.

3. Weight the mobility bonus (currently `mobility * 3`) based on game phase: higher in middlegame, lower in endgame. Determine game phase by total material remaining.

**Verify:** Test a position where the king has no pawn shield vs. a castled king. The evaluation should favor the castled position by approximately 30-50 centipawns.

---

## PHASE 3: MOVE QUALITY FEEDBACK

### Step 9: Add Blunder/Mistake Detection to Store

In `src/store.ts`:
1. Add to the store state: `lastMoveEval: number | null` (evaluation before the last move) and `moveAnnotations: Record<number, { symbol: string; evalDelta: number }>` (move number → annotation data).

2. In `makeMove`, before calling `game.move()`, compute and save the current evaluation: `const evalBefore = get().engineAnalysis?.evaluation ?? 0`. After the move and analysis completes, compute `evalAfter = analysis.evaluation`. Calculate `delta = evalAfter - evalBefore` (adjusted for side-to-move). Assign annotation:
   - `|delta| >= 200`: `??` (blunder)
   - `|delta| >= 100`: `?` (mistake)  
   - `|delta| >= 50` but move is best: `!` (good)
   - Move evaluation matches top move within 20cp: `!` (good)
   - Move evaluation matches top move exactly: `!!` (brilliant) — only if no other move is within 10cp
   - Otherwise: no annotation

3. Store the annotation in `moveAnnotations` keyed by move number (half-move count from history).

4. In `undoMove`, `newGame`, `importPgn`, `importFen`: clear `moveAnnotations`.

**Verify:** Make a clearly bad move (e.g., move a piece to a square where it can be captured). The move should be annotated with `?` or `??`. Make the engine's best move — it should be annotated `!` or `!!`.

---

### Step 10: Display Annotations in Move History

In `src/components/LeftPanel.tsx`:
1. Import `moveAnnotations` from the store.
2. When rendering each move in `movePairs`, check if `moveAnnotations` has an entry for that move number.
3. If so, append the annotation symbol (`!!`, `!`, `?`, `??`) after the move text, styled in color:
   - `!!`: bold green
   - `!`: green
   - `?`: orange/amber
   - `??`: red

4. Below the move list, add a small legend explaining the symbols.

**Verify:** Play a game. Good moves show `!` in green. Blunders show `??` in red. Move history is annotated and readable.

---

### Step 11: Add "What If" Preview Analysis

In `src/store.ts`:
1. Add `previewAnalysis: EngineAnalysis | null` to store state.
2. Add `previewMove(from: string, to: string): void` action:
   - Temporarily play the move with `game.move({ from, to, promotion: 'q' })`.
   - Run `analyzePosition(game.fen(), engineDepth)` synchronously (or via quick 1-depth preview).
   - Store result in `previewAnalysis`.
   - `game.undo()` to restore the position.

3. Add `clearPreview(): void` action that sets `previewAnalysis` to null.

4. In `src/components/Board.tsx`, when a square is selected (`selectedSquare` is set) and the user hovers over a highlighted legal move square, call `previewMove(selectedSquare, hoveredSquare)`.

5. In `src/components/RightPanel.tsx`, if `previewAnalysis` is set, show the preview evaluation below the main evaluation with a label "Preview:" and the move SAN.

6. On mouse leave from the board / on deselect, call `clearPreview()`.

**Verify:** Select a piece. Hover over a legal move square. The eval bar and right panel update to show what the evaluation would be after that move. Move the mouse away — preview disappears, original evaluation restores.

---

## PHASE 4: ENGINE TO WEB WORKER

### Step 12: Create Engine Worker

1. Create `src/engine.worker.ts`:
   - Import `Chess` from `chess.js`.
   - Copy `PIECE_VALUES`, `PST`, `evaluate`, `quiescence`, `minimax`, and the root-level search logic from `engine.ts`.
   - Add `onmessage = (e) => { const { fen, depth, maxTimeMs, requestId } = e.data; ... compute analysis ... postMessage({ analysis, requestId }); }`.

2. Create `src/engine.worker.types.ts`:
   - Define the message protocol: `{ type: 'analyze', fen: string, depth: number, maxTimeMs: number, requestId: number }` → `{ type: 'result', analysis: EngineAnalysis, requestId: number }`.

3. In `src/engine.ts`:
   - Keep `getLegalMoves` and `getLegalMovesForPiece` (these are fast, stay on main thread).
   - Remove `analyzePosition`, `minimax`, `evaluate`, `quiescence`, `PIECE_VALUES`, `PST`.
   - Export a new `createEngineWorker(): Worker` function.

4. In `src/store.ts`:
   - Create a module-level worker instance: `let worker: Worker | null = null; let analysisRequestId = 0;`
   - Modify `scheduleAnalysis`:
     - Increment `analysisRequestId`.
     - If worker exists, terminate it. Create new worker.
     - Post message `{ type: 'analyze', fen: game.fen(), depth, maxTimeMs, requestId: analysisRequestId }`.
     - On `worker.onmessage`, check `requestId === analysisRequestId`. If stale, discard. If current, update state.
   - On `newGame`, `importPgn`, `importFen`: terminate existing worker before creating new one.

**Verify:** Make a move. Analysis appears after 0.5-2 seconds. UI remains responsive during analysis (can click buttons, type). Make another move while analysis is running — stale result is discarded, new result appears.

---

## PHASE 5: CHESS CORRECTNESS

### Step 13: Add Promotion with Under-Promotion

In `src/store.ts`:
1. Add `pendingPromotion: { from: string; to: string } | null` to store state, initialized to `null`.

2. In `makeMove`, detect if a pawn is moving to the 8th/1st rank:
   - If `move` is a string (SAN): if `game.moves({ verbose: true })` filtered by matching SAN returns moves with `promotion` field, and `move` doesn't specify promotion, set `pendingPromotion` to `{ from, to }` and return with `selectedSquare` cleared but no move made.
   - If `move` is an object `{ from, to }`: if the piece at `from` is a pawn and `to` includes rank 8/1, and no `promotion` is specified, set `pendingPromotion` and return false.

3. Add `completePromotion(piece: string): boolean` action:
   - Get `pendingPromotion.from` and `pendingPromotion.to`.
   - Call `makeMove({ from, to, promotion: piece })`.
   - Set `pendingPromotion` to null.

4. In `Board.tsx` `onPieceDrop`: if the dropped piece is a pawn reaching the back rank, default to `'q'` for now (backward compatible).

5. Create `src/components/PromotionDialog.tsx`:
   - Render when `pendingPromotion !== null`.
   - Show 4 buttons: Queen, Rook, Bishop, Knight (with piece symbols).
   - On click, call `completePromotion(pieceType)`.
   - Overlay prevents interaction with the board.

6. Render `PromotionDialog` in `App.tsx`.

**Verify:** Play e2-e4, ...e7-e5, ... and advance a pawn to the 8th rank. Promotion dialog appears. Select knight. Pawn becomes a knight. Under-promotion works correctly for all four pieces.

---

### Step 14: Fix Redo Stack

In `src/store.ts`:
1. Change `redoStack` type from `string[]` to `Array<{ from: string; to: string; promotion?: string }>`.

2. In `undoMove`, store:

```
undoResult = game.undo();
// game.undo() returns { from, to, promotion?, san, ... }
redoStack: [...state.redoStack, { from: undoResult.from, to: undoResult.to, promotion: undoResult.promotion }]
```

3. In `redoMove`, read the last redo entry and call:

```
game.move({ from: entry.from, to: entry.to, promotion: entry.promotion })
```

instead of `game.move(san)`.

**Verify:** Undo then redo a knight move where two knights can reach the same square (ambiguous SAN). Verify the correct knight moves.

---

### Step 15: Fix Keyboard Shortcut Scope

In `src/App.tsx`, modify `handleKeyDown`:
1. Check `e.target` before processing shortcuts:
   - If `e.target` is an `<input>`, `<textarea>`, or `<select>`, skip `Ctrl+Z`, `Ctrl+Shift+Z`, `Ctrl+N` and `Ctrl+F` handlers.
   - Only process shortcuts when `e.target === document.body` or `e.target` is a `<div>` element.

**Verify:** Open Import Modal. Type in the textarea. Press Ctrl+Z. Text input's undo fires (not game undo). Press Ctrl+N outside modal. New game starts. Ctrl+N inside modal textarea. New browser window opens (browser default).

---

## PHASE 6: OTHER BUG FIXES

### Step 16: Fix Dual engineDepth Authority

In `src/store.ts`:
1. Remove the top-level `engineDepth` property (line 22).
2. Use `settings.engineDepth` as the single source of truth throughout the store.
3. In `scheduleAnalysis`, read depth from `get().settings.engineDepth`.
4. In `RightPanel.tsx`, read `settings.engineDepth` instead of `engineDepth`.
5. Remove `setEngineDepth` action — instead, use `updateSettings({ engineDepth: depth })` which triggers re-analysis.
6. Update `updateSettings` to trigger analysis when `engineDepth` changes: if `s.engineDepth !== state.settings.engineDepth`, call `get().analyze()` after updating settings.

**Verify:** Change depth slider in Settings modal. Analysis re-runs at new depth. No desynchronization between display and actual depth.

---

### Step 17: Fix Custom Arrows Overwrite

In `src/store.ts`:
1. Add `userArrows: [string, string, string][]` to store state, initialized to `[]`.
2. In `Board.tsx`, when `react-chessboard` reports a user-drawn arrow (via the `onArrowsChanged` callback or by intercepting custom arrow draws), store it in `userArrows`.
3. In `scheduleAnalysis`, merge `userArrows` with engine arrows instead of replacing: `const arrows = [...getAnalysisArrows(analysis, settings.showArrows), ...get().userArrows]`.
4. In `newGame`, `importPgn`, `importFen`, clear `userArrows` alongside `customArrows`.

**Verify:** Draw an arrow on the board. Make a move. Engine analysis arrows appear. Your drawn arrow is still visible. Start a new game — all arrows cleared.

---

### Step 18: Add Input Validation to PGN/FEN Import

In `src/store.ts`:
1. Add constants: `const MAX_PGN_LENGTH = 1_000_000; const MAX_FEN_LENGTH = 500;`
2. In `importPgn`: if `pgn.length > MAX_PGN_LENGTH`, set `importError` state to "PGN too long (max 1MB)" and return false.
3. In `importFen`: if `fen.length > MAX_FEN_LENGTH`, set `importError` state to "FEN too long (max 500 chars)" and return false.
4. Add `importError: string | null` to store state.
5. In `TopBar.tsx ImportModal`: display `importError` from the store when non-null, below the textarea.

**Verify:** Paste a 2MB string into PGN import. See "PGN too long" error message. Paste a valid PGN — imports successfully.

---

### Step 19: Remove Unused Google Fonts Preconnect

In `index.html`, remove `<link rel="preconnect" href="https://fonts.googleapis.com" />` (line 30).

**Verify:** Load the app. No network request to `fonts.googleapis.com` in DevTools Network tab.

---

### Step 20: Fix PWA Manifest `action=new` Handler

In `src/App.tsx`:
1. Add a `useEffect` that reads `window.location.search` on mount.
2. If `new URLSearchParams(window.location.search).get('action') === 'new'`, call `useChessStore.getState().newGame()`.
3. Clear the query parameter using `window.history.replaceState({}, '', window.location.pathname)`.

**Verify:** Navigate to `/?action=new`. App loads and starts a new game. URL changes to `/`.

---

## PHASE 7: CSS AND LAYOUT CLEANUP

### Step 21: Fix Inline Style Width Overrides

1. In `src/components/RightPanel.tsx`, replace `style={{ width: 260 }}` with `style={{ width: 'var(--panel-width)' }}`.
2. In `src/components/LeftPanel.tsx`, replace `style={{ width: 230 }}` with `style={{ width: 'var(--panel-width)' }}`.
3. In `src/components/LeftPanel.tsx`, replace `style={{ maxHeight: 400 }}` with `style={{ maxHeight: '60vh' }}`.
4. Ensure `var(--panel-width)` is correctly defined in `index.css` `:root` section (already exists as `260px`).

**Verify:** Panels use CSS variable width. Resize window to tablet breakpoints — panels shrink according to `--panel-width` media queries.

---

### Step 22: Unify Piece Value Display Scale

1. Create `src/utils/pieceValues.ts`:

```
export const DISPLAY_PIECE_VALUES: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
export const ENGINE_CENTIPEWN_SCALE = 100;
export function formatEval(centipawns: number, isMate: boolean, mateIn: number | null): string {
  if (isMate && mateIn !== null) return `${mateIn > 0 ? '+' : '-'}M${Math.abs(mateIn)}`;
  return `${centipawns >= 0 ? '+' : ''}${(centipawns / ENGINE_CENTIPEWN_SCALE).toFixed(2)}`;
}
```

2. In `LeftPanel.tsx`, replace the inline `valMap` with `DISPLAY_PIECE_VALUES`.
3. In `RightPanel.tsx`, replace the inline eval formatting with `formatEval()`.

**Verify:** Material advantage shows "+3" (pawn units). Engine eval shows "+1.50" (pawn units). Scales are labeled and consistent.

---

## PHASE 8: SOUND AND SETTINGS

### Step 23: Wire Up Sound Settings

1. Create `src/utils/sound.ts`:

```
let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}
export function playSound(type: 'move' | 'capture' | 'error'): void {
  /* Play a short tone: move=440Hz 50ms, capture=660Hz 80ms, error=220Hz 120ms */
  /* Use OscillatorNode + GainNode from Web Audio API */
  /* Resume AudioContext on first user gesture */
}
```

2. In `src/store.ts`, add sound calls in `makeMove` (on success, check if move was a capture), `undoMove`, and `importPgn`/`importFen` (on error). Guard each call with `if (!get().settings.soundEnabled) return;`.

3. In `src/components/Keypad.tsx`, conditionally render the microphone button based on `settings.voiceEnabled`: `{settings.voiceEnabled && <button onClick={toggleVoice} ...>...</button>}`.

4. On first user interaction (first move, first click), call `getCtx().resume()` to unlock the AudioContext.

**Verify:** Toggle sound ON in settings. Make a move — hear a short tone. Capture a piece — hear a different tone. Toggle sound OFF — no sounds. Toggle voice OFF — microphone button disappears.

---

## PHASE 9: INFRASTRUCTURE

### Step 24: Extract Service Worker Registration

1. Create `public/register-sw.js`:

```
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
```

2. In `index.html`, replace the inline `<script>` block (lines 38-46) with: `<script src="/register-sw.js"></script>`.

3. In `nginx.conf` line 49, change CSP `script-src` to: `script-src 'self' 'wasm-unsafe-eval'` (no change needed — `'self'` already allows `/register-sw.js` as it's a same-origin script file).

4. In `Caddyfile` line 13 and `netlify.toml` CSP header: same, no change needed.

5. In `public/sw.js`, add `/register-sw.js` to `urlsToCache` array.

**Verify:** Open DevTools > Application > Service Workers. SW registers successfully. No CSP violation errors in console.

---

### Step 25: Generate PWA Icons and Fix Manifest

1. Create `public/icons/icon-192.png` (192x192 PNG) and `public/icons/icon-512.png` (512x512 PNG) from the existing ♟ emoji design on a dark (#07070d) background.

2. In `public/manifest.json`, add:

```
"icons": [
  { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
]
```

3. In `public/sw.js`, add `/icons/icon-192.png` and `/icons/icon-512.png` to `urlsToCache`.

**Verify:** Lighthouse PWA audit scores ≥ 80 on "Installable" criterion.

---

### Step 26: Add .dockerignore

Create `.dockerignore`:

```
node_modules
dist
.git
.env*.local
.vscode
.idea
src
public
*.md
AUDIT_STRUCTURING_REPORT.md
LONG_CONTEXT_ANALYSIS.md
CRITICAL_REVIEW.md
FINAL_IMPLEMENTATION_PLAN.md
```

Note: `src` and `public` are included because the Dockerfile runs `npm run build` which reads from these directories via the build context. They should NOT be in `.dockerignore` since they are needed for the build. Only exclude truly unnecessary files.

Corrected `.dockerignore`:

```
node_modules
.git
.env*.local
.vscode
.idea
*.md
!README.md
docker-compose.yml
```

**Verify:** Run `docker build .`. Image builds successfully with reduced size.

---

### Step 27: Fix CORS Wildcard in nginx.conf

In `nginx.conf`, replace line 66 `add_header Access-Control-Allow-Origin "*" always;` with:

```
add_header Access-Control-Allow-Origin "https://chess-assistant.example.com" always;
```

Use a placeholder domain. For local development, this header is not served (Vite dev server handles CORS).

**Verify:** Deploy to nginx. `curl -I https://domain/static/main.js` shows `Access-Control-Allow-Origin: https://chess-assistant.example.com`.

---

## DEPENDENCY MAP

```
Step 1 ─── (no deps)
Step 2 ─── (no deps)
Step 3 ─── (no deps)
Step 4 ─── (no deps)
Step 5 ─── (no deps)
Step 6 ─── depends on Step 5 (modifies engine analysis path)
Step 7 ─── depends on Step 6 (modifies engine search)
Step 8 ─── depends on Step 7 (adds to evaluate function)
Step 9 ─── depends on Step 5 (modifies store analysis flow)
Step 10 ── depends on Step 9 (reads moveAnnotations from store)
Step 11 ── depends on Step 5 (uses scheduleAnalysis for preview)
Step 12 ── depends on Steps 5, 6, 7, 8 (moves finalized engine to worker)
Step 13 ── depends on Step 5 (modifies makeMove flow)
Step 14 ── depends on Step 13 (redo stack change must be after promotion)
Step 15 ── (no deps)
Step 16 ── depends on Step 5 (modifies engineDepth access)
Step 17 ── (no deps)
Step 18 ── (no deps)
Step 19 ── (no deps)
Step 20 ── (no deps)
Step 21 ── (no deps)
Step 22 ── (no deps)
Step 23 ── (no deps)
Step 24 ── (no deps)
Step 25 ── depends on Step 24 (SW must work first)
Step 26 ── (no deps)
Step 27 ── (no deps)
```

## PARALLEL EXECUTION GROUPS

Group A (can run simultaneously): Steps 1, 2, 3, 4, 5, 15, 17, 18, 19, 20, 21, 22, 24, 26, 27

Group B (after Group A): Steps 6, 9, 13, 16

Group C (after Group B): Steps 7, 10, 14

Group D (after Group C): Steps 8, 11

Group E (after Group D): Step 12

Group F (after Group E): Steps 23, 25