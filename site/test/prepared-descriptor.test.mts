import assert from 'node:assert/strict';
import test from 'node:test';
import type { ObjectDescriptor } from '@cssearth/objects';
import { publishPreparedDescriptor, readPreparedDescriptor } from '../prepared-descriptor.mts';

const descriptor: ObjectDescriptor = {
  schema: 'cssearth-object@1', id: 'earth', type: 'layered-body', properties: {},
  prepared: { format: 'cssearth-css-object@5', url: 'prepared/object.json' },
};

function fixture(value: unknown = descriptor) {
  const element = { textContent: JSON.stringify(value) };
  return { element, document: { querySelector: () => element } as unknown as Document };
}

test('reads the validated descriptor embedded in an object page', () => {
  const { document } = fixture();
  assert.deepEqual(readPreparedDescriptor(document, 'earth'), descriptor);
  assert.throws(() => readPreparedDescriptor(document, 'mars'), /does not match object mars/);
});

test('publishes the retained document descriptor after navigation', () => {
  const { document, element } = fixture();
  const mars = { ...descriptor, id: 'mars', properties: { label: '<Mars>' } };
  publishPreparedDescriptor(document, mars);
  assert.deepEqual(readPreparedDescriptor(document, 'mars'), mars);
  assert.match(element.textContent, /\\u003cMars>/);
});

test('allows descriptor-free unit documents but refuses to publish into one', () => {
  const document = { querySelector: () => null } as unknown as Document;
  assert.equal(readPreparedDescriptor(document, 'earth'), undefined);
  assert.throws(() => publishPreparedDescriptor(document, descriptor), /missing/);
});
