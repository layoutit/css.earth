/** Standalone source tests read fresh prepack-owned data through an isolated package resolver. */
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { prepareDiscoveryPackageData } from './package-data.mts';

export async function prepareStandaloneData(checkout: string): Promise<{ script: string; cleanup: () => Promise<void> }> {
  const directory = await mkdtemp(resolve(tmpdir(), 'telescope-standalone-data-'));
  const cleanup = () => rm(directory, { recursive: true, force: true });
  try {
    await prepareDiscoveryPackageData(checkout, resolve(checkout, 'packages/telescope-cli'), directory);
    const manifest = resolve(directory, 'package.json');
    await writeFile(manifest, JSON.stringify({ name: '@cssearth/telescope', type: 'module' }) + '\n');
    // Redirect only the package identity. Its real path selection and data readers still run.
    const script = `
      const { mock } = await import('node:test');
      const nodeModule = await import('node:module');
      mock.module('node:module', { namedExports: { ...nodeModule, createRequire: url => {
        const require = nodeModule.createRequire(url);
        const resolve = require.resolve.bind(require);
        require.resolve = (name, options) => name === '@cssearth/telescope/package.json'
          ? ${JSON.stringify(manifest)} : resolve(name, options);
        return require;
      } } });
    `;
    return { script, cleanup };
  } catch (error) { await cleanup(); throw error; }
}
