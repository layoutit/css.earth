#!/usr/bin/env node
/** What the JunoCam archive holds, and which of this project's objects it photographed, derived rather than declared.
 *
 *   node tools/objects/juno/archive-ledger.mts        writes data/juno/ledger.json and docs/junocam-ledger.md
 *
 * Every count comes from the index tables of the PDS JunoCam volumes. An object's state comes from what exists here: a
 * program with a receipt within its budget makes its images "measured", and a package lens of the `junocam-camera` format
 * makes them "cast". The pixel scale is the label altitude times the camera's pixel angle, which the instrument kernel in
 * the kernel bank states; it is the scale straight below the spacecraft, not across the whole image. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseTextKernel, number as kernelNumber } from '../../spice/text-kernel.mts';
import { kernelBankRoot } from '../../spice/kernel-bank.mts';
import { FILTER_COMBINATIONS, KERNEL_SET, PROGRAMS, VOLUMES, fetchText, indexNumber, parseIndex, parseProductId, parseProgram, type IndexRow } from './archive.mts';
import { POLICY, RECEIPT_SCHEMA } from './measure.mts';

const repository = resolve(import.meta.dirname, '../../..');
export const LEDGER = resolve(repository, 'data/juno/ledger.json');
export const GUIDE = resolve(repository, 'docs/junocam-ledger.md');
export const SCHEMA = 'cssearth-junocam-ledger@1';
const COLOUR = ['RED', 'GREEN', 'BLUE'];

export interface TargetHoldings { target: string; images: number; colourImages: number; orbits: number[]; lowestAltitudeKm: number | null; finestNadirPixelKm: number | null; objectId: string | null }
export interface ObjectState { id: string; target: string; colourImages: number; measuredImages: number; programs: string[]; castBy: string[]; state: 'cast' | 'measured' | 'not measured'; why: string }
export interface Ledger { schema: typeof SCHEMA; measured: string; volumes: string[]; pixelAngleMicroradians: number; calibratedImages: number; byFilterCombination: Record<string, number>; targets: TargetHoldings[]; objects: ObjectState[] }

/** The shipped object a JunoCam target name refers to: the same name as an object id, or nothing. */
export const matchShippedObject = (target: string, shipped: ReadonlySet<string>) => { const id = target.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-'); return shipped.has(id) ? id : null; };

export async function shippedObjects() {
  return new Set((await readdir(resolve(repository, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name));
}

/** The camera's pixel angle from the instrument kernel in the bank: pixel pitch over focal length. */
export async function pixelAngleMicroradians() {
  const pool = parseTextKernel(await readFile(resolve(kernelBankRoot(KERNEL_SET), 'ik/juno_junocam_v03.ti'), 'latin1'), 'juno_junocam_v03.ti');
  return 1e6 * kernelNumber(pool, 'INS-61500_PIXEL_SIZE') / kernelNumber(pool, 'INS-61500_FOCAL_LENGTH');
}

/** Calibrated images by target. Global map products are not images and are left out. */
export function holdings(rows: readonly IndexRow[], shipped: ReadonlySet<string>, pixelAngle: number): { targets: TargetHoldings[]; byFilterCombination: Record<string, number>; calibratedImages: number } {
  const targets = new Map<string, TargetHoldings>(), byFilterCombination: Record<string, number> = {};
  let calibratedImages = 0;
  for (const row of rows) {
    if (row.STANDARD_DATA_PRODUCT_ID !== 'JUNOCAM-RDR') continue;
    const product = parseProductId(row.PRODUCT_ID), strips = FILTER_COMBINATIONS[product.filterCombination];
    if (!strips) continue;
    calibratedImages++; byFilterCombination[product.filterCombination] = (byFilterCombination[product.filterCombination] ?? 0) + 1;
    const name = row.TARGET_NAME.toUpperCase(), altitude = indexNumber(row.SPACECRAFT_ALTITUDE);
    const entry = targets.get(name) ?? { target: name, images: 0, colourImages: 0, orbits: [], lowestAltitudeKm: null, finestNadirPixelKm: null, objectId: matchShippedObject(name, shipped) };
    entry.images++; if (COLOUR.every(strip => strips.includes(strip))) entry.colourImages++;
    if (!entry.orbits.includes(product.orbit)) entry.orbits.push(product.orbit);
    if (altitude !== null && altitude > 0 && (entry.lowestAltitudeKm === null || altitude < entry.lowestAltitudeKm)) { entry.lowestAltitudeKm = altitude; entry.finestNadirPixelKm = Math.round(altitude * pixelAngle) / 1e6; }
    targets.set(name, entry);
  }
  for (const entry of targets.values()) entry.orbits.sort((a, b) => a - b);
  return { targets: [...targets.values()].sort((a, b) => b.images - a.images || a.target.localeCompare(b.target)), byFilterCombination, calibratedImages };
}

/** Programs with their receipts: which images of which target were measured within the budget. */
export async function measuredPrograms() {
  const files = await readdir(PROGRAMS).catch(() => [] as string[]), measured: { program: string; target: string; images: number }[] = [];
  for (const file of files.filter(name => name.endsWith('.json') && !name.endsWith('.registration.json'))) {
    const program = parseProgram(JSON.parse(await readFile(resolve(PROGRAMS, file), 'utf8')));
    const receipt = await readFile(resolve(PROGRAMS, `${program.id}.registration.json`), 'utf8').then(text => JSON.parse(text) as { schema: string; images: { productId: string; holdoutResidualPixels: { after: number } }[] }, () => null);
    if (!receipt || receipt.schema !== RECEIPT_SCHEMA) continue;
    const within = receipt.images.filter(image => program.images.some(pinned => pinned.productId === image.productId) && image.holdoutResidualPixels.after <= POLICY.maximumResidualPixels);
    measured.push({ program: program.id, target: program.target.name.toUpperCase(), images: within.length });
  }
  return measured;
}

/** Packages that state a lens of the JunoCam format. */
export async function castingObjects(shipped: ReadonlySet<string>) {
  const casting: string[] = [];
  for (const id of shipped) {
    const directory = resolve(repository, 'src/objects', id, 'source/preparation'), files = await readdir(directory).catch(() => [] as string[]);
    for (const file of files.filter(name => name.endsWith('.json'))) if ((await readFile(resolve(directory, file), 'utf8')).includes('"junocam-camera"')) { casting.push(id); break; }
  }
  return casting;
}

export function objectStates(targets: readonly TargetHoldings[], measured: Awaited<ReturnType<typeof measuredPrograms>>, casting: readonly string[]): ObjectState[] {
  return targets.filter(entry => entry.objectId !== null).map(entry => {
    const programs = measured.filter(program => program.target === entry.target), measuredImages = programs.reduce((sum, program) => sum + program.images, 0), castBy = casting.filter(id => id === entry.objectId);
    const state = castBy.length ? 'cast' : measuredImages ? 'measured' : 'not measured';
    const why = castBy.length ? `The ${castBy.join(', ')} package states a junocam-camera lens.`
      : measuredImages ? `${measuredImages} image(s) registered within ${POLICY.maximumResidualPixels} px in ${programs.map(program => program.program).join(', ')}; no package lens yet.`
      : entry.colourImages ? 'No program of this target is pinned.' : 'No calibrated image holds the red, green and blue strips the format reads.';
    return { id: entry.objectId!, target: entry.target, colourImages: entry.colourImages, measuredImages, programs: programs.map(program => program.program), castBy, state, why };
  });
}

export async function volumes(fetcher: typeof fetch = fetch) {
  return [...new Set([...(await fetchText(VOLUMES, fetcher)).matchAll(/JNOJNC_\d{4}(?=\/)/gu)].map(match => match[0]))].sort();
}

export async function buildLedger(today = new Date().toISOString().slice(0, 10), fetcher: typeof fetch = fetch): Promise<Ledger> {
  const names = await volumes(fetcher), rows: IndexRow[] = [];
  for (const name of names) rows.push(...parseIndex(await fetchText(`${VOLUMES}${name}/INDEX/INDEX.TAB`, fetcher)));
  const shipped = await shippedObjects(), pixelAngle = await pixelAngleMicroradians(), counted = holdings(rows, shipped, pixelAngle);
  return { schema: SCHEMA, measured: today, volumes: names, pixelAngleMicroradians: Math.round(pixelAngle * 10) / 10, ...counted, objects: objectStates(counted.targets, await measuredPrograms(), await castingObjects(shipped)) };
}

const count = (n: number) => n.toLocaleString('en-US');
export function ledgerGuide(ledger: Ledger) {
  const combinations = Object.entries(ledger.byFilterCombination).sort((a, b) => b[1] - a[1]).map(([letter, n]) => `${letter} (${FILTER_COMBINATIONS[letter]!.join(', ').toLowerCase()}) ${count(n)}`).join('; ');
  const lines = ['# JunoCam archive ledger', '',
    'Generated by `node tools/objects/juno/archive-ledger.mts` from [data/juno/ledger.json](../data/juno/ledger.json). Do not edit it by hand: every count is read from the',
    'index tables of the PDS JunoCam volumes, and every state from the pinned programs, their receipts and the packages. See [JunoCam](junocam.md) for what the toolkit does.', '',
    `Counted on ${ledger.measured}, over volumes ${ledger.volumes[0]} to ${ledger.volumes.at(-1)}: ${count(ledger.calibratedImages)} calibrated images. By filter combination: ${combinations}.`, '',
    '## Shipped objects JunoCam photographed', '',
    `${ledger.objects.length} of this project's objects are a JunoCam target. A colour image holds the red, green and blue strips, which is what the \`junocam-camera\` format reads.`,
    `The finest pixel is the lowest label altitude times the camera's ${ledger.pixelAngleMicroradians} microradian pixel angle: the scale straight below the spacecraft.`, '',
    '| object | calibrated images | colour | orbits | lowest altitude | finest pixel | state | why |', '| --- | ---: | ---: | --- | ---: | ---: | --- | --- |'];
  for (const object of ledger.objects) {
    const held = ledger.targets.find(entry => entry.target === object.target)!, orbits = held.orbits.length > 6 ? `${held.orbits.length} orbits, ${held.orbits[0]} to ${held.orbits.at(-1)}` : held.orbits.join(', ');
    lines.push(`| ${object.id} | ${count(held.images)} | ${count(held.colourImages)} | ${orbits} | ${held.lowestAltitudeKm === null ? 'not stated' : `${count(Math.round(held.lowestAltitudeKm))} km`} | ${held.finestNadirPixelKm === null ? 'not stated' : `${held.finestNadirPixelKm.toFixed(2)} km`} | ${object.state} | ${object.why} |`);
  }
  const others = ledger.targets.filter(entry => entry.objectId === null);
  lines.push('', '## Other targets', '', others.length ? `Targets that are not an object here: ${others.map(entry => `${entry.target} (${count(entry.images)})`).join(', ')}.` : 'Every target is an object here.', '');
  return lines.join('\n');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const ledger = await buildLedger();
  await mkdir(resolve(LEDGER, '..'), { recursive: true });
  await writeFile(LEDGER, JSON.stringify(ledger, null, 2) + '\n'); await writeFile(GUIDE, ledgerGuide(ledger));
  console.log(JSON.stringify({ volumes: ledger.volumes.length, calibratedImages: ledger.calibratedImages, objects: ledger.objects.map(object => `${object.id}: ${object.state}`) }));
}
