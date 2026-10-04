import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireRecord } from '@cssearth/core';
import { projectRoot } from '@cssearth/core/node';
import type { OracleInputResolver } from '@cssearth/core/oracle';
const ORACLE_ROOT = projectRoot(typeof __filename === 'string' ? pathToFileURL(__filename) : import.meta.url);
import { fitsOracleInputResolvers } from '@cssearth/fits/node';

export function bakeOracleInputResolvers(): OracleInputResolver[] {
  return [
    { id: 'bake-fixtures', accepts: path => /^packages\/bake\/src\/(?:[a-z0-9-]+\/)*fixtures\/[A-Za-z0-9_/-]+\.(?:fits|json|sum|tab)$/u.test(path), verify: async () => {} },
    { id: 'body-sources', accepts: path => /^src\/objects\/[^/]+\/source\/.+/u.test(path), verify: async input => {
      const match = /^src\/objects\/([^/]+)\/source\/(.+)$/u.exec(input.path)!;
      const manifest = requireRecord(JSON.parse(await readFile(resolve(ORACLE_ROOT, 'src/objects', match[1]!, 'source/manifest.json'), 'utf8')));
      const entry = [...requireArray(manifest.inputs), ...requireArray(manifest.documents)].map(e => requireRecord(e)).find(e => e.path === match[2]);
      if (!entry) throw new Error(`Oracle input is not a manifest input or document: ${input.path}`);
    } },
    { id: 'kernel-banks', accepts: path => /^src\/spice\/([a-z][a-z0-9-]*)\/(.+)$/u.test(path), verify: async (input, verifier) => {
      const match = /^src\/spice\/([a-z][a-z0-9-]*)\/(.+)$/u.exec(input.path)!;
      if (!verifier) throw new Error('Kernel oracle inputs require the caller bank verifier.');
      // A conformance test reads restored inputs; absence must not trigger acquisition.
      await readFile(resolve(ORACLE_ROOT, input.path));
      await verifier(match[1]!, [match[2]!]);
    } },
  ];
}
export async function setupBakeOracleInputs() {
  const { setupOracleInputResolvers } = await import('@cssearth/core/oracle');
  setupOracleInputResolvers('fits', fitsOracleInputResolvers());
  setupOracleInputResolvers('bake', bakeOracleInputResolvers());
}
