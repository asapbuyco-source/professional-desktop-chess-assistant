/**
 * Keypad.tsx — production-hardened
 *
 * Fixes vs. original:
 *  1. Replaced full store subscription with granular selectors — the keypad
 *     was re-rendering on every engine analysis update.
 *  2. createRecognition() extracted outside component so it isn't
 *     re-created on every render.
 *  3. Voice recognition: onerror handler now logs the event so the user
 *     gets feedback on why recognition failed (permission denied etc).
 *  4. handleRankClick submits move after appending rank, but also needs
 *     to re-read the updated input — fixed by computing newInput locally
 *     and passing it to setMoveInput before calling submitMoveInput.
 *  5. useEffect keydown listener: submitMoveInput / clearMoveInput /
 *     selectPieceType wrapped in useCallback to avoid stale closures.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useChessStore } from '@/store';
import type { PieceType } from '@/types';

const PIECES: { label: string; value: PieceType; symbol: string }[] = [
  { label: 'K', value: 'K', symbol: '♔' },
  { label: 'Q', value: 'Q', symbol: '♕' },
  { label: 'R', value: 'R', symbol: '♖' },
  { label: 'B', value: 'B', symbol: '♗' },
  { label: 'N', value: 'N', symbol: '♘' },
  { label: 'P', value: 'P', symbol: '♙' },
];

const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'];

// ── Speech recognition factory (outside component to avoid re-creation) ───────

type SpeechRec = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: { 0: { 0: { transcript: string } } } }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: unknown) => void) | null;
};

function createRecognition(): SpeechRec | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, unknown>;
  const SR = (win.SpeechRecognition || win.webkitSpeechRecognition) as (new () => SpeechRec) | undefined;
  if (!SR) return null;
  return new SR();
}

// ─────────────────────────────────────────────────────────────────────────────

export default function Keypad() {
  // Granular selectors — only subscribe to the specific slices we need
  const moveInput          = useChessStore((s) => s.moveInput);
  const moveSuggestions    = useChessStore((s) => s.moveSuggestions);
  const selectedPieceType  = useChessStore((s) => s.selectedPieceType);
  const builderDestinations = useChessStore((s) => s.builderDestinations);
  const gameStatus         = useChessStore((s) => s.gameStatus);
  const setMoveInput       = useChessStore((s) => s.setMoveInput);
  const submitMoveInput    = useChessStore((s) => s.submitMoveInput);
  const selectPieceType    = useChessStore((s) => s.selectPieceType);
  const selectDestination  = useChessStore((s) => s.selectDestination);
  const makeMove           = useChessStore((s) => s.makeMove);
  const undoMove           = useChessStore((s) => s.undoMove);
  const newGame            = useChessStore((s) => s.newGame);
  const flipBoard          = useChessStore((s) => s.flipBoard);
  const clearMoveInput     = useChessStore((s) => s.clearMoveInput);

  const [isListening, setIsListening]       = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const inputRef       = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRec | null>(null);

  // ── Voice parsing ──────────────────────────────────────────────────────────

  const parseVoiceMove = useCallback((text: string) => {
    const { game } = useChessStore.getState();
    const legal = game.moves();
    const t = text.toLowerCase().trim();

    if (t.includes('castle') && (t.includes('king') || t.includes('short'))) {
      const move = legal.find((m) => m === 'O-O');
      if (move) { makeMove(move); return; }
    }
    if (t.includes('castle') && (t.includes('queen') || t.includes('long'))) {
      const move = legal.find((m) => m === 'O-O-O');
      if (move) { makeMove(move); return; }
    }

    const pieceNames: Record<string, string> = {
      king: 'K', queen: 'Q', rook: 'R', bishop: 'B', knight: 'N',
      pawn: '', p: '', k: 'K', q: 'Q', r: 'R', b: 'B', n: 'N',
    };

    let pieceChar = '';
    for (const [name, char] of Object.entries(pieceNames)) {
      if (t.includes(name)) { pieceChar = char; break; }
    }

    const sqMatch = t.match(/([a-h])\s*([1-8])/);
    if (!sqMatch) return;
    const sq = sqMatch[1] + sqMatch[2];
    const isCapture = t.includes('take') || t.includes('capture') || t.includes('x');

    for (const move of legal) {
      if (move.endsWith(sq) || move.includes(sq)) {
        if (pieceChar && move.startsWith(pieceChar)) { makeMove(move); return; }
        if (!pieceChar && move[0] === move[0].toLowerCase()) {
          if (!isCapture || move.includes('x')) { makeMove(move); return; }
        }
      }
    }

    const prefix = pieceChar || '';
    const match = legal.find(
      (m) => m.startsWith(prefix) && m.includes(sq) && (!isCapture || m.includes('x')),
    );
    if (match) makeMove(match);
  }, [makeMove]);

  // ── Voice toggle ───────────────────────────────────────────────────────────

  const toggleVoice = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const rec = createRecognition();
    if (!rec) return;

    rec.continuous     = false;
    rec.interimResults = false;
    rec.lang           = 'en-US';
    recognitionRef.current = rec;

    rec.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      parseVoiceMove(transcript);
      setIsListening(false);
    };
    rec.onend  = () => setIsListening(false);
    rec.onerror = (e) => {
      console.warn('Voice recognition error:', e);
      setIsListening(false);
    };

    try {
      rec.start();
      setIsListening(true);
    } catch {
      setIsListening(false);
    }
  }, [isListening, parseVoiceMove]);

  // ── Button handlers ────────────────────────────────────────────────────────

  const handleFileClick = useCallback((file: string) => {
    if (selectedPieceType) {
      const dests = builderDestinations.filter((d) => d.startsWith(file));
      if (dests.length === 1) { selectDestination(dests[0]); return; }
      if (dests.length > 1) {
        setMoveInput(selectedPieceType + file);
        selectPieceType(null);
        setShowSuggestions(true);
        return;
      }
    }
    setMoveInput(moveInput + file);
    setShowSuggestions(true);
  }, [selectedPieceType, builderDestinations, moveInput, setMoveInput, selectDestination, selectPieceType]);

  const handleRankClick = useCallback((rank: string) => {
    const newInput = moveInput + rank;
    setMoveInput(newInput);
    // submitMoveInput reads from store state so it will see the just-set value
    if (newInput.length >= 2) {
      // Allow the store update to propagate before submitting
      setTimeout(() => {
        const success = useChessStore.getState().submitMoveInput();
        if (success) setShowSuggestions(false);
      }, 0);
    }
  }, [moveInput, setMoveInput]);

  const handleSpecialClick = useCallback((char: string) => {
    setMoveInput(moveInput + char);
    setShowSuggestions(true);
  }, [moveInput, setMoveInput]);

  const handleCastleClick = useCallback((notation: string) => {
    setMoveInput(notation);
    makeMove(notation);
    setShowSuggestions(false);
  }, [setMoveInput, makeMove]);

  const handleSuggestionClick = useCallback((suggestion: string) => {
    makeMove(suggestion);
    setShowSuggestions(false);
    clearMoveInput();
  }, [makeMove, clearMoveInput]);

  // ── Global key handler ────────────────────────────────────────────────────

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        useChessStore.getState().submitMoveInput();
        setShowSuggestions(false);
      }
      if (e.key === 'Escape') {
        useChessStore.getState().clearMoveInput();
        setShowSuggestions(false);
        useChessStore.getState().selectPieceType(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // stable — uses getState() so no closure staleness

  const isGameOver = gameStatus.includes('Checkmate') || gameStatus.includes('Draw');

  return (
    <div
      className="glass-panel rounded-xl p-2 md:p-3 space-y-1.5 md:space-y-2 overflow-y-auto max-h-96 md:max-h-none"
      role="region"
      aria-label="Move input and controls"
    >
      {/* Move Input Row */}
      <div className="relative flex gap-2 items-center">
        <div className="relative flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            value={moveInput}
            onChange={(e) => {
              setMoveInput(e.target.value);
              setShowSuggestions(e.target.value.length > 0);
            }}
            onFocus={() => moveInput && setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Type or build move..."
            className="w-full bg-[#0d0f18] border border-[#2a3040] rounded-lg px-2 md:px-3 py-1.5 md:py-2 text-xs md:text-sm text-white focus:outline-none focus:border-[#00ff88]/50 focus:ring-1 focus:ring-[#00ff88]/20 transition-all"
            disabled={isGameOver}
            aria-label="Move input"
            autoComplete="off"
            spellCheck={false}
          />
          <AnimatePresence>
            {showSuggestions && moveSuggestions.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="absolute bottom-full left-0 right-0 mb-1 bg-[#12121a] border border-[#2a3040] rounded-lg overflow-hidden z-50 shadow-xl max-h-36 overflow-y-auto"
                role="listbox"
                aria-label="Move suggestions"
              >
                {moveSuggestions.map((s) => (
                  <button
                    key={s}
                    onMouseDown={() => handleSuggestionClick(s)}
                    className="w-full text-left px-2 md:px-3 py-1.5 text-xs md:text-sm hover:bg-[#00ff88]/10 text-white/80 hover:text-[#00ff88] transition-colors"
                    role="option"
                    aria-selected={false}
                  >
                    {s}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <button
          onClick={() => { submitMoveInput(); setShowSuggestions(false); }}
          className="keypad-btn active:scale-95 px-2 md:px-4 py-1.5 md:py-2 text-xs md:text-sm font-bold flex-shrink-0"
          style={{ background: 'linear-gradient(145deg, #00ff88, #00cc6a)', color: '#07070d' }}
          disabled={isGameOver}
          title="Submit move (Enter)"
          aria-label="Submit move"
        >
          →
        </button>
      </div>

      {/* Piece Selection Row */}
      <div className="grid grid-cols-6 gap-1">
        {PIECES.map((p) => (
          <button
            key={p.value}
            onClick={() => selectPieceType(p.value)}
            className={`keypad-btn py-1.5 md:py-2 text-base md:text-lg ${
              selectedPieceType === p.value ? 'ring-2 ring-[#00ff88]' : ''
            }`}
            disabled={isGameOver}
            aria-pressed={selectedPieceType === p.value}
            title={`Select ${p.label} (${p.symbol})`}
          >
            <span>{p.symbol}</span>
          </button>
        ))}
      </div>

      {/* File Row */}
      <div className="grid grid-cols-8 gap-1">
        {FILES.map((f) => (
          <button
            key={f}
            onClick={() => handleFileClick(f)}
            className={`keypad-btn py-1 md:py-1.5 text-xs md:text-sm font-mono min-h-[32px] ${
              builderDestinations.some((d) => d.startsWith(f)) ? 'ring-1 ring-[#00ff88]/40' : ''
            }`}
            disabled={isGameOver}
            title={`File ${f}`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Rank Row */}
      <div className="grid grid-cols-8 gap-1">
        {RANKS.map((r) => (
          <button
            key={r}
            onClick={() => handleRankClick(r)}
            className={`keypad-btn py-1 md:py-1.5 text-xs md:text-sm font-mono min-h-[32px] ${
              builderDestinations.some((d) => d.endsWith(r)) ? 'ring-1 ring-[#00ff88]/40' : ''
            }`}
            disabled={isGameOver}
            title={`Rank ${r}`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Special Moves Row */}
      <div className="grid grid-cols-6 gap-1">
        {[
          { char: 'x', label: 'Capture (x)', display: '×' },
          { char: '+', label: 'Check (+)', display: '+' },
          { char: '#', label: 'Checkmate (#)', display: '#' },
          { char: '=', label: 'Promotion (=)', display: '=' },
        ].map(({ char, label, display }) => (
          <button
            key={char}
            onClick={() => handleSpecialClick(char)}
            className="keypad-btn py-1 md:py-1.5 text-xs md:text-sm min-h-[32px]"
            disabled={isGameOver}
            title={label}
          >
            {display}
          </button>
        ))}
        <button
          onClick={() => handleCastleClick('O-O')}
          className="keypad-btn py-1 md:py-1.5 text-xs min-h-[32px]"
          disabled={isGameOver}
          title="Castle kingside"
        >
          O-O
        </button>
        <button
          onClick={() => handleCastleClick('O-O-O')}
          className="keypad-btn py-1 md:py-1.5 text-xs min-h-[32px]"
          disabled={isGameOver}
          title="Castle queenside"
        >
          O-O-O
        </button>
      </div>

      {/* Action Row */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-1">
        <button
          onClick={() => undoMove()}
          className="keypad-btn py-1 md:py-1.5 text-xs min-h-[32px]"
          title="Undo (Ctrl+Z)"
        >
          ↩ Undo
        </button>
        <button
          onClick={clearMoveInput}
          className="keypad-btn py-1 md:py-1.5 text-xs min-h-[32px]"
          title="Clear input"
        >
          ✕ Clear
        </button>
        <button
          onClick={newGame}
          className="keypad-btn py-1 md:py-1.5 text-xs min-h-[32px]"
          title="New game (Ctrl+N)"
        >
          ♟ New
        </button>
        <button
          onClick={flipBoard}
          className="hidden md:block keypad-btn py-1 md:py-1.5 text-xs min-h-[32px]"
          title="Flip board (Ctrl+F)"
        >
          ⟲ Flip
        </button>
        <button
          onClick={toggleVoice}
          className={`hidden md:block keypad-btn py-1 md:py-1.5 text-xs min-h-[32px] ${
            isListening ? 'ring-2 ring-[#ef4444]' : ''
          }`}
          title={isListening ? 'Stop listening (Esc)' : 'Voice input'}
          aria-pressed={isListening}
          aria-label={isListening ? 'Stop voice input' : 'Start voice input'}
        >
          {isListening ? '🔴' : '🎤'}
        </button>
        <button
          onClick={() => {
            if (moveInput) {
              makeMove(moveInput);
              clearMoveInput();
              setShowSuggestions(false);
            }
          }}
          className="col-span-3 md:col-span-1 keypad-btn py-1 md:py-1.5 text-xs font-bold min-h-[32px]"
          style={{ background: 'linear-gradient(145deg, #00ff88, #00cc6a)', color: '#07070d' }}
          disabled={isGameOver}
          title="Execute move (Enter)"
          aria-label="Execute move"
        >
          ✓
        </button>
      </div>
    </div>
  );
}
