/** The only cssEarth process boundary into the pinned astronomy packages. Operations are explicit rather than extensible:
 * Astroquery and PyVO own supported remote protocols; the caller owns validation and scientific meaning. */
import { spawn } from 'node:child_process';
import { requireArray, requireRecord, requireString } from '../../source-values.mts';
import { astroqueryToolchain } from './toolchain.mts';

export type HorizonsEpochs = readonly number[] | { readonly start: string; readonly stop: string; readonly step: string };
export type AstroqueryRequest =
  | { readonly operation: 'mast-service'; readonly service: string; readonly parameters: Readonly<Record<string, unknown>>; readonly pagesize?: number; readonly page?: number }
  | { readonly operation: 'mast-download'; readonly uri: string; readonly destination: string }
  | { readonly operation: 'tap-query'; readonly service: string; readonly query: string; readonly maxrec?: number }
  | { readonly operation: 'alma-data-info'; readonly ids: readonly string[]; readonly expandTarfiles?: boolean }
  | { readonly operation: 'vizier-region'; readonly catalog: string; readonly ra: number; readonly dec: number; readonly radiusDegrees: number; readonly columns: readonly string[] }
  | { readonly operation: 'horizons-ephemerides'; readonly id: string; readonly location: string; readonly epochs: HorizonsEpochs; readonly quantities: string; readonly raw?: boolean }
  | { readonly operation: 'horizons-vectors'; readonly id: string; readonly location: string; readonly epochs: HorizonsEpochs; readonly refplane?: 'ecliptic' | 'earth' | 'body' | 'frame'; readonly aberrations?: 'geometric' | 'astrometric' | 'apparent'; readonly raw?: boolean };

export interface AstroqueryAnswer {
  readonly schema: 'cssearth-astroquery-answer@2';
  readonly astroquery: string;
  readonly pyvo?: string;
  readonly operation: AstroqueryRequest['operation'];
  readonly rows?: readonly Record<string, unknown>[];
  readonly files?: readonly string[];
  readonly text?: string;
  readonly tap?: { readonly queryStatus: string; readonly complete: boolean };
}

const PYTHON = String.raw`
import json, math, sys
import astroquery
import pyvo
import numpy as np
from astropy.coordinates import SkyCoord
from astropy import units as u

request = json.load(sys.stdin)

def value(item):
    if item is None or item is np.ma.masked or np.ma.is_masked(item):
        return None
    if isinstance(item, bytes):
        return item.decode('utf-8', errors='replace')
    if isinstance(item, np.generic):
        return value(item.item())
    if isinstance(item, (list, tuple, np.ndarray)):
        return [value(entry) for entry in item]
    if hasattr(item, 'value') and not isinstance(item, (str, int, float, bool)):
        try:
            return value(item.value)
        except Exception:
            pass
    if isinstance(item, float) and not math.isfinite(item):
        return None
    if isinstance(item, (str, int, float, bool)):
        return item
    return str(item)

def rows(table):
    if table is None:
        return []
    return [{str(name): value(row[name]) for name in table.colnames} for row in table]

operation = request['operation']
answer = {'schema': 'cssearth-astroquery-answer@2', 'astroquery': astroquery.__version__, 'operation': operation}

if operation == 'mast-service':
    from astroquery.mast import Mast
    table = Mast.service_request(request['service'], request['parameters'], pagesize=request.get('pagesize'), page=request.get('page'))
    answer['rows'] = rows(table)
elif operation == 'mast-download':
    from astroquery.mast import Observations
    class ProgressToStderr:
        def __init__(self, stream): self.stream = stream
        def write(self, value): return self.stream.write(value)
        def flush(self): return self.stream.flush()
        def isatty(self): return True
        def __getattr__(self, name): return getattr(self.stream, name)
    answer_stream = sys.stdout
    sys.stdout = ProgressToStderr(sys.stderr)
    try:
        status, message, url = Observations.download_file(request['uri'], local_path=request['destination'], cache=False, verbose=True)
    finally:
        sys.stdout = answer_stream
    if status not in ('COMPLETE', 'SKIPPED'):
        raise RuntimeError(f'MAST download {status}: {message}')
    answer['files'] = [request['destination']]
elif operation == 'tap-query':
    answer['pyvo'] = pyvo.__version__
    result = pyvo.dal.TAPService(request['service']).search(request['query'], maxrec=request.get('maxrec'))
    status = str(result.query_status)
    answer['tap'] = {'queryStatus': status, 'complete': status.upper() == 'OK'}
    answer['rows'] = rows(result.to_table())
elif operation == 'alma-data-info':
    from astroquery.alma import Alma
    answer['rows'] = rows(Alma.get_data_info(request['ids'], expand_tarfiles=request.get('expandTarfiles', False)))
elif operation == 'vizier-region':
    from astroquery.vizier import Vizier
    client = Vizier(columns=request['columns'], row_limit=-1)
    tables = client.query_region(SkyCoord(request['ra'] * u.deg, request['dec'] * u.deg, frame='icrs'), radius=request['radiusDegrees'] * u.deg, catalog=request['catalog'])
    answer['rows'] = rows(tables[0]) if len(tables) else []
elif operation == 'horizons-ephemerides':
    from astroquery.jplhorizons import Horizons
    result = Horizons(id=request['id'], location=request['location'], epochs=request['epochs']).ephemerides(
        quantities=request['quantities'], extra_precision=True, get_raw_response=request.get('raw', False), cache=False)
    if request.get('raw', False): answer['text'] = result if isinstance(result, str) else result.text
    else: answer['rows'] = rows(result)
elif operation == 'horizons-vectors':
    from astroquery.jplhorizons import Horizons
    result = Horizons(id=request['id'], location=request['location'], epochs=request['epochs']).vectors(
        refplane=request.get('refplane', 'ecliptic'), aberrations=request.get('aberrations', 'geometric'),
        get_raw_response=request.get('raw', False), cache=False)
    if request.get('raw', False): answer['text'] = result if isinstance(result, str) else result.text
    else: answer['rows'] = rows(result)
else:
    raise ValueError(f'Unsupported Astroquery operation: {operation}')

json.dump(answer, sys.stdout, allow_nan=False, separators=(',', ':'))
`;

export type AstroqueryRunner = (python: string, env: NodeJS.ProcessEnv, request: AstroqueryRequest) => Promise<unknown>;

const ANSI = /\u001b\[[0-9;]*m/gu;
function mastProgress(write: (line: string) => void) {
  let buffered = '', announced = false, lastStep = -1;
  return (chunk: string, flush = false) => {
    buffered += chunk;
    const parts = buffered.split(/[\r\n]+/u);
    buffered = flush ? '' : parts.pop() ?? '';
    for (const raw of parts) {
      const line = raw.replace(ANSI, '').trim();
      if (!line) continue;
      if (line.startsWith('Downloading URL ')) {
        if (!announced) { announced = true; write(line); }
        continue;
      }
      const percent = /\(\s*([0-9]+(?:\.[0-9]+)?)%\)/u.exec(line);
      if (!percent) continue;
      const step = Math.min(20, Math.floor(Number(percent[1]) / 5));
      if (step > lastStep) { lastStep = step; write(line); }
    }
  };
}

export const runAstroqueryProcess: AstroqueryRunner = (python, env, request) => new Promise((done, fail) => {
  const child = spawn(python, ['-c', PYTHON], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  const forwardProgress = mastProgress(line => process.stderr.write(`${line}\n`));
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => {
    stderr += chunk;
    if (request.operation === 'mast-download') forwardProgress(chunk);
  });
  child.on('error', fail);
  child.on('close', code => {
    if (request.operation === 'mast-download') forwardProgress('', true);
    if (code !== 0) fail(new Error(`Astroquery ${request.operation} failed (status ${code}): ${stderr.slice(-4000)}`));
    else { try { done(JSON.parse(stdout)); } catch (error) { fail(new Error(`Astroquery ${request.operation} returned invalid JSON: ${String(error)}`)); } }
  });
  child.stdin.end(JSON.stringify(request));
});

export function parseAstroqueryAnswer(value: unknown, request: AstroqueryRequest, version = '0.4.11', pyvoVersion = '1.9.1'): AstroqueryAnswer {
  const raw = requireRecord(value, 'Astroquery answer');
  if (raw.schema !== 'cssearth-astroquery-answer@2' || raw.astroquery !== version || raw.operation !== request.operation)
    throw new TypeError(`Astroquery answered with the wrong contract, version or operation.`);
  if (request.operation === 'tap-query' && raw.pyvo !== pyvoVersion) throw new TypeError('PyVO answered with the wrong version.');
  const expectsRows = request.operation !== 'mast-download' && !((request.operation === 'horizons-ephemerides' || request.operation === 'horizons-vectors') && request.raw);
  if (expectsRows && raw.rows === undefined) throw new TypeError(`Astroquery ${request.operation} returned no rows field.`);
  const rows = raw.rows === undefined ? undefined : requireArray(raw.rows, 'Astroquery rows').map((row, index) => requireRecord(row, `Astroquery row ${index}`));
  const files = raw.files === undefined ? undefined : requireArray(raw.files, 'Astroquery files').map((file, index) => requireString(file, `Astroquery file ${index}`));
  const answerText = raw.text === undefined ? undefined : requireString(raw.text, 'Astroquery text');
  const tap = request.operation === 'tap-query' ? requireRecord(raw.tap, 'TAP status') : undefined;
  if (tap && typeof tap.complete !== 'boolean') throw new TypeError('TAP status states no completeness boolean.');
  const tapStatus = tap ? requireString(tap.queryStatus, 'TAP query status') : undefined;
  if (tap && tap.complete !== (tapStatus!.toUpperCase() === 'OK')) throw new TypeError(`TAP status ${tapStatus} contradicts its completeness boolean.`);
  return { schema: 'cssearth-astroquery-answer@2', astroquery: version, operation: request.operation,
    ...(request.operation === 'tap-query' ? { pyvo: pyvoVersion, tap: { queryStatus: tapStatus!, complete: tap!.complete as boolean } } : {}),
    ...(rows ? { rows } : {}), ...(files ? { files } : {}), ...(answerText === undefined ? {} : { text: answerText }) };
}

export async function astroquery(request: AstroqueryRequest, runner: AstroqueryRunner = runAstroqueryProcess): Promise<AstroqueryAnswer> {
  const toolchain = await astroqueryToolchain();
  return parseAstroqueryAnswer(await runner(toolchain.python, toolchain.env, request), request, toolchain.version, toolchain.pyvoVersion);
}

export async function astroqueryRows(request: Extract<AstroqueryRequest, { readonly operation: 'mast-service' | 'tap-query' | 'alma-data-info' | 'vizier-region' | 'horizons-ephemerides' | 'horizons-vectors' }>) {
  const answer = await astroquery(request);
  if (request.operation === 'tap-query' && !answer.tap?.complete)
    throw new Error(`TAP query was incomplete (${answer.tap?.queryStatus ?? 'status missing'}); its rows cannot build a complete ledger.`);
  return answer.rows!;
}

export async function astroqueryText(request: Extract<AstroqueryRequest, { readonly operation: 'horizons-ephemerides' | 'horizons-vectors' }>) {
  const text = (await astroquery({ ...request, raw: true })).text;
  if (text === undefined) throw new Error(`Astroquery ${request.operation} returned no text.`);
  return text;
}

/** Generic VO table access belongs to PyVO. This string view keeps the archive ledgers stable while PyVO owns TAP and VOTable parsing. */
export async function tapRows(service: string, query: string, maxrec?: number): Promise<Record<string, string>[]> {
  const rows = await astroqueryRows({ operation: 'tap-query', service, query, ...(maxrec === undefined ? {} : { maxrec }) });
  return rows.map(row => Object.fromEntries(Object.entries(row).map(([name, value]) => [name, value === null ? '' : String(value)])));
}
