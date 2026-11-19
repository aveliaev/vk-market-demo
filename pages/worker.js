import initSqlJs from 'sql.js';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha256';
import { createMarket } from '../market.mjs';

const runtime = initSqlJs({ locateFile: (file) => new URL(file, import.meta.url).href });
const storage = new Promise((resolve, reject) => {
  const open = indexedDB.open('vk-market-demo:' + new URL('.', import.meta.url).pathname, 1);
  open.onupgradeneeded = () => open.result.createObjectStore('state');
  open.onsuccess = () => resolve(open.result);
  open.onerror = () => reject(open.error);
});

function adapter(db) {
  function rows(sql, args, one) {
    const statement = db.prepare(sql);
    try {
      statement.bind(args);
      if (one) return statement.step() ? statement.getAsObject() : undefined;
      const result = [];
      while (statement.step()) result.push(statement.getAsObject());
      return result;
    } finally {
      statement.free();
    }
  }
  return {
    exec: (sql) => db.exec(sql),
    prepare: (sql) => ({
      run: (...args) => db.run(sql, args),
      get: (...args) => rows(sql, args, true),
      all: (...args) => rows(sql, args, false),
    }),
  };
}

const secret = crypto.getRandomValues(new Uint8Array(32));
const cryptoTools = {
  randomUUID: () => crypto.randomUUID(),
  makeToken: () => crypto.randomUUID().replaceAll('-', ''),
  signature: (raw) => hmac(sha256, secret, new TextEncoder().encode(raw)),
  timingSafeEqual(a, b) {
    if (a.length !== b.length) return false;
    let difference = 0;
    for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
    return difference === 0;
  },
};

async function dispatch(path, body) {
  const [SQL, database] = await Promise.all([runtime, storage]);
  // A single IndexedDB transaction serializes updates even across browser tabs.
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('state', 'readwrite');
    const store = transaction.objectStore('state');
    const snapshot = store.get('database');
    let result;
    let failure;
    snapshot.onsuccess = () => {
      let db;
      try {
        db = new SQL.Database(snapshot.result);
        const market = createMarket(adapter(db), cryptoTools);
        result = market.request(body === undefined ? 'GET' : 'POST', '/api/' + path, body ?? {}, 'local-demo');
        store.put(db.export(), 'database');
      } catch (error) {
        failure = error;
        transaction.abort();
      } finally {
        db?.close();
      }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(failure || transaction.error || new Error('Не удалось сохранить изменения.'));
  });
}

self.onmessage = async ({ data: { id, path, body } }) => {
  try {
    self.postMessage({ id, result: await dispatch(path, body) });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
