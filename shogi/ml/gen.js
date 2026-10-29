const { Worker } = require('worker_threads');
const N = +process.argv[2] || 2400, W = 4;
let done = 0, fin = 0;
for (let i = 0; i < W; i++) {
  const w = new Worker(__dirname + '/genw.js', { workerData: { file: `${__dirname}/games_${i}.jsonl`, games: Math.ceil(N / W) } });
  w.on('message', m => { if (m === 'done') { if (++fin === W) console.log('ALL DONE', done); } else { done += m; if (done % 200 === 0) console.log('games', done); } });
  w.on('error', e => console.log('Error', e));
}
