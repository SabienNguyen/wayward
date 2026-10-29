// Logistic regression on observed games: predict whether the side to move goes on to win.
const fs = require('fs');
const { ML_NF } = require('./ml.js');
const games = [];
for (const f of fs.readdirSync(__dirname).filter(f => /^games_\d+\.jsonl$/.test(f)))
  for (const line of fs.readFileSync(__dirname + '/' + f, 'utf8').split('\n')) if (line) games.push(JSON.parse(line));
let seed = 42; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
for (let i = games.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [games[i], games[j]] = [games[j], games[i]]; }
const CPS = (process.argv[2] || '0,40,300,' + games.length).split(',').map(Number);
const names = (process.argv[3] || 'Newborn,Novice,Apprentice,Veteran').split(',');
const sig = x => 1 / (1 + Math.exp(-x));
function train(n) {
  const w = new Float64Array(ML_NF);
  if (!n) return w;
  const pos = [];
  for (let g = 0; g < n; g++) games[g].forEach(([y, f], k, arr) => { if (k >= 6) pos.push([y, f, Math.min(1, k / arr.length + 0.3)]); });
  const epochs = +(process.env.EPOCHS || 8), PSQ_L2 = +(process.env.PSQ_L2 || 2e-3);
  for (let e = 0; e < epochs; e++) {
    const lr = 0.02 / (1 + e);
    for (let i = pos.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [pos[i], pos[j]] = [pos[j], pos[i]]; }
    let loss = 0;
    for (const [y, f, wt] of pos) {
      let z = 0; for (const i of f) z += w[i];
      const p = sig(z), g = lr * wt * (y - p);
      loss -= y ? Math.log(p + 1e-9) : Math.log(1 - p + 1e-9);
      for (const i of f) w[i] += g - (i >= 42 && i < ML_NF - 1 ? PSQ_L2 : 0) * w[i];
    }
    if (e === epochs - 1) console.log(`  n=${n} positions=${pos.length} logloss=${(loss / pos.length).toFixed(3)}`);
  }
  return w;
}
const out = [];
const T = ['K', 'R', 'B', 'G', 'S', 'N', 'L', 'P', '+R', '+B', '+S', '+N', '+L', '+P'];
CPS.forEach((n, k) => {
  const w = train(n);
  const i = [], v = [];
  for (let x = 0; x < ML_NF; x++) { const r = Math.round(w[x] * 1000) / 1000; if (r) { i.push(x); v.push(r); } }
  out.push({ id: names[k].toLowerCase(), name: names[k], games: n, i, v });
  console.log(names[k], n, 'games | our board:', T.slice(1, 8).map((t, j) => t + w[j + 1].toFixed(2)).join(' '), '| our hand:', ['R','B','G','S','N','L','P'].map((t, j) => t + w[28 + j].toFixed(2)).join(' '));
});
fs.writeFileSync(__dirname + '/final.json', JSON.stringify(out));
console.log('wrote final.json', (JSON.stringify(out).length / 1024).toFixed(0), 'KB');
