// Independently re-verifies every puzzle in puzzles.json from its FEN.
// Usage: node curriculum/verify_puzzles.js
// Uses its own small mate solver (written separately from harvest.js) and re-runs the
// engine search for the tactic margins. Prints ok/FAIL per puzzle.
const fs = require('fs');
const path = require('path');
const E = require(path.join(__dirname, '..', 'src', 'engine.js'));
const { parseFen, toFen, legalMoves, apply, undo, inCheck, search, toUci, fromUci, attacked, parseSq, VAL, MATE, KNIGHT } = E;

const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, 'puzzles.json'), 'utf8'));
const WIN = 300;

// --- independent mate helpers -------------------------------------------
// Side to move is checkmated in s? (used after the attacker has just moved)
const sideMated = s => inCheck(s, s.turn) && legalMoves(s).length === 0;

// Does the side to move have a move that gives checkmate immediately?
function hasMateIn1(s) {
  for (const m of legalMoves(s)) {
    apply(s, m);
    const mated = sideMated(s);
    undo(s, m);
    if (mated) return true;
  }
  return false;
}
// Set of moves for the side to move that mate in one.
function mateIn1Moves(s) {
  const out = [];
  for (const m of legalMoves(s)) {
    apply(s, m);
    if (sideMated(s)) out.push(m);
    undo(s, m);
  }
  return out;
}
// Mate in 2 by 'first': every defence leaves the attacker with a mate in 1, and the defender is not already mated/stalemated.
function forcesMateIn2(s, first) {
  apply(s, first);
  let ok = true;
  const defences = legalMoves(s);
  if (!defences.length) ok = false; // mated or stalemated immediately (mate in 1 or no mate)
  for (const d of defences) {
    apply(s, d);
    if (!hasMateIn1(s)) ok = false;
    undo(s, d);
    if (!ok) break;
  }
  undo(s, first);
  return ok;
}

// --- theme checks (only what is checkable mechanically) -------------------
function backRankMate(fenBefore, mateMove) {
  const s = parseFen(fenBefore);
  const side = s.turn;
  const mover = side;
  const m = legalMoves(s).find(x => toUci(x) === mateMove);
  if (!m) return false;
  apply(s, m);
  const kingSide = s.turn; // defender
  let kr = -1, kc = -1;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = s.b[r][c]; if (p && p.t === 'K' && p.o === kingSide) { kr = r; kc = c; } }
  const isBackRank = kr === (kingSide === 0 ? 7 : 0);
  const rankMoverPiece = m.pt === 'R' || m.pt === 'Q';
  const toBackRank = m.to[0] === kr;
  // every king escape square is occupied by a defender's own piece or attacked.
  // The king is lifted off the board first, so a rook's line through its old square counts.
  const kingPiece = s.b[kr][kc];
  s.b[kr][kc] = null;
  let escapes = true;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const r = kr + dr, c = kc + dc;
    if (r < 0 || r > 7 || c < 0 || c > 7) continue;
    const p = s.b[r][c];
    if (p && p.o === kingSide) continue;
    if (!attacked(s, r, c, mover)) escapes = false;
  }
  s.b[kr][kc] = kingPiece;
  undo(s, m);
  return isBackRank && rankMoverPiece && toBackRank && escapes;
}
function smotheredMate(fenBefore, mateMove) {
  const s = parseFen(fenBefore);
  const m = legalMoves(s).find(x => toUci(x) === mateMove);
  if (!m || m.pt !== 'N') return false;
  apply(s, m);
  const kingSide = s.turn;
  let kr = -1, kc = -1;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) { const p = s.b[r][c]; if (p && p.t === 'K' && p.o === kingSide) { kr = r; kc = c; } }
  let blocked = true;
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    if (!dr && !dc) continue;
    const r = kr + dr, c = kc + dc;
    if (r < 0 || r > 7 || c < 0 || c > 7) continue;
    const p = s.b[r][c];
    if (!p || p.o !== kingSide) blocked = false;
  }
  undo(s, m);
  return blocked;
}
// fork: after the move, the moved piece attacks two enemy pieces worth >= 300 (or the king)
function forkMove(fenBefore, move) {
  const s = parseFen(fenBefore);
  const m = legalMoves(s).find(x => toUci(x) === move);
  if (!m || m.pt === 'K') return false;
  apply(s, m);
  const enemy = s.turn; // after the move, the side to move is the opponent
  const [tr, tc] = m.to;
  let hits = 0;
  for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
    const p = s.b[r][c];
    if (!p || p.o !== enemy) continue;
    if (!(p.t === 'K' || VAL[p.t] >= 300)) continue;
    // attacks: does a piece on (tr,tc) of mover colour attack (r,c)?
    if (pieceAttacks(s, tr, tc, r, c)) hits++;
  }
  undo(s, m);
  return hits >= 2;
}
function pieceAttacks(s, fr, fc, tr, tc) {
  const p = s.b[fr][fc];
  if (!p) return false;
  const dr = tr - fr, dc = tc - fc, adr = Math.abs(dr), adc = Math.abs(dc);
  if (p.t === 'N') return (adr === 1 && adc === 2) || (adr === 2 && adc === 1);
  if (p.t === 'K') return adr <= 1 && adc <= 1 && (adr + adc) > 0;
  if (p.t === 'P') return (p.o === 0 ? dr === -1 : dr === 1) && adc === 1;
  const straight = dr === 0 || dc === 0, diag = adr === adc && adr > 0;
  if ((p.t === 'R' && !straight) || (p.t === 'B' && !diag)) return false;
  if (p.t === 'Q' && !straight && !diag) return false;
  const sr = Math.sign(dr), sc = Math.sign(dc);
  let r = fr + sr, c = fc + sc;
  while (r !== tr || c !== tc) { if (s.b[r][c]) return false; r += sr; c += sc; }
  return true;
}

// --- tactic margin (engine search, re-run) -------------------------------
function margins(fen) {
  const s = parseFen(fen);
  const moves = legalMoves(s);
  const score = depth => moves.map(m => { apply(s, m); const v = -search(s, depth - 1, -MATE * 2, MATE * 2, 1); undo(s, m); return v; });
  const v3 = score(3), v4 = score(4);
  const rank = v => v.map((x, i) => i).sort((a, b) => v[b] - v[a]);
  const o3 = rank(v3), o4 = rank(v4);
  return { best3: moves[o3[0]], gap3: v3[o3[0]] - v3[o3[1]], best4: moves[o4[0]], gap4: v4[o4[0]] - v4[o4[1]], bestVal3: v3[o3[0]], bestVal4: v4[o4[0]] };
}
function materialFor(s, side) { let d = 0; for (const row of s.b) for (const p of row) if (p && p.t !== 'K') d += (p.o === side ? 1 : -1) * VAL[p.t]; return d; }

let failed = 0;
for (const p of puzzles) {
  const fails = [];
  const s0 = parseFen(p.fen);
  const side = s0.turn;
  const fields = ['id', 'kind', 'fen', 'solution', 'line', 'theme', 'hint', 'explain'];
  for (const f of fields) if (!(f in p)) fails.push('missing ' + f);
  if (!['mate1', 'mate2', 'tactic'].includes(p.kind)) fails.push('bad kind');

  if (p.kind === 'mate1') {
    if (p.solution.length !== 1) fails.push('mate1 solution must be one move');
    const mates = mateIn1Moves(s0).map(toUci);
    if (mates.length !== 1) fails.push(`expected exactly 1 mating move, found ${mates.length}`);
    if (mates[0] !== p.solution[0]) fails.push(`solution ${p.solution[0]} is not the mating move ${mates[0]}`);
    if (p.line.length !== 1 || p.line[0] !== p.solution[0]) fails.push('line should be the single mating move');
    const m = fromUci(s0, p.solution[0]);
    if (!m) fails.push('solution is illegal');
    else { apply(s0, m); if (!sideMated(s0)) fails.push('solution does not mate'); }
  } else if (p.kind === 'mate2') {
    const firsts = legalMoves(s0).filter(m => forcesMateIn2(parseFen(p.fen), m)).map(toUci);
    if (hasMateIn1(s0)) fails.push('a mate in 1 exists (must not be a mate-in-2 puzzle)');
    if (firsts.length !== 1) fails.push(`expected exactly 1 first move forcing mate in 2, found ${firsts.length} (${firsts.join(',')})`);
    if (p.line.length !== 3) fails.push('mate2 line must have 3 moves');
    else {
      if (p.line[0] !== p.solution[0]) fails.push('line[0] must equal the first move');
      if (firsts[0] !== p.line[0]) fails.push(`first move ${p.line[0]} is not the forcing move ${firsts[0]}`);
      const s = parseFen(p.fen);
      const m1 = fromUci(s, p.line[0]);
      if (!m1) fails.push('first move illegal');
      else {
        apply(s, m1);
        const d = fromUci(s, p.line[1]);
        if (!d) fails.push('defence illegal');
        else {
          apply(s, d);
          const mt = fromUci(s, p.line[2]);
          if (!mt) fails.push('mate move illegal');
          else { apply(s, mt); if (!sideMated(s)) fails.push('line does not end in mate'); }
        }
      }
      if (p.solution.length !== 2 || p.solution[1] !== p.line[2]) fails.push('solution should be [first, mate] matching line');
    }
  } else if (p.kind === 'tactic') {
    if (p.solution.length !== 1 || p.solution[0] !== p.line[0]) fails.push('tactic solution must be line[0]');
    if (p.line.length < 2 || p.line.length > 4) fails.push('tactic line must be 2-4 plies');
    const mg = margins(p.fen);
    if (toUci(mg.best3) !== p.solution[0]) fails.push(`depth-3 best is ${toUci(mg.best3)}, not ${p.solution[0]}`);
    if (mg.gap3 < WIN) fails.push(`depth-3 margin ${mg.gap3} < ${WIN}`);
    if (toUci(mg.best4) !== p.solution[0]) fails.push(`depth-4 best is ${toUci(mg.best4)}`);
    if (mg.gap4 < WIN) fails.push(`depth-4 margin ${mg.gap4} < ${WIN}`);
    if (Math.abs(mg.bestVal3) >= MATE / 2) fails.push('best line is a mate score, not material');
    // line legality and material gain at the end of the line
    const s = parseFen(p.fen);
    const before = materialFor(s, side);
    for (const u of p.line) { const m = fromUci(s, u); if (!m) { fails.push('line move illegal: ' + u); break; } apply(s, m); }
    const gain = materialFor(s, side) - before;
    if (gain < WIN) fails.push(`material after line is ${gain >= 0 ? '+' : ''}${gain} (need >= ${WIN})`);
  }

  // theme must be verifiable where it is claimed
  if (p.theme && p.theme !== 'tactic') {
    // position from which the decisive move (mate or tactic move) is played
    let preFen = p.fen;
    if (p.kind === 'mate2') { const q = parseFen(p.fen); apply(q, fromUci(q, p.line[0])); apply(q, fromUci(q, p.line[1])); preFen = toFen(q); }
    const decisive = p.kind === 'tactic' ? p.solution[0] : p.line[p.line.length - 1];
    const t = p.theme.toLowerCase();
    if (p.kind === 'tactic') { if (t !== 'fork' || !forkMove(p.fen, decisive)) fails.push(`theme "${p.theme}" not confirmed for tactic`); }
    else if (t === 'back rank') { if (!backRankMate(preFen, decisive)) fails.push('theme "back rank" not confirmed'); }
    else if (t === 'promotion') { if (!(p.kind === 'mate1' && p.solution[0].length === 5)) fails.push('theme "promotion" not confirmed'); }
    else if (t === 'smothered mate') { if (!smotheredMate(preFen, decisive)) fails.push('theme "smothered mate" not confirmed'); }
    else fails.push(`theme "${p.theme}" has no mechanical check; use "tactic"`);
  }

  if (typeof p.hint !== 'string' || p.hint.split(/[.!?](\s|$)/).filter(x => x.trim()).length > 1) fails.push('hint must be one sentence');
  if (typeof p.explain !== 'string' || p.explain.split(/(?<=[.!?])\s+/).filter(x => x.trim()).length !== 2) fails.push('explain must be two sentences');
  if (p.hint && p.solution && p.solution.some(u => p.hint.includes(u))) fails.push('hint gives away the move');

  if (fails.length) failed++;
  console.log(`${fails.length ? 'FAIL' : 'ok  '} ${p.id} [${p.kind}]${fails.length ? ' :: ' + fails.join('; ') : ''}`);
}
const kinds = {};
for (const p of puzzles) kinds[p.kind] = (kinds[p.kind] || 0) + 1;
console.log(`\n${puzzles.length - failed}/${puzzles.length} puzzles passed; counts ${JSON.stringify(kinds)}`);
if (failed) process.exitCode = 1;
