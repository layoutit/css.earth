import { SOURCE_MANIFEST_SCHEMA } from '@cssearth/objects';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createSourceManifest } from '@cssearth/objects/node';

/** Bind synthetic files already written in a temporary test directory to the real source validator. */
export async function fixtureSource(sourceRoot: string, entries: readonly {
  path: string; id?: string; consumers: readonly string[]; [key: string]: unknown;
}[]) {
  const inputs = await Promise.all(entries.map(async (entry, index) => {
    const bytes = await readFile(resolve(sourceRoot, entry.path));
    return { id: `fixture-${index}`, origin: 'Generated unit-test input', credit: 'Authored fixture',
      license: 'CC0', acquisition: 'Generated in a temporary test directory', redistribution: 'Allowed',
      sourceBinding: { kind: 'local', reason: 'Synthetic unit-test input' }, ...entry, bytes: bytes.length };
  }));
  await writeFile(resolve(sourceRoot, 'manifest.json'), JSON.stringify({
    schema: SOURCE_MANIFEST_SCHEMA, inputs, documents: [], generatedIntermediates: [],
  }));
  return createSourceManifest({ objectId: 'fixture', objectName: 'Fixture', sourceRoot });
}
