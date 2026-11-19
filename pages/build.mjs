import { build } from 'esbuild';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

await mkdir('dist', { recursive: true });
await cp('public', 'dist', { recursive: true });
const html = (await readFile('public/index.html', 'utf8')).replace('<html lang="ru">', '<html lang="ru" data-hosting="pages">');
await writeFile('dist/index.html', html);
await writeFile('dist/.nojekyll', '');
await cp('pages/client.js', 'dist/pages-client.js');
await cp(require.resolve('sql.js/dist/sql-wasm.wasm'), 'dist/sql-wasm.wasm');
const licenses = await Promise.all(['sql.js', '@noble/hashes'].map(async (name) =>
  name + '\n' + await readFile('node_modules/' + name + '/LICENSE', 'utf8')));
await writeFile('dist/THIRD-PARTY-LICENSES.txt', licenses.join('\n\n'));
await build({
  entryPoints: ['pages/worker.js'], outfile: 'dist/market-worker.js',
  format: 'esm', platform: 'browser', target: 'es2022', bundle: true, minify: true,
  external: ['fs', 'path', 'crypto'],
});
