
/* ================= ENGINE ================= */
const VAL = { P: 100, L: 300, N: 350, S: 500, G: 560, B: 820, R: 1000, K: 0 };
const PVAL = { P: 560, L: 560, N: 560, S: 560, B: 1080, R: 1280 };
const HAND_ORDER = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];
const PROMOTABLE = { R: 1, B: 1, S: 1, N: 1, L: 1, P: 1 };
const MATE = 100000;
const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const GOLD = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]];
// Movement in Sente's orientation (forward = row - 1).
const BASE = {
  K: { steps: [...ORTHO, ...DIAG], slides: [] },
  G: { steps: GOLD, slides: [] },
  S: { steps: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 1]], slides: [] },
  N: { steps: [], slides: [], jumps: [[-2, -1], [-2, 1]] },
  L: { steps: [], slides: [[-1, 0]] },
  P: { steps: [[-1, 0]], slides: [] },
  R: { steps: [], slides: ORTHO },
  B: { steps: [], slides: DIAG },
  '+R': { steps: DIAG, slides: ORTHO },
  '+B': { steps: ORTHO, slides: DIAG },
  '+S': { steps: GOLD, slides: [] }, '+N': { steps: GOLD, slides: [] },
  '+L': { steps: GOLD, slides: [] }, '+P': { steps: GOLD, slides: [] },
};
const MOVES = [{}, {}];
for (const key in BASE) {
  for (const side of [0, 1]) {
    const f = side === 0 ? 1 : -1, b = BASE[key];
    MOVES[side][key] = {
      steps: [...b.steps, ...(b.jumps || [])].map(([r, c]) => [r * f, c]),
      slides: b.slides.map(([r, c]) => [r * f, c]),
    };
  }
}
const pkey = pc => pc.p ? '+' + pc.t : pc.t;
const inZone = (side, r) => side === 0 ? r <= 2 : r >= 6;
function deadSquare(t, side, r) {
  const rel = side === 0 ? r : 8 - r; // 0 = far rank
  if (t === 'P' || t === 'L') return rel === 0;
  if (t === 'N') return rel <= 1;
  return false;
}

function initialState() {
  const b = Array.from({ length: 9 }, () => Array(9).fill(null));
  const back = ['L', 'N', 'S', 'G', 'K', 'G', 'S', 'N', 'L'];
  for (let c = 0; c < 9; c++) {
    b[0][c] = { t: back[c], o: 1, p: false };
    b[8][c] = { t: back[c], o: 0, p: false };
    b[2][c] = { t: 'P', o: 1, p: false };
    b[6][c] = { t: 'P', o: 0, p: false };
  }
  b[1][1] = { t: 'R', o: 1, p: false }; b[1][7] = { t: 'B', o: 1, p: false };
  b[7][7] = { t: 'R', o: 0, p: false }; b[7][1] = { t: 'B', o: 0, p: false };
  const hand = () => ({ R: 0, B: 0, G: 0, S: 0, N: 0, L: 0, P: 0 });
  return { b, hands: [hand(), hand()], turn: 0 };
}

function pushMove(out, s, side, fr, fc, tr, tc, pc, target) {
  const canPromo = PROMOTABLE[pc.t] && !pc.p && (inZone(side, fr) || inZone(side, tr));
  const must = !pc.p && deadSquare(pc.t, side, tr);
  if (!must) out.push({ from: [fr, fc], to: [tr, tc], drop: null, promo: false, cap: target, pt: pc.t, canPromo });
  if (canPromo) out.push({ from: [fr, fc], to: [tr, tc], drop: null, promo: true, cap: target, pt: pc.t, canPromo });
}

function genPieceMoves(s, r, c, out, capsOnly) {
  const pc = s.b[r][c], side = pc.o, mv = MOVES[side][pkey(pc)];
  for (const [dr, dc] of mv.steps) {
    const tr = r + dr, tc = c + dc;
    if (tr < 0 || tr > 8 || tc < 0 || tc > 8) continue;
    const t = s.b[tr][tc];
    if (t && t.o === side) continue;
    if (capsOnly && !t) continue;
    pushMove(out, s, side, r, c, tr, tc, pc, t);
  }
  for (const [dr, dc] of mv.slides) {
    let tr = r + dr, tc = c + dc;
    while (tr >= 0 && tr <= 8 && tc >= 0 && tc <= 8) {
      const t = s.b[tr][tc];
      if (t && t.o === side) break;
      if (!capsOnly || t) pushMove(out, s, side, r, c, tr, tc, pc, t);
      if (t) break;
      tr += dr; tc += dc;
    }
  }
}

function findKing(s, side) {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const p = s.b[r][c];
    if (p && p.t === 'K' && p.o === side) return [r, c];
  }
  return null;
}

// Pseudo-legal moves. dropNear: only allow drops within distance 2 of this square (search pruning).
function genMoves(s, opts = {}) {
  const side = s.turn, out = [];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const p = s.b[r][c];
    if (p && p.o === side) genPieceMoves(s, r, c, out, opts.capsOnly);
  }
  if (opts.capsOnly || opts.noDrops) return out;
  const hand = s.hands[side];
  let pawnFiles = null;
  for (const t of HAND_ORDER) {
    if (!hand[t]) continue;
    if (t === 'P' && !pawnFiles) {
      pawnFiles = Array(9).fill(false);
      for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
        const p = s.b[r][c];
        if (p && p.t === 'P' && !p.p && p.o === side) pawnFiles[c] = true;
      }
    }
    for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
      if (s.b[r][c]) continue;
      if (deadSquare(t, side, r)) continue;
      if (t === 'P' && pawnFiles[c]) continue;
      if (opts.dropNear && Math.max(Math.abs(r - opts.dropNear[0]), Math.abs(c - opts.dropNear[1])) > 2) continue;
      out.push({ from: null, to: [r, c], drop: t, promo: false, cap: null, pt: t, canPromo: false });
    }
  }
  return out;
}

function apply(s, m) {
  const [tr, tc] = m.to;
  if (m.drop) {
    s.b[tr][tc] = { t: m.drop, o: s.turn, p: false };
    s.hands[s.turn][m.drop]--;
  } else {
    const [fr, fc] = m.from, pc = s.b[fr][fc];
    m.cap = s.b[tr][tc];
    if (m.cap && m.cap.t !== 'K') s.hands[s.turn][m.cap.t]++;
    s.b[tr][tc] = m.promo ? { t: pc.t, o: pc.o, p: true } : pc;
    s.b[fr][fc] = null;
    m.moved = pc;
  }
  s.turn ^= 1;
}
function undo(s, m) {
  s.turn ^= 1;
  const [tr, tc] = m.to;
  if (m.drop) {
    s.b[tr][tc] = null;
    s.hands[s.turn][m.drop]++;
  } else {
    const [fr, fc] = m.from;
    s.b[fr][fc] = m.moved;
    s.b[tr][tc] = m.cap;
    if (m.cap && m.cap.t !== 'K') s.hands[s.turn][m.cap.t]--;
  }
}

function attacks(s, r, c, tr, tc) {
  const pc = s.b[r][c], mv = MOVES[pc.o][pkey(pc)];
  const dr = tr - r, dc = tc - c;
  for (const [a, b] of mv.steps) if (a === dr && b === dc) return true;
  for (const [a, b] of mv.slides) {
    let x = r + a, y = c + b;
    while (x >= 0 && x <= 8 && y >= 0 && y <= 8) {
      if (x === tr && y === tc) return true;
      if (s.b[x][y]) break;
      x += a; y += b;
    }
  }
  return false;
}
function attacked(s, tr, tc, by) {
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const p = s.b[r][c];
    if (p && p.o === by && attacks(s, r, c, tr, tc)) return true;
  }
  return false;
}
function inCheck(s, side) {
  const k = findKing(s, side);
  return k ? attacked(s, k[0], k[1], side ^ 1) : false;
}

function legalMoves(s, skipUchi) {
  const side = s.turn, res = [];
  for (const m of genMoves(s)) {
    apply(s, m);
    let ok = !inCheck(s, side);
    if (ok && !skipUchi && m.drop === 'P') {
      // uchifuzume: pawn drop that checkmates is illegal
      const [r, c] = m.to, kr = r + (side === 0 ? -1 : 1);
      const k = s.b[kr] && s.b[kr][c];
      if (k && k.t === 'K' && k.o !== side && legalMoves(s, true).length === 0) ok = false;
    }
    undo(s, m);
    if (ok) res.push(m);
  }
  return res;
}

function evaluate(s) {
  let score = 0;
  const kings = [findKing(s, 0), findKing(s, 1)];
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const p = s.b[r][c];
    if (!p) continue;
    let v = p.p ? PVAL[p.t] : VAL[p.t];
    const rel = p.o === 0 ? 8 - r : r; // 0 = own back rank
    if (!p.p && (p.t === 'P' || p.t === 'S')) v += rel * 4;
    if ((p.t === 'G' || p.t === 'S') && !p.p && kings[p.o]) {
      const k = kings[p.o];
      if (Math.max(Math.abs(k[0] - r), Math.abs(k[1] - c)) <= 1) v += 28;
    }
    if (p.p || p.t === 'R' || p.t === 'B' || p.t === 'S' || p.t === 'G' || p.t === 'N') {
      const k = kings[p.o ^ 1];
      if (k) v += Math.max(0, 5 - Math.max(Math.abs(k[0] - r), Math.abs(k[1] - c))) * 6;
    }
    score += p.o === s.turn ? v : -v;
  }
  for (const side of [0, 1]) {
    let h = 0;
    for (const t of HAND_ORDER) h += s.hands[side][t] * VAL[t] * 1.12;
    score += side === s.turn ? h : -h;
  }
  return score;
}

let EVAL_FN = evaluate;
function setEval(f){EVAL_FN=f}
function orderScore(m) {
  let v = 0;
  if (m.cap) v += 10 * (m.cap.p ? PVAL[m.cap.t] : VAL[m.cap.t] || 50000) - VAL[m.pt] / 10;
  if (m.promo) v += 400;
  if (m.drop) v -= 50;
  return v;
}
let nodes = 0;
function qsearch(s, alpha, beta, qd) {
  nodes++;
  const stand = EVAL_FN(s);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (qd >= 4) return stand;
  const moves = genMoves(s, { capsOnly: true });
  for (const m of moves) if (m.cap && m.cap.t === 'K') return MATE;
  moves.sort((a, b) => orderScore(b) - orderScore(a));
  for (const m of moves) {
    apply(s, m);
    const v = -qsearch(s, -beta, -alpha, qd + 1);
    undo(s, m);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}
function search(s, depth, alpha, beta, ply) {
  if (depth <= 0) return qsearch(s, alpha, beta, 0);
  nodes++;
  const ek = findKing(s, s.turn ^ 1);
  const moves = genMoves(s, { dropNear: ek || [4, 4] });
  for (const m of moves) if (m.cap && m.cap.t === 'K') return MATE - ply;
  moves.sort((a, b) => orderScore(b) - orderScore(a));
  let best = -MATE * 2;
  for (const m of moves) {
    apply(s, m);
    const v = -search(s, depth - 1, -beta, -alpha, ply + 1);
    undo(s, m);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  return best;
}
function bestMove(s, depth, noise = 0) {
  const moves = legalMoves(s);
  if (!moves.length) return null;
  moves.sort((a, b) => orderScore(b) - orderScore(a));
  let best = null, bestV = -Infinity, alpha = -MATE * 2;
  nodes = 0;
  for (const m of moves) {
    apply(s, m);
    let v = -search(s, depth - 1, -MATE * 2, noise ? MATE * 2 : -alpha, 1);
    undo(s, m);
    if (noise) v += (Math.random() - .5) * noise;
    if (v > bestV) { bestV = v; best = m; }
    if (v > alpha) alpha = v;
  }
  return best;
}
function positionKey(s) {
  let k = s.turn + ':';
  for (let r = 0; r < 9; r++) for (let c = 0; c < 9; c++) {
    const p = s.b[r][c];
    k += p ? (p.o ? pkey(p).toLowerCase() : pkey(p)) : '.';
  }
  for (const side of [0, 1]) for (const t of HAND_ORDER) k += s.hands[side][t];
  return k;
}

if (typeof module !== 'undefined') module.exports = { setEval, genPieceMoves, initialState, legalMoves, apply, undo, bestMove, inCheck, genMoves, positionKey, evaluate, findKing, attacked, search, qsearch, MOVES, VAL, PVAL, HAND_ORDER };

