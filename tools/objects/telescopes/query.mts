/** Which observations in the archives might measure a quantity on a target, and what stays unknown until one is read.
 *
 * The ledgers hold what each archive has per object and per mode: how many observations, which programmes, which programs are
 * pinned here and which have a checked receipt. They hold nothing about a single exposure. So this query never says an
 * observation is adequate. For a request (a target, a wavelength range, and optionally a time range, a sharpness, a surface
 * resolution and a product kind) it returns one candidate per telescope mode the ledgers say observed that target, and each
 * candidate answers three separate questions that are easy to confuse:
 *
 * - **`meetsConstraints`**: what the mode's own capabilities allow, one answer per constraint with its reason. Wavelength
 *   comes from the mode's recorded coverage. Sharpness is the best the mode can do at the requested wavelength (1.22 lambda/D,
 *   floored at two pixels where a pixel scale is recorded) and is always stated as "cannot be sharper than", so it can say no
 *   or possible and never yes: no ledger knows what a given exposure achieved. Time is unknown unless the ledger carries dates
 *   for that object and mode. Kilometres on the ground and elements across the disc need the range to the body, which the
 *   caller gives; without it the answer is unknown.
 * - **`toolkitSupport`**: whether this repository can reduce that mode at all, and whether a program for *this* target is
 *   pinned or has a checked receipt.
 * - **`evidence`**: what supports the answers (the ledger and its archive date, receipts, body maps beside the object whose
 *   observations carry a measured resolution, investigation entries about the telescope or mode), and `unknown`: what nobody
 *   here knows until an observation is pinned and read.
 *
 * Mode capabilities are the one authored input, in `modes.json`, each with the citation it was read from. A mode with no entry
 * is reported as "capabilities not recorded" rather than guessed. */
import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { flagValue } from '../../cli-arguments.mts';
import { hasErrorCode, readJsonSource, requireArray, requireFiniteNumber, requireRecord, requireString } from '../../source-values.mts';
import { parseBodyMapProduct, resolutionElementsAcrossDisc, surfaceResolutionKm, type BodyMapObservation } from '../body-map-product.mts';
import { JWST_CUBE_COVERAGE } from '../jwst/imaging/bands.mts';

const ARCSEC_PER_RADIAN = 206_264.806_247;
export const MODES_SCHEMA = 'cssearth-telescope-modes@1';
export const PRODUCT_KINDS = ['image', 'cube', 'spectrum', 'events', 'strips'] as const;
export type ProductKind = typeof PRODUCT_KINDS[number];

/** What an instrument mode can do, from its own documentation. `bands` means the coverage is the one `bands.mts` already
 * states for that mode's bands, so it is not retyped here. */
export interface ModeCapability {
  readonly telescope: string; readonly mode: string;
  readonly wavelengthMicrometres: readonly [number, number];
  /** Left out where the documentation states no aperture, as for a spacecraft camera given only by its T number. */
  readonly apertureMetres?: number;
  readonly pixelScaleArcsec?: number;
  readonly kinds: readonly ProductKind[];
  readonly citation: string;
  readonly note?: string;
}

export type ConstraintAnswer = 'yes' | 'no' | 'partial' | 'unknown';
export interface ConstraintVerdict { readonly answer: ConstraintAnswer; readonly reason: string }
export type ToolkitLevel = 'none' | 'tool-without-checked-program' | 'proven';

export interface ToolkitSupport {
  readonly level: ToolkitLevel; readonly reason: string;
  readonly tool?: string;
  readonly programs: readonly string[]; readonly checked: readonly string[];
  readonly targetProgramPinned: boolean; readonly targetProgramChecked: boolean;
}

export interface MeasuredResolution { readonly path: string; readonly quantity: string; readonly observation: string; readonly angularResolutionArcsec: number; readonly surfaceResolutionKm: number }
export interface CandidateEvidence {
  readonly ledger: string; readonly archiveDate: string;
  readonly receipts: readonly string[];
  readonly bodyMaps: readonly MeasuredResolution[];
  readonly investigations: readonly { readonly id: string; readonly status: string; readonly subject: string }[];
}

export interface Candidate {
  readonly telescope: string; readonly mode: string;
  readonly observations: { readonly count: number; readonly scope: 'this-mode' | 'object-total' } | null;
  readonly programmes: readonly string[];
  readonly meetsConstraints: Readonly<Record<string, ConstraintVerdict>>;
  readonly toolkitSupport: ToolkitSupport;
  readonly evidence: CandidateEvidence;
  readonly unknown: readonly string[];
}

export interface CapabilityRequest {
  readonly target: string;
  readonly wavelengthMicrometres: readonly [number, number];
  readonly time?: { readonly fromIso: string; readonly toIso: string };
  /** The coarsest sharpness that would still answer the question, in arcsec. */
  readonly angularResolutionArcsec?: number;
  /** The coarsest surface resolution that would still answer it, in kilometres. Needs `rangeKm`. */
  readonly surfaceResolutionKm?: number;
  /** The fewest resolution elements across the disc that would still answer it. Needs `rangeKm` and `bodyRadiusKm`. */
  readonly resolutionElements?: number;
  readonly rangeKm?: number;
  readonly bodyRadiusKm?: number;
  readonly kind?: ProductKind;
}

/** Everything the query reads, already loaded: it does no input or output of its own. */
export interface QueryInputs {
  readonly ledgers: readonly { readonly telescope: string; readonly path: string; readonly value: unknown }[];
  readonly capabilities: readonly ModeCapability[];
  readonly bodyMaps: readonly { readonly path: string; readonly value: unknown }[];
  readonly investigations?: { readonly path: string; readonly value: unknown };
}

export interface CapabilityAnswer {
  readonly target: string;
  readonly request: CapabilityRequest;
  readonly candidates: readonly Candidate[];
  /** Ledgers that hold no record of this target, so they contribute no candidate. */
  readonly withoutTheTarget: readonly { readonly telescope: string; readonly ledger: string; readonly reason: string }[];
}

/** What a ledger says about one target in one mode, in the one shape every adapter produces. */
interface TargetMode {
  readonly telescope: string; readonly mode: string;
  readonly archiveDate: string;
  readonly observations: { readonly count: number; readonly scope: 'this-mode' | 'object-total' } | null;
  readonly programmes: readonly string[];
  readonly toolkit: { readonly tool?: string; readonly routeState?: string; readonly refusedBecause?: string; readonly programs: readonly string[]; readonly checked: readonly string[]; readonly receipts: readonly string[] };
  /** Dated observations of this target in this mode, where the ledger dates any. */
  readonly dates: readonly { readonly id: string; readonly startIso: string }[];
}

const stringList = (value: unknown, label: string): string[] => requireArray(value, label).map((entry, index) => requireString(entry, `${label}[${index}]`));
const optionalString = (value: unknown, label: string): string | undefined => value === undefined || value === null ? undefined : requireString(value, label);
const forTarget = (programs: readonly string[], target: string): string[] => programs.filter(program => program === target || program.startsWith(`${target}-`));

export function parseModeCapabilities(value: unknown): ModeCapability[] {
  const record = requireRecord(value, 'mode capabilities');
  if (record.schema !== MODES_SCHEMA) throw new TypeError(`Unsupported mode capability schema ${String(record.schema)}.`);
  return requireArray(record.modes, 'modes').map((raw, index) => {
    const entry = requireRecord(raw, `mode ${index}`), mode = requireString(entry.mode, 'mode'), telescope = requireString(entry.telescope, 'telescope');
    const kinds = stringList(entry.kinds, `${mode} kinds`).map(kind => {
      if (!(PRODUCT_KINDS as readonly string[]).includes(kind)) throw new TypeError(`${mode} names an unknown product kind ${kind}.`);
      return kind as ProductKind;
    });
    const coverage = entry.wavelengthMicrometres === 'bands' ? bandCoverage(mode) : (() => {
      const range = requireArray(entry.wavelengthMicrometres, `${mode} wavelengthMicrometres`);
      if (range.length !== 2) throw new TypeError(`${mode} states its coverage as two wavelengths in micrometres.`);
      return [requireFiniteNumber(range[0], `${mode} shortest wavelength`), requireFiniteNumber(range[1], `${mode} longest wavelength`)] as const;
    })();
    if (!(coverage[0] > 0 && coverage[1] > coverage[0])) throw new RangeError(`${mode} covers ${coverage[0]} to ${coverage[1]} micrometres, which is not a range.`);
    if (!kinds.length) throw new TypeError(`${mode} names what it produces.`);
    if (entry.apertureMetres === undefined && entry.pixelScaleArcsec === undefined) throw new TypeError(`${mode} states an aperture or a pixel scale; without either there is no floor to put under a sharpness.`);
    return Object.freeze({ telescope, mode, wavelengthMicrometres: coverage,
      ...(entry.apertureMetres === undefined ? {} : { apertureMetres: requireFiniteNumber(entry.apertureMetres, `${mode} apertureMetres`) }),
      ...(entry.pixelScaleArcsec === undefined ? {} : { pixelScaleArcsec: requireFiniteNumber(entry.pixelScaleArcsec, `${mode} pixelScaleArcsec`) }),
      kinds, citation: requireString(entry.citation, `${mode} citation`), ...(entry.note === undefined ? {} : { note: requireString(entry.note, `${mode} note`) }) });
  });
}

/** The coverage `bands.mts` already states for a JWST cube mode, as the union of that mode's bands. */
function bandCoverage(mode: string): readonly [number, number] {
  const prefix = mode === 'NIRSPEC/IFU' ? 'NIRSPEC-' : mode === 'MIRI/IFU' ? 'MIRI-MRS-' : null;
  if (!prefix) throw new TypeError(`${mode} has no bands in bands.mts to take its coverage from; state it here with its citation.`);
  const ranges = Object.entries(JWST_CUBE_COVERAGE).filter(([id]) => id.startsWith(prefix)).map(([, range]) => range);
  if (!ranges.length) throw new TypeError(`bands.mts holds no ${mode} bands.`);
  return [Math.min(...ranges.map(range => range[0])), Math.max(...ranges.map(range => range[1]))];
}

/** JWST: modes carry the tool and its checked programs; each object carries how many observations it has in each mode. */
function jwstModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'JWST ledger');
  if (ledger.schema !== 'cssearth-jwst-ledger@1') throw new TypeError(`Unsupported JWST ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.archiveDate, 'archiveDate');
  const modes = new Map(requireArray(ledger.modes, 'modes').map(raw => { const entry = requireRecord(raw, 'mode'); return [requireString(entry.mode, 'mode'), entry] as const; }));
  const object = requireArray(ledger.objects, 'objects').map(raw => requireRecord(raw, 'object')).find(entry => entry.id === target);
  if (!object) return [];
  return Object.entries(requireRecord(object.observations, 'observations')).map(([mode, count]) => {
    const declared = modes.get(mode), programs = declared ? stringList(declared.programs, `${mode} programs`) : [], checked = declared ? stringList(declared.checked, `${mode} checked`) : [];
    const tool = declared ? optionalString(declared.tool, `${mode} tool`) : undefined;
    return { telescope: 'JWST', mode, archiveDate, observations: { count: requireFiniteNumber(count, `${mode} observations`), scope: 'this-mode' as const },
      programmes: stringList(object.programmes, 'programmes'), dates: [],
      toolkit: { ...(tool ? { tool } : {}), programs, checked, receipts: [] } };
  });
}

/** Hubble: configurations carry the tool and its checked programs; a target carries the configurations it was observed in, and
 * one observation count for the whole object. */
function hstModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'Hubble ledger');
  if (ledger.schema !== 'cssearth-hst-ledger@1') throw new TypeError(`Unsupported Hubble ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.archiveDate, 'archiveDate');
  const configurations = new Map(requireArray(ledger.configurations, 'configurations').map(raw => { const entry = requireRecord(raw, 'configuration'); return [requireString(entry.configuration, 'configuration'), entry] as const; }));
  const entries = [...requireArray(ledger.movingTargets, 'movingTargets'), ...requireArray(ledger.fixedTargets, 'fixedTargets')].map(raw => requireRecord(raw, 'target'));
  const object = entries.find(entry => entry.object === target);
  if (!object) return [];
  const count = requireFiniteNumber(object.observations, 'observations');
  return stringList(object.configurations, 'configurations').map(mode => {
    const declared = configurations.get(mode), programs = declared ? stringList(declared.programs, `${mode} programs`) : [], checked = declared ? stringList(declared.checked, `${mode} checked`) : [];
    const tool = declared ? optionalString(declared.tool, `${mode} tool`) : undefined;
    return { telescope: 'Hubble', mode, archiveDate, observations: { count, scope: 'object-total' as const }, programmes: [], dates: [],
      toolkit: { ...(tool ? { tool } : {}), programs, checked, receipts: [] } };
  });
}

/** NACO: each mode carries the state the route reached on it and the receipts behind it; each object carries the modes its
 * frames were taken in, its programmes, and one frame count for the whole object. */
function nacoModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'NACO ledger');
  if (ledger.schema !== 'cssearth-naco-ledger@1') throw new TypeError(`Unsupported NACO ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.measured, 'measured');
  const modes = new Map(requireArray(ledger.modes, 'modes').map(raw => { const entry = requireRecord(raw, 'mode'); return [requireString(entry.mode, 'mode'), entry] as const; }));
  const object = requireArray(ledger.objects, 'objects').map(raw => requireRecord(raw, 'object')).find(entry => entry.id === target);
  if (!object) return [];
  const frames = requireFiniteNumber(object.frames, 'frames');
  return stringList(object.modes, 'modes').map(mode => {
    const declared = modes.get(mode), state = declared ? requireString(declared.state, `${mode} state`) : undefined;
    const programs = declared ? stringList(declared.programs, `${mode} programs`) : [], receipts = declared ? stringList(declared.receipts, `${mode} receipts`) : [];
    return { telescope: 'VLT/NACO', mode, archiveDate, observations: { count: frames, scope: 'object-total' as const }, programmes: stringList(object.programmes, 'programmes'), dates: [],
      toolkit: { ...(state ? { routeState: state } : {}), ...(state === 'refused' && declared ? { refusedBecause: requireString(declared.reason, `${mode} reason`) } : {}),
        programs: declared ? stringList(declared.programs, `${mode} programs`) : [], checked: receipts.length ? programs : [], receipts } };
  });
}

/** Chandra: a shipped object carries its observation count and its longest observations, each with a detector and a start
 * date, so the detector is the mode. The reproductions are keyed by the configuration they ran on, and one counts for a mode
 * only when its key names that detector. */
function chandraModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'Chandra ledger');
  if (ledger.schema !== 'cssearth-chandra-ledger@1') throw new TypeError(`Unsupported Chandra ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.measured, 'measured');
  const shipped = requireRecord(ledger.shippedObjects, 'shippedObjects')[target];
  if (shipped === undefined) return [];
  const object = requireRecord(shipped, `shippedObjects.${target}`), reproductions = requireRecord(ledger.modes, 'modes');
  const longest = requireArray(object.longest, 'longest').map(raw => requireRecord(raw, 'observation'));
  const detectors = [...new Set(longest.map(entry => requireString(entry.instrument, 'instrument')))];
  return detectors.map(mode => {
    const named = Object.entries(reproductions).filter(([key]) => key.startsWith(mode)).map(([key, raw]) => ({ key, entry: requireRecord(raw, key) }));
    const reproduced = named.filter(({ entry }) => entry.state === 'reproduced'), refused = named.find(({ entry }) => entry.state === 'refused');
    const programs = reproduced.map(({ entry }) => requireString(entry.program, 'program'));
    return { telescope: 'Chandra', mode, archiveDate, observations: { count: requireFiniteNumber(object.observations, 'observations'), scope: 'object-total' as const }, programmes: [],
      dates: longest.filter(entry => entry.instrument === mode).map(entry => ({ id: `obsid ${String(requireFiniteNumber(entry.obsid, 'obsid'))}`, startIso: requireString(entry.startDate, 'startDate') })),
      toolkit: { ...(named.length ? { routeState: reproduced.length ? 'reproduced' : requireString(named[0]!.entry.state, 'state') } : {}),
        ...(refused ? { refusedBecause: optionalString(refused.entry.why, 'why') ?? 'The ledger refuses this configuration.' } : {}), programs, checked: programs, receipts: [] } };
  });
}

/** JunoCam: one camera, one mode. Each object carries the state the route reached on it and the programs pinned for it. */
function junoModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'JunoCam ledger');
  if (ledger.schema !== 'cssearth-junocam-ledger@1') throw new TypeError(`Unsupported JunoCam ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.measured, 'measured');
  const object = requireArray(ledger.objects, 'objects').map(raw => requireRecord(raw, 'object')).find(entry => entry.id === target);
  if (!object) return [];
  const state = requireString(object.state, 'state'), programs = stringList(object.programs, 'programs');
  return [{ telescope: 'Juno', mode: 'JUNOCAM', archiveDate, observations: { count: requireFiniteNumber(object.colourImages, 'colourImages'), scope: 'this-mode' as const }, programmes: programs, dates: [],
    toolkit: { routeState: state, programs, checked: state === 'measured' ? programs : [], receipts: [] } }];
}

const ADAPTERS: Readonly<Record<string, (value: unknown, target: string) => TargetMode[]>> = Object.freeze({ jwst: jwstModes, hst: hstModes, naco: nacoModes, chandra: chandraModes, juno: junoModes });

/** Every mode key the ledgers use, so `modes.json` can be tied to them and cannot drift. */
export function ledgerModeKeys(ledgers: QueryInputs['ledgers']): { readonly telescope: string; readonly mode: string }[] {
  const keys = new Map<string, { telescope: string; mode: string }>();
  for (const { telescope, value } of ledgers) {
    const ledger = requireRecord(value, `${telescope} ledger`);
    const add = (name: string, mode: string) => keys.set(`${name} ${mode}`, { telescope: name, mode });
    if (telescope === 'jwst') for (const raw of requireArray(ledger.modes, 'modes')) add('JWST', requireString(requireRecord(raw, 'mode').mode, 'mode'));
    if (telescope === 'hst') for (const raw of requireArray(ledger.configurations, 'configurations')) add('Hubble', requireString(requireRecord(raw, 'configuration').configuration, 'configuration'));
    if (telescope === 'naco') for (const raw of requireArray(ledger.modes, 'modes')) add('VLT/NACO', requireString(requireRecord(raw, 'mode').mode, 'mode'));
    if (telescope === 'chandra') for (const detector of Object.keys(requireRecord(requireRecord(ledger.archive, 'archive').byInstrument, 'byInstrument'))) add('Chandra', detector);
    if (telescope === 'juno') add('Juno', 'JUNOCAM');
  }
  return [...keys.values()].sort((a, b) => `${a.telescope}${a.mode}` < `${b.telescope}${b.mode}` ? -1 : 1);
}

const verdict = (answer: ConstraintAnswer, reason: string): ConstraintVerdict => ({ answer, reason });
const round = (value: number): number => Number(value.toPrecision(3));
const NO_CAPABILITIES = 'Capabilities not recorded: modes.json has no sourced entry for this mode, so nothing here states what it can do.';

/** The sharpest this mode can be at the requested wavelengths: the diffraction limit at the shortest wavelength both the
 * request and the mode cover, never finer than two pixels where a pixel scale is recorded. */
export function resolutionFloor(request: CapabilityRequest, capability: ModeCapability): { readonly arcsec: number; readonly basis: string } | null {
  const shortest = Math.max(request.wavelengthMicrometres[0], capability.wavelengthMicrometres[0]);
  if (shortest > Math.min(request.wavelengthMicrometres[1], capability.wavelengthMicrometres[1])) return null;
  const diffraction = capability.apertureMetres === undefined ? null : 1.22 * shortest * 1e-6 / capability.apertureMetres * ARCSEC_PER_RADIAN;
  const pixels = capability.pixelScaleArcsec === undefined ? null : 2 * capability.pixelScaleArcsec;
  if (diffraction === null) return { arcsec: pixels!, basis: `two ${capability.pixelScaleArcsec} arcsec pixels; no aperture is recorded for this mode, so no diffraction limit is put under it and the true floor may be coarser` };
  return pixels !== null && pixels > diffraction
    ? { arcsec: pixels, basis: `two ${capability.pixelScaleArcsec} arcsec pixels, which are wider than the ${round(diffraction)} arcsec diffraction limit of ${capability.apertureMetres} m at ${round(shortest)} micrometres` }
    : { arcsec: diffraction, basis: `1.22 lambda / D at ${round(shortest)} micrometres on ${capability.apertureMetres} m${pixels === null ? ', with no pixel scale recorded to floor it' : ''}` };
}

function constraintVerdicts(request: CapabilityRequest, mode: TargetMode, capability: ModeCapability | undefined): Record<string, ConstraintVerdict> {
  const [from, to] = request.wavelengthMicrometres;
  const floor = capability ? resolutionFloor(request, capability) : null;
  const verdicts: Record<string, ConstraintVerdict> = {
    wavelength: !capability ? verdict('unknown', NO_CAPABILITIES)
      : to < capability.wavelengthMicrometres[0] || from > capability.wavelengthMicrometres[1]
        ? verdict('no', `The mode covers ${capability.wavelengthMicrometres[0]} to ${capability.wavelengthMicrometres[1]} micrometres; ${from} to ${to} is outside it.`)
      : from >= capability.wavelengthMicrometres[0] && to <= capability.wavelengthMicrometres[1]
        ? verdict('yes', `The mode covers ${capability.wavelengthMicrometres[0]} to ${capability.wavelengthMicrometres[1]} micrometres, which contains ${from} to ${to}.`)
      : verdict('partial', `The mode covers ${capability.wavelengthMicrometres[0]} to ${capability.wavelengthMicrometres[1]} micrometres, so only ${round(Math.max(from, capability.wavelengthMicrometres[0]))} to ${round(Math.min(to, capability.wavelengthMicrometres[1]))} of the request is inside it.`),
    angularResolution: !capability ? verdict('unknown', NO_CAPABILITIES) : !floor ? verdict('unknown', 'The mode covers none of the requested wavelengths, so there is no sharpness to state for them.')
      : request.angularResolutionArcsec === undefined ? verdict('unknown', `No sharpness was asked for. This mode cannot be sharper than ${round(floor.arcsec)} arcsec here (${floor.basis}).`)
      : floor.arcsec > request.angularResolutionArcsec ? verdict('no', `This mode cannot be sharper than ${round(floor.arcsec)} arcsec here (${floor.basis}); the request asks for ${request.angularResolutionArcsec} arcsec or better.`)
      : verdict('partial', `Possible: this mode cannot be sharper than ${round(floor.arcsec)} arcsec here (${floor.basis}), which is within the ${request.angularResolutionArcsec} arcsec asked for. Whether any observation of ${request.target} reached it is not in the ledger.`),
    time: !request.time ? verdict('unknown', 'No time range was asked for.')
      : !mode.dates.length ? verdict('unknown', 'This ledger carries no dates for this target and mode.')
      : (() => {
          const inside = mode.dates.filter(date => date.startIso >= request.time!.fromIso && date.startIso <= request.time!.toIso);
          return inside.length ? verdict('yes', `The ledger names ${inside.length} observation(s) that started inside the range: ${inside.map(date => `${date.id} on ${date.startIso.slice(0, 10)}`).join(', ')}.`)
            : verdict('partial', `The ledger dates ${mode.dates.length} observation(s) of this target and mode and all start outside the range (${mode.dates.map(date => date.startIso.slice(0, 10)).join(', ')}); it does not date the rest.`);
        })(),
    kind: !capability ? verdict('unknown', NO_CAPABILITIES)
      : !request.kind ? verdict('unknown', `No product kind was asked for. This mode produces ${capability.kinds.join(', ')}.`)
      : capability.kinds.includes(request.kind) ? verdict('yes', `This mode produces ${capability.kinds.join(', ')}.`)
      : verdict('no', `This mode produces ${capability.kinds.join(', ')}, not ${request.kind}.`) };
  const ground = floor && request.rangeKm !== undefined
    ? surfaceResolutionKm({ rangeKm: request.rangeKm, angularResolution: { majorArcsec: floor.arcsec, minorArcsec: floor.arcsec, basis: floor.basis } }).majorKm : null;
  if (request.surfaceResolutionKm !== undefined) verdicts.surfaceResolution = !capability ? verdict('unknown', NO_CAPABILITIES)
    : request.rangeKm === undefined ? verdict('unknown', 'Unknown: kilometres on the ground need the range to the body, which the caller gives.')
    : !floor || ground === null ? verdict('unknown', 'The mode covers none of the requested wavelengths, so there is no resolution to convert.')
    : ground > request.surfaceResolutionKm ? verdict('no', `At ${request.rangeKm} km the finest this mode can reach is ${round(ground)} km at the sub-observer point; the request asks for ${request.surfaceResolutionKm} km or finer.`)
    : verdict('partial', `Possible: at ${request.rangeKm} km this mode cannot be finer than ${round(ground)} km at the sub-observer point, which is within the ${request.surfaceResolutionKm} km asked for, and it is coarser toward the limb. What any observation reached is not in the ledger.`);
  if (request.resolutionElements !== undefined) verdicts.resolutionElements = !capability ? verdict('unknown', NO_CAPABILITIES)
    : request.rangeKm === undefined || request.bodyRadiusKm === undefined ? verdict('unknown', 'Unknown: elements across the disc need the range to the body and its radius, which the caller gives.')
    : !floor ? verdict('unknown', 'The mode covers none of the requested wavelengths, so there is no resolution to convert.')
    : (() => {
        const elements = resolutionElementsAcrossDisc({ rangeKm: request.rangeKm!, angularResolution: { majorArcsec: floor.arcsec, minorArcsec: floor.arcsec, basis: floor.basis } }, request.bodyRadiusKm!);
        return elements < request.resolutionElements! ? verdict('no', `At ${request.rangeKm} km a body of radius ${request.bodyRadiusKm} km spans at most ${round(elements)} elements for this mode; the request asks for ${request.resolutionElements}.`)
          : verdict('partial', `Possible: at ${request.rangeKm} km the disc spans at most ${round(elements)} elements for this mode, which meets the ${request.resolutionElements} asked for. What any observation reached is not in the ledger.`);
      })();
  return verdicts;
}

function toolkitSupport(mode: TargetMode, target: string): ToolkitSupport {
  const { tool, routeState, refusedBecause, programs, checked } = mode.toolkit;
  const pinned = forTarget(programs, target), passed = forTarget(checked, target);
  const level: ToolkitLevel = checked.length ? 'proven' : tool || (routeState && routeState !== 'refused') ? 'tool-without-checked-program' : 'none';
  const named = tool ? `${tool} reduces this mode` : routeState ? `the route reached the state "${routeState}" on this mode` : 'no tool for this mode is named in the ledger';
  const reason = level === 'none' ? `${refusedBecause ?? `${named}, and no program of it is checked`}.`
    : level === 'proven' ? `${named}, and ${checked.length} program(s) have a checked receipt: ${checked.join(', ')}. ${passed.length ? `${passed.join(', ')} is a program of ${target}.` : `None of them is a program of ${target}.`}`
    : `${named}, but no program of it has a checked receipt yet.`;
  return { level, reason, ...(tool ? { tool } : {}), programs, checked, targetProgramPinned: pinned.length > 0, targetProgramChecked: passed.length > 0 };
}

/** The observations of a body map that were taken in this mode, each with the resolution it actually had. */
function measuredResolutions(inputs: QueryInputs, mode: TargetMode): MeasuredResolution[] {
  const matches = (observation: BodyMapObservation) => {
    const text = `${observation.telescope} ${observation.instrument}`.toUpperCase();
    return text.includes(mode.telescope.split('/').at(-1)!.toUpperCase()) && mode.mode.split(/[/-]/u).some(part => part.length > 2 && text.includes(part.toUpperCase()));
  };
  return inputs.bodyMaps.flatMap(({ path, value }) => {
    const map = parseBodyMapProduct(value);
    return map.observations.filter(matches).map(observation => ({ path, quantity: `${map.definition.quantity} (${map.definition.units})`, observation: observation.id,
      angularResolutionArcsec: observation.angularResolution.majorArcsec, surfaceResolutionKm: round(surfaceResolutionKm(observation).majorKm) }));
  });
}

function investigationEntries(inputs: QueryInputs, mode: TargetMode): CandidateEvidence['investigations'] {
  if (!inputs.investigations) return [];
  const ledger = requireRecord(inputs.investigations.value, 'investigation ledger');
  const words = [mode.telescope.split('/').at(-1)!, ...mode.mode.split(/[/-]/u)].filter(word => word.length > 2).map(word => word.toLowerCase());
  return requireArray(ledger.entries, 'entries').map(raw => requireRecord(raw, 'entry')).filter(entry => {
    const text = `${requireString(entry.subject, 'subject')} ${requireString(entry.finding, 'finding')}`.toLowerCase();
    return words.some(word => text.includes(word));
  }).map(entry => ({ id: requireString(entry.id, 'id'), status: requireString(entry.status, 'status'), subject: requireString(entry.subject, 'subject') }));
}

const UNKNOWN_UNTIL_READ = (target: string): string[] => [
  `Whether any exposure of ${target} saturates, or is too faint, at the requested wavelengths.`,
  'Which wavelengths of the mode a given exposure actually used, and how much of its coverage is usable in it.',
  'The resolution a given observation reached: the ledger holds none, and the figure above is only what the mode cannot beat.',
  `Where ${target} was pointed and lit: the sub-observer and sub-solar points, and the time of day on the ground.`,
  `Whether ${target} was resolved at all in a given exposure, and how much of it the field of view held.`];

export function queryCapabilities(request: CapabilityRequest, inputs: QueryInputs): CapabilityAnswer {
  if (!(request.wavelengthMicrometres[0] > 0 && request.wavelengthMicrometres[1] >= request.wavelengthMicrometres[0])) throw new RangeError('A request states its wavelengths in micrometres, shortest first.');
  if (request.kind && !(PRODUCT_KINDS as readonly string[]).includes(request.kind)) throw new TypeError(`Unknown product kind ${request.kind}.`);
  const capabilities = new Map(inputs.capabilities.map(entry => [`${entry.telescope} ${entry.mode}`, entry] as const));
  const candidates: Candidate[] = [], withoutTheTarget: CapabilityAnswer['withoutTheTarget'] = [];
  for (const ledger of inputs.ledgers) {
    const adapter = ADAPTERS[ledger.telescope];
    if (!adapter) throw new TypeError(`No adapter reads the ${ledger.telescope} ledger.`);
    const modes = adapter(ledger.value, request.target);
    if (!modes.length) { withoutTheTarget.push({ telescope: ledger.telescope, ledger: ledger.path, reason: `This ledger holds no record of ${request.target}.` }); continue; }
    for (const mode of modes) {
      const capability = capabilities.get(`${mode.telescope} ${mode.mode}`);
      const bodyMaps = measuredResolutions(inputs, mode);
      candidates.push({ telescope: mode.telescope, mode: mode.mode, observations: mode.observations, programmes: mode.programmes,
        meetsConstraints: constraintVerdicts(request, mode, capability), toolkitSupport: toolkitSupport(mode, request.target),
        evidence: { ledger: ledger.path, archiveDate: mode.archiveDate, receipts: mode.toolkit.receipts, bodyMaps, investigations: investigationEntries(inputs, mode) },
        unknown: [...(capability ? [] : [`What this mode can do: ${NO_CAPABILITIES}`]), ...UNKNOWN_UNTIL_READ(request.target),
          ...(bodyMaps.length ? [] : [`Whether anything here has ever measured ${request.target} in this mode: no body map beside the object names it.`])] });
    }
  }
  return { target: request.target, request, candidates: candidates.sort((a, b) => `${a.telescope}${a.mode}` < `${b.telescope}${b.mode}` ? -1 : 1), withoutTheTarget };
}

export const LEDGER_TELESCOPES: readonly string[] = Object.keys(ADAPTERS);

/** Read everything the query needs from the repository. The query itself reads nothing. */
export async function loadQueryInputs(root: string, target: string): Promise<QueryInputs> {
  const ledgers: QueryInputs['ledgers'] = [];
  for (const telescope of LEDGER_TELESCOPES) {
    const path = `data/${telescope}/ledger.json`;
    const value = await readJsonSource(resolve(root, path)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
    if (value !== undefined) ledgers.push({ telescope, path, value });
  }
  const capabilities = parseModeCapabilities(await readJsonSource(resolve(root, 'tools/objects/telescopes/modes.json')));
  const source = resolve(root, 'src/objects', target, 'source');
  const names = await readdir(source, { recursive: true }).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT', 'ENOTDIR')) return [] as string[]; throw error; });
  const bodyMaps: QueryInputs['bodyMaps'] = [];
  for (const name of names.filter(entry => entry.endsWith('.body-map.json')).sort()) bodyMaps.push({ path: `src/objects/${target}/source/${name}`, value: await readJsonSource(resolve(source, name)) });
  const investigationPath = `src/objects/${target}/investigations.json`;
  const investigations = await readJsonSource(resolve(root, investigationPath)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT', 'ENOTDIR')) return undefined; throw error; });
  return { ledgers, capabilities, bodyMaps, ...(investigations === undefined ? {} : { investigations: { path: investigationPath, value: investigations } }) };
}

const LEVEL_WORDS: Readonly<Record<ToolkitLevel, string>> = Object.freeze({ none: 'no toolkit', 'tool-without-checked-program': 'a tool, but no checked program', proven: 'proven on checked programs' });

export function formatAnswer(answer: CapabilityAnswer): string {
  const lines = [`${answer.candidates.length} candidate mode(s) observed ${answer.target} at ${answer.request.wavelengthMicrometres[0]} to ${answer.request.wavelengthMicrometres[1]} micrometres.`,
    'None of these says an observation is adequate: the ledgers hold counts and programmes, not exposures.', ''];
  for (const candidate of answer.candidates) {
    lines.push(`${candidate.telescope} ${candidate.mode}${candidate.observations ? ` (${candidate.observations.count} ${candidate.observations.scope === 'this-mode' ? 'observations in this mode' : 'observations of the object, across its modes'})` : ''}`);
    for (const [name, { answer: verdictAnswer, reason }] of Object.entries(candidate.meetsConstraints)) lines.push(`  ${name}: ${verdictAnswer}. ${reason}`);
    lines.push(`  toolkit: ${LEVEL_WORDS[candidate.toolkitSupport.level]}. ${candidate.toolkitSupport.reason}`);
    lines.push(`  a program of ${answer.target}: ${candidate.toolkitSupport.targetProgramChecked ? 'pinned and checked' : candidate.toolkitSupport.targetProgramPinned ? 'pinned, not checked' : 'none'}`);
    lines.push(`  evidence: ${candidate.evidence.ledger} (archive read ${candidate.evidence.archiveDate})${candidate.evidence.receipts.length ? `, receipts ${candidate.evidence.receipts.join(', ')}` : ''}`);
    for (const map of candidate.evidence.bodyMaps) lines.push(`    measured: ${map.path}, ${map.quantity}, ${map.angularResolutionArcsec} arcsec, ${map.surfaceResolutionKm} km at the sub-observer point`);
    for (const entry of candidate.evidence.investigations) lines.push(`    investigation ${entry.id} (${entry.status}): ${entry.subject}`);
    for (const line of candidate.unknown) lines.push(`    unknown: ${line}`);
    lines.push('');
  }
  for (const entry of answer.withoutTheTarget) lines.push(`${entry.ledger}: ${entry.reason}`);
  return `${lines.join('\n')}\n`;
}

const numberFlag = (args: readonly string[], flag: string): number | undefined => {
  const raw = flagValue(args, flag);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new TypeError(`${flag} takes a number; it was given ${raw}.`);
  return value;
};

export function requestFromArguments(args: readonly string[]): CapabilityRequest {
  const target = flagValue(args, '--target'), wavelength = flagValue(args, '--wavelength');
  if (!target || !wavelength) throw new Error('Usage: query.mts --target europa --wavelength 3.4,3.6 [--range-km N] [--radius-km N] [--min-arcsec N] [--min-km N] [--min-elements N] [--from ISO --to ISO] [--kind cube] [--json]');
  const range = wavelength.split(',').map(Number);
  if (range.length !== 2 || !range.every(Number.isFinite)) throw new TypeError('--wavelength takes two micrometre values, shortest first, as 3.4,3.6.');
  const from = flagValue(args, '--from'), to = flagValue(args, '--to'), kind = flagValue(args, '--kind');
  if (kind && !(PRODUCT_KINDS as readonly string[]).includes(kind)) throw new TypeError(`--kind takes one of ${PRODUCT_KINDS.join(', ')}.`);
  if (Boolean(from) !== Boolean(to)) throw new TypeError('--from and --to are given together.');
  return { target, wavelengthMicrometres: [range[0]!, range[1]!], ...(from && to ? { time: { fromIso: from, toIso: to } } : {}),
    ...(numberFlag(args, '--min-arcsec') === undefined ? {} : { angularResolutionArcsec: numberFlag(args, '--min-arcsec')! }),
    ...(numberFlag(args, '--min-km') === undefined ? {} : { surfaceResolutionKm: numberFlag(args, '--min-km')! }),
    ...(numberFlag(args, '--min-elements') === undefined ? {} : { resolutionElements: numberFlag(args, '--min-elements')! }),
    ...(numberFlag(args, '--range-km') === undefined ? {} : { rangeKm: numberFlag(args, '--range-km')! }),
    ...(numberFlag(args, '--radius-km') === undefined ? {} : { bodyRadiusKm: numberFlag(args, '--radius-km')! }),
    ...(kind ? { kind: kind as ProductKind } : {}) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').at(-1) ?? ' ')) {
  const args = process.argv.slice(2), request = requestFromArguments(args);
  const answer = queryCapabilities(request, await loadQueryInputs(resolve(import.meta.dirname, '../../..'), request.target));
  process.stdout.write(args.includes('--json') ? `${JSON.stringify(answer, null, 2)}\n` : formatAnswer(answer));
}
