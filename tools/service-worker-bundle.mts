import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import type { AstroIntegration } from 'astro';
import { build } from 'esbuild';

const ENTRY = fileURLToPath(new URL('../site/service-worker/worker.mts', import.meta.url));

export async function bundleServiceWorker({ minify }: { minify: boolean }): Promise<string> {
  const result = await build({
    entryPoints: [ENTRY], bundle: true, format: 'iife', target: 'es2022',
    minify, write: false, legalComments: 'none',
  });
  const [output] = result.outputFiles;
  if (!output) throw new Error('The service worker bundle produced no output.');
  return output.text;
}

// Serves /sw.js from the typed worker source in development and writes it
// beside the pages at build time. The worker is never committed as JavaScript.
export function serviceWorker(): AstroIntegration {
  return {
    name: 'cssearth-service-worker',
    hooks: {
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((request, response, next) => {
          if (request.url !== '/sw.js') return next();
          bundleServiceWorker({ minify: false }).then(code => {
            response.setHeader('content-type', 'text/javascript; charset=utf-8');
            response.setHeader('cache-control', 'no-cache');
            response.end(code);
          }, next);
        });
      },
      'astro:build:done': async ({ dir }) => {
        await writeFile(new URL('sw.js', dir), await bundleServiceWorker({ minify: true }));
      },
    },
  };
}
