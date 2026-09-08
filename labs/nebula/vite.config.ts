import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { tonePreparationPlugin } from './src/tone-preparation';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  plugins: [tonePreparationPlugin(repositoryRoot)],
  define: { __NEBULA_REPO_ROOT__: JSON.stringify(repositoryRoot) },
  server: { fs: { allow: [repositoryRoot] } },
});
