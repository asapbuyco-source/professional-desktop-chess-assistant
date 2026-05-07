export const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

export const PIECE_DISPLAY_VALUES: Record<string, string> = {
  p: '1.0',
  n: '3.2',
  b: '3.3',
  r: '5.0',
  q: '9.0',
};

export function pieceValue(type: string): number {
  return PIECE_VALUES[type] ?? 0;
}