// `CSSEARTH_BUILD_PAGES=/,/earth/ astro build`: a production build that prerenders only the named object pages and the
// scene routes they mount, for a cold test that opens a few pages, not all of them. Unset, every route builds as before.

/** What a page needs of an `OBJECTS` entry: a scene mounts itself; anything else mounts its host scene. */
interface PageObject { readonly id: string; readonly kind: string; readonly sceneHostId?: string }
interface IdPath { readonly params: { readonly id: string } }

/** The page paths `CSSEARTH_BUILD_PAGES` names (`/` and `/<id>/`, comma-separated), or null when every page builds. */
export function namedPages(env: NodeJS.ProcessEnv = process.env): ReadonlySet<string> | null {
  const value = env.CSSEARTH_BUILD_PAGES?.trim();
  if (!value) return null;
  const pages = new Set<string>();
  for (const entry of value.split(',').map(part => part.trim()).filter(Boolean)) {
    if (!/^\/(?:[^/\s]+\/)?$/u.test(entry)) {
      throw new TypeError(`CSSEARTH_BUILD_PAGES: "${entry}" is not a page path; write "/" or "/<id>/", comma-separated.`);
    }
    pages.add(entry);
  }
  if (!pages.size) throw new TypeError('CSSEARTH_BUILD_PAGES names no page; write "/" or "/<id>/", comma-separated.');
  return pages;
}

/** The objects whose pages a build prerenders, or null for all. A name that is not an object's page stops the build. */
function namedObjects(objects: readonly PageObject[], env: NodeJS.ProcessEnv): readonly PageObject[] | null {
  const pages = namedPages(env);
  if (!pages) return null;
  const byPage = new Map(objects.map(object => [`/${object.id}/`, object]));
  const unknown = [...pages].filter(page => page !== '/' && !byPage.has(page));
  if (unknown.length) throw new TypeError(`CSSEARTH_BUILD_PAGES names pages no object has: ${unknown.join(', ')}.`);
  return [...pages].flatMap(page => byPage.get(page) ?? []);
}

/** The `/<id>/` routes a build prerenders: all of them, or the named ones. */
export function builtObjectPages<Path extends IdPath>(paths: Path[], objects: readonly PageObject[],
  env: NodeJS.ProcessEnv = process.env): Path[] {
  const named = namedObjects(objects, env);
  if (!named) return paths;
  const ids = new Set(named.map(object => object.id));
  return paths.filter(path => ids.has(path.params.id));
}

/** The per-scene routes (navigation fragment, first view, prepared object) a build prerenders: all of them, or those of
 * the scenes the named pages mount. `/` mounts the root object's scene. */
export function builtScenePaths<Path extends IdPath>(paths: Path[], objects: readonly PageObject[], rootId: string,
  env: NodeJS.ProcessEnv = process.env): Path[] {
  const named = namedObjects(objects, env);
  if (!named) return paths;
  const root = objects.find(object => object.id === rootId);
  if (!root) throw new TypeError(`The root object ${rootId} is not in OBJECTS.`);
  const scene = (object: PageObject) => (object.kind === 'scene' ? object.id : object.sceneHostId);
  const mounted = new Set([...named, ...(namedPages(env)?.has('/') ? [root] : [])].map(scene));
  return paths.filter(path => mounted.has(path.params.id));
}
