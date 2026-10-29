// Drives the built page in Chromium with mocked db/user/sample capabilities.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1300, height: 1100 } });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.addInitScript({ path: __dirname + '/mock.js' });
  await p.goto('file://' + __dirname + '/.preview.html'); await p.waitForTimeout(600);
  const sq = n => p.click(`.sq[aria-label^="${n}"]`);
  // vs computer: 1.e4, computer replies
  await sq('e2'); await sq('e4'); await p.waitForTimeout(1500);
  console.log('ai:', await p.$$eval('#log li', l => l.map(x => x.textContent)), '|', await p.textContent('#msg'));
  // tutor
  await p.click('#tExplain'); await p.waitForTimeout(300);
  console.log('tutor bubbles:', await p.$$eval('.bubble', l => l.length));
  // Scholar's mate vs pass-and-play to test checkmate + end dialog + castling-free SAN
  await p.selectOption('#mode', 'pvp'); await p.click('#newBtn');
  for (const [a, c] of [['e2', 'e4'], ['e7', 'e5'], ['f1', 'c4'], ['b8', 'c6'], ['d1', 'h5'], ['g8', 'f6'], ['h5', 'f7']]) { await sq(a); await sq(c); }
  await p.waitForTimeout(200);
  console.log('mate:', await p.textContent('#endTitle'), '|', (await p.$$eval('#log li', l => l.map(x => x.textContent))).join(' '));
  await p.click('#endClose');
  // vs Claude as Black: Claude (White) moves first
  await p.selectOption('#mode', 'claude'); await p.selectOption('#side', 'b'); await p.click('#newBtn'); await p.waitForTimeout(1500);
  console.log('claude:', await p.textContent('#msg'), '|', await p.textContent('#claudeSaysText'), '| bottom-left square', await p.$eval('.sq', e => e.getAttribute('aria-label')));
  // online: create as white, friend joins as black and replies
  await p.selectOption('#mode', 'online'); await p.click('#newBtn'); await p.selectOption('#newSide', 'white'); await p.click('#createGame'); await p.waitForTimeout(300);
  const gid = await p.evaluate(() => [...window.__store.keys()].find(k => k.startsWith('games/')));
  await p.evaluate(g => { const d = window.__store.get(g); d.black = 'u_friend'; d.status = 'playing'; d.updatedAt = Date.now(); window.__notify(g); }, gid); await p.waitForTimeout(200);
  await sq('d2'); await sq('d4'); await p.waitForTimeout(200);
  await p.evaluate(g => { const d = window.__store.get(g); d.moves = [...d.moves, 'd7d5']; window.__notify(g); }, gid); await p.waitForTimeout(200);
  console.log('online doc moves:', JSON.stringify(await p.evaluate(g => window.__store.get(g).moves, gid)), '| log', (await p.$$eval('#log li', l => l.map(x => x.textContent))).join(' '));
  // promotion dialog in pass-and-play from a custom position is covered by engine tests; check puzzles/lessons tabs render
  await p.click('[data-tab="puzzles"]'); await p.click('[data-tab="lessons"]');
  await p.screenshot({ path: __dirname + '/e2e.png' });
  console.log('ERRORS', errs);
  await b.close();
})();
