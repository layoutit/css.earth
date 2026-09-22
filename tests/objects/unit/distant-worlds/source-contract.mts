import { sourceTest } from '../../source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { parseSourceManifest, verifySources } from '../../../../tools/objects/dist/operations.js';

// Each destination remains independently discoverable by the generic object
// test runner. Verify actual source bytes through the shared package contract.
export function testDistantWorldSources(id: string|undefined) {
  test(`${id}: every declared source retains its pinned bytes`, async () => {
    const source = new URL(`../../../../src/objects/${id}/source/`, import.meta.url);
    const manifest = parseSourceManifest(JSON.parse(await readFile(new URL('manifest.json', source), 'utf8')), id);
    await verifySources({ sourceRoot: fileURLToPath(source), manifest });
  });
}
