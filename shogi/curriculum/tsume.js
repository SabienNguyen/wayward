// Tsume-shogi solver and random generator (Node only).
// Attacker (Sente, side 0) may only play checking moves. Defender (side 1) plays all legal moves.
// mate-N: attacker can force checkmate using at most N attacker moves.
const E = require('../src/engine.js');
Object.assign(globalThis, E);
const U = require('./usi.js');
const { moveToUsi, usiToMove } = U;

// Copy of engine.js deadSquare (not exported by the engine).
function deadSquare(t, side, r) {
  const rel = side === 0 ? r : 8 - r;
  if (t === 'P' || t === 'L') return rel === 0;
  if (t === 'N') return rel <= 1;
  return false;
}

function checks(s) {
  const out = [];
  for (const m of legalMoves(s)) {
    apply(s, m);
    const c = inCheck(s, s.turn);
    undo(s, m);
    if (c) out.push(m);
  }
  return out;
}

// Attacker has already played checking move m (not yet applied). Is mate forced within n attacker moves total?
function forcedWithin(s, m, n) {
  apply(s, m);
  let ok = true;
  const replies = legalMoves(s);
  if (replies.length === 0) ok = true;
  else if (n <= 1) ok = false;
  else {
    for (const r of replies) {
      apply(s, r);
      const w = win(s, n - 1);
      undo(s, r);
      if (!w) { ok = false; break; }
    }
  }
  undo(s, m);
  return ok;
}

// Attacker to move: can it force mate within n attacker moves?
function win(s, n) {
  for (const m of checks(s)) if (forcedWithin(s, m, n)) return true;
  return false;
}

function minDepth(s, maxN) {
  for (let n = 1; n <= maxN; n++) if (win(s, n)) return n;
  return Infinity;
}

// All first attacker moves (checks) that force mate within n.
function firstWinners(s, n) {
  return checks(s).filter(m => forcedWithin(s, m, n));
}

// Principal variation: attacker plays a shortest mate; defender picks the reply that delays mate longest.
function pvLine(s, n) {
  const d = minDepth(s, n);
  if (d === Infinity) return null;
  let best = null;
  for (const m of checks(s)) if (forcedWithin(s, m, d)) { best = m; break; }
  const line = [moveToUsi(best)];
  apply(s, best);
  const replies = legalMoves(s);
  let rest = [];
  if (replies.length && d > 1) {
    let worst = null, worstD = -1;
    for (const r of replies) {
      apply(s, r);
      const dd = minDepth(s, d - 1);
      undo(s, r);
      if (dd > worstD) { worstD = dd; worst = r; }
    }
    line.push(moveToUsi(worst));
    apply(s, worst);
    rest = pvLine(s, d - 1);
    undo(s, worst);
  }
  undo(s, best);
  return line.concat(rest || []);
}

function describeSolution(sfen, n) {
  const s = U.parseSfen(sfen);
  const winners = firstWinners(s, n).map(moveToUsi);
  return { winners, line: pvLine(s, n) };
}

// ---- random generation ----
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const DEF_TYPES = ['G', 'G', 'S', 'S', 'P', 'P', 'L', 'N', 'B', 'R'];
const ATT_TYPES = ['G', 'G', 'S', 'S', 'R', 'B', 'N', 'L', 'P', 'P', '+R', '+B', '+S'];
const HAND_TYPES = ['G', 'S', 'R', 'B', 'N', 'L', 'P'];

function emptyState() {
  return {
    b: Array.from({ length: 9 }, () => Array(9).fill(null)),
    hands: [{ R: 0, B: 0, G: 0, S: 0, N: 0, L: 0, P: 0 }, { R: 0, B: 0, G: 0, S: 0, N: 0, L: 0, P: 0 }],
    turn: 0,
  };
}

function randomPuzzle(rng) {
  const pick = a => a[Math.floor(rng() * a.length)];
  const s = emptyState();
  const gr = Math.floor(rng() * 3), gc = Math.floor(rng() * 9);
  s.b[gr][gc] = { t: 'K', o: 1, p: false };
  let sr, sc;
  do { sr = 6 + Math.floor(rng() * 3); sc = Math.floor(rng() * 9); }
  while (Math.max(Math.abs(sr - gr), Math.abs(sc - gc)) < 3);
  s.b[sr][sc] = { t: 'K', o: 0, p: false };
  const near = (r, c, d) => Math.max(Math.abs(r - gr), Math.abs(c - gc)) <= d;
  const place = (side, types, count, rowMin, rowMax, maxDist) => {
    let placed = 0, tries = 0;
    while (placed < count && tries++ < 200) {
      const r = rowMin + Math.floor(rng() * (rowMax - rowMin + 1));
      const c = Math.floor(rng() * 9);
      if (s.b[r][c] || !near(r, c, maxDist)) continue;
      const tt = pick(types);
      const p = tt[0] === '+';
      const t = p ? tt[1] : tt;
      if (deadSquare(t, side, r)) continue;
      if (t === 'P' && !p) {
        let dup = false;
        for (let rr = 0; rr < 9; rr++) { const q = s.b[rr][c]; if (q && q.t === 'P' && !q.p && q.o === side) dup = true; }
        if (dup) continue;
      }
      s.b[r][c] = { t, o: side, p };
      placed++;
    }
  };
  place(1, DEF_TYPES, 1 + Math.floor(rng() * 4), 0, 3, 2);
  place(0, ATT_TYPES, 1 + Math.floor(rng() * 4), 0, 8, 3);
  const nh = Math.floor(rng() * 3);
  for (let i = 0; i < nh; i++) s.hands[0][pick(HAND_TYPES)]++;
  return s;
}

function isLegalPosition(s) {
  if (inCheck(s, 1)) return false; // Sente to move, Gote king must not be in check
  if (inCheck(s, 0)) return false;
  return legalMoves(s).length > 0;
}

// Classify a puzzle state. Returns record or null.
function classify(s) {
  const cks = checks(s);
  if (!cks.length) return null;
  const mates1 = cks.filter(m => { apply(s, m); const none = legalMoves(s).length === 0; undo(s, m); return none; });
  if (mates1.length === 1) {
    const m = mates1[0];
    return { mate: 1, line: [moveToUsi(m)], firstMoves: [moveToUsi(m)] };
  }
  if (mates1.length > 1) return null;
  if (win(s, 2)) return null; // a shorter mate exists
  const w = firstWinners(s, 3);
  if (w.length !== 1) return null;
  const line = pvLine(s, 3);
  if (!line || line.length !== 5) return null;
  return { mate: 3, line, firstMoves: [moveToUsi(w[0])] };
}

// Flags used when choosing puzzles.
function features(s0, line) {
  const s = U.parseSfen(U.toSfen(s0));
  const m = usiToMove(s, line[0]);
  const drop = !!m.drop;
  apply(s, m);
  const replies = legalMoves(s);
  const to = m.to;
  const sacrifice = replies.some(r => r.to[0] === to[0] && r.to[1] === to[1]);
  undo(s, m);
  return { drop, sacrifice };
}

function generate(seed, seconds) {
  const rng = mulberry32(seed);
  const end = Date.now() + seconds * 1000;
  let tried = 0;
  const out = [];
  while (Date.now() < end) {
    const s = randomPuzzle(rng);
    tried++;
    if (!isLegalPosition(s)) continue;
    const rec = classify(s);
    if (!rec) continue;
    const sfen = U.toSfen(s);
    out.push(Object.assign({ sfen, tried }, rec, features(s, rec.line)));
  }
  return { tried, out };
}

module.exports = { checks, win, minDepth, firstWinners, pvLine, classify, describeSolution, generate, randomPuzzle, mulberry32, forcedWithin };

if (require.main === module) {
  const [cmd, a, b] = process.argv.slice(2);
  if (cmd === 'gen') {
    const { tried, out } = generate(+a, +b);
    process.stderr.write(`tried ${tried} accepted ${out.length}\n`);
    for (const r of out) process.stdout.write(JSON.stringify(r) + '\n');
  } else if (cmd === 'solve') {
    console.log(JSON.stringify(describeSolution(a, +b || 3)));
  }
}
