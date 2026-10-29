const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:400,height:1600},colorScheme:'dark'});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));
await p.addInitScript({path:__dirname+'/mock.js'});
await p.goto('file://'+__dirname+'/.preview.html');await p.waitForTimeout(500);
await p.click('[data-tab="lessons"]');await p.click('[data-lesson="yagura-castle"]');
await p.click('[aria-label="Last position"]');await p.waitForTimeout(200);
console.log('lesson note:', (await p.textContent('.lessonnote')).slice(0,120));
await p.screenshot({path:__dirname+'/m2.png',fullPage:false});
await p.click('#returnBtn');
await p.click('[data-tab="puzzles"]');await p.click('[data-pz="m1-01"]');await p.waitForTimeout(200);
await p.click('#handBot .hp[data-t="G"]');await p.click('.sq[data-r="0"][data-c="4"]');await p.waitForTimeout(300);
console.log('puzzle:', (await p.textContent('#coach')).slice(0,80), '| progress', await p.textContent('#puzzleProgress'));
await p.click('#puzzleNext');await p.waitForTimeout(200);
// wrong move on m1-02: drop bishop somewhere random
const sw=await p.evaluate(()=>document.documentElement.scrollWidth);
console.log('scrollWidth',sw,'ERRORS',errs);await b.close();})();
