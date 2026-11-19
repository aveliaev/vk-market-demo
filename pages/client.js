const worker = new Worker(new URL('./market-worker.js', import.meta.url), { type: 'module' });
const pending = new Map();
let sequence = 0;
let failed = false;

worker.onmessage = ({ data }) => {
  const request = pending.get(data.id);
  if (!request) return;
  pending.delete(data.id);
  if (data.error) request.reject(new Error(data.error));
  else request.resolve(data.result);
};
worker.onerror = () => {
  failed = true;
  for (const request of pending.values()) request.reject(new Error('Не удалось загрузить демо. Обновите страницу.'));
  pending.clear();
};

export function request(path, body) {
  if (failed) return Promise.reject(new Error('Обновите страницу, чтобы загрузить демо.'));
  const id = ++sequence;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, path, body });
  });
}
