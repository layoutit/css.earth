/** Mode capabilities per archive: each ledger read into the modes it holds for a target, with their recorded capabilities. */
import { PRODUCT_KINDS, type ProductKind, type CapabilityRequest } from './recipe-request.mts';
import { inputWavelengths } from './recipe-request.mts';
import { matchingProduct, type QualifiedObservation } from './qualified-observations.mts';
import { assessInput, assessRequest } from './request-satisfaction.mts';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { JWST_CUBE_COVERAGE } from '../../../tools/objects/jwst/imaging/bands.mts';
import { sourceQualifiedObservations, type LoadedSourceProduct } from './source-products.mts';
import { qualificationActionsFor } from './qualification-routes.mts';
import type { TargetAssociation } from '@cssearth/telescope/node';
import { productKindFamilyEvidence, type ObservationFamilyEvidence } from './observation-families.mts';
import { type Candidate, type CandidateEvidence, type CandidateSelectionAssessment, MODES_SCHEMA, type ModeCapability, type QueryInputs, TARGET_ASSOCIATIONS_PATH, type TargetCoverage, type WorkflowBlocker } from './query-contract.mts';

export interface TargetMode {
  readonly telescope: string; readonly mode: string;
  readonly archiveDate: string;
  readonly observations: Candidate['observations'];
  readonly programmes: readonly string[];
  readonly toolkit: { readonly tool?: string; readonly routeState?: string; readonly refusedBecause?: string; readonly programs: readonly string[]; readonly checked: readonly string[]; readonly receipts: readonly string[];
    readonly targetPrograms?: readonly string[]; readonly targetChecked?: readonly string[];
    /** Archive-final programs of this mode, and the ones a record qualified. A ledger that states none leaves this out. */
    readonly archiveFinal?: { readonly programs: readonly string[]; readonly qualified: readonly string[] } };
  /** Dated observations of this target in this mode, where the ledger dates any. */
  readonly dates: readonly { readonly id: string; readonly startIso: string; readonly endIso?: string }[];
  /** True only when the ledger retains every observation record counted for this target and mode. */
  readonly datesComplete?: boolean;
  readonly targetAssociations?: CandidateEvidence['targetAssociations'];
}

export const stringList = (value: unknown, label: string): string[] => requireArray(value, label).map((entry, index) => requireString(entry, `${label}[${index}]`));
const optionalString = (value: unknown, label: string): string | undefined => value === undefined || value === null ? undefined : requireString(value, label);
export const forTarget = (programs: readonly string[], target: string): string[] => programs.filter(program => program === target || program.startsWith(`${target}-`));

export const missingRequestFields = (request: CapabilityRequest): string[] => [...(request.time ? [] : ['time (--from and --to, or --any-time)']),
  ...(request.angularResolutionArcsec !== undefined || request.surfaceResolutionKm !== undefined || request.resolutionElements !== undefined ? [] : ['a required resolution (--min-arcsec, --min-km or --min-elements)']),
  ...(request.kind ? [] : ['product kind (--kind)']), ...(request.result ? [] : ['requested result (--result telescope-product|body-map)'])];

const requestArguments = (request: CapabilityRequest): string[] => ['--target', request.target, '--wavelength', request.wavelengthMicrometres.join(','),
  ...(request.region ? ['--icrs-circle', [request.region.raDegrees, request.region.decDegrees, request.region.radiusDegrees].join(',')] : []),
  ...(request.spectralFrame ? ['--spectral-frame', request.spectralFrame] : []),
  ...(request.transferLimits ? ['--max-science-bytes', String(request.transferLimits.scienceBytes), '--max-metadata-bytes', String(request.transferLimits.metadataBytes), '--max-link-depth', String(request.transferLimits.nestedEdges), '--max-link-requests', String(request.transferLimits.metadataRequests), '--max-expanded-bytes', String(request.transferLimits.expandedBytes), '--max-package-members', String(request.transferLimits.packageMembers)] : []),
  ...(request.continuumMicrometres ? ['--continuum', request.continuumMicrometres.flat().join(',')] : []),
  ...(request.acceptedAssumptions?.length ? ['--accept-assumptions', request.acceptedAssumptions.join(',')] : []),
  ...(!request.time ? [] : 'any' in request.time ? ['--any-time'] : ['--from', request.time.fromIso, '--to', request.time.toIso]),
  ...(request.angularResolutionArcsec === undefined ? [] : ['--min-arcsec', String(request.angularResolutionArcsec)]),
  ...(request.surfaceResolutionKm === undefined ? [] : ['--min-km', String(request.surfaceResolutionKm)]),
  ...(request.resolutionElements === undefined ? [] : ['--min-elements', String(request.resolutionElements)]),
  ...(request.rangeKm === undefined ? [] : ['--range-km', String(request.rangeKm)]), ...(request.bodyRadiusKm === undefined ? [] : ['--radius-km', String(request.bodyRadiusKm)]),
  ...(request.kind ? ['--kind', request.kind] : []), ...(request.result ? ['--result', request.result] : [])];

export function workflowAssessment(request: CapabilityRequest, target: string, candidate: Omit<Candidate, 'selectionAssessment'>): CandidateSelectionAssessment {
  const blockers: WorkflowBlocker[] = missingRequestFields(request).map(reason => ({ code: 'request-incomplete', reason: `The request is missing ${reason}.` }));
  for (const [constraint, verdict_] of Object.entries(candidate.meetsConstraints)) if (verdict_.answer === 'no')
    blockers.push({ code: 'constraint-refused', constraint, reason: `${constraint}: ${verdict_.reason}` });
  if (candidate.toolkitSupport.level === 'none') blockers.push({ code: 'toolkit-unavailable', reason: candidate.toolkitSupport.reason });
  if (request.result === 'body-map' && candidate.bodyMapSupport.answer === 'no') blockers.push({ code: 'body-map-author-missing', reason: candidate.bodyMapSupport.reason });
  const programmes = [...new Set([...candidate.toolkitSupport.targetPrograms, ...candidate.toolkitSupport.targetArchiveFinalQualifiedPrograms])].filter(programme => candidate.observations?.records?.find(record => record.programme === programme)?.requestSatisfaction?.status !== 'refused' && (!(candidate.qualifiedProducts ?? []).some(product => product.program === programme) || matchingProduct(candidate.qualifiedProducts ?? [], request, programme))).sort();
  if (!programmes.length) blockers.push({ code: 'target-program-unqualified', reason: `No pinned or qualified program of ${target} is available for this mode.` });
  const nextActions = blockers.length ? [] : programmes.map(programme => ({ kind: 'select-observation' as const, programme, command: 'pnpm' as const,
    arguments: ['--silent', 'telescope:query', ...requestArguments(request), '--select-telescope', candidate.telescope, '--select-mode', candidate.mode, '--program', programme, '--json'] }));
  const qualificationActions = !blockers.some(blocker => ['request-incomplete', 'constraint-refused', 'toolkit-unavailable'].includes(blocker.code))
    ? qualificationActionsFor(candidate.telescope, candidate.mode, target, inputWavelengths(request), request.time, (candidate.observations?.records ?? []).filter(record => record.sourceProductId ? !record.qualification?.verified && !Object.entries(record.requestSatisfaction?.constraints ?? {}).some(([key, verdict]) => key !== 'result' && verdict.answer === 'no') : !(candidate.qualifiedProducts ?? []).some(product => product.observation === record.id && matchingProduct([product], request, product.program) && assessRequest(request, product.facts).constraints.wavelength?.answer === 'yes'))) : [];
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

export const intervalWords = (intervals: readonly (readonly [number, number])[]): string =>
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
function hstModes(value: unknown, target: string, targetAssociations: readonly TargetAssociation[]): TargetMode[] {
  const ledger = requireRecord(value, 'Hubble ledger');
  if (ledger.schema !== 'cssearth-hst-ledger@1') throw new TypeError(`Unsupported Hubble ledger schema ${String(ledger.schema)}.`);
  const archiveDate = requireString(ledger.archiveDate, 'archiveDate');
  const configurations = new Map(requireArray(ledger.configurations, 'configurations').map(raw => { const entry = requireRecord(raw, 'configuration'); return [requireString(entry.configuration, 'configuration'), entry] as const; }));
  const entries = [...requireArray(ledger.movingTargets, 'movingTargets'), ...requireArray(ledger.fixedTargets, 'fixedTargets')].map(raw => requireRecord(raw, 'target'));
  const object = entries.find(entry => entry.object === target);
  const toolkitFor = (mode: string) => {
    const declared = configurations.get(mode), programs = declared ? stringList(declared.programs, `${mode} programs`) : [], checked = declared ? stringList(declared.checked, `${mode} checked`) : [];
    const tool = declared ? optionalString(declared.tool, `${mode} tool`) : undefined;
    // The two capabilities arrive separately and stay separate: re-calibration in `checked`, the archive's own final products in
    // `archiveFinal`. A configuration whose pipeline is retired can hold the second and never the first.
    const archive = declared?.archiveFinal === undefined ? undefined : requireRecord(declared.archiveFinal, `${mode} archiveFinal`);
    return { ...(tool ? { tool } : {}), programs, checked, receipts: [],
      ...(archive === undefined ? {} : { archiveFinal: { programs: stringList(archive.programs, `${mode} archive-final programs`), qualified: stringList(archive.qualified, `${mode} archive-final qualified`) } }) };
  };
  const count = object ? requireFiniteNumber(object.observations, 'observations') : 0;
  const modes: TargetMode[] = object ? stringList(object.configurations, 'configurations').map(mode => ({ telescope: 'Hubble', mode, archiveDate,
    observations: { count, scope: 'object-total' as const }, programmes: [], dates: [], toolkit: toolkitFor(mode) })) : [];
  for (const association of targetAssociations.filter(entry => entry.archive === 'mast' && entry.collection === 'HST' && entry.target === target)) {
    if (!configurations.has(association.mode)) throw new TypeError(`${target}: target association names unknown Hubble mode ${association.mode}.`);
    const records = association.observations.map(observation => ({ id: observation.id, startIso: observation.startIso,
      ...(observation.endIso ? { endIso: observation.endIso } : {}), ...(observation.filter ? { filter: observation.filter } : {}),
      programme: association.programme, archiveTarget: association.archiveTarget }));
    const evidence = association.evidence.map(item => ({ source: TARGET_ASSOCIATIONS_PATH, archive: association.archive, collection: association.collection,
      archiveTarget: association.archiveTarget, programme: association.programme, astroquery: association.astroquery, queriedAt: association.queriedAt, ...item }));
    const existing = modes.find(entry => entry.mode === association.mode);
    if (!existing) {
      modes.push({ telescope: 'Hubble', mode: association.mode, archiveDate: association.queriedAt.slice(0, 10),
        observations: { count: records.length, scope: 'this-mode', records }, programmes: [association.programme],
        dates: records.map(record => ({ id: record.id, startIso: record.startIso, ...(record.endIso ? { endIso: record.endIso } : {}) })),
        toolkit: toolkitFor(association.mode), targetAssociations: evidence });
      continue;
    }
    const before = existing.observations?.records ?? [], added = records.filter(record => !before.some(other => other.id === record.id));
    Object.assign(existing, {
      observations: { count: (existing.observations?.count ?? 0) + added.length, scope: existing.observations?.scope ?? 'this-mode', records: [...before, ...added] },
      programmes: [...new Set([...existing.programmes, association.programme])],
      dates: [...existing.dates, ...added.map(record => ({ id: record.id, startIso: record.startIso, ...(record.endIso ? { endIso: record.endIso } : {}) }))],
      targetAssociations: [...existing.targetAssociations ?? [], ...evidence],
    });
  }
  return modes;
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
      toolkit: { ...(reduced ? { routeState: state, tool: 'packages/telescope-cli/src/archives/keck/reduce.mts' }
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
  const all = requireArray(object.observations, 'PDS observations').map(raw => { const row = requireRecord(raw, 'PDS observation');
    const rawRanges = row.wavelengthIntervalsMicrometres ?? (row.wavelengthIntervalMicrometres === undefined ? [] : [row.wavelengthIntervalMicrometres]);
    const ranges = requireArray(rawRanges, 'PDS wavelength intervals').map((rawRange, index) => {
      const range = requireArray(rawRange, `PDS wavelength interval ${index}`);
      if (range.length !== 2) throw new TypeError('PDS observation wavelength interval has two bounds.');
      return [requireFiniteNumber(range[0], 'PDS wavelength start'), requireFiniteNumber(range[1], 'PDS wavelength end')] as const;
    });
    const productLidvid = row.lidvid === undefined ? undefined : requireString(row.lidvid, 'PDS lidvid');
    const archiveProductId = row.archiveProductId === undefined ? undefined : requireString(row.archiveProductId, 'PDS archive product id');
    const sourceFiles = row.sourceFiles === undefined ? undefined : requireArray(row.sourceFiles, 'PDS source files').map(rawFile => { const file = requireRecord(rawFile, 'PDS source file'); return {
      role: requireString(file.role, 'PDS source file role'), path: requireString(file.path, 'PDS source file path'), origin: requireString(file.origin, 'PDS source file origin') }; });
    const filter = row.filter === undefined ? (row.filters === undefined ? undefined : requireArray(row.filters, 'PDS filters').map(value => requireString(value, 'PDS filter')).join(', ')) : requireString(row.filter, 'PDS filter');
    return { id: requireString(row.id, 'PDS observation id'), programme: requireString(row.program ?? row.lidvid, 'PDS program'), startIso: requireString(row.startIso ?? row.registryStartIso, 'PDS start'),
      endIso: requireString(row.endIso ?? row.registryStopIso, 'PDS end'), ...(filter === undefined ? {} : { filter }), archiveTarget: requireString(row.targetName, 'PDS target name'),
      ...(row.targetLid === undefined ? {} : { targetLid: requireString(row.targetLid, 'PDS target lid') }), ...(productLidvid === undefined ? {} : { productLidvid }), ...(archiveProductId === undefined ? {} : { archiveProductId }),
      ...(row.centralWavelengthMicrometres === undefined ? {} : { centralWavelengthMicrometres: requireFiniteNumber(row.centralWavelengthMicrometres, 'PDS central wavelength') }),
      ...(sourceFiles === undefined ? {} : { sourceFiles }), instrument: requireString(row.instrument, 'PDS instrument'),
      observatory: requireString(row.observatory ?? row.archiveTelescope, 'PDS observatory'), telescope: requireString(row.telescope, 'PDS telescope'), mode: requireString(row.mode, 'PDS mode'),
      ...(ranges.length ? { wavelengthIntervalsMicrometres: ranges } : {}), ...(ranges.length === 1 ? { wavelengthIntervalMicrometres: ranges[0] } : {}),
      ...(row.surfaceResolutionKm === undefined ? {} : { surfaceResolutionKm: requireFiniteNumber(row.surfaceResolutionKm, 'PDS surface resolution') }),
      kind: requireString(row.kind ?? 'image', 'PDS kind') as ProductKind, use: requireString(row.use ?? 'Archive-final PDS product.', 'PDS use'), units: requireString(row.units ?? 'not stated', 'PDS units') }; });
  return requireArray(ledger.modes, 'PDS modes').flatMap(raw => { const declared = requireRecord(raw, 'PDS mode'), telescope = requireString(declared.telescope, 'PDS telescope'), mode = requireString(declared.mode, 'PDS mode');
    const records = all.filter(record => record.telescope === telescope && record.mode === mode), programs = stringList(declared.programs, 'PDS programs'), qualified = stringList(declared.qualified, 'PDS qualified');
    if (!records.length) return [];
    return [{ telescope, mode, archiveDate, observations: { count: records.length, scope: 'this-mode' as const, records }, programmes: records.map(record => record.productLidvid ?? record.archiveProductId ?? record.programme),
      dates: records.filter(record => !record.startIso.startsWith('1965-') && !record.endIso?.startsWith('3000-')).map(record => ({ id: record.id, startIso: record.startIso, endIso: record.endIso })),
      datesComplete: records.every(record => !record.startIso.startsWith('1965-') && !record.endIso?.startsWith('3000-')),
      toolkit: { tool: declared.tool === undefined ? 'pds.peppi + pdr' : requireString(declared.tool, 'PDS tool'), programs, checked: [],
        targetPrograms: [...new Set(records.map(record => record.programme).filter(program => programs.includes(program)))], targetChecked: [],
        receipts: stringList(declared.receipts, 'PDS receipts'), archiveFinal: { programs, qualified } } }]; });
}

export function sourceModes(products: readonly LoadedSourceProduct[], request: CapabilityRequest): TargetMode[] {
  const groups = new Map<string, LoadedSourceProduct[]>();
  for (const product of products) { const key = `${product.telescope} :: ${product.mode}`, group = groups.get(key) ?? []; group.push(product); groups.set(key, group); }
  return [...groups.values()].map(own => {
    const first = own[0]!, qualified = own.filter(product => product.qualified).map(product => product.id);
    return { telescope: first.telescope, mode: first.mode, archiveDate: 'package-owned pins', programmes: own.map(product => product.archiveProductId),
      observations: { count: own.length, scope: 'this-mode' as const, records: own.map(product => ({ id: product.id, programme: product.id, sourceProductId: product.id, qualification: { verified: product.qualified, receipt: product.receipt, problem: product.receiptProblem, limitations: product.limitations }, requestSatisfaction: assessInput(request, product.facts ?? { target: product.target, verified: false }),
        startIso: product.startIso ?? '', ...(product.endIso ? { endIso: product.endIso } : {}), archiveProductId: product.archiveProductId, kind: product.kind,
        ...(product.wavelengthIntervalsMicrometres ? { wavelengthIntervalsMicrometres: product.wavelengthIntervalsMicrometres } : {}),
        ...(product.centralWavelengthMicrometres === undefined ? {} : { centralWavelengthMicrometres: product.centralWavelengthMicrometres }),
        units: product.units, use: product.meaning, sourceFiles: product.files })) },
      dates: own.flatMap(product => product.startIso ? [{ id: product.id, startIso: product.startIso, ...(product.endIso ? { endIso: product.endIso } : {}) }] : []),
      datesComplete: own.every(product => product.startIso !== undefined),
      toolkit: { tool: 'packages/telescope-cli/src/qualify-source.mts', programs: qualified, checked: [], targetPrograms: qualified, targetChecked: [],
        receipts: own.filter(product => product.qualified).map(product => product.receipt) } };
  });
}

interface ArchiveAdapter {
  readonly modes: (value: unknown, target: string, targetAssociations: readonly TargetAssociation[]) => TargetMode[];
  readonly modeKeys: (value: unknown) => { readonly telescope: string; readonly mode: string }[];
  readonly missingCoverage?: (ledgerPath: string, value: unknown, target: string) => TargetCoverage;
  readonly prepare?: (root: string, target: string, value: unknown) => Promise<{ readonly value: unknown; readonly capabilities?: readonly ModeCapability[] }>;
  readonly evidenceNames?: Readonly<Record<string, string>>;
}

const modeRows = (value: unknown, ledgerName: string, field: string, telescope: string, modeField: string) => {
  const ledger = requireRecord(value, `${ledgerName} ledger`);
  return requireArray(ledger[field], `${ledgerName} ${field}`).map(raw => ({ telescope, mode: requireString(requireRecord(raw, `${ledgerName} mode`)[modeField], `${ledgerName} mode`) }));
};
const ordinaryMissing = (telescope: string) => (ledger: string, _value: unknown, target: string): TargetCoverage => ({ telescope, ledger, state: 'not-searched',
  reason: `This ledger does not preserve an explicit searched-empty result for ${target}, so absence cannot support a scientific no.` });
const spitzerMissing = (ledgerPath: string, value: unknown, target: string): TargetCoverage => {
  const ledger = requireRecord(value, 'spitzer ledger');
  const skipped = (ledger.notAsked === undefined ? [] : requireArray(ledger.notAsked, 'notAsked')).map(raw => requireRecord(raw, 'notAsked target')).find(entry => entry.object === target);
  if (skipped) return { telescope: 'spitzer', ledger: ledgerPath, state: 'not-searched', reason: requireString(skipped.reason, 'notAsked reason') };
  if ((ledger.unanswered === undefined ? [] : stringList(ledger.unanswered, 'unanswered')).includes(target)) return { telescope: 'spitzer', ledger: ledgerPath, state: 'unanswered', reason: 'The archive query was attempted but returned no usable answer.' };
  return (ledger.searched === undefined ? [] : stringList(ledger.searched, 'searched')).includes(target)
    ? { telescope: 'spitzer', ledger: ledgerPath, state: 'searched-empty', reason: `The complete Spitzer search set includes ${target} and returned no observation.` }
    : { telescope: 'spitzer', ledger: ledgerPath, state: 'not-searched', reason: `This Spitzer snapshot carries no completed search for ${target}.` };
};
const hstMissing = (ledgerPath: string, value: unknown, target: string): TargetCoverage => {
  const ledger = requireRecord(value, 'hst ledger');
  return (ledger.unansweredTargets === undefined ? [] : stringList(ledger.unansweredTargets, 'unansweredTargets')).includes(target)
    ? { telescope: 'hst', ledger: ledgerPath, state: 'unanswered', reason: 'The MAST target query was attempted but returned no usable answer.' }
    : ordinaryMissing('hst')(ledgerPath, value, target);
};
const pdsMissing = (ledgerPath: string, value: unknown, target: string): TargetCoverage => {
  const ledger = requireRecord(value, 'pds ledger');
  const search = (ledger.searches === undefined ? [] : requireArray(ledger.searches, 'PDS searches').map(raw => requireRecord(raw, 'PDS search'))).find(entry => entry.target === target);
  if (search) {
    const registryProducts = requireFiniteNumber(search.registryProducts, 'PDS registry products'), admittedProducts = requireFiniteNumber(search.admittedProducts, 'PDS admitted products');
    const rejected = (search.rejected === undefined ? [] : requireArray(search.rejected, 'PDS rejected products')).map(raw => { const row = requireRecord(raw, 'PDS rejected product'); return {
      lidvid: requireString(row.lidvid, 'PDS rejected lidvid'), reason: requireString(row.reason, 'PDS rejection reason') }; });
    return registryProducts === 0
      ? { telescope: 'pds', ledger: ledgerPath, state: 'searched-empty', reason: `Peppi returned no Product_Observational record for ${target}.`, registryProducts, admittedProducts, rejected }
      : { telescope: 'pds', ledger: ledgerPath, state: 'unsupported-products', reason: `Peppi returned ${registryProducts} product(s), but none became a supported observation.`, registryProducts, admittedProducts, rejected };
  }
  return (ledger.searched === undefined ? [] : stringList(ledger.searched, 'searched')).includes(target)
    ? { telescope: 'pds', ledger: ledgerPath, state: 'unanswered', reason: `This older PDS search for ${target} does not retain registry and admission counts.` }
    : { telescope: 'pds', ledger: ledgerPath, state: 'not-searched', reason: `This PDS snapshot carries no completed Peppi search for ${target}.` };
};

/** One explicit boundary per source. Schema knowledge and absence semantics stay with that source, not in the shared query. */
export const ADAPTERS: Readonly<Record<string, ArchiveAdapter>> = Object.freeze({
  jwst: { modes: jwstModes, modeKeys: value => modeRows(value, 'JWST', 'modes', 'JWST', 'mode'), missingCoverage: ordinaryMissing('jwst'), evidenceNames: { JWST: 'JWST', 'JAMES WEBB SPACE TELESCOPE': 'JWST' } },
  hst: { modes: hstModes, modeKeys: value => modeRows(value, 'Hubble', 'configurations', 'Hubble', 'configuration'), missingCoverage: hstMissing, evidenceNames: { HST: 'Hubble', HUBBLE: 'Hubble', 'HUBBLE SPACE TELESCOPE': 'Hubble' } },
  naco: { modes: nacoModes, modeKeys: value => modeRows(value, 'NACO', 'modes', 'VLT/NACO', 'mode'), missingCoverage: ordinaryMissing('naco'), evidenceNames: { NACO: 'VLT/NACO', 'NAOS+CONICA': 'VLT/NACO', 'VLT/NACO': 'VLT/NACO' } },
  chandra: { modes: chandraModes, modeKeys: value => Object.keys(requireRecord(requireRecord(requireRecord(value, 'Chandra ledger').archive, 'archive').byInstrument, 'byInstrument')).map(mode => ({ telescope: 'Chandra', mode })), missingCoverage: ordinaryMissing('chandra'), evidenceNames: { CHANDRA: 'Chandra', CXO: 'Chandra' } },
  juno: { modes: junoModes, modeKeys: () => [{ telescope: 'Juno', mode: 'JUNOCAM' }], missingCoverage: ordinaryMissing('juno'), evidenceNames: { JUNO: 'Juno', JUNOCAM: 'Juno' } },
  spitzer: { modes: spitzerModes, modeKeys: value => modeRows(value, 'Spitzer', 'modes', 'Spitzer', 'mode'), missingCoverage: spitzerMissing, evidenceNames: { SPITZER: 'Spitzer' } },
  gemini: { modes: geminiModes, modeKeys: value => modeRows(value, 'Gemini', 'capabilities', 'Gemini', 'instrument'), missingCoverage: ordinaryMissing('gemini'), evidenceNames: { GEMINI: 'Gemini' } },
  keck: { modes: keckModes, modeKeys: value => modeRows(value, 'Keck', 'modes', 'Keck', 'instrument'), missingCoverage: ordinaryMissing('keck'), evidenceNames: { KECK: 'Keck' } },
  ihw: { modes: ihwModes, modeKeys: value => modeRows(value, 'IHW', 'modes', 'IHW/PDS', 'mode'), missingCoverage: (ledger, _value, _target) => ({ telescope: 'ihw', ledger, state: 'not-searched', reason: 'This IHW dataset is a target-specific Halley collection; it is not a search of other targets.' }), evidenceNames: { 'IHW/PDS': 'IHW/PDS' } },
  pds: { modes: pdsModes, modeKeys: value => requireArray(requireRecord(value, 'PDS ledger').modes, 'PDS modes').map(raw => { const entry = requireRecord(raw, 'PDS mode'); return {
    telescope: requireString(entry.telescope, 'PDS telescope'), mode: requireString(entry.mode, 'PDS mode') }; }), missingCoverage: pdsMissing },
});
export const EVIDENCE_TELESCOPE_NAMES: Readonly<Record<string, string>> = Object.freeze(Object.assign({}, ...Object.values(ADAPTERS).map(adapter => adapter.evidenceNames ?? {})));

export function targetCoverage(telescope: string, adapter: ArchiveAdapter, ledgerPath: string, value: unknown, target: string, modes: readonly TargetMode[]): TargetCoverage {
  if (modes.length) return { telescope, ledger: ledgerPath, state: 'observed', reason: modes.some(mode => mode.targetAssociations?.length)
    ? `The ledger and cited target-in-field associations index ${modes.length} mode(s) for ${target}.`
    : `The ledger indexes ${modes.length} mode(s) for ${target}.` };
  return (adapter.missingCoverage ?? ordinaryMissing(telescope))(ledgerPath, value, target);
}

export interface IndexedObservation {
  readonly source: 'ledger' | 'package';
  readonly telescope: string; readonly mode: string; readonly archiveDate: string;
  readonly observation: string; readonly programme?: string; readonly title?: string;
  readonly startIso: string | null; readonly endIso: string | null;
  readonly kind?: ProductKind; readonly instrument?: string; readonly filter?: string;
  readonly familyEvidence: ObservationFamilyEvidence;
  readonly wavelengthIntervalsMicrometres?: readonly (readonly [number, number])[];
  readonly sourceProductId?: string;
  readonly qualification?: { readonly verified: boolean; readonly receipt: string; readonly problem?: string; readonly limitations: readonly string[] };
  readonly qualifiedProducts: readonly QualifiedObservation[];
  readonly routeObservation: import('./qualification-routes.mts').QualificationObservation;
}

/** Expose exact indexed observation identities without running scientific-request assessment. */
export function indexedTargetObservations(inputs: QueryInputs, target: string): { readonly observations: readonly IndexedObservation[]; readonly coverage: readonly TargetCoverage[] } {
  const rows = new Map<string, IndexedObservation>(), coverage: TargetCoverage[] = [];
  const qualifiedIndex = [...inputs.qualifiedProducts ?? [], ...sourceQualifiedObservations(inputs.sourceProducts ?? [])];
  const add = (row: Omit<IndexedObservation, 'qualifiedProducts'>) => {
    const key = JSON.stringify([row.telescope, row.mode, row.observation]);
    const qualifiedProducts = qualifiedIndex.filter(product => product.target === target && product.telescope === row.telescope && product.mode === row.mode && product.observation === row.observation);
    const previous = rows.get(key);
    rows.set(key, { ...(previous ?? row), ...row, qualifiedProducts });
  };
  for (const ledger of inputs.ledgers) {
    const adapter = ADAPTERS[ledger.telescope];
    if (!adapter) throw new TypeError(`No adapter reads the ${ledger.telescope} ledger.`);
    const modes = adapter.modes(ledger.value, target, inputs.targetAssociations);
    coverage.push(targetCoverage(ledger.telescope, adapter, ledger.path, ledger.value, target, modes));
    for (const mode of modes) for (const record of mode.observations?.records ?? []) add({ source: 'ledger', telescope: mode.telescope, mode: mode.mode, archiveDate: mode.archiveDate,
      observation: record.id, ...(record.programme ? { programme: record.programme } : {}), ...(record.title ? { title: record.title } : {}),
      startIso: record.startIso || null, endIso: record.endIso ?? null, ...(record.kind ? { kind: record.kind } : {}),
      familyEvidence: productKindFamilyEvidence(record.kind, { kind: 'archive-adapter', id: ledger.telescope, evidence: ledger.path }),
      ...(record.instrument ? { instrument: record.instrument } : {}), ...(record.filter ? { filter: record.filter } : {}),
      ...(record.wavelengthIntervalsMicrometres ? { wavelengthIntervalsMicrometres: record.wavelengthIntervalsMicrometres } : record.wavelengthIntervalMicrometres ? { wavelengthIntervalsMicrometres: [record.wavelengthIntervalMicrometres] } : {}),
      ...(record.sourceProductId ? { sourceProductId: record.sourceProductId } : {}), ...(record.qualification ? { qualification: record.qualification } : {}), routeObservation: record });
  }
  for (const product of inputs.sourceProducts ?? []) add({ source: 'package', telescope: product.telescope, mode: product.mode, archiveDate: 'package-owned pins', observation: product.id,
    programme: product.id, startIso: product.startIso ?? null, endIso: product.endIso ?? null, kind: product.kind,
    familyEvidence: product.familyEvidence ?? productKindFamilyEvidence(product.kind, { kind: 'source-product', id: product.id, evidence: product.citation }), wavelengthIntervalsMicrometres: product.wavelengthIntervalsMicrometres,
    sourceProductId: product.id, qualification: { verified: product.qualified, receipt: product.receipt, problem: product.receiptProblem, limitations: product.limitations },
    routeObservation: { id: product.id, programme: product.id, startIso: product.startIso ?? '', ...(product.endIso ? { endIso: product.endIso } : {}), sourceProductId: product.id,
      kind: product.kind, wavelengthIntervalsMicrometres: product.wavelengthIntervalsMicrometres } });
  return { observations: [...rows.values()], coverage };
}

/** Every mode key the ledgers use, so `modes.json` can be tied to them and cannot drift. */
export function ledgerModeKeys(ledgers: QueryInputs['ledgers']): { readonly telescope: string; readonly mode: string }[] {
  const keys = new Map<string, { telescope: string; mode: string }>();
  for (const { telescope, value } of ledgers) {
    const add = (name: string, mode: string) => keys.set(`${name} :: ${mode}`, { telescope: name, mode });
    const adapter = ADAPTERS[telescope];
    if (!adapter) throw new TypeError(`No adapter reads the ${telescope} ledger.`);
    for (const key of adapter.modeKeys(value)) add(key.telescope, key.mode);
  }
  return [...keys.values()].sort((a, b) => `${a.telescope}${a.mode}` < `${b.telescope}${b.mode}` ? -1 : 1);
}
