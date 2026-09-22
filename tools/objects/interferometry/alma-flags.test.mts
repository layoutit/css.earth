import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentFlagCommands, loggedFlagging, pipelineFlagSummary } from './alma-flags.mts';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const read = (name: string) => readFile(resolve(root, 'tests/fixtures/alma', name), 'utf8');
const vis = 'uid___A002_X10ed869_X1ec34.ms';

test('the hifa_flagdata command file is replayed without its summaries', async () => {
  const commands = agentFlagCommands(await read('agent_flagcmds.txt'));
  assert.ok(commands.every(command => !command.includes("mode='summary'")));
  assert.ok(commands.includes("mode='manual' intent='CALIBRATE_POINTING#ON_SOURCE' reason='intents'"));
  assert.ok(commands.includes("mode='manual' autocorr=True reason='autocorr'"));
  assert.ok(commands.includes("mode='shadow' tolerance=0.0 reason='shadow'"));
  // Online flags select by antenna, time range and spectral-window name, never by row.
  assert.ok(commands.some(command => /^antenna='DA61&&\*' timerange='2023\/11\/03\/07:29:46.312~/u.test(command)));
  assert.throws(() => agentFlagCommands("mode='summary' name='before'\n"), /applies nothing/u);
});

test('the command log gives the time buffer and the inline flags later stages applied', async () => {
  const logged = loggedFlagging(await read('casa_commands.flagdata.log'), vis);
  assert.deepEqual(logged.tbuff, [0.96, 1.008]);
  assert.deepEqual(logged.inline, ["spw='25' antenna='DV03' reason='nmedian'", "spw='27' antenna='DV03' reason='nmedian'",
    "spw='29' antenna='DV03' reason='nmedian'", "spw='31' antenna='DV03' reason='nmedian'"]);
  // Anything the replay could not reproduce stops it.
  assert.throws(() => loggedFlagging("flagdata(vis='x.ms', mode='list', inpfile='other.txt', action='apply')\nflagmanager(vis='x.ms', mode='save', versionname='Pipeline_Final')", 'x.ms'), /does not have/u);
  assert.throws(() => loggedFlagging("flagdata(vis='x.ms', mode='list', inpfile=[\"mode='clip' clipminmax=[0,1]\"], action='apply')\nflagmanager(vis='x.ms', mode='save', versionname='Pipeline_Final')", 'x.ms'), /not a plain selection/u);
  assert.throws(() => loggedFlagging('flagdata()', 'x.ms'), /Pipeline_Final/u);
});

test('the pipeline’s per-antenna flag count is read for one field and every window', async () => {
  const log = await read('hif_applycal.casapy.log');
  const summary = pipelineFlagSummary(log, vis, 'R_Dor');
  assert.deepEqual([...summary.keys()], [25, 27, 29, 31]);
  const spw25 = summary.get(25)!;
  assert.equal(spw25.size, 41);
  assert.equal(spw25.get('DV03'), 1);
  // Every other antenna loses its DV03 baseline and its auto-correlation: 2 of 41 rows.
  assert.ok(Math.abs(spw25.get('DA41')! - 2 / 41) < 1e-3);
  assert.throws(() => pipelineFlagSummary(log, vis, 'NOT_A_FIELD'), /covers 0 of 4/u);
});
