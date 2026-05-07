interface Opening {
  eco: string;
  name: string;
  moves: string;
}

const OPENINGS: Opening[] = [
  { eco: 'B00', name: 'King\'s Pawn Opening', moves: 'e4' },
  { eco: 'C20', name: 'King\'s Pawn Game', moves: 'e4 e5' },
  { eco: 'B12', name: 'Caro-Kann Defense', moves: 'e4 c6' },
  { eco: 'B13', name: 'Caro-Kann Exchange', moves: 'e4 c6 d4 d5 exd5' },
  { eco: 'B14', name: 'Caro-Kann, Panov-Botvinnik', moves: 'e4 c6 d4 d5 exd5 cxd5 c4' },
  { eco: 'B22', name: 'Sicilian Defense, Alapin', moves: 'e4 c5 c3' },
  { eco: 'B23', name: 'Sicilian Defense, Closed', moves: 'e4 c5 Nc3' },
  { eco: 'B30', name: 'Sicilian Defense', moves: 'e4 c5 Nf3' },
  { eco: 'B33', name: 'Sicilian, Sveshnikov', moves: 'e4 c5 Nf3 Nc6 d4 cxd4 Nxd4 Nf6 Nc3 e5' },
  { eco: 'B40', name: 'Sicilian Defense, French Variation', moves: 'e4 c5 Nf3 e6' },
  { eco: 'B50', name: 'Sicilian Defense, Najdorf', moves: 'e4 c5 Nf3 d6' },
  { eco: 'B90', name: 'Sicilian, Najdorf', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6' },
  { eco: 'B70', name: 'Sicilian, Dragon Variation', moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 g6' },
  { eco: 'C00', name: 'French Defense', moves: 'e4 e6' },
  { eco: 'C02', name: 'French, Advance Variation', moves: 'e4 e6 d4 d5 e5' },
  { eco: 'C03', name: 'French, Tarrasch', moves: 'e4 e6 d4 d5 Nd2' },
  { eco: 'C10', name: 'French Defense, Rubinstein', moves: 'e4 e6 d4 d5 Nc3' },
  { eco: 'C42', name: 'Russian Game', moves: 'e4 e5 Nf3 Nf6' },
  { eco: 'C44', name: 'King\'s Knight Opening', moves: 'e4 e5 Nf3 Nc6' },
  { eco: 'C46', name: 'Three Knights Opening', moves: 'e4 e5 Nf3 Nc6 Nc3' },
  { eco: 'C47', name: 'Four Knights Game', moves: 'e4 e5 Nf3 Nc6 Nc3 Nf6' },
  { eco: 'C50', name: 'Italian Game', moves: 'e4 e5 Nf3 Nc6 Bc4' },
  { eco: 'C51', name: 'Evans Gambit', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 b4' },
  { eco: 'C53', name: 'Giuoco Piano', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3' },
  { eco: 'C54', name: 'Giuoco Piano, Main Line', moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d4' },
  { eco: 'C55', name: 'Two Knights Defense', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6' },
  { eco: 'C56', name: 'Two Knights, Fried Liver', moves: 'e4 e5 Nf3 Nc6 Bc4 Nf6 Ng5 d5 exd5 Nxd5 Nxf7' },
  { eco: 'C60', name: 'Ruy Lopez', moves: 'e4 e5 Nf3 Nc6 Bb5' },
  { eco: 'C65', name: 'Ruy Lopez, Berlin Defense', moves: 'e4 e5 Nf3 Nc6 Bb5 Nf6' },
  { eco: 'C68', name: 'Ruy Lopez, Exchange', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Bxc6' },
  { eco: 'C71', name: 'Ruy Lopez, Steinitz Defense', moves: 'e4 e5 Nf3 Nc6 Bb5 d6' },
  { eco: 'C78', name: 'Ruy Lopez, 5.O-O', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O' },
  { eco: 'C84', name: 'Ruy Lopez, Closed', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3' },
  { eco: 'C88', name: 'Ruy Lopez, Closed, 9...Bb7', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c2 d6' },
  { eco: 'C92', name: 'Ruy Lopez, Closed, 9...Bb7', moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 O-O c2 d6 h3' },
  { eco: 'D02', name: 'Queen\'s Pawn Opening', moves: 'd4' },
  { eco: 'D02', name: 'Queen\'s Pawn, London System', moves: 'd4 d5 Bf4' },
  { eco: 'D06', name: 'Queen\'s Gambit', moves: 'd4 d5 c4' },
  { eco: 'D07', name: 'Queen\'s Gambit, Chigorin Defense', moves: 'd4 d5 c4 Nc6' },
  { eco: 'D20', name: 'Queen\'s Gambit Accepted', moves: 'd4 d5 c4 dxc4' },
  { eco: 'D30', name: 'Queen\'s Gambit Declined', moves: 'd4 d5 c4 e6 Nc3' },
  { eco: 'D35', name: 'QGD, Exchange Variation', moves: 'd4 d5 c4 e6 Nc3 Nf6 cxd5 exd5' },
  { eco: 'D37', name: 'QGD, 4.Nf3', moves: 'd4 d5 c4 e6 Nc3 Nf6 Nf3' },
  { eco: 'D43', name: 'QGD, Semi-Slav', moves: 'd4 d5 c4 e6 Nc3 Nf6 Nf3 c6' },
  { eco: 'D44', name: 'QGD, Semi-Slav, Botvinnik', moves: 'd4 d5 c4 e6 Nc3 Nf6 Nf3 c6 Bg5 dxc4' },
  { eco: 'D52', name: 'QGD, Semi-Slav, Moscow', moves: 'd4 d5 c4 e6 Nc3 Nf6 Nf3 c6 Bg5 Nbd7' },
  { eco: 'D58', name: 'QGD, Tartakower', moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6' },
  { eco: 'D85', name: 'Grünfeld, Exchange', moves: 'd4 Nf6 c4 g6 Nc3 d5 cxd5 Nxd5' },
  { eco: 'D97', name: 'Grünfeld, Russian', moves: 'd4 Nf6 c4 g6 Nc3 d5 Nf3 Bg7 Qa2' },
  { eco: 'E60', name: 'King\'s Indian Defense', moves: 'd4 Nf6 c4 g6' },
  { eco: 'E61', name: 'King\'s Indian, 3.Nc3', moves: 'd4 Nf6 c4 g6 Nc3' },
  { eco: 'E70', name: 'King\'s Indian, 4.e4', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4' },
  { eco: 'E73', name: 'King\'s Indian, Averbakh', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Be2 O-O Bg5' },
  { eco: 'E91', name: 'King\'s Indian, Classical', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf2 O-O Be2 e5' },
  { eco: 'E94', name: 'King\'s Indian, Orthodox', moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf2 O-O Be2 e5 O-O Nbd7' },
  { eco: 'A00', name: 'Polish Opening', moves: 'b4' },
  { eco: 'A01', name: 'Nimzovich-Larsen Attack', moves: 'b3' },
  { eco: 'A07', name: 'King\'s Indian Attack', moves: 'Nf3 d5 g3' },
  { eco: 'A20', name: 'English Opening', moves: 'c4' },
  { eco: 'A30', name: 'English, Symmetrical', moves: 'c4 c5' },
  { eco: 'A40', name: 'Queen\'s Pawn, 1.d4', moves: 'd4 e6' },
  { eco: 'A46', name: 'Indian Defense', moves: 'd4 Nf6 Nf3' },
  { eco: 'A50', name: 'Indian Game', moves: 'd4 Nf6 c4' },
];

export function identifyOpening(moveHistory: string[]): string {
  if (moveHistory.length === 0) return 'Starting Position';

  const moveStr = moveHistory.join(' ');
  let bestMatch = '';
  let bestName = 'Opening';

  for (const opening of OPENINGS) {
    if (moveStr.startsWith(opening.moves) || moveStr === opening.moves) {
      if (opening.moves.length > bestMatch.length) {
        bestMatch = opening.moves;
        bestName = `${opening.eco}: ${opening.name}`;
      }
    }
  }

  if (!bestMatch && moveHistory.length >= 2) {
    return 'Unknown Opening';
  }

  return bestName;
}
