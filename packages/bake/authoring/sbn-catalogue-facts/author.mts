/**
 * Fill small-body factsheets from six PDS Small Bodies Node catalogues (catalogues.json): the Asteroid Lightcurve
 * Database V4.0, Small Bodies Occultations V4.0, TNO and Centaur Diameters, Albedos and Densities V1.0, NEOWISE
 * Diameters and Albedos V2.0, Asteroid Masses (Baer, Chesley and Britt 2012) and Binary Minor Planets V3.0.
 *
 *   node packages/bake/authoring/sbn-catalogue-facts/author.mts [--fetch] [--check] [--only=<id>,<id>] [--report=<path>]
 *
 * Every table is read through its own PDS4 label: field names, positions and missing-value constants come from the
 * label, and the record count must match it. For each asteroid, comet, trans-Neptunian object and dwarf planet in the
 * astronomy records, the tool finds the rows for its minor-planet number, applies the selection rules below, and
 * writes `source/reference/sbn-catalogues.json` (the rows, as the label reads them, with the product LIDVID and the
 * rule that chose each value), its manifest entry, and facts that cite it. A fact is added only when the body shows
 * no value of that kind; a shown value is never replaced. A catalogue value that disagrees with a shown value, or a
 * row a rule rejects, is written to the body's investigation ledger and to the run report.
 *
 * Selection rules (each value is one catalogue row; nothing is averaged; a diameter, albedo, mass or density is shown
 * only when it is at least three times its stated uncertainty):
 * - Rotation period: the LCDB summary row, when its quality code U is 2- or better (the LCDB
 *   readme, section 4.1.2, calls these useful for statistical studies), its period is numeric and unqualified
 *   (PFlag blank or S), and it is not marked private.
 * - Size: an occultation fit of a shape model (Small Bodies Occultations) is the most direct measurement; then the TNO
 *   and Centaur compilation (method rank occultation, imaging, mutual events, thermal, multiple; the latest entry of
 *   the best method); then NEOWISE (a fitted diameter; the row the body already uses for its display scale, else a
 *   fitted beaming parameter, the most W3+W4 detections, the smallest relative error). Among occultation fits: the smallest
 *   relative uncertainty, then the most events, then the shape model the body displays. A size is not
 *   added when the body shows a measured size, or when its astronomy record takes its size from a publication.
 * - Geometric albedo: the TNO compilation row chosen for size, else the NEOWISE row chosen by the size rule.
 * - Mass and density: Baer et al., the determination with the smallest stated uncertainty that the compilation does
 *   not flag (DENSITY_NOTE N); density from the same row, or the
 *   latest unflagged TNO compilation density. Not added when the body's astronomy record already carries a mass (GM).
 * - Companions: every Binary Minor Planets row for the primary, with its semimajor axis (or separation) and period,
 *   except a companion the app already shows as a body of its own (catalogues.json rules.omitCompanionsShownAsBodies).
 * - catalogues.json rules.omitKinds names kinds never shown (lightcurve amplitude). A fact of an omitted kind that this
 *   tool wrote earlier is removed on the next run, with the reference rows only it cited; facts by other authors are kept.
 *
 * Run from the repository root. `--fetch` downloads missing tables and labels into the cache named in
 * catalogues.json; `--check` writes nothing and fails when a file would change.
 */
import { INVESTIGATION_LEDGER_SCHEMA } from '@cssearth/objects';
import assert from 'node:assert/strict';
import { mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import { loadTable, numeric, value, type Row, type Table } from './pds4-table.mts';
import { spliceDocument } from './manifest-splice.mts';
import { halfUnit, interval, scientific, shortReference } from './format.mts';

const ROOT = resolve(import.meta.dirname, '../../../..');
if (process.cwd() !== ROOT) throw new Error('Run from the repository root.');
const TOOL = 'packages/bake/authoring/sbn-catalogue-facts/author.mts';
const EVIDENCE = 'reference/sbn-catalogues.json', EVIDENCE_PATH = `source/${EVIDENCE}`, LEDGER_ID = 'sbn-catalogue-facts';
const SMALL_BODIES = new Set(['asteroid', 'comet', 'trans-neptunian', 'dwarf-planet', 'interstellar']);
/** Catalogue-level display scales. A display radius from one of these is a scale choice, not a shown measurement. */
const SCALE_CATALOGUES = new Set(['akari-acua-v1', 'neowise-diameters-albedos-v2', 'masiero-2012-neowise', 'masiero-2014-neowise', 'iras-minor-planet-survey-v6', 'damit-models']);
/** An astronomy record whose physical note cites a publication takes its size and mass from that publication. */
const PAPER_PHYSICAL = /\(\d{4}\)|et al\.|\bdoi\b|DART|ESA\/RMOC|MPCD2021|Buie|Published model reference radii|radar/i;
const LCDB_USEFUL = new Set(['3', '3-', '2+', '2', '2-']);
const G_KM3_PER_KG_S2 = 6.6743e-20; // CODATA 2018 G, used only to compare a catalogue mass with a record's GM for review.

const args = process.argv.slice(2);
const fetchMissing = args.includes('--fetch'), check = args.includes('--check');
const only = args.find(arg => arg.startsWith('--only='))?.slice(7).split(',').filter(Boolean);
const reportPath = args.find(arg => arg.startsWith('--report='))?.slice(9) ?? 'output/catalogue-facts/report.json';

// ---------------------------------------------------------------- catalogue inputs

interface Catalogue { key: string; catalogueId: string; citation: string; bundle: string; tables: Record<string, string> }
const inputs = requireRecord(JSON.parse(await readFile(resolve(import.meta.dirname, 'catalogues.json'), 'utf8')), 'catalogues.json');
const CHECKED = requireString(inputs.checked, 'checked'), CACHE = requireString(inputs.cache, 'cache');
/** Reviewed omissions: fact kinds not shown at all, and companions the app already shows as bodies of their own. */
const rules = requireRecord(inputs.rules, 'rules');
const OMIT_KINDS = new Set(requireArray(rules.omitKinds, 'rules.omitKinds').map(kind => requireString(kind, 'omitted kind')));
assert.equal(typeof rules.omitCompanionsShownAsBodies, 'boolean', 'rules.omitCompanionsShownAsBodies');
const OMIT_SHOWN_COMPANIONS = rules.omitCompanionsShownAsBodies === true;
const kindOf = (id: string) => id.startsWith('companion-') ? 'companion' : id;
assert.match(CHECKED, /^\d{4}-\d{2}-\d{2}$/);
const catalogues = Object.fromEntries(Object.entries(requireRecord(inputs.catalogues, 'catalogues')).map(([key, raw]) => {
  const record = requireRecord(raw, key);
  const tables = Object.fromEntries(Object.entries(requireRecord(record.tables, `${key} tables`)).map(([name, url]) => [name, requireString(url, `${key} ${name}`)]));
  return [key, { key, catalogueId: requireString(record.catalogueId), citation: requireString(record.citation), bundle: requireString(record.bundle), tables } satisfies Catalogue];
})) as Record<string, Catalogue>;
for (const key of ['lcdb', 'occultations', 'tno', 'neowise', 'masses', 'binary']) assert.ok(catalogues[key], `catalogues.json lacks ${key}`);
const catalogue = (key: string) => catalogues[key]!;

const tables: Record<string, Table> = {};
for (const entry of Object.values(catalogues)) for (const [name, url] of Object.entries(entry.tables)) tables[`${entry.key}.${name}`] = await loadTable(ROOT, CACHE, url, fetchMissing);
const table = (name: string) => { const found = tables[name]; assert.ok(found, `table ${name}`); return found; };

/** Reference code → full reference, for the tables that cite one per row. */
function referenceIndex(name: string, code: string, text: string): Map<string, string> {
  const source = table(name), index = new Map<string, string>();
  let last: string | undefined;
  for (const row of source.rows) {
    const key = row.fields[code] ?? '', reference = (row.fields[text] ?? '').replace(/\s+/g, ' ').trim();
    if (key === '-' && last) index.set(last, `${index.get(last)} ${reference}`.trim());
    else if (key) { index.set(key, reference); last = key; }
  }
  return index;
}
const tnoReferences = referenceIndex('tno.references', 'REFERENCE_CODE', 'REFERENCE');
const binaryReferences = referenceIndex('binary.references', 'REFERENCE_CODE', 'REFERENCE');
const massReferences = referenceIndex('masses.references', 'SHORT_REF', 'FULL_REF');
const neowiseReferenceFields = table('neowise.references').label.fields.map(field => field.name);
const neowiseReferences = new Map(table('neowise.references').rows.map(row => [row.fields[neowiseReferenceFields[0]!]!, row.fields[neowiseReferenceFields.at(-1)!]!]));

// ---------------------------------------------------------------- bodies

interface Fact { id: string; label: string; value: string; source?: Record<string, string> }
interface Body {
  id: string; classification: string; name: string; number?: number; designation?: string; matchedBy: string;
  physicalNotes: string; gm?: number; meanRadiusKm?: number; contentPath: string; content: Record<string, unknown>;
  facts: Fact[]; ownFacts: Fact[]; displayedModel?: string; calibrationRow?: Record<string, string>;
}
const normalize = (text: string) => text.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '');

async function readJson(path: string): Promise<Record<string, unknown>> { return requireRecord(JSON.parse(await readFile(path, 'utf8')), path); }
async function optionalJson(path: string) { try { return await readJson(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined; throw error; } }

function parseFact(raw: unknown): Fact {
  const fact = requireRecord(raw, 'fact');
  const source = fact.source === undefined ? undefined : Object.fromEntries(Object.entries(requireRecord(fact.source, 'fact source')).map(([key, text]) => [key, requireString(text, `fact source ${key}`)]));
  return { id: requireString(fact.id), label: requireString(fact.label), value: requireString(fact.value), ...(source ? { source } : {}) };
}

/** Bodies the app shows as satellites of a primary: astronomy records whose parent is that primary, and the moons of
 * site/source/moon-catalogues.json. Each is listed with the names it goes by. */
async function readShownSatellites(): Promise<Map<string, { id: string; names: string[] }[]>> {
  const shown = new Map<string, { id: string; names: string[] }[]>();
  const add = (parent: string, id: string, names: unknown[]) => {
    const list = shown.get(parent) ?? [];
    let entry = list.find(existing => existing.id === id);
    if (!entry) { entry = { id, names: [] }; list.push(entry); }
    for (const name of names) if (typeof name === 'string' && name.trim()) entry.names.push(name);
    shown.set(parent, list);
  };
  const directory = resolve(ROOT, 'packages/astronomy/data/bodies');
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.json')).sort()) {
    const record = await readJson(resolve(directory, file)), physical = record.physical;
    if (physical && typeof physical === 'object' && typeof (physical as Record<string, unknown>).parent === 'string') {
      const parent = (physical as Record<string, unknown>).parent as string;
      if (parent !== 'sun') add(parent, requireString(record.id), [record.id, (physical as Record<string, unknown>).name]);
    }
  }
  const moons = await readJson(resolve(ROOT, 'site/source/moon-catalogues.json'));
  for (const raw of requireArray(moons.systems, 'moon catalogue systems')) {
    const system = requireRecord(raw, 'moon system');
    for (const moon of requireArray(system.moons ?? [], 'moons').map(value => requireRecord(value, 'moon')))
      add(requireString(system.id), requireString(moon.id), [moon.id, moon.name, moon.provisionalDesignation]);
  }
  return shown;
}
const SHOWN_SATELLITES = await readShownSatellites();

async function readBodies(): Promise<Body[]> {
  const directory = resolve(ROOT, 'packages/astronomy/data/bodies'), bodies: Body[] = [];
  for (const file of (await readdir(directory)).filter(name => name.endsWith('.json')).sort()) {
    const record = await readJson(resolve(directory, file)), classification = requireString(record.classification);
    if (!SMALL_BODIES.has(classification)) continue;
    const id = requireString(record.id);
    if (only && !only.includes(id)) continue;
    const physical = requireRecord(record.physical, `${id} physical`), name = requireString(physical.name, `${id} name`);
    const objectDirectory = resolve(ROOT, 'src/objects', id), descriptor = await readJson(resolve(objectDirectory, 'object.json'));
    const sources = requireArray(requireRecord(requireRecord(descriptor.properties).recipe).sources).map(raw => requireRecord(raw));
    const contentPath = resolve(objectDirectory, requireString(sources.find(source => source.id === 'content')?.path, `${id} content path`));
    const content = await readJson(contentPath), panel = requireRecord(content.panel, `${id} panel`);
    const all = [...requireArray(panel.facts ?? []), ...requireArray(panel.moreFacts ?? [])].map(parseFact);
    // Identity: the pinned SBDB record's number, else the Horizons command (a number, or 92xxxxxxx for a system barycentre).
    const sbdb = await optionalJson(resolve(objectDirectory, 'source/reference/sbdb.json'));
    const sbdbDes = sbdb && typeof sbdb.object === 'object' && sbdb.object ? (sbdb.object as Record<string, unknown>).des : undefined;
    const horizons = typeof physical.horizonsCode === 'string' ? physical.horizonsCode : '';
    let number: number | undefined, designation: string | undefined, matchedBy = 'unmatched';
    if (typeof sbdbDes === 'string' && /^\d+$/.test(sbdbDes)) { number = Number(sbdbDes); matchedBy = `SBDB record des ${sbdbDes}`; }
    else if (/^\d+;$/.test(horizons)) { number = Number(horizons.slice(0, -1)); matchedBy = `Horizons command ${horizons}`; }
    else if (/^92\d{7}$/.test(horizons)) { number = Number(horizons.slice(2)); matchedBy = `Horizons system barycentre ${horizons}`; }
    else if (/^\d{4} [A-Z]{2}\d*;$/.test(horizons)) { designation = horizons.slice(0, -1); matchedBy = `Horizons designation ${designation}`; }
    const damit = await optionalJson(resolve(objectDirectory, 'source/reference/damit-model.json'));
    const calibration = await optionalJson(resolve(objectDirectory, 'source/reference/calibration.json'));
    const calibrationRow = calibration && typeof calibration.selectedRow === 'object' && calibration.selectedRow
      ? Object.fromEntries(Object.entries(calibration.selectedRow as Record<string, unknown>).map(([key, text]) => [key.toLowerCase(), String(text)])) : undefined;
    bodies.push({ id, classification, name, number, designation, matchedBy,
      physicalNotes: typeof record.physicalNotes === 'string' ? record.physicalNotes : '',
      gm: typeof physical.gravitationalParameterKm3PerS2 === 'number' && physical.gravitationalParameterKm3PerS2 > 0 ? physical.gravitationalParameterKm3PerS2 : undefined,
      meanRadiusKm: typeof physical.meanRadiusKm === 'number' ? physical.meanRadiusKm : undefined,
      contentPath, content,
      facts: all.filter(fact => fact.source?.path !== EVIDENCE_PATH), ownFacts: all.filter(fact => fact.source?.path === EVIDENCE_PATH),
      displayedModel: damit && damit.modelId !== undefined ? String(damit.modelId) : undefined, calibrationRow });
  }
  return bodies;
}

/** A catalogue name agrees with a body's name when it is equal, a leading part of it ("1994 CC" for "1994 CC Alpha"),
 * its letters in order ("G||'homdima" for "Gǃkúnǁʼhòmdímà"), or a provisional designation, which the number already fixes. */
function nameAgrees(names: Set<string>, text: string) {
  if (/^\d{4} [A-Z]{2}\d*$/.test(text.trim())) return true;
  const row = normalize(text);
  const inOrder = (name: string) => { let at = 0; for (const char of row) { at = name.indexOf(char, at); if (at < 0) return false; at++; } return true; };
  return [...names].some(name => name === row || (row.length >= 4 && (name.startsWith(row) || inOrder(name))));
}

/** Rows of a table for a body: by number, then the row's name or designation must agree with the body's name. */
function rowsFor(body: Body, source: Table, numberField: string, nameFields: string[], designationField?: string, mismatches?: string[]): Row[] {
  const names = new Set([body.name, body.name.replace(/^\d+\s+/, ''), body.name.replace(/\s*\(.*\)\s*/, ''), ...(/\(([^)]+)\)/.exec(body.name)?.slice(1) ?? []), body.designation ?? ''].map(normalize).filter(Boolean));
  return source.rows.filter(row => {
    if (body.number !== undefined) { if (numeric(source, row, numberField) !== body.number) return false; }
    else if (!body.designation || !designationField || normalize(row.fields[designationField] ?? '') !== normalize(body.designation)) return false;
    const rowNames = nameFields.map(field => value(source, row, field)).filter((text): text is string => text !== undefined);
    if (!rowNames.length || rowNames.some(text => nameAgrees(names, text))) return true;
    mismatches?.push(`${source.lidvid} record ${row.recordNumber}: ${rowNames.join(' / ')} is not ${body.name}`);
    return false;
  });
}

// ---------------------------------------------------------------- per-body selection

interface Extract { catalogueId: string; product: string; url: string; rows: Row[]; selected?: Record<string, number>; rule?: string; references?: Record<string, string> }
interface Note { kind: string; status: 'conflict' | 'rejected'; text: string; evidence: string[] }
interface Outcome { body: Body; facts: Fact[]; extracts: Record<string, Extract>; notes: Note[] }

const firstNumber = (text: string) => { const match = /-?\d[\d,]*(?:\.\d+)?/.exec(text); return match ? { value: Number(match[0].replaceAll(',', '')), text: match[0].replaceAll(',', '') } : undefined; };
function hoursOf(text: string) {
  const number = firstNumber(text); if (!number) return undefined;
  return /\bdays?\b/i.test(text) ? { hours: number.value * 24, half: halfUnit(number.text) * 24 } : /\b(h|hours?)\b/i.test(text) ? { hours: number.value, half: halfUnit(number.text) } : undefined;
}
const has = (body: Body, ...ids: string[]) => body.facts.find(fact => ids.includes(fact.id));
const extractOf = (key: string, source: Table, rows: Row[]): Extract => ({ catalogueId: catalogue(key).catalogueId, product: source.lidvid, url: source.url, rows });
const pointer = (key: string, index: number, ...fields: string[]) => fields.map(field => `/${key}/rows/${index}/fields/${field.replaceAll('~', '~0').replaceAll('/', '~1')}`).join('; ');
const factFromTable = (id: string, label: string, text: string, key: string, source: Table, sourceLabel: string, locator: string): Fact =>
  ({ id, label, value: text, source: { url: source.url, label: sourceLabel, checked: CHECKED, path: EVIDENCE_PATH, catalogueId: catalogue(key).catalogueId, locator } });
/** A catalogue value is shown only when it is at least three times its stated uncertainty (a 3σ determination). */
const significant = (center: string | number | undefined, error: string | number | undefined) => center !== undefined && error !== undefined && Number(center) > 0 && Number(error) > 0 && Number(center) >= 3 * Number(error);

const companionLog: { objectId: string; companion: string; kept: boolean }[] = [];
function selectBody(body: Body, mismatches: string[]): Outcome {
  const facts: Fact[] = [], extracts: Record<string, Extract> = {}, notes: Note[] = [];
  const paperPhysical = PAPER_PHYSICAL.test(body.physicalNotes);

  // Rotation period and amplitude: the LCDB summary row.
  const lcdb = table('lcdb.summary'), lcRows = rowsFor(body, lcdb, 'Number', ['Name'], 'Name', mismatches);
  if (lcRows.length) {
    assert.equal(lcRows.length, 1, `${body.id}: several LCDB summary rows`);
    const row = lcRows[0]!, extract = extracts.lcdb = { ...extractOf('lcdb', lcdb, lcRows), selected: { summary: 0 },
      rule: 'LCDB summary row; shown when U is 2- or better, the period is numeric with PFlag blank or S, and the row is not private. Notes T (tumbling), T? and T+ (possibly tumbling) and A (ambiguous) are carried into the shown value.' };
    const u = value(lcdb, row, 'U'), period = value(lcdb, row, 'Period'), pflag = value(lcdb, row, 'PFlag') ?? '', privateRow = value(lcdb, row, 'Private') === 'Y';
    const useful = u !== undefined && LCDB_USEFUL.has(u) && !privateRow;
    const where = `LCDB V4.0 summary record ${row.recordNumber}`;
    const existingRotation = has(body, 'rotation-period', 'rotation');
    if (period && Number(period) > 0 && useful && ['', 'S'].includes(pflag)) {
      const kind = pflag === 'S' ? 'sidereal' : 'synodic';
      // Notes flags (LCDB readme, Table 4.1.5.3): T tumbling, T? and T+ possibly tumbling; A the most probable of ambiguous periods.
      const flags = value(lcdb, row, 'Notes') ?? '';
      const qualifiers = [kind, /T(?![?0+\-–])/.test(flags) ? 'tumbling' : /T[?+]/.test(flags) ? 'possibly tumbling' : undefined, flags.includes('A') ? 'ambiguous period' : undefined, `LCDB quality ${u}`]
        .filter((text): text is string => text !== undefined);
      if (!existingRotation) facts.push(factFromTable('rotation-period', 'Rotation period', `${period} hours (${qualifiers.join('; ')})`, 'lcdb', lcdb,
        `${catalogue('lcdb').citation}, summary table`, pointer('lcdb', 0, 'Period', 'PFlag', 'Notes', 'U')));
      else {
        const shown = hoursOf(existingRotation.value);
        if (shown && Math.abs(shown.hours - Number(period)) > Math.max(0.005 * Number(period), shown.half))
          notes.push({ kind: 'rotation-period', status: 'conflict', evidence: [extract.url],
            text: `Shown rotation "${existingRotation.value}" (${existingRotation.source?.catalogueId ?? 'uncited'}) differs from the ${where} period ${period} h (U ${u}, ${kind}); the shown value is kept.` });
      }
    } else if (period || u) {
      if (!existingRotation) notes.push({ kind: 'rotation-period', status: 'rejected', evidence: [extract.url],
        text: `${where} period ${period ?? value(lcdb, row, 'PerDesc') ?? 'none'} h with U ${u ?? 'none'}${pflag ? ` and PFlag ${pflag}` : ''}${privateRow ? ', private' : ''} is not shown: the LCDB rates only U 2- and better as useful.` });
    }
    const ampMax = value(lcdb, row, 'AmpMax'), ampMin = value(lcdb, row, 'AmpMin'), ampFlag = value(lcdb, row, 'AmpFlag') ?? '';
    if (ampMax && Number(ampMax) > 0 && useful && !has(body, 'lightcurve-amplitude')) {
      const upper = `${ampFlag === '>' ? 'more than ' : ampFlag === '<' ? 'less than ' : ''}${ampMax}`;
      const range = ampMin !== undefined && Number(ampMin) > 0 && Number(ampMin) !== Number(ampMax);
      const text = range ? `${ampMin} to ${upper} mag, peak to peak` : `${upper} mag, peak to peak`;
      facts.push(factFromTable('lightcurve-amplitude', 'Lightcurve amplitude', text, 'lcdb', lcdb, `${catalogue('lcdb').citation}, summary table`,
        pointer('lcdb', 0, ...(range ? ['AmpMin', 'AmpFlag', 'AmpMax'] : ['AmpMax', 'AmpFlag']), 'U')));
    }
  }

  // Size and albedo candidates.
  const existingSize = body.facts.filter(entry => ['diameter', 'radius', 'dimensions'].includes(entry.id));
  const measuredSizeShown = existingSize.some(entry => entry.label !== 'Display reference radius' || !SCALE_CATALOGUES.has(entry.source?.catalogueId ?? ''));
  const displayRadius = existingSize.find(entry => entry.label === 'Display reference radius');
  interface SizeCandidate { key: string; fact: Fact; center: number; error?: number; where: string; url: string }
  const sizes: SizeCandidate[] = [];
  let albedo: Fact | undefined;

  const occ = table('occultations.diameters'), occRows = rowsFor(body, occ, 'Designation', ['Name'], 'Name', mismatches);
  if (occRows.length) {
    assert.equal(occRows.length, 1, `${body.id}: several occultation diameter rows`);
    const row = occRows[0]!, fits = [1, 2, 3, 4].map(slot => ({ slot, diameter: value(occ, row, `Dia_${slot}`), uncertainty: value(occ, row, `Uncert_${slot}`),
      events: numeric(occ, row, `Events_${slot}`) ?? 0, invalid: numeric(occ, row, `Invalid_${slot}`) ?? 0, model: value(occ, row, `Model_Source_${slot}`), number: value(occ, row, `Model_Number_${slot}`) }))
      .filter(fit => significant(fit.diameter, fit.uncertainty) && fit.events > 0);
    fits.sort((left, right) => Number(left.uncertainty) / Number(left.diameter) - Number(right.uncertainty) / Number(right.diameter) || right.events - left.events
      || Number(right.model === 'DAMIT' && right.number === body.displayedModel) - Number(left.model === 'DAMIT' && left.number === body.displayedModel) || left.slot - right.slot);
    const best = fits[0];
    extracts.occultations = { ...extractOf('occultations', occ, occRows), ...(best ? { selected: { [`Dia_${best.slot}`]: 0 } } : {}),
      rule: 'Volume-equivalent diameter from fitting a shape model to occultation chords: among fits at least three times their uncertainty, the smallest relative uncertainty, then the most events, then the model this body displays. Diameter_Nominal (a weighted mean of IRAS, AKARI and NEOWISE) is not used.' };
    if (best) sizes.push({ key: 'occultations', center: Number(best.diameter), error: Number(best.uncertainty), url: occ.url,
      where: `Small Bodies Occultations V4.0 record ${row.recordNumber}, ${best.model} model ${best.number}`,
      fact: factFromTable('diameter', 'Occultation diameter', `${best.diameter} ± ${best.uncertainty} km (volume-equivalent; ${best.model} model ${best.number} fitted to ${best.events} occultation${best.events === 1 ? '' : 's'})`,
        'occultations', occ, `${catalogue('occultations').citation}, asteroid diameters table`, pointer('occultations', 0, `Dia_${best.slot}`, `Uncert_${best.slot}`, `Events_${best.slot}`, `Model_Source_${best.slot}`, `Model_Number_${best.slot}`)) });
  }

  const tno = table('tno.values'), tnoRows = rowsFor(body, tno, 'ASTEROID_NUMBER', ['ASTEROID_NAME', 'PROVISIONAL_DESIGNATION'], 'PROVISIONAL_DESIGNATION', mismatches);
  let tnoDensity: Fact | undefined;
  if (tnoRows.length) {
    const methodRank = ['O', 'I', 'E', 'T', 'M'];
    const methodLabel: Record<string, string> = { O: 'Occultation diameter', I: 'Imaged diameter', E: 'Mutual-event diameter', T: 'Thermal diameter', M: 'Diameter (combined methods)' };
    const clean = (code: string | undefined) => code === undefined;
    const candidates = tnoRows.map((row, index) => {
      const method = (value(tno, row, 'METHOD_DIAMETER_ALBEDO') ?? '').charAt(0), companions = numeric(tno, row, 'NUMBER_OF_COMPANIONS') ?? 0;
      const primary = value(tno, row, 'PRIMARY_DIAMETER'), primaryClean = primary !== undefined && Number(primary) > 0 && clean(value(tno, row, 'PRIMARY_DIAMETER_CODE'));
      const effective = value(tno, row, 'EFFECTIVE_DIAMETER'), effectiveClean = effective !== undefined && Number(effective) > 0 && clean(value(tno, row, 'EFFECTIVE_DIAMETER_CODE'));
      const field = companions > 0 ? (primaryClean ? 'PRIMARY' : effectiveClean ? 'EFFECTIVE' : undefined) : (effectiveClean ? 'EFFECTIVE' : primaryClean ? 'PRIMARY' : undefined);
      return { row, index, method, field, companions };
    }).filter(candidate => candidate.field && methodRank.includes(candidate.method));
    candidates.sort((left, right) => methodRank.indexOf(left.method) - methodRank.indexOf(right.method) || right.index - left.index);
    const best = candidates[0];
    const referencesUsed: Record<string, string> = {};
    const cite = (row: Row) => { const code = value(tno, row, 'REFERENCE_CODE') ?? ''; if (code) referencesUsed[code] = tnoReferences.get(code) ?? ''; return shortReference(tnoReferences.get(code), code); };
    const selected: Record<string, number> = {};
    if (best) {
      selected.diameter = best.index;
      const field = best.field!, center = value(tno, best.row, `${field}_DIAMETER`)!, upper = value(tno, best.row, `${field}_DIAMETER_ERROR_UPPER`), lower = value(tno, best.row, `${field}_DIAMETER_ERROR_LOWER`);
      const system = field === 'EFFECTIVE' && best.companions > 0;
      const label = system ? 'Combined effective diameter (system)' : methodLabel[best.method]!;
      if (significant(center, upper) && (lower === undefined || significant(center, lower))) sizes.push({ key: 'tno', center: Number(center), error: Number(upper), url: tno.url,
        where: `TNO and Centaur compilation record ${best.row.recordNumber} (${cite(best.row)})`,
        fact: factFromTable('diameter', label, `${interval(center, upper, lower)} km`, 'tno', tno, `${catalogue('tno').citation}, entry from ${cite(best.row)}`,
          pointer('tno', best.index, `${field}_DIAMETER`, `${field}_DIAMETER_ERROR_UPPER`, `${field}_DIAMETER_ERROR_LOWER`, 'METHOD_DIAMETER_ALBEDO', 'REFERENCE_CODE')) });
      const albedoValue = value(tno, best.row, 'ALBEDO'), albedoUpper = value(tno, best.row, 'ALBEDO_ERROR_UPPER');
      if (albedoValue !== undefined && significant(albedoValue, albedoUpper) && clean(value(tno, best.row, 'ALBEDO_CODE'))) {
        const color = value(tno, best.row, 'ALBEDO_COLOR');
        albedo = factFromTable('geometric-albedo', 'Geometric albedo', `${interval(albedoValue, albedoUpper, value(tno, best.row, 'ALBEDO_ERROR_LOWER'))}${color === 'V' ? ' (visible)' : color === 'R' || color === 'B' ? ` (band ${color})` : ''}`,
          'tno', tno, `${catalogue('tno').citation}, entry from ${cite(best.row)}`, pointer('tno', best.index, 'ALBEDO', 'ALBEDO_ERROR_UPPER', 'ALBEDO_ERROR_LOWER', 'ALBEDO_COLOR', 'REFERENCE_CODE'));
      }
    }
    const densities = tnoRows.map((row, index) => ({ row, index })).filter(({ row }) => significant(value(tno, row, 'DENSITY'), value(tno, row, 'DENSITY_ERROR_UPPER')) && clean(value(tno, row, 'DENSITY_CODE')));
    const density = densities.at(-1);
    if (density) {
      selected.density = density.index;
      tnoDensity = factFromTable('density', 'Bulk density', `${interval(value(tno, density.row, 'DENSITY')!, value(tno, density.row, 'DENSITY_ERROR_UPPER'), value(tno, density.row, 'DENSITY_ERROR_LOWER'))} g/cm³`,
        'tno', tno, `${catalogue('tno').citation}, entry from ${cite(density.row)}`, pointer('tno', density.index, 'DENSITY', 'DENSITY_ERROR_UPPER', 'DENSITY_ERROR_LOWER', 'METHOD_DENSITY', 'REFERENCE_CODE'));
    }
    extracts.tno = { ...extractOf('tno', tno, tnoRows), selected, references: referencesUsed,
      rule: 'Rows with an unqualified diameter (code blank: not assumed, derived or a limit); method rank occultation, imaging, mutual events, thermal, combined; the latest entry of the best method. A binary system shows its primary diameter when one is given. Density: the latest unqualified entry.' };
  }

  const neowiseKeys = Object.keys(catalogue('neowise').tables).filter(name => name !== 'references');
  const neowiseRows: { source: Table; row: Row }[] = [];
  for (const name of neowiseKeys) { const source = table(`neowise.${name}`); for (const row of rowsFor(body, source, 'Asteroid_Number', [], undefined, mismatches)) neowiseRows.push({ source, row }); }
  if (neowiseRows.length) {
    const fitted = neowiseRows.map((entry, index) => ({ ...entry, index, code: value(entry.source, entry.row, 'Fit_code') ?? '' })).filter(entry => entry.code.startsWith('D'));
    const usedByBody = (entry: typeof fitted[number]) => !!body.calibrationRow && body.calibrationRow.reference === value(entry.source, entry.row, 'Reference') && Number(body.calibrationRow.mean_jd) === numeric(entry.source, entry.row, 'Mean_JD');
    const thermal = (entry: typeof fitted[number]) => (numeric(entry.source, entry.row, 'N_W3') ?? 0) + (numeric(entry.source, entry.row, 'N_W4') ?? 0);
    const relative = (entry: typeof fitted[number]) => (numeric(entry.source, entry.row, 'Diameter_err') ?? Infinity) / (numeric(entry.source, entry.row, 'Diameter') ?? 1);
    fitted.sort((left, right) => Number(usedByBody(right)) - Number(usedByBody(left)) || Number(right.code[2] === 'B') - Number(left.code[2] === 'B')
      || thermal(right) - thermal(left) || relative(left) - relative(right) || (numeric(left.source, left.row, 'Mean_JD') ?? 0) - (numeric(right.source, right.row, 'Mean_JD') ?? 0));
    const best = fitted[0], referencesUsed: Record<string, string> = {};
    const rows = neowiseRows.map(entry => ({ ...entry.row, fields: { table: entry.source.lidvid, ...entry.row.fields } }));
    extracts.neowise = { ...extractOf('neowise', neowiseRows[0]!.source, rows), product: 'urn:nasa:pds:neowise_diameters_albedos::2.0', url: catalogue('neowise').bundle, references: referencesUsed,
      ...(best ? { selected: { diameter: best.index } } : {}),
      rule: 'Rows whose diameter was fitted (Fit_code begins with D): the row the body already uses for its display scale, else a fitted beaming parameter, the most W3+W4 detections, the smallest relative diameter error, the earliest epoch.' };
    if (best) {
      const code = value(best.source, best.row, 'Reference') ?? '';
      referencesUsed[code] = neowiseReferences.get(code) ?? '';
      const reference = shortReference(neowiseReferences.get(code), code, 'last'), sourceLabel = `${catalogue('neowise').citation}, ${reference} (${code})`;
      const diameter = value(best.source, best.row, 'Diameter')!, error = value(best.source, best.row, 'Diameter_err');
      if (significant(diameter, error)) sizes.push({ key: 'neowise', center: Number(diameter), error: Number(error), url: best.source.url,
        where: `NEOWISE V2.0 ${best.source.url.split('/').at(-1)} record ${best.row.recordNumber} (${reference})`,
        fact: factFromTable('diameter', 'Thermal diameter', `${diameter} ± ${error} km (NEOWISE, NEATM)`, 'neowise', best.source, sourceLabel, pointer('neowise', best.index, 'Diameter', 'Diameter_err', 'Fit_code', 'Reference')) });
      const visible = value(best.source, best.row, 'V_albedo'), visibleError = value(best.source, best.row, 'V_albedo_err');
      if (!albedo && best.code[1] === 'V' && significant(visible, visibleError))
        albedo = factFromTable('geometric-albedo', 'Geometric albedo', `${visible} ± ${visibleError} (visible)`, 'neowise', best.source, sourceLabel, pointer('neowise', best.index, 'V_albedo', 'V_albedo_err', 'Fit_code', 'Reference'));
    }
  }

  const rank = ['occultations', 'tno', 'neowise'];
  sizes.sort((left, right) => rank.indexOf(left.key) - rank.indexOf(right.key));
  const size = sizes[0];
  if (size) {
    const compareRecord = () => {
      if (body.meanRadiusKm === undefined || !size.error) return;
      const diameter = 2 * body.meanRadiusKm;
      if (Math.abs(diameter - size.center) > size.error) return `the astronomy record's mean radius ${body.meanRadiusKm} km (diameter ${diameter} km)`;
    };
    if (has(body, 'diameter') || measuredSizeShown) {
      const shown = existingSize.map(entry => `${entry.label} "${entry.value}" (${entry.source?.catalogueId ?? 'uncited'})`).join('; ');
      const number = existingSize.map(entry => ({ entry, value: firstNumber(entry.value) })).find(({ value: found }) => found);
      const scale = number ? (number.entry.id === 'radius' ? 2 : 1) * number.value!.value : undefined;
      if (scale !== undefined && number?.entry.id !== 'dimensions' && size.error && Math.abs(scale - size.center) > size.error + (number ? halfUnit(number.value!.text) * (number.entry.id === 'radius' ? 2 : 1) : 0))
        notes.push({ kind: 'diameter', status: 'conflict', evidence: [size.url], text: `Shown size ${shown} differs from the ${size.where} diameter ${size.fact.value}; the shown value is kept.` });
    } else if (paperPhysical) {
      // Not shown; noted only when it disagrees with the record's published size.
      const differs = compareRecord();
      if (differs) notes.push({ kind: 'diameter', status: 'conflict', evidence: [size.url],
        text: `${size.where} diameter ${size.fact.value} is not shown: the astronomy record takes its size from a publication ("${body.physicalNotes.slice(0, 160)}"), and it differs from ${differs}.` });
    } else {
      facts.push(size.fact);
      const differs = displayRadius ? undefined : compareRecord();
      if (differs) notes.push({ kind: 'diameter', status: 'conflict', evidence: [size.url],
        text: `The display scale in ${differs} is outside the added ${size.where} diameter ${size.fact.value}. The display scale is not changed.` });
      if (displayRadius) {
        const radius = firstNumber(displayRadius.value);
        if (radius && size.error && Math.abs(2 * radius.value - size.center) > size.error + 2 * halfUnit(radius.text))
          notes.push({ kind: 'diameter', status: 'conflict', evidence: [size.url],
            text: `The display scale "${displayRadius.value}" (${displayRadius.source?.catalogueId ?? 'uncited'}) implies a diameter of ${2 * radius.value} km, outside the added ${size.where} diameter ${size.fact.value}. Both are shown; the display scale is not changed.` });
      }
    }
  }
  if (albedo) {
    const shown = has(body, 'geometric-albedo');
    if (!shown) facts.push(albedo);
    else {
      const shownValue = firstNumber(shown.value), added = firstNumber(albedo.value), error = /±\s*([\d.]+)/.exec(albedo.value)?.[1];
      if (shownValue && added && error && Math.abs(shownValue.value - added.value) > Number(error) + halfUnit(shownValue.text))
        notes.push({ kind: 'geometric-albedo', status: 'conflict', evidence: [albedo.source!.url!],
          text: `Shown geometric albedo "${shown.value}" (${shown.source?.catalogueId ?? 'uncited'}) differs from ${albedo.value} (${albedo.source!.label}); the shown value is kept.` });
    }
  }

  // Mass and density: Baer, Chesley and Britt.
  const masses = table('masses.masses'), massRows = rowsFor(body, masses, 'AST_NUMBER', ['AST_NAME'], 'PROV_DESIG', mismatches)
    .filter(row => value(masses, row, 'SATELLITE_NAME') === undefined);
  let massDensity: Fact | undefined;
  if (massRows.length) {
    const referencesUsed: Record<string, string> = {};
    const usable = massRows.map((row, index) => ({ row, index, mass: numeric(masses, row, 'MASS_KG'), error: numeric(masses, row, 'MASS_KG_UNC'), note: value(masses, row, 'DENSITY_NOTE'), binary: value(masses, row, 'BINARY_NOTE') }))
      .filter(entry => significant(entry.mass, entry.error) && entry.note !== 'N' && entry.binary !== 'sec');
    usable.sort((left, right) => left.error! - right.error! || right.index - left.index);
    const best = usable[0];
    extracts.masses = { ...extractOf('masses', masses, massRows), references: referencesUsed, ...(best ? { selected: { mass: best.index } } : {}),
      rule: 'The determination with the smallest stated mass uncertainty, excluding rows the compilation flags (DENSITY_NOTE N), rows for a secondary, and rows under three times their uncertainty. Density from the same row, when it is at least three times its uncertainty.' };
    const rejected = massRows.length - usable.length;
    if (best) {
      const reference = value(masses, best.row, 'MASS_REF') ?? '';
      referencesUsed[reference] = massReferences.get(reference) ?? '';
      const sourceLabel = `${catalogue('masses').citation}, determination by ${reference}`;
      const massFact = factFromTable('mass', best.binary === 'sys' ? 'System mass' : 'Mass', `${scientific(value(masses, best.row, 'MASS_KG')!)} ± ${scientific(value(masses, best.row, 'MASS_KG_UNC')!)} kg`,
        'masses', masses, sourceLabel, pointer('masses', best.index, 'MASS_KG', 'MASS_KG_UNC', 'BINARY_NOTE', 'MASS_REF'));
      const density = value(masses, best.row, 'BULK_DENSITY'), densityError = value(masses, best.row, 'BULK_DENSITY_UNC');
      if (significant(density, densityError) && best.binary !== 'sys')
        massDensity = factFromTable('density', 'Bulk density', `${density} ± ${densityError} g/cm³`, 'masses', masses, sourceLabel, pointer('masses', best.index, 'BULK_DENSITY', 'BULK_DENSITY_UNC', 'SIZE_REF_CODE', 'MASS_REF'));
      if (has(body, 'mass')) { /* a shown mass is kept */ }
      else if (body.gm !== undefined || paperPhysical) {
        const recordMass = body.gm !== undefined ? body.gm / G_KM3_PER_KG_S2 : undefined;
        // Compared at both values' written precision: the catalogue mantissa and the GM digits.
        const massText = value(masses, best.row, 'MASS_KG')!, mantissa = /^[^Ee]+/.exec(massText)![0], exponent = Number(/[Ee]([+-]?\d+)/.exec(massText)?.[1] ?? 0);
        const gmDigits = String(body.gm).replace(/^[^.]*\.?/, '').length;
        const tolerance = best.error! + halfUnit(mantissa) * 10 ** exponent + (recordMass ?? 0) * (0.5 * 10 ** -gmDigits) / (body.gm ?? 1);
        const differs = recordMass !== undefined && Math.abs(recordMass - best.mass!) > tolerance;
        // Not shown; noted only when the record's GM disagrees with it.
        if (differs) notes.push({ kind: 'mass', status: 'conflict', evidence: [masses.url],
          text: `Baer et al. mass ${massFact.value} (record ${best.row.recordNumber}, ${reference}) is not shown: the astronomy record already carries GM ${body.gm} km³/s² (about ${recordMass!.toPrecision(3)} kg with CODATA 2018 G), outside the catalogue uncertainty.` });
        massDensity = undefined;
      } else facts.push(massFact);
    } else if (!has(body, 'mass') && body.gm === undefined && !paperPhysical) notes.push({ kind: 'mass', status: 'rejected', evidence: [masses.url], text: `All ${massRows.length} Baer et al. mass rows are excluded by the rule (flagged, secondary, or under three times their uncertainty).` });
    if (best && rejected) extracts.masses.rule += ` ${rejected} of ${massRows.length} rows were excluded by that rule.`;
  }
  const density = tnoDensity ?? massDensity;
  if (density && !has(body, 'density')) {
    if (!paperPhysical) facts.push(density);
  }

  // Companions.
  const systems = table('binary.systems'), allSystemRows = rowsFor(body, systems, 'AST_NUMBER', ['AST_NAME'], 'PROV_DESIG', mismatches);
  // A named companion is shown when an app satellite of this body goes by its name ("I Linus" → Linus, "S/2004 (45) 1"
  // as written). An unnamed row is shown when an app satellite of this body is left over after the named ones match.
  const satellites = OMIT_SHOWN_COMPANIONS ? [...(SHOWN_SATELLITES.get(body.id) ?? [])] : [];
  const companionName = (row: Row) => value(systems, row, 'COMPANION_DESIGNATION')?.replace(/^[IVXLC]+\s+(?=\S)/, '');
  const shownRows = new Set<Row>();
  for (const row of allSystemRows) {
    const name = companionName(row);
    if (name === undefined) continue;
    const match = satellites.findIndex(satellite => satellite.names.some(candidate => normalize(candidate) === normalize(name)));
    if (match >= 0) { shownRows.add(row); satellites.splice(match, 1); }
  }
  for (const row of allSystemRows) if (companionName(row) === undefined && satellites.length) { shownRows.add(row); satellites.shift(); }
  for (const row of allSystemRows) companionLog.push({ objectId: body.id, companion: value(systems, row, 'COMPANION_DESIGNATION') ?? 'unnamed', kept: !shownRows.has(row) });
  const systemRows = allSystemRows.filter(row => !shownRows.has(row));
  if (systemRows.length) {
    const sources = table('binary.sources'), referencesUsed: Record<string, string> = {};
    const sourceRows = systemRows.map(row => sources.rows.find(candidate => candidate.fields.AST_NUMBER === row.fields.AST_NUMBER && candidate.fields.COMPANION_DESIGNATION === row.fields.COMPANION_DESIGNATION && candidate.fields.PROV_DESIG === row.fields.PROV_DESIG));
    extracts.binary = { ...extractOf('binary', systems, systemRows), references: referencesUsed,
      rule: 'Every companion row for this primary that the app does not show as a body of its own: semimajor axis (or separation, code S) and orbital period with their stated uncertainties and codes (E estimated, D derived, G greater than, L less than, H half period possible, Q questionable).' };
    (extracts as Record<string, Extract>)['binary-sources'] = { ...extractOf('binary', sources, sourceRows.filter((row): row is Row => row !== undefined)), rule: 'Discovery and per-value reference codes for the companion rows above, in the same order.' };
    const qualifier = (code: string | undefined) => code === 'E' ? ' (estimated)' : code === 'H' ? ' (half period possible)' : code === 'Q' ? ' (questionable)' : '';
    const bound = (code: string | undefined) => code === 'G' ? 'more than ' : code === 'L' ? 'less than ' : '';
    systemRows.forEach((row, index) => {
      if (has(body, `companion-${index + 1}`)) return;
      const designation = value(systems, row, 'COMPANION_DESIGNATION');
      const axis = value(systems, row, 'BINARY_SEMIMAJOR_AXIS'), axisError = value(systems, row, 'BINARY_SEMIMAJOR_AXIS_UNCERT'), axisCode = value(systems, row, 'BINARY_SEMIMAJOR_AXIS_CODE');
      const period = value(systems, row, 'BINARY_ORBITAL_PERIOD'), periodError = value(systems, row, 'BINARY_ORBITAL_PERIOD_UNCERT'), periodCode = value(systems, row, 'BINARY_ORBITAL_PERIOD_CODE');
      const parts = [
        axis && Number(axis) > 0 ? `${axisCode === 'S' ? 'separation' : 'semimajor axis'} ${bound(axisCode)}${interval(scientific(axis), axisError && Number(axisError) > 0 ? scientific(axisError) : undefined)} km${qualifier(axisCode)}` : undefined,
        period && Number(period) > 0 ? `period ${bound(periodCode)}${interval(scientific(period), periodError && Number(periodError) > 0 ? scientific(periodError) : undefined)} days${qualifier(periodCode)}` : undefined,
      ].filter((part): part is string => part !== undefined);
      if (!parts.length) return;
      const references = sourceRows[index] ? [value(sources, sourceRows[index]!, 'REF_CODE_BINARY_SEMIMAJOR'), value(sources, sourceRows[index]!, 'REF_CODE_BINARY_PERIOD')].filter((code): code is string => code !== undefined) : [];
      for (const code of references) referencesUsed[code] = binaryReferences.get(code) ?? '';
      const cited = [...new Set(references.map(code => shortReference(binaryReferences.get(code), code)))].join('; ');
      facts.push(factFromTable(`companion-${index + 1}`, 'Companion', `${designation ?? 'Unnamed in the catalogue'}: ${parts.join(', ')}`, 'binary', systems,
        `${catalogue('binary').citation}${cited ? `, values from ${cited}` : ''}`,
        pointer('binary', index, 'COMPANION_DESIGNATION', 'BINARY_SEMIMAJOR_AXIS', 'BINARY_SEMIMAJOR_AXIS_UNCERT', 'BINARY_SEMIMAJOR_AXIS_CODE', 'BINARY_ORBITAL_PERIOD', 'BINARY_ORBITAL_PERIOD_UNCERT', 'BINARY_ORBITAL_PERIOD_CODE')));
    });
  }
  const shownFacts = facts.filter(entry => !OMIT_KINDS.has(kindOf(entry.id)));
  // The reference file keeps only the extracts a remaining fact cites (the companion sources follow their rows).
  const cited = new Set(shownFacts.flatMap(entry => (entry.source?.locator ?? '').split('; ').map(path => path.split('/')[1] ?? '')));
  if (cited.has('binary')) cited.add('binary-sources');
  for (const key of Object.keys(extracts)) if (!cited.has(key)) delete extracts[key];
  return { body, facts: shownFacts, extracts, notes };
}

// ---------------------------------------------------------------- writing

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;
const changes: string[] = [];
async function put(path: string, text: string | undefined) {
  const current = await readFile(path, 'utf8').catch((error: NodeJS.ErrnoException) => { if (error.code === 'ENOENT') return undefined; throw error; });
  if (current === text) return;
  changes.push(path.slice(ROOT.length + 1));
  if (check) return;
  if (text === undefined) await unlink(path);
  else { await mkdir(dirname(path), { recursive: true }); await writeFile(path, text); }
}

const bodies = await readBodies(), mismatches: string[] = [];
const outcomes = bodies.map(body => selectBody(body, mismatches));
const counts: Record<string, number> = {}, conflicts: { objectId: string; kind: string; text: string }[] = [], rejections: { objectId: string; kind: string; text: string }[] = [];
let touched = 0;
for (const { body, facts, extracts, notes } of outcomes) {
  const objectDirectory = resolve(ROOT, 'src/objects', body.id);
  const panel = requireRecord(body.content.panel);
  // A fact this tool wrote before keeps its place (other authors may have added facts after it); new ones go last.
  const byId = new Map(facts.map(entry => [entry.id, entry])), placed = new Set<string>();
  const refresh = (list: unknown) => requireArray(list ?? []).flatMap(raw => {
    const existing = parseFact(raw);
    if (existing.source?.path !== EVIDENCE_PATH) return [raw];
    const next = byId.get(existing.id);
    if (!next) return [];
    placed.add(next.id);
    return [next];
  });
  panel.facts = refresh(panel.facts);
  panel.moreFacts = [...refresh(panel.moreFacts), ...facts.filter(entry => !placed.has(entry.id))];
  await put(body.contentPath, json(body.content));
  const evidence = facts.length ? json({ schema: 'cssearth-sbn-catalogue-rows@1', objectId: body.id, generator: TOOL, checked: CHECKED,
    match: { ...(body.number !== undefined ? { number: body.number } : { designation: body.designation }), by: body.matchedBy }, ...extracts }) : undefined;
  await put(resolve(objectDirectory, EVIDENCE_PATH), evidence);
  const manifestPath = resolve(objectDirectory, 'source/manifest.json'), manifestText = await readFile(manifestPath, 'utf8');
  const used = [...new Set(facts.map(entry => entry.source!.catalogueId!))].sort();
  const entry = facts.length ? { path: EVIDENCE, purpose: 'Rows of the PDS Small Bodies Node catalogues that the factsheet cites, as their PDS4 labels read them, with each selection rule.',
    sourceBinding: { kind: 'catalogued', references: used.map(catalogueId => ({ catalogueId, role: 'reference', evidence: `${TOOL} extract; product LIDVIDs recorded in the file.` })) } } : undefined;
  const nextManifest = spliceDocument(manifestText, EVIDENCE, entry);
  assert.deepEqual(JSON.parse(nextManifest).documents.filter((document: { path: string }) => document.path !== EVIDENCE),
    JSON.parse(manifestText).documents.filter((document: { path: string }) => document.path !== EVIDENCE), `${body.id}: manifest splice changed other documents`);
  await put(manifestPath, nextManifest);
  // Ledger: one entry when a catalogue value is not shown.
  const ledgerPath = resolve(objectDirectory, 'investigations.json'), ledger = await optionalJson(ledgerPath);
  if (ledger || notes.length) {
    const base = ledger ?? { schema: INVESTIGATION_LEDGER_SCHEMA, objectId: body.id, entries: [] };
    const entries = requireArray(base.entries).filter(raw => requireRecord(raw).id !== LEDGER_ID);
    if (notes.length) entries.push({ id: LEDGER_ID, subject: 'PDS SBN catalogue values that disagree with the factsheet or are not shown', status: notes.some(note => note.status === 'conflict') ? 'unresolved' : 'excluded',
      finding: notes.map(note => note.text).join(' '), revisitWhen: 'A newer release of the named catalogue, or a review that replaces the shown value.',
      evidence: [...new Set([...notes.flatMap(note => note.evidence), TOOL])] });
    await put(ledgerPath, ledger || entries.length ? json({ ...base, entries }) : undefined);
  }
  if (facts.length) touched++;
  for (const added of facts) { const kind = kindOf(added.id); counts[kind] = (counts[kind] ?? 0) + 1; }
  for (const note of notes) (note.status === 'conflict' ? conflicts : rejections).push({ objectId: body.id, kind: note.kind, text: note.text });
}
const unmatched = bodies.filter(body => body.number === undefined && body.designation === undefined).map(body => body.id);
const report = { tool: TOOL, checked: CHECKED, bodies: bodies.length, bodiesTouched: touched, factsAdded: counts,
  catalogueRows: Object.fromEntries(['lcdb', 'occultations', 'tno', 'neowise', 'masses', 'binary'].map(key => [key, outcomes.filter(outcome => outcome.extracts[key]).length])),
  rules: { omitKinds: [...OMIT_KINDS], omitCompanionsShownAsBodies: OMIT_SHOWN_COMPANIONS },
  companionsKept: companionLog.filter(entry => entry.kept), companionsOmitted: companionLog.filter(entry => !entry.kept),
  bodyIds: outcomes.filter(outcome => outcome.facts.length).map(outcome => outcome.body.id),
  conflicts, rejections, nameMismatches: mismatches, unmatched, changedFiles: changes.length };
if (!check) { await mkdir(dirname(resolve(ROOT, reportPath)), { recursive: true }); await writeFile(resolve(ROOT, reportPath), json(report)); }
console.log(JSON.stringify({ check, bodies: bodies.length, bodiesTouched: touched, factsAdded: counts, conflicts: conflicts.length, rejections: rejections.length, nameMismatches: mismatches.length, changedFiles: changes.length }));
if (check && changes.length) { console.error(`Stale: ${changes.slice(0, 20).join(', ')}${changes.length > 20 ? ' …' : ''}`); process.exitCode = 1; }
