import { flagValue } from '@cssearth/core';
import { JWST_CUBE_COVERAGE } from '../jwst/imaging/bands.mts';
import { bandOfFilters } from '../jwst/imaging/archive.mts';
import { validateCapabilityRequest, type CapabilityRequest } from './recipe-request.mts';
import type { DiscoveryRequest } from './vo/discovery.mts';

export interface QualificationObservation {
  readonly id: string;
  readonly sourceProductId?: string;
  readonly programme?: string;
  readonly startIso: string;
  readonly endIso?: string;
  readonly filter?: string;
  /** Archive spelling used to retrieve this observation. It is distinct from the canonical cssEarth target id. */
  readonly archiveTarget?: string;
  /** A route may qualify one observing night when the archive programme spans several nights. */
  readonly night?: string;
  readonly targetLid?: string;
  readonly productLidvid?: string;
  readonly instrument?: string;
  readonly wavelengthIntervalMicrometres?: readonly [number, number];
  readonly wavelengthIntervalsMicrometres?: readonly (readonly [number, number])[];
  readonly observatory?: string; readonly kind?: string; readonly use?: string; readonly units?: string; readonly surfaceResolutionKm?: number;
}

export type QualificationConfiguration =
  | { readonly kind: 'archive-acquisition'; readonly key: string; readonly request: DiscoveryRequest }
  | { readonly kind: 'source-product'; readonly id: string }
  | { readonly kind: 'spitzer-irac-channel'; readonly channel: number }
  | { readonly kind: 'jwst-band'; readonly band: string; readonly wavelengthMicrometres: readonly [number, number] }
  | { readonly kind: 'naco-program-night'; readonly programme: string; readonly archiveTarget: string; readonly night: string }
  | { readonly kind: 'pds-product'; readonly targetLid: string; readonly targetName: string; readonly lidvid: string };

export interface QualificationAction {
  readonly kind: 'qualify-observation';
  readonly observation: string;
  readonly archiveProgramme?: string;
  readonly program: string;
  readonly configuration: QualificationConfiguration;
  readonly command: 'pnpm';
  readonly arguments: readonly string[];
}

interface QualificationRoute {
  readonly telescope: string;
  readonly mode: string;
  readonly actions: (context: { readonly target: string; readonly wavelengthMicrometres?: readonly [number, number];
    readonly time: { readonly any: true } | { readonly fromIso: string; readonly toIso: string } | undefined;
    readonly observations: readonly QualificationObservation[] }) => QualificationAction[];
  readonly accepts: (configuration: QualificationConfiguration) => boolean;
  readonly configurationFromArguments: (args: readonly string[]) => QualificationConfiguration;
}

const IRAC_CHANNELS = [
  { channel: 1, wavelengthMicrometres: [3.176, 3.926] }, { channel: 2, wavelengthMicrometres: [3.988, 4.998] },
  { channel: 3, wavelengthMicrometres: [5.02, 6.44] }, { channel: 4, wavelengthMicrometres: [6.408, 9.338] },
] as const;

const overlapsTime = (observation: QualificationObservation, time: { readonly any: true } | { readonly fromIso: string; readonly toIso: string } | undefined): boolean => {
  if (!time || 'any' in time) return true;
  const start = Date.parse(observation.startIso), end = Date.parse(observation.endIso ?? observation.startIso);
  // Missing dates cannot establish exclusion; qualification must resolve the product's time.
  return !Number.isFinite(start) || !Number.isFinite(end) || end >= Date.parse(time.fromIso) && start <= Date.parse(time.toIso);
};
const covers = (coverage: readonly [number, number], request: readonly [number, number]) => coverage[0] <= request[0] && coverage[1] >= request[1];
const productCovers = (observation: QualificationObservation, request: readonly [number, number]) => {
  const intervals = observation.wavelengthIntervalsMicrometres ?? (observation.wavelengthIntervalMicrometres ? [observation.wavelengthIntervalMicrometres] : []);
  const merged: [number, number][] = [];
  for (const [from, to] of [...intervals].sort((a, b) => a[0] - b[0])) {
    const last = merged.at(-1); if (last && from <= last[1]) last[1] = Math.max(last[1], to); else merged.push([from, to]);
  }
  return merged.some(interval => covers(interval, request));
};
const required = (args: readonly string[], flag: string) => {
  const value = flagValue(args, flag);
  if (!value) throw new TypeError(`${flag} is required for this qualification route.`);
  return value;
};
const wavelength = (args: readonly string[]): readonly [number, number] => {
  const values = required(args, '--wavelength').split(',').map(Number);
  if (values.length !== 2 || !values.every(Number.isFinite) || !(values[0]! < values[1]!))
    throw new TypeError('--wavelength must be an increasing FROM,TO interval in micrometres.');
  return [values[0]!, values[1]!];
};

function makeAction(target: string, telescope: string, mode: string, observation: QualificationObservation, configuration: QualificationConfiguration,
  option: readonly string[]): QualificationAction {
  const program = `${target}-${observation.id}`;
  return { kind: 'qualify-observation', observation: observation.id, ...(observation.programme ? { archiveProgramme: observation.programme } : {}), program, configuration,
    command: 'pnpm', arguments: ['--silent', 'telescope:qualify', '--target', target, '--telescope', telescope, '--mode', mode, '--observation', observation.id, ...option] };
}

/** Telescope-owned routes. The dispatcher only looks up this registry; adding a route does not add another branch to it. */
const ROUTES: readonly QualificationRoute[] = [
  {
    telescope: 'Spitzer', mode: 'IRAC Map',
    actions: ({ target, wavelengthMicrometres, time, observations }) => {
      if (!wavelengthMicrometres) return [];
      const channels = IRAC_CHANNELS.filter(entry => covers(entry.wavelengthMicrometres, wavelengthMicrometres));
      if (channels.length !== 1) return [];
      const channel = channels[0]!.channel;
      return observations.filter(observation => overlapsTime(observation, time)).map(observation => makeAction(target, 'Spitzer', 'IRAC Map', observation,
        { kind: 'spitzer-irac-channel', channel }, ['--channel', String(channel)]));
    },
    accepts: configuration => configuration.kind === 'spitzer-irac-channel' && IRAC_CHANNELS.some(entry => entry.channel === configuration.channel),
    configurationFromArguments: args => {
      const channel = Number(required(args, '--channel'));
      if (!Number.isSafeInteger(channel) || channel <= 0) throw new TypeError('--channel must be a positive integer.');
      return { kind: 'spitzer-irac-channel', channel };
    },
  },
  {
    telescope: 'JWST', mode: 'NIRSPEC/IFU',
    actions: ({ target, wavelengthMicrometres, time, observations }) => wavelengthMicrometres ? observations.filter(observation => overlapsTime(observation, time) && observation.filter).flatMap(observation => {
      const band = bandOfFilters('NIRSPEC', observation.filter!, observation.id), coverage = JWST_CUBE_COVERAGE[band.id];
      return coverage && covers(coverage, wavelengthMicrometres)
        ? [makeAction(target, 'JWST', 'NIRSPEC/IFU', observation, { kind: 'jwst-band', band: band.id, wavelengthMicrometres },
          ['--band', band.id, '--wavelength', wavelengthMicrometres.join(',')])] : [];
    }) : [],
    accepts: configuration => configuration.kind === 'jwst-band' && configuration.band.startsWith('NIRSPEC-')
      && JWST_CUBE_COVERAGE[configuration.band] !== undefined
      && covers(JWST_CUBE_COVERAGE[configuration.band]!, configuration.wavelengthMicrometres),
    configurationFromArguments: args => ({ kind: 'jwst-band', band: required(args, '--band'), wavelengthMicrometres: wavelength(args) }),
  },
  {
    telescope: 'VLT/NACO', mode: 'imaging',
    actions: ({ target, time, observations }) => observations.filter(observation => overlapsTime(observation, time)
      && observation.programme && observation.archiveTarget && observation.night).map(observation => {
      const configuration = { kind: 'naco-program-night', programme: observation.programme!, archiveTarget: observation.archiveTarget!, night: observation.night! } as const;
      return makeAction(target, 'VLT/NACO', 'imaging', observation, configuration,
        ['--archive-programme', configuration.programme, '--archive-target', configuration.archiveTarget, '--night', configuration.night]);
    }),
    accepts: configuration => configuration.kind === 'naco-program-night' && Boolean(configuration.programme && configuration.archiveTarget && /^\d{4}-\d{2}-\d{2}$/u.test(configuration.night)),
    configurationFromArguments: args => ({ kind: 'naco-program-night', programme: required(args, '--archive-programme'),
      archiveTarget: required(args, '--archive-target'), night: required(args, '--night') }),
  },
];

const routeFor = (telescope: string, mode: string) => ROUTES.find(route => route.telescope === telescope && route.mode === mode);

/** Concrete commands for indexed observations which a registered route can retrieve and qualify. */
export function qualificationActionsFor(telescope: string, mode: string, target: string, wavelengthMicrometres: readonly [number, number],
  time: { readonly any: true } | { readonly fromIso: string; readonly toIso: string } | undefined,
  observations: readonly QualificationObservation[]): QualificationAction[] {
  const sourceActions = observations.filter(observation => observation.sourceProductId && overlapsTime(observation, time)).map(observation => {
    const action = makeAction(target, telescope, mode, observation, { kind: 'source-product', id: observation.sourceProductId! }, ['--source-product', observation.sourceProductId!]);
    return { ...action, program: observation.sourceProductId! };
  });
  const archiveObservations = observations.filter(observation => !observation.sourceProductId);
  const route = routeFor(telescope, mode);
  if (route) return [...sourceActions, ...route.actions({ target, wavelengthMicrometres, time, observations: archiveObservations })];
  return [...sourceActions, ...archiveObservations.filter(observation => observation.kind === 'image' && overlapsTime(observation, time) && observation.targetLid && observation.archiveTarget && observation.productLidvid
    && observation.observatory && observation.instrument && productCovers(observation, wavelengthMicrometres)).map(observation => makeAction(target, telescope, mode, observation,
      { kind: 'pds-product', targetLid: observation.targetLid!, targetName: observation.archiveTarget!, lidvid: observation.productLidvid! },
      ['--pds-target-lid', observation.targetLid!, '--pds-target-name', observation.archiveTarget!, '--pds-lidvid', observation.productLidvid!]))];
}

export interface ExplorationQualificationAvailability {
  readonly available: boolean;
  readonly configuration?: QualificationConfiguration;
  readonly missingParameters: readonly ('wavelength')[];
  readonly reason: string;
}

/** Describe the exact existing route without manufacturing a wavelength merely to make it selectable. */
export function explorationQualificationFor(telescope: string, mode: string, target: string, observation: QualificationObservation,
  request: Pick<DiscoveryRequest, 'wavelengthMicrometres' | 'time'>): ExplorationQualificationAvailability {
  if (observation.sourceProductId) return { available: true, configuration: { kind: 'source-product', id: observation.sourceProductId }, missingParameters: [], reason: 'Package-owned source product can be qualified through its pinned source closure.' };
  const route = routeFor(telescope, mode);
  const needsWavelength = telescope === 'Spitzer' && mode === 'IRAC Map' || telescope === 'JWST' && mode === 'NIRSPEC/IFU';
  if (needsWavelength && !request.wavelengthMicrometres) return { available: false, missingParameters: ['wavelength'], reason: 'This reduction route needs an explicit wavelength interval to select its channel or band.' };
  if (route) {
    const action = route.actions({ target, wavelengthMicrometres: request.wavelengthMicrometres, time: request.time, observations: [observation] })[0];
    return action ? { available: true, configuration: action.configuration, missingParameters: [], reason: 'The existing telescope-specific qualification route accepts this observation and the supplied filters.' }
      : { available: false, missingParameters: [], reason: 'The existing telescope-specific route cannot qualify this observation with the supplied filters.' };
  }
  if (observation.kind === 'image' && observation.targetLid && observation.archiveTarget && observation.productLidvid && observation.observatory && observation.instrument) {
    if (!request.wavelengthMicrometres) return { available: false, missingParameters: ['wavelength'], reason: 'This PDS route needs an explicit wavelength interval to bind a supported product.' };
    if (productCovers(observation, request.wavelengthMicrometres)) return { available: true,
      configuration: { kind: 'pds-product', targetLid: observation.targetLid, targetName: observation.archiveTarget, lidvid: observation.productLidvid },
      missingParameters: [], reason: 'The existing PDS product route accepts this exact archive identity.' };
  }
  return { available: false, missingParameters: [], reason: `No qualification route handles ${telescope} ${mode} for this observation.` };
}

export function supportsQualificationRoute(telescope: string, mode: string, configuration: QualificationConfiguration): boolean {
  if (configuration.kind === 'source-product') return /^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(configuration.id);
  return configuration.kind === 'pds-product'
    ? configuration.targetLid.startsWith('urn:nasa:pds:context:target:') && configuration.lidvid.startsWith('urn:nasa:pds:')
    : routeFor(telescope, mode)?.accepts(configuration) ?? false;
}

/** Parse only the instrument-specific part of a qualification command, through the same route that emitted it. */
export function qualificationConfigurationFromArguments(telescope: string, mode: string, args: readonly string[]): QualificationConfiguration {
  if (flagValue(args, '--acquisition')) {
    const request: unknown = JSON.parse(required(args, '--request'));
    // The public validator checks all constraints before any archive IO. Invalid structures throw here.
    validateCapabilityRequest(request as CapabilityRequest);
    return { kind: 'archive-acquisition', key: required(args, '--acquisition'), request: request as CapabilityRequest };
  }
  if (flagValue(args, '--source-product')) return { kind: 'source-product', id: required(args, '--source-product') };
  if (flagValue(args, '--pds-lidvid')) return { kind: 'pds-product', targetLid: required(args, '--pds-target-lid'), targetName: required(args, '--pds-target-name'), lidvid: required(args, '--pds-lidvid') };
  const route = routeFor(telescope, mode);
  if (!route) throw new TypeError(`No qualification route handles ${telescope} ${mode}.`);
  const configuration = route.configurationFromArguments(args);
  if (!route.accepts(configuration)) throw new TypeError(`Invalid configuration for ${telescope} ${mode}.`);
  return configuration;
}
