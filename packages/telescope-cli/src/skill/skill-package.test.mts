import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, realpathSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { requireRecord } from '@cssearth/core';
import { CLI_PACKAGE_ROOT } from '../paths.mts';
import { parseCli } from '../cli-arguments.mts';
import { writeDrafts } from '../new-object/drafts.mts';
import { GAIA_TAP, type Archive } from '../new-object/archives/archives.mts';

const root = resolve(CLI_PACKAGE_ROOT, '../..');
const read = (path: string) => requireRecord(JSON.parse(readFileSync(path, 'utf8')), path);
test('the npm skill and three plugin manifests share one identity and ship together', () => {
  const pkg = read(resolve(CLI_PACKAGE_ROOT, 'package.json'));
  assert.ok(Array.isArray(pkg.files));
  for (const host of ['claude', 'codex', 'factory']) {
    const folder = `.${host}-plugin`, manifest = read(resolve(CLI_PACKAGE_ROOT, folder, 'plugin.json'));
    assert.equal(manifest.name, 'telescope'); assert.equal(manifest.version, pkg.version);
    assert.equal(manifest.license, 'MIT'); assert.equal(manifest.skills, './skills/');
    assert.equal(requireRecord(manifest.author).name, 'css.earth'); assert.ok(pkg.files.includes(folder));
    assert.ok(typeof manifest.description === 'string' && manifest.description.length > 20);
    if (host === 'codex') {
      const ui = requireRecord(manifest.interface); assert.equal(ui.displayName, 'Telescope'); assert.equal(ui.category, 'Productivity');
    }
  }
  assert.ok(pkg.files.includes('skills')); assert.deepEqual(requireRecord(pkg.pi).skills, ['./skills/telescope']);
  const skill = readFileSync(resolve(CLI_PACKAGE_ROOT, 'skills/telescope/SKILL.md'), 'utf8');
  assert.match(skill, /^---\nname: telescope\ndescription: .+\n---\n/u);
});
for (const location of ['.claude-plugin/marketplace.json', '.agents/plugins/marketplace.json', '.factory-plugin/marketplace.json']) {
  test(`${location} lists the npm package with the host's marketplace shape`, () => {
    const marketplace = read(resolve(root, location)); assert.equal(marketplace.name, 'cssearth-telescope');
    assert.ok(Array.isArray(marketplace.plugins) && marketplace.plugins.length === 1);
    const plugin = requireRecord(marketplace.plugins[0]); assert.equal(plugin.name, 'telescope');
    assert.deepEqual(plugin.source, { source: 'npm', package: '@cssearth/telescope' });
    if (location.startsWith('.agents')) {
      assert.deepEqual(plugin.policy, { installation: 'AVAILABLE', authentication: 'ON_INSTALL' });
      assert.equal(plugin.category, 'Productivity'); assert.equal(requireRecord(marketplace.interface).displayName, 'css.earth Telescope');
    } else assert.equal(requireRecord(marketplace.owner).name, 'css.earth');
  });
}
test('the repository skill links to the packaged owner', () => {
  assert.equal(realpathSync(resolve(root, '.agents/skills/telescope')), realpathSync(resolve(CLI_PACKAGE_ROOT, 'skills/telescope')));
});
test('Claude strict validation passes when the host CLI is available', t => {
  const available = spawnSync('claude', ['--version'], { encoding: 'utf8', timeout: 15_000 });
  if (available.error && 'code' in available.error && available.error.code === 'ENOENT') { t.skip('Claude CLI unavailable'); return; }
  assert.equal(available.status, 0, available.stderr);
  for (const file of [resolve(CLI_PACKAGE_ROOT, '.claude-plugin/plugin.json'), resolve(root, '.claude-plugin/marketplace.json')]) {
    const result = spawnSync('claude', ['plugin', 'validate', file, '--strict'], { encoding: 'utf8', timeout: 30_000 });
    assert.equal(result.status, 0, result.stderr + result.stdout); assert.match(result.stdout, /Validation passed/u);
  }
});
test('the documented telescope flow and significant arguments are accepted by the CLI', () => {
  for (const args of [
    ['explore', 'eris', '--out', './eris-observations', '--json'],
    ['explore', '--icrs-circle', '83.82,-5.39,0.1', '--out', './orion-field', '--json'],
    ['get', './eris-observations', '--pick', '1', '--json'],
    ['get', './eris-observations', '--pick', '1', '--offline', '--json'],
    ['outputs', './eris-observations/pick-1/result.json', '--json'],
    ['export', './eris-observations/pick-1/result.json', '--output', 'image', '--hdu', '0', '--out', './eris-image', '--json'],
    ['export', './eris-image/output.product.json', '--output', 'html', '--out', './eris-viewer', '--json'],
    ['papers', 'eris', '--about', 'imaging', '--json'], ['simulations', 'eris', '--json'],
    ['skill', 'install', '--dest', './skills', '--copy', '--json'], ['skill', 'uninstall', '--dest', './skills', '--json'],
  ]) assert.notEqual(parseCli(args).command, 'help');
});
test('the from-gaia drafter writes a reviewable spec without site records', async t => {
  const root = mkdtempSync(resolve(tmpdir(), 'telescope-draft-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  // Preserved archive row also used by the generator's Gaia qualification test.
  const csv = 'source_id,parallax,parallax_error,ruwe,flags_flame,radius_flame,mass_flame,teff_gspphot,teff_gspphot_lower,teff_gspphot_upper,ag_gspphot\n' +
    '6711869948052992,0.11950849172011525,0.015932519,1.145126,10,15.559747,3.3650587,6087.612,6071.958,6095.802,0.8901';
  const archive: Archive = {
    text: async url => url === GAIA_TAP ? csv : 'id\n',
    bytes: async () => { throw new Error('Unexpected byte request'); },
    exists: async () => { throw new Error('Unexpected HEAD request'); },
  };
  const result = await writeDrafts('gaia', ['6711869948052992'], 'SPEC.json', { root, archive, progress: () => {} });
  assert.equal(result.entries, 1);
  const spec = read(resolve(root, 'SPEC.json'));
  assert.ok(Array.isArray(spec.stars));
  assert.equal(requireRecord(spec.stars[0]).id, 'gaia-dr3-6711869948052992');
  assert.deepEqual(readdirSync(root), ['SPEC.json']);
});
