import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
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

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  plugins: [tonePreparationPlugin(repositoryRoot), cloudDensityPreparationPlugin(repositoryRoot), starRemovalPlugin(repositoryRoot), reconstructionPlugin(repositoryRoot), shapeCloudPlugin(repositoryRoot), geometryDetectionPlugin(repositoryRoot), evidenceFusionPlugin(repositoryRoot), kinematicsPlugin(repositoryRoot), jointFitPlugin(repositoryRoot), compilerPlugin(repositoryRoot)],
  define: { __NEBULA_REPO_ROOT__: JSON.stringify(repositoryRoot) },
  server: { fs: { allow: [repositoryRoot] } },
});
