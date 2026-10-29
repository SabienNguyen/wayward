// Harvests candidate puzzles by playing engine games and testing each position.
// Usage: node curriculum/harvest.js <out.json> <targetPerKind>
// Writes raw candidates (no explanations); those are added by hand afterwards.
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const path = require('path');

const ENGINE = path.join(__dirname, '..', 'src', 'engine.js');
const E = require(ENGINE);
const { parseFen, toFen, legalMoves, apply, undo, inCheck, search, bestMove, toUci, VAL, MATE } = E;

const WIN = 300;

function materialDiff(s, side) {
  let d = 0;
  for (const row of s.b) for (const p of row) {
    if (!p || p.t === 'K') continue;
    d += (p.o === side ? 1 : -1) * VAL[p.t];
  }
  return d;
}

// Mating moves for the side to move in s.
function matingMoves(s) {
  const side = s.turn, res = [];
  for (const m of legalMoves(s)) {
    apply(s, m);
    const mate = inCheck(s, s.turn) && legalMoves(s).length === 0;
    undo(s, m);
    if (mate) res.push(m);
  }
  return res;
}

// First moves that force mate in 2: every black reply allows a mate in 1.
function mate2Moves(s) {
  const out = [];
  for (const m of legalMoves(s)) {
    apply(s, m);
    let ok = true;
    const replies = legalMoves(s);
    if (!replies.length) ok = false;
    for (const r of replies) {
      apply(s, r);
      const mm = matingMoves(s).length > 0;
      undo(s, r);
      if (!mm) { ok = false; break; }
    }
    undo(s, m);
    if (ok) out.push(m);
  }
  return out;
}

// Depth-3 (then depth-4) margin test. Returns null if not a clean winning tactic.
function tacticTest(s) {
  const side = s.turn;
  const moves = legalMoves(s);
  if (moves.length < 2) return null;
  const score = (depth) => moves.map(m => {
    apply(s, m);
    const v = -search(s, depth - 1, -MATE * 2, MATE * 2, 1);
    undo(s, m);
    return v;
  });
  const v3 = score(3);
  const order = v3.map((v, i) => i).sort((a, b) => v3[b] - v3[a]);
  const b1 = order[0], b2 = order[1];
  if (Math.abs(v3[b1]) >= MATE / 2) return null;
  if (v3[b1] - v3[b2] < WIN) return null;
  const v4 = score(4);
  const o4 = v4.map((v, i) => i).sort((a, b) => v4[b] - v4[a]);
  if (o4[0] !== b1) return null;
  if (Math.abs(v4[b1]) >= MATE / 2) return null;
  if (v4[b1] - v4[o4[1]] < WIN) return null;
  // principal line: engine best move at depth 3 for 4 plies, on a fresh copy
  const fen = toFen(s);
  const fresh = parseFen(fen);
  const startMat = materialDiff(fresh, side);
  const pv = [];
  for (let i = 0; i < 4; i++) {
    const m = bestMove(fresh, 3, 0);
    if (!m) break;
    pv.push(toUci(m));
    apply(fresh, m);
  }
  const endMat = materialDiff(fresh, side);
  if (endMat - startMat < WIN) return null;
  return { solution: [toUci(moves[b1])], line: pv, v3: v3[b1] - v3[b2], v4: v4[b1] - v4[o4[1]] };
}

function playGame(seedNoise) {
  const s = parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
  const found = [];
  for (let ply = 0; ply < 140; ply++) {
    const moves = legalMoves(s);
    if (!moves.length) break;
    if (materialCount(s) < 6) break; // skip bare-ish endings for puzzles
    if (!inCheck(s, s.turn)) {
      const fen = toFen(s);
      const mates = matingMoves(s);
      if (mates.length === 1) {
        found.push({ kind: 'mate1', fen, solution: [toUci(mates[0])], line: [toUci(mates[0])] });
      } else if (mates.length === 0) {
        const m2 = mate2Moves(s);
        if (m2.length === 1) {
          const first = m2[0];
          apply(s, first);
          const replies = legalMoves(s);
          // choose the defence that lasts longest (most legal replies is a proxy); record first mating move vs it
          let best = replies[0], bestLen = -1;
          for (const r of replies) {
            apply(s, r);
            const len = legalMoves(s).length;
            undo(s, r);
            if (len > bestLen) { bestLen = len; best = r; }
          }
          apply(s, best);
          const mate = matingMoves(s)[0];
          undo(s, best);
          undo(s, first);
          found.push({ kind: 'mate2', fen, solution: [toUci(first), toUci(mate)], line: [toUci(first), toUci(best), toUci(mate)] });
        } else {
          const t = tacticTest(s);
          if (t) found.push({ kind: 'tactic', fen, ...t });
        }
      }
    }
    const m = bestMove(s, 2, 80 + Math.random() * 170);
    apply(s, m);
  }
  return found;
}

function materialCount(s) {
  let n = 0;
  for (const row of s.b) for (const p of row) if (p && p.t !== 'K') n++;
  return n;
}

if (!isMainThread) {
  // Worker: play games until told to stop.
  parentPort.on('message', msg => {
    if (msg === 'stop') process.exit(0);
  });
  for (let g = 0; g < 100000; g++) {
    const found = playGame();
    parentPort.postMessage({ games: 1, found });
  }
} else {
  const out = process.argv[2];
  const target = +(process.argv[3] || 12);
  const counts = { mate1: 0, mate2: 0, tactic: 0 };
  const seen = new Set();
  const cands = [];
  const workers = [];
  const N = 4;
  let games = 0;
  const done = () => counts.mate1 >= target && counts.mate2 >= target && counts.tactic >= target;
  const finish = () => {
    for (const w of workers) w.terminate();
    fs.writeFileSync(out, JSON.stringify({ games, counts, cands }, null, 1));
    console.log('games', games, counts);
    process.exit(0);
  };
  for (let i = 0; i < N; i++) {
    const w = new Worker(__filename);
    w.on('message', ({ found }) => {
      games++;
      for (const c of found) {
        const key = c.fen.split(' ').slice(0, 4).join(' ');
        if (seen.has(key) || counts[c.kind] >= target) continue;
        seen.add(key);
        counts[c.kind]++;
        cands.push(c);
        console.log(c.kind, counts[c.kind], c.fen);
      }
      fs.writeFileSync(out, JSON.stringify({ games, counts, cands }, null, 1));
      if (done()) finish();
    });
    w.on('error', e => { console.error('worker error', e); });
    workers.push(w);
  }
}
