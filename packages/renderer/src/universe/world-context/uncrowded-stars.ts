/**
 * A star that is not featured is a dot that names itself on hover, and past its system it gives way to the catalogue dots:
 * thousands of them would bury the view. Out there, where nothing else is marked within its ring, it is no part of a
 * crowd: it keeps its marker, and it is named after every other caption has its place, where its caption covers no other
 * marker. Inside a system the stars behind it stay dots, as before: the view is of the system.
 *
 * Each frame decides from its own projection. The frame's markers are filed by screen cell in arrays kept between frames,
 * so a frame allocates nothing: the head of each cell's chain, and each marker's next.
 */
import { UNIVERSE_LABEL_POLICY } from '../../labels/universe-label-policy.js';

export interface CrowdMarker {
  readonly x: number; readonly y: number; readonly inFrame: boolean; markerOpacity: number;
  /** A star of the field that is not featured, in a view past its system. */ quietStar?: boolean;
  /** The marker opacity it has when nothing crowds it. */ uncrowdedOpacity?: number;
  /** Nothing else is marked where its ring would stand: it keeps its marker and may be named. */ uncrowded?: boolean;
  readonly entry: { readonly indicatorShown: boolean };
}

/** `ringDiameter`: the width of a body's circle, in pixels. */
export function createUncrowdedStars(ringDiameter: number) {
  const cell = 2 * ringDiameter;
  let cells = new Int32Array(0), chain = new Int32Array(0), markers: readonly CrowdMarker[] = [], columns = 0, rows = 0, halfWidth = 0, halfHeight = 0;
  const column = (x: number) => Math.min(columns - 1, Math.max(0, Math.floor((x + halfWidth) / cell)));
  const row = (y: number) => Math.min(rows - 1, Math.max(0, Math.floor((y + halfHeight) / cell)));
  /** Whether a marker other than `self` stands inside the rectangle. */
  const marked = (left: number, top: number, right: number, bottom: number, self: CrowdMarker) => {
    for (let r = row(top), lastRow = row(bottom); r <= lastRow; r++) for (let c = column(left), lastColumn = column(right); c <= lastColumn; c++) {
      for (let index = cells[c + columns * r]!; index >= 0; index = chain[index]!) {
        const other = markers[index]!;
        if (other !== self && other.x >= left && other.x <= right && other.y >= top && other.y <= bottom) return true;
      }
    }
    return false;
  };
  return {
    marked,
    /** Files the frame's markers, then gives back its marker to each quiet star that nothing crowds. A marker already
     * shown stays until another comes inside its ring; one not shown needs the label spacing clear as well. */
    keep(frame: readonly CrowdMarker[], width: number, height: number) {
      markers = frame; halfWidth = width / 2; halfHeight = height / 2; columns = Math.ceil(width / cell) + 1; rows = Math.ceil(height / cell) + 1;
      if (cells.length < columns * rows) cells = new Int32Array(columns * rows);
      if (chain.length < frame.length) chain = new Int32Array(frame.length);
      cells.fill(-1, 0, columns * rows);
      for (let index = 0; index < frame.length; index++) {
        const marker = frame[index]!;
        if (!marker.inFrame) continue;
        const at = column(marker.x) + columns * row(marker.y);
        chain[index] = cells[at]!; cells[at] = index;
      }
      for (const marker of frame) {
        if (!marker.quietStar || !marker.inFrame) continue;
        const reach = ringDiameter / 2 + (marker.entry.indicatorShown ? 0 : UNIVERSE_LABEL_POLICY.spacingPixels);
        marker.uncrowded = !marked(marker.x - reach, marker.y - reach, marker.x + reach, marker.y + reach, marker);
        if (marker.uncrowded) marker.markerOpacity = marker.uncrowdedOpacity!;
      }
    },
  };
}
