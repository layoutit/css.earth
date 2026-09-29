import { pathToFileURL } from 'node:url';
import { projectRoot } from '@cssearth/core/node';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '@cssearth/objects/node/source-test';
const test = sourceTest();
import { requireDescriptorAdapterSource } from '@cssearth/bake/contract';

test('the descriptor transport reads the complete object or, adopting its page, the first-view transport, and nothing else', async () => {
  const source = await readFile(new URL('site/packaged-object-runtime.mts', pathToFileURL(projectRoot(import.meta.url) + "/")), 'utf8');
  assert.doesNotThrow(() => requireDescriptorAdapterSource(source, 'loadPackagedObject'));
  for (const changed of [
    source.replace('PREPARED_NAVIGATION_MARKERS[descriptorInput.id]?.context?.pixels', '240'),
    source.replace('PREPARED_NAVIGATION_MARKERS[descriptorInput.id]?.context?.pixels', 'PREPARED_NAVIGATION_MARKERS[other.id]?.context?.pixels'),
    source.replace("? 'first-view' : 'object'", "? 'full' : 'object'"),
    source.replace("${adoptsServerMarkup(descriptorInput.id) ? 'first-view' : 'object'}.json", 'object.json'),
    source.replace('adoptsServerMarkup(descriptorInput.id) ?', 'Math.random() > .5 ?'),
  ]) {
    assert.notEqual(changed, source);
    assert.throws(() => requireDescriptorAdapterSource(changed, 'loadPackagedObject'), /must forward its prepared transport/);
  }
});
