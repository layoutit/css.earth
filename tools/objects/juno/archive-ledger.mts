#!/usr/bin/env node
/** What the JunoCam archive holds, and which of this project's objects it photographed, derived rather than declared.
 *
 *   node tools/objects/juno/archive-ledger.mts            writes data/juno/ledger.json and docs/junocam-ledger.md
 *   node tools/objects/juno/archive-ledger.mts --local    rewrites only the part the pinned programs, receipts and packages own
 *
 * Every count comes from the index tables of the PDS JunoCam volumes. An object's state comes from what exists here: a
 * program with a receipt within its budget makes its images "measured", and a package lens of the `junocam-camera` format
 * makes them "cast". An image counts as measured only when the receipt parses, states the registration schema, names that
 * program, that target, that budget and that image as the program pins it, and pins the kernels it registered against; a
 * receipt that says anything else is reported as a problem and proves nothing. The pixel scale is the label altitude times
 * the camera's pixel angle, which the instrument kernel in the kernel bank states; it is the scale straight below the
 * spacecraft, not across the whole image. --local leaves the dated index counts alone. */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { parseTextKernel, number as kernelNumber } from '../../spice/text-kernel.mts';
import { bankKernelPath } from '../../spice/kernel-bank.mts';
import { FILTER_COMBINATIONS, KERNEL_SET, PROGRAMS, VOLUMES, fetchText, indexNumber, parseIndex, parseProductId, parseProgram, type IndexRow } from './archive.mts';
import { POLICY, RECEIPT_SCHEMA } from './measure.mts';

const repository = resolve(import.meta.dirname, '../../..');
export const LEDGER = resolve(repository, 'data/juno/ledger.json');
export const GUIDE = resolve(repository, 'docs/junocam-ledger.md');
export const SCHEMA = 'cssearth-junocam-ledger@1';
const COLOUR = ['RED', 'GREEN', 'BLUE'];

export interface TargetHoldings { target: string; images: number; colourImages: number; orbits: number[]; lowestAltitudeKm: number | null; finestNadirPixelKm: number | null; objectId: string | null }
export interface ObjectState { id: string; target: string; colourImages: number; measuredImages: number; programs: string[]; castBy: string[]; state: 'cast' | 'measured' | 'not measured'; why: string }
export interface Ledger { schema: typeof SCHEMA; measured: string; volumes: string[]; pixelAngleMicroradians: number; calibratedImages: number; byFilterCombination: Record<string, number>; targets: TargetHoldings[]; objects: ObjectState[];
  /** Receipts that could not be accepted, and so proved nothing. An empty list is the only passing state. */
  receiptProblems: string[] }

/** The shipped object a JunoCam target name refers to: the same name as an object id, or nothing. */
export const matchShippedObject = (target: string, shipped: ReadonlySet<string>) => { const id = target.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-'); return shipped.has(id) ? id : null; };

export async function shippedObjects() {
  return new Set((await readdir(resolve(repository, 'src/objects'), { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name));
}

/** The camera's pixel angle from the instrument kernel in the bank: pixel pitch over focal length. */
export async function pixelAngleMicroradians() {
  const pool = parseTextKernel(await readFile(await bankKernelPath(KERNEL_SET, 'ik/juno_junocam_v03.ti'), 'latin1'), 'juno_junocam_v03.ti');
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

/** What went wrong with one receipt, always said of the file it was in: a JSON parser names a position, not a file. */
const receiptProblem = (file: string, error: unknown) => { const said = error instanceof Error ? error.message : String(error); return said.startsWith(`${file}:`) ? said : `${file}: ${said}`; };


/** One receipt read against the program it claims: another schema, another target, another budget, a kernel or an image the
 * program does not pin, or a missing residual is an error, never a silent skip. What comes back is the holdout residual of
 * every image it registered, which is what decides whether that image was measured. */
export function checkRegistration(value: unknown, file: string, program: ReturnType<typeof parseProgram>): { productId: string; residualPixels: number }[] {
  const row = requireRecord(value, file);
  if (row.schema !== RECEIPT_SCHEMA) throw new TypeError(`${file}: ${String(row.schema)} is not a registration receipt.`);
  if (requireString(row.program, `${file}: program`) !== program.id) throw new TypeError(`${file}: it is the receipt of ${String(row.program)}.`);
  const target = requireRecord(row.target, `${file}: target`);
  if (requireString(target.name, `${file}: target name`) !== program.target.name || requireFiniteNumber(target.naifId, `${file}: target NAIF id`) !== program.target.naifId
    || requireString(target.bodyFrame, `${file}: target frame`) !== program.target.bodyFrame) throw new TypeError(`${file}: it registered ${String(target.name)}, not ${program.target.name}.`);
  // The budget the receipt was measured against is part of what it proves: a laxer one would make a worse fit pass.
  const policy = requireRecord(row.policy, `${file}: policy`);
  for (const [key, value] of Object.entries(POLICY)) if (policy[key] !== value) throw new TypeError(`${file}: it was measured with ${key} ${String(policy[key])}, not ${String(value)}.`);
  const kernels = requireArray(row.kernels, `${file}: kernels`).map(entry => { const kernel = requireRecord(entry, `${file}: kernel`);
    requireFiniteNumber(kernel.bytes, `${file}: kernel bytes`);
    return requireString(kernel.path, `${file}: kernel path`); });
  if (kernels.join('\n') !== program.kernels.join('\n')) throw new TypeError(`${file}: it loaded kernels ${program.id} does not pin.`);
  return requireArray(row.images, `${file}: images`).map(entry => {
    const image = requireRecord(entry, `${file}: image`), productId = requireString(image.productId, `${file}: product id`);
    const pinned = program.images.find(held => held.productId === productId);
    if (!pinned) throw new TypeError(`${file}: it registered ${productId}, which ${program.id} does not pin.`);
    if (requireString(image.startTime, `${file}: ${productId} start time`) !== pinned.startTime
      || requireFiniteNumber(image.altitudeKmInLabel, `${file}: ${productId} altitude`) !== pinned.altitudeKm) throw new TypeError(`${file}: it registered another ${productId}.`);
    const residual = requireRecord(image.holdoutResidualPixels, `${file}: ${productId} holdout residual`);
    return { productId, residualPixels: requireFiniteNumber(residual.after, `${file}: ${productId} residual after`) };
  });
}

/** Programs with their receipts (which images of which target were measured within the budget), and every receipt that could
 * not be accepted. A program with no receipt measures nothing; a program whose receipt cannot be accepted is a problem. */
export async function junoReceipts(directory = PROGRAMS) {
  const files = (await readdir(directory).catch(() => [] as string[])).sort();
  const measured: { program: string; target: string; images: number }[] = [], problems: string[] = [];
  for (const file of files.filter(name => name.endsWith('.json') && !name.endsWith('.registration.json'))) {
    const program = parseProgram(JSON.parse(await readFile(resolve(directory, file), 'utf8')));
    const receipt = `${program.id}.registration.json`;
    if (!files.includes(receipt)) continue;
    try {
      const images = checkRegistration(JSON.parse(await readFile(resolve(directory, receipt), 'utf8')) as unknown, receipt, program);
      measured.push({ program: program.id, target: program.target.name.toUpperCase(), images: images.filter(image => image.residualPixels <= POLICY.maximumResidualPixels).length });
    } catch (error) { problems.push(receiptProblem(receipt, error)); }
  }
  return { measured, problems: problems.sort((a, b) => a.localeCompare(b, 'en')) };
}

/** The measured programs alone, for everything that asks what was registered rather than what went wrong. */
export async function measuredPrograms(directory = PROGRAMS) {
  return (await junoReceipts(directory)).measured;
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
  const receipts = await junoReceipts();
  return { schema: SCHEMA, measured: today, volumes: names, pixelAngleMicroradians: Math.round(pixelAngle * 10) / 10, ...counted,
    objects: objectStates(counted.targets, receipts.measured, await castingObjects(shipped)), receiptProblems: receipts.problems };
}

/** The ledger on disk, read back as the external value it is, so --local rewrites a file it has checked. */
export function parseLedger(value: unknown): Ledger {
  const row = requireRecord(value, 'JunoCam ledger');
  if (row.schema !== SCHEMA) throw new TypeError('Unsupported JunoCam ledger.');
  const names = (list: unknown, label: string) => requireArray(list, label).map(name => requireString(name, label));
  const orNull = (value: unknown, label: string) => value === null ? null : requireFiniteNumber(value, label);
  // The keys are rebuilt in the order buildLedger writes them, so a --local pass and a full pass give the same file.
  return { schema: SCHEMA, measured: requireString(row.measured, 'Measured date'), volumes: names(row.volumes, 'Volumes'),
    pixelAngleMicroradians: requireFiniteNumber(row.pixelAngleMicroradians, 'Pixel angle'),
    targets: requireArray(row.targets, 'Targets').map(raw => { const entry = requireRecord(raw, 'Target');
      return { target: requireString(entry.target, 'Target name'), images: requireFiniteNumber(entry.images, 'Images'), colourImages: requireFiniteNumber(entry.colourImages, 'Colour images'),
        orbits: requireArray(entry.orbits, 'Orbits').map(orbit => requireFiniteNumber(orbit, 'Orbit')), lowestAltitudeKm: orNull(entry.lowestAltitudeKm, 'Lowest altitude'),
        finestNadirPixelKm: orNull(entry.finestNadirPixelKm, 'Finest pixel'), objectId: entry.objectId === null ? null : requireString(entry.objectId, 'Object id') }; }),
    byFilterCombination: Object.fromEntries(Object.entries(requireRecord(row.byFilterCombination, 'Images by filter combination')).map(([key, n]) => [key, requireFiniteNumber(n, 'Images')])),
    calibratedImages: requireFiniteNumber(row.calibratedImages, 'Calibrated images'),
    // The objects and the problems are what --local rewrites, so what is on disk for them is never read back.
    objects: [], receiptProblems: [] };
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
  lines.push('## Receipts', '',
    `An image counts as measured only when the receipt beside its program parses, states the \`${RECEIPT_SCHEMA}\` schema, and names that program, that target, the budget above and that image as the program pins it, with the kernels it registered against. A receipt that says anything else is reported here and proves nothing.`, '',
    ledger.receiptProblems.length
      ? `${ledger.receiptProblems.length} receipt${ledger.receiptProblems.length === 1 ? '' : 's'} could not be accepted:\n\n${ledger.receiptProblems.map(problem => `- ${problem}`).join('\n')}`
      : 'None: every receipt beside a pinned program was accepted.', '');
  return lines.join('\n');
}

/** Every receipt problem, said once and counted against the run: a ledger that reports one has not proved what it lists. */
const reportProblems = (problems: readonly string[]) => {
  for (const problem of problems) console.error(`RECEIPT ${problem}`);
  if (problems.length) process.exitCode = 1;
};

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const local = process.argv.includes('--local');
  let ledger: Ledger;
  if (local) {
    const held = parseLedger(JSON.parse(await readFile(LEDGER, 'utf8')) as unknown), receipts = await junoReceipts();
    ledger = { ...held, objects: objectStates(held.targets, receipts.measured, await castingObjects(await shippedObjects())), receiptProblems: receipts.problems };
  } else ledger = await buildLedger();
  await mkdir(resolve(LEDGER, '..'), { recursive: true });
  await writeFile(LEDGER, JSON.stringify(ledger, null, 2) + '\n'); await writeFile(GUIDE, ledgerGuide(ledger));
  console.log(JSON.stringify({ volumes: ledger.volumes.length, calibratedImages: ledger.calibratedImages, objects: ledger.objects.map(object => `${object.id}: ${object.state}`) }));
  reportProblems(ledger.receiptProblems);
}
