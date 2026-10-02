import type { WorldPosition as PositionM } from './world-frame.js';
import { array, numbers, positive, record, text, unique } from './world-guards.js';
import { validateWorldRotation } from '../registry/world-rotation.js';
import type { PreparedContextBody, PreparedWorldContext } from './world-context.js';

function vector(value: unknown, label: string): PositionM {
  const values = numbers(value, label, 3);
  return Object.freeze([values[0], values[1], values[2]]);
}
export interface PreparedSystemViewCandidate { readonly cameraToReference: readonly number[];
  readonly minimumM: PositionM; readonly maximumM: PositionM; readonly memberPositionsM: readonly PositionM[] }
function parseSystemViewCandidates(value: unknown, memberCount: number, id: string): readonly PreparedSystemViewCandidate[] {
  const candidates = array(value, `system view ${id} candidates`).map(value => {
    const candidate = record(value, 'system view candidate', ['cameraToReference', 'minimumM', 'maximumM', 'memberPositionsM']);
    const cameraToReference = numbers(candidate.cameraToReference, 'system view rotation');
    validateWorldRotation(cameraToReference);
    const minimumM = vector(candidate.minimumM, 'system view minimum'), maximumM = vector(candidate.maximumM, 'system view maximum');
    if (minimumM.some((value, axis) => value >= maximumM[axis]!)) throw new TypeError(`System view ${id} bounds must have positive extent.`);
    const memberPositionsM = array(candidate.memberPositionsM, 'system member positions').map(value => vector(value, 'system member position'));
    if (memberPositionsM.length !== memberCount) throw new TypeError(`System view ${id} has ${memberPositionsM.length} member positions for ${memberCount} members.`);
    return Object.freeze({ cameraToReference: Object.freeze(cameraToReference), minimumM, maximumM, memberPositionsM: Object.freeze(memberPositionsM) });
  });
  if (!candidates.length) throw new TypeError(`System view ${id} must include candidate views.`);
  return Object.freeze(candidates);
}
/** The full context's views carry their camera candidates; the summary's name their members only. */
export function parseSystemView(value: unknown, withCandidates = true): PreparedContextBody['systemView'] {
  if (value === undefined) return undefined;
  const view = record(value, 'system view', withCandidates ? ['memberIds', 'memberRadiiM', 'candidates'] : ['memberIds', 'memberRadiiM']);
  const memberIds = array(view.memberIds, 'system members').map(id => text(id, 'system member id'));
  if (!memberIds.length) throw new TypeError('System view must include members.');
  unique(memberIds, 'system member ids');
  // Zero is a member drawn from its record with no measured radius; each radius is checked against its body below.
  const memberRadiiM = array(view.memberRadiiM, 'system member radii').map((value, index) => value === 0 ? 0 : positive(value, `system member ${memberIds[index]} radius`));
  if (memberRadiiM.length !== memberIds.length) throw new TypeError('System view needs one radius per member.');
  const members = { memberIds: Object.freeze(memberIds), memberRadiiM: Object.freeze(memberRadiiM) };
  return Object.freeze(withCandidates ? { ...members, candidates: parseSystemViewCandidates(view.candidates, memberIds.length, memberIds.join(',')) } : members);
}
/** `system-views/<host id>.json`: one system's camera candidates, checked against that host's system view in the summary. */
export function parsePreparedSystemView(value: unknown, plan: Pick<PreparedWorldContext, 'focus' | 'bodies'>, id: string): { readonly candidates: readonly PreparedSystemViewCandidate[] } {
  const input = record(value, 'system view', ['schema', 'id', 'candidates']);
  if (input.schema !== 'cssearth-world-system-view@1') throw new TypeError(`Unsupported prepared system view for ${id}: ${String(input.schema)}.`);
  if (input.id !== id) throw new TypeError(`Prepared system view for ${id} names ${String(input.id)}.`);
  const host = [plan.focus, ...plan.bodies].find(body => body.id === id);
  if (!host?.systemView) throw new TypeError(`The world context has no system view for ${id}.`);
  return Object.freeze({ candidates: parseSystemViewCandidates(input.candidates, host.systemView.memberIds.length, id) });
}
/** Classification views frame prepared bodies by position; members must match those bodies. */
export function parseClassificationViews(value: unknown, bodies: readonly PreparedContextBody[]) {
  if (value === undefined) return undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new TypeError('Classification views must be a record.');
  const byId = new Map(bodies.map(body => [body.id, body]));
  const entries = Object.entries(value).map(([classification, input]) => {
    const view = parseSystemView(input);
    if (!/^[a-z][a-z0-9-]*$/.test(classification) || !view) throw new TypeError('Invalid classification view.');
    for (const [index, id] of view.memberIds.entries()) {
      if (byId.get(id)?.radiusM !== view.memberRadiiM[index]) throw new TypeError('Classification view members must match their prepared bodies.');
    }
    return [classification, view] as const;
  });
  if (!entries.length) throw new TypeError('Classification views must name a classification.');
  return Object.freeze(Object.fromEntries(entries));
}

export interface PreparedSystemView { readonly memberIds: readonly string[]; readonly memberRadiiM: readonly number[]; readonly candidates: readonly PreparedSystemViewCandidate[]; }
