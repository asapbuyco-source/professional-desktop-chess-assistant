export interface EngineAnalysis {
  bestMove: string | null;
  evaluation: number;
  depth: number;
  nodes: number;
  pv: string[];
  isMate: boolean;
  mateIn: number | null;
  topMoves: TopMove[];
}

export interface TopMove {
  san: string;
  from: string;
  to: string;
  evaluation: number;
}

export interface GameSettings {
  engineDepth: number;
  showArrows: boolean;
  showLegalMoves: boolean;
  animationSpeed: number;
  soundEnabled: boolean;
  voiceEnabled: boolean;
}

export type PieceType = 'K' | 'Q' | 'R' | 'B' | 'N' | 'P';
