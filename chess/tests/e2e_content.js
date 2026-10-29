// Puzzles and lessons in the browser, at phone width in dark mode.
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 400, height: 1500 }, colorScheme: 'dark' });
  const errs = [];
  p.on('pageerror', e => errs.push('PAGEERR ' + e.message));
  await p.addInitScript({ path: __dirname + '/mock.js' });
  await p.goto('file://' + __dirname + '/.preview.html'); await p.waitForTimeout(500);
  const sq = n => p.click(`.sq[aria-label^="${n}"]`);
  await p.click('[data-tab="puzzles"]'); await p.click('[data-pz="m1-03"]'); await p.waitForTimeout(200);
  await sq('f4'); await sq('h4'); await p.waitForTimeout(300);
  console.log('puzzle (Black to move):', (await p.textContent('#coach')).slice(0, 60), '|', await p.textContent('#puzzleProgress'));
  await p.click('[data-pz="m2-04"]'); await p.waitForTimeout(200);
  await sq('h7'); await sq('h5'); await p.waitForTimeout(300);
  console.log('wrong mate-in-2 try:', (await p.textContent('#coach')).slice(0, 40));
  await p.click('[data-tab="lessons"]'); await p.click('[data-lesson="ruy-lopez"]');
  await p.click('[aria-label="Last position"]'); await p.waitForTimeout(200);
  console.log('lesson end note:', await p.textContent('.lessonnote'));
  console.log('scrollWidth', await p.evaluate(() => document.documentElement.scrollWidth));
  await p.screenshot({ path: __dirname + '/mobile.png' });
  console.log('ERRORS', errs);
  await b.close();
})();
