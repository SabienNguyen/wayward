// Matches at the page's real playing strength: 2-ply alpha-beta + quiescence, small noise.
const E = require('../src/engine.js');
const { mlEval, mlLoad } = require('./ml.js');
const cps = JSON.parse(require('fs').readFileSync(process.argv[2]));
const N = +process.argv[3] || 10;
function player(spec) {
  if (spec === 'material') return s => { E.setEval(E.evaluate); return E.bestMove(s, 2, 30); };
  const w = mlLoad(cps.find(c => c.id === spec));
  return s => { E.setEval(st => mlEval(st, w)); return E.bestMove(s, 2, 30); };
}
function game(a, b) { // a plays sente
  const s = E.initialState(); const ps = [a, b];
  for (let ply = 0; ply < 300; ply++) {
    const m = ps[s.turn](s);
    if (!m) return s.turn === 0 ? 0 : 1;
    E.apply(s, m);
  }
  return 0.5;
}
const pairs = process.argv.slice(4).map(x => x.split(':'));
for (const [x, y] of pairs) {
  let sc = 0, w = 0, d = 0, l = 0;
  const px = player(x), py = player(y);
  for (let g = 0; g < N; g++) {
    const r = g % 2 ? 1 - game(py, px) : game(px, py);
    sc += r; if (r === 1) w++; else if (r === 0) l++; else d++;
  }
  console.log(`${x} vs ${y}: +${w} =${d} -${l}  score ${(sc / N).toFixed(2)}`);
}
