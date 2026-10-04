import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import test from 'node:test';
import { bodySourceFindings, sharedCopyFindings, manifestGeneratorFindings, checkBodyReferences } from './check-body-references.mts';

const problems = (findings: readonly { problem: string }[]) => findings.map(finding => finding.problem.split(/[;,]/u)[0]);

test('every declared file is committed, restored by an acquisition step for its path, or generated', () => {
  const manifest = {
    inputs: [{ path: 'shape/model.obj' }, { path: 'observations/frame.img' }, { path: 'observations/lost.img' }],
    documents: [{ path: 'preparation/recipe.json' }],
    generatedIntermediates: [{ path: 'observations/mean.fits', generator: 'packages/bake/authoring/eht/topset-mean.mts x' }],
  };
  const acquisition = { operations: [{ kind: 'download', path: 'observations/frame.img', url: 'https://example.org/frame.img' }] };
  assert.deepEqual(problems(bodySourceFindings('x', manifest, acquisition, new Set(['shape/model.obj', 'preparation/recipe.json']))),
    ['inputs declares observations/lost.img']);
});

test('a generator starts with a script the repository tracks, optionally followed by its arguments', () => {
  const manifest = { inputs: [{ path: 'a.png', generator: 'packages/x/make.mts a --b', recipe: { generator: 'tools/gone.mjs' } }],
    generatedIntermediates: [{ path: 'b.json', generator: 'node packages/x/make.mts' }] };
  assert.deepEqual(problems(bodySourceFindings('x', manifest, null, new Set(['a.png']), new Set(['packages/x/make.mts']))),
    ['inputs a.png names generator "tools/gone.mjs"']);
});

test('an acquisition step must restore a declared file', () => {
  const findings = bodySourceFindings('x', { inputs: [] }, { operations: [{ kind: 'download', path: 'reference/sbdb.json', url: 'https://example.org' }] }, new Set());
  assert.deepEqual(problems(findings), ['restores reference/sbdb.json']);
});

test('a pinned paper or archive document fails; our own Markdown notes pass', () => {
  const documents = ['reference/vernazza-2021.pdf', 'reference/ReadMe.AcuA.txt', 'reference/bundle_description.txt', 'survey/overview.docx',
    'vega/tvs_proc.doc', 'tex/table2.tex', 'lvdb/lvdb.bib', 'reference/dataset.cat', 'observations/aaReadMe_uranian_MAP_DEM.txt',
    'surface/WAC_GLOBAL_README.TXT', 'reference/plate_shape_definition.asc', 'reference/pds-bundle_description.txt', 'ReadMe', 'vims/document/information_file.xml'];
  const manifest = { inputs: documents.map(path => ({ path })), documents: [{ path: 'geology/README.md' }] };
  const acquisition = { operations: [{ kind: 'download', path: 'reference/paper.PDF', url: 'https://example.org/paper.pdf' }] };
  const committed = new Set([...documents, 'geology/README.md']);
  assert.deepEqual(problems(bodySourceFindings('iris', manifest, acquisition, committed)),
    [...documents.map(path => `inputs pins ${path}`), 'downloads reference/paper.PDF']);
});

test('a committed SPICE kernel fails anywhere, and a body copy of a shared reference table fails', () => {
  const lines = [
    '100644 aaaa 0\tsrc/references/cie-1931-2deg/CIE_xyz_1931_2deg.csv',
    '100644 bbbb 0\tsrc/spice/voyager/lsk/naif0012.tls',
    '100644 cccc 0\tsrc/spice/voyager/manifest.json',
    '100644 aaaa 0\tsrc/objects/vega/source/reference/CIE_xyz_1931_2deg.csv',
    '100644 bbbb 0\tsrc/objects/puck/source/geometry/naif0012.tls',
    '100644 eeee 0\tsrc/objects/steins/source/reference/ROS_V33.TF',
    '100644 cccc 0\tsrc/objects/vega/source/manifest.json',
    '100644 dddd 0\tsrc/objects/vega/source/shape/model.obj',
  ];
  assert.deepEqual(sharedCopyFindings(lines).map(finding => finding.file), [
    'src/spice/voyager/lsk/naif0012.tls', 'src/objects/puck/source/geometry/naif0012.tls', 'src/objects/steins/source/reference/ROS_V33.TF',
    'src/objects/vega/source/reference/CIE_xyz_1931_2deg.csv']);
});

test('reference and nested manifest generators resolve live commands and dated relocations', () => {
  const file = 'src/references/example/manifest.json', tracked = new Set(['packages/x/make.mts']);
  assert.deepEqual(manifestGeneratorFindings(file, { generator: 'node packages/x/make.mts --acquire', nested: [{ generator: 'old.mts (now packages/x/make.mts)' }] }, tracked), []);
  assert.equal(manifestGeneratorFindings(file, { generator: 'node packages/x/missing.mts' }, tracked).length, 1);
});

test('all tracked manifests are checked, including reference manifests outside body schemas', async () => {
  const root = mkdtempSync(resolve(tmpdir(), 'manifest-generators-'));
  try {
    execFileSync('git', ['init', '-q'], { cwd: root });
    mkdirSync(resolve(root, 'src/references/example'), { recursive: true });
    const path = resolve(root, 'src/references/example/manifest.json');
    writeFileSync(path, '{"generator":"node missing.mts --acquire"}');
    execFileSync('git', ['add', '.'], { cwd: root });
    assert.equal((await checkBodyReferences(root)).length, 1, 'missing script mutation is red');
    writeFileSync(resolve(root, 'missing.mts'), 'export {};');
    execFileSync('git', ['add', '.'], { cwd: root });
    assert.deepEqual(await checkBodyReferences(root), [], 'restoring tracked script is green');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
