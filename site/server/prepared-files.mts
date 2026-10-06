import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

const TYPES: Readonly<Record<string, string>> = { '.json': 'application/json', '.bin': 'application/octet-stream', '.webp': 'image/webp',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };
const PREPARED = /^\/src\/objects\/[a-z0-9-]+\/prepared\/[A-Za-z0-9@._/-]+$/u;

/** A build without ASSET_ORIGIN names context objects' prepared files by their checkout path
 * (site/build/prepare/catalog/prepare-catalog.mts, contextObjectAssetUrls), which the dev server serves from the project root.
 * The static preview serves the same paths, so a local performance build loads them as dev does. */
export function preparedFiles(root: string): Plugin {
  const objects = resolve(root, 'src/objects');
  return { name: 'cssearth-prepared-files', configurePreviewServer(server) {
    server.middlewares.use((request, response, next) => {
      const path = decodeURIComponent((request.url ?? '').split('?')[0]!);
      if (!PREPARED.test(path) || path.includes('..')) { next(); return; }
      const file = resolve(root, path.slice(1));
      if (!file.startsWith(objects + sep)) { next(); return; }
      stat(file).then(info => {
        if (!info.isFile()) { next(); return; }
        response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Content-Length': info.size });
        createReadStream(file).pipe(response);
      }, () => next());
    });
  } };
}
