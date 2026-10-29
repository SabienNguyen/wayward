const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1300,height:1100}});
const errs=[];p.on('pageerror',e=>errs.push('PAGEERR '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
await p.addInitScript({path:__dirname+'/mock.js'});
await p.goto('file://'+__dirname+'/.preview.html');await p.waitForTimeout(600);
const sq=(r,c)=>p.click(`.sq[data-r="${r}"][data-c="${c}"]`);
// 1) vs computer: P-7f, wait for reply
await sq(6,2);await sq(5,2);await p.waitForTimeout(1500);
console.log('ai moves:', await p.$$eval('#log li',l=>l.length), await p.textContent('#msg'));
// 2) tutor
await p.click('#tExplain');await p.waitForTimeout(300);
console.log('tutor:', await p.$$eval('.bubble',l=>l.map(x=>x.textContent.slice(0,40))));
// 3) vs Claude local
await p.selectOption('#mode','claude');await p.click('#newBtn');await sq(6,2);await sq(5,2);await p.waitForTimeout(1500);
console.log('claude:', await p.textContent('#msg'), '|', await p.textContent('#claudeSaysText'));
// 4) online: create vs anyone as sente
await p.selectOption('#mode','online');await p.click('#newBtn');await p.waitForTimeout(200);
await p.fill('#newTitle','Test match');await p.click('#createGame');await p.waitForTimeout(300);
let gid=await p.evaluate(()=>[...window.__store.keys()].find(k=>k.startsWith('games/')));
console.log('created', gid, await p.textContent('#coach'));
// friend joins as gote
await p.evaluate(g=>{const d=window.__store.get(g);d.gote='u_friend';d.status='playing';d.updatedAt=Date.now();window.__notify(g)},gid);await p.waitForTimeout(200);
await sq(6,2);await sq(5,2);await p.waitForTimeout(200);
console.log('after my move doc moves', await p.evaluate(g=>window.__store.get(g).moves,gid));
// friend replies 3c3d
await p.evaluate(g=>{const d=window.__store.get(g);d.moves=[...d.moves,'3c3d'];window.__notify(g)},gid);await p.waitForTimeout(200);
console.log('after friend', await p.$$eval('#log li',l=>l.map(x=>x.textContent)), await p.textContent('#msg'));
// lobby
console.log('lobby', (await p.textContent('#lobbyLists')).replace(/\s+/g,' ').slice(0,200));
// 5) online vs Claude as gote (Claude is sente, moves first)
await p.selectOption('#newSide','gote');await p.selectOption('#newOpp','claude');await p.click('#createGame');await p.waitForTimeout(1500);
const g2=await p.evaluate(()=>[...window.__store.entries()].filter(([k,v])=>v.sente==='claude').map(([k,v])=>[k,v.moves,v.says])[0]);
console.log('claude online', JSON.stringify(g2), 'flipped files', await p.textContent('#files'));
await p.click('#resignBtn');await p.waitForTimeout(200);
console.log('resigned', await p.evaluate(()=>[...window.__store.values()].filter(v=>v.sente==='claude').map(v=>v.status+JSON.stringify(v.result))[0]));
await p.click('#endClose').catch(()=>{});
// 6) puzzles & lessons tabs
await p.click('[data-tab="puzzles"]');console.log('puzzles', (await p.textContent('#pane-puzzles')).replace(/\s+/g,' ').slice(0,120));
await p.click('[data-tab="lessons"]');console.log('lessons', (await p.textContent('#pane-lessons')).replace(/\s+/g,' ').slice(0,120));
await p.screenshot({path:__dirname+'/e2e.png'});
console.log('ERRORS', errs);await b.close();})();
