import { parsePreparedWorldCameraFrame } from '../validation/world-frame.js';
import { finite, positive, record, text } from '../validation/guards.js';
import type { PreparedContextCameraPresentation, PreparedWorldContext } from '../prepared-data/world-context.js';

// What a mounted body reads from the world, kept apart from the world context's parser so a body's first mount does
// not load the whole world module.

/** The shared frame, the focus body's identity and the camera (`cssearth-world-camera@1`). Each page embeds it, so a
 * body mounts before the world summary has downloaded. */
export interface PreparedWorldCamera { readonly frame: PreparedWorldContext['frame']; readonly focusId: string; readonly camera: PreparedWorldContext['camera']; }
export const PREPARED_WORLD_CAMERA_SCHEMA = 'cssearth-world-camera@1';

/** The world camera record of a prepared world context or its summary: the fields a page embeds, unvalidated. */
export function worldCameraOf(context: { readonly frame: unknown; readonly focus: { readonly id: string }; readonly camera: unknown }) {
  return { schema: PREPARED_WORLD_CAMERA_SCHEMA, frame: context.frame, focusId: context.focus.id, camera: context.camera };
}

export function parsePreparedWorldCamera(value: unknown): PreparedWorldCamera {
  const input = record(value, 'world camera', ['schema', 'frame', 'focusId', 'camera']);
  if (input.schema !== PREPARED_WORLD_CAMERA_SCHEMA) throw new TypeError(`Unsupported world camera: ${String(input.schema)}.`);
  const camera = record(input.camera, 'world camera', ['minimumDistanceM', 'maximumDistanceM', 'framingReferenceZoom', 'presentation']);
  const minimumDistanceM = positive(camera.minimumDistanceM, 'minimum camera distance');
  const maximumDistanceM = positive(camera.maximumDistanceM, 'maximum camera distance');
  if (!(maximumDistanceM > minimumDistanceM)) throw new TypeError('World camera distance interval is invalid.');
  const focusId = text(input.focusId, 'world camera focus');
  if (!/^[a-z][a-z0-9-]*$/.test(focusId)) throw new TypeError('Invalid world camera focus identity.');
  const frame = parsePreparedWorldCameraFrame(input.frame);
  if (!frame) throw new TypeError('World camera requires its prepared frame.');
  return Object.freeze({ frame, focusId,
    camera: Object.freeze({ minimumDistanceM, maximumDistanceM, framingReferenceZoom: positive(camera.framingReferenceZoom, 'framing reference zoom'),
      presentation: parsePresentation(camera.presentation) }) });
}

export function parsePresentation(value: unknown): PreparedContextCameraPresentation {
  const input = record(value, 'context camera presentation', ['projection', 'dolly', 'levelOfDetail', 'orbitLineFade', 'drag']);
  const projection = record(input.projection, 'context projection', ['model', 'cssPerspective']);
  if (projection.model !== 'css-perspective-shared-with-sky') throw new TypeError('Unsupported context projection.');
  const dolly = record(input.dolly, 'context dolly', ['model', 'wheelStepPerDelta', 'minimumDistanceRadii', 'maximumDistanceOverOrbitExtent']);
  if (dolly.model !== 'multiplicative-wheel-distance') throw new TypeError('Unsupported context dolly.');
  const minimumDistanceRadii = positive(dolly.minimumDistanceRadii, 'context minimum dolly distance');
  if (!(minimumDistanceRadii > 1)) throw new TypeError('Context camera must remain outside the focus.');
  const levelOfDetail = record(input.levelOfDetail, 'context level of detail', ['model', 'billboardFadeStartDiscPixels', 'billboardFullDiscPixels', 'markerFadeStartDiscPixels', 'markerFullDiscPixels']);
  if (levelOfDetail.model !== 'silhouette-diameter-crossfade') throw new TypeError('Unsupported context level of detail.');
  const billboardFadeStartDiscPixels = positive(levelOfDetail.billboardFadeStartDiscPixels, 'context billboard fade start');
  const billboardFullDiscPixels = positive(levelOfDetail.billboardFullDiscPixels, 'context billboard full');
  const markerFadeStartDiscPixels = positive(levelOfDetail.markerFadeStartDiscPixels, 'context marker fade start');
  const markerFullDiscPixels = positive(levelOfDetail.markerFullDiscPixels, 'context marker full');
  if (!(billboardFadeStartDiscPixels > billboardFullDiscPixels && billboardFullDiscPixels > markerFadeStartDiscPixels && markerFadeStartDiscPixels > markerFullDiscPixels)) throw new TypeError('Context level-of-detail thresholds must descend.');
  const orbitLineFade = record(input.orbitLineFade, 'context orbit-line fade', ['visibleBelowDiscHeightShare', 'hiddenAboveDiscHeightShare']);
  const visibleBelowDiscHeightShare = finite(orbitLineFade.visibleBelowDiscHeightShare, 'context orbit visible threshold');
  const hiddenAboveDiscHeightShare = finite(orbitLineFade.hiddenAboveDiscHeightShare, 'context orbit hidden threshold');
  if (!(hiddenAboveDiscHeightShare > visibleBelowDiscHeightShare)) throw new TypeError('Context orbit fade bounds are invalid.');
  const drag = record(input.drag, 'context drag', ['model']);
  if (drag.model !== 'screen-axis-tumble') throw new TypeError('Unsupported context drag.');
  return Object.freeze({ projection: Object.freeze({ model: projection.model, cssPerspective: text(projection.cssPerspective, 'context CSS perspective') }),
    dolly: Object.freeze({ model: dolly.model, wheelStepPerDelta: positive(dolly.wheelStepPerDelta, 'context wheel step'), minimumDistanceRadii, maximumDistanceOverOrbitExtent: positive(dolly.maximumDistanceOverOrbitExtent, 'context orbit extent') }),
    levelOfDetail: Object.freeze({ model: levelOfDetail.model, billboardFadeStartDiscPixels, billboardFullDiscPixels, markerFadeStartDiscPixels, markerFullDiscPixels }),
    orbitLineFade: Object.freeze({ visibleBelowDiscHeightShare, hiddenAboveDiscHeightShare }), drag: Object.freeze({ model: drag.model }) });
}
