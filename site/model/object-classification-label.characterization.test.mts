import assert from 'node:assert/strict';
import { test } from 'node:test';
import { objectClassificationLabel, objectTypeLabel } from './object-classification-label.mts';
test('classification labels preserve casing, replace every hyphen and prefer even empty authored labels', () => {
  assert.equal(objectClassificationLabel('satellite'), 'Moon');
  assert.equal(objectClassificationLabel('brown-dwarf-star'), 'Brown dwarf star');
  assert.equal(objectClassificationLabel('NASA'), 'NASA');
  assert.equal(objectTypeLabel({ classification: 'star', classificationLabel: '' }), '');
  assert.equal(objectTypeLabel({ classification: 'star' }), 'Star');
  assert.throws(() => objectClassificationLabel(''), TypeError);
});
