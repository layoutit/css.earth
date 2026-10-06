// Cloudflare's entry for the site: the built pages are the Worker's static assets, and this script answers only what a
// static file cannot. It is Netlify's edge router and its three functions (deploy/netlify/) in one place, calling the same
// handlers. deploy/cloudflare/bundle-worker.mts bundles it; deploy/cloudflare/wrangler.jsonc names the paths that skip it.
import searchRoute from '../../site/server/search-route.mts';
import { FIND_PATH } from '../../site/search/find-protocol.mts';
import { siteFetcher, useAssets, type Assets } from './assets.ts';
import { answerOrFallback } from './fallback.ts';
import { report } from '../handlers/report.ts';

interface Env { readonly ASSETS?: Assets }
/** The part of the runtime's request context the Worker uses. */
interface Context { waitUntil(work: Promise<unknown>): void }

const SEARCH_PATH = '/.netlify/functions/search', REPORT_PATH = '/.netlify/functions/report';
/** How long a reader waits for a page rendered for its query before the static page is sent instead. */
const PAGE_PATIENCE_MS = 10_000;

// The handlers load on their first request, not with the script: the page handler reads the whole world as it loads,
// and an address with no query never needs it.
async function find(request: Request): Promise<Response> {
  const [{ handleFindRequest }, { builtSearchData }, { FEATURE_PIN }] = await Promise.all([
    import('../../site/server/find.mts'), import('../../site/server/search-data.mts'), import('../../site/server/feature-pin.mts')]);
  return handleFindRequest(request, builtSearchData(FEATURE_PIN));
}
async function page(request: Request, assets: Assets): Promise<Response> {
  const [{ handleSearchRequest }, { builtSearchData }, { FEATURE_PIN }] = await Promise.all([
    import('../../site/server/search-response.mts'), import('../../site/server/search-data.mts'), import('../../site/server/feature-pin.mts')]);
  const origin = new URL(request.url).origin;
  return handleSearchRequest(request, builtSearchData(FEATURE_PIN), siteFetcher(origin, assets));
}

/** A handler's first request loads data the instance keeps for every later one (the world, the search catalogues), and
 * the runtime drops a request's work when its reader leaves. The work is held until it settles, so a load a later
 * request is waiting on is never left unfinished. */
function held(context: Context, answer: Promise<Response>): Promise<Response> {
  context.waitUntil(answer.then(() => undefined, () => undefined));
  return answer;
}

/** The page rendered for its query, or the static page when the handler fails or has no answer in time. The static page
 * is the same page before its query is applied: its scripts read a view, dataset or feature from the address, and a
 * submitted search (`q`) or a reader without scripts gets the page unrendered. The Worker's log says why. */
function rendered(request: Request, route: URL, assets: Assets, context: Context): Promise<Response> {
  const answer = held(context, page(new Request(route, { method: request.method, headers: request.headers }), assets));
  return answerOrFallback(answer, () => assets.fetch(request), PAGE_PATIENCE_MS, reason => {
    const { pathname, search } = new URL(request.url);
    console.error(`page-handler-fallback ${JSON.stringify({ address: (pathname + search).slice(0, 300), reason: reason.slice(0, 500) })}`);
  });
}

export default {
  async fetch(request: Request, env: Env, context: Context): Promise<Response> {
    const assets = useAssets(env.ASSETS);
    const url = new URL(request.url);
    // The site has one address: `www.` answers with a move to it, as Netlify's primary domain did.
    if (url.hostname.startsWith('www.')) { url.hostname = url.hostname.slice(4); return Response.redirect(url.href, 301); }
    if (url.pathname === FIND_PATH) return held(context, find(request));
    if (url.pathname === REPORT_PATH) return report(request);
    const route = url.pathname === SEARCH_PATH ? url : searchRoute(request);
    if (route) return rendered(request, route, assets, context);
    return assets.fetch(request);
  },
};
