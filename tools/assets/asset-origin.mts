/** Shared asset host; importing this must not load the generated site catalogue. Its one definition is the source mirror's
 * in `@cssearth/bake/objects/sources`; the asset tools read it here, where their fixture tests point it at a local server. */
export { RUNTIME_ASSET_ORIGIN } from '@cssearth/bake/objects/sources';
