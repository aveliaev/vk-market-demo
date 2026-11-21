import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const sources = ['public/app.js', 'public/tour.js', 'public/protection.js', 'public/protection-model.js', 'public/vk-icons.js', 'public/style.css',
  'pages/client.js', 'pages/worker.js', 'market.mjs', 'public/index.html', 'pages/build.mjs'];
const hash = createHash('sha256');
for (const file of sources) hash.update(await readFile(file));
const version = hash.digest('hex').slice(0, 12);

await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
const html = (await readFile('public/index.html', 'utf8')).replace('<html lang="ru">', '<html lang="ru" data-hosting="pages">')
  .replace('./app.js', './app.js?v=' + version)
  .replace('./style.css', './style.css?v=' + version);
await writeFile('dist/index.html', html);
await writeFile('dist/.nojekyll', '');
await cp('pages/client.js', 'dist/pages-client.js');
for (const file of ['app.js', 'tour.js', 'protection.js', 'pages-client.js']) {
  const script = await readFile('dist/' + file, 'utf8');
  const versioned = script.replace(/(['"])(\.\/(?:tour|vk-icons|protection|protection-model|pages-client|market-worker)\.js)\1/g,
    (_, quote, path) => quote + path + '?v=' + version + quote);
  await writeFile('dist/' + file, versioned);
}
await cp(require.resolve('sql.js/dist/sql-wasm.wasm'), 'dist/sql-wasm.wasm');
const licenses = await Promise.all(['sql.js', '@noble/hashes'].map(async (name) =>
  name + '\n' + await readFile('node_modules/' + name + '/LICENSE', 'utf8')));
await writeFile('dist/THIRD-PARTY-LICENSES.txt', licenses.join('\n\n'));
await build({
  entryPoints: ['pages/worker.js'], outfile: 'dist/market-worker.js',
  format: 'esm', platform: 'browser', target: 'es2022', bundle: true, minify: true,
  external: ['fs', 'path', 'crypto'],
});
