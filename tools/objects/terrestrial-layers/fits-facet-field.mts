import { readFitsHdu, assertUnscaledFitsTable } from '../../fits/fits.mts';
import type {SourceMesh} from './contracts.mts';
import {parseFacetField,shape,text} from './source-records.mts';
import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

// The archived global SPC tables contain one value and uncertainty per source
// triangle. They are not images: FACET_NUM and the recorded centroid bind each
// row to the original mesh before any display simplification is sampled.
function header(bytes: Buffer, start: number) {
  const hdu = readFitsHdu(bytes, start);
  assertUnscaledFitsTable(hdu.header);
  const fields = Object.fromEntries(Object.entries(hdu.header).filter(([, v]) => v !== undefined)
    .map(([k, v]) => [k, typeof v === 'boolean' ? v ? 'T' : 'F' : String(v)]));
  return { fields, end: hdu.dataOffset };
}

export function validateFacetFieldRecipe(value: unknown) {
  const field=parseFacetField(value);
  if (field?.format !== 'fits-spc-facet-table' ||
      [field.path, field.labelPath].some(p => typeof p !== 'string' || !p || p.startsWith('/') || p.split('/').includes('..')) ||
      field.field !== 'RELATIVE ALBEDO' || !field.target || !field.sourceVersion || !field.mapVersion ||
      ![undefined, 'index', 'centroid-bijection'].includes(field.facetOrder) ||
      !(field.maximumCentroidResidualMeters > 0) || field.maximumCentroidResidualMeters > .01 ||
      field.validity !== 'positive-sigma') throw new TypeError('Invalid source-bound facet field.');
  return field;
}

// Some released SPC tables retain an earlier triangle ordering even though
// OBJ_FILE names the final mesh. Match their recorded centroids bijectively;
// never accept a nearby surface value or silently relax the source tolerance.
function centroidCorrespondence(mesh: SourceMesh, tolerance: number) {
  const centres = mesh.indices.map(face => [0, 1, 2].map(k => face.reduce((sum, i) => sum + mesh.positions[i][k], 0) / 3));
  const buckets = new Map<string,number[]>(), used = new Uint8Array(mesh.faces);
  const cell = (point: readonly number[]) => point.map(n => Math.floor(n / tolerance));
  for (let i = 0; i < centres.length; i++) {
    const key = cell(centres[i]).join(',');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(i);
  }
  return (point: readonly number[]) => {
    const [x, y, z] = cell(point), matches = [];
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      for (const i of buckets.get([x + dx, y + dy, z + dz].join(',')) ?? []) {
        if (Math.hypot(...centres[i].map((n, k) => n - point[k])) <= tolerance) matches.push(i);
      }
    }
    if (matches.length !== 1 || used[matches[0]]) throw new Error('FITS centroids do not uniquely cover the source facets.');
    used[matches[0]] = 1;
    return matches[0];
  };
}

export function decodeFitsFacetField(bytes: Buffer, mesh: SourceMesh, value: unknown, meshPath: string) {
  const recipe=validateFacetFieldRecipe(value);
  const primary = header(bytes, 0), table = header(bytes, primary.end), p = primary.fields, t = table.fields;
  if (p.SIMPLE !== 'T' || p.NAXIS !== '0' || p.TARGET !== recipe.target || p.DATASRC !== 'SPC' ||
      p.DATASRCV !== recipe.sourceVersion || p.MAP_VER !== recipe.mapVersion || p.MAP_NAME !== 'Relative albedo' ||
      p.OBJ_FILE !== basename(meshPath) || t.XTENSION !== 'BINTABLE' || t.BITPIX !== '8' || t.NAXIS !== '2' ||
      Number(t.NAXIS1) !== 24 || Number(t.NAXIS2) !== mesh.faces || t.PCOUNT !== '0' || t.GCOUNT !== '1' || t.TFIELDS !== '6' ||
      bytes.length !== Math.ceil((table.end + mesh.faces * 24) / 2880) * 2880) {
    throw new Error('FITS facet identity, mesh or record layout changed.');
  }
  const columns = ['FACET_NUM', 'LATITUDE', 'LONGITUDE', 'RADIUS', recipe.field, 'SIGMA'];
  for (let i = 0; i < columns.length; i++) if (t[`TTYPE${i + 1}`] !== columns[i] || t[`TFORM${i + 1}`] !== (i ? '1E' : '1J') ||
      t[`TSCAL${i + 1}`] !== undefined || t[`TZERO${i + 1}`] !== undefined) throw new Error('Unsupported FITS facet column.');
  if (t.TUNIT2 !== 'DEGREES' || t.TUNIT3 !== 'DEGREES' || t.TUNIT4 !== 'KILOMETERS' ||
      t.TUNIT5 !== 'UNITLESS' || t.TUNIT6 !== 'UNITLESS') throw new Error('FITS facet units changed.');
  const values = new Float64Array(mesh.faces); values.fill(NaN);
  const correspond = recipe.facetOrder === 'centroid-bijection' ? centroidCorrespondence(mesh, recipe.maximumCentroidResidualMeters) : null;
  const report = { sourceFaces: mesh.faces, acceptedFaces: 0, withheldFaces: 0,
    facetOrder: recipe.facetOrder ?? 'index', reorderedRows: 0,
    maximumCentroidResidualMeters: 0, sourceAreaSquareMeters: 0, acceptedAreaSquareMeters: 0,
    minimum: Infinity, maximum: -Infinity, validity: recipe.validity };
  for (let i = 0; i < mesh.faces; i++) {
    const offset = table.end + i * 24;
    if (bytes.readInt32BE(offset) !== i) throw new Error('FITS rows do not preserve the source facet identities.');
    const latitude = bytes.readFloatBE(offset + 4), longitude = bytes.readFloatBE(offset + 8), radius = bytes.readFloatBE(offset + 12);
    const value = bytes.readFloatBE(offset + 16), sigma = bytes.readFloatBE(offset + 20);
    if (![latitude, longitude, radius].every(Number.isFinite) || Math.abs(latitude) > 90 || !(radius > 0)) throw new Error('Invalid FITS facet coordinates.');
    const lat = latitude * Math.PI / 180, lon = longitude * Math.PI / 180;
    const recorded = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)].map(n => n * radius * 1000);
    const faceId = correspond ? correspond(recorded) : i;
    const [a, b, c] = mesh.indices[faceId].map(index => mesh.positions[index]);
    const centre = a.map((n, k) => (n + b[k] + c[k]) / 3);
    const residual = Math.hypot(...centre.map((n, k) => n - recorded[k]));
    if (![latitude, longitude, radius, residual].every(Number.isFinite) || Math.abs(latitude) > 90 || !(radius > 0) ||
        residual > recipe.maximumCentroidResidualMeters) throw new Error(`FITS facet ${i} does not match the source centroid.`);
    const ab = b.map((n, k) => n - a[k]), ac = c.map((n, k) => n - a[k]);
    const area = Math.hypot(ab[1]*ac[2]-ab[2]*ac[1], ab[2]*ac[0]-ab[0]*ac[2], ab[0]*ac[1]-ab[1]*ac[0]) / 2;
    report.sourceAreaSquareMeters += area;
    if (faceId !== i) report.reorderedRows++;
    report.maximumCentroidResidualMeters = Math.max(report.maximumCentroidResidualMeters, residual);
    // Sigma zero is one or no contributing images in this archive. Keep those
    // ambiguous regions as gaps, including the nominal albedo=1 fill.
    if (!Number.isFinite(value) || !(value > 0) || !Number.isFinite(sigma) || !(sigma > 0)) { report.withheldFaces++; continue; }
    values[faceId] = value; report.acceptedFaces++; report.acceptedAreaSquareMeters += area;
    report.minimum = Math.min(report.minimum, value); report.maximum = Math.max(report.maximum, value);
  }
  if (!report.acceptedFaces) throw new Error('Facet field has no supported values.');
  return { values, report:{...report,acceptedSourceAreaFraction:report.acceptedAreaSquareMeters/report.sourceAreaSquareMeters} };
}

export async function loadFitsFacetField(root: string, mesh: SourceMesh, value: unknown) {
  const lens=shape({path:text,facetField:parseFacetField})(value);
  return decodeFitsFacetField(await readFile(resolve(root, lens.facetField.path)), mesh, lens.facetField, lens.path);
}
