import { createMarket, ApiError, requireThat } from './market.mjs';
import { createServer } from 'node:http';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile } from 'node:fs/promises';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const root = dirname(fileURLToPath(import.meta.url));
const dataFile = process.env.VK_DEMO_DB || resolve(root, 'data/vk-demo.sqlite');
if (dataFile !== ':memory:') await mkdir(dirname(dataFile), { recursive: true });
const db = new DatabaseSync(dataFile);
const signedKey = randomBytes(32);
const market = createMarket(db, {
  randomUUID, timingSafeEqual,
  makeToken: () => randomBytes(18).toString('base64url'),
  signature: (raw) => createHmac('sha256', signedKey).update(raw).digest(),
});

const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.png': 'image/png' };
const publicFiles = new Set(['/index.html', '/app.js', '/style.css', '/assets/vk.svg', '/assets/chevron.svg', '/assets/friends-choice.png', ...market.productIds.map((id) => '/assets/' + id + '.webp')]);

async function handle(request, response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Cache-Control', 'no-store');
  const host = request.headers.host;
  requireThat(/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host ?? ''), 'Сервис доступен локально.', 403);
  const url = new URL(request.url, 'http://' + host);
  let buyer = request.headers.cookie?.match(/(?:^|;\s*)vk_demo_buyer=([a-f0-9]{48})(?:;|$)/)?.[1];
  if (!buyer) {
    buyer = randomBytes(24).toString('hex');
    response.setHeader('Set-Cookie', 'vk_demo_buyer=' + buyer + '; Path=/; Max-Age=31536000; HttpOnly; SameSite=Strict');
  }
  if (url.pathname.startsWith('/api/')) {
    if (request.method === 'POST') {
      requireThat(!request.headers.origin || request.headers.origin === url.origin, 'Источник запроса не совпал.', 403);
      requireThat(request.headers['content-type']?.startsWith('application/json'), 'Ожидается JSON.', 415);
    }
    const chunks = [];
    let bytes = 0;
    for await (const chunk of request) {
      bytes += chunk.length;
      requireThat(bytes <= 16384, 'Запрос слишком большой.', 413);
      chunks.push(chunk);
    }
    let body;
    try {
      body = bytes ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {};
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw Error();
    } catch {
      throw new ApiError(400, 'Не удалось прочитать запрос.');
    }
    const data = market.request(request.method, url.pathname, body, buyer);
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(data));
    return;
  }
  requireThat(['GET', 'HEAD'].includes(request.method), 'Метод недоступен.', 405);
  const file = url.pathname === '/' ? '/index.html' : url.pathname;
  requireThat(publicFiles.has(file), 'Файл не найден.', 404);
  const data = await readFile(resolve(root, 'public' + file)).catch(() => { throw new ApiError(404, 'Файл не найден.'); });
  response.writeHead(200, {
    'Content-Type': contentTypes[extname(file)],
    'Content-Security-Policy': "default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  });
  response.end(request.method === 'HEAD' ? undefined : data);
}

const port = Number(process.env.PORT ?? 4173);
const server = createServer((request, response) => {
  handle(request, response).catch((error) => {
    if (response.headersSent) return response.destroy();
    if (!error.status) console.error(error);
    response.writeHead(error.status ?? 500, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: error.status ? error.message : 'Ошибка сервера.' }));
  });
});
setInterval(() => {
  try {
    market.processJobs();
  } catch (error) {
    console.error('Не удалось обработать событие тестового партнёра.', error);
  }
}, 1000).unref();
server.listen(port, '127.0.0.1', () => console.log('MVP открыт на http://127.0.0.1:' + server.address().port));
