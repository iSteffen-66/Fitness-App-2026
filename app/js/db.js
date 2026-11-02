// Speicherschicht: IndexedDB im Browser, Memory-Adapter für Tests.
import { defaultPlan } from './seed.js';

export function memoryAdapter() {
  const kv = new Map(), sessions = new Map(), photos = new Map();
  const clone = (x) => (x === undefined ? undefined : JSON.parse(JSON.stringify(x)));
  return {
    async kvGet(k) { return clone(kv.get(k)); },
    async kvSet(k, v) { kv.set(k, clone(v)); },
    async kvDel(k) { kv.delete(k); },
    async sessionsAll() { return [...sessions.values()].map(clone); },
    async sessionPut(s) { sessions.set(s.id, clone(s)); },
    async sessionDel(id) { sessions.delete(id); },
    async photosAll() { return Object.fromEntries(photos); },
    async photoPut(id, d) { photos.set(String(id), d); },
    async photoDel(id) { photos.delete(String(id)); },
    async clearAll() { kv.clear(); sessions.clear(); photos.clear(); },
  };
}

export function idbAdapter(name = 'fitness-app-2026') {
  let dbp;
  const open = () => dbp || (dbp = new Promise((res, rej) => {
    const r = indexedDB.open(name, 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      d.createObjectStore('kv');
      d.createObjectStore('sessions', { keyPath: 'id' });
      d.createObjectStore('photos');
    };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  }));
  const run = async (store, mode, fn) => {
    const d = await open();
    return new Promise((res, rej) => {
      const tx = d.transaction(store, mode);
      const out = fn(tx.objectStore(store));
      tx.oncomplete = () => res(out && 'result' in out ? out.result : undefined);
      tx.onerror = () => rej(tx.error);
      tx.onabort = () => rej(tx.error);
    });
  };
  return {
    kvGet: (k) => run('kv', 'readonly', (s) => s.get(k)),
    kvSet: (k, v) => run('kv', 'readwrite', (s) => { s.put(v, k); }),
    kvDel: (k) => run('kv', 'readwrite', (s) => { s.delete(k); }),
    sessionsAll: () => run('sessions', 'readonly', (s) => s.getAll()),
    sessionPut: (v) => run('sessions', 'readwrite', (s) => { s.put(v); }),
    sessionDel: (id) => run('sessions', 'readwrite', (s) => { s.delete(id); }),
    async photosAll() {
      const d = await open();
      return new Promise((res, rej) => {
        const out = {};
        const tx = d.transaction('photos', 'readonly');
        const c = tx.objectStore('photos').openCursor();
        c.onsuccess = () => { const cur = c.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } };
        tx.oncomplete = () => res(out);
        tx.onerror = () => rej(tx.error);
      });
    },
    photoPut: (id, v) => run('photos', 'readwrite', (s) => { s.put(v, String(id)); }),
    photoDel: (id) => run('photos', 'readwrite', (s) => { s.delete(String(id)); }),
    async clearAll() {
      for (const st of ['kv', 'sessions', 'photos']) await run(st, 'readwrite', (s) => { s.clear(); });
    },
  };
}

export function createStore(adapter) {
  return {
    async getPlan() {
      let p = await adapter.kvGet('plan');
      if (!p) { p = defaultPlan(); await adapter.kvSet('plan', p); }
      return p;
    },
    savePlan: (p) => adapter.kvSet('plan', p),
    async resetPlan() { const p = defaultPlan(); await adapter.kvSet('plan', p); return p; },
    listSessions: () => adapter.sessionsAll(),
    saveSession: (s) => adapter.sessionPut(s),
    deleteSession: (id) => adapter.sessionDel(id),
    getActive: () => adapter.kvGet('active'),
    saveActive: (a) => adapter.kvSet('active', a),
    clearActive: () => adapter.kvDel('active'),
    getMeta: async () => (await adapter.kvGet('meta')) || {},
    saveMeta: (m) => adapter.kvSet('meta', m),
    getPhotos: () => adapter.photosAll(),
    savePhoto: (id, d) => adapter.photoPut(id, d),
    deletePhoto: (id) => adapter.photoDel(id),
    /** Alles ersetzen (Import). */
    async replaceAll({ plan, sessions, photos }) {
      const meta = await adapter.kvGet('meta');
      await adapter.clearAll();
      if (meta) await adapter.kvSet('meta', meta);
      await adapter.kvSet('plan', plan);
      for (const s of sessions) await adapter.sessionPut(s);
      for (const [k, v] of Object.entries(photos || {})) await adapter.photoPut(k, v);
    },
    async wipe() { await adapter.clearAll(); },
  };
}
