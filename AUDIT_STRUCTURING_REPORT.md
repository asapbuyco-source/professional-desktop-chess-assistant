# Structured Audit Report — Professional Desktop Chess Assistant

**Date:** 2026-05-07  
**Codebase Version:** 1.0.0  
**Auditor:** Automated Code Audit System  
**Stack:** React 19.2.3 · TypeScript 5.9.3 · Vite 7.3.2 · Zustand 5.0.13 · chess.js 1.4.0 · Tailwind CSS 4.1.17

---

## 1. SYSTEM OVERVIEW

### 1.1 Purpose

A client-side single-page application providing local chess engine analysis (minimax with alpha-beta pruning), game management (PGN/FEN import/export, move history), and a professional dark-themed UI. All computation occurs in-browser — no backend server is required.

### 1.2 Key Components

| Component | File(s) | Responsibility |
|---|---|---|
| **App Shell** | `src/App.tsx` | Root layout, keyboard shortcuts, sidebar toggle |
| **Board** | `src/components/Board.tsx` | Chess board rendering via `react-chessboard`, drag-and-drop |
| **Keypad** | `src/components/Keypad.tsx` | Move input (text, piece builder, voice), action buttons |
| **TopBar** | `src/components/TopBar.tsx` | Navigation bar, Import/Settings modals, clipboard |
| **LeftPanel** | `src/components/LeftPanel.tsx` | Opening name, move history, captured pieces |
| **RightPanel** | `src/components/RightPanel.tsx` + `EvalBar` | Engine analysis display, eval bar |
| **ErrorBoundary** | `src/components/ErrorBoundary.tsx` | Top-level React error boundary |
| **Zustand Store** | `src/store.ts` | All application state + game logic (559 lines) |
| **Engine** | `src/engine.ts` | Minimax search with piece-square tables, alpha-beta pruning |
| **Openings** | `src/openings.ts` | 67-opening database with prefix-match identification |
| **Types** | `src/types.ts` | Shared TypeScript interfaces |
| **Styles** | `src/index.css` | Global CSS, Tailwind import, component styles |
| **Service Worker** | `public/sw.js` | Cache-first PWA offline support |
| **Manifest** | `public/manifest.json` | PWA manifest (incomplete icons) |
| **Infra** | `Dockerfile`, `docker-compose.yml`, `nginx.conf`, `Caddyfile`, `netlify.toml` | Deployment configs for nginx, Caddy, Docker, Netlify |

### 1.3 Architecture Data Flow

```
User Input → Zustand Store → chess.js validation → Engine analysis (synchronous) → UI re-render
                     ↓
              setTimeout(analyzePosition, 50ms) → blocks main thread
```

---

## 2. ISSUES

### **ID: A-01**

- **Description:** CSP `script-src 'self'` blocks inline service worker registration script in `index.html:38-46`. The `<script>` tag without `src` attribute is inline, which violates the Content-Security-Policy delivered by `nginx.conf:49`, `Caddyfile:13`, and `netlify.toml`. The service worker will never register in production.
- **Root Cause:** Inline `<script>` block in `index.html` conflicts with `script-src 'self'` CSP directive. No nonce, hash, or `'unsafe-inline'` is configured.
- **Severity:** **Critical**
- **Files:** `index.html:38-46`, `nginx.conf:49`, `Caddyfile:13`, `netlify.toml` (CSP header)

---

### **ID: A-02**

- **Description:** The chess engine's `analyzePosition()` function (`src/engine.ts:163-218`) and `minimax()` function (`src/engine.ts:100-161`) execute synchronously on the main thread. At depth 4, complex positions freeze the browser for multiple seconds, preventing all user interaction.
- **Root Cause:** No Web Worker implementation. The entire minimax search runs in the same thread as React rendering and event handling. The `setTimeout(fn, 50)` wrapper in `store.ts` only defers execution — it does not make it non-blocking.
- **Severity:** **Critical**
- **Files:** `src/engine.ts:100-218`, `src/store.ts` (7 setTimeout calls at lines 160-168, 206-214, 248-257, 288-297, 487-495, 529-537, 549-557)

---

### **ID: A-03**

- **Description:** In `Board.tsx:34`, the variable `minSize` is referenced on line 34 before it is declared with `const` on line 37, both within the same `handleResize` function scope. Per ECMAScript specification, `const` and `let` declarations are hoisted but enter the Temporal Dead Zone (TDZ) before their declaration line, causing a `ReferenceError: Cannot access 'minSize' before initialization` at runtime.
- **Root Cause:** `const minSize = 200` is declared AFTER `setBoardSize(Math.max(minSize, maxSize))` which uses it, within the same function block.
- **Severity:** **Critical**
- **Files:** `src/components/Board.tsx:34-37`

---

### **ID: A-04**

- **Description:** The `sidebarOpen` state in `App.tsx:11` defaults to `true` and is never toggled by any UI element. The mobile hamburger menu button (`onMenuClick`) toggles `showMobileMenu` (line 49), but `showMobileMenu` only controls an overlay (line 89-91) — it does NOT control panel visibility. Panel visibility is controlled by `sidebarOpen` (lines 54-58, 79-83) which has no toggle mechanism. On mobile, panels are always visible, overlapping the board.
- **Root Cause:** `sidebarOpen` and `showMobileMenu` are two independent state variables with no connection. The mobile menu overlay dismisses but doesn't hide panels.
- **Severity:** **High**
- **Files:** `src/App.tsx:11-12, 49, 54-60, 79-85, 89-91`

---

### **ID: A-05**

- **Description:** The `Chess` instance from `chess.js` is stored directly in Zustand state (`store.ts:9, 94`) and mutated in-place via `game.move()`, `game.undo()`, etc. Zustand's immutibility contract is violated — the `game` object reference never changes, so React may not detect state changes. This works only because `fen`, `history`, and other fields also update, forcing re-renders. However, this is fragile: any code that depends on the `game` reference itself changing (e.g., `useEffect` dependencies on `game`) will not trigger.
- **Root Cause:** Zustand is designed for immutable state updates. The mutable `Chess` instance breaks this contract.
- **Severity:** **High**
- **Files:** `src/store.ts:9, 94, 131-175, 181-216, 224-260, 311, 340`

---

### **ID: A-06**

- **Description:** The `setTimeout(() => { try { analyzePosition(...) }... }, 50)` pattern is duplicated **7 times** across `store.ts` (lines 159-168, 206-214, 248-257, 288-297, 487-495, 529-537, 549-557). Each copy differs only in the preceding state-set call. This violates DRY and makes maintenance error-prone — if the analysis pattern needs to change, all 7 must be updated independently.
- **Root Cause:** No utility function for the "set isAnalyzing, defer analysis, update results" pattern.
- **Severity:** **High**
- **Files:** `src/store.ts` (7 locations)

---

### **ID: A-07**

- **Description:** All promotion moves are hardcoded to queen (`promotion: 'q'`). In `store.ts:311`, `Board.tsx:46`, and `Keypad.tsx`, there is no UI for under-promotion (rook, bishop, knight). This makes certain positions unplayable correctly (e.g., under-promotion to avoid stalemate or deliver checkmate).
- **Root Cause:** No promotion dialog or selection mechanism exists in the UI or store logic.
- **Severity:** **High**
- **Files:** `src/store.ts:311`, `src/components/Board.tsx:46`

---

### **ID: A-08**

- **Description:** PGN/FEN import via `importPgn()` and `importFen()` accepts arbitrary-length strings without validation or sanitization before passing to `chess.js`. While `chess.js` validates structure, a maliciously large input could cause performance issues or memory exhaustion on the client.
- **Root Cause:** No input length limits or sanitization before parsing.
- **Severity:** **Medium**
- **Files:** `src/store.ts:458-500`, `src/components/TopBar.tsx:12-23`

---

### **ID: A-09**

- **Description:** The `redoStack` stores SAN notation strings only (`store.ts:195`). When `redoMove()` replays a move using `game.move(san)` (line 224), SAN notation can be ambiguous in positions where multiple pieces of the same type can reach the same square. This could replay the wrong move in rare positions.
- **Root Cause:** Storing only SAN strings instead of verbose move objects `{from, to, promotion}`.
- **Severity:** **Medium**
- **Files:** `src/store.ts:195, 222-224`

---

### **ID: A-10**

- **Description:** `index.css` contains duplicated and conflicting CSS definitions:
  - `.keypad-btn` is fully defined at lines 103-128, then again with different values at lines 221-264 (the second definition includes `.active`, `.action`, `.danger` variants the first lacks).
  - `.neon-text` is defined at line 131-133 with `currentColor`, then overridden at lines 305-307 with explicit `rgba(0, 255, 136, ...)` colors.
  - `.thinking-indicator` animation is `pulse 2s` at line 137 but overridden to `thinking-pulse 1.2s` at line 281.
  - `@keyframes pulse` (line 140) and `@keyframes thinking-pulse` (line 275) both exist, creating confusion about which is used.
- **Root Cause:** CSS was likely written in two passes and not cleaned up; later definitions override earlier ones, making the first block dead code (~30% of the file).
- **Severity:** **Medium**
- **Files:** `src/index.css:103-128 vs 221-264, 131-133 vs 305-307, 136-138 vs 280-282`

---

### **ID: A-11**

- **Description:** `manifest.json` lacks a proper `icons` array with PNG files at required sizes (192x192, 512x512). Only `screenshots` are defined using data URI SVGs. Most browsers require actual icon files for PWA installation. The app will not be installable as a PWA.
- **Root Cause:** No PNG icon assets were generated. Only inline SVG data URIs are used.
- **Severity:** **Medium**
- **Files:** `public/manifest.json`

---

### **ID: A-12**

- **Description:** No `.dockerignore` file exists. The `Dockerfile` runs `COPY . .` on line 13, which includes `node_modules`, `.env` files, `.git` directory, and other unnecessary/sensitive files in the Docker build context. This increases image size and potentially exposes secrets.
- **Root Cause:** Missing `.dockerignore` configuration.
- **Severity:** **Medium**
- **Files:** `Dockerfile:13`

---

### **ID: A-13**

- **Description:** `LeftPanel.tsx:43` uses piece values (p=1, n=3, b=3, r=5, q=9) while `engine.ts:4-6` uses (p=100, n=320, b=330, r=500, q=900). The displayed material advantage uses the simpler scale, while the engine evaluation uses the centipawn scale. This creates inconsistency: a position showing "+3" material advantage may show "+3.20" in engine eval, causing user confusion about the scale.
- **Root Cause:** Two uncoordinated piece value tables exist with different scales.
- **Severity:** **Medium**
- **Files:** `src/components/LeftPanel.tsx:43`, `src/engine.ts:4-6`

---

### **ID: A-14**

- **Description:** The `settings.soundEnabled` and `settings.voiceEnabled` flags exist in the store (`store.ts:124-125`) and have toggle UI in the Settings modal (`TopBar.tsx:161-162`), but no code reads these values to enable/disable sound effects or control voice input visibility. The microphone button in Keypad is always visible (just hidden on mobile via `hidden md:block`), regardless of `voiceEnabled`.
- **Root Cause:** Incomplete feature implementation — settings are stored but not consumed.
- **Severity:** **Medium**
- **Files:** `src/store.ts:124-125`, `src/components/TopBar.tsx:161-162`, `src/components/Keypad.tsx:394-400`

---

### **ID: A-15**

- **Description:** `framer-motion` (~150KB gzipped) is imported in `Keypad.tsx`, `TopBar.tsx`, `RightPanel.tsx`, and `App.tsx` solely for simple fade/scale animations on modals and suggestion dropdowns. This is a large dependency for minimal animation value, and combined with `viteSingleFile` it adds significant weight to the single bundle.
- **Root Cause:** Using a heavy animation library for CSS transition-equivalent animations.
- **Severity:** **Medium**
- **Files:** `src/components/Keypad.tsx:2`, `src/components/TopBar.tsx:2`, `src/components/RightPanel.tsx:1`

---

### **ID: A-16**

- **Description:** The service worker (`sw.js`) uses a cache-first strategy for ALL GET requests (line 42), caches only 3 URLs on install (`/`, `/index.html`, `/manifest.json`), and has no cache versioning beyond `chess-assistant-v1`. When the app is updated, users with cached SW may continue serving stale files. The `skipWaiting()` + `clients.claim()` pattern helps but provides no user notification or force-update mechanism.
- **Root Cause:** No cache invalidation strategy, no version comparison, no update notification.
- **Severity:** **Medium**
- **Files:** `public/sw.js`

---

### **ID: A-17**

- **Description:** No test infrastructure exists. `package.json` has no `test` script, no testing framework dependency (Jest, Vitest, Playwright, etc.), and zero test files. The engine logic, store operations, and component behavior are entirely untested.
- **Root Cause:** No test framework was configured during project setup.
- **Severity:** **Medium**
- **Files:** `package.json` (missing test script and test dependencies)

---

### **ID: A-18**

- **Description:** No linter or formatter is configured. No ESLint, Prettier, Stylelint, or any code quality enforcement tool exists. The project has no `.eslintrc`, `.prettierrc`, or corresponding npm scripts.
- **Root Cause:** No linting/formatting configuration was added during project setup.
- **Severity:** **Medium**
- **Files:** `package.json` (missing lint/format scripts and dependencies)

---

### **ID: A-19**

- **Description:** `document.execCommand('copy')` in `TopBar.tsx:200` is deprecated per MDN and may be removed from browsers. It is used as a fallback for `navigator.clipboard.writeText()`, which is the correct modern API. However, the fallback path may fail silently in future browsers.
- **Root Cause:** Reliance on deprecated API as fallback.
- **Severity:** **Low**
- **Files:** `src/components/TopBar.tsx:190-204`

---

### **ID: A-20**

- **Description:** The Web Speech API typing in `Keypad.tsx:41-55` uses `window as unknown as Record<string, unknown>` and constructs a recognition object with inline type annotations. This bypasses TypeScript safety and will produce runtime errors in browsers that don't support the API (Firefox, Safari). No fallback or user-visible error message is provided.
- **Root Cause:** Missing proper TypeScript declarations for the Web Speech API, and no graceful degradation.
- **Severity:** **Low**
- **Files:** `src/components/Keypad.tsx:41-55`

---

### **ID: A-21**

- **Description:** `RightPanel.tsx:52` and `LeftPanel.tsx:88` use hardcoded inline style widths (`width: 260` and `width: 230` respectively). These override the CSS custom property `--panel-width` defined in `index.css:21`, making responsive adjustments via CSS variables ineffective.
- **Root Cause:** Inline styles take precedence over CSS variables.
- **Severity:** **Low**
- **Files:** `src/components/RightPanel.tsx:52`, `src/components/LeftPanel.tsx:88`

---

### **ID: A-22**

- **Description:** The `Keypad.tsx:402-415` "Execute" button calls `makeMove(moveInput)` directly with the raw text, while the "Submit" button (→) calls `submitMoveInput()` which validates and matches against legal moves. This creates inconsistent behavior: typing "e4" and pressing Execute may behave differently than pressing Submit.
- **Root Cause:** Two different code paths for move submission that aren't functionally equivalent.
- **Severity:** **Low**
- **Files:** `src/components/Keypad.tsx:252-258 vs 402-415`

---

### **ID: A-23**

- **Description:** The nginx `Access-Control-Allow-Origin: "*"` header on static assets (`nginx.conf:66`) is overly permissive. While this is a static client-side app with no API, the wildcard still allows any origin to hotlink resources.
- **Root Cause:** Overly broad CORS configuration.
- **Severity:** **Low**
- **Files:** `nginx.conf:66`

---

### **ID: A-24**

- **Description:** `ErrorBoundary.tsx:47-49` displays `error.toString()` and `errorInfo.componentStack` in a `<details>` element visible to all users. In production, this could expose internal paths, component names, and implementation details.
- **Root Cause:** No environment-conditional error display.
- **Severity:** **Low**
- **Files:** `src/components/ErrorBoundary.tsx:45-51`

---

### **ID: A-25**

- **Description:** The `Keypad.tsx` component is 419 lines with move input, piece selection, file/rank grid, special moves, voice recognition, action buttons, and suggestion dropdown all in one file. Similarly, `TopBar.tsx` (289 lines) contains `ImportModal`, `SettingsModal`, and `TopBar` itself. These should be decomposed for maintainability.
- **Root Cause:** Early development velocity prioritized over component decomposition.
- **Severity:** **Low**
- **Files:** `src/components/Keypad.tsx`, `src/components/TopBar.tsx`

---

### **ID: A-26**

- **Description:** The opening identification uses string prefix matching (`moveStr.startsWith(opening.moves)`) against 67 openings. This cannot handle transpositions (different move orders reaching the same position). For example, 1.d4 Nf6 2.c4 and 1.c4 Nf6 2.d4 reach the same position but would match different openings.
- **Root Cause:** Opening matching is string-based rather than position (FEN)-based.
- **Severity:** **Low**
- **Files:** `src/openings.ts:73-94`

---

### **ID: A-27**

- **Description:** The `openings.ts` `Opening` interface is not exported, making it inaccessible for type-safe extensions or testing from other modules.
- **Root Cause:** Interface defined with `interface` keyword without `export`.
- **Severity:** **Low**
- **Files:** `src/openings.ts:1-5`

---

### **ID: A-28**

- **Description:** `vite.config.ts:28` sets `manualChunks: undefined` which, combined with `viteSingleFile()`, bundles the entire application into a single HTML file. This eliminates browser caching benefits — any code change requires re-downloading the entire bundle.
- **Root Cause:** `viteSingleFile` plugin explicitly bundles everything into one file.
- **Severity:** **Low**
- **Files:** `vite.config.ts:13, 28`

---

### **ID: A-29**

- **Description:** `PieceType` in `types.ts:28` uses uppercase letters (`'K' | 'Q' | 'R' | 'B' | 'N' | 'P'`) while `chess.js` uses lowercase piece types (`'k' | 'q' | 'r' | 'b' | 'n' | 'p'`). The conversion is handled in `store.ts` via `typeMap` (line 233-236) and `engine.ts` `getLegalMovesForPiece()` (line 233-236), but this dual representation is a source of potential bugs.
- **Root Cause:** Custom `PieceType` enum doesn't align with `chess.js` conventions.
- **Severity:** **Low**
- **Files:** `src/types.ts:28`, `src/store.ts:233-236`, `src/engine.ts:233-236`

---

### **ID: A-30**

- **Description:** The `analyze()` function and all callers that trigger analysis have no debouncing or cancellation mechanism. Rapid sequential actions (e.g., clicking undo multiple times quickly) queue multiple `setTimeout(analyzePosition, 50)` calls that each block the main thread sequentially. Only the last result is visible, but all must complete.
- **Root Cause:** No `AbortController` or debounce mechanism for engine analysis.
- **Severity:** **Medium** (compounds with A-02)
- **Files:** `src/store.ts:159-168, 206-214, 248-257, 288-297, 446-448, 487-495, 529-537, 549-557`

---

## 3. IMPROVEMENT STRATEGY

### A-01: Fix CSP to Allow Service Worker Registration

**Approach:** Extract the inline `<script>` from `index.html` into a separate file `public/register-sw.js` and reference it with `<script src="/register-sw.js">`. This eliminates the need for `'unsafe-inline'` in the CSP `script-src` directive. Update all three CSP configurations (nginx, Caddy, Netlify) consistently.

### A-02: Move Engine to Web Worker

**Approach:** Create `src/engine.worker.ts` that wraps the `analyzePosition` function in a Web Worker. The main thread posts `{fen, depth}` messages and receives `EngineAnalysis` responses. Replace all 7 `setTimeout` calls in `store.ts` with `worker.postMessage()` and `worker.onmessage` handlers. This eliminates main-thread blocking entirely. Add cancellation support by killing/restarting the worker when a new analysis is requested before the previous one completes.

### A-03: Fix `minSize` TDZ Reference Error

**Approach:** Move `const minSize = 200` to before its usage on line 34, or declare it outside the `handleResize` function as a module-level constant.

### A-04: Connect Mobile Sidebar Toggle

**Approach:** Replace `showMobileMenu` state with `sidebarOpen` for panel visibility, or add a handler connecting them. When `onMenuClick` fires, toggle `sidebarOpen`. The overlay should also dismiss panels when clicked.

### A-05: Immutable Chess State

**Approach:** Stop storing the mutable `Chess` instance in Zustand. Instead, store only the FEN string and derive the `Chess` instance on demand. Alternatively, use Zustand's `immer` middleware to ensure the `game` reference changes on every update. The cleanest approach: store `fen` as the source of truth, create `new Chess(fen)` in each action method, and do NOT persist `game` in the store at all.

### A-06: Extract Analysis Helper

**Approach:** Create a helper function in `store.ts`:

```typescript
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

Replace all 7 duplicated blocks with `scheduleAnalysis(game, engineDepth, settings)`.

### A-07: Add Promotion Dialog

**Approach:** Add a `pendingPromotion` state to the store (`{from, to} | null`). When a pawn move reaches the 8th/1st rank without specifying promotion, set `pendingPromotion` instead of auto-promoting. Create a `PromotionDialog` component that renders queen/rook/bishop/knight options. On selection, complete the move with the chosen promotion piece.

### A-08: Input Length Limits

**Approach:** Add validation in `importPgn` and `importFen` to reject inputs exceeding reasonable lengths (e.g., 1MB for PGN, 500 chars for FEN) before passing to `chess.js`.

### A-09: Store Verbose Move Objects in Redo Stack

**Approach:** Change `redoStack` from `string[]` to `Array<{from: string, to: string, promotion?: string}>` and store the verbose move data from `game.undo()` instead of just the SAN string. Update `redoMove()` to use `{from, to, promotion}` format.

### A-10: Remove Duplicate CSS

**Approach:** Delete the first set of duplicate definitions (lines 103-147): the initial `.keypad-btn`, `:hover`, `:active`, `:disabled`, `.neon-text`, `.thinking-indicator`, and `@keyframes pulse`. Keep the second, more complete set. Update `.thinking-indicator` to reference `thinking-pulse` only.

### A-11: Add Proper PWA Icons

**Approach:** Generate 192x192 and 512x512 PNG icons (from the existing SVG design) and add an `icons` array to `manifest.json`. Reference the icons from `public/icons/`.

### A-12: Add `.dockerignore`

**Approach:** Create `.dockerignore` excluding `node_modules`, `.git`, `.env.*`, `dist`, `*.md`, and other non-essential files.

### A-13: Unify Piece Values

**Approach:** Define `PIECE_DISPLAY_VALUES` in `types.ts` or a shared constants file and use it in both `LeftPanel.tsx` and any display logic. Keep the engine's centipawn values separate but ensure the display scales consistently (divide by 100 for pawn units or show raw centipawn values).

### A-14: Wire Up Sound and Voice Settings

**Approach:** In `Keypad.tsx`, conditionally show/hide the microphone button based on `settings.voiceEnabled`. Create a simple audio feedback module that reads `settings.soundEnabled` and plays move/capture/error sounds using the Web Audio API.

### A-15: Replace framer-motion with CSS Transitions

**Approach:** Replace `<motion.div>` and `<AnimatePresence>` with CSS `transition` properties and conditional rendering with state-driven classes. This removes ~150KB from the bundle.

### A-16: Improve Service Worker Cache Strategy

**Approach:** Use `workbox-webpack-plugin` or implement cache-busting based on a version hash. On `activate`, delete old caches. On `fetch`, use stale-while-revalidate for app shell and cache-first for static assets. Add a "Update available" notification.

### A-17: Add Test Infrastructure

**Approach:** Install Vitest (`npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom`). Add a `test` script to `package.json`. Write unit tests for `engine.ts`, `store.ts` state transitions, and `openings.ts`. Write component tests for `Board.tsx`, `Keypad.tsx`.

### A-18: Add ESLint and Prettier

**Approach:** Install `eslint`, `@typescript-eslint/*`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `prettier`, and configure them. Add `lint` and `format` scripts to `package.json`.

---

## 4. IMPLEMENTATION PLAN

### Step 1: Fix Critical Bug — Board.tsx TDZ Error

**Action:** Move `const minSize = 200` above line 34 in `src/components/Board.tsx`, or extract it to module scope.
**Verification:** Run `npm run type-check` and open the app in browser. Board should render without ReferenceError.
**Duration:** 5 minutes

---

### Step 2: Fix Critical Bug — CSP Blocking Service Worker

**Action:**
1. Create `public/register-sw.js` with the SW registration logic extracted from `index.html`.
2. Replace inline `<script>` in `index.html` with `<script type="module" src="/register-sw.js"></script>`.
3. Update `nginx.conf`, `Caddyfile`, and `netlify.toml` CSP headers: `script-src 'self' 'wasm-unsafe-eval'` (no `'unsafe-inline'` needed since script is now external).
4. Add `register-sw.js` to the SW `urlsToCache` list in `sw.js`.
**Verification:** Deploy and verify SW registration works. Check browser DevTools > Application > Service Workers for successful registration.
**Duration:** 30 minutes

---

### Step 3: Fix Bug — Connect Mobile Sidebar Toggle

**Action:** In `src/App.tsx`:
1. Remove `showMobileMenu` state.
2. Change `onMenuClick` to toggle `sidebarOpen`.
3. When `sidebarOpen === false` on mobile, hide left and right panels.
4. Overlay click should set `sidebarOpen = false`.
5. Desktop view should always show panels.
**Verification:** On mobile viewport, tap hamburger → panels appear/disappear. Overlay click dismisses.
**Duration:** 20 minutes

---

### Step 4: Remove Duplicate CSS

**Action:** In `src/index.css`:
1. Delete lines 103-147 (first `.keypad-btn`, `:hover`, `:active`, `:disabled`, `.neon-text`, `.thinking-indicator`, `@keyframes pulse`).
2. Verify the remaining definitions (lines 221-311 in original) contain all needed styles.
3. Ensure `.thinking-indicator` references `thinking-pulse` animation.
**Verification:** Visual regression check — keypad buttons, neon text, thinking indicator should render correctly.
**Duration:** 15 minutes

---

### Step 5: Extract Analysis Helper Function

**Action:**
1. In `src/store.ts`, create function `scheduleAnalysis(game: Chess, depth: number, settings: GameSettings)` at module level.
2. Replace all 7 duplicated `setTimeout` analysis blocks with `scheduleAnalysis(game, depth, settings)`.
3. Remove the now-redundant `set({ isAnalyzing: true })` calls that precede each block (they're now inside the helper).
**Verification:** `npm run type-check` passes. Behavior unchanged — analysis still triggers after each move/undo/redo/import/newgame.
**Duration:** 20 minutes

---

### Step 6: Move Engine to Web Worker

**Action:**
1. Create `src/engine.worker.ts` — transfer `analyzePosition`, `minimax`, `evaluate`, `PIECE_VALUES`, `PST` from `engine.ts`.
2. Set up `onmessage` handler to receive `{fen, depth}` and respond with `EngineAnalysis`.
3. In `src/store.ts`, create a singleton `Worker` instance on module load.
4. Replace `scheduleAnalysis` to post messages to the worker and handle responses via `onmessage`.
5. Add cancellation: when a new analysis is requested, terminate the pending response.
6. Export `getLegalMoves` and `getLegalMovesForPiece` from `engine.ts` (these stay on the main thread as they are fast).
**Verification:** `npm run type-check` passes. Engine analysis still works. UI remains responsive during depth-4 analysis.
**Duration:** 2-3 hours

---

### Step 7: Add Promotion Dialog

**Action:**
1. Add `pendingPromotion: { from: string; to: string } | null` to store state.
2. Modify `makeMove` to detect pawn promotion and set `pendingPromotion` instead of auto-promoting.
3. Modify `selectSquare` similarly.
4. Create `src/components/PromotionDialog.tsx` with K/Q/R/B/N options.
5. Render `PromotionDialog` in `App.tsx` when `pendingPromotion !== null`.
6. On piece selection, complete the move with chosen promotion.
**Verification:** Play a pawn to the 8th rank. Dialog appears. Select knight. Move completes correctly.
**Duration:** 1-2 hours

---

### Step 8: Fix Redo Stack to Store Verbose Moves

**Action:**
1. Change `redoStack` type from `string[]` to `Array<{ from: string; to: string; promotion?: string }>`.
2. In `undoMove`, store `undone.from`, `undone.to`, `undone.promotion` instead of `undone.san`.
3. In `redoMove`, call `game.move({ from, to, promotion })` instead of `game.move(san)`.
**Verification:** Undo then redo a move. Verify correct move is replayed, especially in positions with ambiguous knight/rook moves.
**Duration:** 30 minutes

---

### Step 9: Add Input Validation to PGN/FEN Import

**Action:**
1. Add max length constants: `MAX_PGN_LENGTH = 1_000_000`, `MAX_FEN_LENGTH = 500`.
2. In `importPgn()`, check `pgn.length > MAX_PGN_LENGTH` and return false with an informative error state.
3. In `importFen()`, check `fen.length > MAX_FEN_LENGTH` similarly.
4. Show the error message in `ImportModal`.
**Verification:** Try importing a 2MB PGN string — should see error. Normal PGN should still work.
**Duration:** 20 minutes

---

### Step 10: Add PWA Icons and Fix Manifest

**Action:**
1. Generate 192x192 and 512x512 PNG icons from the existing SVG design.
2. Place them in `public/icons/icon-192.png` and `public/icons/icon-512.png`.
3. Add `icons` array to `manifest.json` with proper sizes and types.
4. Update `sw.js` `urlsToCache` to include the icon files.
**Verification:** Lighthouse PWA audit should pass the "Installable" check.
**Duration:** 30 minutes

---

### Step 11: Add `.dockerignore`

**Action:** Create `.dockerignore` with:
```
node_modules
dist
.git
.env*.local
*.md
.vscode
.idea
```
**Verification:** Run `docker build` and verify the image size is reduced.
**Duration:** 5 minutes

---

### Step 12: Wire Up Settings — Voice and Sound

**Action:**
1. In `Keypad.tsx`, add `settings` to the destructured store and conditionally render the mic button based on `settings.voiceEnabled`.
2. Create `src/utils/sound.ts` with a simple `playSound(type: 'move' | 'capture' | 'error')` function using the Web Audio API.
3. Call `playSound` from `makeMove` success and `importPgn`/`importFen` error paths.
4. Check `settings.soundEnabled` before playing.
**Verification:** Toggle sound off → no sounds. Toggle sound on → click sounds on moves. Toggle voice off → mic button hidden.
**Duration:** 1 hour

---

### Step 13: Replace framer-motion with CSS Transitions

**Action:**
1. Remove `framer-motion` from `package.json`.
2. In `TopBar.tsx` and `Keypad.tsx`, replace `<motion.div>` with plain `<div>` and CSS `transition` classes.
3. Replace `AnimatePresence` with conditional rendering (`{condition && <div>...</div>}`).
4. In `RightPanel.tsx`, replace `motion.div` height animation with CSS `transition: height 0.5s ease-out`.
5. Add transition classes to `index.css` if needed.
6. Run `npm install` to update lock file.
**Verification:** Modals fade in/out. Suggestion dropdown animates. Eval bar animates. `npm run build` succeeds. Bundle size reduced by ~150KB.
**Duration:** 1-2 hours

---

### Step 14: Improve Service Worker Cache Strategy

**Action:**
1. Add a `CACHE_VERSION` constant that changes with each deploy.
2. In `install` handler, add `/register-sw.js` and icon files to `urlsToCache`.
3. In `activate` handler, add version-based cache cleanup.
4. Change fetch strategy to stale-while-revalidate for HTML, cache-first for assets.
5. Add a "New version available" notification by checking for SW updates.
**Verification:** Deploy new version → SW detects update → user sees notification.
**Duration:** 1 hour

---

### Step 15: Unify Piece Value Scale

**Action:**
1. Create `src/utils/pieceValues.ts` with `DISPLAY_PIECE_VALUES` (p=1, n=3, b=3, r=5, q=9) and a `formatEval(centipawns: number)` function.
2. Use `formatEval` in `RightPanel.tsx` and `LeftPanel.tsx` for consistent display.
3. Import `DISPLAY_PIECE_VALUES` in `LeftPanel.tsx` replacing the inline `valMap`.
**Verification:** Material advantage and engine eval are clearly labeled with their respective scales (pawn units vs centipawns).
**Duration:** 20 minutes

---

### Step 16: Fix Inline Style Width Overrides

**Action:**
1. In `RightPanel.tsx:52`, replace `style={{ width: 260 }}` with `className="w-[260px]" or `style={{ width: 'var(--panel-width)' }}`.
2. In `LeftPanel.tsx:88`, replace `style={{ width: 230 }}` similarly.
3. In `LeftPanel.tsx:102`, remove `style={{ maxHeight: 400 }}` and use a responsive Tailwind class.
**Verification:** CSS variable `--panel-width` now controls panel widths in different breakpoints.
**Duration:** 15 minutes

---

### Step 17: Add Test Infrastructure

**Action:**
1. Install: `npm i -D vitest @testing-library/react @testing-library/jest-dom jsdom @types/node`.
2. Create `vitest.config.ts` with jsdom environment and path aliases.
3. Add `"test": "vitest"` and `"test:run": "vitest run"` to `package.json` scripts.
4. Create `src/__tests__/engine.test.ts` with tests for `analyzePosition`, `evaluate`, `getLegalMoves`, `getLegalMovesForPiece`.
5. Create `src/__tests__/store.test.ts` with tests for `makeMove`, `undoMove`, `redoMove`, `importPgn`, `importFen`, `newGame`.
6. Create `src/__tests__/openings.test.ts` with tests for `identifyOpening`.
**Verification:** `npm run test` passes all tests.
**Duration:** 2-3 hours

---

### Step 18: Add Linting and Formatting

**Action:**
1. Install: `npm i -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin eslint-plugin-react eslint-plugin-react-hooks prettier eslint-config-prettier eslint-plugin-prettier`.
2. Create `.eslintrc.cjs` with TypeScript, React, and Prettier rules.
3. Create `.prettierrc` with project conventions.
4. Add `"lint": "eslint src/", "format": "prettier --write src/"` to `package.json`.
5. Run `npm run lint` and fix all reported issues.
**Verification:** `npm run lint` exits with 0. All files pass formatting.
**Duration:** 1 hour

---

## Severity Summary

| Severity | Count | IDs |
|---|---|---|
| **Critical** | 3 | A-01, A-02, A-03 |
| **High** | 4 | A-04, A-05, A-06, A-07 |
| **Medium** | 7 | A-08, A-09, A-10, A-11, A-12, A-13, A-14, A-15, A-16, A-17, A-18, A-30 |
| **Low** | 8 | A-19, A-20, A-21, A-22, A-23, A-24, A-25, A-26, A-27, A-28, A-29 |

**Total Issues: 30**

---

## Priority Execution Order

1. **A-03** — Fix TDZ reference error (blocks the board from rendering)
2. **A-01** — Fix CSP/SW registration (blocks PWA functionality)
3. **A-04** — Connect sidebar toggle (blocks mobile usability)
4. **A-10** — Remove duplicate CSS (reduces confusion and file size)
5. **A-06** — Extract analysis helper (reduces 7x duplication)
6. **A-02** — Move engine to Web Worker (eliminates UI freezes)
7. **A-05** — Immutable Chess state (prevents subtle rendering bugs)
8. **A-07** — Add promotion dialog (chess correctness)
9. **A-09** — Fix redo stack (chess correctness)
10. **A-08** — Add input validation (security)
11. Steps 10-18 in order as time permits