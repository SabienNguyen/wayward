// Head-to-head: Brain (time per move) vs the reference engine (fixed depth).
// usage: node tests/match.js <games> <brainMs> <oldDepth> [brainMs2]
const E = require('../src/engine.js');
const Brain = require('../src/brain.js');
const [games, ms, oldDepth, ms2] = process.argv.slice(2).map(Number);
function brainPlayer(t) { return (s, hist) => { const r = Brain.think(E.toFen(s), { timeMs: t, history: hist }); return r && E.fromUci(s, r.uci); }; }
const oldPlayer = d => s => { const m = E.bestMove(s, d, 0); return m && E.fromUci(s, E.toUci(m)); };
const A = brainPlayer(ms), Bp = ms2 ? brainPlayer(ms2) : oldPlayer(oldDepth);
let score = 0, w = 0, d = 0, l = 0;
for (let g = 0; g < games; g++) {
  const s = E.initialState(), keys = [E.positionKey(s)], hist = [];
  for (let i = 0; i < 4; i++) { const lm = E.legalMoves(s); E.apply(s, lm[(Math.random() * lm.length) | 0]); keys.push(E.positionKey(s)); }
  const brainSide = g % 2;
  let result = 0.5;
  for (let ply = 0; ply < 300; ply++) {
    const lm = E.legalMoves(s);
    if (!lm.length) { result = E.inCheck(s, s.turn) ? (s.turn === brainSide ? 0 : 1) : 0.5; break; }
    if (s.half >= 100 || E.insufficientMaterial(s) || keys.filter(k => k === keys[keys.length - 1]).length >= 3) break;
    hist.push(Brain.hashOf(E.toFen(s)));
    const m = s.turn === brainSide ? A(s, hist.slice(0, -1)) : Bp(s, hist.slice(0, -1));
    E.apply(s, m); keys.push(E.positionKey(s));
  }
  score += result; if (result === 1) w++; else if (result === 0) l++; else d++;
}
console.log(`brain ${ms}ms vs ${ms2 ? 'brain ' + ms2 + 'ms' : 'old depth ' + oldDepth}: +${w} =${d} -${l} score ${(score / games).toFixed(2)}`);
