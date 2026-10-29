/* ================= CHESS ENGINE ================= */
// Board: b[r][c], r = 0 is rank 8 (Black's back rank), c = 0 is the a-file.
// Pieces: {t: 'P'|'N'|'B'|'R'|'Q'|'K', o: 0 (White) | 1 (Black)}.
const VAL = { P: 100, N: 320, B: 330, R: 500, Q: 900, K: 0 };
const MATE = 100000;
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
const ORTHO = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const PROMOS = ['Q', 'R', 'B', 'N'];
const FILES = 'abcdefgh';

const sqName = (r, c) => FILES[c] + (8 - r);
const parseSq = n => [8 - +n[1], FILES.indexOf(n[0])];

function initialState() { return parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'); }

function parseFen(fen) {
  const [board, side, cast, ep, half, full] = fen.trim().split(/\s+/);
  const b = Array.from({ length: 8 }, () => Array(8).fill(null));
  board.split('/').forEach((row, r) => {
    let c = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) { c += +ch; continue; }
      const up = ch.toUpperCase();
      b[r][c++] = { t: up, o: ch === up ? 0 : 1 };
    }
  });
  return {
    b, turn: side === 'b' ? 1 : 0,
    castle: { K: cast.includes('K'), Q: cast.includes('Q'), k: cast.includes('k'), q: cast.includes('q') },
    ep: ep && ep !== '-' ? parseSq(ep) : null,
    half: +(half || 0), full: +(full || 1),
  };
}
function toFen(s) {
  const rows = s.b.map(row => {
    let out = '', e = 0;
    for (const p of row) {
      if (!p) { e++; continue; }
      if (e) { out += e; e = 0; }
      out += p.o ? p.t.toLowerCase() : p.t;
    }
    return out + (e || '');
  });
  const c = s.castle, cast = (c.K ? 'K' : '') + (c.Q ? 'Q' : '') + (c.k ? 'k' : '') + (c.q ? 'q' : '');
  return `${rows.join('/')} ${s.turn ? 'b' : 'w'} ${cast || '-'} ${s.ep ? sqName(...s.ep) : '-'} ${s.half} ${s.full}`;
}

function attacked(s, r, c, by) {
  const b = s.b;
  // pawns: a White pawn attacks upward (r - 1), so it sits at r + 1
  const pr = by === 0 ? r + 1 : r - 1;
  if (pr >= 0 && pr < 8) for (const dc of [-1, 1]) {
    const p = b[pr][c + dc];
    if (p && p.o === by && p.t === 'P') return true;
  }
  for (const [dr, dc] of KNIGHT) {
    const x = r + dr, y = c + dc;
    if (x < 0 || x > 7 || y < 0 || y > 7) continue;
    const p = b[x][y];
    if (p && p.o === by && p.t === 'N') return true;
  }
  for (const [dr, dc] of KING) {
    const x = r + dr, y = c + dc;
    if (x < 0 || x > 7 || y < 0 || y > 7) continue;
    const p = b[x][y];
    if (p && p.o === by && p.t === 'K') return true;
  }
  for (const [dirs, a, q] of [[ORTHO, 'R', 'Q'], [DIAG, 'B', 'Q']]) for (const [dr, dc] of dirs) {
    let x = r + dr, y = c + dc;
    while (x >= 0 && x < 8 && y >= 0 && y < 8) {
      const p = b[x][y];
      if (p) { if (p.o === by && (p.t === a || p.t === q)) return true; break; }
      x += dr; y += dc;
    }
  }
  return false;
}
function findKing(s, side) {
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = s.b[r][c]; if (p && p.t === 'K' && p.o === side) return [r, c]; }
  return null;
}
function inCheck(s, side) { const k = findKing(s, side); return k ? attacked(s, k[0], k[1], side ^ 1) : false; }

// Pseudo-legal moves (may leave own king in check). capsOnly: captures and promotions only.
function genMoves(s, capsOnly) {
  const out = [], side = s.turn, b = s.b;
  const add = (fr, fc, tr, tc, extra) => out.push({ from: [fr, fc], to: [tr, tc], pt: b[fr][fc].t, cap: b[tr][tc], promo: null, ...extra });
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = b[r][c];
    if (!p || p.o !== side) continue;
    if (p.t === 'P') {
      const dir = side === 0 ? -1 : 1, start = side === 0 ? 6 : 1, last = side === 0 ? 0 : 7;
      const r1 = r + dir;
      if (r1 >= 0 && r1 < 8 && !b[r1][c]) {
        if (r1 === last) for (const pr of PROMOS) add(r, c, r1, c, { promo: pr });
        else if (!capsOnly) {
          add(r, c, r1, c);
          if (r === start && !b[r + 2 * dir][c]) add(r, c, r + 2 * dir, c, { double: true });
        }
      }
      for (const dc of [-1, 1]) {
        const tc = c + dc;
        if (tc < 0 || tc > 7 || r1 < 0 || r1 > 7) continue;
        const t = b[r1][tc];
        if (t && t.o !== side) {
          if (r1 === last) for (const pr of PROMOS) add(r, c, r1, tc, { promo: pr });
          else add(r, c, r1, tc);
        } else if (!t && s.ep && s.ep[0] === r1 && s.ep[1] === tc) {
          out.push({ from: [r, c], to: [r1, tc], pt: 'P', cap: b[r][tc], promo: null, ep: true });
        }
      }
      continue;
    }
    if (p.t === 'N' || p.t === 'K') {
      for (const [dr, dc] of p.t === 'N' ? KNIGHT : KING) {
        const x = r + dr, y = c + dc;
        if (x < 0 || x > 7 || y < 0 || y > 7) continue;
        const t = b[x][y];
        if (t && t.o === side) continue;
        if (capsOnly && !t) continue;
        add(r, c, x, y);
      }
      if (p.t === 'K' && !capsOnly) genCastles(s, r, c, out);
      continue;
    }
    const dirs = p.t === 'R' ? ORTHO : p.t === 'B' ? DIAG : KING;
    for (const [dr, dc] of dirs) {
      let x = r + dr, y = c + dc;
      while (x >= 0 && x < 8 && y >= 0 && y < 8) {
        const t = b[x][y];
        if (t && t.o === side) break;
        if (!capsOnly || t) add(r, c, x, y);
        if (t) break;
        x += dr; y += dc;
      }
    }
  }
  return out;
}
function genCastles(s, r, c, out) {
  const side = s.turn, home = side === 0 ? 7 : 0, b = s.b, opp = side ^ 1;
  if (r !== home || c !== 4) return;
  const [kSide, qSide] = side === 0 ? ['K', 'Q'] : ['k', 'q'];
  if (attacked(s, r, 4, opp)) return;
  const rook = (cc) => { const p = b[home][cc]; return p && p.t === 'R' && p.o === side; };
  if (s.castle[kSide] && rook(7) && !b[home][5] && !b[home][6] && !attacked(s, home, 5, opp) && !attacked(s, home, 6, opp))
    out.push({ from: [home, 4], to: [home, 6], pt: 'K', cap: null, promo: null, castle: 'K' });
  if (s.castle[qSide] && rook(0) && !b[home][1] && !b[home][2] && !b[home][3] && !attacked(s, home, 3, opp) && !attacked(s, home, 2, opp))
    out.push({ from: [home, 4], to: [home, 2], pt: 'K', cap: null, promo: null, castle: 'Q' });
}

function apply(s, m) {
  const b = s.b, side = s.turn, [fr, fc] = m.from, [tr, tc] = m.to;
  m.undo = { castle: { ...s.castle }, ep: s.ep, half: s.half, full: s.full, moved: b[fr][fc], captured: b[tr][tc] };
  const pc = b[fr][fc];
  if (m.ep) b[fr][tc] = null;
  b[tr][tc] = m.promo ? { t: m.promo, o: side } : pc;
  b[fr][fc] = null;
  if (m.castle) {
    const home = fr;
    if (m.castle === 'K') { b[home][5] = b[home][7]; b[home][7] = null; }
    else { b[home][3] = b[home][0]; b[home][0] = null; }
  }
  if (pc.t === 'K') { if (side === 0) s.castle.K = s.castle.Q = false; else s.castle.k = s.castle.q = false; }
  const touch = (r, c) => {
    if (r === 7 && c === 7) s.castle.K = false; if (r === 7 && c === 0) s.castle.Q = false;
    if (r === 0 && c === 7) s.castle.k = false; if (r === 0 && c === 0) s.castle.q = false;
  };
  touch(fr, fc); touch(tr, tc);
  s.ep = m.double ? [(fr + tr) / 2, fc] : null;
  s.half = pc.t === 'P' || m.cap ? 0 : s.half + 1;
  if (side === 1) s.full++;
  s.turn ^= 1;
}
function undo(s, m) {
  s.turn ^= 1;
  const b = s.b, [fr, fc] = m.from, [tr, tc] = m.to, u = m.undo;
  b[fr][fc] = u.moved;
  b[tr][tc] = m.ep ? null : u.captured;
  if (m.ep) b[fr][tc] = m.cap;
  if (m.castle) {
    const home = fr;
    if (m.castle === 'K') { b[home][7] = b[home][5]; b[home][5] = null; }
    else { b[home][0] = b[home][3]; b[home][3] = null; }
  }
  s.castle = u.castle; s.ep = u.ep; s.half = u.half; s.full = u.full;
}

function legalMoves(s) {
  const side = s.turn, res = [];
  for (const m of genMoves(s)) {
    apply(s, m);
    if (!inCheck(s, side)) res.push(m);
    undo(s, m);
  }
  return res;
}

function insufficientMaterial(s) {
  const minors = [];
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = s.b[r][c];
    if (!p || p.t === 'K') continue;
    if (p.t === 'P' || p.t === 'R' || p.t === 'Q') return false;
    minors.push({ t: p.t, color: (r + c) % 2 });
  }
  if (minors.length <= 1) return true;
  return minors.every(m => m.t === 'B' && m.color === minors[0].color);
}

// Piece-square tables from White's view (row 0 = rank 8), in centipawns.
const PST = {
  P: [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
  N: [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
  B: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
  R: [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
  Q: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
  K: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20],
  KE: [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30, -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50],
};
function evaluate(s) {
  let score = 0, nonPawn = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = s.b[r][c]; if (p && p.t !== 'P' && p.t !== 'K') nonPawn += VAL[p.t]; }
  const endgame = nonPawn <= 1300;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = s.b[r][c];
    if (!p) continue;
    const idx = p.o === 0 ? r * 8 + c : (7 - r) * 8 + c;
    const v = VAL[p.t] + (p.t === 'K' && endgame ? PST.KE : PST[p.t])[idx];
    score += p.o === s.turn ? v : -v;
  }
  return score;
}
let EVAL_FN = evaluate;
function setEval(f) { EVAL_FN = f; }

function orderScore(m) {
  let v = 0;
  if (m.cap) v += 10 * VAL[m.cap.t] - VAL[m.pt] / 10 + 1000;
  if (m.promo) v += VAL[m.promo];
  return v;
}
function qsearch(s, alpha, beta, qd) {
  const stand = EVAL_FN(s);
  if (stand >= beta) return stand;
  if (stand > alpha) alpha = stand;
  if (qd >= 6) return stand;
  const moves = genMoves(s, true);
  moves.sort((a, b) => orderScore(b) - orderScore(a));
  const side = s.turn;
  for (const m of moves) {
    if (m.cap && m.cap.t === 'K') return MATE;
    apply(s, m);
    if (inCheck(s, side)) { undo(s, m); continue; }
    const v = -qsearch(s, -beta, -alpha, qd + 1);
    undo(s, m);
    if (v >= beta) return v;
    if (v > alpha) alpha = v;
  }
  return alpha;
}
function search(s, depth, alpha, beta, ply) {
  if (depth <= 0) return qsearch(s, alpha, beta, 0);
  const side = s.turn, moves = genMoves(s);
  moves.sort((a, b) => orderScore(b) - orderScore(a));
  let best = -MATE * 2, any = false;
  for (const m of moves) {
    apply(s, m);
    if (inCheck(s, side)) { undo(s, m); continue; }
    any = true;
    const v = -search(s, depth - 1, -beta, -alpha, ply + 1);
    undo(s, m);
    if (v > best) best = v;
    if (v > alpha) alpha = v;
    if (alpha >= beta) break;
  }
  if (!any) return inCheck(s, side) ? -(MATE - ply) : 0; // checkmate or stalemate
  return best;
}
function bestMove(s, depth, noise = 0) {
  const moves = legalMoves(s);
  if (!moves.length) return null;
  moves.sort((a, b) => orderScore(b) - orderScore(a));
  let best = null, bestV = -Infinity, alpha = -MATE * 2;
  for (const m of moves) {
    apply(s, m);
    let v = -search(s, depth - 1, -MATE * 2, noise ? MATE * 2 : -alpha, 1);
    undo(s, m);
    if (noise) v += (Math.random() - 0.5) * noise;
    if (v > bestV) { bestV = v; best = m; }
    if (v > alpha) alpha = v;
  }
  return best;
}
function positionKey(s) { return toFen(s).split(' ').slice(0, 4).join(' '); }

// Long algebraic for engines and storage: e2e4, e7e8q.
const toUci = m => sqName(...m.from) + sqName(...m.to) + (m.promo ? m.promo.toLowerCase() : '');
const fromUci = (s, u, legal) => (legal || legalMoves(s)).find(m => toUci(m) === u) || null;
// Standard algebraic notation: Nf3, exd5, O-O, e8=Q+, Qxf7#.
function toSan(s, m, legal) {
  legal = legal || legalMoves(s);
  let san;
  if (m.castle) san = m.castle === 'K' ? 'O-O' : 'O-O-O';
  else {
    const cap = !!m.cap;
    if (m.pt === 'P') san = (cap ? FILES[m.from[1]] + 'x' : '') + sqName(...m.to) + (m.promo ? '=' + m.promo : '');
    else {
      const rivals = legal.filter(o => o.pt === m.pt && o.to[0] === m.to[0] && o.to[1] === m.to[1] && (o.from[0] !== m.from[0] || o.from[1] !== m.from[1]));
      let dis = '';
      if (rivals.length) {
        if (!rivals.some(o => o.from[1] === m.from[1])) dis = FILES[m.from[1]];
        else if (!rivals.some(o => o.from[0] === m.from[0])) dis = String(8 - m.from[0]);
        else dis = sqName(...m.from);
      }
      san = m.pt + dis + (cap ? 'x' : '') + sqName(...m.to);
    }
  }
  apply(s, m);
  const chk = inCheck(s, s.turn);
  const mate = chk && legalMoves(s).length === 0;
  undo(s, m);
  return san + (mate ? '#' : chk ? '+' : '');
}

if (typeof module !== 'undefined') module.exports = { initialState, parseFen, toFen, legalMoves, genMoves, apply, undo, inCheck, attacked, findKing, evaluate, setEval, search, qsearch, bestMove, positionKey, insufficientMaterial, toUci, fromUci, toSan, sqName, parseSq, VAL, MATE, KNIGHT, KING, ORTHO, DIAG };
