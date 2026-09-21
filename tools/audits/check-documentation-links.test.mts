import assert from 'node:assert/strict';
import {execFileSync, spawnSync} from 'node:child_process';
import {mkdirSync, mkdtempSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test, type TestContext} from 'node:test';
import {anchors, checkDocumentation, localLinks} from './check-documentation-links.mts';

function fixture(t: TestContext) {
  const root = mkdtempSync(join(tmpdir(), 'cssearth-docs-test-'));
  t.after(() => rmSync(root, {recursive: true, force: true}));
  const git = (...args: string[]): string => execFileSync('git', args, {cwd: root, encoding: 'utf8'}).trim();
  const write = (path: string, content: string): void => {
    mkdirSync(dirname(join(root, path)), {recursive: true});
    writeFileSync(join(root, path), content);
  };
  const commit = (): string => {
    git('add', '.');
    git('-c', 'user.name=Documentation test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'Documentation fixture');
    return git('rev-parse', 'HEAD');
  };
  git('init', '--quiet');
  write('docs/README.md', '# Documentation\n\n[Guide](guide.md)\n');
  write('docs/guide.md', '# Guide\n\n![Comparison](images/comparison.svg)\n');
  write('docs/images/comparison.svg', '<svg xmlns="http://www.w3.org/2000/svg"/>');
  commit();
  return {root, git, write, commit, check: (base: string | null = null) => checkDocumentation(root, base)};
}

test('nested guides, reference links, and HTML images preserve the existing audit contract', t => {
  const f = fixture(t);
  f.write('docs/guide.md', '# Guide\n\n[Detailed method][method]\n\n[method]: methods/mapping.md\n');
  f.write('docs/methods/mapping.md', '# Mapping\n\n[Back](../guide.md)\n\n<img width="120" src="../images/comparison.svg">\n');
  f.write('tests/fixtures/sample.json', '{}');
  f.write('src/objects/example/source/reference/SOURCE.md', '# Provider notes\n');
  const result = f.check();
  assert.deepEqual(result.errors, []);
  assert.equal(result.documentation.reachableGuides, 3);
  assert.equal(result.documentation.usedIllustrations, 1);
});

test('--all rejects orphan cycles, unused images, raw output, and duplicate body accounts', t => {
  const f = fixture(t);
  const additions = {
    'docs/orphan-a.md': '# A\n\n[B](orphan-b.md)\n',
    'docs/orphan-b.md': '# B\n\n[A](orphan-a.md)\n',
    'docs/images/unused.png': 'unused image',
    'docs/run.json': '{}',
    'docs/author.py': 'print("a tool, not a guide")',
    'docs/captures.zip': 'archive',
    'src/objects/example/SOURCE.md': '# Duplicate sources',
    'src/objects/example/EVIDENCE.md': '# Duplicate evidence',
    'src/objects/example/USAGE.md': '# Duplicate usage',
  };
  for (const [path, content] of Object.entries(additions)) f.write(path, content);
  assert.deepEqual(new Set(f.check().errors.map(error => error.file)), new Set(Object.keys(additions)));
  assert.deepEqual(f.check('HEAD').errors, f.check().errors, 'new violations also fail the scoped check');
});

test('scoped mode checks non-Markdown additions and broken anchors', t => {
  const f = fixture(t);
  f.write('docs/run.json', '{}');
  f.write('docs/guide.md', '# Guide\n\n[Missing section](README.md#missing)\n\n![Comparison](images/comparison.svg)\n');
  assert.deepEqual(new Set(f.check('HEAD').errors.map(error => error.reason)), new Set([
    'missing Markdown anchor',
    'docs/ accepts Markdown guides and illustrations under docs/images/; move code, fixtures and raw output to their owner',
  ]));
});

test('reference and HTML targets are validated in both modes', t => {
  const f = fixture(t);
  const examples = [
    ['[Missing][ref]\n\n[ref]: missing.md', 'missing repository path'],
    ['![ref][]\n\n[ref]: missing.png', 'missing repository path'],
    ['[ref]\n\n[ref]: README.md#absent', 'missing Markdown anchor'],
    ['<img src="missing.png" width="120">', 'missing repository path'],
    ['<img src=missing.png width=120>', 'missing repository path'],
    ["<a href='README.md#absent'>Missing</a>", 'missing Markdown anchor'],
  ];
  for (const [content, reason] of examples) {
    f.write('docs/guide.md', '# Guide\n\n![Comparison](images/comparison.svg)\n\n' + content);
    for (const base of [null, 'HEAD']) assert.deepEqual(f.check(base).errors.map(error => error.reason), [reason], content);
  }
});

test('examples, unused references, external links, comments, and data-href are excluded', t => {
  const f = fixture(t);
  f.write('docs/guide.md', '# Guide\n\n![Comparison](images/comparison.svg)\n\n' +
    '[unused]: missing.md\n\n````md\n[Example][ref]\n[ref]: missing.md\n' +
    '<img src="missing.png">\n````\n\n' +
    '[External](https://example.org/)\n<img src="//example.org/image.png">\n' +
    '<a data-href="missing.md" href="README.md#documentation">Index</a>\n' +
    '<!-- <img src="missing.png"> -->\n' +
    '[Guide][  Mixed CASE ]\n\n[mixed case]: <README.md#documentation> "Title"\n');
  assert.deepEqual(f.check().errors, []);
});

test('unrelated baseline debt does not block a code edit, but --all still reports it', t => {
  const f = fixture(t);
  f.write('docs/old-orphan.md', '# Historical orphan\n\n[Old broken link](missing.md)\n');
  f.write('docs/old-output.json', '{}');
  f.commit();
  f.write('tools/changed.mts', 'export const changed = true;\n');
  assert.deepEqual(f.check('HEAD').errors, []);
  assert.equal(f.check('HEAD').unchangedFindings, 3);
  assert.equal(f.check().errors.length, 3);
  f.write('docs/old-orphan.md', '# Edited orphan\n');
  assert.deepEqual(f.check('HEAD').errors.map(error => error.file), ['docs/old-orphan.md'], 'editing an existing orphan makes it the PR owner\'s responsibility');
});

test('a new orphan fails despite unrelated baseline debt', t => {
  const f = fixture(t);
  f.write('docs/old-orphan.md', '# Old\n');
  f.commit();
  f.write('docs/new-orphan.md', '# New\n');
  assert.deepEqual(f.check('HEAD').errors.map(error => error.file), ['docs/new-orphan.md']);
});

test('deleting a target catches unchanged inbound Markdown and HTML links', t => {
  const f = fixture(t);
  f.write('README.md', '[Guide](docs/guide.md)\n<img src="docs/images/comparison.svg">\n');
  f.commit();
  rmSync(join(f.root, 'docs/guide.md'));
  rmSync(join(f.root, 'docs/images/comparison.svg'));
  const errors = f.check('HEAD').errors;
  assert.ok(errors.some(error => error.file === 'README.md' && error.target === 'docs/guide.md' && error.reason === 'missing repository path'));
  assert.ok(errors.some(error => error.file === 'README.md' && error.target === 'docs/images/comparison.svg' && error.reason === 'missing repository path'));
  assert.ok(errors.some(error => error.file === 'docs/README.md' && error.target === 'guide.md'));
});

test('changing an anchor catches unchanged inbound links without importing their old debt', t => {
  const f = fixture(t);
  f.write('README.md', '[Guide](docs/guide.md#guide)\n[Old broken](absent.md)\n');
  f.commit();
  f.write('docs/guide.md', '# Renamed\n\n![Comparison](images/comparison.svg)\n');
  assert.deepEqual(f.check('HEAD').errors, [{file: 'README.md', target: 'docs/guide.md#guide', reason: 'missing Markdown anchor'}]);
});

test('removing an index link rejects newly orphaned unchanged descendants and illustrations', t => {
  const f = fixture(t);
  f.write('docs/README.md', '# Documentation\n');
  assert.deepEqual(new Set(f.check('HEAD').errors.map(error => error.file)), new Set(['docs/guide.md', 'docs/images/comparison.svg']));
});

test('sparse trees read tracked Markdown blobs without mistaking them for deleted files', t => {
  const f = fixture(t);
  f.git('update-index', '--skip-worktree', 'docs/guide.md');
  rmSync(join(f.root, 'docs/guide.md'));
  assert.deepEqual(f.check().errors, []);
  assert.deepEqual(f.check('HEAD').errors, []);
});

test('a committed file removed locally is not resurrected from HEAD when absent at review base', t => {
  const f = fixture(t);
  const base = f.git('rev-parse', 'HEAD');
  f.write('README.md', '[Later](later.md)\n');
  f.write('later.md', '# Later\n');
  f.commit();
  rmSync(join(f.root, 'later.md'));
  assert.deepEqual(f.check(base).errors, [{file: 'README.md', target: 'later.md', reason: 'missing repository path'}]);
});

test('duplicate/Unicode headings, explicit IDs, encoded paths, and HTML entities resolve', t => {
  const f = fixture(t);
  f.write('docs/guide.md', '# Guide\n\n![Comparison](images/comparison.svg)\n\n' +
    '# Über Guide\n# Über Guide\n<a id="explicit"></a>\n' +
    '[Self](#%C3%BCber-guide-1)\n<a href="guide.md?x=1&amp;y=2#explicit">Self</a>\n');
  assert.deepEqual(f.check().errors, []);
  assert.deepEqual(anchors('# Same\n# Same\n~~~md\n# Hidden\n~~~\n'), new Set(['same', 'same-1']));
  assert.deepEqual(localLinks('docs/guide.md', '[Target](<file%20name.md#hello> "title")'), [{target: 'file%20name.md#hello', path: 'docs/file name.md', fragment: 'hello'}]);
});

test('CLI validates mode, returns JSON and nonzero for a real scoped regression', t => {
  const f = fixture(t);
  const checker = fileURLToPath(new URL('./check-documentation-links.mts', import.meta.url));
  const run = (...args: string[]) => spawnSync(process.execPath, [checker, ...args], {cwd: f.root, encoding: 'utf8'});
  assert.equal(run().status, 2);
  assert.equal(run('--all', '--base', 'HEAD').status, 2);
  assert.equal(run('--base', 'not-a-real-ref').status, 2);
  assert.equal(run('--base', 'HEAD').status, 0);
  f.write('docs/new-orphan.md', '# New\n');
  const regression = run('--base', 'HEAD');
  assert.equal(regression.status, 1);
  assert.match(regression.stdout, /guide is not reachable/);
});
