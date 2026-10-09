import type { Plugin } from 'vite';
import { volumeOriginal } from '../workflows/volumes/volume-original.ts';
import { readSiteDiagnosticsRequest, siteDifference, siteLevels, siteRadial } from '../services/site-diagnostics.ts';

/** `/__nebula/volume-original?object=&dataset=`: a site volume dataset's registered original photograph; and
 * `/__nebula/site-levels` and `/__nebula/site-radial?kind=&object=&dataset=&picture=`: a site entry's photograph against
 * the bank's own far picture (site-diagnostics.ts). All read only. */
export function volumeOriginalPlugin(root: string): Plugin {
  return { name: 'nebula-volume-original', configureServer(server) {
    server.middlewares.use('/__nebula/site-difference', (request, response) => {
      void (async () => {
        try {
          if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new TypeError('Expected a local request.');
          const query = new URL(request.url ?? '', 'http://lab').searchParams, { png, summary } = await siteDifference(root, readSiteDiagnosticsRequest(query));
          response.statusCode = 200; response.setHeader('Cache-Control', 'no-store');
          if (query.get('format') === 'png') { response.setHeader('Content-Type', 'image/png'); response.end(png); }
          else { response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(summary)); }
        } catch (error) {
          response.statusCode = 400; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ error: String(error instanceof Error ? error.message : error) }));
        }
      })();
    });
    for (const [path, measure] of [['/__nebula/site-levels', siteLevels], ['/__nebula/site-radial', siteRadial]] as const)
      server.middlewares.use(path, (request, response) => {
        void (async () => {
          try {
            if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new TypeError('Expected a local request.');
            const body = await measure(root, readSiteDiagnosticsRequest(new URL(request.url ?? '', 'http://lab').searchParams));
            response.statusCode = 200; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(body));
          } catch (error) {
            response.statusCode = 400; response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({ error: String(error instanceof Error ? error.message : error) }));
          }
        })();
      });
    server.middlewares.use('/__nebula/volume-original', (request, response) => {
      void (async () => {
        const reply = (status: number, body: unknown) => { response.statusCode = status; response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store'); response.end(JSON.stringify(body)); };
        try {
          if (request.headers.origin && new URL(request.headers.origin).host !== request.headers.host) throw new TypeError('Expected a local request.');
          const query = new URL(request.url ?? '', 'http://lab').searchParams;
          // `probe=1` asks whether there is one: a dataset without a registered original is an answer, not an error.
          const probe = query.get('probe') === '1';
          try { reply(200, await volumeOriginal(root, query.get('object') ?? '', query.get('dataset') ?? '')); }
          catch (error) { if (!probe) throw error; reply(200, { missing: String(error instanceof Error ? error.message : error) }); }
        } catch (error) { reply(400, { error: String(error instanceof Error ? error.message : error) }); }
      })();
    });
  } };
}
