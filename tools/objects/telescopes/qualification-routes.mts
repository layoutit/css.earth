import { JWST_CUBE_COVERAGE } from '../jwst/imaging/bands.mts';
import { bandOfFilters } from '../jwst/imaging/archive.mts';

export interface QualificationObservation {
  readonly id: string;
  readonly programme?: string;
  readonly startIso: string;
  readonly endIso?: string;
  readonly filter?: string;
}

export type QualificationConfiguration =
  | { readonly kind: 'spitzer-irac-channel'; readonly channel: number }
  | { readonly kind: 'jwst-band'; readonly band: string };

export interface QualificationAction {
  readonly kind: 'qualify-observation';
  readonly observation: string;
  readonly archiveProgramme?: string;
  readonly program: string;
  readonly configuration: QualificationConfiguration;
  readonly command: 'pnpm';
  readonly arguments: readonly string[];
}

const IRAC_CHANNELS = [
  { channel: 1, wavelengthMicrometres: [3.176, 3.926] }, { channel: 2, wavelengthMicrometres: [3.988, 4.998] },
  { channel: 3, wavelengthMicrometres: [5.02, 6.44] }, { channel: 4, wavelengthMicrometres: [6.408, 9.338] },
] as const;

const overlapsTime = (observation: QualificationObservation, time: { readonly any: true } | { readonly fromIso: string; readonly toIso: string } | undefined): boolean =>
  !time || 'any' in time || observation.startIso <= time.toIso && (observation.endIso ?? observation.startIso) >= time.fromIso;
const covers = (coverage: readonly [number, number], request: readonly [number, number]) => coverage[0] <= request[0] && coverage[1] >= request[1];

/** Concrete commands for indexed observations whose actual configuration covers the whole request. */
export function qualificationActionsFor(telescope: string, mode: string, target: string, wavelengthMicrometres: readonly [number, number],
  time: { readonly any: true } | { readonly fromIso: string; readonly toIso: string } | undefined,
  observations: readonly QualificationObservation[]): QualificationAction[] {
  if (telescope === 'Spitzer' && mode === 'IRAC Map') {
    const channels = IRAC_CHANNELS.filter(entry => covers(entry.wavelengthMicrometres, wavelengthMicrometres));
    if (channels.length !== 1) return [];
    const channel = channels[0]!.channel;
    return observations.filter(observation => overlapsTime(observation, time)).map(observation => makeAction(target, telescope, mode, observation,
      { kind: 'spitzer-irac-channel', channel }, ['--channel', String(channel)]));
  }
  if (telescope === 'JWST' && mode === 'NIRSPEC/IFU') return observations.filter(observation => overlapsTime(observation, time) && observation.filter).flatMap(observation => {
    const band = bandOfFilters('NIRSPEC', observation.filter!, observation.id), coverage = JWST_CUBE_COVERAGE[band.id];
    return coverage && covers(coverage, wavelengthMicrometres)
      ? [makeAction(target, telescope, mode, observation, { kind: 'jwst-band', band: band.id }, ['--band', band.id])] : [];
  });
  return [];
}

function makeAction(target: string, telescope: string, mode: string, observation: QualificationObservation, configuration: QualificationConfiguration,
  option: readonly string[]): QualificationAction {
  const program = `${target}-${observation.id}`;
  return { kind: 'qualify-observation', observation: observation.id, ...(observation.programme ? { archiveProgramme: observation.programme } : {}), program, configuration,
    command: 'pnpm', arguments: ['--silent', 'telescope:qualify', '--target', target, '--telescope', telescope, '--mode', mode, '--observation', observation.id, ...option] };
}

export function supportsQualificationRoute(telescope: string, mode: string, configuration: QualificationConfiguration): boolean {
  return telescope === 'Spitzer' && mode === 'IRAC Map' && configuration.kind === 'spitzer-irac-channel' && IRAC_CHANNELS.some(entry => entry.channel === configuration.channel)
    || telescope === 'JWST' && mode === 'NIRSPEC/IFU' && configuration.kind === 'jwst-band' && configuration.band.startsWith('NIRSPEC-') && JWST_CUBE_COVERAGE[configuration.band] !== undefined;
}
