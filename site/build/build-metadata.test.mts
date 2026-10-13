import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { cssEarthVersion, finalizeBuildMetadata } from './build-metadata.mts';
import { incrementalBuildEnabled, incrementalRenderEnabled, REVISION_TOKEN, VERSION_TOKEN } from '../contracts/build-metadata.mts';
import { sourceRevision } from '../content/source-revision.mts';

test('opt-in is explicit', () => {
  assert.equal(incrementalBuildEnabled({}), false);
  assert.equal(incrementalBuildEnabled({ CSSEARTH_INCREMENTAL_BUILD: 'true' }), false);
  assert.equal(incrementalBuildEnabled({ CSSEARTH_INCREMENTAL_BUILD: '1' }), true);
  for (const command of ['dev', 'sync', 'check']) assert.equal(incrementalRenderEnabled(command, { CSSEARTH_INCREMENTAL_BUILD: '1' }), false);
  assert.equal(incrementalRenderEnabled('build', { CSSEARTH_INCREMENTAL_BUILD: '1' }), true);
});

test('raw cache survives independent real version and source-revision transitions', async t => {
  const root = await mkdtemp(join(tmpdir(), 'incremental-metadata-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const git = (...args: string[]) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  git('init', '-q');
  await writeFile(join(root, 'input'), 'first');
  git('add', 'input');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'first');
  const firstRevision = sourceRevision(root, {});
  assert.equal(cssEarthVersion(root), '0.1');
  await mkdir(join(root, 'cache'));
  await mkdir(join(root, 'dist/navigation/alpha'), { recursive: true });
  const body = `<a aria-label="GitHub v${VERSION_TOKEN}">v${VERSION_TOKEN}</a><a href="https://github.com/layoutit/css.earth/blob/${REVISION_TOKEN}/src/objects/alpha/README.md">Sources</a>`;
  const cache = join(root, 'cache/raw.html');
  await writeFile(cache, body);
  const render = async (version: string, revision: string) => {
    await copyFile(cache, join(root, 'dist/index.html'));
    await copyFile(cache, join(root, 'dist/navigation/alpha/index.html'));
    await writeFile(join(root, 'dist/catalogue.json'), JSON.stringify({ source: REVISION_TOKEN }));
    assert.equal(await finalizeBuildMetadata(join(root, 'dist'), { version, revision }), 3);
    for (const file of ['index.html', 'navigation/alpha/index.html']) {
      assert.equal(await readFile(join(root, 'dist', file), 'utf8'), body.replaceAll(VERSION_TOKEN, version).replaceAll(REVISION_TOKEN, revision));
    }
    assert.equal(JSON.parse(await readFile(join(root, 'dist/catalogue.json'), 'utf8')).source, revision);
    assert.equal(await readFile(cache, 'utf8'), body);
  };
  await render(cssEarthVersion(root), firstRevision);
  await writeFile(join(root, 'input'), 'second');
  git('add', 'input');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.test', 'commit', '-qm', 'second');
  const secondRevision = sourceRevision(root, {});
  assert.notEqual(secondRevision, firstRevision);
  assert.equal(cssEarthVersion(root), '0.2');
  // The real commit count changes while a pinned source revision stays fixed.
  await render(cssEarthVersion(root), sourceRevision(root, { COMMIT_REF: firstRevision }));
  // The source revision changes independently at the same real commit count.
  await render(cssEarthVersion(root), secondRevision);
});

test('invalid metadata and an absent finalization target stop the build', async t => {
  const root = await mkdtemp(join(tmpdir(), 'incremental-empty-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await assert.rejects(finalizeBuildMetadata(root, { version: 'invalid', revision: 'invalid' }), TypeError);
  await assert.rejects(finalizeBuildMetadata(root, { version: '0.1', revision: 'a'.repeat(40) }), /no rendered metadata/u);
  assert.throws(() => sourceRevision(root, { COMMIT_REF: 'invalid' }), /build commit/u);
});
