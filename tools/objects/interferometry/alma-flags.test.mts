import assert from 'node:assert/strict';
import { sourceTest } from '../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentFlagCommands, completeInlineCommands, echoedFlagCommands, loggedFlagging, pipelineFlagSummary } from './alma-flags.mts';

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

test('a flag command the log cut short is completed from the task’s own echo, or the route stops', async () => {
  // ALMA 2019.1.00696.S, stage 12: the command log and the pipeline's "Executing" line keep only the tail of each command;
  // the flagdata task's own echo keeps it whole. The first file line is a call that also carried a summary.
  const echo = await readFile(resolve(fileURLToPath(new URL('../../../', import.meta.url)), 'tests/fixtures/alma/casapy.flagdata-echo.log'), 'utf8');
  const echoed = echoedFlagCommands(echo, 'uid___A002_Xe539c7_X12189.ms');
  assert.equal(echoed.length, 8, 'four commands in each of the two calls, summaries left out');
  assert.ok(echoed.every(command => command.startsWith("intent='CALIBRATE_BANDPASS#ON_SOURCE'")));
  const fragment = "23:58:12' field='J0334-4008' reason='ultrahigh baseline timestamp'";
  const completed = completeInlineCommands([fragment, fragment, "spw='25' antenna='DV03' reason='nmedian'"], echoed);
  assert.equal(completed[0], echoed[0]);
  assert.equal(completed[1], echoed[1], 'each echoed command is used once, in order');
  assert.equal(completed[2], "spw='25' antenna='DV03' reason='nmedian'", 'a whole command is kept as the log wrote it');
  assert.ok(completed[0]!.includes("timerange='2019/12/17/23:58:10~2019/12/17/23:58:12'"));
  assert.throws(() => completeInlineCommands(["12' reason='nothing echoes this'"], echoed), /truncates the flag command/u);
  assert.deepEqual(echoedFlagCommands(echo, 'uid___A002_Xe539c7_X4ec3.ms'), [], 'another measurement set’s echo is not taken');
});
