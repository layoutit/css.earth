import type { Connect, Plugin } from 'vite';
import searchRoute from '../../netlify/edge-functions/search-route.ts';
import { handleSearchRequest } from '../../site/search-response.mts';

/** Exercise Netlify's exact routing and handler in Astro dev and static preview. */
export function searchServer(): Plugin {
  const middleware: Connect.NextHandleFunction = (request, response, next) => {
    if (!request.url || !request.headers.host) return next();
    const url = new URL(request.url, `http://${request.headers.host}`);
    const route = searchRoute(new Request(url));
    if (!route) return next();
    void handleSearchRequest(new Request(route, { method: request.method })).then(async result => {
      response.writeHead(result.status, Object.fromEntries(result.headers));
      response.end(Buffer.from(await result.arrayBuffer()));
    }).catch(next);
  };
  return { name: 'cssearth-native-search', configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); } };
}
