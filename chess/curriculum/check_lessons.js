// Replays every lesson in lessons.json with the engine and checks it.
// Usage: node curriculum/check_lessons.js
const fs = require('fs');
const path = require('path');
const E = require(path.join(__dirname, '..', 'src', 'engine.js'));
const { parseFen, toFen, legalMoves, apply, inCheck, fromUci, initialState, KNIGHT, parseSq } = E;

const lessons = JSON.parse(fs.readFileSync(path.join(__dirname, 'lessons.json'), 'utf8'));
const REQUIRED = ['id', 'title', 'summary', 'body', 'start', 'moves', 'notes', 'key'];

const sq = name => parseSq(name);                       // [r, c]
const pieceOn = (fen, name) => { const [r, c] = sq(name); return parseFen(fen).b[r][c]; };
const isP = (p, t, o) => !!p && p.t === t && p.o === o;
const isMate = fen => { const st = parseFen(fen); return inCheck(st, st.turn) && legalMoves(st).length === 0; };
const knightHits = (from, to) => { const [fr, fc] = sq(from), [tr, tc] = sq(to); return KNIGHT.some(([dr, dc]) => fr + dr === tr && fc + dc === tc); };
const count = (fen, t, o) => { let n = 0; for (const row of parseFen(fen).b) for (const p of row) if (isP(p, t, o)) n++; return n; };

// Lesson-specific assertions. mv[i] = engine move object, after[i] = FEN after move i.
const ASSERT = {
  'pieces': ({ after }) => [
    !isP(pieceOn(after[4], 'c4'), 'B', 0) && 'after 3.Bc4 there is no white bishop on c4',
    !isP(pieceOn(after[6], 'e2'), 'Q', 0) && 'after 4.Qe2 there is no white queen on e2',
  ],
  'special-moves': ({ mv, after }) => [
    !mv[0].ep && 'move 0 should be en passant',
    (isP(pieceOn(after[0], 'd5'), 'P', 1) || !isP(pieceOn(after[0], 'd6'), 'P', 0)) && 'en passant did not remove d5 pawn and place White pawn on d6',
    mv[2].castle !== 'K' && 'move 2 should be kingside castling',
    !(isP(pieceOn(after[2], 'g1'), 'K', 0) && isP(pieceOn(after[2], 'f1'), 'R', 0)) && 'after castling, king should be on g1 and rook on f1',
    mv[4].promo !== 'Q' && 'move 4 should promote to a queen',
    !isP(pieceOn(after[4], 'b8'), 'Q', 0) && 'promoted queen missing on b8',
  ],
  'principles-italian': ({ mv, after }) => [
    mv[10].castle !== 'K' && 'move 10 should be White kingside castling',
    mv[11].castle !== 'K' && 'move 11 should be Black kingside castling',
    !isP(pieceOn(after[4], 'c4'), 'B', 0) && 'after 3.Bc4 there is no white bishop on c4',
  ],
  'ruy-lopez': ({ mv, after }) => [
    !isP(pieceOn(after[4], 'b5'), 'B', 0) && 'after 3.Bb5 there is no white bishop on b5',
    !isP(pieceOn(after[4], 'c6'), 'N', 1) && 'the c6 knight should still be on c6 after 3.Bb5',
    mv[8].castle !== 'K' && 'move 8 should be White castling',
    mv[15].castle !== 'K' && 'move 15 should be Black castling',
  ],
  'queens-gambit': ({ mv, after }) => [
    !isP(pieceOn(after[2], 'c4'), 'P', 0) && 'after 2.c4 there is no white pawn on c4',
    !isP(pieceOn(after[2], 'd5'), 'P', 1) && 'the black d5 pawn should still be on d5 after 2.c4',
    mv[9].castle !== 'K' && 'move 9 should be Black castling',
  ],
  'sicilian': ({ mv, after }) => [
    !isP(pieceOn(after[5], 'd4'), 'P', 1) && 'after ...cxd4 there is no black pawn on d4',
    !mv[6].cap && 'move 6 should recapture on d4',
    !isP(pieceOn(after[6], 'd4'), 'N', 0) && 'after Nxd4 there is no white knight on d4',
  ],
  'fork': ({ after }) => {
    const f = [];
    const s0 = parseFen(after[0]);
    if (!isP(pieceOn(after[0], 'c7'), 'N', 0)) f.push('after Nc7 there is no white knight on c7');
    if (!knightHits('c7', 'a8')) f.push('knight on c7 does not attack a8');
    if (!knightHits('c7', 'e8')) f.push('knight on c7 does not attack e8');
    if (!isP(pieceOn(after[0], 'a8'), 'R', 1)) f.push('black rook is not on a8 after Nc7');
    if (!isP(pieceOn(after[0], 'e8'), 'K', 1)) f.push('black king is not on e8 after Nc7');
    if (count(after[2], 'R', 1) !== 0) f.push('black rook still on board after Nxa8');
    if (!isP(pieceOn(after[2], 'a8'), 'N', 0)) f.push('white knight is not on a8 at the end');
    return f;
  },
  'pin': ({ startFen, after }) => {
    const f = [];
    const pinnedMoves = fen => legalMoves(parseFen(fen)).filter(m => m.from[0] === 1 && m.from[1] === 4).length;
    if (pinnedMoves(startFen) !== 0) f.push('knight on e7 has legal moves in the start position (should be pinned)');
    if (pinnedMoves(after[0]) !== 0) f.push('knight on e7 has legal moves after 1.Kf2 (should still be pinned)');
    if (pinnedMoves(after[1]) === 0) f.push('knight on e7 still has no legal moves after the king leaves the e-file');
    return f;
  },
  'skewer': ({ after }) => [
    !inCheck(parseFen(after[0]), 1) && 'after 1.Ra1+ the black king is not in check',
    !isP(pieceOn(after[2], 'a8'), 'R', 0) && 'white rook is not on a8 at the end',
    count(after[2], 'R', 1) !== 0 && 'black rook still on board after 3.Rxa8',
  ],
  'discovered-attack': ({ after }) => {
    const st = parseFen(after[0]);
    const replies = legalMoves(st);
    const f = [];
    if (!inCheck(st, 1)) f.push('black is not in check after the knight moves');
    if (!replies.length || replies.some(m => m.pt !== 'K')) f.push('some black reply is not a king move (double check requires king moves only)');
    return f;
  },
  'back-rank-mate': ({ after }) => [!isMate(after[0]) && 'final position is not checkmate'],
  'king-queen-mate': ({ after }) => [!isMate(after[0]) && 'final position is not checkmate'],
  'king-rook-mate': ({ after }) => {
    const f = [];
    if (legalMoves(parseFen(after[0])).length !== 8 && legalMoves(parseFen(after[0])).length === 0) f.push('black has no legal move after 1.Ra7');
    if (legalMoves(parseFen(after[0])).length !== 1) f.push(`black should have exactly one legal move after 1.Ra7 (has ${legalMoves(parseFen(after[0])).length})`);
    if (!isMate(after[2])) f.push('final position is not checkmate');
    return f;
  },
  'opposition': ({ after }) => {
    const st = parseFen(after[3]);
    const f = [];
    if (st.turn !== 1) f.push('side to move should be Black at the end');
    if (!isP(pieceOn(after[3], 'e4'), 'K', 0)) f.push('white king not on e4 at the end');
    if (!isP(pieceOn(after[3], 'e6'), 'K', 1)) f.push('black king not on e6 at the end');
    return f;
  },
};

let failed = 0;
const seen = new Set();
for (const l of lessons) {
  const fails = [];
  for (const k of REQUIRED) if (!(k in l)) fails.push(`missing field ${k}`);
  if (seen.has(l.id)) fails.push('duplicate id');
  seen.add(l.id);
  if (typeof l.summary === 'string' && (/\n/.test(l.summary) || (l.summary.match(/[.!?](\s|$)/g) || []).length > 1)) fails.push('summary is not one sentence');
  if (!Array.isArray(l.body) || !l.body.length || l.body.some(p => typeof p !== 'string' || !p.trim())) fails.push('body must be non-empty paragraphs');
  if (typeof l.key !== 'string' || /\n/.test(l.key)) fails.push('key must be one line');

  let s = null;
  try { s = l.start === 'startpos' ? initialState() : parseFen(l.start); } catch (e) { fails.push('bad start FEN: ' + e.message); }
  const ctx = { mv: [], after: [], startFen: null };
  if (s) {
    ctx.startFen = toFen(s);
    for (let i = 0; i < l.moves.length; i++) {
      const m = fromUci(s, l.moves[i]);
      if (!m) { fails.push(`move ${i + 1} (${l.moves[i]}) is illegal`); break; }
      apply(s, m);
      ctx.mv.push(m);
      ctx.after.push(toFen(s));
    }
    if (ctx.mv.length === l.moves.length) {
      for (const k of Object.keys(l.notes || {})) {
        const i = +k;
        if (!Number.isInteger(i) || i < 0 || i >= l.moves.length) fails.push(`note index ${k} out of range`);
        if (typeof l.notes[k] !== 'string' || !l.notes[k].trim()) fails.push(`note ${k} is empty`);
      }
      if (!ASSERT[l.id]) fails.push('no assertion registered for this lesson');
      else {
        try { fails.push(...ASSERT[l.id](ctx).filter(Boolean)); } catch (e) { fails.push('assertion threw: ' + e.message); }
      }
    }
  }
  const ok = fails.length === 0;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${l.id} (${l.moves ? l.moves.length : 0} moves)${ok ? '' : ' :: ' + fails.join('; ')}`);
}
console.log(`\n${lessons.length - failed}/${lessons.length} lessons passed`);
if (failed) process.exitCode = 1;
