/* ================= BRAIN: fast search engine =================
 * A self-contained engine for the stronger levels. It runs in a Web Worker
 * so the board stays responsive while it thinks.
 *
 * Board: 10x12 mailbox in an Int8Array. Index = (row + 2) * 10 + (col + 1),
 * row 0 = rank 8, so a8 = 21, h8 = 28, a1 = 91, h1 = 98. Off-board = 7.
 * Pieces: 1..6 = White P N B R Q K, 9..14 = Black (8 | type), 0 = empty.
 * Moves are ints: from | to << 7 | promo << 14 | flags << 17.
 */
const Brain = (function () {
  const EMPTY = 0, OFF = 7;
  const P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  const F_CAP = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8;
  const N_DIRS = [-21, -19, -12, -8, 8, 12, 19, 21];
  const K_DIRS = [-11, -10, -9, -1, 1, 9, 10, 11];
  const B_DIRS = [-11, -9, 9, 11];
  const R_DIRS = [-10, -1, 1, 10];
  const VAL_MG = [0, 82, 337, 365, 477, 1025, 0];
  const VAL_EG = [0, 94, 281, 297, 512, 936, 0];
  const PHASE_W = [0, 0, 1, 1, 2, 4, 0];
  const MATE = 30000, INF = 32000;

  // Piece-square tables, White's view, row 0 = rank 8 (64 entries).
  const PST_MG = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 60, 70, 60, 70, 70, 60, 70, 60, 10, 15, 25, 35, 35, 25, 15, 10, 0, 5, 10, 25, 25, 10, 5, 0, -5, 0, 5, 20, 20, 5, 0, -5, -5, -5, 0, 5, 5, 0, -5, -5, -5, 5, 5, -15, -15, 5, 5, -5, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-60, -40, -30, -30, -30, -30, -40, -60, -40, -20, 0, 5, 5, 0, -20, -40, -30, 5, 15, 20, 20, 15, 5, -30, -30, 5, 20, 25, 25, 20, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 12, 15, 15, 12, 5, -30, -40, -20, 0, 5, 5, 0, -20, -40, -60, -30, -30, -30, -30, -30, -30, -60],
    3: [-20, -10, -10, -10, -10, -10, -10, -20, -10, 5, 0, 0, 0, 0, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 0, 10, 15, 15, 10, 0, -10, -10, 5, 10, 15, 15, 10, 5, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 15, 0, 5, 5, 0, 15, -10, -20, -10, -15, -10, -10, -15, -10, -20],
    4: [5, 5, 5, 10, 10, 5, 5, 5, 15, 20, 20, 20, 20, 20, 20, 15, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -10, 0, 0, 0, 0, 0, 0, -10, -5, -5, 0, 10, 10, 5, -5, -5],
    5: [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, -5, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, 0, -5, -10, -10, -20],
    6: [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -25, -25, -20, -20, -10, 15, 15, -5, -15, -15, -5, 15, 15, 20, 35, 15, -10, 0, -10, 35, 20],
  };
  const PST_EG = {
    1: [0, 0, 0, 0, 0, 0, 0, 0, 140, 135, 130, 120, 120, 130, 135, 140, 90, 90, 80, 70, 70, 80, 90, 90, 45, 40, 35, 30, 30, 35, 40, 45, 25, 20, 15, 10, 10, 15, 20, 25, 10, 10, 5, 5, 5, 5, 10, 10, 10, 10, 5, 0, 0, 5, 10, 10, 0, 0, 0, 0, 0, 0, 0, 0],
    2: [-50, -35, -20, -20, -20, -20, -35, -50, -35, -15, 0, 0, 0, 0, -15, -35, -20, 0, 10, 15, 15, 10, 0, -20, -20, 5, 15, 20, 20, 15, 5, -20, -20, 5, 15, 20, 20, 15, 5, -20, -20, 0, 10, 15, 15, 10, 0, -20, -35, -15, 0, 0, 0, 0, -15, -35, -50, -35, -20, -20, -20, -20, -35, -50],
    3: [-15, -10, -10, -5, -5, -10, -10, -15, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10, -5, 5, 5, 10, 10, 5, 5, -5, -5, 5, 5, 10, 10, 5, 5, -5, -10, 0, 5, 5, 5, 5, 0, -10, -10, 0, 0, 0, 0, 0, 0, -10, -15, -10, -10, -5, -5, -10, -10, -15],
    4: [10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10, 5, 5, 5, 5, 5, 5, 5, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -5, -10, -5, -5, -5, -5, -5, -5, -10],
    5: [-10, -5, 0, 5, 5, 0, -5, -10, -5, 0, 5, 10, 10, 5, 0, -5, 0, 5, 10, 15, 15, 10, 5, 0, 5, 10, 15, 20, 20, 15, 10, 5, 5, 10, 15, 20, 20, 15, 10, 5, 0, 5, 10, 15, 15, 10, 5, 0, -5, 0, 5, 10, 10, 5, 0, -5, -10, -5, 0, 5, 5, 0, -5, -10],
    6: [-50, -35, -25, -20, -20, -25, -35, -50, -30, -15, -5, 0, 0, -5, -15, -30, -25, -5, 15, 25, 25, 15, -5, -25, -20, 0, 25, 35, 35, 25, 0, -20, -20, 0, 25, 35, 35, 25, 0, -20, -25, -5, 15, 25, 25, 15, -5, -25, -30, -15, -5, 0, 0, -5, -15, -30, -50, -35, -25, -20, -20, -25, -35, -50],
  };
  const PASSED_MG = [0, 0, 5, 10, 18, 30, 50, 0], PASSED_EG = [0, 0, 10, 20, 40, 70, 110, 0];

  const sq120 = (row, col) => (row + 2) * 10 + col + 1;
  const SQ64 = new Int8Array(120).fill(-1);
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) SQ64[sq120(r, c)] = r * 8 + c;
  const FILES = 'abcdefgh';
  const name = sq => { const i = SQ64[sq]; return FILES[i % 8] + (8 - (i >> 3)); };
  const parse = n => sq120(8 - +n[1], FILES.indexOf(n[0]));

  // Zobrist keys: two 32-bit halves.
  let seed = 0x9e3779b9;
  const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return seed >>> 0; };
  const ZP = [new Uint32Array(16 * 120), new Uint32Array(16 * 120)];
  const ZC = [new Uint32Array(16), new Uint32Array(16)], ZE = [new Uint32Array(120), new Uint32Array(120)];
  for (let i = 0; i < 16 * 120; i++) { ZP[0][i] = rnd(); ZP[1][i] = rnd(); }
  for (let i = 0; i < 16; i++) { ZC[0][i] = rnd(); ZC[1][i] = rnd(); }
  for (let i = 0; i < 120; i++) { ZE[0][i] = rnd(); ZE[1][i] = rnd(); }
  const ZS = [rnd(), rnd()];

  // Castling rights mask: rights kept when a move touches a square.
  const CASTLE_MASK = new Uint8Array(120).fill(15);
  CASTLE_MASK[98] = 15 & ~1; CASTLE_MASK[91] = 15 & ~2; CASTLE_MASK[95] = 15 & ~3;
  CASTLE_MASK[28] = 15 & ~4; CASTLE_MASK[21] = 15 & ~8; CASTLE_MASK[25] = 15 & ~12;

  function Pos() {
    this.b = new Int8Array(120).fill(OFF);
    this.side = 0; this.castle = 0; this.ep = 0; this.half = 0; this.full = 1;
    this.h0 = 0; this.h1 = 0; this.ksq = [0, 0];
    this.ply = 0;
    this.hist0 = new Uint32Array(1024); this.hist1 = new Uint32Array(1024); // hashes along the game + search path
    this.uMove = new Int32Array(1024); this.uCap = new Int8Array(1024); this.uCastle = new Uint8Array(1024);
    this.uEp = new Uint8Array(1024); this.uHalf = new Int16Array(1024); this.uH0 = new Uint32Array(1024); this.uH1 = new Uint32Array(1024);
  }
  function fromFen(fen, history) {
    const p = new Pos();
    const [board, side, cast, ep, half, full] = fen.trim().split(/\s+/);
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) p.b[sq120(r, c)] = EMPTY;
    board.split('/').forEach((row, r) => {
      let c = 0;
      for (const ch of row) {
        if (/\d/.test(ch)) { c += +ch; continue; }
        const t = 'PNBRQK'.indexOf(ch.toUpperCase()) + 1, col = ch === ch.toUpperCase() ? 0 : 8;
        const sq = sq120(r, c++);
        p.b[sq] = t | col;
        if (t === K) p.ksq[col ? 1 : 0] = sq;
      }
    });
    p.side = side === 'b' ? 1 : 0;
    p.castle = (cast.includes('K') ? 1 : 0) | (cast.includes('Q') ? 2 : 0) | (cast.includes('k') ? 4 : 0) | (cast.includes('q') ? 8 : 0);
    p.ep = ep && ep !== '-' ? parse(ep) : 0;
    p.half = +(half || 0); p.full = +(full || 1);
    rehash(p);
    p.ply = 0;
    p.histLen = 0;
    for (const h of history || []) { p.hist0[p.histLen] = h[0]; p.hist1[p.histLen] = h[1]; p.histLen++; }
    return p;
  }
  function rehash(p) {
    let h0 = 0, h1 = 0;
    for (let sq = 21; sq <= 98; sq++) { const pc = p.b[sq]; if (pc && pc !== OFF) { h0 ^= ZP[0][pc * 120 + sq]; h1 ^= ZP[1][pc * 120 + sq]; } }
    h0 ^= ZC[0][p.castle]; h1 ^= ZC[1][p.castle];
    if (p.ep) { h0 ^= ZE[0][p.ep]; h1 ^= ZE[1][p.ep]; }
    if (p.side) { h0 ^= ZS[0]; h1 ^= ZS[1]; }
    p.h0 = h0 >>> 0; p.h1 = h1 >>> 0;
  }

  function attacked(p, sq, by) {
    const b = p.b, c = by << 3;
    const pd = by === 0 ? 10 : -10; // a White pawn attacks upward, so it sits below (+10)
    if (b[sq + pd - 1] === (P | c) || b[sq + pd + 1] === (P | c)) return true;
    for (let i = 0; i < 8; i++) { if (b[sq + N_DIRS[i]] === (N | c)) return true; if (b[sq + K_DIRS[i]] === (K | c)) return true; }
    for (let i = 0; i < 4; i++) {
      let t = sq + B_DIRS[i];
      while (b[t] === EMPTY) t += B_DIRS[i];
      if (b[t] === (B | c) || b[t] === (Q | c)) return true;
      t = sq + R_DIRS[i];
      while (b[t] === EMPTY) t += R_DIRS[i];
      if (b[t] === (R | c) || b[t] === (Q | c)) return true;
    }
    return false;
  }
  const inCheck = (p, side) => attacked(p, p.ksq[side], side ^ 1);

  // Pseudo-legal moves into out (Int32Array); returns count. capsOnly: captures + queen promotions.
  function gen(p, out, capsOnly) {
    const b = p.b, side = p.side, me = side << 3, opp = 8 - me;
    let n = 0;
    const add = (f, t, promo, flags) => { out[n++] = f | (t << 7) | (promo << 14) | (flags << 17); };
    const fwd = side ? 10 : -10, startRow = side ? 1 : 6, lastRow = side ? 7 : 0;
    for (let f = 21; f <= 98; f++) {
      const pc = b[f];
      if (pc === EMPTY || pc === OFF || (pc & 8) !== me) continue;
      const t = pc & 7;
      if (t === P) {
        const row = (SQ64[f] >> 3);
        const one = f + fwd;
        if (b[one] === EMPTY) {
          if ((SQ64[one] >> 3) === lastRow) { add(f, one, Q, 0); if (!capsOnly) { add(f, one, N, 0); add(f, one, R, 0); add(f, one, B, 0); } }
          else if (!capsOnly) { add(f, one, 0, 0); if (row === startRow && b[one + fwd] === EMPTY) add(f, one + fwd, 0, F_DOUBLE); }
        }
        for (const d of [fwd - 1, fwd + 1]) {
          const to = f + d, x = b[to];
          if (x !== EMPTY && x !== OFF && (x & 8) === opp) {
            if ((SQ64[to] >> 3) === lastRow) { add(f, to, Q, F_CAP); if (!capsOnly) { add(f, to, N, F_CAP); add(f, to, R, F_CAP); add(f, to, B, F_CAP); } }
            else add(f, to, 0, F_CAP);
          } else if (to === p.ep && p.ep) add(f, to, 0, F_CAP | F_EP);
        }
        continue;
      }
      if (t === N || t === K) {
        const dirs = t === N ? N_DIRS : K_DIRS;
        for (let i = 0; i < 8; i++) {
          const to = f + dirs[i], x = b[to];
          if (x === OFF) continue;
          if (x === EMPTY) { if (!capsOnly) add(f, to, 0, 0); }
          else if ((x & 8) === opp) add(f, to, 0, F_CAP);
        }
        if (t === K && !capsOnly) {
          if (side === 0 && f === 95) {
            if ((p.castle & 1) && b[96] === EMPTY && b[97] === EMPTY && b[98] === (R) && !attacked(p, 95, 1) && !attacked(p, 96, 1) && !attacked(p, 97, 1)) add(95, 97, 0, F_CASTLE);
            if ((p.castle & 2) && b[94] === EMPTY && b[93] === EMPTY && b[92] === EMPTY && b[91] === (R) && !attacked(p, 95, 1) && !attacked(p, 94, 1) && !attacked(p, 93, 1)) add(95, 93, 0, F_CASTLE);
          } else if (side === 1 && f === 25) {
            if ((p.castle & 4) && b[26] === EMPTY && b[27] === EMPTY && b[28] === (R | 8) && !attacked(p, 25, 0) && !attacked(p, 26, 0) && !attacked(p, 27, 0)) add(25, 27, 0, F_CASTLE);
            if ((p.castle & 8) && b[24] === EMPTY && b[23] === EMPTY && b[22] === EMPTY && b[21] === (R | 8) && !attacked(p, 25, 0) && !attacked(p, 24, 0) && !attacked(p, 23, 0)) add(25, 23, 0, F_CASTLE);
          }
        }
        continue;
      }
      const dirs = t === B ? B_DIRS : t === R ? R_DIRS : K_DIRS;
      for (let i = 0; i < dirs.length; i++) {
        let to = f + dirs[i];
        for (;;) {
          const x = b[to];
          if (x === OFF) break;
          if (x === EMPTY) { if (!capsOnly) add(f, to, 0, 0); to += dirs[i]; continue; }
          if ((x & 8) === opp) add(f, to, 0, F_CAP);
          break;
        }
      }
    }
    return n;
  }

  function make(p, m) {
    const b = p.b, f = m & 127, t = (m >> 7) & 127, promo = (m >> 14) & 7, flags = m >> 17;
    const side = p.side, pc = b[f], ply = p.ply;
    p.uMove[ply] = m; p.uCastle[ply] = p.castle; p.uEp[ply] = p.ep; p.uHalf[ply] = p.half; p.uH0[ply] = p.h0; p.uH1[ply] = p.h1;
    p.hist0[p.histLen + ply] = p.h0; p.hist1[p.histLen + ply] = p.h1;
    let h0 = p.h0, h1 = p.h1;
    let cap = b[t], capSq = t;
    if (flags & F_EP) { capSq = t + (side ? -10 : 10); cap = b[capSq]; b[capSq] = EMPTY; }
    p.uCap[ply] = cap;
    if (cap) { h0 ^= ZP[0][cap * 120 + capSq]; h1 ^= ZP[1][cap * 120 + capSq]; }
    h0 ^= ZP[0][pc * 120 + f]; h1 ^= ZP[1][pc * 120 + f];
    const placed = promo ? (promo | (side << 3)) : pc;
    b[t] = placed; b[f] = EMPTY;
    h0 ^= ZP[0][placed * 120 + t]; h1 ^= ZP[1][placed * 120 + t];
    if (flags & F_CASTLE) {
      const [rf, rt] = t === 97 ? [98, 96] : t === 93 ? [91, 94] : t === 27 ? [28, 26] : [21, 24];
      const rk = b[rf];
      b[rt] = rk; b[rf] = EMPTY;
      h0 ^= ZP[0][rk * 120 + rf] ^ ZP[0][rk * 120 + rt]; h1 ^= ZP[1][rk * 120 + rf] ^ ZP[1][rk * 120 + rt];
    }
    if ((pc & 7) === K) p.ksq[side] = t;
    h0 ^= ZC[0][p.castle]; h1 ^= ZC[1][p.castle];
    p.castle &= CASTLE_MASK[f] & CASTLE_MASK[t];
    h0 ^= ZC[0][p.castle]; h1 ^= ZC[1][p.castle];
    if (p.ep) { h0 ^= ZE[0][p.ep]; h1 ^= ZE[1][p.ep]; }
    p.ep = (flags & F_DOUBLE) ? (f + t) >> 1 : 0;
    if (p.ep) { h0 ^= ZE[0][p.ep]; h1 ^= ZE[1][p.ep]; }
    p.half = (pc & 7) === P || cap ? 0 : p.half + 1;
    h0 ^= ZS[0]; h1 ^= ZS[1];
    p.h0 = h0 >>> 0; p.h1 = h1 >>> 0;
    p.side ^= 1; p.ply++;
  }
  function unmake(p) {
    p.ply--; p.side ^= 1;
    const ply = p.ply, m = p.uMove[ply], b = p.b;
    const f = m & 127, t = (m >> 7) & 127, promo = (m >> 14) & 7, flags = m >> 17, side = p.side;
    const moved = promo ? (P | (side << 3)) : b[t];
    b[f] = moved; b[t] = EMPTY;
    const cap = p.uCap[ply];
    if (flags & F_EP) b[t + (side ? -10 : 10)] = cap; else b[t] = cap;
    if (flags & F_CASTLE) {
      const [rf, rt] = t === 97 ? [98, 96] : t === 93 ? [91, 94] : t === 27 ? [28, 26] : [21, 24];
      b[rf] = b[rt]; b[rt] = EMPTY;
    }
    if ((moved & 7) === K) p.ksq[side] = f;
    p.castle = p.uCastle[ply]; p.ep = p.uEp[ply]; p.half = p.uHalf[ply]; p.h0 = p.uH0[ply]; p.h1 = p.uH1[ply];
  }
  function makeNull(p) {
    const ply = p.ply;
    p.uMove[ply] = 0; p.uCastle[ply] = p.castle; p.uEp[ply] = p.ep; p.uHalf[ply] = p.half; p.uH0[ply] = p.h0; p.uH1[ply] = p.h1;
    p.hist0[p.histLen + ply] = p.h0; p.hist1[p.histLen + ply] = p.h1;
    let h0 = p.h0 ^ ZS[0], h1 = p.h1 ^ ZS[1];
    if (p.ep) { h0 ^= ZE[0][p.ep]; h1 ^= ZE[1][p.ep]; p.ep = 0; }
    p.h0 = h0 >>> 0; p.h1 = h1 >>> 0; p.half++;
    p.side ^= 1; p.ply++;
  }
  function unmakeNull(p) {
    p.ply--; p.side ^= 1;
    const ply = p.ply;
    p.ep = p.uEp[ply]; p.half = p.uHalf[ply]; p.h0 = p.uH0[ply]; p.h1 = p.uH1[ply];
  }

  // Legal moves (for perft, root and validation).
  function legal(p) {
    const buf = new Int32Array(256), n = gen(p, buf, false), out = [];
    for (let i = 0; i < n; i++) { make(p, buf[i]); if (!inCheck(p, p.side ^ 1)) out.push(buf[i]); unmake(p); }
    return out;
  }
  const toUci = m => name(m & 127) + name((m >> 7) & 127) + (((m >> 14) & 7) ? ' pnbrqk'[(m >> 14) & 7] : '');

  /* ---------- evaluation ---------- */
  const pawnFiles = [new Int8Array(10), new Int8Array(10)];
  const pawnMin = [new Int8Array(10), new Int8Array(10)], pawnMax = [new Int8Array(10), new Int8Array(10)];
  function evaluate(p) {
    const b = p.b;
    let mg = [0, 0], eg = [0, 0], phase = 0;
    const bishops = [0, 0];
    for (let s = 0; s < 2; s++) { pawnFiles[s].fill(0); pawnMin[s].fill(9); pawnMax[s].fill(-1); }
    for (let sq = 21; sq <= 98; sq++) {
      const pc = b[sq];
      if (pc === EMPTY || pc === OFF) continue;
      if ((pc & 7) === P) {
        const s = pc >> 3, i = SQ64[sq], file = (i & 7) + 1, row = i >> 3;
        pawnFiles[s][file]++;
        if (row < pawnMin[s][file]) pawnMin[s][file] = row;
        if (row > pawnMax[s][file]) pawnMax[s][file] = row;
      }
    }
    for (let sq = 21; sq <= 98; sq++) {
      const pc = b[sq];
      if (pc === EMPTY || pc === OFF) continue;
      const t = pc & 7, s = pc >> 3, i = SQ64[sq], idx = s ? ((7 - (i >> 3)) << 3) | (i & 7) : i;
      mg[s] += VAL_MG[t] + PST_MG[t][idx];
      eg[s] += VAL_EG[t] + PST_EG[t][idx];
      phase += PHASE_W[t];
      const file = (i & 7) + 1, row = i >> 3;
      if (t === P) {
        const o = s ^ 1;
        if (!pawnFiles[s][file - 1] && !pawnFiles[s][file + 1]) { mg[s] -= 10; eg[s] -= 15; }
        // passed: no enemy pawn ahead on this or adjacent files
        let passed = true;
        for (let f = file - 1; f <= file + 1; f++) {
          if (!pawnFiles[o][f]) continue;
          if (s === 0 ? pawnMin[o][f] < row : pawnMax[o][f] > row) { passed = false; break; }
        }
        if (passed) { const adv = s === 0 ? 7 - row : row; mg[s] += PASSED_MG[adv]; eg[s] += PASSED_EG[adv]; }
      } else if (t === B) {
        bishops[s]++;
        let mob = 0;
        for (const d of B_DIRS) { let x = sq + d; while (b[x] === EMPTY) { mob++; x += d; } }
        mg[s] += (mob - 6) * 4; eg[s] += (mob - 6) * 4;
      } else if (t === N) {
        let mob = 0;
        for (const d of N_DIRS) { const x = b[sq + d]; if (x !== OFF && (x === EMPTY || (x >> 3) !== s)) mob++; }
        mg[s] += (mob - 4) * 4; eg[s] += (mob - 4) * 4;
      } else if (t === R) {
        let mob = 0;
        for (const d of R_DIRS) { let x = sq + d; while (b[x] === EMPTY) { mob++; x += d; } }
        mg[s] += (mob - 7) * 2; eg[s] += (mob - 7) * 4;
        if (!pawnFiles[s][file]) { const open = !pawnFiles[s ^ 1][file]; mg[s] += open ? 25 : 12; eg[s] += open ? 10 : 5; }
        if ((s === 0 && row === 1) || (s === 1 && row === 6)) { mg[s] += 15; eg[s] += 20; }
      } else if (t === Q) {
        let mob = 0;
        for (const d of K_DIRS) { let x = sq + d; while (b[x] === EMPTY) { mob++; x += d; } }
        mg[s] += (mob - 13); eg[s] += (mob - 13) * 2;
      } else if (t === K) {
        // pawn shield in front of a castled-side king
        if ((file <= 3 || file >= 6)) {
          const fwd = s ? 10 : -10;
          let shield = 0;
          for (const d of [fwd - 1, fwd, fwd + 1]) { if (b[sq + d] === (P | (s << 3))) shield += 12; else if (b[sq + 2 * fwd + (d - fwd)] === (P | (s << 3))) shield += 6; }
          mg[s] += shield;
        }
        // open files next to the king hurt
        for (let f = file - 1; f <= file + 1; f++) if (f >= 1 && f <= 8 && !pawnFiles[s][f]) mg[s] -= 15;
      }
    }
    for (let s = 0; s < 2; s++) {
      for (let f = 1; f <= 8; f++) if (pawnFiles[s][f] > 1) { mg[s] -= 12 * (pawnFiles[s][f] - 1); eg[s] -= 20 * (pawnFiles[s][f] - 1); }
      if (bishops[s] >= 2) { mg[s] += 30; eg[s] += 50; }
    }
    if (phase > 24) phase = 24;
    const us = p.side;
    const mgS = mg[us] - mg[us ^ 1], egS = eg[us] - eg[us ^ 1];
    return ((mgS * phase + egS * (24 - phase)) / 24 | 0) + 10; // + tempo
  }

  /* ---------- transposition table ---------- */
  const TT_BITS = 20, TT_SIZE = 1 << TT_BITS, TT_MASK = TT_SIZE - 1;
  const ttKey = new Uint32Array(TT_SIZE), ttMove = new Int32Array(TT_SIZE), ttScore = new Int16Array(TT_SIZE);
  const ttDepth = new Int8Array(TT_SIZE), ttFlag = new Uint8Array(TT_SIZE); // 1 exact, 2 lower, 3 upper
  function ttClear() { ttKey.fill(0); ttFlag.fill(0); }

  /* ---------- search ---------- */
  const MAXPLY = 64;
  const moveBuf = Array.from({ length: MAXPLY + 8 }, () => new Int32Array(256));
  const scoreBuf = Array.from({ length: MAXPLY + 8 }, () => new Int32Array(256));
  const killers = Array.from({ length: MAXPLY + 8 }, () => new Int32Array(2));
  const history = new Int32Array(16 * 120);
  let nodes = 0, stopAt = 0, stopped = false, nodeLimit = Infinity;

  function isRepetition(p) {
    const end = p.histLen + p.ply, h0 = p.h0, h1 = p.h1;
    for (let i = end - 2; i >= end - p.half && i >= 0; i -= 2) if (p.hist0[i] === h0 && p.hist1[i] === h1) return true;
    return false;
  }
  function orderMoves(p, moves, scores, n, ttm, ply) {
    const b = p.b, k = killers[ply];
    for (let i = 0; i < n; i++) {
      const m = moves[i];
      if (m === ttm) { scores[i] = 1e7; continue; }
      const t = (m >> 7) & 127, flags = m >> 17, promo = (m >> 14) & 7;
      if (flags & F_CAP) {
        const victim = flags & F_EP ? P : (b[t] & 7), attacker = b[m & 127] & 7;
        scores[i] = 1e6 + VAL_MG[victim] * 10 - VAL_MG[attacker];
      } else if (promo) scores[i] = 9e5 + VAL_MG[promo];
      else if (m === k[0]) scores[i] = 8e5;
      else if (m === k[1]) scores[i] = 7e5;
      else scores[i] = history[b[m & 127] * 120 + t];
    }
  }
  function pickNext(moves, scores, n, i) {
    let best = i;
    for (let j = i + 1; j < n; j++) if (scores[j] > scores[best]) best = j;
    if (best !== i) { let t = moves[i]; moves[i] = moves[best]; moves[best] = t; t = scores[i]; scores[i] = scores[best]; scores[best] = t; }
  }
  function timeUp() {
    if ((nodes & 2047) === 0 && (Date.now() > stopAt || nodes > nodeLimit)) stopped = true;
    return stopped;
  }
  function quiesce(p, alpha, beta, ply) {
    nodes++;
    if (timeUp()) return 0;
    const stand = evaluate(p);
    if (stand >= beta) return stand;
    if (stand + 1000 < alpha) return alpha; // delta pruning
    if (stand > alpha) alpha = stand;
    if (ply >= MAXPLY) return stand;
    const moves = moveBuf[ply], scores = scoreBuf[ply];
    const n = gen(p, moves, true);
    orderMoves(p, moves, scores, n, 0, ply);
    for (let i = 0; i < n; i++) {
      pickNext(moves, scores, n, i);
      const m = moves[i];
      make(p, m);
      if (inCheck(p, p.side ^ 1)) { unmake(p); continue; }
      const v = -quiesce(p, -beta, -alpha, ply + 1);
      unmake(p);
      if (stopped) return 0;
      if (v > alpha) { alpha = v; if (v >= beta) return v; }
    }
    return alpha;
  }
  function hasNonPawn(p, side) {
    const c = side << 3;
    for (let sq = 21; sq <= 98; sq++) { const pc = p.b[sq]; if (pc !== EMPTY && pc !== OFF && (pc & 8) === c && (pc & 7) !== P && (pc & 7) !== K) return true; }
    return false;
  }
  function search(p, depth, alpha, beta, ply, allowNull) {
    const pvNode = beta - alpha > 1;
    const check = inCheck(p, p.side);
    if (check) depth++;
    if (depth <= 0) return quiesce(p, alpha, beta, ply);
    nodes++;
    if (timeUp()) return 0;
    if (ply && (p.half >= 100 || isRepetition(p))) return 0;
    if (ply >= MAXPLY) return evaluate(p);
    // mate distance pruning
    alpha = Math.max(alpha, -MATE + ply); beta = Math.min(beta, MATE - ply);
    if (alpha >= beta) return alpha;

    const ti = p.h0 & TT_MASK;
    let ttm = 0;
    if (ttKey[ti] === p.h1 && ttFlag[ti]) {
      ttm = ttMove[ti];
      if (!pvNode && ttDepth[ti] >= depth && ply) {
        let v = ttScore[ti];
        if (v > MATE - 200) v -= ply; else if (v < -MATE + 200) v += ply;
        const fl = ttFlag[ti];
        if (fl === 1 || (fl === 2 && v >= beta) || (fl === 3 && v <= alpha)) return v;
      }
    }
    // null-move pruning
    if (allowNull && !pvNode && !check && depth >= 3 && hasNonPawn(p, p.side) && evaluate(p) >= beta) {
      makeNull(p);
      const v = -search(p, depth - 3, -beta, -beta + 1, ply + 1, false);
      unmakeNull(p);
      if (stopped) return 0;
      if (v >= beta) return v >= MATE - 200 ? beta : v;
    }
    const moves = moveBuf[ply], scores = scoreBuf[ply];
    const n = gen(p, moves, false);
    orderMoves(p, moves, scores, n, ttm, ply);
    let best = -INF, bestMove = 0, legalCount = 0;
    const origAlpha = alpha;
    for (let i = 0; i < n; i++) {
      pickNext(moves, scores, n, i);
      const m = moves[i];
      make(p, m);
      if (inCheck(p, p.side ^ 1)) { unmake(p); continue; }
      legalCount++;
      const quiet = !((m >> 17) & F_CAP) && !((m >> 14) & 7);
      let v;
      if (legalCount === 1) v = -search(p, depth - 1, -beta, -alpha, ply + 1, true);
      else {
        // late move reduction for quiet moves
        let r = 0;
        if (quiet && depth >= 3 && legalCount > 3 && !check && !inCheck(p, p.side)) r = legalCount > 8 ? 2 : 1;
        v = -search(p, depth - 1 - r, -alpha - 1, -alpha, ply + 1, true);
        if (v > alpha && r) v = -search(p, depth - 1, -alpha - 1, -alpha, ply + 1, true);
        if (v > alpha && v < beta) v = -search(p, depth - 1, -beta, -alpha, ply + 1, true);
      }
      unmake(p);
      if (stopped) return 0;
      if (v > best) {
        best = v; bestMove = m;
        if (v > alpha) {
          alpha = v;
          if (v >= beta) {
            if (quiet) {
              const k = killers[ply];
              if (k[0] !== m) { k[1] = k[0]; k[0] = m; }
              history[p.b[m & 127] * 120 + ((m >> 7) & 127)] += depth * depth;
            }
            break;
          }
        }
      }
    }
    if (!legalCount) return check ? -MATE + ply : 0;
    let store = best;
    if (store > MATE - 200) store += ply; else if (store < -MATE + 200) store -= ply;
    ttKey[ti] = p.h1; ttMove[ti] = bestMove; ttScore[ti] = store; ttDepth[ti] = depth;
    ttFlag[ti] = best >= beta ? 2 : best > origAlpha ? 1 : 3;
    return best;
  }

  // Think about a position. opts: {timeMs, maxDepth, nodes, history: [[h0,h1],...]}
  function think(fen, opts = {}) {
    const p = fromFen(fen, opts.history);
    const rootMoves = legal(p);
    if (!rootMoves.length) return null;
    const timeMs = opts.timeMs || 1000;
    stopAt = Date.now() + timeMs; stopped = false; nodes = 0; nodeLimit = opts.nodes || Infinity;
    history.fill(0);
    for (const k of killers) k.fill(0);
    const t0 = Date.now();
    let best = rootMoves[0], bestScore = 0, depthDone = 0;
    const maxDepth = opts.maxDepth || 64;
    let scores = new Map();
    for (let d = 1; d <= maxDepth; d++) {
      let alpha = -INF, beta = INF, iterBest = 0, iterScore = -INF;
      // order: previous best first
      rootMoves.sort((a, b) => (b === best) - (a === best) || (scores.get(b) ?? -INF) - (scores.get(a) ?? -INF));
      const iterScores = new Map();
      for (let i = 0; i < rootMoves.length; i++) {
        const m = rootMoves[i];
        make(p, m);
        let v;
        if (i === 0) v = -search(p, d - 1, -beta, -alpha, 1, true);
        else {
          v = -search(p, d - 1, -alpha - 1, -alpha, 1, true);
          if (v > alpha && !stopped) v = -search(p, d - 1, -beta, -alpha, 1, true);
        }
        unmake(p);
        if (stopped) break;
        iterScores.set(m, v);
        if (v > iterScore) { iterScore = v; iterBest = m; }
        if (v > alpha) alpha = v;
      }
      if (stopped && !iterBest) break;
      if (iterBest) { best = iterBest; bestScore = iterScore; depthDone = d; scores = iterScores; }
      if (stopped) break;
      if (Math.abs(bestScore) > MATE - 200 && d > 2) break;
      if (Date.now() - t0 > timeMs * 0.55) break; // the next iteration would not finish
    }
    return { uci: toUci(best), score: bestScore, depth: depthDone, nodes, ms: Date.now() - t0 };
  }
  // Hash of a FEN, for passing game history (repetition detection) into think().
  function hashOf(fen) { const p = fromFen(fen); return [p.h0, p.h1]; }

  function perft(p, d) {
    if (!d) return 1;
    const buf = new Int32Array(256), n = gen(p, buf, false);
    let c = 0;
    for (let i = 0; i < n; i++) { make(p, buf[i]); if (!inCheck(p, p.side ^ 1)) c += perft(p, d - 1); unmake(p); }
    return c;
  }
  return { think, hashOf, fromFen, legal, toUci, perft, evaluate, ttClear };
})();
if (typeof module !== 'undefined') module.exports = Brain;
// Worker entry: when loaded as a Web Worker, answer {fen, opts} messages.
if (typeof self !== 'undefined' && typeof window === 'undefined' && typeof module === 'undefined') {
  self.onmessage = e => { const { id, fen, opts } = e.data; let res = null; try { res = Brain.think(fen, opts); } catch (err) { res = { error: String(err) }; } self.postMessage({ id, res }); };
}
