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
import { qualificationActionsFor, type QualificationAction } from './qualification-routes.mts';
import { resolveTarget, type TargetCatalogueEntry, type TargetResolution } from './targets.mts';

const ARCSEC_PER_RADIAN = 206_264.806_247;
export const MODES_SCHEMA = 'cssearth-telescope-modes@1';
export const PRODUCT_KINDS = ['image', 'cube', 'spectrum', 'photometry', 'events', 'strips'] as const;
export type ProductKind = typeof PRODUCT_KINDS[number];
export const REQUESTED_RESULTS = ['telescope-product', 'body-map'] as const;
export type RequestedResult = typeof REQUESTED_RESULTS[number];

/** What an instrument mode can do, from its own documentation. `bands` means the coverage is the one `bands.mts` already
 * states for that mode's bands, so it is not retyped here. */
export interface ModeCapability {
  readonly telescope: string; readonly mode: string;
  /** One interval per documented window, filter or channel, merged where they touch and sorted. A mode is never given an
   * enclosing minimum and maximum: NIRCam coronagraphy observes 1.8 to 2.2 and 2.8 to 5.0 micrometres and nothing between. */
  readonly wavelengthIntervals?: readonly (readonly [number, number])[];
  /** Left out where the documentation states no aperture, as for a spacecraft camera given only by its T number. */
  readonly apertureMetres?: number;
  /** How finely the detector samples the image. This is sampling, not resolution. */
  readonly pixelScaleArcsec?: number;
  /** What the optics resolve, where the documentation states it directly rather than leaving it to the diffraction limit:
   * a grazing-incidence X-ray telescope has no useful diffraction limit, and its published point spread function is the fact. */
  readonly instrumentResolution?: { readonly arcsec: number; readonly basis: string; readonly citation: string };
  readonly kinds: readonly ProductKind[];
  readonly citation: string;
  readonly note?: string;
}

export type ConstraintAnswer = 'yes' | 'no' | 'partial' | 'unknown';
export interface ConstraintVerdict { readonly answer: ConstraintAnswer; readonly reason: string }
/** What this repository can do with a mode, in rising order of what has actually been established here.
 *
 * `archive-final` is its own level and not a weaker `proven`: the observatory's own final product was pinned, downloaded and
 * read whole, which establishes the bytes and not a re-calibration. A mode whose pipeline is retired can reach it and never
 * reach `proven`, and a caller asking what was re-made here is never answered with it. */
export type ToolkitLevel = 'none' | 'archive-final' | 'tool-without-checked-program' | 'proven';

export interface ToolkitSupport {
  readonly level: ToolkitLevel; readonly reason: string;
  readonly productionMethod: 'none' | 'tool-available' | 'local-pipeline' | 'archive-final';
  readonly evidenceBasis: 'none' | 'accepted-route-receipts' | 'archive-origin';
  readonly acceptanceCriterion: 'none' | 'receipt-valid-for-pinned-program' | 'archive-bytes-qualified';
  readonly tool?: string;
  readonly programs: readonly string[]; readonly checked: readonly string[];
  /** Programs whose pin of the archive's own final product was checked. Never merged with `checked`, which is re-calibration. */
  readonly archiveFinalQualified: readonly string[];
  readonly targetProgramPinned: boolean; readonly targetProgramChecked: boolean;
  readonly targetArchiveFinalQualified: boolean;
}

export interface MeasuredResolution { readonly path: string; readonly quantity: string; readonly observation: string; readonly programme?: string; readonly angularResolutionArcsec: number; readonly surfaceResolutionKm: number }
export interface CandidateEvidence {
  readonly ledger: string; readonly archiveDate: string;
  readonly receipts: readonly string[];
  readonly bodyMaps: readonly MeasuredResolution[];
  readonly investigations: readonly { readonly id: string; readonly status: string; readonly subject: string }[];
}

/** Evidence that names no single mode. It stays here rather than being attached to a candidate that might not be the one it
 * is about. */
export interface UnassignedEvidence {
  readonly kind: 'body-map' | 'investigation';
  readonly source: string; readonly identity: string; readonly reason: string;
  readonly couldMean: readonly string[];
}

export type WorkflowBlockerCode = 'request-incomplete' | 'constraint-refused' | 'toolkit-unavailable' | 'body-map-author-missing' | 'target-program-unqualified';
export type TargetCoverageState = 'observed' | 'searched-empty' | 'not-searched' | 'unanswered';
export interface TargetCoverage { readonly telescope: string; readonly ledger: string; readonly state: TargetCoverageState; readonly reason: string }
export interface WorkflowBlocker { readonly code: WorkflowBlockerCode; readonly reason: string; readonly constraint?: string }
export interface SelectionAction { readonly kind: 'select-observation'; readonly programme: string; readonly command: 'pnpm'; readonly arguments: readonly string[] }
export interface CandidateSelectionAssessment {
  readonly selectable: boolean;
  readonly blockers: readonly WorkflowBlocker[];
  /** One executable, structured action per target-qualified program. Empty while any blocker remains. */
  readonly nextActions: readonly SelectionAction[];
  /** Concrete archive observations this repository can qualify when that is the only remaining blocker. */
  readonly qualificationActions: readonly QualificationAction[];
}

export interface Candidate {
  readonly telescope: string; readonly mode: string;
  readonly observations: { readonly count: number; readonly scope: 'this-mode' | 'object-total';
    /** Complete observation identities where the ledger preserves them, rather than only a grouped count. */
    readonly records?: readonly { readonly id: string; readonly programme?: string; readonly startIso: string; readonly endIso?: string; readonly title?: string;
      readonly filter?: string; readonly pixelScaleArcsec?: number; readonly quality?: string; readonly observatory?: string; readonly instrument?: string;
      readonly archiveTarget?: string; readonly night?: string; readonly targetLid?: string; readonly productLidvid?: string;
      readonly wavelengthIntervalMicrometres?: readonly [number, number] }[] } | null;
  readonly programmes: readonly string[];
  readonly meetsConstraints: Readonly<Record<string, ConstraintVerdict>>;
  readonly toolkitSupport: ToolkitSupport;
  /** Whether this repository has an author that turns this exact mode into the requested shared body-map contract. This is
   * separate from toolkit support: a reducer can be proven while ending at an unregistered detector product. */
  readonly bodyMapSupport: { readonly answer: 'yes' | 'no'; readonly reason: string; readonly author?: string };
  /** The workflow verdict derived from the same facts the explicit selector enforces. */
  readonly selectionAssessment: CandidateSelectionAssessment;
  readonly evidence: CandidateEvidence;
  readonly unknown: readonly string[];
}

export interface CapabilityRequest {
  readonly target: string;
  readonly wavelengthMicrometres: readonly [number, number];
  readonly time?: { readonly any: true } | { readonly fromIso: string; readonly toIso: string };
  /** The coarsest sharpness that would still answer the question, in arcsec. */
  readonly angularResolutionArcsec?: number;
  /** The coarsest surface resolution that would still answer it, in kilometres. Needs `rangeKm`. */
  readonly surfaceResolutionKm?: number;
  /** The fewest resolution elements across the disc that would still answer it. Needs `rangeKm` and `bodyRadiusKm`. */
  readonly resolutionElements?: number;
  readonly rangeKm?: number;
  readonly bodyRadiusKm?: number;
  readonly kind?: ProductKind;
  /** The deliverable the caller needs. Exploratory queries may omit it; explicit selection may not. */
  readonly result?: RequestedResult;
}

/** Everything the query reads, already loaded: it does no input or output of its own. */
export interface QueryInputs {
  readonly ledgers: readonly { readonly telescope: string; readonly path: string; readonly value: unknown }[];
  readonly capabilities: readonly ModeCapability[];
  readonly targetCatalogue: readonly TargetCatalogueEntry[];
  readonly bodyMaps: readonly { readonly path: string; readonly value: unknown }[];
  readonly investigations?: { readonly path: string; readonly value: unknown };
}

export interface CapabilityAnswer {
  readonly target: string;
  readonly request: CapabilityRequest;
  readonly targetResolution: TargetResolution;
  readonly candidates: readonly Candidate[];
  readonly unassignedEvidence: readonly UnassignedEvidence[];
  readonly endpoint: { readonly status: 'unknown-target' | 'request-incomplete' | 'index-incomplete' | 'no-selectable-candidate' | 'selectable-candidates'; readonly selectableCandidates: number; readonly blockerCodes: readonly (WorkflowBlockerCode | 'unknown-target' | 'target-index-unavailable' | 'archive-query-unanswered')[] };
  /** One explicit coverage result per ledger. Absence is never silently treated as an archive negative. */
  readonly targetCoverage: readonly TargetCoverage[];
  /** Compatibility view containing only ledgers that explicitly searched for the target and found nothing. */
  readonly withoutTheTarget: readonly { readonly telescope: string; readonly ledger: string; readonly reason: string }[];
}

export const OBSERVATION_SELECTION_SCHEMA = 'cssearth-telescope-observation-selection@1';
export interface ObservationSelection {
  readonly schema: typeof OBSERVATION_SELECTION_SCHEMA;
  readonly request: CapabilityRequest;
  readonly telescope: string;
  readonly mode: string;
  readonly programme: string;
  readonly toolkitLevel: ToolkitLevel;
  readonly constraints: Readonly<Record<string, ConstraintVerdict>>;
  readonly bodyMapSupport: Candidate['bodyMapSupport'];
  /** Constraints that remain partial or unknown after selection. They stay visible rather than becoming an implied yes. */
  readonly unresolved: readonly { readonly constraint: string; readonly answer: 'partial' | 'unknown'; readonly reason: string }[];
  readonly evidence: CandidateEvidence;
}

export type SelectionBlockerCode = 'incomplete-request' | 'candidate' | 'constraint' | 'toolkit' | 'body-map' | 'programme';
export interface SelectionBlocker { readonly code: SelectionBlockerCode; readonly reason: string; readonly constraint?: string }
export interface SelectionAssessment { readonly candidate?: Candidate; readonly blockers: readonly SelectionBlocker[] }

export class ObservationSelectionError extends Error {
  readonly blockers: readonly SelectionBlocker[];
  constructor(telescope: string, mode: string, programme: string, blockers: readonly SelectionBlocker[]) {
    super(`Cannot select ${telescope} ${mode} program ${programme}:\n${blockers.map(blocker => `- ${blocker.reason}`).join('\n')}`);
    this.name = 'ObservationSelectionError'; this.blockers = blockers;
    Object.defineProperty(this, 'blockers', { enumerable: false });
  }
}

/** What a ledger says about one target in one mode, in the one shape every adapter produces. */
interface TargetMode {
  readonly telescope: string; readonly mode: string;
  readonly archiveDate: string;
  readonly observations: Candidate['observations'];
  readonly programmes: readonly string[];
  readonly toolkit: { readonly tool?: string; readonly routeState?: string; readonly refusedBecause?: string; readonly programs: readonly string[]; readonly checked: readonly string[]; readonly receipts: readonly string[];
    /** Archive-final programs of this mode, and the ones a record qualified. A ledger that states none leaves this out. */
    readonly archiveFinal?: { readonly programs: readonly string[]; readonly qualified: readonly string[] } };
  /** Dated observations of this target in this mode, where the ledger dates any. */
  readonly dates: readonly { readonly id: string; readonly startIso: string; readonly endIso?: string }[];
  /** True only when the ledger retains every observation record counted for this target and mode. */
  readonly datesComplete?: boolean;
}

const stringList = (value: unknown, label: string): string[] => requireArray(value, label).map((entry, index) => requireString(entry, `${label}[${index}]`));
const optionalString = (value: unknown, label: string): string | undefined => value === undefined || value === null ? undefined : requireString(value, label);
const forTarget = (programs: readonly string[], target: string): string[] => programs.filter(program => program === target || program.startsWith(`${target}-`));

const missingRequestFields = (request: CapabilityRequest): string[] => [...(request.time ? [] : ['time (--from and --to, or --any-time)']),
  ...(request.angularResolutionArcsec !== undefined || request.surfaceResolutionKm !== undefined || request.resolutionElements !== undefined ? [] : ['a required resolution (--min-arcsec, --min-km or --min-elements)']),
  ...(request.kind ? [] : ['product kind (--kind)']), ...(request.result ? [] : ['requested result (--result telescope-product|body-map)'])];

const requestArguments = (request: CapabilityRequest): string[] => ['--target', request.target, '--wavelength', request.wavelengthMicrometres.join(','),
  ...(!request.time ? [] : 'any' in request.time ? ['--any-time'] : ['--from', request.time.fromIso, '--to', request.time.toIso]),
  ...(request.angularResolutionArcsec === undefined ? [] : ['--min-arcsec', String(request.angularResolutionArcsec)]),
  ...(request.surfaceResolutionKm === undefined ? [] : ['--min-km', String(request.surfaceResolutionKm)]),
  ...(request.resolutionElements === undefined ? [] : ['--min-elements', String(request.resolutionElements)]),
  ...(request.rangeKm === undefined ? [] : ['--range-km', String(request.rangeKm)]), ...(request.bodyRadiusKm === undefined ? [] : ['--radius-km', String(request.bodyRadiusKm)]),
  ...(request.kind ? ['--kind', request.kind] : []), ...(request.result ? ['--result', request.result] : [])];

function workflowAssessment(request: CapabilityRequest, target: string, candidate: Omit<Candidate, 'selectionAssessment'>): CandidateSelectionAssessment {
  const blockers: WorkflowBlocker[] = missingRequestFields(request).map(reason => ({ code: 'request-incomplete', reason: `The request is missing ${reason}.` }));
  for (const [constraint, verdict_] of Object.entries(candidate.meetsConstraints)) if (verdict_.answer === 'no')
    blockers.push({ code: 'constraint-refused', constraint, reason: `${constraint}: ${verdict_.reason}` });
  if (candidate.toolkitSupport.level === 'none') blockers.push({ code: 'toolkit-unavailable', reason: candidate.toolkitSupport.reason });
  if (request.result === 'body-map' && candidate.bodyMapSupport.answer === 'no') blockers.push({ code: 'body-map-author-missing', reason: candidate.bodyMapSupport.reason });
  const programmes = [...new Set([...candidate.toolkitSupport.programs, ...candidate.toolkitSupport.archiveFinalQualified])]
    .filter(value => value === target || value.startsWith(`${target}-`)).sort();
  if (!programmes.length) blockers.push({ code: 'target-program-unqualified', reason: `No pinned or qualified program of ${target} is available for this mode.` });
  const nextActions = blockers.length ? [] : programmes.map(programme => ({ kind: 'select-observation' as const, programme, command: 'pnpm' as const,
    arguments: ['--silent', 'telescope:query', ...requestArguments(request), '--select-telescope', candidate.telescope, '--select-mode', candidate.mode, '--program', programme, '--json'] }));
  const qualificationActions = blockers.length === 1 && blockers[0]!.code === 'target-program-unqualified'
    ? qualificationActionsFor(candidate.telescope, candidate.mode, target, request.wavelengthMicrometres, request.time, candidate.observations?.records ?? []) : [];
  return { selectable: blockers.length === 0, blockers, nextActions, qualificationActions };
}

export function parseModeCapabilities(value: unknown): ModeCapability[] {
  const record = requireRecord(value, 'mode capabilities');
  if (record.schema !== MODES_SCHEMA) throw new TypeError(`Unsupported mode capability schema ${String(record.schema)}.`);
  return requireArray(record.modes, 'modes').map((raw, index) => {
    const entry = requireRecord(raw, `mode ${index}`), mode = requireString(entry.mode, 'mode'), telescope = requireString(entry.telescope, 'telescope');
    const kinds = stringList(entry.kinds, `${mode} kinds`).map(kind => {
      if (!(PRODUCT_KINDS as readonly string[]).includes(kind)) throw new TypeError(`${mode} names an unknown product kind ${kind}.`);
      return kind as ProductKind;
    });
    const intervals = entry.wavelengths === undefined ? undefined : entry.wavelengths === 'bands' ? bandIntervals(mode) : mergeIntervals(requireArray(entry.wavelengths, `${mode} wavelengths`).map((raw, position) => {
      const range = requireArray(raw, `${mode} interval ${position}`);
      if (range.length !== 2) throw new TypeError(`${mode} states each interval as two wavelengths in micrometres.`);
      const from = requireFiniteNumber(range[0], `${mode} interval ${position} start`), to = requireFiniteNumber(range[1], `${mode} interval ${position} end`);
      if (!(from > 0 && to > from)) throw new RangeError(`${mode} covers ${from} to ${to} micrometres, which is not a range.`);
      return [from, to] as const;
    }));
    if (intervals !== undefined && !intervals.length) throw new TypeError(`${mode} names the wavelengths it covers.`);
    if (!kinds.length) throw new TypeError(`${mode} names what it produces.`);
    if (entry.instrumentResolutionArcsec !== undefined && (entry.instrumentResolutionBasis === undefined || entry.instrumentResolutionCitation === undefined))
      throw new TypeError(`${mode} states what its point spread function figure is and where it was read.`);
    return Object.freeze({ telescope, mode, ...(intervals === undefined ? {} : { wavelengthIntervals: intervals }),
      ...(entry.apertureMetres === undefined ? {} : { apertureMetres: requireFiniteNumber(entry.apertureMetres, `${mode} apertureMetres`) }),
      ...(entry.pixelScaleArcsec === undefined ? {} : { pixelScaleArcsec: requireFiniteNumber(entry.pixelScaleArcsec, `${mode} pixelScaleArcsec`) }),
      ...(entry.instrumentResolutionArcsec === undefined ? {} : { instrumentResolution: { arcsec: requireFiniteNumber(entry.instrumentResolutionArcsec, `${mode} instrumentResolutionArcsec`),
        basis: requireString(entry.instrumentResolutionBasis, `${mode} instrumentResolutionBasis`), citation: requireString(entry.instrumentResolutionCitation, `${mode} instrumentResolutionCitation`) } }),
      kinds, citation: requireString(entry.citation, `${mode} citation`), ...(entry.note === undefined ? {} : { note: requireString(entry.note, `${mode} note`) }) });
  });
}

/** The intervals `bands.mts` already states for a JWST cube mode, one per band, merged where they overlap. */
function bandIntervals(mode: string): (readonly [number, number])[] {
  const prefix = mode === 'NIRSPEC/IFU' ? 'NIRSPEC-' : mode === 'MIRI/IFU' ? 'MIRI-MRS-' : null;
  if (!prefix) throw new TypeError(`${mode} has no bands in bands.mts to take its coverage from; state it here with its citation.`);
  const ranges = Object.entries(JWST_CUBE_COVERAGE).filter(([id]) => id.startsWith(prefix)).map(([, range]) => range);
  if (!ranges.length) throw new TypeError(`bands.mts holds no ${mode} bands.`);
  return mergeIntervals(ranges);
}

/** Intervals sorted and joined where they touch or overlap, so a gap that survives is a real gap. */
export function mergeIntervals(intervals: readonly (readonly [number, number])[]): (readonly [number, number])[] {
  const merged: [number, number][] = [];
  for (const [from, to] of [...intervals].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1);
    if (last && from <= last[1]) last[1] = Math.max(last[1], to); else merged.push([from, to]);
  }
  return merged;
}

/** The parts of `request` that fall inside the intervals. A request of zero width is inside when a interval contains it. */
export function intersectIntervals(intervals: readonly (readonly [number, number])[], request: readonly [number, number]): (readonly [number, number])[] {
  return intervals.map(([from, to]) => [Math.max(from, request[0]), Math.min(to, request[1])] as const)
    .filter(([from, to]) => to > from || (to === from && request[0] === request[1]));
}

const intervalWords = (intervals: readonly (readonly [number, number])[]): string =>
  intervals.map(([from, to]) => `${from} to ${to}`).join(intervals.length > 2 ? ', ' : ' and ');

/** JWST: modes carry the tool and its checked programs; each object carries how many observations it has in each mode. */
function jwstModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'JWST ledger');
  if (ledger.schema !== 'cssearth-jwst-ledger@1' && ledger.schema !== 'cssearth-jwst-ledger@2') throw new TypeError(`Unsupported JWST ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.archiveDate, 'archiveDate');
  const modes = new Map(requireArray(ledger.modes, 'modes').map(raw => { const entry = requireRecord(raw, 'mode'); return [requireString(entry.mode, 'mode'), entry] as const; }));
  const object = requireArray(ledger.objects, 'objects').map(raw => requireRecord(raw, 'object')).find(entry => entry.id === target);
  if (!object) return [];
  return Object.entries(requireRecord(object.observations, 'observations')).map(([mode, count]) => {
    const declared = modes.get(mode), programs = declared ? stringList(declared.programs, `${mode} programs`) : [], checked = declared ? stringList(declared.checked, `${mode} checked`) : [];
    const tool = declared ? optionalString(declared.tool, `${mode} tool`) : undefined;
    const total = requireFiniteNumber(count, `${mode} observations`), records = ledger.schema === 'cssearth-jwst-ledger@2'
      ? requireArray(object.records, 'JWST observation records').map(raw => requireRecord(raw, 'JWST observation record')).filter(record => record.mode === mode).map(record => ({
        id: requireString(record.id, 'JWST observation id'), programme: requireString(record.programme, 'JWST observation programme'), startIso: requireString(record.startIso, 'JWST observation start'),
        endIso: requireString(record.endIso, 'JWST observation end'), filter: requireString(record.filter, 'JWST observation filter') })) : [];
    const recordsComplete = ledger.schema === 'cssearth-jwst-ledger@2' && records.length === total;
    return { telescope: 'JWST', mode, archiveDate, observations: { count: total, scope: 'this-mode' as const, ...(records.length ? { records } : {}) },
      programmes: stringList(object.programmes, 'programmes'), dates: records.map(record => ({ id: record.id, startIso: record.startIso, endIso: record.endIso })),
      ...(recordsComplete ? { datesComplete: true } : {}),
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
    // The two capabilities arrive separately and stay separate: re-calibration in `checked`, the archive's own final products in
    // `archiveFinal`. A configuration whose pipeline is retired can hold the second and never the first.
    const archive = declared?.archiveFinal === undefined ? undefined : requireRecord(declared.archiveFinal, `${mode} archiveFinal`);
    return { telescope: 'Hubble', mode, archiveDate, observations: { count, scope: 'object-total' as const }, programmes: [], dates: [],
      toolkit: { ...(tool ? { tool } : {}), programs, checked, receipts: [],
        ...(archive === undefined ? {} : { archiveFinal: { programs: stringList(archive.programs, `${mode} archive-final programs`), qualified: stringList(archive.qualified, `${mode} archive-final qualified`) } }) } };
  });
}

/** NACO: each mode carries the state the route reached on it and the receipts behind it; each object carries the modes its
 * frames were taken in, its programmes, and one frame count for the whole object. */
function nacoModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'NACO ledger');
  if (ledger.schema !== 'cssearth-naco-ledger@2') throw new TypeError(`Unsupported NACO ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.measured, 'measured');
  const modes = new Map(requireArray(ledger.modes, 'modes').map(raw => { const entry = requireRecord(raw, 'mode'); return [requireString(entry.mode, 'mode'), entry] as const; }));
  const object = requireArray(ledger.objects, 'objects').map(raw => requireRecord(raw, 'object')).find(entry => entry.id === target);
  if (!object) return [];
  const frames = requireFiniteNumber(object.frames, 'frames');
  const records = requireArray(object.records, 'records').map(raw => { const record = requireRecord(raw, 'record');
    return { id: requireString(record.id, 'record id'), programme: requireString(record.programme, 'record programme'),
      archiveTarget: requireString(record.archiveTarget, 'record archiveTarget'), mode: requireString(record.mode, 'record mode'),
      night: requireString(record.night, 'record night'), startIso: requireString(record.startIso, 'record startIso'),
      endIso: requireString(record.endIso, 'record endIso') }; });
  return stringList(object.modes, 'modes').map(mode => {
    const declared = modes.get(mode), state = declared ? requireString(declared.state, `${mode} state`) : undefined;
    const programs = declared ? stringList(declared.programs, `${mode} programs`) : [], receipts = declared ? stringList(declared.receipts, `${mode} receipts`) : [];
    const modeRecords = records.filter(record => record.mode === mode);
    return { telescope: 'VLT/NACO', mode, archiveDate, observations: { count: frames, scope: 'object-total' as const, ...(modeRecords.length ? { records: modeRecords } : {}) }, programmes: stringList(object.programmes, 'programmes'),
      dates: modeRecords.map(record => ({ id: record.id, startIso: record.startIso, endIso: record.endIso })), datesComplete: true,
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

/** Spitzer: the ledger retains every archive AOR for a target, while toolkit programs remain a separate, smaller set. */
function spitzerModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'Spitzer ledger');
  if (ledger.schema !== 'cssearth-spitzer-ledger@4') throw new TypeError(`Unsupported Spitzer ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.archiveDate, 'archiveDate'), declared = new Map(requireArray(ledger.modes, 'modes').map(raw => {
    const entry = requireRecord(raw, 'mode'); return [requireString(entry.mode, 'mode'), entry] as const; }));
  const object = requireArray(ledger.holdings, 'holdings').map(raw => requireRecord(raw, 'holding')).find(entry => entry.object === target);
  if (!object) return [];
  const allRecords = requireArray(object.records, 'Spitzer observation records').map((raw, index) => { const record = requireRecord(raw, `Spitzer observation ${index}`);
    return { id: requireString(record.id, 'AORKEY'), programme: requireString(record.programme, 'programme'), mode: requireString(record.mode, 'mode'),
      title: requireString(record.title, 'title'), startIso: requireString(record.startIso, 'start'), ...(record.endIso === undefined ? {} : { endIso: requireString(record.endIso, 'end') }) }; });
  return Object.entries(requireRecord(object.modes, 'modes')).map(([mode, count]) => {
    const entry = declared.get(mode), tool = entry ? optionalString(entry.tool, `${mode} tool`) : undefined, records = allRecords.filter(record => record.mode === mode);
    const expected = requireFiniteNumber(count, `${mode} observations`);
    if (records.length !== expected) throw new Error(`Spitzer ${target} ${mode} counts ${expected} observations but retains ${records.length} records.`);
    const programs = entry ? stringList(entry.programs, `${mode} programs`) : [], checked = entry ? stringList(entry.checked, `${mode} checked programs`) : [];
    const targetPrograms = programs.filter(program => program === target || program.startsWith(`${target}-`));
    const receipts = entry ? stringList(entry.receipts, `${mode} receipts`).filter(path => targetPrograms.some(program => path.includes(`/${program}.`))) : [];
    return { telescope: 'Spitzer', mode, archiveDate, observations: { count: expected, scope: 'this-mode' as const,
      records: records.map(({ mode: _mode, ...record }) => record) }, programmes: [...new Set(records.map(record => record.programme))].sort(),
      dates: records.map(record => ({ id: record.id, startIso: record.startIso, endIso: record.endIso })), datesComplete: true,
      toolkit: { ...(tool ? { tool } : {}), programs, checked, receipts } };
  });
}

/** Gemini: object rows name the instruments that saw the target; the capability row says whether DRAGONS is usable and which
 * pinned programs have evidence. */
function geminiModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'Gemini ledger');
  if (ledger.schema !== 'cssearth-gemini-ledger@1') throw new TypeError(`Unsupported Gemini ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.measured, 'measured'), capabilities = new Map(requireArray(ledger.capabilities, 'capabilities').map(raw => {
    const entry = requireRecord(raw, 'capability'); return [requireString(entry.instrument, 'instrument'), entry] as const; }));
  const object = requireArray(ledger.objects, 'objects').map(raw => requireRecord(raw, 'object')).find(entry => entry.id === target);
  if (!object) return [];
  const count = requireFiniteNumber(object.science, 'science');
  return stringList(object.instruments, 'instruments').map(mode => {
    const entry = capabilities.get(mode), state = entry ? requireString(entry.state, `${mode} state`) : 'unsupported';
    const programs = entry ? stringList(entry.programs, `${mode} programs`) : [];
    const evidence = entry ? requireArray(entry.evidence, `${mode} evidence`).map(raw => requireRecord(raw, 'evidence')) : [];
    const receipts = evidence.map(item => requireString(item.receipt, 'receipt'));
    return { telescope: 'Gemini', mode, archiveDate, observations: { count, scope: 'object-total' as const }, programmes: [], dates: [],
      toolkit: { ...(state === 'unsupported' ? { routeState: 'refused', refusedBecause: entry ? requireString(entry.reason, `${mode} reason`) : 'No capability row.' }
        : { routeState: state, tool: 'tools/objects/gemini/reduce.mts' }), programs, checked: state === 'reduced' && receipts.length ? programs : [], receipts } };
  });
}

/** Keck: object rows carry exact frame counts per instrument; mode rows carry the installation and accepted receipts. */
function keckModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'Keck ledger');
  if (ledger.schema !== 'cssearth-keck-ledger@1') throw new TypeError(`Unsupported Keck ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.measured, 'measured'), modes = new Map(requireArray(ledger.modes, 'modes').map(raw => {
    const entry = requireRecord(raw, 'mode'); return [requireString(entry.instrument, 'instrument'), entry] as const; }));
  const object = requireArray(ledger.objects, 'objects').map(raw => requireRecord(raw, 'object')).find(entry => entry.id === target);
  if (!object) return [];
  return Object.entries(requireRecord(object.instruments, 'instruments')).map(([mode, count]) => {
    const entry = modes.get(mode), state = entry ? requireString(entry.state, `${mode} state`) : 'held, not reducible';
    const programs = entry ? stringList(entry.programs, `${mode} programs`).map(name => name.replace(/\.json$/u, '')) : [], receipts = entry ? stringList(entry.receipts, `${mode} receipts`) : [];
    const reduced = state === 'reduced';
    return { telescope: 'Keck', mode, archiveDate, observations: { count: requireFiniteNumber(count, `${mode} frames`), scope: 'this-mode' as const }, programmes: [], dates: [],
      toolkit: { ...(reduced ? { routeState: state, tool: 'tools/objects/keck/reduce.mts' }
        : { routeState: 'refused', refusedBecause: entry ? requireString(entry.reason, `${mode} reason`) : 'No mode row.' }),
        programs, checked: reduced && receipts.length ? programs : [], receipts } };
  });
}

/** IHW/PDS: one target-specific, complete observation index and archive-final products whose bytes were qualified here. */
function ihwModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'IHW ledger');
  if (ledger.schema !== 'cssearth-ihw-ledger@1') throw new TypeError(`Unsupported IHW ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.archiveDate, 'archiveDate');
  const object = requireArray(ledger.objects, 'objects').map(raw => requireRecord(raw, 'object')).find(entry => entry.id === target);
  if (!object) return [];
  const observations = requireArray(object.observations, 'IHW observations').map((raw, index) => {
    const row = requireRecord(raw, `IHW observation ${index}`), exposure = requireFiniteNumber(row.exposureSeconds, 'exposure seconds');
    const midpoint = Date.parse(requireString(row.observationTimeIso, 'observation time'));
    return { id: requireString(row.id, 'product id'), programme: requireString(row.archiveObservationId, 'archive observation id'), startIso: new Date(midpoint - exposure * 500).toISOString(),
      endIso: new Date(midpoint + exposure * 500).toISOString(), title: `IHW ${requireString(row.filter, 'filter')}`,
      filter: requireString(row.filter, 'filter'), pixelScaleArcsec: requireFiniteNumber(row.pixelScaleArcsec, 'pixel scale'), quality: requireString(row.quality, 'quality'),
      observatory: requireString(row.observatory, 'observatory'), instrument: `${requireString(row.instrument, 'telescope')} / ${requireString(row.detector, 'detector')}` };
  });
  return requireArray(ledger.modes, 'modes').map(raw => {
    const mode = requireRecord(raw, 'IHW mode'), name = requireString(mode.mode, 'mode'), archive = requireRecord(mode.archiveFinal, 'archiveFinal');
    return { telescope: 'IHW/PDS', mode: name, archiveDate, observations: { count: observations.length, scope: 'this-mode' as const, records: observations },
      programmes: [requireString(requireRecord(ledger.dataset, 'dataset').id, 'dataset id')], dates: observations.map(row => ({ id: row.id, startIso: row.startIso, endIso: row.endIso })), datesComplete: true,
      toolkit: { programs: stringList(mode.programs, `${name} programs`), checked: stringList(mode.checked, `${name} checked`), receipts: stringList(mode.receipts, `${name} receipts`),
        archiveFinal: { programs: stringList(archive.programs, `${name} archive-final programs`), qualified: stringList(archive.qualified, `${name} archive-final qualified`) } } };
  });
}

/** Peppi discovers exact PDS4 products; pdr qualifies the complete file set. Each program remains archive-final. */
function pdsModes(value: unknown, target: string): TargetMode[] {
  const ledger = requireRecord(value, 'PDS ledger');
  if (ledger.schema !== 'cssearth-pds-ledger@1') throw new TypeError(`Unsupported PDS ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.archiveDate, 'archiveDate'), object = requireArray(ledger.objects, 'objects').map(raw => requireRecord(raw, 'PDS object')).find(entry => entry.id === target);
  if (!object) return [];
  const all = requireArray(object.observations, 'PDS observations').map(raw => { const row = requireRecord(raw, 'PDS observation'), range = requireArray(row.wavelengthIntervalMicrometres, 'PDS wavelength interval');
    if (range.length !== 2) throw new TypeError('PDS observation wavelength interval has two bounds.');
    return { id: requireString(row.id, 'PDS observation id'), programme: requireString(row.program, 'PDS program'), startIso: requireString(row.startIso, 'PDS start'),
      endIso: requireString(row.endIso, 'PDS end'), filter: requireString(row.filter, 'PDS filter'), archiveTarget: requireString(row.targetName, 'PDS target name'),
      targetLid: requireString(row.targetLid, 'PDS target lid'), productLidvid: requireString(row.lidvid, 'PDS lidvid'), instrument: requireString(row.instrument, 'PDS instrument'),
      telescope: requireString(row.telescope, 'PDS telescope'), mode: requireString(row.mode, 'PDS mode'),
      wavelengthIntervalMicrometres: [requireFiniteNumber(range[0], 'PDS wavelength start'), requireFiniteNumber(range[1], 'PDS wavelength end')] as const }; });
  return requireArray(ledger.modes, 'PDS modes').map(raw => { const declared = requireRecord(raw, 'PDS mode'), telescope = requireString(declared.telescope, 'PDS telescope'), mode = requireString(declared.mode, 'PDS mode');
    const records = all.filter(record => record.telescope === telescope && record.mode === mode), programs = stringList(declared.programs, 'PDS programs'), qualified = stringList(declared.qualified, 'PDS qualified');
    return { telescope, mode, archiveDate, observations: { count: records.length, scope: 'this-mode' as const, records }, programmes: records.map(record => record.productLidvid),
      dates: records.map(record => ({ id: record.id, startIso: record.startIso, endIso: record.endIso })), datesComplete: true,
      toolkit: { tool: 'pds.peppi + pdr', programs, checked: [], receipts: stringList(declared.receipts, 'PDS receipts'), archiveFinal: { programs, qualified } } }; });
}

const ADAPTERS: Readonly<Record<string, (value: unknown, target: string) => TargetMode[]>> = Object.freeze({ jwst: jwstModes, hst: hstModes, naco: nacoModes, chandra: chandraModes, juno: junoModes,
  spitzer: spitzerModes, gemini: geminiModes, keck: keckModes, ihw: ihwModes, pds: pdsModes });

function targetCoverage(telescope: string, ledgerPath: string, value: unknown, target: string, modes: readonly TargetMode[]): TargetCoverage {
  if (modes.length) return { telescope, ledger: ledgerPath, state: 'observed', reason: `The ledger indexes ${modes.length} mode(s) for ${target}.` };
  const ledger = requireRecord(value, `${telescope} ledger`);
  if (telescope === 'spitzer') {
    const skipped = (ledger.notAsked === undefined ? [] : requireArray(ledger.notAsked, 'notAsked')).map(raw => requireRecord(raw, 'notAsked target')).find(entry => entry.object === target);
    if (skipped) return { telescope, ledger: ledgerPath, state: 'not-searched', reason: requireString(skipped.reason, 'notAsked reason') };
    if ((ledger.unanswered === undefined ? [] : stringList(ledger.unanswered, 'unanswered')).includes(target)) return { telescope, ledger: ledgerPath, state: 'unanswered', reason: 'The archive query was attempted but returned no usable answer.' };
    if ((ledger.searched === undefined ? [] : stringList(ledger.searched, 'searched')).includes(target))
      return { telescope, ledger: ledgerPath, state: 'searched-empty', reason: `The complete Spitzer search set includes ${target} and returned no observation.` };
    return { telescope, ledger: ledgerPath, state: 'not-searched', reason: `This Spitzer snapshot carries no completed search for ${target}.` };
  }
  if (telescope === 'hst' && (ledger.unansweredTargets === undefined ? [] : stringList(ledger.unansweredTargets, 'unansweredTargets')).includes(target))
    return { telescope, ledger: ledgerPath, state: 'unanswered', reason: 'The MAST target query was attempted but returned no usable answer.' };
  if (telescope === 'ihw') return { telescope, ledger: ledgerPath, state: 'not-searched', reason: 'This IHW dataset is a target-specific Halley collection; it is not a search of other targets.' };
  if (telescope === 'pds') return { telescope, ledger: ledgerPath, state: 'not-searched', reason: 'This ledger retains exact Peppi selections, not a complete registry search for every catalogue target.' };
  return { telescope, ledger: ledgerPath, state: 'not-searched', reason: `This ledger does not preserve an explicit searched-empty result for ${target}, so absence cannot support a scientific no.` };
}

/** Every mode key the ledgers use, so `modes.json` can be tied to them and cannot drift. */
export function ledgerModeKeys(ledgers: QueryInputs['ledgers']): { readonly telescope: string; readonly mode: string }[] {
  const keys = new Map<string, { telescope: string; mode: string }>();
  for (const { telescope, value } of ledgers) {
    const ledger = requireRecord(value, `${telescope} ledger`);
    const add = (name: string, mode: string) => keys.set(`${name} :: ${mode}`, { telescope: name, mode });
    if (telescope === 'jwst') for (const raw of requireArray(ledger.modes, 'modes')) add('JWST', requireString(requireRecord(raw, 'mode').mode, 'mode'));
    if (telescope === 'hst') for (const raw of requireArray(ledger.configurations, 'configurations')) add('Hubble', requireString(requireRecord(raw, 'configuration').configuration, 'configuration'));
    if (telescope === 'naco') for (const raw of requireArray(ledger.modes, 'modes')) add('VLT/NACO', requireString(requireRecord(raw, 'mode').mode, 'mode'));
    if (telescope === 'chandra') for (const detector of Object.keys(requireRecord(requireRecord(ledger.archive, 'archive').byInstrument, 'byInstrument'))) add('Chandra', detector);
    if (telescope === 'juno') add('Juno', 'JUNOCAM');
    if (telescope === 'spitzer') for (const raw of requireArray(ledger.modes, 'modes')) add('Spitzer', requireString(requireRecord(raw, 'mode').mode, 'mode'));
    if (telescope === 'gemini') for (const raw of requireArray(ledger.capabilities, 'capabilities')) add('Gemini', requireString(requireRecord(raw, 'capability').instrument, 'instrument'));
    if (telescope === 'keck') for (const raw of requireArray(ledger.modes, 'modes')) add('Keck', requireString(requireRecord(raw, 'mode').instrument, 'instrument'));
    if (telescope === 'ihw') for (const raw of requireArray(ledger.modes, 'modes')) add('IHW/PDS', requireString(requireRecord(raw, 'mode').mode, 'mode'));
    if (telescope === 'pds') for (const raw of requireArray(ledger.modes, 'modes')) { const entry = requireRecord(raw, 'PDS mode'); add(requireString(entry.telescope, 'PDS telescope'), requireString(entry.mode, 'PDS mode')); }
  }
  return [...keys.values()].sort((a, b) => `${a.telescope}${a.mode}` < `${b.telescope}${b.mode}` ? -1 : 1);
}

const verdict = (answer: ConstraintAnswer, reason: string): ConstraintVerdict => ({ answer, reason });
const round = (value: number): number => Number(value.toPrecision(3));
const NO_CAPABILITIES = 'Capabilities not recorded: modes.json has no sourced entry for this mode, so nothing here states what it can do.';
const BODY_MAP_AUTHORS: Readonly<Record<string, string>> = Object.freeze({
  'JWST :: NIRSPEC/IFU': 'tools/objects/jwst/cubes/author-body-maps.mts',
  'JWST :: MIRI/IFU': 'tools/objects/jwst/cubes/author-body-maps.mts',
  'Hubble :: STIS/CCD': 'tools/objects/hst/slit-scan-map.mts',
  'VLT/NACO :: imaging': 'tools/objects/naco/author-body-map.mts',
});

const bodyMapSupport = (mode: TargetMode): Candidate['bodyMapSupport'] => {
  const author = BODY_MAP_AUTHORS[`${mode.telescope} :: ${mode.mode}`];
  return author ? { answer: 'yes', author, reason: `${author} authors this mode into the shared body-map contract.` }
    : { answer: 'no', reason: `No body-map author is registered for ${mode.telescope} ${mode.mode}; its toolkit may still produce a valid telescope product.` };
};

/** Two different facts about one mode at the requested wavelengths, kept apart because they answer different questions.
 *
 * `instrument` is what the optics resolve: the diffraction limit of the aperture, or a point spread function the
 * documentation states where diffraction says nothing useful. It can support a definite no.
 * `sampling` is how finely the detector cuts that image up, two pixels. Coarse sampling is not a resolution limit: dithering,
 * subpixel positioning and event centroiding recover part of it, and whether an observation did is not in any ledger. So
 * sampling alone never supports a no; it turns an answer into unknown. */
export interface ResolutionFacts {
  readonly shortestMicrometres: number;
  readonly instrument: { readonly arcsec: number; readonly basis: string } | null;
  readonly sampling: { readonly arcsec: number; readonly basis: string } | null;
}

export function resolutionFacts(request: CapabilityRequest, capability: ModeCapability): ResolutionFacts | null {
  const parts = capability.wavelengthIntervals === undefined ? [] : intersectIntervals(capability.wavelengthIntervals, request.wavelengthMicrometres);
  if (capability.wavelengthIntervals !== undefined && !parts.length) return null;
  const shortest = parts.length ? Math.min(...parts.map(part => part[0])) : request.wavelengthMicrometres[0];
  const diffraction = capability.apertureMetres === undefined ? null
    : { arcsec: 1.22 * shortest * 1e-6 / capability.apertureMetres * ARCSEC_PER_RADIAN, basis: `1.22 lambda / D at ${round(shortest)} micrometres on ${capability.apertureMetres} m` };
  const stated = capability.instrumentResolution;
  return { shortestMicrometres: shortest,
    instrument: stated ? { arcsec: stated.arcsec, basis: `${stated.basis} (${stated.citation})` } : diffraction,
    sampling: capability.pixelScaleArcsec === undefined ? null : { arcsec: 2 * capability.pixelScaleArcsec, basis: `two ${capability.pixelScaleArcsec} arcsec detector pixels` } };
}

/** One rule for every sharpness question. The caller's wish is turned into the arcsec a resolution element may span, and
 * `describe` renders a figure in that question's own units. */
function sharpnessVerdict(facts: ResolutionFacts, askArcsec: number | undefined, describe: (arcsec: number) => string, asked: string, target: string): ConstraintVerdict {
  const optics = facts.instrument ? `the optics cannot resolve better than ${describe(facts.instrument.arcsec)} (${facts.instrument.basis})` : 'what the optics resolve is not recorded for this mode';
  const detector = facts.sampling ? `the detector samples at ${describe(facts.sampling.arcsec)} (${facts.sampling.basis})` : 'no pixel scale is recorded';
  const recovered = 'Dithering, subpixel positioning and event centroiding recover part of what pixels lose, and no ledger says whether any observation did.';
  if (askArcsec === undefined) return verdict('unknown', `Nothing was asked for here. As facts: ${optics}, and ${detector}.`);
  if (facts.instrument && facts.instrument.arcsec > askArcsec) return verdict('no', `${optics[0]!.toUpperCase()}${optics.slice(1)}, which is coarser than the ${asked} asked for. ${detector[0]!.toUpperCase()}${detector.slice(1)}.`);
  if (facts.sampling && facts.sampling.arcsec > askArcsec) return verdict('unknown', `${optics[0]!.toUpperCase()}${optics.slice(1)}, which meets the ${asked} asked for, but ${detector}. ${recovered}`);
  if (!facts.instrument) return verdict('unknown', `${detector[0]!.toUpperCase()}${detector.slice(1)}, which meets the ${asked} asked for, but ${optics}, so nothing here rules the mode in or out.`);
  if (facts.instrument) return verdict('partial', `Possible: ${optics}, and ${detector}, both within the ${asked} asked for. What any observation of ${target} reached is not in the ledger.`);
  return verdict('unknown', 'Nothing is recorded about this mode\'s sharpness.');
}

function constraintVerdicts(request: CapabilityRequest, mode: TargetMode, capability: ModeCapability | undefined): Record<string, ConstraintVerdict> {
  const [from, to] = request.wavelengthMicrometres;
  const requestedTime = request.time;
  const facts = capability ? resolutionFacts(request, capability) : null;
  const inside = capability?.wavelengthIntervals ? intersectIntervals(capability.wavelengthIntervals, request.wavelengthMicrometres) : [];
  const width = to - from, covered = inside.reduce((sum, [start, end]) => sum + (end - start), 0);
  const noOverlap = 'The mode covers none of the requested wavelengths, so there is nothing to state about them.';
  const verdicts: Record<string, ConstraintVerdict> = {
    wavelength: !capability ? verdict('unknown', NO_CAPABILITIES)
      : !capability.wavelengthIntervals ? verdict('unknown', `No sourced wavelength coverage is recorded for ${mode.telescope} ${mode.mode}.`)
      : !inside.length ? verdict('no', `The mode covers ${intervalWords(capability.wavelengthIntervals)} micrometres; ${from} to ${to} falls outside every one of them.`)
      : covered >= width - 1e-9 ? verdict('yes', `The mode covers ${intervalWords(capability.wavelengthIntervals)} micrometres, which contains ${from} to ${to}.`)
      : verdict('partial', `The mode covers ${intervalWords(capability.wavelengthIntervals)} micrometres, so only ${intervalWords(inside.map(([start, end]) => [round(start), round(end)] as const))} of the request is inside it.`),
    angularResolution: !capability ? verdict('unknown', NO_CAPABILITIES) : !facts ? verdict('unknown', noOverlap)
      : sharpnessVerdict(facts, request.angularResolutionArcsec, arcsec => `${round(arcsec)} arcsec`, `${request.angularResolutionArcsec} arcsec`, request.target),
    time: !requestedTime ? verdict('unknown', 'No time requirement was stated.')
      : 'any' in requestedTime ? verdict('yes', 'The request explicitly accepts observations from any time.')
      : !mode.dates.length ? verdict('unknown', 'This ledger carries no dates for this target and mode.')
      : (() => {
          const dated = mode.dates.filter(date => (date.endIso ?? date.startIso) >= requestedTime.fromIso && date.startIso <= requestedTime.toIso);
          if (dated.length) return verdict('yes', `The ledger names ${dated.length} observation(s) overlapping the range: ${dated.slice(0, 8).map(date => `${date.id} on ${date.startIso.slice(0, 10)}`).join(', ')}${dated.length > 8 ? `, and ${dated.length - 8} more` : ''}.`);
          const outside = `${mode.dates.length} observation(s) of this target and mode fall outside the range${mode.dates.length ? ` (${mode.dates.slice(0, 8).map(date => date.startIso.slice(0, 10)).join(', ')}${mode.dates.length > 8 ? `, and ${mode.dates.length - 8} more` : ''})` : ''}`;
          return mode.datesComplete ? verdict('no', `The ledger retains every observation identity and time; all ${outside}.`)
            : verdict('partial', `The ledger dates ${outside}; it does not date the rest.`);
        })(),
    kind: !capability ? verdict('unknown', NO_CAPABILITIES)
      : !request.kind ? verdict('unknown', `No product kind was asked for. This mode produces ${capability.kinds.join(', ')}.`)
      : capability.kinds.includes(request.kind) ? verdict('yes', `This mode produces ${capability.kinds.join(', ')}.`)
      : verdict('no', `This mode produces ${capability.kinds.join(', ')}, not ${request.kind}.`) };
  const kmOf = (arcsec: number) => surfaceResolutionKm({ rangeKm: request.rangeKm!, angularResolution: { majorArcsec: arcsec, minorArcsec: arcsec, basis: 'from the mode' } }).majorKm;
  if (request.surfaceResolutionKm !== undefined) verdicts.surfaceResolution = !capability ? verdict('unknown', NO_CAPABILITIES)
    : request.rangeKm === undefined ? verdict('unknown', 'Unknown: kilometres on the ground need the range to the body, which the caller gives.')
    : !facts ? verdict('unknown', noOverlap)
    : sharpnessVerdict(facts, request.surfaceResolutionKm / request.rangeKm * ARCSEC_PER_RADIAN, arcsec => `${round(kmOf(arcsec))} km at the sub-observer point`, `${request.surfaceResolutionKm} km`, request.target);
  if (request.resolutionElements !== undefined) verdicts.resolutionElements = !capability ? verdict('unknown', NO_CAPABILITIES)
    : request.rangeKm === undefined || request.bodyRadiusKm === undefined ? verdict('unknown', 'Unknown: elements across the disc need the range to the body and its radius, which the caller gives.')
    : !facts ? verdict('unknown', noOverlap)
    : sharpnessVerdict(facts, 2 * request.bodyRadiusKm / request.resolutionElements / request.rangeKm * ARCSEC_PER_RADIAN,
      arcsec => `${round(resolutionElementsAcrossDisc({ rangeKm: request.rangeKm!, angularResolution: { majorArcsec: arcsec, minorArcsec: arcsec, basis: 'from the mode' } }, request.bodyRadiusKm!))} elements across the disc`,
      `${request.resolutionElements} elements`, request.target);
  return verdicts;
}

function toolkitSupport(mode: TargetMode, target: string): ToolkitSupport {
  const { tool, routeState, refusedBecause, programs, checked, archiveFinal } = mode.toolkit;
  const qualified = archiveFinal?.qualified ?? [];
  const pinned = forTarget(programs, target), passed = forTarget(checked, target), held = forTarget(qualified, target);
  // Re-calibrated and checked outranks archive-final, which outranks a tool nothing has been run through. They are never added
  // together: a mode reaches `archive-final` by having the observatory's own product read here, not by half-reproducing it.
  const level: ToolkitLevel = checked.length ? 'proven' : qualified.length ? 'archive-final'
    : tool || (routeState && routeState !== 'refused') ? 'tool-without-checked-program' : 'none';
  const named = tool ? level === 'archive-final' ? `${tool} retrieves and decodes this mode without recalibrating it` : `${tool} reduces this mode`
    : routeState ? `the route reached the state "${routeState}" on this mode` : 'no tool for this mode is named in the ledger';
  const archiveSaid = `${qualified.length} archive-final program(s) are qualified: ${qualified.join(', ')}. The archive's own final products were pinned, downloaded and read whole, which establishes those bytes and not a re-calibration here. ${held.length ? `${held.join(', ')} is a program of ${target}.` : `None of them is a program of ${target}.`}`;
  const sentence = (text: string) => /[.!?]$/u.test(text) ? text : `${text}.`;
  const reason = level === 'none' ? sentence(refusedBecause ?? `${named}, and no program of it is checked`)
    : level === 'proven' ? `${named}, and ${checked.length} program(s) have a checked receipt: ${checked.join(', ')}. ${passed.length ? `${passed.join(', ')} is a program of ${target}.` : `None of them is a program of ${target}.`}${qualified.length ? ` Separately, ${archiveSaid}` : ''}`
    : level === 'archive-final' ? `Nothing here re-calibrates this mode: ${named}. ${archiveSaid}`
    : `${named}, but no program of it has a checked receipt yet.`;
  const productionMethod = level === 'proven' ? 'local-pipeline' : level === 'archive-final' ? 'archive-final' : level === 'tool-without-checked-program' ? 'tool-available' : 'none';
  const evidenceBasis = level === 'proven' ? 'accepted-route-receipts' : level === 'archive-final' ? 'archive-origin' : 'none';
  const acceptanceCriterion = level === 'proven' ? 'receipt-valid-for-pinned-program' : level === 'archive-final' ? 'archive-bytes-qualified' : 'none';
  return { level, reason, productionMethod, evidenceBasis, acceptanceCriterion, ...(tool ? { tool } : {}), programs, checked, archiveFinalQualified: qualified,
    targetProgramPinned: pinned.length > 0, targetProgramChecked: passed.length > 0, targetArchiveFinalQualified: held.length > 0 };
}

interface AttachedEvidence { bodyMaps: MeasuredResolution[]; investigations: { id: string; status: string; subject: string }[] }

/** The names a record may call a telescope, and the ledger telescope each one is. Evidence reaches a candidate only through
 * this table and an exact mode key, because a detector name that merely looks similar is a different instrument: a Hubble
 * STIS/CCD map says nothing about STIS/FUV-MAMA, which sees other wavelengths at another sampling. */
const TELESCOPE_NAMES: Readonly<Record<string, string>> = Object.freeze({ JWST: 'JWST', 'JAMES WEBB SPACE TELESCOPE': 'JWST', HST: 'Hubble', HUBBLE: 'Hubble',
  'HUBBLE SPACE TELESCOPE': 'Hubble', NACO: 'VLT/NACO', 'NAOS+CONICA': 'VLT/NACO', 'VLT/NACO': 'VLT/NACO', CHANDRA: 'Chandra', CXO: 'Chandra', JUNO: 'Juno', JUNOCAM: 'Juno',
  SPITZER: 'Spitzer', GEMINI: 'Gemini', KECK: 'Keck' });

/** The one mode a telescope and an instrument name identify, or the modes they could mean. Equality on the ledger's own mode
 * key is the rule; anything else is left unassigned. */
export function resolveMode(telescope: string, instrument: string, modes: readonly TargetMode[]): { readonly mode?: TargetMode; readonly couldMean: readonly string[] } {
  const named = TELESCOPE_NAMES[telescope.trim().toUpperCase()];
  if (!named) return { couldMean: [] };
  const ours = modes.filter(mode => mode.telescope === named);
  const exact = ours.filter(mode => mode.mode.toUpperCase() === instrument.trim().toUpperCase());
  return exact.length === 1 ? { mode: exact[0]!, couldMean: [`${named} ${exact[0]!.mode}`] } : { couldMean: ours.map(mode => `${named} ${mode.mode}`) };
}

/** Body maps and investigation entries, each attached to the one mode it names, or set aside. */
function resolveEvidence(inputs: QueryInputs, modes: readonly TargetMode[]): { readonly attached: Map<TargetMode, AttachedEvidence>; readonly unassigned: UnassignedEvidence[] } {
  const attached = new Map<TargetMode, AttachedEvidence>(modes.map(mode => [mode, { bodyMaps: [], investigations: [] }]));
  const unassigned: UnassignedEvidence[] = [];
  for (const { path, value } of inputs.bodyMaps) {
    const map = parseBodyMapProduct(value);
    for (const observation of map.observations) {
      const namedMode = observation.mode ?? observation.instrument;
      const { mode, couldMean } = resolveMode(observation.telescope, namedMode, modes);
      const identity = `${observation.telescope} ${observation.instrument}, observation ${observation.id}`;
      if (!mode) { unassigned.push({ kind: 'body-map', source: path, identity, couldMean,
        reason: couldMean.length ? `${namedMode} is not one of this telescope's ledger mode keys, so which mode measured this is not stated.` : `Nothing here knows the telescope ${observation.telescope}.` }); continue; }
      attached.get(mode)!.bodyMaps.push({ path, quantity: `${map.definition.quantity} (${map.definition.units})`, observation: observation.id,
        ...(observation.programme === undefined ? {} : { programme: observation.programme }),
        angularResolutionArcsec: observation.angularResolution.majorArcsec, surfaceResolutionKm: round(surfaceResolutionKm(observation).majorKm) });
    }
  }
  if (inputs.investigations) {
    const ledger = requireRecord(inputs.investigations.value, 'investigation ledger');
    for (const raw of requireArray(ledger.entries, 'entries')) {
      const entry = requireRecord(raw, 'entry'), id = requireString(entry.id, 'id'), status = requireString(entry.status, 'status'), subject = requireString(entry.subject, 'subject');
      const text = `${subject} ${requireString(entry.finding, 'finding')}`.toUpperCase();
      const named = modes.filter(mode => text.includes(mode.mode.toUpperCase()));
      if (named.length === 1) { attached.get(named[0]!)!.investigations.push({ id, status, subject }); continue; }
      const telescopes = [...new Set(Object.entries(TELESCOPE_NAMES).filter(([name]) => text.includes(name)).map(([, ledgerName]) => ledgerName))];
      const couldMean = named.length > 1 ? named.map(mode => `${mode.telescope} ${mode.mode}`) : modes.filter(mode => telescopes.includes(mode.telescope)).map(mode => `${mode.telescope} ${mode.mode}`);
      if (couldMean.length) unassigned.push({ kind: 'investigation', source: inputs.investigations.path, identity: `${id}: ${subject}`, couldMean,
        reason: 'The entry names a telescope but no one mode key, so it is evidence about the telescope rather than about any one of its modes.' });
    }
  }
  return { attached, unassigned };
}

const UNKNOWN_UNTIL_READ = (target: string, mode: TargetMode): string[] => [
  `Whether any exposure of ${target} saturates, or is too faint, at the requested wavelengths.`,
  'Which wavelengths of the mode a given exposure actually used, and how much of its coverage is usable in it.',
  'The resolution a given observation reached: the ledger holds none, and the figures above are what the optics and the pixels allow, not what was achieved.',
  ...(mode.observations?.records?.length && mode.observations.records.every(record => record.filter) ? []
    : ['Which filter, grating or channel a given exposure used: a mode reaches its wavelengths through discrete elements, and a request can fall between them.']),
  `Where ${target} was pointed and lit: the sub-observer and sub-solar points, and the time of day on the ground.`,
  `Whether ${target} was resolved at all in a given exposure, and how much of it the field of view held.`];

export function queryCapabilities(request: CapabilityRequest, inputs: QueryInputs): CapabilityAnswer {
  if (!(request.wavelengthMicrometres[0] > 0 && request.wavelengthMicrometres[1] >= request.wavelengthMicrometres[0])) throw new RangeError('A request states its wavelengths in micrometres, shortest first.');
  if (request.kind && !(PRODUCT_KINDS as readonly string[]).includes(request.kind)) throw new TypeError(`Unknown product kind ${request.kind}.`);
  if (request.result && !(REQUESTED_RESULTS as readonly string[]).includes(request.result)) throw new TypeError(`Unknown requested result ${request.result}.`);
  const targetResolution = resolveTarget(request.target, inputs.targetCatalogue);
  if (targetResolution.status === 'unknown') return { target: request.target, request, targetResolution, candidates: [], unassignedEvidence: [], targetCoverage: [], withoutTheTarget: [],
    endpoint: { status: 'unknown-target', selectableCandidates: 0, blockerCodes: ['unknown-target'] } };
  const target = targetResolution.canonical.id, canonicalRequest: CapabilityRequest = { ...request, target };
  const capabilities = new Map(inputs.capabilities.map(entry => [`${entry.telescope} :: ${entry.mode}`, entry] as const));
  const targetCoverageResults: TargetCoverage[] = [], found: { ledger: string; mode: TargetMode }[] = [];
  for (const ledger of inputs.ledgers) {
    const adapter = ADAPTERS[ledger.telescope];
    if (!adapter) throw new TypeError(`No adapter reads the ${ledger.telescope} ledger.`);
    const modes = adapter(ledger.value, target);
    targetCoverageResults.push(targetCoverage(ledger.telescope, ledger.path, ledger.value, target, modes));
    if (!modes.length) continue;
    for (const mode of modes) found.push({ ledger: ledger.path, mode });
  }
  const { attached, unassigned } = resolveEvidence(inputs, found.map(entry => entry.mode));
  const candidates = found.map(({ ledger, mode }): Omit<Candidate, 'selectionAssessment'> => {
    const capability = capabilities.get(`${mode.telescope} :: ${mode.mode}`), evidence = attached.get(mode)!;
    return { telescope: mode.telescope, mode: mode.mode, observations: mode.observations, programmes: mode.programmes,
      meetsConstraints: constraintVerdicts(canonicalRequest, mode, capability), toolkitSupport: toolkitSupport(mode, target), bodyMapSupport: bodyMapSupport(mode),
      evidence: { ledger, archiveDate: mode.archiveDate, receipts: mode.toolkit.receipts, bodyMaps: evidence.bodyMaps, investigations: evidence.investigations },
      unknown: [...(capability ? [] : [`What this mode can do: ${NO_CAPABILITIES}`]), ...UNKNOWN_UNTIL_READ(target, mode),
        ...(evidence.bodyMaps.length ? [] : [`Whether anything here has ever measured ${target} in this mode: no body map beside the object names it.`])] };
  });
  const rank = (candidate: Candidate) => candidate.meetsConstraints.wavelength?.answer === 'yes' ? 0 : candidate.meetsConstraints.wavelength?.answer === 'partial' ? 1 : 2;
  const assessed: Candidate[] = candidates.map(candidate => ({ ...candidate, selectionAssessment: workflowAssessment(canonicalRequest, target, candidate) }));
  assessed.sort((a, b) => rank(a) - rank(b) || (`${a.telescope}${a.mode}` < `${b.telescope}${b.mode}` ? -1 : 1));
  const selectableCandidates = assessed.filter(candidate => candidate.selectionAssessment.selectable).length;
  const incompleteIndex = !assessed.length && targetCoverageResults.some(entry => entry.state === 'not-searched' || entry.state === 'unanswered');
  const status = missingRequestFields(canonicalRequest).length ? 'request-incomplete' : selectableCandidates ? 'selectable-candidates' : incompleteIndex ? 'index-incomplete' : 'no-selectable-candidate';
  const coverageBlockers = !assessed.length ? targetCoverageResults.flatMap(entry => entry.state === 'not-searched' ? ['target-index-unavailable' as const]
    : entry.state === 'unanswered' ? ['archive-query-unanswered' as const] : []) : [];
  const withoutTheTarget = targetCoverageResults.filter(entry => entry.state === 'searched-empty').map(({ telescope, ledger, reason }) => ({ telescope, ledger, reason }));
  return { target, request: canonicalRequest, targetResolution, unassignedEvidence: unassigned, targetCoverage: targetCoverageResults, withoutTheTarget, candidates: assessed,
    endpoint: { status, selectableCandidates, blockerCodes: [...new Set([...coverageBlockers, ...assessed.flatMap(candidate => candidate.selectionAssessment.blockers.map(blocker => blocker.code))])] } };
}

/** Every reason an explicit selection cannot run, returned together so a caller does not repair one field only to discover
 * the next refusal. */
export function assessObservationSelection(answer: CapabilityAnswer, telescope: string, mode: string, programme: string): SelectionAssessment {
  const request = answer.request;
  const missing = missingRequestFields(request);
  const matches = answer.candidates.filter(candidate => candidate.telescope === telescope && candidate.mode === mode);
  const blockers: SelectionBlocker[] = missing.map(reason => ({ code: 'incomplete-request', reason: `The request is missing ${reason}.` }));
  if (matches.length !== 1) return { blockers: [...blockers, { code: 'candidate', reason: matches.length ? `${telescope} ${mode} is ambiguous.` : `${telescope} ${mode} is not a candidate for ${answer.target}.` }] };
  const candidate = matches[0]!;
  for (const [constraint, verdict_] of Object.entries(candidate.meetsConstraints)) if (verdict_.answer === 'no')
    blockers.push({ code: 'constraint', constraint, reason: `${telescope} ${mode} cannot answer this request: ${constraint}: ${verdict_.reason}` });
  if (candidate.toolkitSupport.level === 'none') blockers.push({ code: 'toolkit', reason: `${telescope} ${mode} has no usable toolkit: ${candidate.toolkitSupport.reason}` });
  if (request.result === 'body-map' && candidate.bodyMapSupport.answer === 'no') blockers.push({ code: 'body-map', reason: `${telescope} ${mode} cannot produce the requested body map: ${candidate.bodyMapSupport.reason}` });
  const targetPrograms = [...candidate.toolkitSupport.programs, ...candidate.toolkitSupport.archiveFinalQualified]
    .filter(value => value === answer.target || value.startsWith(`${answer.target}-`));
  if (!targetPrograms.includes(programme)) blockers.push({ code: 'programme', reason: `${programme} is not a pinned or archive-final program of ${answer.target} in ${telescope} ${mode}; ${targetPrograms.length ? `choose one of ${targetPrograms.join(', ')}` : 'no pinned or archive-final program is available'}.` });
  return { candidate, blockers };
}

/** Select one runnable, pinned program from a capability answer. Partial and unknown facts are retained on the selection so
 * the reducer and publisher cannot turn them into claims the query never made. */
export function selectObservation(answer: CapabilityAnswer, telescope: string, mode: string, programme: string): ObservationSelection {
  const assessment = assessObservationSelection(answer, telescope, mode, programme);
  if (assessment.blockers.length) throw new ObservationSelectionError(telescope, mode, programme, assessment.blockers);
  const request = answer.request, candidate = assessment.candidate!;
  const productWavelengthQualified = candidate.observations?.records?.some(record => record.programme === programme
    && record.wavelengthIntervalMicrometres !== undefined
    && record.wavelengthIntervalMicrometres[0] <= request.wavelengthMicrometres[0]
    && record.wavelengthIntervalMicrometres[1] >= request.wavelengthMicrometres[1]) ?? false;
  const unresolved = [...Object.entries(candidate.meetsConstraints).flatMap(([constraint, verdict_]) => verdict_.answer === 'partial' || verdict_.answer === 'unknown'
    ? [{ constraint, answer: verdict_.answer, reason: verdict_.reason } as const] : []),
    ...(productWavelengthQualified ? [] : [{ constraint: 'observationWavelength', answer: 'unknown' as const,
      reason: `The wavelength verdict is for ${telescope} ${mode}, not for program ${programme}; its selected filter, grating or channel must be qualified from the observation products.` }])];
  return { schema: OBSERVATION_SELECTION_SCHEMA, request, telescope, mode, programme,
    toolkitLevel: candidate.toolkitSupport.level, constraints: candidate.meetsConstraints, bodyMapSupport: candidate.bodyMapSupport, unresolved, evidence: candidate.evidence };
}

export const LEDGER_TELESCOPES: readonly string[] = Object.keys(ADAPTERS);

/** Read everything the query needs from the repository. The query itself reads nothing. */
export async function loadQueryInputs(root: string, target: string): Promise<QueryInputs> {
  // These package descriptors are the source of the application's generated catalogue. Reading them keeps this CLI usable
  // in a clean checkout, before `prepare` has emitted site/prepared-object-catalog.mts.
  const objectRoot = resolve(root, 'src/objects'), targetCatalogue: TargetCatalogueEntry[] = [];
  for (const directory of (await readdir(objectRoot, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => entry.name).sort()) {
    const value = await readJsonSource(resolve(objectRoot, directory, 'object.json')).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
    if (value === undefined) continue;
    const descriptor = requireRecord(value, `${directory} object descriptor`), properties = requireRecord(descriptor.properties, `${directory} properties`);
    if (properties.catalog === undefined) continue;
    const catalog = requireRecord(properties.catalog, `${directory} catalogue entry`);
    const id = requireString(descriptor.id, `${directory} id`), name = requireString(catalog.name, `${directory} name`), systemName = requireString(catalog.systemName, `${directory} system name`);
    targetCatalogue.push({ id, name, aliases: systemName === name ? [] : [systemName] });
  }
  const focusPaths = [...(await readdir(objectRoot, { recursive: true })).filter(name => name.endsWith('/source/nebula.json')).map(name => resolve(objectRoot, name)),
    resolve(objectRoot, 'local-group/prepared/catalogue.json'), resolve(objectRoot, 'galaxy-clusters/prepared/catalogue.json')];
  for (const path of focusPaths) {
    const value = await readJsonSource(path).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
    if (value === undefined) continue;
    for (const raw of requireArray(requireRecord(value, 'focus catalogue').objects, 'focus objects')) {
      const entry = requireRecord(raw, 'focus object'), id = requireString(entry.id, 'focus id');
      if (targetCatalogue.some(existing => existing.id === id)) continue;
      targetCatalogue.push({ id, name: requireString(entry.name, `${id} name`), aliases: entry.aliases === undefined ? [] : stringList(entry.aliases, `${id} aliases`) });
    }
  }
  const resolution = resolveTarget(target, targetCatalogue), canonicalTarget = resolution.status === 'resolved' ? resolution.canonical.id : target;
  const ledgers: { telescope: string; path: string; value: unknown }[] = [];
  for (const telescope of LEDGER_TELESCOPES) {
    const path = `data/${telescope}/ledger.json`;
    const value = await readJsonSource(resolve(root, path)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT')) return undefined; throw error; });
    if (value !== undefined) ledgers.push({ telescope, path, value });
  }
  const capabilities = parseModeCapabilities(await readJsonSource(resolve(root, 'tools/objects/telescopes/modes.json')));
  const source = resolve(root, 'src/objects', canonicalTarget, 'source');
  const names = await readdir(source, { recursive: true }).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT', 'ENOTDIR')) return [] as string[]; throw error; });
  const bodyMaps: { path: string; value: unknown }[] = [];
  for (const name of names.filter(entry => entry.endsWith('.body-map.json')).sort()) bodyMaps.push({ path: `src/objects/${canonicalTarget}/source/${name}`, value: await readJsonSource(resolve(source, name)) });
  const investigationPath = `src/objects/${canonicalTarget}/investigations.json`;
  const investigations = await readJsonSource(resolve(root, investigationPath)).catch((error: unknown) => { if (hasErrorCode(error, 'ENOENT', 'ENOTDIR')) return undefined; throw error; });
  return { ledgers, capabilities, targetCatalogue, bodyMaps, ...(investigations === undefined ? {} : { investigations: { path: investigationPath, value: investigations } }) };
}

const LEVEL_WORDS: Readonly<Record<ToolkitLevel, string>> = Object.freeze({ none: 'no toolkit',
  'archive-final': 'archive-final products qualified, not re-made here', 'tool-without-checked-program': 'a tool, but no checked program',
  proven: 'locally produced with accepted evidence' });

export function formatAnswer(answer: CapabilityAnswer): string {
  if (answer.targetResolution.status === 'unknown') return `workflow: unknown-target\nblocker codes: unknown-target\n\nNo shipped object matches ${answer.targetResolution.requested}.${answer.targetResolution.suggestions.length
    ? ` Did you mean ${answer.targetResolution.suggestions.map(entry => `${entry.name} (${entry.id})`).join(', ')}?` : ''}\n`;
  const lines = [`workflow: ${answer.endpoint.status}; ${answer.endpoint.selectableCandidates} of ${answer.candidates.length} candidate mode(s) can proceed to explicit selection.`,
    ...(answer.endpoint.blockerCodes.length ? [`blocker codes: ${answer.endpoint.blockerCodes.join(', ')}`] : []), '',
    `${answer.candidates.length} candidate mode(s) observed ${answer.target}, the ones covering ${answer.request.wavelengthMicrometres[0]} to ${answer.request.wavelengthMicrometres[1]} micrometres first.`,
    'A mode verdict is a discovery filter. Where a ledger retains observation identities they are listed; their exact channel and achieved resolution remain product facts.', ''];
  for (const candidate of answer.candidates) {
    lines.push(`${candidate.telescope} ${candidate.mode}${candidate.observations ? ` (${candidate.observations.count} ${candidate.observations.scope === 'this-mode' ? 'observations in this mode' : 'observations of the object, across its modes'})` : ''}`);
    for (const [name, { answer: verdictAnswer, reason }] of Object.entries(candidate.meetsConstraints)) lines.push(`  ${name}: ${verdictAnswer}. ${reason}`);
    lines.push(`  toolkit: ${LEVEL_WORDS[candidate.toolkitSupport.level]}. ${candidate.toolkitSupport.reason}`);
    lines.push(`  production: ${candidate.toolkitSupport.productionMethod}; evidence: ${candidate.toolkitSupport.evidenceBasis}; acceptance: ${candidate.toolkitSupport.acceptanceCriterion}`);
    lines.push(`  body map: ${candidate.bodyMapSupport.answer}. ${candidate.bodyMapSupport.reason}`);
    lines.push(`  selection: ${candidate.selectionAssessment.selectable ? 'selectable' : 'blocked'}`);
    for (const blocker of candidate.selectionAssessment.blockers) lines.push(`    blocker ${blocker.code}${blocker.constraint ? ` (${blocker.constraint})` : ''}: ${blocker.reason}`);
    for (const action of candidate.selectionAssessment.nextActions) lines.push(`    next: ${action.command} ${action.arguments.map(shellWord).join(' ')}`);
    for (const action of candidate.selectionAssessment.qualificationActions.slice(0, 1)) lines.push(`    qualify observation ${action.observation}: ${action.command} ${action.arguments.map(shellWord).join(' ')}`);
    if (candidate.selectionAssessment.qualificationActions.length > 1) lines.push(`    ${candidate.selectionAssessment.qualificationActions.length - 1} more qualification action(s) are present in the JSON answer.`);
    lines.push(`  archive programmes recorded for ${answer.target}: ${candidate.programmes.join(', ') || 'none'}`);
    const records = candidate.observations?.records ?? [];
    for (const record of records.slice(0, 8)) lines.push(`    observation ${record.id}${record.programme ? `, programme ${record.programme}` : ''}: ${record.startIso}${record.endIso ? ` to ${record.endIso}` : ''}${record.title ? `, ${record.title}` : ''}`);
    if (records.length > 8) lines.push(`    ${records.length - 8} more observation record(s) are present in the JSON answer.`);
    lines.push(`  pinned toolkit programs: ${candidate.toolkitSupport.programs.join(', ') || 'none'}`);
    lines.push(`  checked toolkit programs: ${candidate.toolkitSupport.checked.join(', ') || 'none'}`);
    lines.push(`  qualified archive-final programs: ${candidate.toolkitSupport.archiveFinalQualified.join(', ') || 'none'}`);
    const usable = [...forTarget(candidate.toolkitSupport.checked, answer.target), ...forTarget(candidate.toolkitSupport.archiveFinalQualified, answer.target)];
    lines.push(`  usable program of ${answer.target}: ${usable.join(', ') || 'none'}`);
    lines.push(`  evidence: ${candidate.evidence.ledger} (archive read ${candidate.evidence.archiveDate})${candidate.evidence.receipts.length ? `, receipts ${candidate.evidence.receipts.join(', ')}` : ''}`);
    for (const map of candidate.evidence.bodyMaps) lines.push(`    measured: ${map.path}, ${map.quantity}, ${map.angularResolutionArcsec} arcsec, ${map.surfaceResolutionKm} km at the sub-observer point`);
    for (const entry of candidate.evidence.investigations) lines.push(`    investigation ${entry.id} (${entry.status}): ${entry.subject}`);
    for (const line of candidate.unknown) lines.push(`    unknown: ${line}`);
    lines.push('');
  }
  for (const entry of answer.unassignedEvidence) lines.push(`unassigned ${entry.kind}: ${entry.source}, ${entry.identity}. ${entry.reason}${entry.couldMean.length ? ` It could be about ${entry.couldMean.join(', ')}.` : ''}`);
  if (answer.unassignedEvidence.length) lines.push('');
  if (answer.targetCoverage.some(entry => entry.state !== 'observed')) lines.push('archive target coverage:');
  for (const entry of answer.targetCoverage.filter(entry => entry.state !== 'observed')) lines.push(`  ${entry.ledger}: ${entry.state}. ${entry.reason}`);
  return `${lines.join('\n')}\n`;
}

const numberFlag = (args: readonly string[], flag: string): number | undefined => {
  const raw = flagValue(args, flag);
  if (raw === undefined) return undefined;
  const value = Number(raw);
  return value;
};

const shellWord = (value: string): string => /^[A-Za-z0-9_./,:@+-]+$/u.test(value) ? value : `'${value.replaceAll("'", "'\\''")}'`;

export const QUERY_HELP = `Usage: pnpm telescope:query --target TARGET --wavelength MIN,MAX [options]

Required for an explicit workflow verdict:
  --from ISO --to ISO | --any-time
  --min-arcsec N | --min-km N | --min-elements N
  --kind ${PRODUCT_KINDS.join('|')}
  --result ${REQUESTED_RESULTS.join('|')}

Resolution limits are the largest acceptable angular or surface scale: smaller values ask for sharper data.
Use --range-km with --min-km, and --range-km plus --radius-km with --min-elements.
Use --select-telescope NAME --select-mode MODE --program ID to emit a typed observation selection.
When qualification is the only blocker, the answer may provide a telescope:qualify action for an indexed observation.
Use --json for JSON. With the package script, use pnpm --silent telescope:query ... --json for JSON-only stdout.`;

export function requestFromArguments(args: readonly string[]): CapabilityRequest {
  const target = flagValue(args, '--target'), wavelength = flagValue(args, '--wavelength');
  if (!target || !wavelength) throw new Error(QUERY_HELP);
  const range = wavelength.split(',').map(Number);
  if (range.length !== 2 || !range.every(Number.isFinite)) throw new TypeError('--wavelength takes two micrometre values, shortest first, as 3.4,3.6.');
  const from = flagValue(args, '--from'), to = flagValue(args, '--to'), anyTime = args.includes('--any-time'), kind = flagValue(args, '--kind'), result = flagValue(args, '--result');
  if (kind && !(PRODUCT_KINDS as readonly string[]).includes(kind)) throw new TypeError(`--kind takes one of ${PRODUCT_KINDS.join(', ')}.`);
  if (result && !(REQUESTED_RESULTS as readonly string[]).includes(result)) throw new TypeError(`--result takes one of ${REQUESTED_RESULTS.join(', ')}.`);
  if (Boolean(from) !== Boolean(to)) throw new TypeError('--from and --to are given together.');
  if (anyTime && from) throw new TypeError('--any-time cannot be combined with --from and --to.');
  return { target, wavelengthMicrometres: [range[0]!, range[1]!], ...(anyTime ? { time: { any: true as const } } : from && to ? { time: { fromIso: from, toIso: to } } : {}),
    ...(numberFlag(args, '--min-arcsec') === undefined ? {} : { angularResolutionArcsec: numberFlag(args, '--min-arcsec')! }),
    ...(numberFlag(args, '--min-km') === undefined ? {} : { surfaceResolutionKm: numberFlag(args, '--min-km')! }),
    ...(numberFlag(args, '--min-elements') === undefined ? {} : { resolutionElements: numberFlag(args, '--min-elements')! }),
    ...(numberFlag(args, '--range-km') === undefined ? {} : { rangeKm: numberFlag(args, '--range-km')! }),
    ...(numberFlag(args, '--radius-km') === undefined ? {} : { bodyRadiusKm: numberFlag(args, '--radius-km')! }),
    ...(kind ? { kind: kind as ProductKind } : {}), ...(result ? { result: result as RequestedResult } : {}) };
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').at(-1) ?? ' :: ')) {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) { process.stdout.write(`${QUERY_HELP}\n`); process.exitCode = 0; }
  else {
  const request = requestFromArguments(args);
  const answer = queryCapabilities(request, await loadQueryInputs(resolve(import.meta.dirname, '../../..'), request.target));
  const telescope = flagValue(args, '--select-telescope'), mode = flagValue(args, '--select-mode'), programme = flagValue(args, '--program');
  if ([telescope, mode, programme].some(Boolean) && ![telescope, mode, programme].every(Boolean)) throw new TypeError('--select-telescope, --select-mode and --program are given together.');
  process.stdout.write(telescope && mode && programme ? `${JSON.stringify(selectObservation(answer, telescope, mode, programme), null, 2)}\n`
    : args.includes('--json') ? `${JSON.stringify(answer, null, 2)}\n` : formatAnswer(answer));
  }
}
