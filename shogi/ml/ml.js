// Learned evaluation (Shogi Dojo ML v2). Features are from the side to move's view;
// the board is rotated when Gote is to move so "we" always sit at the bottom.
const ML_TYPES = ['K', 'R', 'B', 'G', 'S', 'N', 'L', 'P', '+R', '+B', '+S', '+N', '+L', '+P'];
const ML_HAND = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
const ML_TI = {}; ML_TYPES.forEach((t, i) => { ML_TI[t] = i; });
// 0..27 piece counts on board (ours, theirs) · 28..41 hand counts · 42..2309 piece-square · 2310 bias
const ML_NF = 2311;
function mlFeatures(s, out) {
  const idx = out || [];
  idx.length = 0;
  const us = s.turn;
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const p = s.b[r][c];
    if (!p) continue;
    const ti = ML_TI[p.p ? '+' + p.t : p.t];
    const ours = p.o === us ? 0 : 1;
    const rr = us ? 8 - r : r, cc = us ? 8 - c : c;
    if (p.t !== 'K') idx.push(ours * 14 + ti);
    idx.push(42 + ours * 1134 + ti * 81 + rr * 9 + cc);
  }
  for (const side of [0, 1]) {
    const ours = side === us ? 0 : 7;
    for (let i = 0; i < 7; i++) { const n = s.hands[side][ML_HAND[i]]; for (let k = 0; k < n; k++) idx.push(28 + ours + i); }
  }
  idx.push(ML_NF - 1);
  return idx;
}
function mlScore(s, w) {
  const f = mlFeatures(s);
  let v = 0;
  for (let i = 0; i < f.length; i++) v += w[f[i]];
  return v;
}
function mlEval(s, w) { return Math.round(mlScore(s, w) * 1200); }
function mlLoad(cp) {
  const w = new Float32Array(ML_NF);
  if (cp.w) { for (let i = 0; i < cp.w.length; i++) w[i] = cp.w[i]; return w; }
  for (let k = 0; k < cp.i.length; k++) w[cp.i[k]] = cp.v[k];
  return w;
}
if (typeof module !== 'undefined') module.exports = { mlFeatures, mlScore, mlEval, mlLoad, ML_NF };
