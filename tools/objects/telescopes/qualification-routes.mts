export interface QualificationObservation {
  readonly id: string;
  readonly programme?: string;
  readonly startIso: string;
  readonly endIso?: string;
}

export interface QualificationAction {
  readonly kind: 'qualify-observation';
  readonly observation: string;
  readonly archiveProgramme?: string;
  readonly program: string;
  readonly channel: number;
  readonly command: 'pnpm';
  readonly arguments: readonly string[];
}

interface Route {
  readonly telescope: string;
  readonly mode: string;
  readonly channels: readonly { readonly channel: number; readonly wavelengthMicrometres: readonly [number, number] }[];
}

const ROUTES: readonly Route[] = Object.freeze([
  { telescope: 'Spitzer', mode: 'IRAC Map', channels: [
    { channel: 1, wavelengthMicrometres: [3.176, 3.926] }, { channel: 2, wavelengthMicrometres: [3.988, 4.998] },
    { channel: 3, wavelengthMicrometres: [5.02, 6.44] }, { channel: 4, wavelengthMicrometres: [6.408, 9.338] }] },
]);

const overlapsTime = (observation: QualificationObservation, time: { readonly any: true } | { readonly fromIso: string; readonly toIso: string } | undefined): boolean =>
  !time || 'any' in time || observation.startIso <= time.toIso && (observation.endIso ?? observation.startIso) >= time.fromIso;

/** Return concrete qualification commands only when one reducer route and one detector channel cover the entire request.
 * The caller still chooses an archive observation; the query does not pretend that a mode-level verdict inspected it. */
export function qualificationActionsFor(telescope: string, mode: string, target: string, wavelengthMicrometres: readonly [number, number],
  time: { readonly any: true } | { readonly fromIso: string; readonly toIso: string } | undefined,
  observations: readonly QualificationObservation[]): QualificationAction[] {
  const route = ROUTES.find(entry => entry.telescope === telescope && entry.mode === mode);
  if (!route) return [];
  const channels = route.channels.filter(entry => entry.wavelengthMicrometres[0] <= wavelengthMicrometres[0] && entry.wavelengthMicrometres[1] >= wavelengthMicrometres[1]);
  if (channels.length !== 1) return [];
  const channel = channels[0]!.channel;
  return observations.filter(observation => overlapsTime(observation, time)).map(observation => {
    const program = `${target}-${observation.id}`;
    return { kind: 'qualify-observation', observation: observation.id, ...(observation.programme ? { archiveProgramme: observation.programme } : {}), program, channel,
      command: 'pnpm', arguments: ['--silent', 'telescope:qualify', '--target', target, '--telescope', telescope, '--mode', mode,
        '--observation', observation.id, '--channel', String(channel)] };
  });
}

export function supportsQualificationRoute(telescope: string, mode: string, channel: number): boolean {
  return ROUTES.some(route => route.telescope === telescope && route.mode === mode && route.channels.some(entry => entry.channel === channel));
}
