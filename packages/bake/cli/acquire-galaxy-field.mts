// Entry script: `pnpm prepare:galaxy-field:data` (first step). Restores the pinned galaxy-field catalogues, trying the
// project's source mirror before VizieR. The work is in @cssearth/bake/galaxy-field.
import { resolve } from 'node:path';
import { acquireGalaxyFieldSources } from '@cssearth/bake/galaxy-field';
import { RUNTIME_ASSET_ORIGIN } from '@cssearth/bake/objects/sources';

await acquireGalaxyFieldSources({ root: resolve(import.meta.dirname, '../../..'), mirrorOrigin: RUNTIME_ASSET_ORIGIN });
