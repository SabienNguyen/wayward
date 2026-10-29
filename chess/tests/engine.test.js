// Perft: total leaf positions at each depth, compared with published values.
const E = require('../src/engine.js');
function perft(s, d) { if (!d) return 1; let n = 0; for (const m of E.legalMoves(s)) { E.apply(s, m); n += perft(s, d - 1); E.undo(s, m); } return n; }
const CASES = [
  ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862]],
  ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238]],
  ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467]],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379]],
];
let bad = 0;
for (const [name, fen, want] of CASES) want.forEach((n, i) => {
  const got = perft(E.parseFen(fen), i + 1);
  if (got !== n) bad++;
  console.log(`${got === n ? 'ok  ' : 'FAIL'} ${name} depth ${i + 1}: ${got}${got === n ? '' : ` (expected ${n})`}`);
});
// FEN round-trip and SAN spot checks
const s = E.initialState();
if (E.toFen(s) !== 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1') { bad++; console.log('FAIL fen round-trip'); }
const fool = E.initialState();
const sans = [];
for (const u of ['f2f3', 'e7e5', 'g2g4', 'd8h4']) { const m = E.fromUci(fool, u); sans.push(E.toSan(fool, m)); E.apply(fool, m); }
console.log('fool\'s mate SAN:', sans.join(' '));
if (sans.join(' ') !== 'f3 e5 g4 Qh4#') bad++;
const t0 = Date.now(); E.bestMove(E.parseFen('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1'), 3);
console.log(`depth-3 search on kiwipete: ${Date.now() - t0} ms`);
process.exitCode = bad ? 1 : 0;
