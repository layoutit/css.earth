/**
 * Which released frames a survey lens casts.
 *
 * A lens is anchored on one apparition: the one whose frames the paper's comparison figure shows most, then the one with
 * more frames, then the earlier. It also casts every other apparition its level fit can reach, which `apparitions.mts`
 * decides from the surface they share. Within those apparitions the survey took short series of exposures a minute or a
 * few apart at each epoch; every camera-1 frame is kept while they fit the controlled-camera bound. More frames keep every
 * series, each thinned to the same number of frames, with the places left over going to the earliest series, so every
 * rotational phase the survey caught stays. The frames the figure shows are always kept, and within a series the frames
 * nearest them come first.
 */
import { CONTROLLED_CAMERA_MAXIMUM_FRAMES, DECONVOLVED_SEASON_GAP_DAYS } from '../surface-observations/formats/controlled-camera.mts';

/** Frames further apart than this belong to different apparitions: an apparition is one observing season of the level fit. */
export const APPARITION_GAP_DAYS = DECONVOLVED_SEASON_GAP_DAYS;
/** Exposures closer than this belong to one series. */
export const SERIES_GAP_MINUTES = 10;

export interface TimedFrame { start: string }
const time = (frame: TimedFrame) => Date.parse(`${frame.start}Z`);

function groups<T extends TimedFrame>(frames: readonly T[], gapMilliseconds: number) {
  const sorted = [...frames].sort((a, b) => time(a) - time(b)), result: T[][] = [];
  for (const frame of sorted) {
    const last = result.at(-1);
    if (last && time(frame) - time(last.at(-1)!) < gapMilliseconds) last.push(frame);
    else result.push([frame]);
  }
  return result;
}
export const apparitions = <T extends TimedFrame>(frames: readonly T[]) => groups(frames, APPARITION_GAP_DAYS * 86_400_000);
export const series = <T extends TimedFrame>(frames: readonly T[]) => groups(frames, SERIES_GAP_MINUTES * 60_000);

/** The apparitions in time order, and the index of the one a lens is anchored on. `shown` are the frames the figure prints. */
export function anchorApparition<T extends TimedFrame>(frames: readonly T[], shown: readonly T[]) {
  if (!frames.length) throw new Error('No released frames to select from.');
  const all = apparitions(frames);
  const ranked = all.map((members, order) => ({ order, shown: members.filter(frame => shown.includes(frame)).length, size: members.length }))
    .sort((a, b) => b.shown - a.shown || b.size - a.size || a.order - b.order);
  return { apparitions: all, anchor: ranked[0].order };
}

/** The frames a lens keeps from the apparitions it casts, in time order. `shown` are the frames the figure prints. */
export function selectFrames<T extends TimedFrame>(frames: readonly T[], shown: readonly T[], maximum = CONTROLLED_CAMERA_MAXIMUM_FRAMES): T[] {
  if (!frames.length) throw new Error('No released frames to select from.');
  const chosen = [...frames].sort((a, b) => time(a) - time(b));
  if (chosen.length <= maximum) return chosen;
  const groupsOf = series(chosen).map(members => {
    const anchors = members.filter(frame => shown.includes(frame));
    // The figure's frames first, then the others nearest them in time, or in time order where the figure shows none.
    const order = anchors.length ? [...members].sort((a, b) => Number(!anchors.includes(a)) - Number(!anchors.includes(b))
      || Math.min(...anchors.map(anchor => Math.abs(time(a) - time(anchor)))) - Math.min(...anchors.map(anchor => Math.abs(time(b) - time(anchor))))
      || time(a) - time(b)) : members;
    return order;
  });
  if (groupsOf.length > maximum) throw new Error(`The apparitions hold more series than the ${maximum}-frame bound.`);
  let each = 1;
  while (groupsOf.reduce((sum, members) => sum + Math.min(members.length, each + 1), 0) <= maximum && groupsOf.some(members => members.length > each)) each++;
  const kept = groupsOf.map(members => members.slice(0, each));
  let spare = maximum - kept.reduce((sum, members) => sum + members.length, 0);
  // One more frame to each series in turn, earliest first, until the bound is reached.
  for (let added = true; spare > 0 && added;) {
    added = false;
    for (const [index, members] of groupsOf.entries()) if (spare > 0 && kept[index].length < members.length) { kept[index].push(members[kept[index].length]); spare--; added = true; }
  }
  const missing = shown.filter(frame => chosen.includes(frame) && !kept.flat().includes(frame));
  if (missing.length) throw new Error(`The frames the figure shows do not fit the ${maximum}-frame bound.`);
  return kept.flat().sort((a, b) => time(a) - time(b));
}
