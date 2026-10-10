import { isRecord } from '@cssearth/core';
import type { ServerResponse } from 'node:http';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';
import { configuredPlateObjects } from '../workflows/plates/bake.ts';
import { objectIdOf } from '../workflows/plates/object-bake.ts';
import { readRegions, saveRegions } from '../workflows/plates/regions.ts';

/** `/__nebula/regions`: GET `?object=` returns the picture's address and size and its regions; POST { object, regions }
 * saves them. The same functions as the CLI's `regions`. */
export function regionsPlugin(root: string): Plugin {
  return { name: 'nebula-regions', configureServer(server) {
    const configured = configuredPlateObjects(root);
    const reply = (response: ServerResponse, status: number, body: unknown) => {
      response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(body));
    };
    const known = (object: unknown) => { if (typeof object !== 'string' || !configured.includes(object)) throw new TypeError('Name a configured published-plates object.'); return objectIdOf(object); };
    server.middlewares.use('/__nebula/regions', (request, response) => {
      void (async () => {
        try {
          if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new TypeError('Expected a local request.');
          if (request.method === 'POST') {
            let text = ''; for await (const chunk of request) { text += String(chunk); if (text.length > 1 << 22) throw new TypeError('Regions are too large.'); }
            const body: unknown = JSON.parse(text);
            if (!isRecord(body)) throw new TypeError('POST { object, regions }.');
            reply(response, 200, { saved: (await saveRegions(root, known(body.object), body.regions)).length }); return;
          }
          const id = known(new URL(request.url ?? '', 'http://lab').searchParams.get('object')), regions = await readRegions(root, id);
          reply(response, 200, { image: `/@fs${resolve(root, 'src/objects', id, 'source', regions.picture)}`, width: regions.width, height: regions.height, regions: regions.regions });
        } catch (error) { reply(response, 400, { error: String(error instanceof Error ? error.message : error) }); }
      })();
    });
  } };
}
