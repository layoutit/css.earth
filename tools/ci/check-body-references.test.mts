import assert from 'node:assert/strict';
import test from 'node:test';
import { bodySourceFindings, sharedCopyFindings } from './check-body-references.mts';

const problems = (findings: readonly { problem: string }[]) => findings.map(finding => finding.problem.split(/[;,]/u)[0]);

test('every declared file is committed, restored by an acquisition step for its path, or generated', () => {
  const manifest = {
    inputs: [{ path: 'shape/model.obj' }, { path: 'observations/frame.img' }, { path: 'observations/lost.img' }],
    documents: [{ path: 'preparation/recipe.json' }],
    generatedIntermediates: [{ path: 'observations/mean.fits', generator: 'tools/objects/eht/topset-mean.mts x' }],
  };
  const acquisition = { operations: [{ kind: 'download', path: 'observations/frame.img', url: 'https://example.org/frame.img' }] };
  assert.deepEqual(problems(bodySourceFindings('x', manifest, acquisition, new Set(['shape/model.obj', 'preparation/recipe.json']))),
    ['inputs declares observations/lost.img']);
});

test('an acquisition step must restore a declared file', () => {
  const findings = bodySourceFindings('x', { inputs: [] }, { operations: [{ kind: 'download', path: 'reference/sbdb.json', url: 'https://example.org' }] }, new Set());
  assert.deepEqual(problems(findings), ['restores reference/sbdb.json']);
});

test('a pinned paper, catalogue ReadMe or bundle description fails; a named data table passes', () => {
  const manifest = { inputs: [{ path: 'reference/vernazza-2021.pdf' }], documents: [{ path: 'reference/ReadMe.AcuA.txt' }, { path: 'reference/bundle_description.txt' }] };
  const acquisition = { operations: [{ kind: 'download', path: 'reference/paper.PDF', url: 'https://example.org/paper.pdf' }] };
  const committed = new Set(['reference/ReadMe.AcuA.txt', 'reference/bundle_description.txt', 'reference/vernazza-2021.pdf']);
  assert.deepEqual(problems(bodySourceFindings('iris', manifest, acquisition, committed)), [
    'inputs pins reference/vernazza-2021.pdf', 'documents pins reference/ReadMe.AcuA.txt', 'documents pins reference/bundle_description.txt',
    'downloads reference/paper.PDF']);
  const table = { inputs: [{ path: 'mcconnachie/table1_OCT2019.pdf' }] };
  assert.deepEqual(bodySourceFindings('local-group', table, null, new Set(['mcconnachie/table1_OCT2019.pdf'])), []);
  assert.equal(bodySourceFindings('m31', table, null, new Set(['mcconnachie/table1_OCT2019.pdf'])).length, 1, 'the exception names one body and path');
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
