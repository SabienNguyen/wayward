/* ================= APP ================= */
(function () {
  // U+FE0E asks for the plain text glyph, so no font swaps in a colour emoji (which ignores CSS colour).
  const GLYPH = { K: '♚\uFE0E', Q: '♛\uFE0E', R: '♜\uFE0E', B: '♝\uFE0E', N: '♞\uFE0E', P: '♟\uFE0E' };
  const NAME = { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' };
  const INFO = {
    K: ['King', 'Moves one square in any direction. It can never move into check. Once per game it can castle with a rook. Lose it and you lose the game.'],
    Q: ['Queen', 'Slides any distance in a straight line or diagonal. The most powerful piece, worth about nine pawns. Don\'t bring it out too early, or it gets chased around.'],
    R: ['Rook', 'Slides any distance along a rank or file. Worth about five pawns. Rooks love open files and the 7th rank.'],
    B: ['Bishop', 'Slides any distance diagonally, so it stays on one colour all game. Worth about three pawns; the pair of bishops is extra strong in open positions.'],
    N: ['Knight', 'Jumps in an L: two squares one way, one square sideways. It leaps over pieces, which makes it the king of forks. Worth about three pawns.'],
    P: ['Pawn', 'Moves straight forward one square, or two from its starting square, but captures one square diagonally forward. Reach the last rank and it promotes, usually to a queen.'],
  };
  const $ = id => document.getElementById(id);
  const esc = t => String(t).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const TAB_ID = Math.random().toString(36).slice(2);
  const fmtScore = v => Math.abs(v) > MATE / 2 ? (v > 0 ? 'forced mate' : 'getting mated') : (v >= 0 ? '+' : '−') + (Math.abs(v) / 100).toFixed(1);
  const colorName = side => side ? 'Black' : 'White';

  function boardText(s) {
    let t = '   a b c d e f g h\n';
    for (let r = 0; r < 8; r++) {
      t += (8 - r) + '  ' + s.b[r].map(p => p ? (p.o ? p.t.toLowerCase() : p.t) : '.').join(' ') + '\n';
    }
    return t + '(uppercase = White, lowercase = Black)\n';
  }

  /* ---------- engine levels ---------- */
  const LEVELS = [
    { id: 'l1', name: 'Beginner', detail: 'Looks one move ahead and often picks a random decent move', depth: 1, noise: 250 },
    { id: 'l2', name: 'Casual', detail: 'Looks two moves ahead, small mistakes', depth: 2, noise: 60 },
    { id: 'l3', name: 'Club', detail: 'Looks three moves ahead', depth: 3, noise: 15 },
    { id: 'b1', name: 'Expert', detail: 'Strong engine, thinks for about half a second', brainMs: 500 },
    { id: 'b2', name: 'Master', detail: 'Strong engine, thinks for about two seconds', brainMs: 2000 },
    { id: 'b3', name: 'Grandmaster', detail: 'Strongest setting, thinks for about five seconds', brainMs: 5000 },
  ];
  // The strong engine (Brain) runs in a Web Worker so the board stays responsive.
  let brainWorker = null, brainSeq = 0;
  const brainWaiting = new Map();
  function getBrainWorker() {
    if (brainWorker !== null) return brainWorker;
    try {
      const src = document.getElementById('brainSrc').textContent;
      brainWorker = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' })));
      brainWorker.onmessage = e => { const cb = brainWaiting.get(e.data.id); if (cb) { brainWaiting.delete(e.data.id); cb(e.data.res); } };
      brainWorker.onerror = () => { brainWorker = false; for (const cb of brainWaiting.values()) cb(null); brainWaiting.clear(); };
    } catch (e) { brainWorker = false; }
    return brainWorker;
  }
  // Hashes of every earlier position in the game, so Brain can see repetitions.
  function gameHashes(x) {
    const s = x.start === 'startpos' ? initialState() : parseFen(x.start), out = [];
    for (const h of x.history) { out.push(Brain.hashOf(toFen(s))); apply(s, fromUci(s, h.uci)); }
    return out;
  }
  function brainThink(x, timeMs) {
    const fen = toFen(x.s), opts = { timeMs, history: gameHashes(x) };
    const w = getBrainWorker();
    if (!w) return Promise.resolve(Brain.think(fen, { ...opts, timeMs: Math.min(timeMs, 800) }));
    return new Promise(res => { const id = ++brainSeq; brainWaiting.set(id, res); w.postMessage({ id, fen, opts }); })
      .then(r => r && !r.error ? r : Brain.think(fen, { ...opts, timeMs: Math.min(timeMs, 800) }));
  }
  const levelById = id => LEVELS.find(l => l.id === id) || LEVELS[1];
  function analyze(s, depth = 3) {
    const out = [];
    for (const m of legalMoves(s)) {
      apply(s, m);
      const v = -search(s, depth - 1, -MATE * 2, MATE * 2, 1);
      undo(s, m);
      out.push({ m, v });
    }
    out.sort((a, b) => b.v - a.v);
    return out;
  }

  /* ---------- state ---------- */
  const G = {
    sess: null, saved: null, showEval: false,
    sel: null, targets: [], threats: [], hint: null, thinking: false,
    seen: {}, coach: null,
    db: null, user: null, sample: null, me: null, canWrite: null,
    lobby: [], names: {}, onlineUnsub: null, onlineDoc: null, writing: Promise.resolve(),
    stats: { wins: {}, losses: {}, draws: {}, puzzles: {}, lessons: {}, online: {} },
    tutorTurns: [], tutorCtl: null, tutorBusy: false,
    lesson: null, lessonStep: 0,
  };
  function newSession(kind, opts = {}) {
    const start = opts.start || 'startpos';
    const s = start === 'startpos' ? initialState() : parseFen(start);
    return {
      kind, start, s, history: [], keys: [positionKey(s)], over: null, overShown: false,
      human: opts.human || [0], flip: !!opts.flip, level: opts.level || 'l2',
      gameId: opts.gameId || null, puzzle: opts.puzzle || null,
    };
  }
  const S = () => G.sess;
  const humanTurn = () => { const x = S(); return !x.over && !G.thinking && x.human.includes(x.s.turn); };
  const clearSel = () => { G.sel = null; G.targets = []; G.threats = []; };

  /* ---------- core move flow ---------- */
  function play(m, opts = {}) {
    const x = S(), s = x.s, mover = s.turn;
    const legal = opts.legal || legalMoves(s);
    const san = toSan(s, m, legal);
    const uci = toUci(m);
    const captured = m.cap;
    apply(s, m);
    x.history.push({ m, san, uci, say: opts.say || null, by: mover });
    x.keys.push(positionKey(s));
    clearSel(); G.hint = null;
    checkEnd(x);
    if (opts.silent) return;
    if (x.kind !== 'puzzle' && x.kind !== 'lesson') coachAfter(m, mover, captured);
    if (x.over && x.kind !== 'online') recordResult(x);
    afterMove(x, m, opts);
    save(); render();
  }
  function checkEnd(x) {
    const s = x.s, key = x.keys[x.keys.length - 1];
    if (!legalMoves(s).length) {
      x.over = inCheck(s, s.turn) ? { winner: s.turn ^ 1, reason: 'Checkmate.' } : { winner: null, reason: 'Stalemate: the side to move has no legal move but isn\'t in check, so it\'s a draw.' };
    } else if (x.keys.filter(k => k === key).length >= 3) x.over = { winner: null, reason: 'Threefold repetition. The game is a draw.' };
    else if (s.half >= 100) x.over = { winner: null, reason: 'Fifty-move rule: 50 moves each with no capture or pawn move. Draw.' };
    else if (insufficientMaterial(s)) x.over = { winner: null, reason: 'Neither side has enough material left to checkmate. Draw.' };
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
    const x = S(), s = x.s;
    const humanMoved = x.human.includes(mover);
    if (x.over) return;
    if (inCheck(s, s.turn) && x.human.includes(s.turn)) {
      setCoach('check', '<b>Check!</b> Your king is attacked. You must get out of check: move the king, capture the attacker, or put a piece in between. Only legal escapes light up.');
      return;
    }
    if (humanMoved && m.castle) { setCoach('castled', '<b>Castled.</b> Your king is tucked away behind pawns and your rook is heading for the centre. Most strong games castle within the first ten moves.'); return; }
    if (humanMoved && m.ep) { setCoach('ep', '<b>En passant!</b> A pawn that jumps two squares past yours can be captured as if it had moved one. You only get that chance on the very next move.'); return; }
    if (humanMoved && m.promo) { setCoach('promo', `<b>Promotion!</b> Your pawn became a ${NAME[m.promo].toLowerCase()}. Promoting to a queen is usual, but a knight sometimes gives a winning check.`); return; }
    if (humanMoved && captured) { setCoach('cap', `<b>You won a ${NAME[captured.t].toLowerCase()}.</b> The strip above the board tracks captured material. Being ahead lets you trade pieces and simplify toward a win.`); return; }
    if (!humanMoved && captured && x.human.length === 1) { setCoach('lost', `<b>You lost a ${NAME[captured.t].toLowerCase()}.</b> Before each move, ask: what does my opponent's last move attack? Red dots on an enemy piece show what it threatens.`); return; }
    if (x.history.length === 8 && x.human.length === 1) {
      const me = x.human[0], home = me ? 0 : 7;
      const undeveloped = [1, 2, 5, 6].filter(c => { const p = s.b[home][c]; return p && p.o === me && (p.t === 'N' || p.t === 'B'); }).length;
      if (undeveloped >= 2) setCoach('develop', `<b>Tip:</b> you still have ${undeveloped} knights and bishops on their starting squares. In the opening, get every minor piece out before moving any piece twice.`);
    }
  }

  /* ---------- computer opponent ---------- */
  function maybeEngine() {
    const x = S();
    if (x.kind !== 'ai' || x.over || x.human.includes(x.s.turn)) return;
    G.thinking = true; render();
    const L = levelById(x.level), before = x.history.length;
    const done = uci => {
      G.thinking = false;
      if (S() !== x || x.history.length !== before) { render(); return; }
      const m = uci && fromUci(x.s, uci);
      if (m) play(m); else render();
    };
    if (L.brainMs) { brainThink(x, L.brainMs).then(r => done(r && r.uci)); return; }
    setTimeout(() => {
      if (S() !== x) { G.thinking = false; return; }
      const m = bestMove(x.s, L.depth, L.noise);
      done(m && toUci(m));
    }, 60);
  }

  /* ---------- Claude as a player ---------- */
  const CLAUDE_RULES = 'You are Claude, playing a friendly game of chess against a learner. Pick a strong but human-like move. Prefer the engine candidates unless you see a clear reason otherwise, and never play a move that is not in the legal list. Reply with only JSON: {"move":"<one UCI move from the legal list>","say":"<one or two short sentences to your opponent: the idea behind your move, in plain words, without telling them their best reply>"}.';
  async function claudeChooseMove(x) {
    const s = x.s, legal = legalMoves(s);
    const ranked = analyze(s, 3).slice(0, 6);
    const recent = sanList(x).slice(-12).join(' ') || '(game start)';
    const prompt = `${CLAUDE_RULES}

You play ${colorName(s.turn)}.
Position (FEN): ${toFen(s)}
${boardText(s)}
Recent moves: ${recent}
Engine candidates (score for you, in pawns): ${ranked.map(r => `${toUci(r.m)} (${toSan(s, r.m, legal)}, ${fmtScore(r.v)})`).join('; ')}
All legal moves (UCI): ${legal.map(toUci).join(' ')}`;
    let pick = null, say = null;
    try {
      const res = await G.sample.json(prompt, { cache: false });
      if (res && typeof res.move === 'string') pick = fromUci(s, res.move.trim().toLowerCase(), legal);
      if (res && typeof res.say === 'string') say = res.say.slice(0, 400);
    } catch (e) { /* fall through to the engine */ }
    if (!pick && ranked[0]) pick = fromUci(s, toUci(ranked[0].m), legal);
    return { pick, say };
  }
  async function maybeClaudeLocal() {
    const x = S();
    if (x.kind !== 'claude' || x.over || x.human.includes(x.s.turn)) return;
    G.thinking = true; render();
    let pick, say;
    if (G.sample) ({ pick, say } = await claudeChooseMove(x));
    else { const m = bestMove(x.s, 3, 20); pick = m && fromUci(x.s, toUci(m)); say = 'Claude isn\'t reachable from this view, so the built-in engine moved instead.'; }
    G.thinking = false;
    if (S() !== x) return;
    if (pick) play(pick, { say }); else render();
  }
  function sanList(x) {
    const startBlack = x.history.length && x.history[0].by === 1;
    const out = [];
    let n = x.s.full - Math.floor((x.history.length + (startBlack ? 1 : 0)) / 2);
    x.history.forEach((h, i) => {
      if (h.by === 0) out.push(`${n}.${h.san}`);
      else { out.push(i === 0 ? `${n}...${h.san}` : h.san); n++; }
    });
    return out;
  }

  /* ---------- interaction ---------- */
  function selectSquare(r, c) {
    const x = S(), p = x.s.b[r][c];
    G.hint = null;
    showGuide(p.t);
    if (p.o === x.s.turn && humanTurn()) {
      G.sel = { r, c };
      G.targets = legalMoves(x.s).filter(m => m.from[0] === r && m.from[1] === c);
      G.threats = [];
      if (!G.targets.length) setCoach(null, `That ${NAME[p.t].toLowerCase()} has no legal moves right now${inCheck(x.s, x.s.turn) ? ' because your king is in check' : ' (it may be pinned to your king)'}.`);
    } else {
      G.sel = { r, c, inspect: true };
      G.targets = [];
      G.threats = attacksFrom(x.s, r, c);
      if (x.kind !== 'lesson') setCoach('inspect', '<b>Red dots</b> show every square that piece attacks. Check them before you move.');
    }
    render();
  }
  // Squares a piece attacks or can move to, ignoring whose turn it is.
  function attacksFrom(s, r, c) {
    const save = s.turn, p = s.b[r][c];
    s.turn = p.o;
    const ep = s.ep; s.ep = null;
    const out = genMoves(s).filter(m => m.from[0] === r && m.from[1] === c && !m.castle);
    s.turn = save; s.ep = ep;
    return out;
  }
  function onSquare(r, c) {
    if (G.sel && G.targets.length) {
      const cands = G.targets.filter(m => m.to[0] === r && m.to[1] === c);
      if (cands.length === 1) return play(cands[0]);
      if (cands.length > 1) return askPromo(cands);
    }
    const p = S().s.b[r][c];
    if (p) {
      if (G.sel && G.sel.r === r && G.sel.c === c) { clearSel(); render(); return; }
      selectSquare(r, c);
    } else { clearSel(); render(); }
  }
  function askPromo(cands) {
    const side = S().s.turn;
    $('promoChoices').innerHTML = ['Q', 'R', 'B', 'N'].map(t =>
      `<button class="choice" type="button" data-p="${t}"><span class="pc ${side ? 'b' : 'w'}">${GLYPH[t]}</span><span>${NAME[t]}</span></button>`).join('');
    $('promoDlg').hidden = false;
    $('promoChoices').querySelector('button').focus();
    $('promoChoices').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      $('promoDlg').hidden = true;
      const m = cands.find(c => c.promo === b.dataset.p);
      if (m) play(m);
    };
  }
  function rebuild(x, ucis) {
    x.s = x.start === 'startpos' ? initialState() : parseFen(x.start);
    x.history = []; x.keys = [positionKey(x.s)]; x.over = null;
    const prev = G.sess; G.sess = x;
    for (const u of ucis) {
      const legal = legalMoves(x.s);
      const m = fromUci(x.s, u, legal);
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
  async function hint() {
    if (!humanTurn()) return;
    const x = S(), before = x.history.length;
    $('hintBtn').disabled = true;
    const r = await brainThink(x, 700);
    if (S() !== x || x.history.length !== before) return;
    const m = r && fromUci(x.s, r.uci);
    if (!m) { render(); return; }
    G.hint = m; clearSel();
    setCoach(null, `<b>Engine hint:</b> try <span class="nt">${esc(toSan(x.s, m))}</span>. The green outline marks it. Ask the Tutor tab why it works.`);
    render();
  }
  function startGame(kind, opts = {}) {
    leaveOnline();
    const human = opts.human || (kind === 'pvp' ? [0, 1] : [opts.side === 'b' ? 1 : 0]);
    G.sess = newSession(kind, { ...opts, human, flip: human.length === 1 && human[0] === 1 });
    G.thinking = false; clearSel(); G.hint = null;
    $('endDlg').hidden = true;
    G.seen = {};
    const you = human.length === 1 ? colorName(human[0]) : null;
    if (kind === 'ai') setCoach(null, `<b>You play ${you}</b> against <b>${esc(levelById(G.sess.level).name)}</b>. Tap a piece to see where it can go. Good opening habits: control the centre, develop knights and bishops, castle early.`);
    else if (kind === 'claude') setCoach(null, `<b>You're playing Claude</b> as ${you}. Claude picks moves with help from the engine and tells you the idea behind each one.`);
    else if (kind === 'pvp') setCoach(null, '<b>Pass and play.</b> White moves first, then hand the device over.');
    save(); render();
    if (kind === 'ai') maybeEngine();
    if (kind === 'claude') maybeClaudeLocal();
  }
  function newGameFromControls() {
    const mode = $('mode').value;
    if (mode === 'online') { showTab('online'); return; }
    let side = $('side').value;
    if (side === 'r') side = Math.random() < .5 ? 'w' : 'b';
    startGame(mode, { level: $('level').value, side });
  }

  /* ---------- rendering ---------- */
  const pieceHTML = p => `<span class="pc ${p.o ? 'b' : 'w'}">${GLYPH[p.t]}</span>`;
  function playerName(x, side) {
    if (x.kind === 'ai') return x.human.includes(side) ? 'You' : levelById(x.level).name;
    if (x.kind === 'claude') return x.human.includes(side) ? 'You' : 'Claude';
    if (x.kind === 'online') { const id = G.onlineDoc && (side ? G.onlineDoc.black : G.onlineDoc.white); return id ? displayName(id) : 'Open seat'; }
    if (x.kind === 'puzzle') return x.human.includes(side) ? 'You' : 'Defender';
    return colorName(side);
  }
  function material(s) {
    const count = [{}, {}];
    for (const row of s.b) for (const p of row) if (p) count[p.o][p.t] = (count[p.o][p.t] || 0) + 1;
    const full = { Q: 1, R: 2, B: 2, N: 2, P: 8 };
    const lost = [[], []];
    let score = 0;
    for (const side of [0, 1]) for (const t of ['Q', 'R', 'B', 'N', 'P']) {
      const n = count[side][t] || 0;
      for (let i = n; i < full[t]; i++) lost[side].push(t);
      score += (side ? -1 : 1) * n * (VAL[t] / 100);
    }
    return { lost, score: Math.round(score) };
  }
  function render() {
    const x = S(), s = x.s, flip = x.flip;
    const last = x.history.length ? x.history[x.history.length - 1].m : null;
    const kingSq = inCheck(s, s.turn) ? findKing(s, s.turn) : null;
    const tgt = new Set(G.targets.map(m => m.to[0] * 8 + m.to[1]));
    const thr = new Set(G.threats.map(m => m.to[0] * 8 + m.to[1]));
    let html = '';
    for (let dr = 0; dr < 8; dr++) for (let dc = 0; dc < 8; dc++) {
      const r = flip ? 7 - dr : dr, c = flip ? 7 - dc : dc;
      const p = s.b[r][c], i = r * 8 + c, cls = ['sq', (r + c) % 2 ? 'd' : 'l'];
      if (p) cls.push('has-piece');
      if (last && ((last.to[0] === r && last.to[1] === c) || (last.from[0] === r && last.from[1] === c))) cls.push('last');
      if (G.sel && G.sel.r === r && G.sel.c === c) cls.push('sel');
      if (kingSq && kingSq[0] === r && kingSq[1] === c) cls.push('check');
      if (G.hint && ((G.hint.to[0] === r && G.hint.to[1] === c) || (G.hint.from[0] === r && G.hint.from[1] === c))) cls.push('hint');
      if (tgt.has(i)) cls.push('target');
      if (thr.has(i)) cls.push('threat');
      const coords = (dc === 0 ? `<span class="cr">${8 - r}</span>` : '') + (dr === 7 ? `<span class="cf">${'abcdefgh'[c]}</span>` : '');
      const label = `${sqName(r, c)}${p ? ' ' + colorName(p.o) + ' ' + NAME[p.t] : ''}`;
      html += `<button type="button" class="${cls.join(' ')}" data-r="${r}" data-c="${c}" aria-label="${label}">${coords}${p ? pieceHTML(p) : ''}</button>`;
    }
    $('grid').innerHTML = html;

    const mat = material(s);
    const top = flip ? 0 : 1, bot = top ^ 1;
    for (const [id, side] of [['playerTop', top], ['playerBot', bot]]) {
      const el = $(id);
      const theirLost = mat.lost[side ^ 1];
      const adv = side === 0 ? mat.score : -mat.score;
      el.innerHTML = `<span class="who">${side ? '●' : '○'} ${esc(playerName(x, side))}<small>${colorName(side)}</small></span><span class="caps" aria-label="Captured">${theirLost.map(t => `<span>${GLYPH[t]}</span>`).join('')}</span>${adv > 0 ? `<span class="adv">+${adv}</span>` : ''}`;
      el.classList.toggle('active', !x.over && s.turn === side);
    }

    const msg = $('msg');
    msg.classList.remove('check');
    if (x.over) msg.textContent = x.over.winner === null ? 'Draw' : `${playerName(x, x.over.winner)} ${playerName(x, x.over.winner) === 'You' ? 'win' : 'wins'}${x.over.reason === 'Resigned.' ? ' by resignation' : ''}`;
    else if (G.thinking) msg.textContent = `${playerName(x, s.turn)} is thinking…`;
    else if (x.kind === 'lesson') msg.textContent = G.lesson ? G.lesson.title : 'Lesson';
    else {
      const who = x.human.includes(s.turn) ? (x.human.length > 1 ? `${colorName(s.turn)} to move` : 'Your move') : `Waiting for ${playerName(x, s.turn)}`;
      msg.textContent = who + (inCheck(s, s.turn) ? ': check!' : '');
      if (inCheck(s, s.turn)) msg.classList.add('check');
    }
    $('moveNo').textContent = x.kind === 'lesson' ? '' : `Move ${s.full}`;
    $('modeChip').textContent = { ai: 'vs Computer', claude: 'vs Claude', pvp: 'Pass and play', online: 'Online', puzzle: 'Puzzle', lesson: 'Lesson' }[x.kind];
    $('returnBtn').hidden = !(G.saved && (x.kind === 'puzzle' || x.kind === 'lesson'));
    $('resignBtn').hidden = !(x.kind === 'online' && !x.over && x.human.length);
    const lastH = x.history[x.history.length - 1];
    $('claudeSays').hidden = !(lastH && lastH.say);
    if (lastH && lastH.say) $('claudeSaysText').textContent = lastH.say;
    $('coach').innerHTML = G.coach || '';
    $('coach').hidden = !G.coach;
    $('undoBtn').disabled = !x.history.length || G.thinking || x.kind === 'online' || x.kind === 'lesson';
    $('hintBtn').disabled = !humanTurn();
    $('level').disabled = $('mode').value !== 'ai';
    $('onlineGameBar').hidden = x.kind !== 'online';
    if (x.kind === 'online' && G.onlineDoc) $('onlineGameTitle').textContent = G.onlineDoc.title || 'Online game';
    renderEval();
    renderLog();

    if (x.over && !x.overShown && x.kind !== 'puzzle' && x.kind !== 'lesson') {
      x.overShown = true;
      const w = x.over.winner, mine = x.human.length === 1 ? x.human[0] : null;
      $('endTitle').textContent = w === null ? 'Draw' : (mine === null ? `${colorName(w)} wins` : (w === mine ? 'You win!' : `${playerName(x, w)} wins`));
      $('endText').textContent = x.over.reason + (mine !== null && w !== null && w !== mine ? ' Ask the Tutor to review the game and show you where it turned.' : ' A review with the Tutor helps you learn from every game.');
      $('endUndo').hidden = x.kind === 'online';
      $('endDlg').hidden = false;
    }
  }
  function renderLog() {
    const x = S(), log = $('log');
    if (!x.history.length) { log.innerHTML = '<li class="log-empty">No moves yet.</li>'; return; }
    const rows = [];
    let n = 1, cur = null;
    x.history.forEach((h, i) => {
      if (h.by === 0 || i === 0) { cur = { n: n++, w: h.by === 0 ? h.san : '…', b: h.by === 1 ? h.san : '' }; rows.push(cur); }
      else cur.b = h.san;
    });
    log.innerHTML = rows.map(r => `<li><span class="n">${r.n}.</span><span>${esc(r.w)}</span><span>${esc(r.b)}</span></li>`).join('');
    log.scrollTop = log.scrollHeight;
  }
  function renderEval() {
    const el = $('evalLine'), x = S();
    if (!G.showEval || x.kind === 'lesson') { el.hidden = true; return; }
    el.hidden = false;
    if (x.over) { el.textContent = 'Game over'; return; }
    let v = search(x.s, 2, -MATE * 2, MATE * 2, 0);
    if (x.s.turn === 1) v = -v;
    el.innerHTML = `<span>Engine evaluation</span><span class="evbar"><span style="width:${Math.max(4, Math.min(96, 50 + v / 20))}%"></span></span><b>${fmtScore(v)}</b> <span class="muted">for White</span>`;
  }

  /* ---------- piece guide ---------- */
  function diagramHTML(t) {
    const cells = {};
    const mark = (r, c, k) => { if (Math.abs(r) <= 3 && Math.abs(c) <= 3 && !cells[`${r},${c}`]) cells[`${r},${c}`] = k; };
    if (t === 'N') KNIGHT.forEach(([r, c]) => mark(r, c, 'step'));
    else if (t === 'K') KING.forEach(([r, c]) => mark(r, c, 'step'));
    else if (t === 'P') { mark(-1, 0, 'step'); mark(-2, 0, 'ray'); mark(-1, -1, 'capt'); mark(-1, 1, 'capt'); }
    else {
      const dirs = t === 'R' ? ORTHO : t === 'B' ? DIAG : KING;
      dirs.forEach(([r, c]) => { for (let k = 1; k <= 3; k++) mark(r * k, c * k, k === 1 ? 'step' : 'ray'); });
    }
    let h = '<div class="mgrid" aria-hidden="true">';
    for (let r = -3; r <= 3; r++) for (let c = -3; c <= 3; c++) h += r === 0 && c === 0 ? `<span class="me">${GLYPH[t]}</span>` : `<span class="${cells[`${r},${c}`] || ''}"></span>`;
    return h + '</div>';
  }
  function showGuide(t) {
    const [name, desc] = INFO[t];
    let h = `<div class="guide-head"><div class="big"><span class="pc w">${GLYPH[t]}</span></div><div><div class="eyebrow">Piece</div><h2>${name}</h2>${t !== 'K' ? `<div class="muted">Worth about ${VAL[t] / 100 | 0} point${VAL[t] >= 200 ? 's' : ''}</div>` : ''}</div></div>`;
    h += `<p style="margin-top:12px">${desc}</p><h3>How it moves</h3><div class="diagrams"><figure class="diag">${diagramHTML(t)}<figcaption>${name}, White's view</figcaption></figure></div>`;
    h += `<div class="legend"><span><i></i>moves here</span>${'RBQ'.includes(t) ? '<span><i class="r"></i>keeps sliding</span>' : ''}${t === 'P' ? '<span><i class="r"></i>two squares, first move only</span><span><i class="c"></i>captures here</span>' : ''}</div>`;
    h += '<h3>All pieces</h3><div class="allpieces">' + allPiecesHTML() + '</div>';
    $('pane-pieces').innerHTML = h;
  }
  const allPiecesHTML = () => ['K', 'Q', 'R', 'B', 'N', 'P'].map(t =>
    `<button type="button" class="pcard" data-key="${t}"><span class="mini"><span class="pc w">${GLYPH[t]}</span></span><span><b>${NAME[t]}</b><small>${t === 'K' ? 'priceless' : (VAL[t] / 100 | 0) + ' points'}</small></span></button>`).join('');
  function showTab(name) {
    for (const b of document.querySelectorAll('.tabs button')) b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false');
    for (const p of document.querySelectorAll('.tabpane')) p.hidden = p.id !== 'pane-' + name;
    if (name === 'puzzles') renderPuzzles();
    if (name === 'lessons') renderLessons();
    if (name === 'online') renderLobby();
    try { localStorage.setItem('chess-dojo-tab', name); } catch (e) {}
  }

  /* ---------- puzzles ---------- */
  const PZ = (typeof PUZZLES !== 'undefined' && Array.isArray(PUZZLES)) ? PUZZLES : [];
  const KIND_LABEL = { mate1: 'Mate in 1', mate2: 'Mate in 2', tactic: 'Win material' };
  function enterSide() { const x = S(); if (x && x.kind !== 'puzzle' && x.kind !== 'lesson' && x.kind !== 'online') G.saved = x; }
  function startPuzzle(p) {
    enterSide(); leaveOnline();
    const turn = parseFen(p.fen).turn;
    G.sess = newSession('puzzle', { start: p.fen, human: [turn], puzzle: p, flip: turn === 1 });
    clearSel(); G.hint = null; G.thinking = false;
    const goal = p.kind === 'mate1' ? 'Find the move that checkmates.' : p.kind === 'mate2' ? 'Find the first move of a forced mate in two. Your opponent will defend as well as possible.' : 'Find the move that wins material by force.';
    setCoach(null, `<b>${KIND_LABEL[p.kind] || 'Puzzle'}${p.theme && p.theme !== 'tactic' ? ` · ${esc(p.theme)}` : ''}.</b> You play ${colorName(turn)}. ${goal}`);
    render(); renderPuzzles();
  }
  function puzzleAfter(x, m) {
    const p = x.puzzle, h = x.history[x.history.length - 1];
    if (!x.human.includes(h.by)) return;
    const ply = x.history.length - 1, uci = toUci(m);
    const solvedNow = () => { G.stats.puzzles[p.id] = true; saveStats(); setCoach(null, `<b>Solved!</b> ${esc(p.explain || '')}`); renderPuzzles(); render(); };
    if (x.over && x.over.winner !== null && x.human.includes(x.over.winner)) return solvedNow();
    const lastAttack = p.kind === 'mate1' ? 0 : p.kind === 'mate2' ? 2 : 0;
    const wrong = () => {
      setCoach(null, `<b>Not quite.</b> Hint: ${esc(p.hint || 'look for forcing moves: checks, captures and threats.')}`);
      setTimeout(() => { if (S() !== x) return; const hh = x.history.pop(); x.keys.pop(); undo(x.s, hh.m); x.over = null; render(); }, 700);
      render();
    };
    if (ply >= lastAttack && p.kind !== 'tactic') return wrong();
    if (uci !== (p.line[ply] || p.solution[0])) return wrong();
    if (p.kind === 'tactic') {
      G.stats.puzzles[p.id] = true; saveStats();
      setCoach(null, `<b>Correct!</b> ${esc(p.explain || '')} The rest of the line plays out on the board.`);
      renderPuzzles();
      playOutLine(x, p.line.slice(ply + 1));
      return;
    }
    G.thinking = true; render();
    setTimeout(() => {
      G.thinking = false;
      if (S() !== x) return;
      const reply = fromUci(x.s, p.line[ply + 1]) || (analyze(x.s, 2)[0] || {}).m;
      if (reply) play(fromUci(x.s, toUci(reply)));
      setCoach(null, '<b>Good.</b> Your opponent defended. Now finish it.');
      render();
    }, 450);
  }
  function playOutLine(x, rest) {
    if (!rest.length) return;
    setTimeout(() => {
      if (S() !== x) return;
      const m = fromUci(x.s, rest[0]);
      if (!m) return;
      const humanSave = x.human; x.human = [];
      play(m);
      x.human = humanSave;
      playOutLine(x, rest.slice(1));
    }, 650);
  }
  function renderPuzzles() {
    const el = $('puzzleList');
    if (!PZ.length) { el.innerHTML = '<p class="muted">No puzzles loaded.</p>'; return; }
    const solved = PZ.filter(p => G.stats.puzzles[p.id]).length;
    $('puzzleProgress').textContent = `${solved} of ${PZ.length} solved.`;
    const cur = S().kind === 'puzzle' ? S().puzzle.id : null;
    el.innerHTML = ['mate1', 'mate2', 'tactic'].filter(k => PZ.some(p => p.kind === k)).map(k => `<h3>${KIND_LABEL[k]}</h3><div class="pzgrid">` + PZ.filter(p => p.kind === k).map((p, i) =>
      `<button type="button" class="pz ${G.stats.puzzles[p.id] ? 'done' : ''} ${cur === p.id ? 'cur' : ''}" data-pz="${esc(p.id)}" aria-label="${KIND_LABEL[k]} puzzle ${i + 1}${G.stats.puzzles[p.id] ? ', solved' : ''}">${i + 1}</button>`).join('') + '</div>').join('');
    $('puzzleActions').hidden = !cur;
  }

  /* ---------- lessons ---------- */
  const LS = (typeof LESSONS !== 'undefined' && Array.isArray(LESSONS)) ? LESSONS : [];
  function openLesson(id) {
    const L = LS.find(l => l.id === id); if (!L) return;
    enterSide(); leaveOnline();
    G.lesson = L; G.lessonStep = 0;
    const start = L.start || 'startpos';
    const turn = start === 'startpos' ? 0 : parseFen(start).turn;
    G.sess = newSession('lesson', { start, human: [], flip: false });
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
      el.innerHTML = `<h2>Lessons</h2><p class="muted">${done} of ${LS.length} opened. Each lesson sets up the board and steps through a line move by move.</p><div class="lessonlist">` +
        LS.map((l, i) => `<button type="button" class="lessonrow" data-lesson="${esc(l.id)}"><span class="num">${i + 1}</span><span><b>${esc(l.title)}</b><small>${esc(l.summary || '')}</small></span>${G.stats.lessons[l.id] ? '<span class="tick" aria-label="opened">✓</span>' : ''}</button>`).join('') + '</div>';
      return;
    }
    const step = G.lessonStep, n = L.moves.length;
    let k = step - 1;
    if (L.notes && k > 0 && !L.notes[String(k)] && L.notes[String(k - 1)]) k--;
    const note = step > 0 && L.notes ? L.notes[String(k)] : null;
    const h = S().history[k];
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
      <div class="lessonnote">${step === 0 ? (L.notes && L.notes['-1'] ? esc(L.notes['-1']) : 'Starting position. Press Next to play through the line.') : `<b>${h ? esc(h.san) : ''}</b> ${note ? esc(note) : ''}`}</div>
      ${L.key ? `<p class="keyline"><b>Key idea:</b> ${esc(L.key)}</p>` : ''}
      <div class="row-actions"><button class="btn" type="button" id="lessonPlay">Play on from here vs computer</button><button class="btn" type="button" id="lessonAsk">Ask the Tutor about this</button></div>`;
  }

  /* ---------- tutor ---------- */
  const TUTOR_RULES = 'You are a warm, sharp chess coach inside a learning app called Chess Dojo. The learner is a beginner-to-intermediate player. Explain in plain English using standard algebraic notation (Nf3, exd5, O-O). Ground every claim in the position and engine data you are given; never invent moves that aren\'t legal there. Keep answers under 170 words unless asked for more, use short paragraphs or a short list, and end with one concrete thing to practise.';
  function positionContext() {
    const x = S(), s = x.s, legal = legalMoves(s);
    const ranked = x.over ? [] : analyze(s, 3).slice(0, 5);
    const mine = x.human.length === 1 ? colorName(x.human[0]) : 'both sides';
    return `Mode: ${x.kind}${x.kind === 'lesson' && G.lesson ? ` (lesson: ${G.lesson.title})` : ''}${x.kind === 'puzzle' ? ` (${KIND_LABEL[x.puzzle.kind]} puzzle; don't reveal the answer unless asked directly)` : ''}
The learner plays: ${mine}. Side to move: ${colorName(s.turn)}${inCheck(s, s.turn) ? ', in check' : ''}.${x.over ? ` Game over: ${x.over.reason}` : ''}
FEN: ${toFen(s)}
${boardText(s)}
Moves so far: ${sanList(x).join(' ') || '(none)'}
Engine's top moves for the side to move (score in pawns, side-to-move view): ${ranked.map(r => `${toSan(s, r.m, legal)} ${fmtScore(r.v)}`).join(', ') || 'n/a'}`;
  }
  async function askTutor(question, extra) {
    if (G.tutorBusy) return;
    G.tutorTurns.push({ role: 'user', content: question });
    const ctx = positionContext() + (extra ? '\n\n' + extra : '');
    renderTutor();
    if (!G.sample) { G.tutorTurns.push({ role: 'assistant', content: offlineAnswer(), offline: true }); renderTutor(); return; }
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
      if (e && e.code === 'not_granted') G.sample = null;
    } finally {
      bubble.pending = false; G.tutorBusy = false; G.tutorCtl = null;
      renderTutor();
    }
  }
  function tutorError(code) {
    return ({ not_granted: 'The tutor needs permission to ask Claude. You can allow it from this page\'s permissions.', rate_limited: 'The tutor is getting a lot of questions. Wait a minute and ask again.', prompt_too_large: 'That was too much to send at once. Ask about a shorter stretch of the game.' })[code] || 'The tutor couldn\'t answer just now. Try again in a moment.';
  }
  function offlineAnswer() {
    const x = S();
    if (x.over) return 'The game is over. The engine review still works without Claude.';
    const ranked = analyze(x.s, 3).slice(0, 3), legal = legalMoves(x.s);
    return `Claude isn't reachable from this view, so here is the engine's read instead. Best moves for the side to move: ${ranked.map(r => `${toSan(x.s, r.m, legal)} (${fmtScore(r.v)})`).join(', ')}.`;
  }
  function renderTutorBubble(b) {
    const el = document.querySelector(`[data-bubble="${G.tutorTurns.indexOf(b)}"]`);
    if (el) el.textContent = b.content;
    const out = $('tutorLog'); out.scrollTop = out.scrollHeight;
  }
  function renderTutor() {
    $('tutorNoClaude').hidden = !!G.sample;
    const out = $('tutorLog');
    out.innerHTML = G.tutorTurns.length ? G.tutorTurns.map((t, i) => `<div class="bubble ${t.role}${t.pending ? ' pending' : ''}" data-bubble="${i}"></div>`).join('') : '<p class="muted">Ask anything: why a move is good, what your opponent is threatening, which opening to learn. The tutor sees the current board.</p>';
    G.tutorTurns.forEach((t, i) => { const el = out.querySelector(`[data-bubble="${i}"]`); if (el) el.textContent = t.content; });
    out.scrollTop = out.scrollHeight;
    $('tutorStop').hidden = !G.tutorBusy;
    $('tutorAsk').disabled = G.tutorBusy;
  }
  async function reviewGame() {
    const x = S();
    if (!x.history.length) { askTutor('We haven\'t played any moves yet. What should I focus on in the opening?'); return; }
    const sides = x.human.length ? x.human : [0, 1];
    const replay = x.start === 'startpos' ? initialState() : parseFen(x.start);
    const rows = [];
    $('reviewOut').innerHTML = '<p class="muted">Checking every move with the engine…</p>';
    for (let i = 0; i < x.history.length; i++) {
      const h = x.history[i], legal = legalMoves(replay);
      if (sides.includes(replay.turn) && legal.length > 1) {
        const ranked = analyze(replay, 2);
        const best = ranked[0], played = ranked.find(r => toUci(r.m) === h.uci);
        if (best && played) rows.push({ i, n: replay.full, side: replay.turn, played: h.san, best: toSan(replay, best.m, legal), loss: best.v - played.v });
      }
      const m = fromUci(replay, h.uci, legal); if (!m) break;
      apply(replay, m);
      if (i % 3 === 2) await new Promise(r => setTimeout(r, 0));
    }
    const worst = rows.filter(r => r.loss > 120).sort((a, b) => b.loss - a.loss).slice(0, 5).sort((a, b) => a.i - b.i);
    const accuracy = rows.length ? Math.round(100 * rows.filter(r => r.loss <= 50).length / rows.length) : 100;
    $('reviewOut').innerHTML = `<div class="reviewhead"><b>${accuracy}%</b> of your moves were within half a pawn of the engine's choice (${rows.length} moves checked).</div>` +
      (worst.length ? `<table class="review"><thead><tr><th>Move</th><th>You played</th><th>Engine liked</th><th>Cost</th></tr></thead><tbody>${worst.map(r => `<tr><td>${r.n}${r.side ? '…' : '.'}</td><td class="mono">${esc(r.played)}</td><td class="mono">${esc(r.best)}</td><td>${Math.abs(r.loss) > MATE / 2 ? 'mate' : (r.loss / 100).toFixed(1)}</td></tr>`).join('')}</tbody></table>` : '<p>No big mistakes found. Nice.</p>');
    const summary = worst.map(r => `move ${r.n}: played ${r.played}, engine preferred ${r.best}, cost about ${Math.abs(r.loss) > MATE / 2 ? 'a forced mate' : (r.loss / 100).toFixed(1) + ' pawns'}`).join('; ');
    askTutor('Review my game. What were the turning points, and what 3 habits should I work on?', `Engine review of the learner's moves (${rows.length} checked, ${accuracy}% close to engine): ${summary || 'no move lost more than about a pawn'}.`);
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
    G.db.collection('games').orderBy('updatedAt', 'desc').limit(60).onSnapshot(snap => {
      G.lobby = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      refreshNames(G.lobby.flatMap(g => [g.white, g.black, g.createdBy]));
      renderLobby();
    }, () => { $('lobbyMsg').textContent = 'The game list stopped updating. Reload the page to reconnect.'; });
  }
  function renderLobby() {
    $('onlineOff').hidden = !!G.db;
    $('onlineOn').hidden = !G.db;
    if (!G.db) return;
    const me = G.me, mineOf = g => me && (g.white === me || g.black === me);
    const mine = G.lobby.filter(g => mineOf(g) && g.status !== 'over');
    const open = G.lobby.filter(g => g.status === 'waiting' && !mineOf(g));
    const live = G.lobby.filter(g => g.status === 'playing' && !mineOf(g));
    const done = G.lobby.filter(g => g.status === 'over').slice(0, 8);
    const row = (g, action) => {
      const n = (g.moves || []).length;
      const vs = `${esc(g.white ? displayName(g.white) : 'Open seat')} <span class="muted">vs</span> ${esc(g.black ? displayName(g.black) : 'Open seat')}`;
      const st = g.status === 'over' ? (g.result && g.result.winner !== null && g.result.winner !== undefined ? `${colorName(g.result.winner)} won` : 'Draw') : g.status === 'waiting' ? 'Waiting for a player' : `${n} moves · ${n % 2 ? 'Black' : 'White'} to move`;
      return `<div class="grow"><div><b>${esc(g.title || 'Chess game')}</b><small>${vs}</small><small class="muted">${st}</small></div><button class="btn ${action === 'Join' ? 'primary' : ''}" type="button" data-game="${esc(g.id)}" data-act="${action}">${action}</button></div>`;
    };
    $('lobbyLists').innerHTML =
      `<h3>Your games</h3>${mine.length ? mine.map(g => row(g, 'Open')).join('') : '<p class="muted">You aren\'t in a game yet. Create one above or join an open seat.</p>'}` +
      `<h3>Open seats</h3>${open.length ? open.map(g => row(g, 'Join')).join('') : '<p class="muted">No one is waiting right now. Create a game and share this page with a friend.</p>'}` +
      (live.length ? `<h3>Being played now</h3>${live.map(g => row(g, 'Watch')).join('')}` : '') +
      (done.length ? `<h3>Finished</h3>${done.map(g => row(g, 'Replay')).join('')}` : '');
    $('createGame').disabled = G.canWrite === false;
    $('lobbyMsg').textContent = G.canWrite === false ? 'You can watch games, but your access to this page doesn\'t allow joining or creating them. Ask the owner for Contributor access.' : '';
  }
  async function createGame() {
    if (!G.db || !G.me) { $('lobbyMsg').textContent = 'Sign in to claude.ai to play online.'; return; }
    const pick = $('newSide').value, opp = $('newOpp').value;
    const mySide = pick === 'random' ? (Math.random() < .5 ? 'white' : 'black') : pick;
    const other = mySide === 'white' ? 'black' : 'white';
    const now = Date.now();
    const doc = { title: ($('newTitle').value || '').trim().slice(0, 60) || 'Friendly game', white: null, black: null, moves: [], status: 'waiting', result: null, createdBy: G.me, createdAt: now, updatedAt: now };
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
      const snap = await ref.get(), g = snap.exists ? snap.data() : null;
      if (!g || g.status !== 'waiting') { $('lobbyMsg').textContent = 'That seat was just taken.'; return; }
      await ref.update({ [g.white ? 'black' : 'white']: G.me, status: 'playing', updatedAt: Date.now() });
      openOnline(id);
    } catch (e) { $('lobbyMsg').textContent = 'Couldn\'t join that game.'; }
  }
  function leaveOnline() { if (G.onlineUnsub) { G.onlineUnsub(); G.onlineUnsub = null; } G.onlineDoc = null; }
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
      x.human = [g.white === G.me ? 0 : -1, g.black === G.me ? 1 : -1].filter(v => v >= 0);
      x.flip = x.human.length === 1 && x.human[0] === 1;
      const mine = x.history.map(h => h.uci), theirs = g.moves || [];
      const same = mine.length === theirs.length && mine.every((u, i) => u === theirs[i]);
      if (!same) {
        if (theirs.length === mine.length + 1 && mine.every((u, i) => u === theirs[i])) {
          const m = fromUci(x.s, theirs[theirs.length - 1]);
          if (m) play(m, { remote: true, say: (g.says || {})[theirs.length - 1] || null });
        } else { rebuild(x, theirs); clearSel(); }
      }
      if (g.status === 'over' && g.result && !x.over) x.over = { winner: g.result.winner ?? null, reason: g.result.reason || 'Game over.' };
      if (x.over && x.human.length) recordResult(x);
      if (!x.human.length) setCoach(null, g.status === 'waiting' ? 'You\'re watching. This game is waiting for a second player.' : 'You\'re watching this game live. Moves appear as they are played.');
      else if (g.status === 'waiting') setCoach(null, '<b>Waiting for an opponent.</b> Share this page with a friend; the game shows up under Open seats for them.');
      else if (!x.history.length) setCoach(null, `<b>You play ${colorName(x.human[0])}.</b> ${x.human[0] ? 'The board is turned so your pieces are at the bottom.' : 'You move first.'}`);
      else if (G.coach && G.coach.startsWith('<b>You play')) G.coach = null;
      render();
      maybeClaudeOnline(g);
    }, () => { setCoach(null, 'Lost the live connection to this game. Reload to reconnect.'); render(); });
    showTab('online');
  }
  function pushOnline(x) {
    const moves = x.history.map(h => h.uci), lastSay = x.history[x.history.length - 1].say;
    const upd = { moves, updatedAt: Date.now() };
    if (lastSay) upd.says = { [moves.length - 1]: lastSay };
    if (x.over) { upd.status = 'over'; upd.result = { winner: x.over.winner, reason: x.over.reason }; }
    G.writing = G.writing.then(() => G.db.doc('games/' + x.gameId).update(upd)).catch(() => { setCoach(null, 'That move didn\'t reach the server. Reload the page to resync.'); render(); });
  }
  function resign() {
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
    const seat = x.s.turn ? g.black : g.white;
    if (seat !== 'claude' || !x.human.length) return;
    if (!G.sample) { setCoach(null, 'It\'s Claude\'s turn. Claude moves when this page is allowed to ask Claude, or ask Claude Code in your chat to make its move in this game.'); render(); return; }
    claudeOnlineBusy = true;
    try {
      const lease = await G.db.doc('games/' + x.gameId).acquire({ holder: TAB_ID, ttlMs: 90000 });
      if (!lease.acquired) return;
      G.thinking = true; render();
      const before = x.history.length;
      const { pick, say } = await claudeChooseMove(x);
      G.thinking = false;
      if (S() === x && x.history.length === before && pick) play(pick, { say }); else render();
    } catch (e) { G.thinking = false; render(); }
    finally { claudeOnlineBusy = false; }
  }

  /* ---------- persistence ---------- */
  function serial() {
    const keep = G.saved || (['ai', 'claude', 'pvp'].includes(S().kind) ? S() : null);
    return { v: 1, showEval: G.showEval, game: keep ? { kind: keep.kind, start: keep.start, level: keep.level, human: keep.human, moves: keep.history.map(h => h.uci) } : null };
  }
  function save() { try { localStorage.setItem('chess-dojo-1', JSON.stringify(serial())); } catch (e) {} }
  function restore(data) {
    if (!data || data.v !== 1) return false;
    G.showEval = !!data.showEval;
    if (!data.game) return false;
    const g = data.game, kind = ['ai', 'claude', 'pvp'].includes(g.kind) ? g.kind : 'ai';
    const human = Array.isArray(g.human) && g.human.length ? g.human : [0];
    G.sess = newSession(kind, { start: g.start, level: g.level, human, flip: human.length === 1 && human[0] === 1 });
    rebuild(G.sess, Array.isArray(g.moves) ? g.moves : []);
    G.sess.overShown = !!G.sess.over;
    return true;
  }
  async function loadStats() {
    try { const raw = JSON.parse(localStorage.getItem('chess-dojo-stats') || 'null'); if (raw) Object.assign(G.stats, raw); } catch (e) {}
    if (G.db && G.me) {
      try {
        const snap = await G.db.collection('data/users/' + G.me).doc('stats').get();
        if (snap.exists) { const d = snap.data(); for (const k of Object.keys(G.stats)) G.stats[k] = { ...(d[k] || {}), ...G.stats[k] }; }
      } catch (e) {}
    }
    renderProgress();
  }
  let statsTimer = null;
  function saveStats() {
    try { localStorage.setItem('chess-dojo-stats', JSON.stringify(G.stats)); } catch (e) {}
    renderProgress();
    if (!G.db || !G.me) return;
    clearTimeout(statsTimer);
    statsTimer = setTimeout(() => { G.db.collection('data/users/' + G.me).doc('stats').set(JSON.parse(JSON.stringify(G.stats))).catch(() => {}); }, 800);
  }
  function renderProgress() {
    const st = G.stats;
    const labels = [...new Set([...Object.keys(st.wins), ...Object.keys(st.losses), ...Object.keys(st.draws)])];
    $('progress').innerHTML = `<div class="stats"><div><b>${Object.keys(st.puzzles).length}</b><small>puzzles solved</small></div><div><b>${Object.keys(st.lessons).length}</b><small>lessons opened</small></div><div><b>${labels.reduce((a, l) => a + (st.wins[l] || 0), 0)}</b><small>games won</small></div></div>` +
      (labels.length ? `<table class="review"><thead><tr><th>Opponent</th><th>Won</th><th>Lost</th><th>Drawn</th></tr></thead><tbody>${labels.map(l => `<tr><td>${esc(l)}</td><td>${st.wins[l] || 0}</td><td>${st.losses[l] || 0}</td><td>${st.draws[l] || 0}</td></tr>`).join('')}</tbody></table>` : '<p class="muted small">Finish a game against the computer or Claude and your record shows up here.</p>');
  }

  /* ---------- wiring ---------- */
  $('level').innerHTML = LEVELS.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
  $('level').value = 'l2';
  $('levelList').innerHTML = LEVELS.map(l => `<li><b>${esc(l.name)}</b> <span class="muted">${esc(l.detail)}</span></li>`).join('');
  $('grid').addEventListener('click', e => { const b = e.target.closest('.sq'); if (b) onSquare(+b.dataset.r, +b.dataset.c); });
  document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) showTab(b.dataset.tab); });
  function returnToGame() {
    if (!G.saved) return;
    leaveOnline();
    G.sess = G.saved; G.saved = null; G.lesson = null; clearSel(); G.hint = null;
    setCoach(null, 'Back to your game.');
    render(); renderLessons(); renderPuzzles();
    if (S().kind === 'ai') maybeEngine();
  }
  document.addEventListener('click', e => {
    const pc = e.target.closest('.pcard'); if (pc) { showGuide(pc.dataset.key); showTab('pieces'); return; }
    const pz = e.target.closest('[data-pz]'); if (pz) { const p = PZ.find(q => q.id === pz.dataset.pz); if (p) startPuzzle(p); return; }
    const lr = e.target.closest('[data-lesson]'); if (lr) { openLesson(lr.dataset.lesson); return; }
    const st = e.target.closest('[data-step]'); if (st) { lessonGo(+st.dataset.step); return; }
    if (e.target.closest('#lessonBack')) { G.lesson = null; renderLessons(); if (G.saved) returnToGame(); return; }
    if (e.target.closest('#lessonPlay')) { const fen = toFen(S().s), turn = S().s.turn; G.saved = null; startGame('ai', { start: fen, level: $('level').value, side: turn ? 'b' : 'w' }); setCoach(null, 'Playing on from the lesson position against the computer. You have the side to move.'); render(); return; }
    if (e.target.closest('#lessonAsk')) { showTab('tutor'); askTutor(`Explain the idea of this lesson ("${G.lesson.title}") in the current position, and what I should look for next.`); return; }
    const gm = e.target.closest('[data-game]'); if (gm) { if (gm.dataset.act === 'Join') joinGame(gm.dataset.game); else openOnline(gm.dataset.game); return; }
  });
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
  $('puzzleShow').onclick = () => { const x = S(); if (x.kind !== 'puzzle') return; const p = x.puzzle; const s0 = parseFen(p.fen); const sans = []; for (const u of p.line) { const m = fromUci(s0, u); if (!m) break; sans.push(toSan(s0, m)); apply(s0, m); } setCoach(null, `<b>Solution:</b> <span class="nt">${esc(sans.join(' '))}</span>. ${esc(p.explain || '')}`); render(); };
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
    try { ok = restore(data && data.v ? data : JSON.parse(localStorage.getItem('chess-dojo-1') || 'null')); } catch (e) { ok = false; }
    if (!ok) {
      G.sess = newSession('ai', { level: 'l2' });
      setCoach(null, '<b>Welcome to the dojo.</b> You play White against the computer. Tap any piece to see where it can go. New to chess? Open the Lessons tab, or ask the Tutor anything.');
    } else setCoach(null, S().history.length ? 'Welcome back. Your game is right where you left it.' : 'Your move. Tap a piece to see where it can go.');
    $('mode').value = S().kind; $('level').value = S().level; $('showEval').checked = G.showEval;
    $('side').value = S().human.length === 1 && S().human[0] === 1 ? 'b' : 'w';
    let tab = 'tutor';
    try { tab = localStorage.getItem('chess-dojo-tab') || 'tutor'; } catch (e) {}
    showGuide('N');
    showTab(['tutor', 'online', 'puzzles', 'lessons', 'pieces', 'rules', 'moves'].includes(tab) ? tab : 'tutor');
    renderTutor(); renderProgress();
    render();
    maybeEngine();
    initCapabilities();
  }
  window.claude?.hot?.snapshot?.(() => serial());
  window.claude?.hot?.ready ? window.claude.hot.ready(start) : start(window.claude?.hot?.data ?? {});
})();
