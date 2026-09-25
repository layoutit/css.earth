/** The pinned pyuvdata boundary for UVFITS visibilities, run in the astroquery toolchain's Python. */
import { spawn } from 'node:child_process';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { astroqueryToolchain } from './toolchain.js';

/** pyuvdata owns UVFITS random-group conventions, polarization decoding, UVW and flags. */
export interface PyuvdataUvfitsRequest {
  readonly operation: 'uvfits-visibility-inspect' | 'uvfits-visibility-export' | 'uvfits-amplitude-phase-diagnostics' | 'uvfits-uv-coverage-diagnostics';
  readonly file: { readonly path: string };
  readonly selection?: { readonly field: string; readonly timeStartJulianDate: number; readonly timeEndJulianDate: number; readonly antenna1: number; readonly antenna2: number; readonly rowOffset: number; readonly rowCount: number; readonly channelStart: number; readonly channelCount: number; readonly polarization: number };
}
export interface PyuvdataUvfitsAnswer {
  readonly schema: 'cssearth-pyuvdata-uvfits@1'; readonly pyuvdata: string;
  readonly inspection: { readonly telescope: string; readonly target: string; readonly rows: number; readonly channels: number; readonly polarizations: readonly number[]; readonly samples: number; readonly frequencyHz: { readonly first: number; readonly increment: number } };
  readonly notices: readonly string[];
  readonly amplitudePhase?: { readonly unflaggedSamples: number; readonly minimumAmplitude: number; readonly maximumAmplitude: number; readonly meanAmplitude: number; readonly circularMeanPhaseRadians: number };
  readonly uvCoverage?: { readonly unflaggedSamples: number; readonly uMeters: { readonly minimum: number; readonly maximum: number }; readonly vMeters: { readonly minimum: number; readonly maximum: number }; readonly wMeters: { readonly minimum: number; readonly maximum: number } };
  readonly rows?: readonly { readonly row: number; readonly timeJulianDate: number; readonly antenna1: number; readonly antenna2: number; readonly uvwMeters: readonly [number, number, number]; readonly frequencyHz: number; readonly polarization: number; readonly real: number; readonly imaginary: number; readonly weight: number; readonly flagged: boolean }[];
}
const PYUVDATA_UVFITS = String.raw`
import hashlib, json, warnings, sys
import pyuvdata
from pyuvdata import UVData
request = json.load(sys.stdin)
pin = request['file']
with open(pin['path'], 'rb') as source:
    raw = source.read()
with warnings.catch_warnings(record=True) as caught:
    warnings.simplefilter('always')
    data = UVData.from_file(pin['path'])
phase_id = int(data.phase_center_id_array[0])
target = str(data.phase_center_catalog[phase_id]['cat_name'])
frequency = data.freq_array
inspection = {
    'telescope': str(data.telescope.name), 'target': target,
    'rows': int(data.Nblts), 'channels': int(data.Nfreqs),
    'polarizations': [int(value) for value in data.polarization_array.tolist()],
    'samples': int(data.Nblts * data.Nfreqs * data.Npols),
    'frequencyHz': {'first': float(frequency[0]), 'increment': float(frequency[1] - frequency[0]) if data.Nfreqs > 1 else 1.0}}
answer = {'schema': 'cssearth-pyuvdata-uvfits@1', 'pyuvdata': pyuvdata.__version__, 'inspection': inspection,
          'notices': [str(item.message) for item in caught]}
if request['operation'] != 'uvfits-visibility-inspect':
    s = request['selection']
    row_offset, row_count = s['rowOffset'], s['rowCount']
    channel_start, channel_count = s['channelStart'], s['channelCount']
    pol = s['polarization']
    if s['field'] != target: raise ValueError('UVFITS selection field does not match its single phase centre')
    if type(s['timeStartJulianDate']) not in (int, float) or type(s['timeEndJulianDate']) not in (int, float) or s['timeStartJulianDate'] > s['timeEndJulianDate']: raise ValueError('UVFITS selection time window is invalid')
    if any(type(value) is not int for value in (s['antenna1'], s['antenna2'], row_offset, row_count, channel_start, channel_count, pol)):
        raise ValueError('UVFITS selection coordinates must be integers')
    if row_offset < 0 or row_count < 1 or channel_start < 0 or channel_count < 1 or channel_start + channel_count > data.Nfreqs: raise ValueError('UVFITS selection is outside native channel bounds')
    if row_count * channel_count > 4096: raise ValueError('UVFITS export is limited to 4096 selected complex samples')
    indices = [int(value) for value in data.polarization_array.tolist()]
    if pol not in indices: raise ValueError('UVFITS selection has no matching AIPS polarization code')
    p = indices.index(pol); matched = [row for row in range(data.Nblts) if s['timeStartJulianDate'] <= float(data.time_array[row]) <= s['timeEndJulianDate'] and s['antenna1'] == int(data.ant_1_array[row]) and s['antenna2'] == int(data.ant_2_array[row])]
    if row_offset + row_count > len(matched): raise ValueError('UVFITS selection is outside matching field/time/baseline rows')
    rows = []
    for row in matched[row_offset:row_offset + row_count]:
      for channel in range(channel_start, channel_start + channel_count):
        sample = data.data_array[row, channel, p]
        rows.append({'row': row, 'timeJulianDate': float(data.time_array[row]), 'antenna1': int(data.ant_1_array[row]), 'antenna2': int(data.ant_2_array[row]),
          'uvwMeters': [float(value) for value in data.uvw_array[row]], 'frequencyHz': float(frequency[channel]), 'polarization': pol,
          'real': float(sample.real), 'imaginary': float(sample.imag), 'weight': float(data.nsample_array[row, channel, p]), 'flagged': bool(data.flag_array[row, channel, p])})
    if request['operation'] == 'uvfits-visibility-export': answer['rows'] = rows
    usable = [entry for entry in rows if not entry['flagged']]
    if not usable: raise ValueError('UVFITS selection has no unflagged samples for diagnostics')
    amplitudes = [(entry['real'] ** 2 + entry['imaginary'] ** 2) ** .5 for entry in usable]
    if request['operation'] == 'uvfits-amplitude-phase-diagnostics':
      import math
      phases = [math.atan2(entry['imaginary'], entry['real']) for entry in usable]
      answer['amplitudePhase'] = {'unflaggedSamples': len(usable), 'minimumAmplitude': min(amplitudes), 'maximumAmplitude': max(amplitudes), 'meanAmplitude': sum(amplitudes) / len(amplitudes), 'circularMeanPhaseRadians': math.atan2(sum(math.sin(value) for value in phases), sum(math.cos(value) for value in phases))}
    if request['operation'] == 'uvfits-uv-coverage-diagnostics':
      answer['uvCoverage'] = {'unflaggedSamples': len(usable), 'uMeters': {'minimum': min(entry['uvwMeters'][0] for entry in usable), 'maximum': max(entry['uvwMeters'][0] for entry in usable)}, 'vMeters': {'minimum': min(entry['uvwMeters'][1] for entry in usable), 'maximum': max(entry['uvwMeters'][1] for entry in usable)}, 'wMeters': {'minimum': min(entry['uvwMeters'][2] for entry in usable), 'maximum': max(entry['uvwMeters'][2] for entry in usable)}}
print(json.dumps(answer, separators=(',', ':')))
`;
export type PyuvdataUvfitsRunner = (python: string, env: NodeJS.ProcessEnv, request: PyuvdataUvfitsRequest) => Promise<unknown>;
export const runPyuvdataUvfitsProcess: PyuvdataUvfitsRunner = (python, env, request) => new Promise((done, fail) => {
  const child = spawn(python, ['-c', PYUVDATA_UVFITS], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] }); let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; }); child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; }); child.on('error', fail);
  child.on('close', code => { if (code !== 0) fail(new Error(`pyuvdata ${request.operation} failed (status ${code}): ${stderr.slice(-4000)}`)); else try { done(JSON.parse(stdout)); } catch (error) { fail(new Error(`pyuvdata ${request.operation} returned invalid JSON: ${String(error)}`)); } }); child.stdin.end(JSON.stringify(request));
});
function integer(value: unknown, label: string, minimum: number): number { const n = requireFiniteNumber(value, label); if (!Number.isSafeInteger(n) || n < minimum) throw new TypeError(`${label} must be an integer at least ${minimum}.`); return n; }
function uvfitsRequest(request: PyuvdataUvfitsRequest): PyuvdataUvfitsRequest {
  const file = { path: requireString(requireRecord(request.file, 'UVFITS file').path, 'UVFITS file path') }; if (!['uvfits-visibility-inspect', 'uvfits-visibility-export', 'uvfits-amplitude-phase-diagnostics', 'uvfits-uv-coverage-diagnostics'].includes(request.operation)) throw new TypeError('Unsupported pyuvdata UVFITS operation.');
  if (request.operation === 'uvfits-visibility-inspect') { if (request.selection !== undefined) throw new TypeError('UVFITS inspect accepts no selection.'); return { operation: request.operation, file }; }
  const s = requireRecord(request.selection, 'UVFITS selection'), start = requireFiniteNumber(s.timeStartJulianDate, 'UVFITS time start'), end = requireFiniteNumber(s.timeEndJulianDate, 'UVFITS time end'); if (start > end) throw new TypeError('UVFITS time selection is inverted.'); return { operation: request.operation, file, selection: { field: requireString(s.field, 'UVFITS field'), timeStartJulianDate: start, timeEndJulianDate: end, antenna1: integer(s.antenna1, 'antenna1', 0), antenna2: integer(s.antenna2, 'antenna2', 0), rowOffset: integer(s.rowOffset, 'rowOffset', 0), rowCount: integer(s.rowCount, 'rowCount', 1), channelStart: integer(s.channelStart, 'channelStart', 0), channelCount: integer(s.channelCount, 'channelCount', 1), polarization: integer(s.polarization, 'polarization', -8) } };
}
export function parsePyuvdataUvfitsAnswer(value: unknown, request: PyuvdataUvfitsRequest, version = '3.2.4'): PyuvdataUvfitsAnswer {
  const checked = uvfitsRequest(request), raw = requireRecord(value, 'pyuvdata UVFITS answer'); if (raw.schema !== 'cssearth-pyuvdata-uvfits@1' || raw.pyuvdata !== version) throw new TypeError('pyuvdata answered with the wrong contract or version.');
  const info = requireRecord(raw.inspection, 'pyuvdata UVFITS inspection'), frequency = requireRecord(info.frequencyHz, 'pyuvdata UVFITS frequencies'); const polarizations = requireArray(info.polarizations, 'pyuvdata UVFITS polarizations').map((value, index) => integer(value, `polarization ${index}`, -8));
  const inspection = { telescope: requireString(info.telescope), target: requireString(info.target), rows: integer(info.rows, 'UVFITS rows', 1), channels: integer(info.channels, 'UVFITS channels', 1), polarizations, samples: integer(info.samples, 'UVFITS samples', 1), frequencyHz: { first: requireFiniteNumber(frequency.first, 'UVFITS first frequency'), increment: requireFiniteNumber(frequency.increment, 'UVFITS frequency increment') } };
  if (!inspection.telescope || !inspection.target || !polarizations.length || inspection.frequencyHz.increment === 0 || inspection.samples !== inspection.rows * inspection.channels * polarizations.length) throw new TypeError('Invalid pyuvdata UVFITS inspection.');
  const notices = requireArray(raw.notices, 'pyuvdata UVFITS notices').map((value, index) => requireString(value, `pyuvdata UVFITS notice ${index}`));
  const rows = raw.rows === undefined ? undefined : requireArray(raw.rows, 'pyuvdata UVFITS rows').map((value, index) => { const row = requireRecord(value, `pyuvdata UVFITS row ${index}`), uvw = requireArray(row.uvwMeters, `pyuvdata UVFITS row ${index} UVW`); if (uvw.length !== 3) throw new TypeError('pyuvdata UVFITS UVW must have three metres values.'); return { row: integer(row.row, 'UVFITS row', 0), timeJulianDate: requireFiniteNumber(row.timeJulianDate), antenna1: integer(row.antenna1, 'antenna1', 0), antenna2: integer(row.antenna2, 'antenna2', 0), uvwMeters: uvw.map((entry, axis) => requireFiniteNumber(entry, `UVW axis ${axis}`)) as [number, number, number], frequencyHz: requireFiniteNumber(row.frequencyHz), polarization: integer(row.polarization, 'polarization', -8), real: requireFiniteNumber(row.real), imaginary: requireFiniteNumber(row.imaginary), weight: requireFiniteNumber(row.weight), flagged: (() => { if (typeof row.flagged !== 'boolean') throw new TypeError('UVFITS flag must be boolean.'); return row.flagged; })() }; });
  const range = (value: unknown, label: string) => { const r = requireRecord(value, label), minimum = requireFiniteNumber(r.minimum), maximum = requireFiniteNumber(r.maximum); if (minimum > maximum) throw new TypeError(`${label} is inverted.`); return { minimum, maximum }; };
  const amplitude = raw.amplitudePhase === undefined ? undefined : requireRecord(raw.amplitudePhase, 'pyuvdata amplitude/phase diagnostic'), coverage = raw.uvCoverage === undefined ? undefined : requireRecord(raw.uvCoverage, 'pyuvdata UV coverage diagnostic');
  const amplitudePhase = amplitude ? { unflaggedSamples: integer(amplitude.unflaggedSamples, 'unflagged samples', 1), minimumAmplitude: requireFiniteNumber(amplitude.minimumAmplitude), maximumAmplitude: requireFiniteNumber(amplitude.maximumAmplitude), meanAmplitude: requireFiniteNumber(amplitude.meanAmplitude), circularMeanPhaseRadians: requireFiniteNumber(amplitude.circularMeanPhaseRadians) } : undefined;
  const uvCoverage = coverage ? { unflaggedSamples: integer(coverage.unflaggedSamples, 'unflagged samples', 1), uMeters: range(coverage.uMeters, 'u coverage'), vMeters: range(coverage.vMeters, 'v coverage'), wMeters: range(coverage.wMeters, 'w coverage') } : undefined;
  if (checked.operation === 'uvfits-visibility-inspect' && (rows !== undefined || amplitudePhase !== undefined || uvCoverage !== undefined)) throw new TypeError('UVFITS inspection returned selected data.');
  if (checked.operation === 'uvfits-visibility-export') { if (!rows) throw new TypeError('UVFITS export returned no rows.'); const s = checked.selection!; if (rows.length !== s.rowCount * s.channelCount || rows.some(row => row.polarization !== s.polarization || row.antenna1 !== s.antenna1 || row.antenna2 !== s.antenna2 || row.timeJulianDate < s.timeStartJulianDate || row.timeJulianDate > s.timeEndJulianDate)) throw new TypeError('UVFITS export does not match its bounded selection.'); }
  if (checked.operation === 'uvfits-amplitude-phase-diagnostics' && (rows !== undefined || !amplitudePhase || uvCoverage !== undefined)) throw new TypeError('UVFITS amplitude/phase diagnostic is invalid.'); if (checked.operation === 'uvfits-uv-coverage-diagnostics' && (rows !== undefined || amplitudePhase !== undefined || !uvCoverage)) throw new TypeError('UVFITS UV-coverage diagnostic is invalid.');
  return { schema: 'cssearth-pyuvdata-uvfits@1', pyuvdata: version, inspection, notices, ...(rows ? { rows } : {}), ...(amplitudePhase ? { amplitudePhase } : {}), ...(uvCoverage ? { uvCoverage } : {}) };
}
export async function pyuvdataUvfits(request: PyuvdataUvfitsRequest, runner: PyuvdataUvfitsRunner = runPyuvdataUvfitsProcess): Promise<PyuvdataUvfitsAnswer> { const toolchain = await astroqueryToolchain(); return parsePyuvdataUvfitsAnswer(await runner(toolchain.python, toolchain.env, uvfitsRequest(request)), request, toolchain.pyuvdataVersion); }
