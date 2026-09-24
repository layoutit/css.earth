import assert from 'node:assert/strict';
import test from 'node:test';
import { bodySourceFindings, sharedCopyFindings } from './check-body-references.mts';

test('a pinned paper, catalogue ReadMe or bundle description in a manifest or download step fails', () => {
  const manifest = { inputs: [{ path: 'reference/vernazza-2021.pdf' }, { path: 'shape/model.obj' }],
    documents: [{ path: 'reference/ReadMe.AcuA.txt' }, { path: 'reference/bundle_description.txt' }], generatedIntermediates: [] };
  const acquisition = { operations: [{ kind: 'download', path: 'reference/paper.PDF', url: 'https://example.org/paper.pdf' }, { kind: 'download', path: 'shape/model.obj' }] };
  assert.deepEqual(bodySourceFindings('iris', manifest, acquisition).map(finding => finding.problem.split(';')[0]), [
    'inputs pins reference/vernazza-2021.pdf', 'documents pins reference/ReadMe.AcuA.txt', 'documents pins reference/bundle_description.txt',
    'downloads reference/paper.PDF']);
});

test('a data table published as a PDF passes only through its named exception', () => {
  const manifest = { inputs: [{ path: 'mcconnachie/table1_OCT2019.pdf' }] };
  assert.deepEqual(bodySourceFindings('local-group', manifest, null), []);
  assert.equal(bodySourceFindings('m31', manifest, null).length, 1, 'the exception names one body and path');
});

test('a body file byte-identical to a shared bank file fails, and a named consumed copy passes', () => {
  const lines = [
    '100644 aaaa 0\tsrc/references/cie-1931-2deg/CIE_xyz_1931_2deg.csv',
    '100644 bbbb 0\tsrc/spice/voyager/lsk/naif0012.tls',
    '100644 cccc 0\tsrc/spice/voyager/manifest.json',
    '100644 aaaa 0\tsrc/objects/vega/source/reference/CIE_xyz_1931_2deg.csv',
    '100644 bbbb 0\tsrc/objects/puck/source/geometry/naif0012.tls',
    '100644 bbbb 0\tsrc/objects/proteus/source/geometry/naif0012.tls',
    '100644 cccc 0\tsrc/objects/vega/source/manifest.json',
    '100644 dddd 0\tsrc/objects/vega/source/shape/model.obj',
  ];
  assert.deepEqual(sharedCopyFindings(lines).map(finding => finding.file), [
    'src/objects/vega/source/reference/CIE_xyz_1931_2deg.csv', 'src/objects/puck/source/geometry/naif0012.tls']);
});
