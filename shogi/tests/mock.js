(() => {
  const store = new Map(), docL = new Map(), colL = [];
  const clone = v => JSON.parse(JSON.stringify(v));
  const snapOf = (path, d) => ({ id: path.split('/').pop(), exists: !!d, data: () => d ? clone(d) : undefined, metadata: { fromCache: false, hasPendingWrites: false } });
  const merge = (a, b) => { for (const k in b) { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') merge(a[k], b[k]); else a[k] = clone(b[k]); } return a; };
  function notify(path) {
    setTimeout(() => {
      for (const fn of (docL.get(path) || [])) fn(snapOf(path, store.get(path)));
      const col = path.split('/').slice(0, -1).join('/');
      for (const l of colL) if (l.col === col) l.fire();
    }, 5);
  }
  function docRef(path) {
    return {
      id: path.split('/').pop(), path,
      get: async () => snapOf(path, store.get(path)),
      set: async d => { store.set(path, clone(d)); notify(path); },
      update: async d => { if (!store.has(path)) throw { code: 'invalid_argument' }; merge(store.get(path), d); notify(path); },
      delete: async () => { store.delete(path); notify(path); },
      acquire: async () => ({ acquired: true }),
      onSnapshot: (fn) => { if (!docL.has(path)) docL.set(path, []); docL.get(path).push(fn); setTimeout(() => fn(snapOf(path, store.get(path))), 5); return () => {}; },
      collection: p => colRef(path + '/' + p),
    };
  }
  function colRef(col, ord, lim) {
    const q = {
      path: col,
      doc: id => docRef(col + '/' + (id || Math.random().toString(36).slice(2, 10))),
      add: async d => { const r = q.doc(); await r.set(d); return r; },
      orderBy: (f, dir) => colRef(col, [f, dir], lim), limit: n => colRef(col, ord, n), where: () => q,
      get: async () => build(),
      onSnapshot: fn => { const l = { col, fire: () => fn(build()) }; colL.push(l); setTimeout(l.fire, 5); return () => {}; },
    };
    function build() {
      let docs = [...store.entries()].filter(([p]) => p.split('/').slice(0, -1).join('/') === col).map(([p, d]) => snapOf(p, d));
      if (ord) docs.sort((a, b) => (b.data()[ord[0]] - a.data()[ord[0]]) * (ord[1] === 'desc' ? 1 : -1));
      return { docs, size: docs.length, empty: !docs.length, docChanges: () => [], metadata: {} };
    }
    return q;
  }
  const db = { doc: docRef, collection: colRef };
  const user = { id: async () => 'u_me', can: async () => true, profiles: async ids => Object.fromEntries([].concat(ids).map(i => [i, { id: i, name: i === 'u_me' ? 'Me' : 'Friend' }])) };
  window.__sampleCalls = [];
  const sample = async (input, opts) => { window.__sampleCalls.push(input); const t = 'Mock tutor answer about the position.'; opts && opts.onText && opts.onText({ text: t }); return { text: t }; };
  sample.json = async (prompt) => { window.__sampleCalls.push(prompt); const m = prompt.match(/All legal moves \(USI\): (\S+)/); return { move: m[1], say: 'Mock Claude says hello.' }; };
  window.__store = store; window.__notify = notify;
  window.claude = { use: async n => ({ db, user, sample }[n] || null) };
})();
