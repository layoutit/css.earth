/** A connection check is not a phone performance result. Never turn a missing trace into a pass. */
import { execFileSync } from 'node:child_process';
import { writeFile, stat } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { SITE_DIR } from './site-views.mts';
import { json, rec, array, need } from '../inputs.mts';

export function adbStates(output: string): string[] {
  const lines = output.trim().split(/\r?\n/u), header = lines.indexOf('List of devices attached');
  need(header >= 0, 'ADB did not return a device list');
  return lines.slice(header + 1).filter(line => line.trim()).map(line => {
    const fields = line.trim().split(/\s+/u), state = fields[1];
    need(fields.length >= 2 && state !== undefined && ['device', 'offline', 'unauthorized', 'recovery', 'sideload', 'bootloader', 'no'].includes(state), 'Unrecognized ADB device status');
    return state;
  });
}

export async function recordPhoneAvailability() {
  need(rec(await json(SITE_DIR + 'result.json')).complete === true, 'Real-site qualification must finish first');
  const output = execFileSync('adb', ['devices', '-l'], { encoding: 'utf8', timeout: 10000 }), states = adbStates(output);
  need(!states.includes('device'), 'A phone is connected. Run its real jankmonster traces instead of recording a skipped test.');
  const record = {
    schema: 'cssearth-lmc-phone-qualification@1', status: 'skipped', qualified: false,
    generator: 'packages/bake/authoring/lmc-volume/delivery/phone-availability.mts',
    checkedAtUtc: new Date().toISOString(), connectionCheck: 'adb devices -l', detectedDeviceCount: states.length, states,
    reason: states.length === 0 ? 'No Android device is connected. The owner reported the S23 disconnected; the live ADB check confirms no available phone.' : 'ADB reports devices, but none is available for tracing.',
    traceScenarios: ['drag', 'coast', 'far/near'], traces: [], comparison: null,
    milkyWayReference: { source: 'src/objects/milky-way-volume/README.md', date: '2026-10-22', scenario: 'Eight-second turn with the shipped 33-layer bank', ranOutTileAssignments: 0, totalTileAssignments: 541, lateTileFrames: { min: 3, max: 7 } },
    limitation: 'The LMC has not been measured on the S23. Browser screenshots and its 33-layer budget do not establish phone performance parity.'
  };
  const path = 'src/objects/lmc-volume/source/preparation/l36/phone-qualification.json';
  await writeFile(path, JSON.stringify(record, null, 2) + '\n');
  const manifestPath = 'src/objects/lmc-volume/source/manifest.json', manifest = rec(await json(manifestPath));
  manifest.generatedIntermediates = [...array(manifest.generatedIntermediates).filter(value => rec(value).id !== 'l36-phone-qualification'), {
    id: 'l36-phone-qualification', path, bytes: (await stat(path)).size, generator: record.generator,
    sourceBinding: { kind: 'local', reason: 'Live device availability check. This explicitly records a skipped performance test, not a successful trace.' }
  }];
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('LMC_PHONE_QUALIFICATION_SKIPPED ' + states.length);
}
if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await recordPhoneAvailability();
