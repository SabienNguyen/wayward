/* ================= APP ================= */
(function () {
  const KANJI = { K: '玉', R: '飛', B: '角', G: '金', S: '銀', N: '桂', L: '香', P: '歩', '+R': '龍', '+B': '馬', '+S': '全', '+N': '圭', '+L': '杏', '+P': 'と' };
  const LETTER = { K: 'King', R: 'Rook', B: 'Bishop', G: 'Gold', S: 'Silver', N: 'Knight', L: 'Lance', P: 'Pawn', '+R': 'Dragon', '+B': 'Horse', '+S': '+Silver', '+N': '+Knight', '+L': '+Lance', '+P': 'Tokin' };
  const KNUM = '一二三四五六七八九', RANKS = 'abcdefghi';
  const INFO = {
    K: ['King', '玉将 · gyokushō', 'Moves one square in any direction. If it can be captured and nothing can stop it, the game is over. Gote\'s king is written 王, Sente\'s 玉.'],
    R: ['Rook', '飛車 · hisha', 'Slides any distance up, down, left or right. Your strongest attacker. Promotes to the Dragon.'],
    B: ['Bishop', '角行 · kakugyō', 'Slides any distance diagonally. Promotes to the Horse, which also steps one square orthogonally.'],
    G: ['Gold general', '金将 · kinshō', 'One square in any direction except the two diagonals behind it. The king\'s best bodyguard. Never promotes.'],
    S: ['Silver general', '銀将 · ginshō', 'One square forward or diagonally in any direction. Good at attacking and retreating. May promote to move like a gold.'],
    N: ['Knight', '桂馬 · keima', 'Jumps two squares forward and one to the side, leaping over anything. It only ever moves forward, so it can get stuck.'],
    L: ['Lance', '香車 · kyōsha', 'Slides any distance straight forward. It can never move sideways or back.'],
    P: ['Pawn', '歩兵 · fuhyō', 'One square straight forward, and it captures the same way (unlike chess). Promotes to the tokin, which moves like a gold.'],
    '+R': ['Dragon', '龍王 · ryūō', 'A promoted rook. Rook moves plus one step diagonally. The most powerful piece in the game.'],
    '+B': ['Horse', '龍馬 · ryūma', 'A promoted bishop. Bishop moves plus one step up, down, left or right.'],
    '+S': ['Promoted silver', '成銀 · narigin', 'Moves exactly like a gold general. It loses the silver\'s backward diagonals.'],
    '+N': ['Promoted knight', '成桂 · narikei', 'Moves exactly like a gold general. No more jumping.'],
    '+L': ['Promoted lance', '成香 · narikyō', 'Moves exactly like a gold general.'],
    '+P': ['Tokin', 'と金 · tokin', 'A promoted pawn that moves like a gold general. When it is captured it goes back to being a humble pawn, so trading it costs you almost nothing.'],
  };
  const $ = id => document.getElementById(id);
  const esc = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const TAB_ID = Math.random().toString(36).slice(2);

  /* ---------- notation helpers ---------- */
  const sqName = (r, c) => `${9 - c}${RANKS[r]}`;
  function toUsi(m) {
    if (m.drop) return `${m.drop}*${9 - m.to[1]}${RANKS[m.to[0]]}`;
    return `${9 - m.from[1]}${RANKS[m.from[0]]}${9 - m.to[1]}${RANKS[m.to[0]]}${m.promo ? '+' : ''}`;
  }
  const fromUsi = (s, u, legal) => (legal || legalMoves(s)).find(m => toUsi(m) === u) || null;
  function toSfen(s) {
    const rows = [];
    for (let r = 0; r < 9; r++) {
      let row = '', e = 0;
      for (let c = 0; c < 9; c++) {
        const p = s.b[r][c];
        if (!p) { e++; continue; }
        if (e) { row += e; e = 0; }
        row += (p.p ? '+' : '') + (p.o ? p.t.toLowerCase() : p.t);
      }
      if (e) row += e;
      rows.push(row);
    }
    let hand = '';
    for (const side of [0, 1]) for (const t of HAND_ORDER) {
      const n = s.hands[side][t];
      if (n) hand += (n > 1 ? n : '') + (side ? t.toLowerCase() : t);
    }
    return `${rows.join('/')} ${s.turn ? 'w' : 'b'} ${hand || '-'} 1`;
  }
  function parseSfen(str) {
    if (!str || str === 'startpos') return initialState();
    const [board, side, hand] = str.trim().split(/\s+/);
    const s = initialState();
    s.b = Array.from({ length: 9 }, () => Array(9).fill(null));
    board.split('/').forEach((row, r) => {
      let c = 0, pro = false;
      for (const ch of row) {
        if (ch === '+') { pro = true; continue; }
        if (/\d/.test(ch)) { c += +ch; continue; }
        const up = ch.toUpperCase();
        s.b[r][c++] = { t: up, o: ch === up ? 0 : 1, p: pro };
        pro = false;
      }
    });
    s.turn = side === 'w' ? 1 : 0;
    for (const side of [0, 1]) for (const t of HAND_ORDER) s.hands[side][t] = 0;
    if (hand && hand !== '-') {
      let n = '';
      for (const ch of hand) {
        if (/\d/.test(ch)) { n += ch; continue; }
        const up = ch.toUpperCase();
        s.hands[ch === up ? 0 : 1][up] += n ? +n : 1;
        n = '';
      }
    }
    return s;
  }
  function notation(s, m, all) {
    const key = m.drop ? m.drop : pkey(s.b[m.from[0]][m.from[1]]);
    const letter = (key[0] === '+' ? '+' : '') + key.slice(-1);
    let origin = '';
    if (!m.drop) {
      const amb = all.some(o => o.to[0] === m.to[0] && o.to[1] === m.to[1] && o.from && (o.from[0] !== m.from[0] || o.from[1] !== m.from[1]) && pkey(s.b[o.from[0]][o.from[1]]) === key);
      if (amb) origin = sqName(...m.from);
    }
    const sep = m.drop ? '*' : (s.b[m.to[0]][m.to[1]] ? 'x' : '-');
    const suf = m.promo ? '+' : (m.canPromo ? '=' : '');
    const mark = s.turn === 0 ? '▲' : '△';
    const kj = `${mark}${9 - m.to[1]}${KNUM[m.to[0]]}${KANJI[key]}${m.promo ? '成' : (m.canPromo ? '不成' : '')}${m.drop ? '打' : ''}`;
    return { w: `${letter}${origin}${sep}${sqName(...m.to)}${suf}`, k: kj };
  }
  function boardText(s) {
    let t = '  9  8  7  6  5  4  3  2  1\n';
    for (let r = 0; r < 9; r++) {
      let row = '';
      for (let c = 0; c < 9; c++) {
        const p = s.b[r][c];
        row += p ? ((p.p ? '+' : ' ') + (p.o ? p.t.toLowerCase() : p.t) + ' ') : ' . ';
      }
      t += row + ' ' + RANKS[r] + '\n';
    }
    const hand = side => HAND_ORDER.filter(x => s.hands[side][x]).map(x => `${LETTER[x]}×${s.hands[side][x]}`).join(', ') || 'nothing';
    return t + `Sente (uppercase, moves up) holds: ${hand(0)}\nGote (lowercase, moves down) holds: ${hand(1)}\n`;
  }

  /* ---------- engines ---------- */
  const ML = (typeof WEIGHTS !== 'undefined' && WEIGHTS && WEIGHTS.checkpoints) ? WEIGHTS.checkpoints : [];
  const mlCache = {};
  function mlWeights(id) {
    if (mlCache[id]) return mlCache[id];
    const cp = ML.find(c => c.id === id);
    if (!cp) return null;
    let w;
    if (typeof mlLoad === 'function') w = mlLoad(cp);
    else w = Float32Array.from(cp.w);
    return (mlCache[id] = w);
  }
  const LEVELS = [
    ...ML.map(cp => ({ id: 'ml:' + cp.id, name: cp.name, detail: cp.games ? `Machine-learned · studied ${cp.games.toLocaleString()} games` : 'Machine-learned · no games studied yet, plays almost at random', kind: 'ml', cp: cp.id })),
    { id: 'classic:1', name: 'Classic · Easy', detail: 'Hand-written engine, shallow and a bit random', kind: 'classic', depth: 1, noise: 260 },
    { id: 'classic:2', name: 'Classic · Casual', detail: 'Hand-written engine, looks 2 moves ahead', kind: 'classic', depth: 2, noise: 40 },
    { id: 'classic:3', name: 'Classic · Tough', detail: 'Hand-written engine, looks 3 moves ahead', kind: 'classic', depth: 3, noise: 0 },
  ];
  const levelById = id => LEVELS.find(l => l.id === id) || LEVELS.find(l => l.id === 'classic:2');
  function withEval(fn, cb) {
    const prev = EVAL_FN;
    EVAL_FN = fn;
    try { return cb(); } finally { EVAL_FN = prev; }
  }
  function engineMove(s, levelId) {
    const L = levelById(levelId);
    if (L.kind === 'ml') {
      const w = mlWeights(L.cp);
      if (!w || typeof mlEval !== 'function') return bestMove(s, 2, 40);
      return withEval(st => mlEval(st, w), () => bestMove(s, 2, 30));
    }
    return bestMove(s, L.depth, L.noise);
  }
  // Every legal move scored from the side to move's view (centipawns), best first.
  function analyze(s, depth = 2) {
    const moves = legalMoves(s), out = [];
    for (const m of moves) {
      apply(s, m);
      const v = -search(s, depth - 1, -MATE * 2, MATE * 2, 1);
      undo(s, m);
      out.push({ m, v });
    }
    out.sort((a, b) => b.v - a.v);
    return out;
  }
  const fmtScore = v => Math.abs(v) > MATE / 2 ? (v > 0 ? 'forced mate' : 'getting mated') : (v >= 0 ? '+' : '−') + (Math.abs(v) / 100).toFixed(1);

  /* ---------- state ---------- */
  const G = {
    sess: null, saved: null,
    labels: true, showEval: false,
    sel: null, targets: [], threats: [], hint: null, thinking: false,
    seen: {}, coach: null, tab: 'tutor',
    db: null, user: null, sample: null, me: null, canWrite: null,
    lobby: [], names: {}, onlineUnsub: null, onlineDoc: null, writing: Promise.resolve(),
    stats: { wins: {}, losses: {}, draws: {}, puzzles: {}, lessons: {}, online: {} },
    tutorTurns: [], tutorCtl: null, tutorBusy: false,
    lesson: null, lessonStep: 0,
  };
  function newSession(kind, opts = {}) {
    const start = opts.start || 'startpos';
    const s = parseSfen(start);
    return {
      kind, start, s, history: [], keys: [positionKey(s)], over: null, overShown: false,
      human: opts.human || [0], flip: !!opts.flip, level: opts.level || 'classic:2',
      gameId: opts.gameId || null, puzzle: opts.puzzle || null, label: opts.label || '',
    };
  }
  const S = () => G.sess;
  const humanTurn = () => { const x = S(); return !x.over && !G.thinking && x.human.includes(x.s.turn); };

  /* ---------- core move flow ---------- */
  function play(m, opts = {}) {
    const x = S(), s = x.s, mover = s.turn;
    const all = opts.legal || legalMoves(s);
    const nt = notation(s, m, all);
    const usi = toUsi(m);
    const captured = !m.drop && s.b[m.to[0]][m.to[1]];
    apply(s, m);
    x.history.push({ m, nt, usi, say: opts.say || null, by: mover });
    x.keys.push(positionKey(s));
    G.sel = null; G.targets = []; G.threats = []; G.hint = null;
    checkEnd(x);
    if (opts.silent) return;
    if (x.kind !== 'puzzle' && x.kind !== 'lesson') coachAfter(m, mover, captured);
    if (x.over && x.kind !== 'online') recordResult(x);
    afterMove(x, m, opts);
    save(); render();
  }
  function checkEnd(x) {
    const s = x.s, key = x.keys[x.keys.length - 1];
    if (x.keys.filter(k => k === key).length >= 4) { x.over = { winner: null, reason: 'Fourfold repetition (sennichite). The game is a draw.' }; return; }
    if (!legalMoves(s).length) x.over = { winner: s.turn ^ 1, reason: inCheck(s, s.turn) ? 'Checkmate.' : 'No legal moves left, which counts as a loss in shogi.' };
  }
  function afterMove(x, m, opts) {
    if (x.kind === 'ai') maybeEngine();
    else if (x.kind === 'claude') maybeClaudeLocal();
    else if (x.kind === 'online' && !opts.remote) pushOnline(x);
    else if (x.kind === 'puzzle') puzzleAfter(x, m);
  }
  function opponentLabel(x) {
    if (x.kind === 'ai') return levelById(x.level).name;
    if (x.kind === 'claude') return 'Claude';
    if (x.kind === 'online') return 'Online';
    return null;
  }
  function recordResult(x) {
    const lab = opponentLabel(x);
    if (!lab || x.human.length !== 1) return;
    if (x.gameId) { if (G.stats.online[x.gameId]) return; G.stats.online[x.gameId] = 1; }
    const me = x.human[0];
    const bucket = x.over.winner === null ? 'draws' : (x.over.winner === me ? 'wins' : 'losses');
    G.stats[bucket][lab] = (G.stats[bucket][lab] || 0) + 1;
    saveStats();
  }

  /* ---------- coach ---------- */
  function setCoach(id, html) {
    if (id && G.seen[id]) return;
    if (id) G.seen[id] = 1;
    G.coach = html;
  }
  function coachAfter(m, mover, captured) {
    const x = S();
    const humanMoved = x.human.includes(mover);
    if (x.over) return;
    if (inCheck(x.s, x.s.turn) && x.human.includes(x.s.turn)) {
      setCoach('check', '<b>Check!</b> Your king is attacked. You must escape: move the king, capture the attacker, or block the line. Dropping a piece from your stand to block counts too. Only legal escapes will light up.');
      return;
    }
    if (humanMoved && m.drop) { setCoach('drop', '<b>Nice drop.</b> Remember the drop rules: never two unpromoted pawns of yours in one file, no dropping where a piece could never move again, and no checkmating with a pawn drop.'); return; }
    if (humanMoved && captured) { setCoach('cap', `<b>You captured a ${LETTER[captured.t].toLowerCase()}.</b> It now sits on your stand. On any later turn, tap it and drop it on an empty square instead of moving a piece.`); return; }
    if (!humanMoved && captured && x.human.length === 1) { setCoach('lost', `<b>Your ${LETTER[captured.t].toLowerCase()} was taken.</b> It's on your opponent's stand now, so it can be dropped almost anywhere. Check their stand before each move and ask where those pieces could land.`); return; }
    if (humanMoved && m.promo) { setCoach('promo', '<b>Promoted!</b> Promoted pieces show red characters. If this piece is ever captured it goes back to its plain side in your opponent\'s hand.'); return; }
    if (x.history.length === 6) setCoach('castle', '<b>Tip:</b> In shogi the king usually walks toward one side early, and golds and silvers form a wall around it (a castle). The Lessons tab walks through the main castles move by move.');
  }

  /* ---------- computer opponent ---------- */
  function maybeEngine() {
    const x = S();
    if (x.kind !== 'ai' || x.over || x.human.includes(x.s.turn)) return;
    G.thinking = true; render();
    setTimeout(() => {
      if (S() !== x) { G.thinking = false; return; }
      const m = engineMove(x.s, x.level);
      G.thinking = false;
      if (m) play(fromUsi(x.s, toUsi(m))); else render();
    }, 60);
  }

  /* ---------- Claude as a player ---------- */
  const CLAUDE_RULES = 'You are Claude, playing a friendly game of shogi (Japanese chess) against a learner. Pick a strong but human-like move. Prefer the engine candidates unless you see a clear reason otherwise, and never play a move that is not in the legal list. Reply with only JSON: {"move":"<one USI move from the legal list>","say":"<one or two short sentences to your opponent: the idea behind your move, in plain words, with no spoilers about their best reply>"}.';
  async function claudeChooseMove(x) {
    const s = x.s;
    const legal = legalMoves(s);
    const ranked = analyze(s, 2).slice(0, 6);
    const recent = x.history.slice(-10).map(h => `${h.by ? '△' : '▲'}${h.nt.w}`).join(' ') || '(game start)';
    const prompt = `${CLAUDE_RULES}

You play ${s.turn ? 'Gote (lowercase pieces, moving down the board)' : 'Sente (uppercase pieces, moving up the board)'}.
Position (SFEN): ${toSfen(s)}
${boardText(s)}
Recent moves: ${recent}
Engine candidates (score for you, in pawns): ${ranked.map(r => `${toUsi(r.m)} (${notation(s, r.m, legal).w}, ${fmtScore(r.v)})`).join('; ')}
All legal moves (USI): ${legal.map(toUsi).join(' ')}`;
    let pick = null, say = null;
    try {
      const res = await G.sample.json(prompt, { cache: false });
      if (res && typeof res.move === 'string') pick = fromUsi(s, res.move.trim(), legal);
      if (res && typeof res.say === 'string') say = res.say.slice(0, 400);
    } catch (e) {
      say = e && e.code === 'not_granted' ? null : null;
    }
    if (!pick) { pick = ranked[0] ? fromUsi(s, toUsi(ranked[0].m), legal) : null; say = say || null; }
    return { pick, say };
  }
  async function maybeClaudeLocal() {
    const x = S();
    if (x.kind !== 'claude' || x.over || x.human.includes(x.s.turn)) return;
    G.thinking = true; render();
    let pick, say;
    if (G.sample) ({ pick, say } = await claudeChooseMove(x));
    else { const m = bestMove(x.s, 2, 30); pick = m && fromUsi(x.s, toUsi(m)); say = 'The tutor permission isn\'t available here, so the built-in engine moved for me.'; }
    G.thinking = false;
    if (S() !== x) return;
    if (pick) play(pick, { say }); else render();
  }

  /* ---------- interaction ---------- */
  function selectBoard(r, c) {
    const x = S(), p = x.s.b[r][c];
    G.hint = null;
    showGuide(pkey(p));
    if (p.o === x.s.turn && humanTurn()) {
      G.sel = { kind: 'board', r, c };
      G.targets = legalMoves(x.s).filter(m => m.from && m.from[0] === r && m.from[1] === c);
      G.threats = [];
      if (!G.targets.length) setCoach(null, `That ${LETTER[pkey(p)].toLowerCase()} has no legal moves right now${inCheck(x.s, x.s.turn) ? ' because your king is in check' : ''}.`);
    } else {
      G.sel = { kind: 'inspect', r, c };
      G.targets = [];
      const tmp = []; genPieceMoves(x.s, r, c, tmp, false);
      G.threats = tmp;
      if (!G.seen.inspect && x.kind !== 'lesson') setCoach('inspect', '<b>Red dots</b> show where that piece can reach. Use this to spot threats before you move.');
    }
    render();
  }
  function onSquare(r, c) {
    if (G.sel && G.targets.length) {
      const cands = G.targets.filter(m => m.to[0] === r && m.to[1] === c);
      if (cands.length === 1) return play(cands[0]);
      if (cands.length === 2) return askPromo(cands);
    }
    const p = S().s.b[r][c];
    if (p) {
      if (G.sel && G.sel.kind !== 'hand' && G.sel.r === r && G.sel.c === c) { clearSel(); render(); return; }
      selectBoard(r, c);
    } else { clearSel(); render(); }
  }
  const clearSel = () => { G.sel = null; G.targets = []; G.threats = []; };
  function onHand(side, t) {
    const x = S();
    showGuide(t);
    if (side === x.s.turn && humanTurn()) {
      if (G.sel && G.sel.kind === 'hand' && G.sel.t === t) clearSel();
      else {
        G.sel = { kind: 'hand', side, t };
        G.targets = legalMoves(x.s).filter(m => m.drop === t);
        G.threats = [];
        setCoach('dropsel', '<b>Dropping a piece.</b> Dots show every empty square where it may legally land. Missing squares are blocked by the drop rules (see Rules).');
      }
    }
    render();
  }
  function askPromo(cands) {
    const [no, yes] = cands[0].promo ? [cands[1], cands[0]] : cands;
    const t = yes.pt;
    $('promoChoices').innerHTML =
      `<button class="choice" type="button" data-p="1"><div class="pcbox">${pieceHTML('+' + t, 0)}</div><span>Promote</span><small>${INFO['+' + t][0]}</small></button>` +
      `<button class="choice" type="button" data-p="0"><div class="pcbox">${pieceHTML(t, 0)}</div><span>Stay as is</span><small>${INFO[t][0]}</small></button>`;
    $('promoDlg').hidden = false;
    $('promoChoices').querySelector('button').focus();
    $('promoChoices').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      $('promoDlg').hidden = true;
      play(b.dataset.p === '1' ? yes : no);
    };
  }

  function rebuild(x, usis) {
    x.s = parseSfen(x.start); x.history = []; x.keys = [positionKey(x.s)]; x.over = null;
    const prev = G.sess; G.sess = x;
    for (const u of usis) {
      const legal = legalMoves(x.s);
      const m = fromUsi(x.s, u, legal);
      if (!m) break;
      play(m, { silent: true, legal });
    }
    G.sess = prev;
  }
  function undoMove() {
    const x = S();
    if (G.thinking || !x.history.length || x.kind === 'online' || x.kind === 'lesson') return;
    let pops = 1;
    if ((x.kind === 'ai' || x.kind === 'claude') && !x.human.includes(x.history[x.history.length - 1].by) && x.history.length >= 2) pops = 2;
    for (let i = 0; i < pops && x.history.length; i++) { const h = x.history.pop(); x.keys.pop(); undo(x.s, h.m); }
    x.over = null; x.overShown = false; clearSel(); G.hint = null;
    $('endDlg').hidden = true;
    setCoach(null, 'Move taken back. Have another look.');
    save(); render();
    if (x.kind === 'ai') maybeEngine();
  }
  function hint() {
    if (!humanTurn()) return;
    const x = S();
    const m = bestMove(x.s, 2);
    if (!m) return;
    G.hint = m; clearSel();
    const nt = notation(x.s, m, legalMoves(x.s));
    const what = m.drop ? `dropping your ${LETTER[m.drop].toLowerCase()} on ${sqName(...m.to)}` : `${m.promo ? 'moving and promoting' : 'moving'} the piece on ${sqName(...m.from)} to ${sqName(...m.to)}`;
    setCoach(null, `<b>Engine hint:</b> try <span class="nt">${nt.w}</span>, ${what}. The green outline marks it. Ask the Tutor tab why.`);
    render();
  }

  function startGame(kind, opts = {}) {
    leaveOnline();
    G.sess = newSession(kind, opts);
    G.thinking = false; clearSel(); G.hint = null;
    $('endDlg').hidden = true;
    G.seen = {};
    if (kind === 'ai') setCoach(null, `<b>You play Sente (▲)</b> at the bottom against <b>${esc(levelById(G.sess.level).name)}</b>. Tap any piece to see where it can go. A classic first move: <span class="nt">P-7f</span>, opening your bishop's diagonal.`);
    else if (kind === 'claude') setCoach(null, '<b>You\'re playing Claude.</b> Claude picks its moves with help from the engine and tells you the idea behind each one. Ask the Tutor tab anything along the way.');
    else if (kind === 'pvp') setCoach(null, '<b>Pass and play.</b> Sente (▲, bottom) moves first, then hand the device over.');
    save(); render();
    if (kind === 'ai') maybeEngine();
    if (kind === 'claude') maybeClaudeLocal();
  }
  function newGameFromControls() {
    const mode = $('mode').value;
    if (mode === 'online') { showTab('online'); return; }
    startGame(mode, { level: $('level').value, human: mode === 'pvp' ? [0, 1] : [0] });
  }

  /* ---------- rendering ---------- */
  const pieceHTML = (key, side, extra = '') =>
    `<div class="pc ${side ? 'gote' : ''} ${key[0] === '+' ? 'pro' : ''} ${extra}"><span class="k">${key === 'K' && side === 1 ? '王' : KANJI[key]}</span><span class="en">${LETTER[key]}</span></div>`;
  function playerName(x, side) {
    if (x.kind === 'ai') return x.human.includes(side) ? 'You' : levelById(x.level).name;
    if (x.kind === 'claude') return x.human.includes(side) ? 'You' : 'Claude';
    if (x.kind === 'online') { const id = G.onlineDoc && (side ? G.onlineDoc.gote : G.onlineDoc.sente); return id ? displayName(id) : 'Open seat'; }
    if (x.kind === 'puzzle') return side ? 'Defender' : 'You';
    if (x.kind === 'lesson') return side ? 'Gote' : 'Sente';
    return side ? 'Gote' : 'Sente';
  }
  function render() {
    const x = S(), s = x.s;
    document.body.classList.toggle('no-en', !G.labels);
    const last = x.history.length ? x.history[x.history.length - 1].m : null;
    const kingSq = inCheck(s, s.turn) ? findKing(s, s.turn) : null;
    const tgt = new Set(G.targets.map(m => m.to[0] * 9 + m.to[1]));
    const thr = new Set(G.threats.map(m => m.to[0] * 9 + m.to[1]));
    const flip = x.flip;
    let html = '';
    for (let dr = 0; dr < 9; dr++) for (let dc = 0; dc < 9; dc++) {
      const r = flip ? 8 - dr : dr, c = flip ? 8 - dc : dc;
      const p = s.b[r][c], i = r * 9 + c, cls = ['sq'];
      if (p) cls.push('has-piece');
      if (last && ((last.to[0] === r && last.to[1] === c) || (last.from && last.from[0] === r && last.from[1] === c))) cls.push('last');
      if (G.sel && G.sel.kind !== 'hand' && G.sel.r === r && G.sel.c === c) cls.push('sel');
      if (kingSq && kingSq[0] === r && kingSq[1] === c) cls.push('check');
      if (G.hint && ((G.hint.to[0] === r && G.hint.to[1] === c) || (G.hint.from && G.hint.from[0] === r && G.hint.from[1] === c))) cls.push('hint');
      if (tgt.has(i)) cls.push('target');
      if (thr.has(i)) cls.push('threat');
      const label = `${sqName(r, c)}${p ? ' ' + (p.o ? 'Gote ' : 'Sente ') + LETTER[pkey(p)] : ''}`;
      html += `<button type="button" class="${cls.join(' ')}" data-r="${r}" data-c="${c}" aria-label="${label}">${p ? pieceHTML(pkey(p), p.o ^ (flip ? 1 : 0)) : ''}</button>`;
    }
    for (const [a, b] of [[3, 3], [3, 6], [6, 3], [6, 6]]) html += `<span class="hoshi" style="left:${a / 9 * 100}%;top:${b / 9 * 100}%"></span>`;
    $('grid').innerHTML = html;
    const files = [9, 8, 7, 6, 5, 4, 3, 2, 1];
    $('files').innerHTML = (flip ? files.reverse() : files).map(n => `<span>${n}</span>`).join('');
    const rk = [...KNUM].map((k, i) => `<span>${k}<small>${RANKS[i]}</small></span>`);
    $('ranks').innerHTML = (flip ? rk.reverse() : rk).join('');

    const topSide = flip ? 0 : 1, botSide = topSide ^ 1;
    for (const [elId, whoId, standId, side] of [['handTop', 'whoTop', 'standTop', topSide], ['handBot', 'whoBot', 'standBot', botSide]]) {
      const hand = s.hands[side];
      let h = '';
      for (const t of HAND_ORDER) if (hand[t]) {
        const sel = G.sel && G.sel.kind === 'hand' && G.sel.side === side && G.sel.t === t;
        h += `<button type="button" class="hp ${sel ? 'sel' : ''}" data-side="${side}" data-t="${t}" aria-label="${LETTER[t]} in hand, ${hand[t]}">${pieceHTML(t, side ^ (flip ? 1 : 0), 'small')}${hand[t] > 1 ? `<span class="count">${hand[t]}</span>` : ''}</button>`;
      }
      $(elId).innerHTML = h || '<span class="empty">No captured pieces</span>';
      $(whoId).innerHTML = `<b>${side ? '△' : '▲'} ${esc(playerName(x, side))}</b>${side ? 'Gote' : 'Sente'}`;
      $(standId).classList.toggle('active', !x.over && s.turn === side);
    }

    const msg = $('msg');
    msg.classList.remove('check');
    if (x.over) msg.textContent = x.over.winner === null ? 'Draw' : `${x.over.winner ? '△' : '▲'} ${playerName(x, x.over.winner)} ${playerName(x, x.over.winner) === 'You' ? 'win' : 'wins'}${x.over.reason === 'Resigned.' ? ' by resignation' : ''}`;
    else if (G.thinking) msg.textContent = `${playerName(x, s.turn)} is thinking…`;
    else if (x.kind === 'lesson') msg.textContent = G.lesson ? G.lesson.title : 'Lesson';
    else {
      const who = x.human.includes(s.turn) ? (x.human.length > 1 ? `${s.turn ? '△ Gote' : '▲ Sente'} to move` : 'Your move') : `Waiting for ${playerName(x, s.turn)}`;
      msg.textContent = who + (inCheck(s, s.turn) ? ': check!' : '');
      if (inCheck(s, s.turn)) msg.classList.add('check');
    }
    $('moveNo').textContent = x.kind === 'lesson' ? '' : `Move ${x.history.length + 1}`;
    $('modeChip').textContent = { ai: 'vs Computer', claude: 'vs Claude', pvp: 'Pass and play', online: 'Online', puzzle: 'Puzzle', lesson: 'Lesson' }[x.kind];
    $('returnBtn').hidden = !(G.saved && (x.kind === 'puzzle' || x.kind === 'lesson'));
    $('resignBtn').hidden = !(x.kind === 'online' && !x.over && x.human.length);
    const last2 = x.history[x.history.length - 1];
    $('claudeSays').hidden = !(last2 && last2.say);
    if (last2 && last2.say) $('claudeSaysText').textContent = last2.say;
    $('coach').innerHTML = G.coach || '';
    $('coach').hidden = !G.coach;
    $('undoBtn').disabled = !x.history.length || G.thinking || x.kind === 'online' || x.kind === 'lesson';
    $('hintBtn').disabled = !humanTurn();
    $('level').disabled = $('mode').value !== 'ai';
    renderEval();

    const log = $('log');
    log.innerHTML = x.history.length
      ? x.history.map((h, i) => `<li><span class="n">${i + 1}.</span><span class="mv">${h.by ? '△' : '▲'}${h.nt.w}<small>${h.nt.k}</small></span></li>`).join('')
      : '<li class="log-empty">No moves yet.</li>';
    log.scrollTop = log.scrollHeight;

    if (x.over && !x.overShown && x.kind !== 'puzzle') {
      x.overShown = true;
      const w = x.over.winner;
      const mine = x.human.length === 1 ? x.human[0] : null;
      $('endTitle').textContent = w === null ? 'Draw' : (mine === null ? `${w ? 'Gote' : 'Sente'} wins` : (w === mine ? 'You win!' : `${playerName(x, w)} wins`));
      $('endText').textContent = x.over.reason + (mine !== null && w !== null && w !== mine ? ' Ask the Tutor to review the game and show you where it turned.' : ' Ask the Tutor for a review to learn even from a win.');
      $('endUndo').hidden = x.kind === 'online';
      $('endDlg').hidden = false;
    }
    renderOnlineBits();
  }
  function renderEval() {
    const el = $('evalLine');
    if (!G.showEval || S().kind === 'lesson') { el.hidden = true; return; }
    const x = S();
    let v = x.over ? null : search(x.s, 1, -MATE * 2, MATE * 2, 0);
    if (v !== null && x.s.turn === 1) v = -v; // from Sente's view
    el.hidden = false;
    el.innerHTML = v === null ? 'Game over' : `<span>Engine evaluation</span><span class="evbar"><span style="width:${Math.max(4, Math.min(96, 50 + v / 30))}%"></span></span><b>${fmtScore(v)}</b> <span class="muted">for ▲</span>`;
  }

  /* ---------- piece guide ---------- */
  function diagramHTML(key) {
    const mv = MOVES[0][key], cells = {};
    for (const [r, c] of mv.steps) cells[`${r},${c}`] = Math.abs(r) === 2 ? 'jump' : 'step';
    for (const [r, c] of mv.slides) for (let k = 1; k <= 2; k++) { const id = `${r * k},${c * k}`; if (!cells[id]) cells[id] = 'ray'; }
    let h = '<div class="mgrid" aria-hidden="true">';
    for (let r = -2; r <= 2; r++) for (let c = -2; c <= 2; c++) h += r === 0 && c === 0 ? `<span class="me">${KANJI[key]}</span>` : `<span class="${cells[`${r},${c}`] || ''}"></span>`;
    return h + '</div>';
  }
  function showGuide(key) {
    const [name, jp, desc] = INFO[key];
    const base = key.replace('+', '');
    const promoKey = key[0] === '+' ? null : (PROMOTABLE[key] ? '+' + key : null);
    const value = key[0] === '+' ? PVAL[base] : VAL[key];
    let h = `<div class="guide-head"><div class="big">${pieceHTML(key, 0)}</div><div><div class="eyebrow">${key[0] === '+' ? 'Promoted piece' : 'Piece'}</div><h2>${name}</h2><div class="romaji">${jp}</div></div></div>`;
    h += `<p style="margin-top:12px">${desc}</p><h3>How it moves</h3><div class="diagrams"><figure class="diag">${diagramHTML(key)}<figcaption>${name}</figcaption></figure>`;
    if (promoKey) h += `<figure class="diag">${diagramHTML(promoKey)}<figcaption>Promoted: ${INFO[promoKey][0]}</figcaption></figure>`;
    if (key[0] === '+') h += `<figure class="diag">${diagramHTML(base)}<figcaption>Before promotion: ${INFO[base][0]}</figcaption></figure>`;
    h += '</div><div class="legend"><span><i></i>one step</span><span><i class="r"></i>slides any distance</span>' + (base === 'N' && key[0] !== '+' ? '<span><i class="j"></i>jump</span>' : '') + '</div>';
    h += '<p class="muted small" style="margin-top:6px">Diagrams face Sente\'s way: forward is up.</p>';
    if (key !== 'K') h += `<h3>Rough value</h3><p>About ${Math.round(value / 100)} pawn${value >= 150 ? 's' : ''}.</p>`;
    h += '<h3>All pieces</h3><div class="allpieces">' + allPiecesHTML() + '</div>';
    $('pane-pieces').innerHTML = h;
  }
  const allPiecesHTML = () => ['K', 'R', 'B', 'G', 'S', 'N', 'L', 'P', '+R', '+B', '+P'].map(k =>
    `<button type="button" class="pcard" data-key="${k}"><div class="mini">${pieceHTML(k, 0)}</div><div><b>${INFO[k][0]}</b><small>${INFO[k][1].split(' · ')[0]}</small></div></button>`).join('');
  function showTab(name) {
    G.tab = name;
    for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false');
    for (const p of document.querySelectorAll('.tabpane')) p.hidden = p.id !== 'pane-' + name;
    if (name === 'puzzles') renderPuzzles();
    if (name === 'lessons') renderLessons();
    if (name === 'online') renderLobby();
    try { localStorage.setItem('shogi-dojo-tab', name); } catch (e) {}
  }

  /* ---------- puzzles ---------- */
  const PZ = (typeof PUZZLES !== 'undefined' && Array.isArray(PUZZLES)) ? PUZZLES : [];
  function enterSide() { if (S() && S().kind !== 'puzzle' && S().kind !== 'lesson' && S().kind !== 'online') G.saved = S(); }
  function startPuzzle(p) {
    enterSide(); leaveOnline();
    G.sess = newSession('puzzle', { start: p.sfen, human: [0], puzzle: p });
    clearSel(); G.hint = null; G.thinking = false;
    setCoach(null, `<b>Mate in ${p.mate}.</b> ${p.mate === 1 ? 'Find the one move that checkmates.' : 'Every one of your moves must be check. Find the first move; the defender will reply.'} Your opponent's stand shows the pieces they can drop to defend.`);
    $('puzzleFeedback').innerHTML = '';
    render(); renderPuzzles();
  }
  function puzzleAfter(x, m) {
    if (x.history[x.history.length - 1].by !== 0) return;
    const p = x.puzzle, ply = x.history.length - 1, fb = $('puzzleFeedback');
    const usi = toUsi(m);
    const lastAttack = ply === p.line.length - 1 || ply >= (p.mate * 2 - 2);
    const mated = x.over && x.over.winner === 0;
    if (mated) {
      G.stats.puzzles[p.id] = true; saveStats();
      setCoach(null, `<b>Solved!</b> ${esc(p.explain || '')}`);
      fb.innerHTML = '';
      renderPuzzles(); render();
      return;
    }
    const expected = p.line[ply];
    if (lastAttack || usi !== expected) {
      setCoach(null, `<b>Not quite.</b> ${usi === expected ? '' : 'That doesn\'t force mate. '}Hint: ${esc(p.hint || 'look for a check that takes away every escape square.')}`);
      setTimeout(() => { if (S() !== x) return; const h = x.history.pop(); x.keys.pop(); undo(x.s, h.m); x.over = null; render(); }, 700);
      render();
      return;
    }
    // Correct intermediate move: play the defender's reply.
    G.thinking = true; render();
    setTimeout(() => {
      G.thinking = false;
      if (S() !== x) return;
      const reply = fromUsi(x.s, p.line[ply + 1]) || (analyze(x.s, 2)[0] || {}).m;
      if (reply) play(fromUsi(x.s, toUsi(reply)));
      setCoach(null, '<b>Good.</b> The defender replied. Keep checking until it\'s mate.');
      render();
    }, 450);
  }
  function renderPuzzles() {
    const el = $('puzzleList');
    if (!PZ.length) { el.innerHTML = '<p class="muted">No puzzles loaded.</p>'; return; }
    const solved = PZ.filter(p => G.stats.puzzles[p.id]).length;
    $('puzzleProgress').textContent = `${solved} of ${PZ.length} solved`;
    const cur = S().kind === 'puzzle' ? S().puzzle.id : null;
    const groups = [...new Set(PZ.map(p => p.mate))].sort();
    el.innerHTML = groups.map(n => `<h3>Mate in ${n}</h3><div class="pzgrid">` + PZ.filter(p => p.mate === n).map((p, i) =>
      `<button type="button" class="pz ${G.stats.puzzles[p.id] ? 'done' : ''} ${cur === p.id ? 'cur' : ''}" data-pz="${esc(p.id)}" aria-label="Puzzle ${i + 1}, mate in ${n}${G.stats.puzzles[p.id] ? ', solved' : ''}">${i + 1}</button>`).join('') + '</div>').join('');
    const fbActions = $('puzzleActions');
    fbActions.hidden = !cur;
  }

  /* ---------- lessons ---------- */
  const LS = (typeof LESSONS !== 'undefined' && Array.isArray(LESSONS)) ? LESSONS : [];
  function openLesson(id) {
    const L = LS.find(l => l.id === id); if (!L) return;
    enterSide(); leaveOnline();
    G.lesson = L; G.lessonStep = 0;
    G.sess = newSession('lesson', { start: L.start || 'startpos', human: [] });
    clearSel(); G.hint = null; G.coach = null;
    G.stats.lessons[L.id] = true; saveStats();
    lessonGo(0);
  }
  function lessonGo(step) {
    const L = G.lesson; if (!L) return;
    step = Math.max(0, Math.min(L.moves.length, step));
    G.lessonStep = step;
    rebuild(G.sess, L.moves.slice(0, step));
    clearSel();
    renderLessons(); render();
  }
  function renderLessons() {
    const el = $('lessonBody');
    const L = G.lesson && S().kind === 'lesson' ? G.lesson : null;
    if (!L) {
      const done = LS.filter(l => G.stats.lessons[l.id]).length;
      el.innerHTML = `<p class="muted">${done} of ${LS.length} opened. Each lesson sets up the board and steps through a line move by move.</p><div class="lessonlist">` +
        LS.map((l, i) => `<button type="button" class="lessonrow" data-lesson="${esc(l.id)}"><span class="num">${i + 1}</span><span><b>${esc(l.title)}</b><small>${esc(l.summary || '')}</small></span>${G.stats.lessons[l.id] ? '<span class="tick" aria-label="opened">✓</span>' : ''}</button>`).join('') + '</div>';
      return;
    }
    const step = G.lessonStep, n = L.moves.length;
    let k = step - 1;
    if (L.notes && k > 0 && !L.notes[String(k)] && L.notes[String(k - 1)]) k--;
    const note = step > 0 && L.notes ? L.notes[String(k)] : null;
    const lastH = S().history[k];
    el.innerHTML = `<button type="button" class="linkbtn" id="lessonBack">← All lessons</button>
      <h2>${esc(L.title)}</h2>
      ${(L.body || []).map(p => `<p>${esc(p)}</p>`).join('')}
      <div class="stepper">
        <button class="btn" type="button" data-step="0" aria-label="First position">⏮</button>
        <button class="btn" type="button" data-step="${step - 1}" aria-label="Previous move">◀ Back</button>
        <span class="stepcount">${step} / ${n}</span>
        <button class="btn primary" type="button" data-step="${step + 1}" aria-label="Next move">Next ▶</button>
        <button class="btn" type="button" data-step="${n}" aria-label="Last position">⏭</button>
      </div>
      <div class="lessonnote">${step === 0 ? 'Starting position. Press Next to play through the line.' : `<b>${lastH ? (lastH.by ? '△' : '▲') + esc(lastH.nt.w) : ''}</b> ${note ? esc(note) : ''}`}</div>
      ${L.key ? `<p class="keyline"><b>Key idea:</b> ${esc(L.key)}</p>` : ''}
      <div class="row-actions"><button class="btn" type="button" id="lessonPlay">Play on from here vs computer</button><button class="btn" type="button" id="lessonAsk">Ask the Tutor about this</button></div>`;
  }

  /* ---------- tutor ---------- */
  const TUTOR_RULES = 'You are a warm, sharp shogi coach inside a learning app called Shogi Dojo. The learner is a beginner-to-intermediate player. Explain in plain English, using Western notation like P-7f, S-4h, B*5e (* means drop, x capture, + promote; files 9→1 left to right from Sente\'s side, ranks a→i top to bottom). Ground every claim in the position and engine data you are given; never invent moves that aren\'t legal there. Keep answers under 170 words unless asked for more, use short paragraphs or a short list, and end with one concrete thing to practise.';
  function positionContext() {
    const x = S(), s = x.s;
    const legal = legalMoves(s);
    const ranked = x.over ? [] : analyze(s, 2).slice(0, 5);
    const mine = x.human.length === 1 ? (x.human[0] ? 'Gote (△, lowercase)' : 'Sente (▲, uppercase)') : 'both sides';
    return `Mode: ${S().kind}${x.kind === 'lesson' && G.lesson ? ` (lesson: ${G.lesson.title})` : ''}${x.kind === 'puzzle' ? ` (mate-in-${x.puzzle.mate} puzzle; don't reveal the answer unless asked directly)` : ''}
The learner plays: ${mine}. Side to move: ${s.turn ? 'Gote (△)' : 'Sente (▲)'}${inCheck(s, s.turn) ? ', in check' : ''}.${x.over ? ` Game over: ${x.over.reason}` : ''}
SFEN: ${toSfen(s)}
${boardText(s)}
Moves so far: ${x.history.map((h, i) => `${i + 1}.${h.by ? '△' : '▲'}${h.nt.w}`).join(' ') || '(none)'}
Engine's top moves for the side to move (score in pawns, side-to-move view): ${ranked.map(r => `${notation(s, r.m, legal).w} ${fmtScore(r.v)}`).join(', ') || 'n/a'}`;
  }
  async function askTutor(question, extra) {
    if (G.tutorBusy) return;
    const out = $('tutorLog');
    G.tutorTurns.push({ role: 'user', content: question, show: question });
    const ctx = positionContext() + (extra ? '\n\n' + extra : '');
    renderTutor();
    if (!G.sample) {
      G.tutorTurns.push({ role: 'assistant', content: offlineAnswer(question), offline: true });
      renderTutor();
      return;
    }
    G.tutorBusy = true; G.tutorCtl = new AbortController();
    const bubble = { role: 'assistant', content: 'Thinking…', pending: true };
    G.tutorTurns.push(bubble);
    renderTutor();
    const convo = G.tutorTurns.filter(t => !t.pending && !t.offline).slice(-8).map(t => ({ role: t.role, content: t.content }));
    convo[convo.length - 1] = { role: 'user', content: `Current position:\n${ctx}\n\nLearner asks: ${question}` };
    try {
      const { text } = await G.sample([{ role: 'user', content: TUTOR_RULES }, ...convo], {
        cache: false, signal: G.tutorCtl.signal,
        onText: ({ text }) => { bubble.content = text; renderTutorBubble(bubble); },
      });
      bubble.content = text;
    } catch (e) {
      bubble.content = (e && e.text) || '';
      if (!e || e.code !== 'cancelled') bubble.content += (bubble.content ? '\n\n' : '') + tutorError(e && e.code);
      if (e && e.code === 'not_granted') { G.sample = null; renderTutor(); }
    } finally {
      bubble.pending = false; G.tutorBusy = false; G.tutorCtl = null;
      renderTutor();
    }
    out.scrollTop = out.scrollHeight;
  }
  function tutorError(code) {
    return ({ not_granted: 'The tutor needs permission to ask Claude. You can allow it from this page\'s permissions.', rate_limited: 'The tutor is getting a lot of questions. Wait a minute and ask again.', prompt_too_large: 'That was too much to send at once. Ask about a shorter stretch of the game.' })[code] || 'The tutor couldn\'t answer just now. Try again in a moment.';
  }
  function offlineAnswer(q) {
    const x = S();
    if (x.over) return 'The game is over. The engine review below the buttons still works without Claude.';
    const ranked = analyze(x.s, 2).slice(0, 3), legal = legalMoves(x.s);
    return `Claude isn't available on this view, so here is the engine's read instead. Best moves for the side to move: ${ranked.map(r => `${notation(x.s, r.m, legal).w} (${fmtScore(r.v)})`).join(', ')}.`;
  }
  function renderTutorBubble(b) {
    const el = document.querySelector(`[data-bubble="${G.tutorTurns.indexOf(b)}"]`);
    if (el) el.textContent = b.content;
    const out = $('tutorLog'); out.scrollTop = out.scrollHeight;
  }
  function renderTutor() {
    $('tutorNoClaude').hidden = !!G.sample;
    const out = $('tutorLog');
    out.innerHTML = G.tutorTurns.length ? G.tutorTurns.map((t, i) => `<div class="bubble ${t.role}${t.pending ? ' pending' : ''}" data-bubble="${i}"></div>`).join('') : '<p class="muted">Ask anything: why a move is good, what your opponent is threatening, how a castle works. The tutor sees the current board.</p>';
    G.tutorTurns.forEach((t, i) => { const el = out.querySelector(`[data-bubble="${i}"]`); if (el) el.textContent = t.show || t.content; });
    out.scrollTop = out.scrollHeight;
    $('tutorStop').hidden = !G.tutorBusy;
    $('tutorAsk').disabled = G.tutorBusy;
  }
  // Engine review: how much each of the learner's moves lost versus the engine's best.
  async function reviewGame() {
    const x = S();
    if (!x.history.length) { askTutor('We haven\'t played any moves yet. What should I focus on in the opening?'); return; }
    const sides = x.human.length ? x.human : [0, 1];
    const replay = parseSfen(x.start);
    const rows = [];
    $('reviewOut').innerHTML = '<p class="muted">Checking every move with the engine…</p>';
    for (let i = 0; i < x.history.length; i++) {
      const h = x.history[i];
      const legal = legalMoves(replay);
      if (sides.includes(replay.turn) && legal.length > 1) {
        const ranked = analyze(replay, 2);
        const best = ranked[0];
        const played = ranked.find(r => toUsi(r.m) === h.usi);
        if (best && played) rows.push({ i, side: replay.turn, played: h.nt.w, best: notation(replay, best.m, legal).w, loss: best.v - played.v, bestV: best.v, playedV: played.v });
      }
      const m = fromUsi(replay, h.usi, legal); if (!m) break;
      apply(replay, m);
      if (i % 4 === 3) await new Promise(r => setTimeout(r, 0));
    }
    const worst = rows.filter(r => r.loss > 120).sort((a, b) => b.loss - a.loss).slice(0, 5).sort((a, b) => a.i - b.i);
    const accuracy = rows.length ? Math.round(100 * rows.filter(r => r.loss <= 60).length / rows.length) : 100;
    $('reviewOut').innerHTML = `<div class="reviewhead"><b>${accuracy}%</b> of your moves were within half a pawn of the engine's choice (${rows.length} moves checked).</div>` +
      (worst.length ? `<table class="review"><thead><tr><th>Move</th><th>You played</th><th>Engine liked</th><th>Cost</th></tr></thead><tbody>${worst.map(r => `<tr><td>${r.i + 1}</td><td class="mono">${esc(r.played)}</td><td class="mono">${esc(r.best)}</td><td>${(r.loss / 100).toFixed(1)}</td></tr>`).join('')}</tbody></table>` : '<p>No big mistakes found. Nice.</p>');
    const summary = worst.map(r => `move ${r.i + 1}: played ${r.played}, engine preferred ${r.best}, cost about ${(r.loss / 100).toFixed(1)} pawns`).join('; ');
    askTutor('Review my game. What were the turning points, and what 3 habits should I work on?', `Engine review of the learner's moves (${rows.length} checked, ${accuracy}% close to engine): ${summary || 'no move lost more than ~1 pawn'}.`);
  }

  /* ---------- online play ---------- */
  function displayName(id) {
    if (id === 'claude') return 'Claude';
    if (G.me && id === G.me) return 'You';
    return G.names[id] || 'Player';
  }
  async function refreshNames(ids) {
    if (!G.user) return;
    const want = [...new Set(ids.filter(id => id && id !== 'claude'))];
    if (!want.length) return;
    const ps = await G.user.profiles(want);
    let changed = false;
    for (const id of want) { const n = ps[id] && ps[id].name || ''; if (n && G.names[id] !== n) { G.names[id] = n; changed = true; } }
    if (changed) { renderLobby(); render(); }
  }
  function startLobby() {
    if (!G.db) return;
    G.db.collection('games').orderBy('updatedAt', 'desc').limit(60).onSnapshot(snap => {
      G.lobby = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      refreshNames(G.lobby.flatMap(g => [g.sente, g.gote, g.createdBy]));
      renderLobby();
    }, e => { $('lobbyMsg').textContent = 'The game list stopped updating. Reload the page to reconnect.'; });
  }
  function renderLobby() {
    const el = $('lobbyLists');
    if (!el) return;
    $('onlineOff').hidden = !!G.db;
    $('onlineOn').hidden = !G.db;
    if (!G.db) return;
    const me = G.me;
    const mine = G.lobby.filter(g => me && (g.sente === me || g.gote === me) && g.status !== 'over');
    const open = G.lobby.filter(g => g.status === 'waiting' && !(me && (g.sente === me || g.gote === me)));
    const live = G.lobby.filter(g => g.status === 'playing' && !(me && (g.sente === me || g.gote === me)));
    const done = G.lobby.filter(g => g.status === 'over').slice(0, 8);
    const row = (g, action) => {
      const moves = (g.moves || []).length;
      const vs = `${esc(g.sente ? displayName(g.sente) : 'Open seat')} <span class="muted">vs</span> ${esc(g.gote ? displayName(g.gote) : 'Open seat')}`;
      const st = g.status === 'over' ? (g.result && g.result.winner !== null && g.result.winner !== undefined ? `${g.result.winner ? '△' : '▲'} won` : 'Draw') : (g.status === 'waiting' ? 'Waiting for a player' : `${moves} moves · ${moves % 2 ? '△' : '▲'} to move`);
      return `<div class="grow"><div><b>${esc(g.title || 'Shogi game')}</b><small>${vs}</small><small class="muted">${st}</small></div><button class="btn ${action === 'Join' ? 'primary' : ''}" type="button" data-game="${esc(g.id)}" data-act="${action}">${action}</button></div>`;
    };
    el.innerHTML =
      `<h3>Your games</h3>${mine.length ? mine.map(g => row(g, 'Open')).join('') : '<p class="muted">You aren\'t in a game yet. Create one above or join an open seat.</p>'}` +
      `<h3>Open seats</h3>${open.length ? open.map(g => row(g, 'Join')).join('') : '<p class="muted">No one is waiting right now. Create a game and share this page with a friend.</p>'}` +
      (live.length ? `<h3>Being played now</h3>${live.map(g => row(g, 'Watch')).join('')}` : '') +
      (done.length ? `<h3>Finished</h3>${done.map(g => row(g, 'Replay')).join('')}` : '');
    $('createGame').disabled = G.canWrite === false;
    $('lobbyMsg').textContent = G.canWrite === false ? 'You can watch games, but your access to this page doesn\'t allow joining or creating them. Ask the owner for Contributor access.' : '';
  }
  async function createGame() {
    if (!G.db || !G.me) { $('lobbyMsg').textContent = 'Sign in to claude.ai to play online.'; return; }
    const side = $('newSide').value, opp = $('newOpp').value;
    const mySide = side === 'random' ? (Math.random() < .5 ? 'sente' : 'gote') : side;
    const other = mySide === 'sente' ? 'gote' : 'sente';
    const now = Date.now();
    const doc = {
      title: ($('newTitle').value || '').trim().slice(0, 60) || 'Friendly game',
      sente: null, gote: null, moves: [], status: 'waiting', result: null,
      createdBy: G.me, createdAt: now, updatedAt: now,
    };
    doc[mySide] = G.me;
    if (opp === 'claude') { doc[other] = 'claude'; doc.status = 'playing'; }
    try {
      $('createGame').disabled = true;
      const ref = await G.db.collection('games').add(doc);
      $('newTitle').value = '';
      openOnline(ref.id);
    } catch (e) {
      $('lobbyMsg').textContent = e && e.code === 'quota_exceeded' ? 'This page has stored as many games as it can. Ask the owner to clear old ones.' : (e && e.code === 'invalid_argument' ? 'Your access to this page doesn\'t allow creating games.' : 'Couldn\'t create the game. Try again.');
      if (e && e.code === 'invalid_argument') G.canWrite = false;
    } finally { $('createGame').disabled = false; }
  }
  async function joinGame(id) {
    const ref = G.db.doc('games/' + id);
    try {
      const lease = await ref.acquire({ holder: TAB_ID, ttlMs: 5000 });
      if (!lease.acquired) { $('lobbyMsg').textContent = 'Someone else is joining that game right now.'; return; }
      const snap = await ref.get();
      const g = snap.exists ? snap.data() : null;
      if (!g || g.status !== 'waiting') { $('lobbyMsg').textContent = 'That seat was just taken.'; return; }
      const seat = g.sente ? 'gote' : 'sente';
      await ref.update({ [seat]: G.me, status: 'playing', updatedAt: Date.now() });
      openOnline(id);
    } catch (e) {
      $('lobbyMsg').textContent = 'Couldn\'t join that game.';
    }
  }
  function leaveOnline() {
    if (G.onlineUnsub) { G.onlineUnsub(); G.onlineUnsub = null; }
    G.onlineDoc = null;
  }
  function openOnline(id) {
    enterSide(); leaveOnline();
    G.sess = newSession('online', { gameId: id, human: [] });
    G.coach = null; clearSel();
    render();
    G.onlineUnsub = G.db.doc('games/' + id).onSnapshot(snap => {
      if (!snap.exists) { setCoach(null, 'This game was deleted.'); render(); return; }
      const g = snap.data();
      G.onlineDoc = g;
      const x = S(); if (!x || x.gameId !== id) return;
      x.human = [g.sente === G.me ? 0 : -1, g.gote === G.me ? 1 : -1].filter(v => v >= 0);
      x.flip = x.human.length === 1 && x.human[0] === 1;
      const mine = x.history.map(h => h.usi), theirs = g.moves || [];
      const same = mine.length === theirs.length && mine.every((u, i) => u === theirs[i]);
      if (!same) {
        if (theirs.length === mine.length + 1 && mine.every((u, i) => u === theirs[i])) {
          const m = fromUsi(x.s, theirs[theirs.length - 1]);
          if (m) play(m, { remote: true, say: (g.says || {})[theirs.length - 1] || null });
        } else { rebuild(x, theirs); clearSel(); }
      }
      if (g.status === 'over' && g.result && !x.over) x.over = { winner: g.result.winner ?? null, reason: g.result.reason || 'Game over.' };
      if (x.over && x.human.length) recordResult(x);
      if (!x.human.length) setCoach(null, g.status === 'waiting' ? 'You\'re watching. This game is waiting for a second player.' : 'You\'re watching this game live. Moves appear as they are played.');
      else if (g.status === 'waiting') setCoach(null, '<b>Waiting for an opponent.</b> Share this page with a friend; the game shows up under Open seats for them.');
      else if (!x.history.length && x.human.length) setCoach(null, `<b>You play ${x.human[0] ? 'Gote (△)' : 'Sente (▲)'}.</b> ${x.human[0] ? 'Your pieces are at the bottom; the board is turned for you.' : 'You move first.'}`);
      render();
      maybeClaudeOnline(g);
    }, () => { setCoach(null, 'Lost the live connection to this game. Reload to reconnect.'); render(); });
    showTab('online');
  }
  function pushOnline(x) {
    const id = x.gameId, moves = x.history.map(h => h.usi);
    const lastSay = x.history[x.history.length - 1].say;
    const upd = { moves, updatedAt: Date.now() };
    if (lastSay) upd.says = { [moves.length - 1]: lastSay };
    if (x.over) { upd.status = 'over'; upd.result = { winner: x.over.winner, reason: x.over.reason }; }
    G.writing = G.writing.then(() => G.db.doc('games/' + id).update(upd)).catch(e => {
      setCoach(null, 'That move didn\'t reach the server. Reload the page to resync.'); render();
    });
  }
  async function resign() {
    const x = S(); if (x.kind !== 'online' || x.over || !x.human.length) return;
    const winner = x.human[0] ^ 1;
    x.over = { winner, reason: 'Resigned.' };
    recordResult(x);
    G.writing = G.writing.then(() => G.db.doc('games/' + x.gameId).update({ status: 'over', result: { winner, reason: 'Resigned.' }, updatedAt: Date.now() })).catch(() => {});
    render();
  }
  let claudeOnlineBusy = false;
  async function maybeClaudeOnline(g) {
    const x = S();
    if (!x || x.kind !== 'online' || x.over || g.status !== 'playing' || claudeOnlineBusy) return;
    const seat = x.s.turn ? g.gote : g.sente;
    if (seat !== 'claude' || !x.human.length) return;
    if (!G.sample) { setCoach(null, 'It\'s Claude\'s turn. Claude moves when the tutor permission is allowed on this page, or ask Claude Code in your chat to make its move in this game.'); render(); return; }
    claudeOnlineBusy = true;
    try {
      const ref = G.db.doc('games/' + x.gameId);
      const lease = await ref.acquire({ holder: TAB_ID, ttlMs: 90000 });
      if (!lease.acquired) return;
      G.thinking = true; render();
      const before = x.history.length;
      const { pick, say } = await claudeChooseMove(x);
      G.thinking = false;
      if (S() === x && x.history.length === before && pick) play(pick, { say });
      else render();
    } catch (e) { G.thinking = false; render(); }
    finally { claudeOnlineBusy = false; }
  }
  function renderOnlineBits() {
    const x = S();
    $('onlineGameBar').hidden = x.kind !== 'online';
    if (x.kind === 'online' && G.onlineDoc) $('onlineGameTitle').textContent = G.onlineDoc.title || 'Online game';
  }

  /* ---------- persistence ---------- */
  function serial() {
    const keep = G.saved || (S().kind !== 'puzzle' && S().kind !== 'lesson' && S().kind !== 'online' ? S() : null);
    return {
      v: 2, labels: G.labels, showEval: G.showEval, seenStats: true,
      game: keep ? { kind: keep.kind, start: keep.start, level: keep.level, human: keep.human, moves: keep.history.map(h => h.usi) } : null,
    };
  }
  function save() { try { localStorage.setItem('shogi-dojo-2', JSON.stringify(serial())); } catch (e) {} }
  function restore(data) {
    if (!data || data.v !== 2) return false;
    G.labels = data.labels !== false; G.showEval = !!data.showEval;
    if (!data.game) return false;
    const g = data.game;
    const kind = ['ai', 'claude', 'pvp'].includes(g.kind) ? g.kind : 'ai';
    G.sess = newSession(kind, { start: g.start, level: g.level, human: Array.isArray(g.human) ? g.human : [0] });
    rebuild(G.sess, Array.isArray(g.moves) ? g.moves : []);
    G.sess.overShown = !!G.sess.over;
    return true;
  }
  async function loadStats() {
    try { const raw = JSON.parse(localStorage.getItem('shogi-dojo-stats') || 'null'); if (raw) Object.assign(G.stats, raw); } catch (e) {}
    if (G.db && G.me) {
      try {
        const snap = await G.db.collection('data/users/' + G.me).doc('stats').get();
        if (snap.exists) {
          const d = snap.data();
          for (const k of ['wins', 'losses', 'draws', 'puzzles', 'lessons', 'online']) G.stats[k] = { ...(d[k] || {}), ...G.stats[k] };
        }
      } catch (e) {}
    }
    renderProgress();
  }
  let statsTimer = null;
  function saveStats() {
    try { localStorage.setItem('shogi-dojo-stats', JSON.stringify(G.stats)); } catch (e) {}
    renderProgress();
    if (!G.db || !G.me) return;
    clearTimeout(statsTimer);
    statsTimer = setTimeout(() => { G.db.collection('data/users/' + G.me).doc('stats').set(JSON.parse(JSON.stringify(G.stats))).catch(() => {}); }, 800);
  }
  function renderProgress() {
    const st = G.stats;
    const labels = [...new Set([...Object.keys(st.wins), ...Object.keys(st.losses), ...Object.keys(st.draws)])];
    const el = $('progress');
    const pz = Object.keys(st.puzzles).length, ls = Object.keys(st.lessons).length;
    el.innerHTML = `<div class="stats"><div><b>${pz}</b><small>puzzles solved</small></div><div><b>${ls}</b><small>lessons opened</small></div><div><b>${labels.reduce((a, l) => a + (st.wins[l] || 0), 0)}</b><small>games won</small></div></div>` +
      (labels.length ? `<table class="review"><thead><tr><th>Opponent</th><th>Won</th><th>Lost</th><th>Drawn</th></tr></thead><tbody>${labels.map(l => `<tr><td>${esc(l)}</td><td>${st.wins[l] || 0}</td><td>${st.losses[l] || 0}</td><td>${st.draws[l] || 0}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Finish a game against the computer or Claude and your record shows up here.</p>');
  }

  /* ---------- wiring ---------- */
  $('level').innerHTML = LEVELS.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
  $('level').value = ML.length ? 'ml:' + ML[Math.min(1, ML.length - 1)].id : 'classic:2';
  $('levelList').innerHTML = LEVELS.map(l => `<li><b>${esc(l.name)}</b> <span class="muted">${esc(l.detail)}</span></li>`).join('');
  $('grid').addEventListener('click', e => { const b = e.target.closest('.sq'); if (b) onSquare(+b.dataset.r, +b.dataset.c); });
  for (const id of ['handTop', 'handBot']) $(id).addEventListener('click', e => { const b = e.target.closest('.hp'); if (b) onHand(+b.dataset.side, b.dataset.t); });
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });
  document.addEventListener('click', e => {
    const pc = e.target.closest('.pcard'); if (pc) { showGuide(pc.dataset.key); showTab('pieces'); return; }
    const pz = e.target.closest('[data-pz]'); if (pz) { const p = PZ.find(q => q.id === pz.dataset.pz); if (p) startPuzzle(p); return; }
    const lr = e.target.closest('[data-lesson]'); if (lr) { openLesson(lr.dataset.lesson); return; }
    const st = e.target.closest('[data-step]'); if (st) { lessonGo(+st.dataset.step); return; }
    if (e.target.closest('#lessonBack')) { G.lesson = null; renderLessons(); if (G.saved) returnToGame(); return; }
    if (e.target.closest('#lessonPlay')) { const sf = toSfen(S().s); G.saved = null; startGame('ai', { start: sf, level: $('level').value, human: [S().s.turn] }); setCoach(null, 'Playing on from the lesson position against the computer. You have the side to move.'); render(); return; }
    if (e.target.closest('#lessonAsk')) { showTab('tutor'); askTutor(`Explain the idea of this lesson ("${G.lesson.title}") in the current position, and what I should look for next.`); return; }
    const gm = e.target.closest('[data-game]'); if (gm) { const act = gm.dataset.act; if (act === 'Join') joinGame(gm.dataset.game); else openOnline(gm.dataset.game); return; }
  });
  function returnToGame() {
    if (!G.saved) return;
    leaveOnline();
    G.sess = G.saved; G.saved = null; G.lesson = null; clearSel(); G.hint = null;
    setCoach(null, 'Back to your game.');
    render(); renderLessons(); renderPuzzles();
    if (S().kind === 'ai') maybeEngine();
  }
  $('newBtn').onclick = newGameFromControls;
  $('undoBtn').onclick = undoMove;
  $('hintBtn').onclick = hint;
  $('returnBtn').onclick = returnToGame;
  $('resignBtn').onclick = resign;
  $('endNew').onclick = () => { $('endDlg').hidden = true; if (S().kind === 'online') showTab('online'); else newGameFromControls(); };
  $('endUndo').onclick = undoMove;
  $('endReview').onclick = () => { $('endDlg').hidden = true; showTab('tutor'); reviewGame(); };
  $('endClose').onclick = () => { $('endDlg').hidden = true; };
  $('mode').onchange = e => { $('level').disabled = e.target.value !== 'ai'; if (e.target.value === 'online') showTab('online'); };
  $('labels').onchange = e => { G.labels = e.target.checked; save(); render(); };
  $('showEval').onchange = e => { G.showEval = e.target.checked; save(); render(); };
  $('tutorForm').addEventListener('submit', e => { e.preventDefault(); const q = $('tutorInput').value.trim(); if (!q) return; $('tutorInput').value = ''; askTutor(q); });
  $('tutorStop').onclick = () => G.tutorCtl && G.tutorCtl.abort();
  $('tExplain').onclick = () => askTutor('Explain this position: who is better, what each side is threatening, and what the plans are.');
  $('tMove').onclick = () => askTutor('What should the side to move play here, and why? Compare the top two candidates.');
  $('tReview').onclick = reviewGame;
  $('tClear').onclick = () => { G.tutorTurns = []; $('reviewOut').innerHTML = ''; renderTutor(); };
  $('createGame').onclick = createGame;
  $('puzzleRetry').onclick = () => { if (S().kind === 'puzzle') startPuzzle(S().puzzle); };
  $('puzzleNext').onclick = () => { const cur = S().kind === 'puzzle' ? S().puzzle : null; const i = cur ? PZ.indexOf(cur) : -1; const nxt = PZ.slice(i + 1).find(p => !G.stats.puzzles[p.id]) || PZ[(i + 1) % PZ.length]; if (nxt) startPuzzle(nxt); };
  $('puzzleShow').onclick = () => { const x = S(); if (x.kind !== 'puzzle') return; const p = x.puzzle; setCoach(null, `<b>Solution:</b> ${p.line.map(u => `<span class="nt">${esc(u)}</span>`).join(' ')} (USI). ${esc(p.explain || '')}`); render(); };
  $('allPieces').innerHTML = allPiecesHTML();
  document.addEventListener('keydown', e => { if (e.key === 'Escape') $('promoDlg').hidden = true; });

  async function initCapabilities() {
    const use = window.claude && window.claude.use ? n => window.claude.use(n).catch(() => null) : async () => null;
    const [db, user, sample] = await Promise.all([use('db'), use('user'), use('sample')]);
    G.user = user; G.sample = sample;
    if (user) {
      try { G.me = await user.id(); } catch (e) { G.me = null; }
      try { G.canWrite = await user.can('data.write'); } catch (e) { G.canWrite = null; }
    }
    G.db = db && G.me ? db : null;
    renderTutor(); renderLobby();
    if (G.db) startLobby();
    loadStats();
  }

  function start(data) {
    let ok = false;
    try { ok = restore(data && data.v ? data : JSON.parse(localStorage.getItem('shogi-dojo-2') || 'null')); } catch (e) { ok = false; }
    if (!ok) {
      G.sess = newSession('ai', { level: $('level').value });
      setCoach(null, '<b>Welcome to the dojo.</b> You play Sente (▲) at the bottom against a machine-learned computer. Tap any piece to see where it can go. New to shogi? Open the Lessons tab, or ask the Tutor anything.');
    } else setCoach(null, S().history.length ? 'Welcome back. Your game is right where you left it.' : 'Your move. Tap a piece to see where it can go.');
    $('mode').value = S().kind; $('level').value = S().level; $('labels').checked = G.labels; $('showEval').checked = G.showEval;
    let tab = 'tutor';
    try { tab = localStorage.getItem('shogi-dojo-tab') || 'tutor'; } catch (e) {}
    showGuide('P');
    showTab(['tutor', 'online', 'puzzles', 'lessons', 'pieces', 'rules', 'moves'].includes(tab) ? tab : 'tutor');
    renderTutor(); renderProgress();
    render();
    maybeEngine();
    initCapabilities();
  }
  window.claude?.hot?.snapshot?.(() => serial());
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
