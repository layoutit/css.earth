import type { OrbitLineFade } from '@cssearth/objects';
import { orbitLineOpacity } from '../navigation/perspective-dolly.js';

// Every dimming of the world context is one of these four, and the planner applies each in one place.
/** Context paths while the focused body fills the view. */
const CLOSE_ORBIT_OPACITY = .3;
/** Paths outside the subject's family. */
const OUTSIDE_FAMILY_OPACITY = .25;
/** Bodies outside a highlighted category. */
export const UNHIGHLIGHTED_OPACITY = .3;
/** Other stars' bodies seen from inside a star's system, in steps so a dolly rewrites few opacities. */
const OTHER_SYSTEM_OPACITY = .3, OTHER_SYSTEM_STEPS = 16;

/** What the reader is looking at, resolved once per frame. Every rule about what belongs to the selection reads it. */
export interface ContextSubject {
  /** How paths are framed. `body`: one object's page, or a flight to one. `system`: a host with its moons (the moons
   * view). `none`: an overview. */
  readonly kind: 'none' | 'system' | 'body';
  /** The emphasised body: the flight's destination, else the selected body; null in an overview and on a flight to one. */
  readonly id: string | null;
  /** The body whose detail is drawn or flown to: the previewed body, else the selected one. */
  readonly focusId: string;
  /** The host of the focused body's family: that body, or the one it circles when that is not a system's star. */
  readonly hostId: string;
  /** The family's host is a system's star. */
  readonly hostIsStar: boolean;
  /** The hosts whose satellites are planned and named: the focused body's and, through a flight, the selected body's. */
  readonly families: ReadonlySet<string>;
  /** A selected body's own page, with no flight: a host's page fades its moons' paths with the host. */
  readonly page: boolean;
  /** A moons view is selected: it holds its host as the subject, and the dimming outside the family includes the host's
   * own path. */
  readonly held: boolean;
  /** Beside the page of a body that is not a system's star, that star's minor bodies are not named. */
  readonly quietMinors: boolean;
}

interface SubjectBody { readonly id: string; readonly centreId: string | undefined }

/** The one subject of a frame. A flight previews its destination: a body, or an overview (`preview` null). */
export function contextSubject(selected: SubjectBody, previewed: SubjectBody | undefined, preview: string | null | undefined,
  overview: boolean, overviewSelection: boolean, isSystemStar: (id: string) => boolean): ContextSubject {
  const focus = previewed ?? selected, kind = previewed || !overview ? 'body' : overviewSelection ? 'system' : 'none';
  const id = preview === undefined ? (overview && !overviewSelection ? null : selected.id) : preview;
  const hostOf = (body: SubjectBody) => body.centreId !== undefined && !isSystemStar(body.centreId) ? body.centreId : body.id;
  const hostId = hostOf(focus), families = new Set([hostOf(selected), ...(id === null ? [] : [hostId])]);
  return { kind, id, focusId: focus.id, hostId, hostIsStar: isSystemStar(hostId), families, page: !overview && preview == null,
    held: overview && overviewSelection, quietMinors: !overview && !isSystemStar(selected.id) };
}

/** A body is in the subject's family when it circles the family's host. */
export function inSubjectFamily(subject: ContextSubject, centreId: string | undefined): boolean {
  return centreId === subject.hostId;
}

/** At close range retain the nearby orbit, then soften its distant continuation.
 * At system scale the full orbit lies inside the unfaded range. */
export function selectedOrbitDepthFade(cameraDistanceM: number) {
  return { start: cameraDistanceM * 4, end: cameraDistanceM * 16 };
}

/** The two close-up fades of a frame, by the focused body's share of the view height. `context` softens lines without
 * removing their projected paths. `own` has no floor: up close a body's own orbit is a line through its centre that says
 * nothing, as a map shows no orbit at all; it fades out with the body's growth and returns as the camera pulls back. */
export function closeOrbitFades(fade: OrbitLineFade, discHeightShare: number) {
  const own = orbitLineOpacity(fade, discHeightShare);
  return { context: CLOSE_ORBIT_OPACITY + (1 - CLOSE_ORBIT_OPACITY) * own, own };
}

/** An orbit belongs to the family it circles, not the body travelling on it, so a path outside the subject's family is
 * dim context: the other planets', and the host's own path about its star when the subject is not the host itself.
 * `host` is the family's host, absent without an emphasised body or when it is a star. The dimming relaxes from half to
 * twice the host's distance from its star, where the view is the parent system again; a moons view relaxes it too.
 * 1/64 steps avoid rewriting opacity for tiny camera changes. */
export function outsideFamilyOrbitOpacity<Host extends { readonly positionM: readonly number[]; readonly orbit?: { readonly centerPositionM: readonly number[] } | null }>(
  host: Host | undefined, cameraDistanceM: (host: Host) => number): number {
  if (!host?.orbit) return 1;
  const radiusM = Math.hypot(...host.positionM.map((value, axis) => value - host.orbit!.centerPositionM[axis]!));
  const t = !(radiusM > 0) ? 0 : Math.max(0, Math.min(1, Math.log2(cameraDistanceM(host) / (.5 * radiusM)) / 2));
  return 1 - (1 - OUTSIDE_FAMILY_OPACITY) * Math.round((1 - t * t * (3 - 2 * t)) * 64) / 64;
}

/** The opacity of one path, before its size on screen and its system's fade. `emphasised`: the subject's own body.
 * `flagged`: hovered or highlighted. `fadesWithFocus`: the focused body's own path on its page or flight, and a moon's
 * path on its host's page; such a path fades out with the body's growth. Everything else softens as context, and a path
 * outside the family also dims. */
export function pathOpacity(subject: ContextSubject, inFamily: boolean, emphasised: boolean, fadesWithFocus: boolean, flagged: boolean,
  fades: { readonly context: number; readonly own: number }, outsideFamily: number): number {
  const close = fadesWithFocus ? fades.own : subject.kind === 'body' && !inFamily && !emphasised && !flagged ? fades.context * fades.own : fades.context;
  return !inFamily && !flagged && (subject.held || !emphasised) ? close * outsideFamily : close;
}

/** A moon is named inside the families the subject keeps, and beside a planet's or a moon's page the minor bodies of its
 * star are not. A target, a resolved disc and an orientation reference are named whatever this says. */
export function namedBesideSubject(subject: ContextSubject, satelliteOf: string | undefined, minor: boolean): boolean {
  return satelliteOf === undefined ? !(minor && subject.quietMinors) : subject.families.has(satelliteOf);
}

/** Inside a star's system, the Sun's or a placed star's (the camera's own), other systems' bodies stay clickable but read
 * as not belonging to it; they come up to full as the stars around the system fill the view (`starField`, 0 to 1). */
export function otherSystemsOpacity(ownSystemOpacity: number, starField: number): number {
  return ownSystemOpacity > .5
    ? OTHER_SYSTEM_OPACITY + (1 - OTHER_SYSTEM_OPACITY) * Math.round(starField * OTHER_SYSTEM_STEPS) / OTHER_SYSTEM_STEPS : 1;
}

/** The one alpha a body's marker, caption and path share on top of their own fades. A hovered body is never dimmed. */
export function contextEmphasis(hovered: boolean, outsideHighlight: boolean, inOwnSystem: boolean, otherSystems: number): number {
  return hovered ? 1 : (outsideHighlight ? UNHIGHLIGHTED_OPACITY : 1) * (inOwnSystem ? 1 : otherSystems);
}
