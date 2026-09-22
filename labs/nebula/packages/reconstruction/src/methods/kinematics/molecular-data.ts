import type { MolecularCatalogue, MolecularColumn, MolecularPoint, MolecularPointing, MolecularRecipe, MolecularSourcePin } from './molecular-types.ts';
const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const record = (v: unknown) => { if (!isRecord(v)) throw new TypeError('Expected molecular evidence object.'); return v; };
const text = (v: unknown) => { if (typeof v !== 'string' || !v.trim() || v.length > 8192) throw new TypeError('Expected molecular evidence text.'); return v; };
const number = (v: unknown, min: number, max: number) => { if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new TypeError('Invalid molecular numeric value.'); return v; };
const integer = (v: unknown, min: number, max: number) => { const n = number(v, min, max); if (!Number.isInteger(n)) throw new TypeError('Expected integer.'); return n; };
const url = (v: unknown) => { const s = text(v); if (new URL(s).protocol !== 'https:') throw new TypeError('Expected HTTPS source.'); return s; };
function list<T>(v: unknown, read: (value: unknown) => T, max: number): T[] { if (!Array.isArray(v) || !v.length || v.length > max) throw new TypeError('Invalid molecular evidence list.'); return v.map(read); }
function pin(v: unknown, allowedPath: (path: string) => boolean): MolecularSourcePin {
  const p = record(v), cachePath = text(p.cachePath);
  if (!allowedPath(cachePath) || cachePath.startsWith('/') || /[\\:?#]/.test(cachePath) || cachePath.split('/').some(part => part === '..' || part === '.' || !part)) throw new TypeError('Invalid molecular cache path.');
  return { url: url(p.url), cachePath, bytes: integer(p.bytes, 1, 10000000) };
}
function column(v: unknown, expectedUnit: string): MolecularColumn {
  const p = record(v), start = integer(p.start, 1, 512), end = integer(p.end, start, 512);
  if (p.unit !== expectedUnit) throw new TypeError(`Expected ${expectedUnit} source column.`);
  return { start, end, unit: expectedUnit };
}
export function readMolecularRecipe(value: unknown, allowedPath: (path: string) => boolean = () => true): MolecularRecipe {
  const p = record(value), c = record(p.citation), t = record(p.table), cols = record(t.columns), tracer = record(p.tracer),
    sky = record(p.coordinates), origin = record(sky.originJ2000Degrees), velocity = record(p.velocity), conversion = record(velocity.publishedHeliocentricConversion),
    instrument = record(p.instrument), intensity = record(p.intensity), broad = record(p.broadLineNotice), counts = record(p.expectedCounts);
  if (p.schema !== 'cssearth-molecular-evidence@1' || t.format !== 'cds-fixed-width@1' || sky.frame !== 'J2000' || sky.unit !== 'arcsec' ||
      !['east', 'west'].includes(String(sky.raOffsetPositive)) || !['north', 'south'].includes(String(sky.decOffsetPositive)) ||
      velocity.frame !== 'LSR' || velocity.positive !== 'receding' || velocity.unit !== 'km/s' || velocity.uncertainties !== 'not-published' ||
      conversion.appliedToMeasurements !== false || intensity.scale !== 'T_R*' || intensity.unit !== 'mK') throw new TypeError('Unsupported molecular evidence convention.');
  if (sky.raOffsetPositive !== 'east' && sky.raOffsetPositive !== 'west') throw new TypeError('Invalid RA sign.');
  if (sky.decOffsetPositive !== 'north' && sky.decOffsetPositive !== 'south') throw new TypeError('Invalid declination sign.');
  const columns = { raOffset: column(cols.raOffset, 'arcsec'), decOffset: column(cols.decOffset, 'arcsec'), intensityLimit: column(cols.intensityLimit, 'flag'),
    intensity: column(cols.intensity, 'mK'), fwhm: column(cols.fwhm, 'km/s'), velocity: column(cols.velocity, 'km/s'),
    inferredColumnDensity: column(cols.inferredColumnDensity, 'cm-2'), inferredAbundance: column(cols.inferredAbundance, 'dimensionless') };
  const occupied = new Set<number>();
  for (const field of Object.values(columns)) for (let position = field.start; position <= field.end; position++) {
    if (occupied.has(position)) throw new TypeError('Overlapping source columns.'); occupied.add(position);
  }
  const records = integer(t.records, 1, 100000);
  const expectedCounts = { rows: integer(counts.rows, 1, 100000), pointings: integer(counts.pointings, 1, 100000),
    detectedComponents: integer(counts.detectedComponents, 0, 100000), detectedPointings: integer(counts.detectedPointings, 0, 100000), upperLimits: integer(counts.upperLimits, 0, 100000) };
  if (expectedCounts.rows !== records || expectedCounts.detectedComponents + expectedCounts.upperLimits !== records ||
      expectedCounts.detectedPointings > expectedCounts.pointings || expectedCounts.pointings > records) throw new TypeError('Inconsistent source count audit.');
  return { schema: p.schema, id: text(p.id), title: text(p.title),
    citation: { label: text(c.label), doi: url(c.doi), catalogueDoi: url(c.catalogueDoi), paper: pin(c.paper, allowedPath), readme: pin(c.readme, allowedPath) },
    table: { ...pin(t, allowedPath), format: t.format, records, columns },
    tracer: { species: text(tracer.species), transition: text(tracer.transition), restFrequencyGHz: number(tracer.restFrequencyGHz, .01, 10000), emissionPhase: text(tracer.emissionPhase) },
    coordinates: { frame: sky.frame, originJ2000Degrees: { ra: number(origin.ra, 0, 360), dec: number(origin.dec, -90, 90) },
      originSexagesimal: text(sky.originSexagesimal), raOffsetPositive: sky.raOffsetPositive, decOffsetPositive: sky.decOffsetPositive, unit: sky.unit, evidence: text(sky.evidence) },
    velocity: { frame: velocity.frame, positive: velocity.positive, unit: velocity.unit, definitionNote: text(velocity.definitionNote),
      publishedHeliocentricConversion: { lsrMinusHeliocentricKmS: number(conversion.lsrMinusHeliocentricKmS, -100, 100), source: text(conversion.source), appliedToMeasurements: false },
      uncertainties: velocity.uncertainties, uncertaintyNote: text(velocity.uncertaintyNote) },
    instrument: { telescope: text(instrument.telescope), beamFwhmArcsec: number(instrument.beamFwhmArcsec, .001, 3600), mapSpectralResolutionKmS: number(instrument.mapSpectralResolutionKmS, .001, 1000),
      backendResolutionsKmS: list(instrument.backendResolutionsKmS, v => number(v, .001, 1000), 10), gridSpacingsArcsec: list(instrument.gridSpacingsArcsec, v => number(v, .001, 3600), 10), source: text(instrument.source) },
    intensity: { scale: intensity.scale, unit: intensity.unit, upperLimitMeaning: text(intensity.upperLimitMeaning), correctedBeamEfficiency: number(intensity.correctedBeamEfficiency, .001, 1), source: text(intensity.source) },
    broadLineNotice: { thresholdFwhmKmS: number(broad.thresholdFwhmKmS, .01, 1000), source: text(broad.source) }, expectedCounts,
    limitations: list(p.limitations, text, 50) };
}
function numericField(line: string, field: MolecularColumn, optional: boolean): number | null {
  const value = line.slice(field.start - 1, field.end).trim();
  if (!value && optional) return null;
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[Ee][+-]?\d+)?$/.test(value)) throw new TypeError(`Invalid numeric field at byte ${field.start}.`);
  const result = Number(value); if (!Number.isFinite(result)) throw new TypeError('Nonfinite source value.'); return result;
}
export type ParsedMolecularTable = Pick<MolecularCatalogue, 'points' | 'pointings' | 'diagnostics'>;
/** Preserve every published row, including null line parameters for intensity upper limits. */
export function parseMolecularTable(source: string, recipe: MolecularRecipe): ParsedMolecularTable {
  const r = readMolecularRecipe(recipe), columns = r.table.columns;
  if (/[^\x09\x0a\x0d\x20-\x7e]/.test(source)) throw new TypeError('Expected ASCII CDS table.');
  const lines = source.split('\n'); if (lines.at(-1) === '') lines.pop();
  if (lines.length !== r.table.records) throw new TypeError(`Expected ${r.table.records} source rows; found ${lines.length}.`);
  const longest = Math.max(...Object.values(columns).map(field => field.end));
  const occupied = new Set(Object.values(columns).flatMap(field => Array.from({ length: field.end - field.start + 1 }, (_, i) => field.start - 1 + i)));
  const groups = new Map<string, MolecularPointing>();
  const points = lines.map((raw, index): MolecularPoint => {
    const line = raw.replace(/\r$/, '');
    if (!line.trim() || line.length > longest || [...line].some((character, position) => !occupied.has(position) && character !== ' ')) throw new TypeError(`Malformed molecular source row ${index + 1}.`);
    const ra = numericField(line, columns.raOffset, false)!, dec = numericField(line, columns.decOffset, false)!;
    if (Math.abs(ra) > 3600 || Math.abs(dec) > 3600) throw new TypeError('Offset lies outside supported local sky field.');
    const flag = line.slice(columns.intensityLimit.start - 1, columns.intensityLimit.end).trim();
    if (flag !== '' && flag !== '<') throw new TypeError(`Unknown intensity flag in row ${index + 1}.`);
    const intensityMilliKelvin = numericField(line, columns.intensity, false)!, velocityLsrKmS = numericField(line, columns.velocity, true),
      fwhmKmS = numericField(line, columns.fwhm, true), columnDensityCm2 = numericField(line, columns.inferredColumnDensity, true),
      fractionalAbundance = numericField(line, columns.inferredAbundance, true);
    if (intensityMilliKelvin <= 0 || (fwhmKmS !== null && fwhmKmS <= 0) || (columnDensityCm2 !== null && columnDensityCm2 <= 0) ||
        (fractionalAbundance !== null && fractionalAbundance <= 0) || (velocityLsrKmS !== null && Math.abs(velocityLsrKmS) > 1000)) throw new TypeError('Nonphysical published field value.');
    if (flag === '<' && [velocityLsrKmS, fwhmKmS, columnDensityCm2, fractionalAbundance].some(value => value !== null)) throw new TypeError('Intensity limit must not fabricate measured line parameters.');
    if (flag === '' && (velocityLsrKmS === null || fwhmKmS === null)) throw new TypeError('Detection is missing line velocity or width.');
    const xWestArcsec = (r.coordinates.raOffsetPositive === 'east' ? -ra : ra) || 0;
    const yNorthArcsec = (r.coordinates.decOffsetPositive === 'north' ? dec : -dec) || 0;
    const pointingKey = `${r.id}:offset:${ra},${dec}`;
    let group = groups.get(pointingKey);
    if (!group) { group = { pointingKey, xWestArcsec, yNorthArcsec, sourceRows: [], pointIds: [], detectedComponents: 0, upperLimits: 0 }; groups.set(pointingKey, group); }
    const componentIndex = group.sourceRows.length;
    const id = `${pointingKey}:component:${componentIndex}`;
    group.sourceRows.push(index + 1); group.pointIds.push(id);
    if (flag === '<') group.upperLimits++; else group.detectedComponents++;
    return { id, sourceRow: index + 1, pointingKey, componentIndex, sourceRaOffsetArcsec: ra, sourceDecOffsetArcsec: dec,
      xWestArcsec, yNorthArcsec, status: flag === '<' ? 'upper-limit' : 'detection', intensityMilliKelvin, intensityLimit: flag === '<' ? '<' : null,
      velocityLsrKmS, fwhmKmS, velocityUncertaintyKmS: null, intensityUncertaintyMilliKelvin: null, fwhmUncertaintyKmS: null,
      possiblyUnresolvedBlend: fwhmKmS !== null && fwhmKmS > r.broadLineNotice.thresholdFwhmKmS,
      inferred: { columnDensityCm2, fractionalAbundance } };
  });
  const pointings = [...groups.values()];
  if (pointings.some(p => (p.upperLimits > 0 && p.detectedComponents > 0) || p.upperLimits > 1)) throw new TypeError('Conflicting detections and upper limits at a pointing.');
  const detected = points.filter(point => point.status === 'detection'), velocities = detected.map(point => point.velocityLsrKmS!);
  const diagnostics: MolecularCatalogue['diagnostics'] = { rows: points.length, pointings: pointings.length, detectedComponents: detected.length,
    detectedPointings: pointings.filter(p => p.detectedComponents > 0).length, upperLimits: points.length - detected.length,
    multiComponentPointings: pointings.filter(p => p.detectedComponents > 1).length,
    maximumComponents: Math.max(...pointings.map(p => p.detectedComponents)), broadComponents: points.filter(p => p.possiblyUnresolvedBlend).length,
    centralPointingPresent: pointings.some(p => p.xWestArcsec === 0 && p.yNorthArcsec === 0),
    velocityRangeKmS: velocities.length ? [Math.min(...velocities), Math.max(...velocities)] : null,
    xWestRangeArcsec: [Math.min(...points.map(p => p.xWestArcsec)), Math.max(...points.map(p => p.xWestArcsec))],
    yNorthRangeArcsec: [Math.min(...points.map(p => p.yNorthArcsec)), Math.max(...points.map(p => p.yNorthArcsec))] };
  for (const key of ['rows', 'pointings', 'detectedComponents', 'detectedPointings', 'upperLimits'] as const)
    if (diagnostics[key] !== r.expectedCounts[key]) throw new TypeError(`Molecular ${key} differs from the pinned source audit.`);
  return { points, pointings, diagnostics };
}
