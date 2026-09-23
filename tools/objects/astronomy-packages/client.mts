/** The only cssEarth process boundary into the pinned astronomy packages. Operations are explicit rather than extensible:
 * Astroquery and PyVO own supported remote protocols; the caller owns validation and scientific meaning. */
import { spawn } from 'node:child_process';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '../../sources/source-values.mts';
import { astroqueryToolchain } from './toolchain.mts';
import { parseMetadata, parsePin, type Json, type Pin, type MetadataResponse } from '../telescopes/vo/contracts.mts';
export class ArchiveTransportError extends Error {}
export type VoFailureCode = 'authentication' | 'no-content' | 'byte-limit' | 'protocol' | 'transport' | 'interrupted' | 'identity' | 'local-io';
export class VoAccessError extends Error {
  readonly code: VoFailureCode;
  readonly httpStatus: number | null;
  constructor(code: VoFailureCode, message: string, httpStatus: number | null) { super(message); this.name = 'VoAccessError'; this.code = code; this.httpStatus = httpStatus; }
}

export type HorizonsEpochs = readonly number[] | { readonly start: string; readonly stop: string; readonly step: string };
export type AstroqueryRequest =
  | { readonly operation: 'vo-download'; readonly url: string; readonly destination: string; readonly byteLimit: number; readonly format?: 'fits' | 'zip' | 'tar'; readonly fitsProfile?: 'raster' | 'bintable'; readonly parameters: Readonly<Record<string, Json>>; readonly allowedPrivateHosts?: readonly string[];
      readonly descriptor?: { readonly file: Pin; readonly row: number; readonly serviceId: string } }
  | { readonly operation: 'vo-tap'; readonly service: string; readonly query: string; readonly maxrec: number; readonly directory: string; readonly byteLimit: number; readonly timeFormat?: 'mjd' | 'jd'; readonly timeScale?: 'utc' | 'tai' | 'tt' | 'tdb'; readonly timeModel?: 'epn-tap-2.0' }
  | { readonly operation: 'vo-links'; readonly url: string; readonly parameters?: Readonly<Record<string, Json>>; readonly directory: string; readonly byteLimit: number; readonly allowedPrivateHosts?: readonly string[] }
  | { readonly operation: 'vo-parse'; readonly file: string; readonly url: string; readonly byteLimit: number; readonly timeFormat?: 'mjd' | 'jd'; readonly timeScale?: 'utc' | 'tai' | 'tt' | 'tdb'; readonly timeModel?: 'epn-tap-2.0' }
  | { readonly operation: 'mast-service'; readonly service: string; readonly parameters: Readonly<Record<string, unknown>>; readonly pagesize?: number; readonly page?: number }
  | { readonly operation: 'mast-download'; readonly uri: string; readonly destination: string }
  | { readonly operation: 'tap-query'; readonly service: string; readonly query: string; readonly maxrec?: number }
  | { readonly operation: 'alma-data-info'; readonly ids: readonly string[]; readonly expandTarfiles?: boolean }
  | { readonly operation: 'vizier-region'; readonly catalog: string; readonly ra: number; readonly dec: number; readonly radiusDegrees: number; readonly columns: readonly string[] }
  | { readonly operation: 'horizons-ephemerides'; readonly id: string; readonly location: string; readonly epochs: HorizonsEpochs; readonly quantities: string; readonly raw?: boolean }
  | { readonly operation: 'horizons-vectors'; readonly id: string; readonly location: string; readonly epochs: HorizonsEpochs; readonly refplane?: 'ecliptic' | 'earth' | 'body' | 'frame'; readonly aberrations?: 'geometric' | 'astrometric' | 'apparent'; readonly raw?: boolean };

export interface AstroqueryAnswer {
  readonly transfer?: { readonly file: Pin; readonly effectiveUrl: string; readonly contentType: string | null; readonly etag: string | null; readonly lastModified: string | null };
  readonly vo?: MetadataResponse;
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

# Check every request, including each redirect. Archive rows and DataLink descriptors
# may name arbitrary URLs; a DNS name is checked against all of its resolved addresses.
def check_vo_url(url):
    import ipaddress, socket
    from urllib.parse import urlsplit
    parsed = urlsplit(url)
    if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError('Unsupported VO access URL')
    host = parsed.hostname.lower().rstrip('.')
    allowed = request.get('allowedPrivateHosts') or []
    if host in allowed:
        return
    if host == 'localhost' or host.endswith('.localhost'):
        raise ValueError('VO access URL targets a non-public address')
    addresses = socket.getaddrinfo(host, parsed.port or (443 if parsed.scheme == 'https' else 80), type=socket.SOCK_STREAM)
    if not addresses or any(not ipaddress.ip_address(item[4][0]).is_global for item in addresses):
        raise ValueError('VO access URL targets a non-public address')

class SafeVoSession:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.trust_env = False  # Archive URLs must connect directly, never through an ambient proxy.

    def send(self, prepared_request, **kwargs):
        import ipaddress, socket
        check_vo_url(prepared_request.url)
        original = socket.getaddrinfo
        allowed = request.get('allowedPrivateHosts') or []
        def guarded_getaddrinfo(host, *args, **options):
            answers = original(host, *args, **options)
            if str(host).lower().rstrip('.') not in allowed and (not answers or any(
                    not ipaddress.ip_address(item[4][0]).is_global for item in answers)):
                raise ValueError('VO access URL targets a non-public address')
            return answers
        socket.getaddrinfo = guarded_getaddrinfo
        try:
            return super().send(prepared_request, **kwargs)
        finally:
            socket.getaddrinfo = original

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
if operation == 'vo-download':
    import os, hashlib, tempfile, io, requests
    from astropy.io.votable import parse
    from astropy.io import fits
    from pyvo.dal.adhoc import DatalinkResults, SodaQuery
    from pyvo.dal.query import DALQuery
    class TransferSession(SafeVoSession, requests.Session):
        def request(self, method, url, **kwargs):
            kwargs.setdefault('timeout', (15, 45))
            return super().request(method, url, **kwargs)
    session = TransferSession()
    class TransferFailure(Exception):
        def __init__(self, code, message):
            self.code = code
            super().__init__(message)
    response = None
    try:
        descriptor = request.get('descriptor')
        if descriptor:
            pin = descriptor['file']
            with open(pin['path'], 'rb') as f: raw = f.read()
            if len(raw) != pin['bytes'] or hashlib.sha256(raw).hexdigest() != pin['sha256']: raise TransferFailure('identity', 'Descriptor pin changed')
            links = DatalinkResults(parse(io.BytesIO(raw)), url=request['url'])
            row = links[descriptor['row']]
            if row.service_def != descriptor['serviceId']: raise TransferFailure('identity', 'Service row changed')
            resource = links.get_adhocservice_by_id(row.service_def)
            standard = next((p.value for p in resource.params if p.name == 'standardID'), None)
            if standard != 'ivo://ivoa.net/std/SODA#sync-1.0': raise ValueError('Not synchronous SODA')
            bound = SodaQuery.from_resource(row, resource, session=session)
            for key, v in request['parameters'].items():
                if key not in ('BAND', 'CIRCLE') and (key not in bound or str(bound[key]) != str(v)):
                    raise ValueError('Fixed or referenced dataset parameter changed: ' + key)
            query = SodaQuery.from_resource(row, resource, session=session, **request['parameters'])
            if query.queryurl != request['url']: raise TransferFailure('identity', 'Resolved SODA URL changed')
        else:
            if request['parameters']: raise ValueError('Direct access cannot accept subset parameters')
            query = DALQuery(request['url'], session=session)
        limit = request['byteLimit']
        if type(limit) is not int or limit < 1: raise ValueError('Invalid science byte limit')
        response = query.submit()
        os.makedirs(os.path.dirname(request['destination']), exist_ok=True)
        fd, temporary = tempfile.mkstemp(dir=os.path.dirname(request['destination']), suffix='.partial')
        try:
            with os.fdopen(fd, 'wb') as f:
                if response.status_code == 204: raise TransferFailure('no-content', 'No science content (HTTP 204)')
                if response.status_code in (401,403): raise TransferFailure('authentication', 'Archive authorization failed (HTTP ' + str(response.status_code) + ')')
                response.raise_for_status()
                size, mark, digest = 0, 10000000, hashlib.sha256()
                for chunk in response.iter_content(chunk_size=1024 * 1024):
                    size += len(chunk)
                    if size > limit: raise TransferFailure('byte-limit', 'Science transfer byte limit exceeded')
                    f.write(chunk); digest.update(chunk)
                    if size >= mark:
                        print(f'VO product: {size / 1e6:.1f} MB', file=sys.stderr, flush=True)
                        mark = (size // 10000000 + 1) * 10000000
            if not size: raise TransferFailure('no-content', 'Empty science response')
            length = response.headers.get('Content-Length')
            if length and not response.headers.get('Content-Encoding') and int(length) != size: raise TransferFailure('interrupted', 'Incomplete science response')
            if request.get('format', 'fits') == 'fits':
                try:
                    profile = request.get('fitsProfile', 'raster')
                    if profile not in ('raster', 'bintable'): raise ValueError('Unsupported FITS content profile')
                    with fits.open(temporary, memmap=True) as hdus:
                        hdus.verify('exception')
                        if profile == 'raster' and not any(h.header.get('NAXIS', 0) >= 2 and h.header.get('XTENSION', '').strip() not in ('TABLE','BINTABLE') for h in hdus): raise ValueError('Response contains no supported FITS image/cube')
                        if profile == 'bintable' and not any(h.header.get('XTENSION', '').strip() == 'BINTABLE' for h in hdus): raise ValueError('Response contains no FITS binary table')
                except Exception as error: raise TransferFailure('protocol', 'Invalid science FITS response: ' + str(error)) from error
            # Never overwrite a previously acquired artifact at this destination.
            os.link(temporary, request['destination'])
            answer['transfer'] = {'file': {'path': request['destination'], 'bytes': size, 'sha256': digest.hexdigest()},
                'effectiveUrl': response.url, 'contentType': response.headers.get('Content-Type'), 'etag': response.headers.get('ETag'), 'lastModified': response.headers.get('Last-Modified')}
        finally:
            response.close()
            if os.path.exists(temporary): os.unlink(temporary)
    except Exception as error:
        status = response.status_code if response is not None else None
        code = (error.code if isinstance(error, TransferFailure) else
                'interrupted' if isinstance(error, (requests.exceptions.ChunkedEncodingError, requests.exceptions.ContentDecodingError)) else
                'transport' if isinstance(error, (requests.exceptions.ConnectionError, requests.exceptions.Timeout)) else
                'protocol' if isinstance(error, requests.exceptions.HTTPError) else
                'local-io' if isinstance(error, OSError) else 'protocol')
        answer['failure'] = {'code': code, 'httpStatus': status, 'message': str(error)}
elif operation in ('vo-tap', 'vo-links', 'vo-parse'):
    import io, os, hashlib, warnings, tempfile
    from datetime import datetime, timezone
    from astropy.io.votable import parse
    from astropy.time import Time
    from astropy.io.votable.tree import Param
    from pyvo.dal.adhoc import DatalinkQuery, DatalinkResults
    from pyvo.dal.tap import TAPResults
    import requests

    class BoundedSession(SafeVoSession, requests.Session):
        def request(self, method, url, **kwargs):
            kwargs.setdefault('timeout', (15, 45))
            return super().request(method, url, **kwargs)

    limit = request['byteLimit']
    if type(limit) is not int or limit < 1: raise ValueError('Invalid metadata byte limit')
    fetched = datetime.now(timezone.utc).isoformat()
    if operation == 'vo-parse':
        with open(request['file'], 'rb') as f: payload = f.read(limit + 1)
        raw_path, effective_url, http_status = request['file'], request['url'], 200
    else:
        session = BoundedSession()
        query = (pyvo.dal.TAPService(request['service'], session=session).create_query(request['query'], maxrec=request['maxrec'])
                 if operation == 'vo-tap' else DatalinkQuery(request['url'], session=session, **request.get('parameters', {})))
        response = query.submit(post=operation == 'vo-tap')
        try:
            response.raw.decode_content = True
            payload = response.raw.read(limit + 1)
            effective_url, http_status = response.url, response.status_code
        finally: response.close()
        if len(payload) > limit: raise ValueError('VO metadata byte limit exceeded')
        os.makedirs(request['directory'], exist_ok=True)
        raw_path = os.path.join(request['directory'], hashlib.sha256(payload).hexdigest() + '.xml')
        fd, staging = tempfile.mkstemp(dir=request['directory'], suffix='.partial')
        try:
            with os.fdopen(fd, 'wb') as f: f.write(payload)
            os.replace(staging, raw_path)
        finally:
            if os.path.exists(staging): os.unlink(staging)
    if len(payload) > limit: raise ValueError('VO metadata byte limit exceeded')
    def lossless(v):
        if isinstance(v, np.generic): return lossless(v.item())
        if isinstance(v, np.ndarray) and v.ndim == 0:
            return None if np.ma.is_masked(v) else lossless(v.item())
        if isinstance(v, (list, tuple, np.ndarray)): return [lossless(x) for x in v]
        if v is None or v is np.ma.masked or np.ma.is_masked(v): return None
        if isinstance(v, int) and not isinstance(v, bool) and abs(v) > 9007199254740991: return {'integer': str(v)}
        return value(v)
    def attributes(obj, keys):
        return {k: None if getattr(obj, k, None) is None else str(getattr(obj, k)) for k in keys}
    def field(f):
        return {'name': f.name or f.ID, 'id': f.ID, **attributes(f, ('datatype','arraysize','unit','ucd','utype','xtype','ref'))}
    def parameter(p):
        return {**field(p), 'value': lossless(p.value), 'constraints': {'minimum': lossless(p.values.min), 'maximum': lossless(p.values.max),
            'options': lossless(p.values.options), 'null': lossless(p.values.null)}}
    metadata = {'schema': 'cssearth-vo-metadata@1', 'pyvo': pyvo.__version__,
        'raw': {'path': raw_path, 'bytes': len(payload), 'sha256': hashlib.sha256(payload).hexdigest()},
        'effectiveUrl': effective_url, 'fetchedAt': fetched, 'httpStatus': http_status,
        'queryStatus': 'ERROR', 'fields': [], 'rows': [], 'resources': [], 'coordinateSystems': [], 'timeSystems': [], 'times': [], 'bindings': [], 'issues': []}
    try:
        with warnings.catch_warnings(record=True) as notices:
            warnings.simplefilter('always')
            votable = parse(io.BytesIO(payload), verify='warn')
            all_resources = []
            def visit(resource):
                all_resources.append(resource)
                for child in resource.resources: visit(child)
            for resource in votable.resources: visit(resource)
            metadata['coordinateSystems'].extend(attributes(c, ('ID','system','equinox','epoch')) for c in votable.coordinate_systems)
            metadata['timeSystems'].extend(attributes(t, ('ID','timeorigin','timescale','refposition')) for t in votable.time_systems)
            for resource in all_resources:
                metadata['resources'].append({'id': resource.ID, 'type': resource.type, 'utype': resource.utype,
                    'parameters': [parameter(p) for p in resource.params],
                    'groups': [{'name': g.name, 'parameters': [parameter(p) for p in g.entries if isinstance(p, Param)]} for g in resource.groups]})
                metadata['coordinateSystems'].extend(attributes(c, ('ID','system','equinox','epoch')) for c in resource.coordinate_systems)
                metadata['timeSystems'].extend(attributes(t, ('ID','timeorigin','timescale','refposition')) for t in resource.time_systems)
            statuses = [str(i.value).upper() for resource in all_resources for i in resource.infos if i.name == 'QUERY_STATUS']
            metadata['issues'].extend(str(i.content) for resource in all_resources for i in resource.infos if i.name == 'QUERY_STATUS' and i.value == 'ERROR')
            result = DatalinkResults(votable, url=effective_url) if operation == 'vo-links' else TAPResults(votable, url=effective_url)
            metadata['queryStatus'] = statuses[-1] if statuses else 'OK'
            if metadata['queryStatus'] not in ('OK','OVERFLOW','ERROR'): metadata['queryStatus'] = 'ERROR'
            table = result.resultstable
            metadata['fields'] = [field(f) for f in table.fields]
            metadata['rows'] = [{f.name or f.ID: lossless(row[f.ID or f.name]) for f in table.fields} for row in table.array]
            if 'service_def' in [f.name for f in table.fields]:
                links = DatalinkResults(votable, url=effective_url)
                for i, link in enumerate(links):
                    if not link.service_def: continue
                    binding = {'row': i, 'serviceId': link.service_def, 'url': None, 'parameters': {}, 'error': None}
                    try:
                        descriptor = links.get_adhocservice_by_id(link.service_def)
                        bound = DatalinkQuery.from_resource(link, descriptor)
                        binding.update(url=bound.queryurl, parameters={str(k): lossless(v) for k, v in bound.items()})
                    except Exception as e: binding['error'] = type(e).__name__ + ': ' + str(e)
                    metadata['bindings'].append(binding)
            for row in metadata['rows']:
                times = {}
                for name in ('t_min','t_max','time_min','time_max'):
                    if name not in row: continue
                    times[name] = None
                    f = next(f for f in table.fields if (f.name or f.ID) == name)
                    referenced = [t for t in metadata['timeSystems'] if f.ref and t['ID'] == f.ref]
                    if f.ref and len(referenced) != 1:
                        metadata['issues'].append('Time ' + name + ': unresolved or ambiguous TIMESYS reference ' + f.ref)
                        continue
                    system = referenced[0] if referenced else None
                    try:
                        epn_time = request.get('timeModel') == 'epn-tap-2.0' and name in ('time_min', 'time_max')
                        row_scale = row.get('time_scale') if epn_time else None
                        row_refposition = row.get('time_refposition') if epn_time else None
                        def text(value, label, blank_is_missing=False):
                            if value is None or (blank_is_missing and isinstance(value, str) and not value.strip()): return None
                            if not isinstance(value, str) or not value.strip(): raise ValueError(label + ' is malformed')
                            return value.strip()
                        row_scale = text(row_scale, 'EPN time_scale', True)
                        row_refposition = text(row_refposition, 'EPN time_refposition', True)
                        system_scale = text(system.get('timescale'), 'TIMESYS timescale') if system is not None else None
                        system_refposition = text(system.get('refposition'), 'TIMESYS refposition') if system is not None else None
                        if system is not None and not system_scale: raise ValueError('TIMESYS has no time scale')
                        if system_scale and row_scale and system_scale.casefold() != row_scale.casefold():
                            raise ValueError('TIMESYS time scale conflicts with EPN time_scale')
                        if system_refposition and row_refposition and system_refposition.casefold() != row_refposition.casefold():
                            raise ValueError('TIMESYS reference position conflicts with EPN time_refposition')
                        scale = system_scale or row_scale or request.get('timeScale') or ('utc' if epn_time else None)
                        if row[name] is not None and scale and request.get('timeFormat'):
                            if str(f.unit) not in ('d', 'day'): raise ValueError('Time unit is not days')
                            origin = (system or {}).get('timeorigin')
                            expected_origin = 2400000.5 if request['timeFormat'] == 'mjd' else 0
                            expected_token = 'MJD-origin' if request['timeFormat'] == 'mjd' else 'JD-origin'
                            if origin is not None and not (str(origin) == expected_token or float(origin) == expected_origin): raise ValueError('Declared time origin disagrees with table model')
                            times[name] = Time(row[name], format=request['timeFormat'], scale=scale.lower()).utc.isot + 'Z'
                    except Exception as e: metadata['issues'].append('Time ' + name + ': ' + str(e))
                metadata['times'].append(times)
            metadata['issues'].extend(str(w.message) for w in notices)
    except Exception as e:
        metadata.update(queryStatus='ERROR', fields=[], rows=[], times=[], bindings=[])
        metadata['issues'].append(type(e).__name__ + ': ' + str(e))
    if http_status < 200 or http_status >= 300:
        metadata['queryStatus'] = 'ERROR'
        metadata['issues'].append('HTTP ' + str(http_status))
    answer['vo'] = metadata
elif operation == 'mast-service':
    from astroquery.mast import Mast
    from requests.exceptions import ConnectionError, Timeout, HTTPError
    try:
        table = Mast.service_request(request['service'], request['parameters'], pagesize=request.get('pagesize'), page=request.get('page'))
        answer['rows'] = rows(table)
    except (ConnectionError, Timeout, HTTPError) as error:
        answer['transportError'] = str(error)
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
    if (request.operation === 'vo-download') for (const line of chunk.split('\n')) if (line.startsWith('VO product:')) process.stderr.write(`${line}\n`);
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
  if (request.operation === 'mast-service' && raw.transportError !== undefined) throw new ArchiveTransportError(requireString(raw.transportError, 'MAST transport failure'));
  if (request.operation === 'tap-query' && raw.pyvo !== pyvoVersion) throw new TypeError('PyVO answered with the wrong version.');
  const isVo = request.operation === 'vo-tap' || request.operation === 'vo-links' || request.operation === 'vo-parse';
  const vo = isVo ? parseMetadata(raw.vo) : undefined;
  if (request.operation === 'vo-download' && raw.failure !== undefined) {
    const failure = requireRecord(raw.failure), code = requireString(failure.code), status = failure.httpStatus;
    if (!['authentication','no-content','byte-limit','protocol','transport','interrupted','identity','local-io'].includes(code) ||
      status !== null && (typeof status !== 'number' || !Number.isInteger(status) || status < 100 || status > 599)) throw new TypeError('Invalid VO failure state.');
    throw new VoAccessError(code as VoFailureCode, requireString(failure.message), status as number | null);
  }
  const t = request.operation === 'vo-download' ? requireRecord(raw.transfer, 'VO transfer') : undefined;
  const nullable = (v: unknown) => v === null ? null : requireString(v);
  const transfer = t ? { file: parsePin(t.file), effectiveUrl: requireString(t.effectiveUrl), contentType: nullable(t.contentType), etag: nullable(t.etag), lastModified: nullable(t.lastModified) } : undefined;
  const expectsRows = !isVo && request.operation !== 'vo-download' && request.operation !== 'mast-download' && !((request.operation === 'horizons-ephemerides' || request.operation === 'horizons-vectors') && request.raw);
  if (expectsRows && raw.rows === undefined) throw new TypeError(`Astroquery ${request.operation} returned no rows field.`);
  const rows = raw.rows === undefined ? undefined : requireArray(raw.rows, 'Astroquery rows').map((row, index) => requireRecord(row, `Astroquery row ${index}`));
  const files = raw.files === undefined ? undefined : requireArray(raw.files, 'Astroquery files').map((file, index) => requireString(file, `Astroquery file ${index}`));
  const answerText = raw.text === undefined ? undefined : requireString(raw.text, 'Astroquery text');
  const tap = request.operation === 'tap-query' ? requireRecord(raw.tap, 'TAP status') : undefined;
  if (tap && typeof tap.complete !== 'boolean') throw new TypeError('TAP status states no completeness boolean.');
  const tapStatus = tap ? requireString(tap.queryStatus, 'TAP query status') : undefined;
  if (tap && tap.complete !== (tapStatus!.toUpperCase() === 'OK')) throw new TypeError(`TAP status ${tapStatus} contradicts its completeness boolean.`);
  return { schema: 'cssearth-astroquery-answer@2', astroquery: version, operation: request.operation,
    ...(vo ? { vo } : {}),
    ...(transfer ? { transfer } : {}),
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
