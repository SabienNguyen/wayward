// Brain (fast engine): perft must match published counts, and it must agree with the
// reference engine on the legal move list in many random positions.
const Brain = require('../src/brain.js');
const E = require('../src/engine.js');
const CASES = [
  ['start', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', [20, 400, 8902, 197281, 4865609]],
  ['kiwipete', 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', [48, 2039, 97862, 4085603]],
  ['position 3', '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1', [14, 191, 2812, 43238, 674624]],
  ['position 4', 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1', [6, 264, 9467, 422333]],
  ['position 5', 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8', [44, 1486, 62379, 2103487]],
];
let bad = 0;
const t0 = Date.now(); let total = 0;
for (const [nm, fen, want] of CASES) want.forEach((n, i) => {
  const got = Brain.perft(Brain.fromFen(fen), i + 1); total += got;
  if (got !== n) { bad++; console.log(`FAIL ${nm} depth ${i + 1}: ${got} (expected ${n})`); }
});
console.log(`perft: ${bad ? 'FAILED' : 'all match'} (${total.toLocaleString()} nodes in ${Date.now() - t0} ms)`);
// Cross-check legal moves against the reference engine along random games.
let checked = 0;
for (let g = 0; g < 40; g++) {
  const s = E.initialState();
  for (let ply = 0; ply < 120; ply++) {
    const ref = E.legalMoves(s).map(E.toUci).sort();
    const got = Brain.legal(Brain.fromFen(E.toFen(s))).map(Brain.toUci).sort();
    checked++;
    if (ref.join() !== got.join()) { bad++; console.log('MISMATCH', E.toFen(s), ref.filter(x => !got.includes(x)), got.filter(x => !ref.includes(x))); break; }
    if (!ref.length) break;
    E.apply(s, E.fromUci(s, ref[(Math.random() * ref.length) | 0]));
  }
}
console.log(`legal-move cross-check: ${checked} positions`);
const r = Brain.think('r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1', { timeMs: 1000 });
console.log(`think 1s on kiwipete: ${r.uci} score ${r.score} depth ${r.depth} nodes ${r.nodes} (${Math.round(r.nodes / r.ms)}k nps)`);
// Mate-in-2 sanity: must find it.
const m2 = Brain.think('r2qkb1r/pp2nppp/3p4/2pNN1B1/2BnP3/3P4/PPP2PPP/R2bK2R w KQkq - 1 1', { timeMs: 1000 });
console.log(`mate puzzle: ${m2.uci} score ${m2.score}`);
process.exitCode = bad ? 1 : 0;
