import './test-user-root.mts';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { requireWorkspace } from '@cssearth/telescope-core/node';

const checkout = requireWorkspace();
test('offline shipped discovery disables workspace reductions and qualification refuses them before IO', async () => {
  const directory = await mkdtemp(resolve(tmpdir(), 'telescope-route-prerequisites-'));
  const url = (file: string) => JSON.stringify(pathToFileURL(resolve(checkout, file)).href);
  const script = `
    import assert from 'node:assert/strict';
    import { readFile } from 'node:fs/promises';
    import { resolve } from 'node:path';
    const { WORKSPACE, USER_ROOT } = await import(${url('packages/telescope-core/src/node/index.ts')});
    const { explorationAnswer } = await import(${url('packages/telescope-cli/src/exploration.mts')});
    const { parseModeCapabilities } = await import(${url('packages/telescope-cli/src/observation-query/query-modes.mts')});
    const { SITE_DATA_ROOT, CLI_PACKAGE_ROOT } = await import(${url('packages/telescope-cli/src/paths.mts')});
    const routes = await import(${url('packages/telescope-cli/src/qualification/qualification-routes.mts')});
    const { qualifyObservation } = await import(${url('packages/telescope-cli/src/qualification/qualify.mts')});
    const value = JSON.parse(await readFile(resolve(SITE_DATA_ROOT, 'src/sources/naco/ledger.json'), 'utf8'));
    const capabilities = parseModeCapabilities(JSON.parse(await readFile(resolve(CLI_PACKAGE_ROOT, 'data/cli/src/modes.json'), 'utf8')));
    const answer = explorationAnswer({ target: 'eris' }, {
      ledgers: [{ telescope: 'naco', path: 'src/sources/naco/ledger.json', value }], capabilities,
      targetCatalogue: [{ id: 'eris', name: 'Eris', aliases: [] }], targetAssociations: [], bodyMaps: [], qualifiedProducts: [],
    });
    const identity = '085.C-0480-J-ERIS-2010-09-16-imaging';
    const choice = answer.choices.find(choice => choice.observation === identity);
    const reason = /needs a css[.]earth checkout: pass --workspace/;
    if (WORKSPACE) assert.ok(choice, 'Workspace NACO choice must remain selectable');
    else {
      assert.equal(choice, undefined);
      assert.match(answer.unsupported.find(row => row.identity.includes(identity)).reason, reason);
    }
    const configurations = [
      { kind: 'naco-program-night', programme: '085.C-0480(J)', archiveTarget: 'ERIS', night: '2010-09-16' },
      { kind: 'spitzer-irac-channel', channel: 1 },
      { kind: 'jwst-band', band: 'NIRSPEC-G235H-F170LP', wavelengthMicrometres: [2.2, 2.4] },
      { kind: 'pds-product', targetLid: 'urn:nasa:pds:context:target:dwarf_planet.eris', targetName: 'ERIS', lidvid: 'urn:nasa:pds:test::1.0' },
    ];
    for (const configuration of configurations) {
      assert.equal(routes.qualificationPrerequisite(configuration) === undefined, Boolean(WORKSPACE), configuration.kind);
      if (!WORKSPACE) await assert.rejects(qualifyObservation(USER_ROOT, {
        target: 'eris', telescope: 'unused', mode: 'unused', observation: identity, configuration,
      }), reason);
    }
    assert.equal(routes.qualificationPrerequisite({ kind: 'source-product', id: 'sample' }), undefined);
    assert.equal(routes.qualificationPrerequisite({ kind: 'archive-acquisition', key: 'sample', request: {} }), undefined);
    console.log('SHIPPED_ROUTE_PREREQUISITES_OK');
  `;
  try {
    for (const workspace of [undefined, checkout]) {
      const env: NodeJS.ProcessEnv = { ...process.env, CSSEARTH_TELESCOPE_HOME: resolve(directory, 'user') };
      delete env.CSSEARTH_WORKSPACE;
      if (workspace) env.CSSEARTH_WORKSPACE = workspace;
      const result = spawnSync(process.execPath, ['--import', resolve(checkout, 'packages/core/src/node/register-vite-suffix.mts'), '--input-type=module', '-e', script],
        { cwd: directory, env, encoding: 'utf8', timeout: 30_000 });
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /SHIPPED_ROUTE_PREREQUISITES_OK/u);
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});
