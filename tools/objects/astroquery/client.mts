/** The only cssEarth process boundary into Astroquery. Operations are deliberately explicit: this is an archive client, not a
 * plugin system. Astroquery owns the remote protocol; the caller owns validation and scientific meaning. */
import { spawn } from 'node:child_process';
import { requireArray, requireRecord, requireString } from '../../source-values.mts';
import { astroqueryToolchain } from './toolchain.mts';

export type AstroqueryRequest =
  | { readonly operation: 'mast-service'; readonly service: string; readonly parameters: Readonly<Record<string, unknown>>; readonly pagesize?: number; readonly page?: number }
  | { readonly operation: 'mast-download'; readonly uri: string; readonly destination: string }
  | { readonly operation: 'alma-tap'; readonly query: string }
  | { readonly operation: 'alma-data-info'; readonly ids: readonly string[]; readonly expandTarfiles?: boolean }
  | { readonly operation: 'vizier-region'; readonly catalog: string; readonly ra: number; readonly dec: number; readonly radiusDegrees: number; readonly columns: readonly string[] };

export interface AstroqueryAnswer {
  readonly schema: 'cssearth-astroquery-answer@1';
  readonly astroquery: string;
  readonly operation: AstroqueryRequest['operation'];
  readonly rows?: readonly Record<string, unknown>[];
  readonly files?: readonly string[];
}

const PYTHON = String.raw`
import json, math, sys
import astroquery
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
answer = {'schema': 'cssearth-astroquery-answer@1', 'astroquery': astroquery.__version__, 'operation': operation}

if operation == 'mast-service':
    from astroquery.mast import Mast
    table = Mast.service_request(request['service'], request['parameters'], pagesize=request.get('pagesize'), page=request.get('page'))
    answer['rows'] = rows(table)
elif operation == 'mast-download':
    from astroquery.mast import Observations
    status, message, url = Observations.download_file(request['uri'], local_path=request['destination'], cache=False, verbose=False)
    if status not in ('COMPLETE', 'SKIPPED'):
        raise RuntimeError(f'MAST download {status}: {message}')
    answer['files'] = [request['destination']]
elif operation == 'alma-tap':
    from astroquery.alma import Alma
    answer['rows'] = rows(Alma.query_tap(request['query']).to_table())
elif operation == 'alma-data-info':
    from astroquery.alma import Alma
    answer['rows'] = rows(Alma.get_data_info(request['ids'], expand_tarfiles=request.get('expandTarfiles', False)))
elif operation == 'vizier-region':
    from astroquery.vizier import Vizier
    client = Vizier(columns=request['columns'], row_limit=-1)
    tables = client.query_region(SkyCoord(request['ra'] * u.deg, request['dec'] * u.deg, frame='icrs'), radius=request['radiusDegrees'] * u.deg, catalog=request['catalog'])
    answer['rows'] = rows(tables[0]) if len(tables) else []
else:
    raise ValueError(f'Unsupported Astroquery operation: {operation}')

json.dump(answer, sys.stdout, allow_nan=False, separators=(',', ':'))
`;

export type AstroqueryRunner = (python: string, env: NodeJS.ProcessEnv, request: AstroqueryRequest) => Promise<unknown>;

export const runAstroqueryProcess: AstroqueryRunner = (python, env, request) => new Promise((done, fail) => {
  const child = spawn(python, ['-c', PYTHON], { env: { ...process.env, ...env }, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  child.stdout.setEncoding('utf8').on('data', chunk => { stdout += chunk; });
  child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
  child.on('error', fail);
  child.on('close', code => {
    if (code !== 0) fail(new Error(`Astroquery ${request.operation} failed (status ${code}): ${stderr.slice(-4000)}`));
    else { try { done(JSON.parse(stdout)); } catch (error) { fail(new Error(`Astroquery ${request.operation} returned invalid JSON: ${String(error)}`)); } }
  });
  child.stdin.end(JSON.stringify(request));
});

export function parseAstroqueryAnswer(value: unknown, request: AstroqueryRequest, version = '0.4.11'): AstroqueryAnswer {
  const raw = requireRecord(value, 'Astroquery answer');
  if (raw.schema !== 'cssearth-astroquery-answer@1' || raw.astroquery !== version || raw.operation !== request.operation)
    throw new TypeError(`Astroquery answered with the wrong contract, version or operation.`);
  const rows = raw.rows === undefined ? undefined : requireArray(raw.rows, 'Astroquery rows').map((row, index) => requireRecord(row, `Astroquery row ${index}`));
  const files = raw.files === undefined ? undefined : requireArray(raw.files, 'Astroquery files').map((file, index) => requireString(file, `Astroquery file ${index}`));
  return { schema: 'cssearth-astroquery-answer@1', astroquery: version, operation: request.operation, ...(rows ? { rows } : {}), ...(files ? { files } : {}) };
}

export async function astroquery(request: AstroqueryRequest, runner: AstroqueryRunner = runAstroqueryProcess): Promise<AstroqueryAnswer> {
  const toolchain = await astroqueryToolchain();
  return parseAstroqueryAnswer(await runner(toolchain.python, toolchain.env, request), request, toolchain.version);
}

export async function astroqueryRows(request: Extract<AstroqueryRequest, { readonly operation: 'mast-service' | 'alma-tap' | 'alma-data-info' | 'vizier-region' }>) {
  return (await astroquery(request)).rows ?? [];
}
