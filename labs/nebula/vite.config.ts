import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { tonePreparationPlugin } from './src/viewer/tone-preparation';
import { cloudDensityPreparationPlugin } from './src/density/cloud-density-preparation';
import { starRemovalPlugin } from './src/star-removal/star-removal-preparation';
import { reconstructionPlugin } from './src/reconstruction/reconstruction-preparation';
import { shapeCloudPlugin } from './src/reconstruction/shape-cloud/server';
import { geometryDetectionPlugin } from './src/reconstruction/geometry/server';
import { evidenceFusionPlugin } from './src/reconstruction/evidence-fusion/server';
import { kinematicsPlugin } from './src/reconstruction/kinematics/server';
import { jointFitPlugin } from './src/reconstruction/joint-fit/server';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  plugins: [tonePreparationPlugin(repositoryRoot), cloudDensityPreparationPlugin(repositoryRoot), starRemovalPlugin(repositoryRoot), reconstructionPlugin(repositoryRoot), shapeCloudPlugin(repositoryRoot), geometryDetectionPlugin(repositoryRoot), evidenceFusionPlugin(repositoryRoot), kinematicsPlugin(repositoryRoot), jointFitPlugin(repositoryRoot)],
  define: { __NEBULA_REPO_ROOT__: JSON.stringify(repositoryRoot) },
  server: { fs: { allow: [repositoryRoot] } },
});
