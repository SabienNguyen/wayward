// Verifies curriculum/lessons.json: every move replays legally from its start,
// notes index into moves, and tactical claims hold in the final position.
const fs = require('fs');
const path = require('path');
const E = require('../src/engine.js');
Object.assign(globalThis, E);
const U = require('./usi.js');
const { usiToMove } = U;

const dir = __dirname;
const lessons = JSON.parse(fs.readFileSync(path.join(dir, 'lessons.json'), 'utf8'));
const puzzles = fs.existsSync(path.join(dir, 'puzzles.json')) ? JSON.parse(fs.readFileSync(path.join(dir, 'puzzles.json'), 'utf8')) : [];

const sq = name => U.parseSq(name);
function at(s, name) { const [r, c] = sq(name); return s.b[r][c]; }

// Per-lesson assertions on the state reached after the lesson's moves (or after move 0 when noted).
const ASSERTS = {
  'castle-walk-anaguma': (s, state) => {
    const p = at(s, '1i');
    return p && p.t === 'K' && p.o === 0 ? null : 'Sente king is not on 1i at the end';
  },
  'bishops-face-off': (s) => {
    const p = at(s, '7g');
    if (!p || p.t !== 'N' || p.o !== 0) return 'Sente knight is not on 7g after the trade';
    const goteBishops = s.b.flat().filter(q => q && q.t === 'B' && q.o === 1).length;
    return goteBishops === 0 ? null : 'Gote bishop still on board after the trade';
  },
  'bishop-diagonal': (s) => {
    const p = at(s, '7g');
    return p && p.t === 'B' && p.o === 0 ? null : 'Sente bishop is not on 7g';
  },
  'pawn-drop-threat': (s, state, idx) => {
    // Checked after the first move (index 0): the pawn attacks the gold on 5b.
    const [r, c] = sq('5b');
    return attacked(s, r, c, 0) ? null : 'pawn does not attack the gold on 5b';
  },
  'knight-fork': (s, state, idx) => {
    // Checked after the drop N*4c (index 0): knight attacks 5a king and 3a gold.
    if (idx !== 0) return null;
    const k = sq('5a'), g = sq('3a');
    const gold = at(s, '3a');
    if (!gold || gold.t !== 'G' || gold.o !== 1) return '3a gold missing';
    if (!inCheck(s, 1)) return 'knight drop does not check the king';
    return attacked(s, g[0], g[1], 0) ? null : 'knight does not attack 3a';
  },
  'drop-mate': (s) => {
    return inCheck(s, 1) && legalMoves(s).length === 0 ? null : 'final position is not checkmate';
  },
  'hisshi': (s) => {
    // The first move must not be check, and every Gote reply must allow mate in one.
    const s0 = U.parseSfen('8k/5G3/7l1/9/9/9/9/9/K8 b R 1');
    apply(s0, usiToMove(s0, '4b3b'));
    if (inCheck(s0, 1)) return 'hisshi move gives check';
    for (const r of legalMoves(s0)) {
      apply(s0, r);
      const mates = legalMoves(s0).some(m => { apply(s0, m); const ok = inCheck(s0, 1) && legalMoves(s0).length === 0; undo(s0, m); return ok; });
      undo(s0, r);
      if (!mates) return 'a Gote reply escapes the hisshi';
    }
    return inCheck(s, 1) && legalMoves(s).length === 0 ? null : 'final position is not checkmate';
  },
  'yagura-castle': (s) => castle(s, { '8h': 'K', '7h': 'G', '6g': 'G', '7g': 'S' }),
  'mino-castle': (s) => castle(s, { '2h': 'K', '3h': 'S', '4i': 'G', '5h': 'G' }),
};
function castle(s, want) {
  for (const [name, t] of Object.entries(want)) {
    const p = at(s, name);
    if (!p || p.t !== t || p.o !== 0) return `Sente ${t} is not on ${name}`;
  }
  return null;
}

let failures = 0;
const report = [];
for (const L of lessons) {
  const errs = [];
  const shape = ['id', 'title', 'summary', 'body', 'start', 'moves', 'notes', 'key'];
  for (const k of shape) if (!(k in L)) errs.push('missing field ' + k);
  if (!Array.isArray(L.body) || !L.body.length) errs.push('empty body');
  if (L.summary && (L.summary.match(/[.!?](\s|$)/g) || []).length > 1) errs.push('summary not one sentence');
  if (L.start === 'PLACEHOLDER_HISSHI_SFEN' || (L.moves || []).some(m => m.startsWith('PLACEHOLDER'))) errs.push('placeholder left in lesson');

  let s = L.start === 'startpos' ? initialState() : U.parseSfen(L.start);
  const lessonState = [];
  (L.moves || []).forEach((str, idx) => {
    const m = usiToMove(s, str);
    if (!m) { errs.push(`illegal move #${idx} ${str} in ${L.id}`); return; }
    apply(s, m);
    lessonState.push(JSON.parse(JSON.stringify(s)));
  });
  for (const k of Object.keys(L.notes || {})) {
    const i = +k;
    if (!(i >= 0 && i < (L.moves || []).length)) errs.push('note index out of range: ' + k);
  }
  // Tactical assertions. Replay state per move index where needed.
  if (ASSERTS[L.id]) {
    let res;
    if (L.id === 'knight-fork' || L.id === 'pawn-drop-threat') {
      const s1 = U.parseSfen(L.start);
      const m0 = usiToMove(s1, L.moves[0]);
      apply(s1, m0);
      res = ASSERTS[L.id](s1, lessonState[0], 0);
    } else if (L.id === 'bishop-diagonal') {
      res = ASSERTS[L.id](lessonState.length ? s : s);
    } else {
      res = ASSERTS[L.id](s, lessonState[lessonState.length - 1]);
    }
    if (res) errs.push(res);
  }
  if (errs.length) failures++;
  report.push(`${errs.length ? 'FAIL' : 'ok  '} ${L.id} (${(L.moves || []).length} moves)${errs.length ? ' :: ' + errs.join('; ') : ''}`);
}
console.log('lessons:');
console.log(report.join('\n'));
console.log(`lessons checked: ${lessons.length}, failures: ${failures}`);
process.exitCode = failures ? 1 : 0;
