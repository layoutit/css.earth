/** Local, source-only cluster adapter. No image, fit, legacy model or renderer input. */
import { readFile } from 'node:fs/promises';
import {ARCHIVE} from './inputs.mts';

export type Vec3 = [number, number, number];
export interface BroadBandConstraint {
  source: string; name: string; absoluteV: number; errorV: number;
  intrinsicUB: number; errorUB: number; intrinsicBV: number; errorBV: number;
  intrinsicVR: number; errorVR: number; logAgeYr: number;
  agePlusDex: number; ageMinusDex: number; extinctionEBV: number;
  extinctionSource: 'Glatt2010' | 'assumed-0.13';
}
export interface ClusterComponent {
  id: string; sourceRow: number; aliases: string[]; raDeg: number; decDeg: number;
  apparentRadiusArcmin: number; reportedApparentV: number; errorV: number;
  fluxRelativeToV10: number; relativeFluxErrorLinearized: number; ebv: number;
  logAgeYr: number; secondLogAgeYr: number | null; ageLimit: string;
  ageQuality: number | null; multiplePopulationFlag: boolean;
  bica: null | { table: number; row: number; aliases: string[]; type: string; comments: string;
    majorDiameterArcmin: number; minorDiameterArcmin: number;
    positionAngleEastOfNorthDeg: number | null; separationArcsec: number;
    meanRadiusDifferenceArcmin: number };
  photometryAlternate: BroadBandConstraint | null;
  caution: string[];
}
export interface BicaRow {
  table: number; row: number; aliases: string[]; type: string; comments: string;
  raDeg: number; decDeg: number; majorDiameterArcmin: number;
  minorDiameterArcmin: number; positionAngleEastOfNorthDeg: number | null;
}
const DEG = Math.PI / 180;
function need(value: unknown, message: string): asserts value { if (!value) throw new Error(message); }
function field(line: string, a: number, b: number): string { return line.slice(a - 1, b).trim(); }
function numeric(line: string, a: number, b: number, label: string): number {
  const raw = field(line, a, b); need(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(raw), `Invalid ${label}: ${raw}`);
  const value = Number(raw); need(Number.isFinite(value), `Nonfinite ${label}`); return value;
}
function aliases(raw: string): string[] { return raw.split(/[,;]/).map(s => s.trim()).filter(Boolean); }
function key(value: string): string { return value.replace(/\s+/g, '').toUpperCase(); }
function coordinate(line: string, columns: [number, number][]): [number, number] {
  need(columns.length === 7, 'Coordinate schema needs seven fields');
  const get = (i: number): number => numeric(line, columns[i]![0], columns[i]![1], 'coordinate');
  const [h, m, s, d, dm, ds] = [get(0), get(1), get(2), get(4), get(5), get(6)];
  const sign = field(line, columns[3]![0], columns[3]![1]);
  need(h! >= 0 && h! < 24 && m! >= 0 && m! < 60 && s! >= 0 && s! <= 60, 'Invalid RA sexagesimal');
  need((sign === '-' || sign === '+') && d! >= 0 && d! <= 90 && dm! >= 0 && dm! < 60 && ds! >= 0 && ds! <= 60, 'Invalid declination sexagesimal');
  const ra = (h! + m! / 60 + s! / 3600) * 15, dec = (sign === '-' ? -1 : 1) * (d! + dm! / 60 + ds! / 3600);
  need(ra < 360 && Math.abs(dec) <= 90, 'Invalid spherical position'); return [ra, dec];
}
function separationArcsec(a: { raDeg: number; decDeg: number }, b: { raDeg: number; decDeg: number }): number {
  const d = (a.decDeg - b.decDeg) * DEG, r = (a.raDeg - b.raDeg) * DEG;
  const q = Math.sin(d / 2) ** 2 + Math.cos(a.decDeg * DEG) * Math.cos(b.decDeg * DEG) * Math.sin(r / 2) ** 2;
  return 2 * Math.asin(Math.sqrt(Math.min(1, q))) / DEG * 3600;
}
async function lines(file: string): Promise<string[]> {
  const data = await readFile(`${ARCHIVE}dataset-model/detail-clusters/${file}`, 'utf8');
  need(!/[^\x09\x0a\x0d\x20-\x7e]/.test(data), `Non-ASCII vendor table ${file}`);
  return data.split(/\r?\n/).filter(s => s.trim());
}
export async function loadBica(): Promise<BicaRow[]> {
  const result: BicaRow[] = [];
  for (const [table, count, classes] of [[3,3740,['C','CN','CA','DCN']],[4,3326,['A','AN','AC','DAN']],[5,1445,['NA','NC','EN','SNR','DNC','DNA']]] as const) {
  const rows = await lines(`Bica2008-table${table}.dat`); need(rows.length === count, 'Bica row count changed');
  result.push(...rows.map((line, i) => {
    need(line.length >= 68 && line.length <= 120, `Bad Bica record ${i + 1}`);
    const [raDeg, decDeg] = coordinate(line, [[33, 34], [36, 37], [39, 40], [43, 43], [44, 45], [47, 48], [50, 51]]);
    const majorDiameterArcmin = numeric(line, 57, 62, 'major diameter'), minorDiameterArcmin = numeric(line, 64, 68, 'minor diameter');
    need(majorDiameterArcmin > 0 && minorDiameterArcmin > 0, `Nonpositive Bica diameter at row ${i+1}`);
    const pa = field(line, 70, 72), positionAngleEastOfNorthDeg = pa === '-' || pa === '' ? null : numeric(line, 70, 72, 'PA');
    need(positionAngleEastOfNorthDeg === null || positionAngleEastOfNorthDeg >= 0 && positionAngleEastOfNorthDeg <= 180, 'Invalid Bica PA');
    const type = field(line, 53, 55); need(classes.some(v=>v===type), `Unexpected Bica class ${type}`);
    return { table, row: i + 1, aliases: aliases(field(line, 1, 32)), type, comments: field(line, 74, 120), raDeg, decDeg,
      majorDiameterArcmin, minorDiameterArcmin, positionAngleEastOfNorthDeg };
  }));
  }
  return result;
}
async function loadAlternatePhotometry(): Promise<BroadBandConstraint[]> {
  const output: BroadBandConstraint[] = [];
  for (const table of [1, 2]) {
    const rows = await lines(`Popescu2012-table${table}.dat`);
    need(rows.length === (table === 1 ? 288 : 632), 'Popescu row count changed');
    for (const line of rows) {
      const offset = table === 1 ? 0 : 4;
      const read = (a: number, b: number): number => numeric(line, a + offset, b + offset, 'UBVR');
      const value: BroadBandConstraint = { source: `J/ApJ/751/122/table${table}`, name: field(line, 1, 17),
        absoluteV: read(19, 24), errorV: read(26, 30), intrinsicUB: read(32, 37), errorUB: read(39, 43),
        intrinsicBV: read(45, 50), errorBV: read(52, 56), intrinsicVR: read(58, 63), errorVR: read(65, 69),
        logAgeYr: numeric(line, table === 1 ? 93 : 81, table === 1 ? 96 : 84, 'alternate age'),
        agePlusDex: numeric(line, table === 1 ? 98 : 86, table === 1 ? 101 : 89, 'age plus'),
        ageMinusDex: numeric(line, table === 1 ? 103 : 91, table === 1 ? 106 : 94, 'age minus'),
        extinctionEBV: table === 1 ? numeric(line, 87, 91, 'EBV') : .13,
        extinctionSource: table === 1 ? 'Glatt2010' : 'assumed-0.13' };
      need([value.errorV, value.errorUB, value.errorBV, value.errorVR, value.agePlusDex, value.ageMinusDex, value.extinctionEBV].every(v => v >= 0), 'Negative photometry uncertainty');
      need(value.logAgeYr > 0 && value.logAgeYr < 11 && value.absoluteV > -20 && value.absoluteV < 10, 'Invalid alternate physical range');
      output.push(value);
    }
  }
  return output;
}

export async function loadDetailClusters() {
  const [source, bica, alternative] = await Promise.all([lines('Glatt2010-lmc.dat'), loadBica(), loadAlternatePhotometry()]);
  need(source.length === 1194, 'Glatt CDS row count changed');
  const aliasOwners = new Map<string, Set<string>>();
  for (const line of source) for (const alias of aliases(field(line, 66, 111))) {
    const name = key(alias), owners = aliasOwners.get(name) ?? new Set<string>();
    owners.add(field(line, 1, 7)); aliasOwners.set(name, owners);
  }
  const seen = new Set<string>(), components: ClusterComponent[] = [];
  for (const [index, line] of source.entries()) {
    need(line.length >= 64 && line.length <= 111, `Bad Glatt record ${index + 1}`);
    const id = field(line, 1, 7); need(/^LMC\d{4}$/.test(id) && !seen.has(id), `Invalid/duplicate Glatt id ${id}`); seen.add(id);
    const [raDeg, decDeg] = coordinate(line, [[36, 36], [38, 39], [41, 42], [44, 44], [45, 46], [48, 49], [51, 52]]);
    const reportedApparentV = numeric(line, 54, 59, 'V'), errorV = numeric(line, 61, 64, 'errorV');
    const apparentRadiusArcmin = numeric(line, 16, 20, 'R'), ebv = numeric(line, 10, 14, 'EBV');
    const logAgeYr = numeric(line, 23, 26, 'logAge'), secondAge = field(line, 28, 31), quality = field(line, 33, 33);
    const ageQuality = quality === '-' || quality === '' ? null : numeric(line, 33, 33, 'age quality');
    const ageLimit = field(line, 22, 22); need(['', '>', '<'].includes(ageLimit), `Unknown age limit ${ageLimit}`);
    need(ageQuality === null || [1, 2, 3].includes(ageQuality), 'Unknown age-quality code');
    need(apparentRadiusArcmin > 0 && apparentRadiusArcmin < 60 && errorV >= 0 && ebv >= 0 && reportedApparentV > 0 && reportedApparentV < 30 && logAgeYr > 0 && logAgeYr < 11, 'Invalid Glatt physical range');
    const crossIds = aliases(field(line, 66, 111)), names = new Set(crossIds.map(key).filter(name=>aliasOwners.get(name)!.size===1));
    const matched = bica.filter(row => row.aliases.some(v => names.has(key(v))) && separationArcsec({ raDeg, decDeg }, row) <= 1);
    const match = matched.length === 1 ? matched[0]! : null;
    const alternates = alternative.filter(row => row.name.split('.').some(v => names.has(key(v))));
    const caution: string[] = [];
    if (crossIds.some(name=>aliasOwners.get(key(name))!.size>1)) caution.push('Shared source alias suppressed for joins; inspect qualification duplicateAliases.');
    if (field(line, 8, 8) === '*') caution.push('Possible double/multiple population; retain distinct IDs and audit aperture overlap.');
    if (!match) caution.push(matched.length ? 'Ambiguous Bica identity: retain circular Glatt aperture.' : 'No alias+coordinate Bica table3 match: retain circular Glatt aperture.');
    if (match && ['CA','AC'].includes(match.type)) caution.push('Bica class is intermediate cluster/association, not a secure bound cluster.');
    if (match?.table===5) caution.push('Bica dimensions describe a nebula/embedded object: keep Glatt circular stellar aperture, do not substitute nebular axes.');
    if (match && match.majorDiameterArcmin < match.minorDiameterArcmin) caution.push('Vendor major<minor: retain raw axes but do not use ellipse.');
    if (match && Math.abs(apparentRadiusArcmin-(match.majorDiameterArcmin+match.minorDiameterArcmin)/4)>.006) caution.push('Glatt and Bica apparent sizes differ beyond 0.01-arcmin rounding: use reported Glatt aperture, hold ellipse substitution.');
    if (match && match.majorDiameterArcmin !== match.minorDiameterArcmin && match.positionAngleEastOfNorthDeg === null) caution.push('Noncircular Bica axes lack PA: do not invent orientation.');
    if (ageLimit || ageQuality === null || ageQuality === 3 || secondAge) caution.push('Age is limited, low-quality, or ambiguous; use only as a flagged population constraint.');
    if (alternates.length > 1) caution.push('Ambiguous UBVR alias: no alternate photometry attached.');
    components.push({ id, sourceRow: index + 1, aliases: crossIds, raDeg, decDeg, apparentRadiusArcmin,
      reportedApparentV, errorV, fluxRelativeToV10: 10 ** (-.4 * (reportedApparentV - 10)), relativeFluxErrorLinearized: Math.LN10 * .4 * errorV,
      ebv, logAgeYr, secondLogAgeYr: secondAge ? numeric(line, 28, 31, 'second age') : null, ageLimit, ageQuality,
      multiplePopulationFlag: field(line, 8, 8) === '*',
      bica: match ? { table:match.table, row: match.row, aliases: match.aliases, type: match.type, comments: match.comments,
        majorDiameterArcmin: match.majorDiameterArcmin, minorDiameterArcmin: match.minorDiameterArcmin,
        positionAngleEastOfNorthDeg: match.positionAngleEastOfNorthDeg, separationArcsec: separationArcsec({raDeg,decDeg},match),
        meanRadiusDifferenceArcmin: apparentRadiusArcmin - (match.majorDiameterArcmin + match.minorDiameterArcmin) / 4 } : null,
      photometryAlternate: alternates.length === 1 ? alternates[0]! : null, caution });
  }
  const excludedComponents: ClusterComponent[] = [];
  const eligibleComponents = components.filter(cluster=>{
    const same = components.filter(other=>other.raDeg===cluster.raDeg&&other.decDeg===cluster.decDeg);
    if (same.length===1) return true;
    cluster.caution.push(`Coincident source identity held: ${same.map(v=>v.id).join(', ')}. No arbitrary brightness winner.`);
    excludedComponents.push(cluster); return false;
  });
  return { components:eligibleComponents, excludedComponents, metadata: {
    kind: 'lmc-measured-cluster-constraints@1', source: 'https://cdsarc.cds.unistra.fr/ftp/J/A+A/517/A50/',
    paper: 'https://doi.org/10.1051/0004-6361/201014187', cdsRevision: '2011-04-05 names corrected', sourceRows: source.length,
    eligibleRows:eligibleComponents.length, withheldIds:excludedComponents.map(v=>v.id),
    footprint: 'MCPS central LMC 64 square degrees; selected populous young clusters, not all-LMC completeness',
    primaryV: 'Reported apparent V: sum resolved-star flux within circular R, subtract area-scaled local annulus flux. Not a measured 3D emissivity or RGB.',
    primaryRadius: 'Reported apparent overall circular aperture radius. Method implies (Bica major diameter + minor diameter)/4 but catalogue differences are preserved; not core, half-light or tidal radius.',
    alternateUBVR: 'Hunter2003 photometry as reprocessed by Popescu2012: extinction-corrected absolute V and intrinsic colors; do not combine with apparent V as if observed bands.',
    aliasRule: 'Aliases shared by different Glatt IDs never join. Bica: exact normalized alias AND <=1 arcsec coordinate agreement in tables3/4/5; unique row only. Popescu: one unique alias match only. Coincident Glatt centers are withheld.',
    depth: 'Unmeasured here. A consumer must supply conditional distance and finite LOS half-depth; do not copy angular radius into LOS depth as a measurement.',
    lightBudget: 'Redistribute a shared stellar-light budget or explicitly remove this aperture light from diffuse light; do not add catalogue and VMC/continuum light twice.',
    sourceIndependentPositionsAndSizes: true, photographUsed: false, rendererUsed: false,
  } };
}

