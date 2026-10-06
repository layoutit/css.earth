/** The project files the page handler reads as it loads (site/directory/world-context-plan.mts), as paths from the project root;
 * `*` stands for each object id. The Worker has no disk: deploy/cloudflare/bundle-worker.mts writes these into its script. */
export const WORKER_PROJECT_FILES: readonly string[] = ['src/objects/observable-universe/prepared/world.json',
  'src/objects/observable-universe/prepared/world-index.json', 'src/objects/*/prepared/members.json', 'src/objects/*/prepared/places.json'];
