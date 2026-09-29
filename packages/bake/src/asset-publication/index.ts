// `@cssearth/bake/asset-publication` (Node only): the maintainer and CI commands around the runtime asset host. Staging a
// pull request's baked bytes against its frozen inventories, publishing the inventoried files (HEAD, bulk upload of the misses,
// verification), the published-asset gate, the deploy check that a built site references only inventoried and published assets,
// and the dry-run report of keys nothing inventories any more; and restoring a checkout from the host: the inventoried files
// (`setup-assets.ts`, with the object JSON a restored body derives), each body's pinned object JSON from its
// restored runtime (`restore-object-json.ts`) and each body's declared source inputs (`restore-source-inputs.ts`). It imports
// `delivery`, `contract`, `objects/sources` and the volume bakes (`volume`, `density`, `sky`); the deploy
// check reads the renderer's prepared world-context parsers. `r2-cors.json` is the asset bucket's CORS policy.
export * from './check-assets-published.ts';
export * from './check-deploy-assets.ts';
export * from './prune-runtime-assets.ts';
export * from './publish-runtime-assets.ts';
export * from './stage-published-assets.ts';
export * from './setup-assets.ts';
export * from './restore-object-json.ts';
export * from './restore-source-inputs.ts';
