import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const page = new URL('./index.html', import.meta.url);
const bundle = await build({ entryPoints: [fileURLToPath(new URL('./drag-enhancement.mts', import.meta.url))],
  bundle: true, format: 'iife', write: false, target: 'es2022' });
const script = bundle.outputFiles[0].contents;
createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://127.0.0.1:4351');
  if (url.pathname === '/drag-enhancement.js') {
    response.writeHead(200, { 'content-type': 'text/javascript', 'cache-control': 'no-cache' }); response.end(script); return;
  }
  void readFile(page, 'utf8').then(source => {
    const enhanced = url.searchParams.get('input') === 'js';
    const containment = url.searchParams.get('contain');
    const markup = ['size', 'strict'].includes(containment ?? '') ? source.replace('<body>', `<body class="${containment}-contained">`) : source;
    const html = enhanced ? markup.replace("content=\"script-src 'none'\"", "content=\"script-src 'self'\"")
      .replace('CSS INPUT EXPERIMENT · SCRIPTS BLOCKED', 'SAME SCENE · JS INPUT BENCHMARK')
      .replace('</body>', '<script src="/drag-enhancement.js"></script></body>') : markup;
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8',
      'content-security-policy': enhanced ? "script-src 'self'" : "script-src 'none'", 'cache-control': 'no-cache' }); response.end(html);
  }).catch(error => { response.writeHead(500); response.end(String(error)); });
}).listen(4351, '127.0.0.1', () => console.log('Native resize study: http://127.0.0.1:4351/'));
