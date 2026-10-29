// Worker: play games with the classic engine (1-ply + quiescence, noisy) and record positions.
const { parentPort, workerData } = require('worker_threads');
const E = require('../src/engine.js');
const { mlFeatures } = require('./ml.js');
const fs = require('fs');
const out = fs.openSync(workerData.file, 'w');
for (let g = 0; g < workerData.games; g++) {
  const s = E.initialState(), pos = [];
  let winner = null;
  const noise = 60 + Math.random() * 240;
  for (let ply = 0; ply < 260; ply++) {
    pos.push({ f: mlFeatures(s).slice(), t: s.turn });
    const m = E.bestMove(s, 1, noise);
    if (!m) { winner = s.turn ^ 1; break; }
    E.apply(s, m);
  }
  if (winner === null) continue;
  // label each position: did the side to move go on to win?
  fs.writeSync(out, JSON.stringify(pos.map(p => [p.t === winner ? 1 : 0, p.f])) + '\n');
  if (g % 10 === 9) parentPort.postMessage(10);
}
fs.closeSync(out);
parentPort.postMessage('done');
