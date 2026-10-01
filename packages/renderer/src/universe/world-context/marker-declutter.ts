/**
 * Markers that overlap a marker the planner keeps are not drawn. Where a whole system shrinks to a few pixels, its markers
 * pile onto one another: zooming out from the Sun, 246 to 363 markers drew into about 40 by 12 pixels at 84 to 582 AU
 * (2026-09-30), each restyled and composited every frame though almost all were under others. Markers are kept in order:
 * those the reader picked (the focus, the selection, a hovered or highlighted body), then by annotation tier, then those
 * with an admitted label or circle, then by the planner's frame priority. A marker is hidden when its drawn dot overlaps a
 * kept one. Tier comes before an admitted label: a label is admitted only once measured, and only a drawn marker is
 * measured, so ranking labels first let a labelled moon hide its planet's dot for good (Rhea over Saturn at 220 AU).
 * A hidden marker returns only when it clears by HYSTERESIS more, so a zoom does not blink dots at the edge of overlapping.
 */
import { MINIMUM_BODY_MARKER_DIAMETER_PIXELS } from '../../solar-system/heliocentric-sprites.js';

/** How much farther than touching a hidden marker must be from every kept one to return. */
const HYSTERESIS = 1.15;
/** The grid the kept markers are filed in, in pixels: wider than any two piled dots' reach, so a dot's neighbours are in
 * its own cell and the eight around it. */
const CELL_PIXELS = 16;

export interface DeclutterMarker {
  readonly x: number; readonly y: number; readonly diameter: number; visible: boolean; readonly hovered: boolean; readonly priority: number;
  readonly entry: { readonly body: { readonly id: string }; readonly highlighted?: boolean; readonly labelShown: boolean; readonly indicatorShown: boolean };
}

export function createMarkerDeclutter(annotationPriorities: Readonly<Record<string, number>>) {
  let hidden = new Set<object>();
  const kept = new Map<number, { x: number; y: number; radius: number }[]>();
  /** Hides each visible marker that overlaps one kept before it; `pinned` ids (the focus, the selection) and hovered or
   * highlighted bodies are always kept. */
  return (markers: readonly DeclutterMarker[], pinned: readonly (string | null)[]) => {
    const picked = (marker: DeclutterMarker) => pinned.includes(marker.entry.body.id) || marker.hovered || marker.entry.highlighted === true;
    const order = markers.filter(marker => marker.visible).map(marker => ({ marker, named: picked(marker),
      tier: annotationPriorities[marker.entry.body.id] ?? 0, annotated: marker.entry.labelShown || marker.entry.indicatorShown })).sort((a, b) =>
      Number(b.named) - Number(a.named) || b.tier - a.tier || Number(b.annotated) - Number(a.annotated) || b.marker.priority - a.marker.priority);
    kept.clear();
    const next = new Set<object>();
    for (const { marker, named: always } of order) {
      const radius = Math.max(marker.diameter, MINIMUM_BODY_MARKER_DIAMETER_PIXELS) / 2, scale = hidden.has(marker.entry) ? HYSTERESIS : 1;
      const column = Math.floor(marker.x / CELL_PIXELS), row = Math.floor(marker.y / CELL_PIXELS);
      let covered = false;
      for (let dy = -1; !always && !covered && dy <= 1; dy++) for (let dx = -1; !covered && dx <= 1; dx++) {
        for (const other of kept.get((row + dy) * 65536 + column + dx) ?? []) {
          if (Math.hypot(other.x - marker.x, other.y - marker.y) < (other.radius + radius) * scale) { covered = true; break; }
        }
      }
      if (covered) { marker.visible = false; next.add(marker.entry); continue; }
      const key = row * 65536 + column, cell = kept.get(key);
      if (cell) cell.push({ x: marker.x, y: marker.y, radius }); else kept.set(key, [{ x: marker.x, y: marker.y, radius }]);
    }
    hidden = next;
  };
}
