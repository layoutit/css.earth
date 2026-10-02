import type { OrbitLineFade } from '../navigation/types.js';
import { orbitLineOpacity } from '../navigation/perspective-dolly.js';

// Every dimming of the world context is one of these four, and the planner applies each in one place.
/** Context paths while the focused body fills the view. */
const CLOSE_ORBIT_OPACITY = .3;
/** Paths outside the subject's family. */
const OUTSIDE_FAMILY_OPACITY = .25;
/** Bodies outside a highlighted category. */
const UNHIGHLIGHTED_OPACITY = .3;
/** Other stars' bodies seen from inside the focus star's system, in steps so a dolly rewrites few opacities. */
const OTHER_SYSTEM_OPACITY = .3, OTHER_SYSTEM_STEPS = 16;

/** A star orbits nothing. A planet orbits a system's star, directly or about a barycentre: a planet, a dwarf planet, an
 * asteroid, a comet or a companion star. A satellite orbits a body that itself orbits. */
export type BodyRole = 'star' | 'planet' | 'satellite';

/** What the reader is looking at. `body`: one object's page, or the destination of a flight. `system`: a host with its
 * moons (the moons view). `none`: an overview of a star's system, or wider. */
export interface ContextSubject {
  readonly kind: 'none' | 'system' | 'body';
  /** The subject body; null in an overview. */
  readonly id: string | null;
  /** The host of the focused body's family: that body, or the one it circles when it is a satellite. An overview keeps the
   * family of the body it was opened from, so a framed planet's moons stay named. */
  readonly hostId: string;
  /** The subject is its family's host, not one of the host's satellites. */
  readonly hostIsSubject: boolean;
  /** The family's host is a star. */
  readonly hostIsStar: boolean;
}

/** A body against the subject: the subject itself, a member of its family (it circles the family's host), or outside. */
export type SubjectRelation = 'subject' | 'family' | 'outside';

interface FocusBody { readonly id: string; readonly role: BodyRole; readonly hostId: string | undefined }

/** The one subject of a frame. `focus` is the body whose detail is drawn or flown to: the previewed body, else the selected
 * one. A flight previews its destination: a body, or an overview (`preview` null). */
export function contextSubject(focus: FocusBody, overview: boolean, overviewSelection: boolean, preview: string | null | undefined): ContextSubject {
  const kind = preview === null ? 'none' : preview !== undefined || !overview ? 'body' : overviewSelection ? 'system' : 'none';
  const hostId = focus.role === 'satellite' && focus.hostId !== undefined ? focus.hostId : focus.id;
  return { kind, id: kind === 'none' ? null : focus.id, hostId, hostIsSubject: hostId === focus.id, hostIsStar: hostId === focus.id && focus.role === 'star' };
}

export function subjectRelation(subject: ContextSubject, id: string, hostId: string | undefined): SubjectRelation {
  return id === subject.id ? 'subject' : hostId === subject.hostId ? 'family' : 'outside';
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
 * `host` is the family's host, absent in an overview or when it is a star. On a body's page the dimming relaxes from half
 * to twice the host's distance from its star, where the subject is the parent system again; a moons view keeps it.
 * 1/64 steps avoid rewriting opacity for tiny camera changes. */
export function outsideFamilyOrbitOpacity<Host extends { readonly positionM: readonly number[]; readonly orbit?: { readonly centerPositionM: readonly number[] } | null }>(
  host: Host | undefined, cameraDistanceM: (host: Host) => number, held: boolean): number {
  if (!host?.orbit) return 1;
  const radiusM = Math.hypot(...host.positionM.map((value, axis) => value - host.orbit!.centerPositionM[axis]!));
  const t = held || !(radiusM > 0) ? 0 : Math.max(0, Math.min(1, Math.log2(cameraDistanceM(host) / (.5 * radiusM)) / 2));
  return 1 - (1 - OUTSIDE_FAMILY_OPACITY) * Math.round((1 - t * t * (3 - 2 * t)) * 64) / 64;
}

/** The opacity of one path, before its size on screen and its system's fade. `flagged`: hovered or highlighted.
 * The subject's own path fades with its growth. A host's page is its close detail, not its satellite system, so its
 * moons' paths fade with it too; a moon's page and a moons view keep the family's paths. Everything else is context. */
export function pathOpacity(subject: ContextSubject, relation: SubjectRelation, flagged: boolean,
  fades: { readonly context: number; readonly own: number }, outsideFamily: number): number {
  if (subject.kind === 'none') return fades.context;
  if (relation === 'subject' && subject.kind === 'body') return fades.own;
  if (relation === 'family') return subject.kind === 'body' && subject.hostIsSubject && !subject.hostIsStar && !flagged ? fades.own : fades.context;
  return flagged ? fades.context : fades.context * fades.own * outsideFamily;
}

/** A moon outside the subject's family is not named, and beside a planet's or a moon's page neither are the minor bodies
 * of its star. A target, a resolved disc and an orientation reference are named whatever this says. */
export function namedBesideSubject(subject: ContextSubject, relation: SubjectRelation, role: BodyRole, minor: boolean): boolean {
  return relation !== 'outside' || !(role === 'satellite' || subject.kind !== 'none' && !subject.hostIsStar && minor);
}

/** Inside the focus star's system, other systems' bodies stay clickable but read as not belonging to it; they come up to
 * full as the stars around the system fill the view (`starField`, 0 to 1). */
export function otherSystemsOpacity(focusSystemOpacity: number, starField: number): number {
  return focusSystemOpacity > .5
    ? OTHER_SYSTEM_OPACITY + (1 - OTHER_SYSTEM_OPACITY) * Math.round(starField * OTHER_SYSTEM_STEPS) / OTHER_SYSTEM_STEPS : 1;
}

/** The one alpha a body's marker, caption and path share on top of their own fades. A hovered body is never dimmed. */
export function contextEmphasis(hovered: boolean, outsideHighlight: boolean, inFocusSystem: boolean, otherSystems: number): number {
  return hovered ? 1 : (outsideHighlight ? UNHIGHLIGHTED_OPACITY : 1) * (inFocusSystem ? 1 : otherSystems);
}
