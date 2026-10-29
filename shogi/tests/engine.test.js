// Rules engine: move counts from the opening match the published shogi perft numbers.
const E = require('../src/engine.js');
function perft(s, d) { if (!d) return 1; let n = 0; for (const m of E.legalMoves(s)) { E.apply(s, m); n += perft(s, d - 1); E.undo(s, m); } return n; }
const want = [30, 900, 25470];
let bad = 0;
want.forEach((n, i) => { const got = perft(E.initialState(), i + 1); console.log(`perft ${i + 1}: ${got}${got === n ? '' : ` (expected ${n})`}`); if (got !== n) bad++; });
// Pawn-drop mate (uchifuzume) must be illegal; a gold drop on the same square is fine.
const s = E.initialState();
for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) s.b[r][c] = null;
s.b[0][8] = { t: 'K', o: 1, p: false }; s.b[0][7] = { t: 'N', o: 1, p: false };
s.b[2][7] = { t: 'G', o: 0, p: false }; s.b[2][8] = { t: 'L', o: 0, p: false }; s.b[8][0] = { t: 'K', o: 0, p: false };
s.hands[0].P = 1;
const pawnMate = E.legalMoves(s).some(m => m.drop === 'P' && m.to[0] === 1 && m.to[1] === 8);
console.log(`pawn-drop mate rejected: ${!pawnMate}`); if (pawnMate) bad++;
process.exitCode = bad ? 1 : 0;
