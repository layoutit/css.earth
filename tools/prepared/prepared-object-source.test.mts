import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { requireDescriptorAdapterSource } from './prepared-object-source.mts';

test('the descriptor transport reads the complete object or, adopting its page, the first-view transport, and nothing else', async () => {
  const source = await readFile(new URL('../../site/packaged-object-runtime.mts', import.meta.url), 'utf8');
  assert.doesNotThrow(() => requireDescriptorAdapterSource(source, 'loadPackagedObject'));
  for (const changed of [
    source.replace("? 'first-view' : 'object'", "? 'full' : 'object'"),
    source.replace("${adoptsServerMarkup(descriptorInput.id) ? 'first-view' : 'object'}.json", 'object.json'),
    source.replace('adoptsServerMarkup(descriptorInput.id) ?', 'Math.random() > .5 ?'),
  ]) {
    assert.notEqual(changed, source);
    assert.throws(() => requireDescriptorAdapterSource(changed, 'loadPackagedObject'), /must forward its prepared transport/);
  }
});
