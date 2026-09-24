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

test('a pinned paper or archive document fails; our own Markdown notes pass', () => {
  const documents = ['reference/vernazza-2021.pdf', 'reference/ReadMe.AcuA.txt', 'reference/bundle_description.txt', 'survey/overview.docx',
    'vega/tvs_proc.doc', 'tex/table2.tex', 'lvdb/lvdb.bib', 'reference/dataset.cat', 'observations/aaReadMe_uranian_MAP_DEM.txt',
    'surface/WAC_GLOBAL_README.TXT', 'reference/pds-bundle_description.txt', 'ReadMe', 'vims/document/information_file.xml'];
  const manifest = { inputs: documents.map(path => ({ path })), documents: [{ path: 'geology/README.md' }] };
  const acquisition = { operations: [{ kind: 'download', path: 'reference/paper.PDF', url: 'https://example.org/paper.pdf' }] };
  const committed = new Set([...documents, 'geology/README.md']);
  assert.deepEqual(problems(bodySourceFindings('iris', manifest, acquisition, committed)),
    [...documents.map(path => `inputs pins ${path}`), 'downloads reference/paper.PDF']);
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
