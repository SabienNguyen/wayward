// SFEN / USI helpers. Browser-safe: assumes engine.js functions are globals
// (legalMoves, apply, undo). Board indexing follows engine.js:
// row r = rank 'abcdefghi'[r] (a = Gote's back rank), column c = file 9 - c.
const RANKS = 'abcdefghi';
const HAND_ORDER_USI = ['R', 'B', 'G', 'S', 'N', 'L', 'P'];

function sqName(r, c) { return String(9 - c) + RANKS[r]; }
function parseSq(str) {
  const f = parseInt(str[0], 10), rk = RANKS.indexOf(str[1]);
  if (!(f >= 1 && f <= 9) || rk < 0) return null;
  return [rk, 9 - f];
}

// SFEN: "<board> <b|w> <hands|-> [moveNo]"
function parseSfen(str) {
  const parts = str.trim().split(/\s+/);
  const rows = parts[0].split('/');
  if (rows.length !== 9) throw new Error('bad SFEN board: ' + str);
  const b = [];
  for (let r = 0; r < 9; r++) {
    const row = Array(9).fill(null);
    let c = 0, promo = false;
    for (const ch of rows[r]) {
      if (ch === '+') { promo = true; continue; }
      if (/[1-9]/.test(ch)) { c += +ch; promo = false; continue; }
      const up = ch.toUpperCase();
      if (!/[RBGSNLPK]/.test(up)) throw new Error('bad SFEN piece: ' + ch);
      row[c] = { t: up, o: ch === up ? 0 : 1, p: promo };
      c++; promo = false;
    }
    if (c !== 9) throw new Error('bad SFEN row width: ' + rows[r]);
    b.push(row);
  }
  const hands = [{ R: 0, B: 0, G: 0, S: 0, N: 0, L: 0, P: 0 }, { R: 0, B: 0, G: 0, S: 0, N: 0, L: 0, P: 0 }];
  if (parts[2] && parts[2] !== '-') {
    let n = '';
    for (const ch of parts[2]) {
      if (/[0-9]/.test(ch)) { n += ch; continue; }
      const up = ch.toUpperCase();
      hands[ch === up ? 0 : 1][up] += n ? +n : 1;
      n = '';
    }
  }
  return { b, hands, turn: parts[1] === 'w' ? 1 : 0, moveNo: parts[3] ? +parts[3] : 1 };
}

function toSfen(s) {
  let out = '';
  for (let r = 0; r < 9; r++) {
    let empty = 0, row = '';
    for (let c = 0; c < 9; c++) {
      const p = s.b[r][c];
      if (!p) { empty++; continue; }
      if (empty) { row += empty; empty = 0; }
      const ch = p.o === 0 ? p.t : p.t.toLowerCase();
      row += (p.p ? '+' : '') + ch;
    }
    if (empty) row += empty;
    out += (r ? '/' : '') + row;
  }
  let hand = '';
  for (const side of [0, 1]) for (const t of HAND_ORDER_USI) {
    const n = s.hands[side][t];
    if (!n) continue;
    hand += (n > 1 ? n : '') + (side === 0 ? t : t.toLowerCase());
  }
  return out + ' ' + (s.turn === 0 ? 'b' : 'w') + ' ' + (hand || '-') + ' ' + (s.moveNo || 1);
}

// USI for a move object from legalMoves(). Works with the move alone.
function moveToUsi(m) {
  if (m.drop) return m.drop + '*' + sqName(m.to[0], m.to[1]);
  return sqName(m.from[0], m.from[1]) + sqName(m.to[0], m.to[1]) + (m.promo ? '+' : '');
}

// Returns the legal move object matching the USI string in state s, or null.
function usiToMove(s, str) {
  if (typeof str !== 'string') return null;
  for (const m of legalMoves(s)) if (moveToUsi(m) === str) return m;
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { parseSfen, toSfen, moveToUsi, usiToMove, sqName, parseSq };
}
