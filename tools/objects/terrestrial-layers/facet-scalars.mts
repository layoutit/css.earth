import { readFitsHdu, assertUnscaledFitsTable } from '@cssearth/fits';
import type {SourceMesh} from './contracts.mts';
import {parseFacetLens,parseFacetProfile,parseFacetSampler,parseTransferTerrain,parseFacetTable,parseFacetFitsTable,parseSurfaceLens} from './source-records.mts';
import {text} from '@cssearth/core';
import {readFile} from 'node:fs/promises';
import {resolve, basename} from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {gunzipSync} from 'node:zlib';
const exec = promisify(execFile);
const safePath = (p: unknown): p is string => typeof p === 'string' && p.length > 0 && !p.startsWith('/') && !p.includes('\\') && !p.split('/').includes('..');

export function validateFacetScalarProfile(value: unknown, terrainValue: unknown) {
  const lens=parseFacetProfile(value),terrain=parseTransferTerrain(terrainValue);
  const t = lens.table, s = lens.surfaceSampling;
  if (!safePath(lens.meshPath) || lens.meshPath !== terrain?.path ||
      !['sbmt-csv-zip', 'facet-csv-gzip', 'pds4-fits'].includes(t.format ?? '') || !t.field || typeof t.units !== 'string' ||
      !Number.isSafeInteger(t.expectedRows) || t.expectedRows !== terrain.grid?.expectedFaces ||
      !Number.isFinite(t.maximumCentroidErrorMeters) || !(t.maximumCentroidErrorMeters > 0) ||
      (t.format === 'sbmt-csv-zip' && !safePath(t.member)) ||
      (t.format === 'pds4-fits' && (!safePath(t.labelPath) || !t.target || !safePath(t.meshFile))) ||
      s?.method !== 'closest-source-point' || !Number.isFinite(s.maximumDistanceMeters) ||
      !(s.maximumDistanceMeters > 0) || terrain.simplification?.method !== 'source-meshoptimizer' ||
      s.maximumDistanceMeters > terrain.simplification.maximumErrorMeters ||
      lens.sampling !== 'nearest' || lens.additionalGrids?.length ||
      (t.validityField !== undefined && typeof t.validityField !== 'string') ||
      ![undefined, 'source-face-order', 'centroid-bijection'].includes(t.registration) ||
      (t.registration === 'centroid-bijection' && t.format !== 'pds4-fits')) {
    throw new TypeError('Facet science requires an exact source mesh, registered table, nearest values and bounded surface transfer.');
  }
}

/** Validate every table centroid against the corresponding original OBJ face.
 * This is independent of spatial nearest-point transfer to the display mesh. */
function centroidError(mesh: SourceMesh, faceId: number, point: readonly number[], limit: number) {
  const indices = mesh.indices[faceId];
  if (!indices || !point.every(Number.isFinite)) throw new Error('Invalid facet identity or centroid.');
  const center = [0, 1, 2].map(axis => indices.reduce((sum, index) => sum + mesh.positions[index][axis], 0) / 3);
  const error = Math.hypot(...center.map((value, axis) => value - point[axis]));
  if (error > limit) throw new Error('Facet table does not match source geometry at face ' + faceId + ': ' + error + ' m.');
  return error;
}

/** An explicitly selected bijection repairs a documented exporter-order difference.
 * Every row must match exactly one source centroid, and every face exactly one row.
 * This is a coordinate identity check at source rounding precision, not a loose nearest-neighbour transfer. */
function centroidBijection(mesh: SourceMesh, tolerance: number) {
  const cells = new Map<string,number[]>(), seen = new Uint8Array(mesh.faces);
  const centers = mesh.indices.map(indices => [0,1,2].map(axis => indices.reduce((sum, i) => sum + mesh.positions[i][axis], 0)/3));
  const cellFor = (point: readonly number[]) => point.map(n => Math.floor(n/tolerance));
  centers.forEach((point,id) => {const key=cellFor(point).join(',');if(!cells.has(key))cells.set(key,[]);cells.get(key)!.push(id);});
  return (point: readonly number[]) => {
    const cell=cellFor(point), hits=[];
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++) {
      for(const id of cells.get([cell[0]+x,cell[1]+y,cell[2]+z].join(','))??[]) {
        const error=Math.hypot(...point.map((n,i)=>n-centers[id][i]));
        if(error<=tolerance)hits.push({faceId:id,error});
      }
    }
    if(hits.length!==1 || seen[hits[0].faceId])throw new Error('Facet centroid mapping is not a unique complete bijection.');
    seen[hits[0].faceId]=1;return hits[0];
  };
}

function tableResult(count: number) {
  return {values: new Float64Array(count).fill(NaN), sigmas: new Float64Array(count).fill(NaN),
    sourceRows: Uint32Array.from({length: count}, (_, i) => i),
    report: {rows: count, validRows: 0, withheldRows: 0, zeroSigmaRows: 0, remappedRows: 0,
      minimum: Infinity, maximum: -Infinity, maximumCentroidErrorMeters: 0}};
}
function record(result: ReturnType<typeof tableResult>, faceId: number, value: number, sigma: number, valid: boolean, error: number) {
  result.report.maximumCentroidErrorMeters = Math.max(result.report.maximumCentroidErrorMeters, error);
  if (!valid || !Number.isFinite(value)) { result.report.withheldRows++; return; }
  result.values[faceId] = value;
  if (Number.isFinite(sigma) && sigma >= 0) {
    result.sigmas[faceId] = sigma;
    if (sigma === 0) result.report.zeroSigmaRows++;
  }
  result.report.validRows++;
  result.report.minimum = Math.min(result.report.minimum, value);
  result.report.maximum = Math.max(result.report.maximum, value);
}

/** SBMT CSV has two header rows; data row order is the source OBJ face order.
 * NaN support stays missing. A zero value remains a legitimate scalar. */
export function parseFacetCsv(text: string, value: unknown, mesh: SourceMesh) {
  const profile=parseFacetTable(value);
  const lines = text.trimEnd().split(/\r?\n/);
  const header=lines.shift(), unitHeader=lines.shift();
  if(header===undefined||unitHeader===undefined)throw new Error('Missing facet CSV header');
  const names = header.split(','), units = unitHeader.split(',');
  const field = names.indexOf(profile.field), support = profile.validityField === undefined ? -1 : names.indexOf(profile.validityField);
  if (mesh.faces !== profile.expectedRows || lines.length !== mesh.faces || field < 0 ||
      units[field] !== profile.units || names.slice(0, 3).join(',') !== 'X,Y,Z' ||
      units.slice(0, 3).join(',') !== 'km,km,km' || (profile.validityField !== undefined && support < 0)) {
    throw new Error('Facet CSV dimensions, columns or units changed.');
  }
  const result = tableResult(mesh.faces);
  for (let i = 0; i < lines.length; i++) {
    const fields = lines[i].split(',');
    if (fields.length !== names.length || fields.some(value => !/^(?:NaN|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)$/.test(value.trim()))) {
      throw new Error('Malformed facet CSV record ' + i);
    }
    const values = fields.map(Number);
    const error = centroidError(mesh, i, values.slice(0, 3).map(n => n * 1000), profile.maximumCentroidErrorMeters);
    record(result, i, values[field], NaN, support < 0 || Number.isFinite(values[support]), error);
  }
  return result;
}

function fitsHeader(bytes: Buffer, start: number) {
  const hdu = readFitsHdu(bytes, start);
  assertUnscaledFitsTable(hdu.header);
  return { keys: Object.fromEntries(Object.entries(hdu.header).filter(([, v]) => v !== undefined).map(([k, v]) => [k, typeof v === 'boolean' ? v ? 'T' : 'F' : String(v)])), offset: hdu.dataOffset };
}

/** The selected PDS products have an empty primary HDU and one 1J+5E table.
 * FACET_NUM is zero-based. A requested, verified centroid bijection reconciles
 * a source OBJ exporter with a different order; original table IDs are retained. */
export function parseFacetFits(bytes: Buffer, xml: string, value: unknown, mesh: SourceMesh) {
  const profile=parseFacetFitsTable(value);
  const primary = fitsHeader(bytes, 0), table = fitsHeader(bytes, primary.offset);
  const p = primary.keys, k = table.keys, count = profile.expectedRows;
  if (p.SIMPLE !== 'T' || p.NAXIS !== '0' || p.TARGET !== profile.target || p.OBJ_FILE !== profile.meshFile ||
      mesh.faces !== count || k.XTENSION !== 'BINTABLE' || k.BITPIX !== '8' || k.NAXIS !== '2' ||
      k.NAXIS1 !== '24' || k.NAXIS2 !== String(count) || k.PCOUNT !== '0' || k.GCOUNT !== '1' || k.TFIELDS !== '6' ||
      bytes.length !== table.offset + Math.ceil(count * 24 / 2880) * 2880) throw new Error('FITS facet table identity or dimensions changed.');
  const names = ['FACET_NUM', 'LATITUDE', 'LONGITUDE', 'RADIUS', profile.field, 'SIGMA'];
  const units = [undefined, 'DEGREES', 'DEGREES', 'KILOMETERS', profile.units, profile.units];
  for (let i = 0; i < 6; i++) {
    if (k['TTYPE' + (i + 1)] !== names[i] || k['TFORM' + (i + 1)] !== (i ? '1E' : '1J') ||
        (units[i] !== undefined && k['TUNIT' + (i + 1)] !== units[i])) throw new Error('FITS facet column or unit changed: ' + names[i]);
  }
  const fieldXml = [...xml.matchAll(/<Field_Binary>([\s\S]*?)<\/Field_Binary>/g)].map(m => m[1]);
  const tag = (text: string, name: string) => new RegExp('<' + name + '(?:\\s[^>]*)?>([^<]+)</' + name + '>').exec(text)?.[1]?.trim();
  if (tag(xml, 'records') !== String(count) || tag(xml, 'record_length') !== '24' ||
      tag(xml, 'file_name') !== p.PRODNAME || !xml.includes(profile.meshFile) || fieldXml.length !== 6 ||
      fieldXml.some((field, i) => tag(field, 'name') !== names[i] || tag(field, 'field_location') !== String(i * 4 + 1) ||
        tag(field, 'field_length') !== '4' || tag(field, 'data_type') !== (i ? 'IEEE754MSBSingle' : 'SignedMSB4'))) {
    throw new Error('PDS facet label differs from its FITS table.');
  }
  const result = tableResult(count);
  const match = profile.registration === 'centroid-bijection' ? centroidBijection(mesh, profile.maximumCentroidErrorMeters) : null;
  for (let i = 0; i < count; i++) {
    const offset = table.offset + i * 24, faceId = bytes.readInt32BE(offset);
    if (faceId !== i) throw new Error('FITS facet IDs changed at row ' + i);
    const lat = bytes.readFloatBE(offset + 4) * Math.PI / 180;
    const lon = bytes.readFloatBE(offset + 8) * Math.PI / 180, radius = bytes.readFloatBE(offset + 12) * 1000;
    const point = [radius * Math.cos(lat) * Math.cos(lon), radius * Math.cos(lat) * Math.sin(lon), radius * Math.sin(lat)];
    const matched = match ? match(point) : {faceId:i, error:centroidError(mesh, i, point, profile.maximumCentroidErrorMeters)};
    result.sourceRows[matched.faceId] = i;
    if(matched.faceId !== i)result.report.remappedRows++;
    const value = bytes.readFloatBE(offset + 16), sigma = bytes.readFloatBE(offset + 20);
    record(result, matched.faceId, value, sigma, true, matched.error);
  }
  return result;
}

export function createFacetScalarSampler(mesh: SourceMesh, table: Pick<ReturnType<typeof tableResult>,"values"|"sigmas"|"sourceRows">, value: unknown) {
  const lens=parseFacetSampler(value);
  const transform = (raw: number) => raw * (lens.valueTransform?.scale ?? 1) + (lens.valueTransform?.offset ?? 0);
  const valueAt = (id: number) => Number.isFinite(table.values[id]) ? transform(table.values[id]) : null;
  return {
    sample(longitude: number, latitude: number) {
      const hit = mesh.hit(longitude, latitude, true);
      return hit ? valueAt(hit.faceId) : null;
    },
    samplePoint(point: readonly number[]) {
      const hit = mesh.closestPoint(point, lens.surfaceSampling.maximumDistanceMeters);
      if (!hit) return null;
      const value = valueAt(hit.faceId);
      if (value === null) return null;
      return {...hit, value, sourceCell: table.sourceRows[hit.faceId],
        sigma: Number.isFinite(table.sigmas[hit.faceId]) ? table.sigmas[hit.faceId] * (lens.valueTransform?.scale ?? 1) : null};
    },
  };
}

export async function loadFacetScalarSurface(root: string, value: unknown, mesh?: SourceMesh | null) {
  const lens=parseFacetLens(value);
  if (!mesh?.closestPoint || !mesh?.hit) throw new Error('Facet science needs the complete rendered source mesh.');
  let table;
  if (lens.table.format === 'sbmt-csv-zip') {
    const {stdout} = await exec('unzip', ['-p', resolve(root, lens.path), text(lens.table.member)], {maxBuffer: 192 * 1024 * 1024});
    table = parseFacetCsv(stdout, lens.table, mesh);
  } else if (lens.table.format === 'facet-csv-gzip') {
    table = parseFacetCsv(gunzipSync(await readFile(resolve(root, lens.path))).toString('utf8'), lens.table, mesh);
  } else {
    const [bytes, xml] = await Promise.all([readFile(resolve(root, lens.path)), readFile(resolve(root, text(lens.table.labelPath)), 'utf8')]);
    table = parseFacetFits(bytes, xml, lens.table, mesh);
  }
  if (!table.report.validRows) throw new Error('Facet table contains no valid source values.');
  return {...createFacetScalarSampler(mesh, table, lens), report: {...table.report, sourceFormat: 'facet-scalars',
    sourceTable: basename(lens.path), sourceMesh: lens.meshPath, field: lens.table.field, units: lens.table.units,
    validity: lens.table.validityField ? 'Finite ' + lens.table.validityField + ' support in the original table.' : lens.table.format === 'facet-csv-gzip' ? 'Finite prepared values; NaN preserves rejected or missing source coverage.' : 'Finite released values; this does not establish photographed coverage.',
    uncertainty: 'Released sigma retained where supplied; zero sigma is not a coverage or certainty claim.',
    registration: 'Every original table centroid verified against its exact source face; ' + (lens.table.registration === 'centroid-bijection' ? 'explicit complete centroid bijection reconciles exporter face ordering; ' : '') + 'closest full-source triangle transfer bounded in metres. No cross-facet interpolation.',
    previewPolicy: 'Exact unique source ray and facet value; ambiguous radial surfaces withheld.',
    scale: [lens.minimum, lens.maximum]}};
}
