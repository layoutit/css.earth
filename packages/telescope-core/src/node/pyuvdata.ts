/** The pinned pyuvdata boundary for UVFITS visibilities, run in the astroquery toolchain's Python. */
import { spawn } from 'node:child_process';
import { PYUVDATA_UVFITS_SCHEMA, parsePyuvdataUvfitsAnswer, parsePyuvdataUvfitsRequest, type PyuvdataUvfitsRequest, type PyuvdataUvfitsAnswer } from '@cssearth/objects';
import { astroqueryToolchain } from './toolchain/toolchain.js';

const PYUVDATA_UVFITS = String.raw`
import json, warnings, sys
import pyuvdata
from pyuvdata import UVData
request = json.load(sys.stdin)
pin = request['file']
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
answer = {'schema': '${PYUVDATA_UVFITS_SCHEMA}', 'pyuvdata': pyuvdata.__version__, 'inspection': inspection,
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
export async function pyuvdataUvfits(request: PyuvdataUvfitsRequest, runner: PyuvdataUvfitsRunner = runPyuvdataUvfitsProcess): Promise<PyuvdataUvfitsAnswer> { const toolchain = await astroqueryToolchain(); return parsePyuvdataUvfitsAnswer(await runner(toolchain.python, toolchain.env, parsePyuvdataUvfitsRequest(request)), request, toolchain.pyuvdataVersion); }
