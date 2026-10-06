/** The project files the page function reads as it loads (site/directory/world-context-plan.mts), as paths from the project root;
 * `*` stands for each object id. A deployed function holds only what its host is given: Netlify's `included_files`
 * (netlify.toml, checked by bundle-netlify-functions.mts) and the Cloudflare Worker's bundle
 * (bundle-cloudflare-worker.mts) each carry these. */
export const FUNCTION_PROJECT_FILES: readonly string[] = ['src/objects/observable-universe/prepared/world.json',
  'src/objects/observable-universe/prepared/world-index.json', 'src/objects/*/prepared/members.json', 'src/objects/*/prepared/places.json'];
