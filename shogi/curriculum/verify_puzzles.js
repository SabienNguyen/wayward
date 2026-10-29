// Independent verifier for puzzles.json. Does NOT load tsume.js; uses only the engine and usi.js.
const fs = require('fs');
const path = require('path');
const E = require('../src/engine.js');
Object.assign(globalThis, E);
const U = require('./usi.js');
const { usiToMove, moveToUsi } = U;

const puzzles = JSON.parse(fs.readFileSync(path.join(__dirname, 'puzzles.json'), 'utf8'));

// Fresh attacker search: can Sente (to move) force checkmate within n of its own moves, checks only?
function mates(s, n) {
  for (const m of legalMoves(s)) {
    apply(s, m);
    const isCheck = inCheck(s, s.turn);
    if (!isCheck) { undo(s, m); continue; }
    const replies = legalMoves(s);
    let ok;
    if (replies.length === 0) ok = true;
    else if (n === 1) ok = false;
    else {
      ok = true;
      for (const r of replies) {
        apply(s, r);
        const w = mates(s, n - 1);
        undo(s, r);
        if (!w) { ok = false; break; }
      }
    }
    undo(s, m);
    if (ok) return true;
  }
  return false;
}

// List of checking first moves that force mate within n.
function winningFirstMoves(s, n) {
  const res = [];
  for (const m of legalMoves(s)) {
    apply(s, m);
    const isCheck = inCheck(s, s.turn);
    if (!isCheck) { undo(s, m); continue; }
    const replies = legalMoves(s);
    let ok = replies.length === 0;
    if (!ok && n > 1) {
      ok = true;
      for (const r of replies) {
        apply(s, r);
        const w = mates(s, n - 1);
        undo(s, r);
        if (!w) { ok = false; break; }
      }
    }
    undo(s, m);
    if (ok) res.push(moveToUsi(m));
  }
  return res;
}

function board(s) {
  const rows = [];
  for (let r = 0; r < 9; r++) {
    const cells = [];
    for (let c = 0; c < 9; c++) {
      const q = s.b[r][c];
      cells.push(q ? (q.p ? '+' : '') + (q.o ? q.t.toLowerCase() : q.t) : '.');
    }
    rows.push('abcdefghi'[r] + ' ' + cells.map(x => x.padStart(2)).join(''));
  }
  return rows.join('\n');
}

let bad = 0;
const summary = [];
for (const p of puzzles) {
  const errs = [];
  const s = U.parseSfen(p.sfen);
  if (s.turn !== 0) errs.push('Sente is not to move');
  if (inCheck(s, 1)) errs.push('Gote is in check before the first move');
  if (inCheck(s, 0)) errs.push('Sente is in check before the first move');
  const kings = [0, 1].map(o => s.b.flat().filter(q => q && q.t === 'K' && q.o === o).length);
  if (kings[0] !== 1 || kings[1] !== 1) errs.push('each side needs exactly one king');
  const gh = s.hands[1];
  if (Object.values(gh).some(v => v)) errs.push('Gote hand is not empty (state it if intended)');
  const expectLen = p.mate === 1 ? 1 : 5;
  if (!Array.isArray(p.line) || p.line.length !== expectLen) errs.push(`line must have ${expectLen} plies`);
  const attackerLine = p.mate === 1 ? [p.line[0]] : [p.line[0], p.line[2], p.line[4]];
  if (JSON.stringify(p.solution) !== JSON.stringify(attackerLine)) errs.push('solution does not match attacker moves of line');

  // Replay the main line, checking every attacker move is a check and each defender move is legal.
  const st = U.parseSfen(p.sfen);
  p.line.forEach((u, i) => {
    const m = usiToMove(st, u);
    if (!m) { errs.push(`illegal ply ${i} ${u}`); return; }
    const attacker = i % 2 === 0;
    apply(st, m);
    if (attacker && !inCheck(st, st.turn)) errs.push(`attacker ply ${i} ${u} is not check`);
  });
  if (errs.length === 0) {
    if (!inCheck(st, 1)) errs.push('final position is not check');
    if (legalMoves(st).length !== 0) errs.push('final position is not checkmate');
  }

  // Independent uniqueness and no-shorter-mate proofs.
  const fresh = U.parseSfen(p.sfen);
  const wins = winningFirstMoves(fresh, p.mate);
  if (wins.length !== 1) errs.push(`expected exactly one first move mating in ${p.mate}, found ${wins.length}: ${wins.join(',')}`);
  else if (wins[0] !== p.solution[0]) errs.push(`unique winning move is ${wins[0]}, solution says ${p.solution[0]}`);
  if (p.mate === 3) {
    const fresh2 = U.parseSfen(p.sfen);
    if (mates(fresh2, 2)) errs.push('a shorter mate (in 2 or less) exists');
  }
  if (errs.length) bad++;
  summary.push({ id: p.id, mate: p.mate, ok: errs.length === 0, errs, winners: wins });
  console.log(`${errs.length ? 'FAIL' : 'ok  '} ${p.id} mate-${p.mate} solution=${p.solution.join(' ')} line=${p.line.join(' ')} winners=${wins.join(',')} sfen=${p.sfen}${errs.length ? '\n     ' + errs.join('\n     ') : ''}`);
}
console.log(`\npuzzles checked: ${puzzles.length}  mate-1: ${puzzles.filter(p => p.mate === 1).length}  mate-3: ${puzzles.filter(p => p.mate === 3).length}  failures: ${bad}`);
process.exitCode = bad ? 1 : 0;
