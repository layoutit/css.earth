import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vite';
import { tonePreparationPlugin } from './packages/lab/src/server/services/tone.ts';
import { cloudDensityPreparationPlugin } from './packages/lab/src/server/services/density-material.ts';
import { starRemovalPlugin } from './packages/lab/src/server/services/star-removal.ts';
import { reconstructionPlugin } from './packages/lab/src/server/services/density-reconstruction.ts';
import { shapeCloudPlugin } from './packages/lab/src/server/routes/shape-cloud.ts';
import { geometryDetectionPlugin } from './packages/lab/src/server/routes/geometry.ts';
import { evidenceFusionPlugin } from './packages/lab/src/server/routes/evidence-fusion.ts';
import { kinematicsPlugin } from './packages/lab/src/server/routes/kinematics.ts';
import { compilerPlugin } from './packages/lab/src/server/routes/compiler.ts';
import { jointFitPlugin } from './packages/lab/src/server/routes/joint-fit.ts';
import { platesPlugin } from './packages/lab/src/server/routes/plates.ts';
import { volumeOriginalPlugin } from './packages/lab/src/server/routes/volume-original.ts';
import { labObjectPlugin } from './packages/lab/src/server/routes/lab-object.ts';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

/** The browser reads workspace packages from their sources, never their `dist`: a bake first rebuilds every changed package
 * (`packages/bake/cli/check-stale-builds.mts --run`), and tsup empties `dist` and renames its chunks. Served from `dist`,
 * that would reload the page mid-bake and leave cached modules importing deleted chunks. `dist/<entry>.js` maps to
 * `src/<entry>.ts` or `src/<entry>/index.ts`, the layout every package's tsup entries follow. */
function workspaceSourcesPlugin(): Plugin {
  const dist = /^(.*\/packages\/[^/]+)\/dist\/(.+)\.js$/u;
  return {
    name: 'nebula-lab-workspace-sources', enforce: 'pre',
    async resolveId(id, importer, options) {
      if (options.ssr || !id.startsWith('@cssearth/')) return null;
      const resolved = await this.resolve(id, importer, { ...options, skipSelf: true });
      const match = resolved && dist.exec(resolved.id.split('?')[0]!);
      if (!match) return resolved;
      const [, base, entry] = match;
      for (const candidate of [`${base}/src/${entry}.ts`, `${base}/src/${entry}/index.ts`]) if (existsSync(candidate)) return candidate;
      return resolved;
    },
  };
}

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  plugins: [workspaceSourcesPlugin(), tonePreparationPlugin(repositoryRoot), cloudDensityPreparationPlugin(repositoryRoot), starRemovalPlugin(repositoryRoot), reconstructionPlugin(repositoryRoot), shapeCloudPlugin(repositoryRoot), geometryDetectionPlugin(repositoryRoot), evidenceFusionPlugin(repositoryRoot), kinematicsPlugin(repositoryRoot), jointFitPlugin(repositoryRoot), compilerPlugin(repositoryRoot), platesPlugin(repositoryRoot), volumeOriginalPlugin(repositoryRoot), labObjectPlugin(repositoryRoot)],
  define: { __NEBULA_REPO_ROOT__: JSON.stringify(repositoryRoot),
    __NEBULA_SOURCE_CATALOGUE_URL__: JSON.stringify(new URL('./packages/lab/sources/index.json', import.meta.url).href) },
  // Objects' recipes, descriptors and prepared files are data the lab edits and bakes, and a bake rebuilds the workspace
  // packages' `dist`: a change to any of them must not reload the page.
  server: { fs: { allow: [repositoryRoot] }, watch: { ignored: ['**/src/objects/*/source/**', '**/src/objects/*/prepared/**', '**/src/objects/*/object.json', '**/src/objects/*/inventory.json', '**/site/public/scenes/**', '**/.local/**', '**/packages/*/dist/**'] } },
});
