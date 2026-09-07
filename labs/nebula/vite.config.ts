import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: false,
  define: { __NEBULA_REPO_ROOT__: JSON.stringify(repositoryRoot) },
  server: { fs: { allow: [repositoryRoot] } },
});
