/** The Worker's static assets binding (deploy/cloudflare/wrangler.jsonc `assets.binding`): the built site, read without a network hop. */
export interface Assets { fetch(input: Request | URL | string, init?: RequestInit): Promise<Response> }

let bound: Assets | undefined;

/** Keeps the binding the runtime hands each request, for the modules that read the built site in place of a disk. */
export function useAssets(assets: Assets | undefined): Assets {
  if (typeof assets?.fetch !== 'function') throw new TypeError('The Worker has no ASSETS binding; deploy/cloudflare/wrangler.jsonc `assets.binding` must name it.');
  return bound = assets;
}

/** One built file's JSON, by its site path. */
export async function readAssetJson(path: string): Promise<unknown> {
  if (!bound) throw new Error(`The Worker read ${path} before a request bound its assets.`);
  // The binding reads a path; the host is never contacted.
  const response = await bound.fetch(new URL(path, 'https://assets.invalid'));
  if (!response.ok) throw new Error(`The Worker's assets hold no ${path} (HTTP ${response.status}); deploy/cloudflare/bundle-worker.mts stages what the handlers read.`);
  return response.json();
}

/** The fetch the page handler reads with: the static page and its dataset files from this site's assets, and published
 * files from the asset origin. The handler refuses redirects (`redirect: 'error'`), a mode the Workers runtime does not
 * have: the redirect is asked for as a response and refused here. */
export function siteFetcher(origin: string, assets: Assets, outside: typeof fetch = (input, init) => fetch(input, init)): typeof fetch {
  return async (input, init) => {
    const refuses = init?.redirect === 'error';
    const wanted = new Request(input, refuses ? { ...init, redirect: 'manual' } : init);
    const response = await (new URL(wanted.url).origin === origin ? assets.fetch(wanted) : outside(wanted));
    if (refuses && response.status >= 300 && response.status < 400) throw new TypeError(`${wanted.url} answered with a redirect (HTTP ${response.status}), which the request refuses.`);
    return response;
  };
}
