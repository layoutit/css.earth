import { flagValue } from '../../cli-arguments.mts';
import { JWST_CUBE_COVERAGE } from '../jwst/imaging/bands.mts';
import { bandOfFilters } from '../jwst/imaging/archive.mts';

export interface QualificationObservation {
  readonly id: string;
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
  | { readonly kind: 'spitzer-irac-channel'; readonly channel: number }
  | { readonly kind: 'jwst-band'; readonly band: string }
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
  readonly actions: (context: { readonly target: string; readonly wavelengthMicrometres: readonly [number, number];
    readonly time: { readonly any: true } | { readonly fromIso: string; readonly toIso: string } | undefined;
    readonly observations: readonly QualificationObservation[] }) => QualificationAction[];
  readonly accepts: (configuration: QualificationConfiguration) => boolean;
  readonly configurationFromArguments: (args: readonly string[]) => QualificationConfiguration;
}

const IRAC_CHANNELS = [
  { channel: 1, wavelengthMicrometres: [3.176, 3.926] }, { channel: 2, wavelengthMicrometres: [3.988, 4.998] },
  { channel: 3, wavelengthMicrometres: [5.02, 6.44] }, { channel: 4, wavelengthMicrometres: [6.408, 9.338] },
] as const;

const overlapsTime = (observation: QualificationObservation, time: { readonly any: true } | { readonly fromIso: string; readonly toIso: string } | undefined): boolean =>
  !time || 'any' in time || observation.startIso <= time.toIso && (observation.endIso ?? observation.startIso) >= time.fromIso;
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
    actions: ({ target, wavelengthMicrometres, time, observations }) => observations.filter(observation => overlapsTime(observation, time) && observation.filter).flatMap(observation => {
      const band = bandOfFilters('NIRSPEC', observation.filter!, observation.id), coverage = JWST_CUBE_COVERAGE[band.id];
      return coverage && covers(coverage, wavelengthMicrometres)
        ? [makeAction(target, 'JWST', 'NIRSPEC/IFU', observation, { kind: 'jwst-band', band: band.id }, ['--band', band.id])] : [];
    }),
    accepts: configuration => configuration.kind === 'jwst-band' && configuration.band.startsWith('NIRSPEC-') && JWST_CUBE_COVERAGE[configuration.band] !== undefined,
    configurationFromArguments: args => ({ kind: 'jwst-band', band: required(args, '--band') }),
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
  {
    telescope: 'Lowell/LDT', mode: 'LMI/VR calibrated image',
    actions: ({ target, wavelengthMicrometres, time, observations }) => observations.filter(observation => overlapsTime(observation, time)
      && observation.targetLid && observation.archiveTarget && observation.productLidvid && observation.instrument === 'Large Monolithic Imager'
      && observation.wavelengthIntervalMicrometres && covers(observation.wavelengthIntervalMicrometres, wavelengthMicrometres)).map(observation =>
        makeAction(target, 'Lowell/LDT', 'LMI/VR calibrated image', observation,
          { kind: 'pds-product', targetLid: observation.targetLid!, targetName: observation.archiveTarget!, lidvid: observation.productLidvid! },
          ['--pds-target-lid', observation.targetLid!, '--pds-target-name', observation.archiveTarget!, '--pds-lidvid', observation.productLidvid!])),
    accepts: configuration => configuration.kind === 'pds-product' && configuration.targetLid.startsWith('urn:nasa:pds:context:target:') && configuration.lidvid.startsWith('urn:nasa:pds:'),
    configurationFromArguments: args => ({ kind: 'pds-product', targetLid: required(args, '--pds-target-lid'), targetName: required(args, '--pds-target-name'), lidvid: required(args, '--pds-lidvid') }),
  },
];

const routeFor = (telescope: string, mode: string) => ROUTES.find(route => route.telescope === telescope && route.mode === mode);

/** Concrete commands for indexed observations which a registered route can retrieve and qualify. */
export function qualificationActionsFor(telescope: string, mode: string, target: string, wavelengthMicrometres: readonly [number, number],
  time: { readonly any: true } | { readonly fromIso: string; readonly toIso: string } | undefined,
  observations: readonly QualificationObservation[]): QualificationAction[] {
  const route = routeFor(telescope, mode);
  if (route) return route.actions({ target, wavelengthMicrometres, time, observations });
  return observations.filter(observation => overlapsTime(observation, time) && observation.targetLid && observation.archiveTarget && observation.productLidvid
    && observation.observatory && observation.instrument && productCovers(observation, wavelengthMicrometres)).map(observation => makeAction(target, telescope, mode, observation,
      { kind: 'pds-product', targetLid: observation.targetLid!, targetName: observation.archiveTarget!, lidvid: observation.productLidvid! },
      ['--pds-target-lid', observation.targetLid!, '--pds-target-name', observation.archiveTarget!, '--pds-lidvid', observation.productLidvid!]));
}

export function supportsQualificationRoute(telescope: string, mode: string, configuration: QualificationConfiguration): boolean {
  return configuration.kind === 'pds-product'
    ? configuration.targetLid.startsWith('urn:nasa:pds:context:target:') && configuration.lidvid.startsWith('urn:nasa:pds:')
    : routeFor(telescope, mode)?.accepts(configuration) ?? false;
}

/** Parse only the instrument-specific part of a qualification command, through the same route that emitted it. */
export function qualificationConfigurationFromArguments(telescope: string, mode: string, args: readonly string[]): QualificationConfiguration {
  if (flagValue(args, '--pds-lidvid')) return { kind: 'pds-product', targetLid: required(args, '--pds-target-lid'), targetName: required(args, '--pds-target-name'), lidvid: required(args, '--pds-lidvid') };
  const route = routeFor(telescope, mode);
  if (!route) throw new TypeError(`No qualification route handles ${telescope} ${mode}.`);
  const configuration = route.configurationFromArguments(args);
  if (!route.accepts(configuration)) throw new TypeError(`Invalid configuration for ${telescope} ${mode}.`);
  return configuration;
}
