import { preparedResourcePool, type PreparedMaterialSelection, type PreparedResourceEntry } from '@cssearth/objects';

import type { SheetLighting, SourceMaterialTrack } from '../types.ts';

const SHEET_KEY = 'lighting', SHADOWLESS_KEY = 'shadowless';

/**
 * The lighting track of a sphere drawn from one sheet (packages/bake/src/raster/lighting-sheet.ts): its resources, their
 * pool, the track on a target node and the selection a variant makes of it. `floodPool` is the pool of the lane's
 * startup images, where the flood-lit frame belongs.
 *
 * With shadows off a body shows the flood-lit frame, a file of its own that loads with the page. The sheet loads when
 * shadows are turned on and then serves every phase and every distance, so turning the camera asks for nothing more.
 */
export function prepareSheetLighting(lighting: SheetLighting, floodPool = 'warm') {
  const { sheet, shadowless, frameCount } = lighting;
  if (sheet.presentations.length !== frameCount) throw new TypeError(`The lighting sheet addresses ${sheet.presentations.length} frames of ${frameCount}.`);
  const entries: PreparedResourceEntry[] = [{ key: SHADOWLESS_KEY, url: shadowless.url, pool: floodPool }, { key: SHEET_KEY, url: sheet.url, pool: 'lighting' }];
  const track = (target: number): SourceMaterialTrack => ({ id: 'lighting', target,
    // The frames are lit from the +x side; the page selects one by the light's view z and turns it by the light's roll.
    frame: { count: frameCount, samples: sheet.presentations.map(frame => [Math.sqrt(Math.max(0, 1 - frame.lightViewZ ** 2)), 0, frame.lightViewZ] as const) },
    banks: [{ id: 'sheet', frames: sheet.presentations.map(frame => ({ resource: SHEET_KEY, frame: frame.frameIndex, row: null,
        backgroundPosition: frame.backgroundPosition, backgroundSize: frame.backgroundSize })), default: null,
      fixed: { resource: SHADOWLESS_KEY, frame: shadowless.frameIndex, row: null, backgroundPosition: shadowless.backgroundPosition, backgroundSize: shadowless.backgroundSize } }],
    demand: { capacity: 1, defaultFrame: lighting.defaultFrame },
    rotation: { kind: 'angle', source: 'view-sun', reference: 'prepared', baseDegrees: 0, zeroAtPole: false },
    frameAttribute: null, modeAttribute: null, quoted: true });
  const selection = (shadows: boolean): PreparedMaterialSelection => ({ track: 'lighting', bank: 'sheet', mode: shadows ? 'frames' : 'fixed', enabled: true, rotationEnabled: shadows,
    frameOverride: shadows ? null : frameCount - 1, clearWhenHidden: false, fixedMode: 'full-phase-curvature',
    modeLabel: shadows ? 'directional-terminator' : 'full-phase-curvature',
    addressAttributes: [{ name: 'data-material-frame', source: shadows ? 'frame' : 'literal', value: null },
      { name: 'data-material-mode', source: 'literal', value: shadows ? null : 'full-phase-curvature' }] });
  return { entries, track, selection,
    /** The flood-lit frame every variant needs; the sheet is demanded by the track while shadows are on. */
    required: [SHADOWLESS_KEY],
    pool: (all: readonly PreparedResourceEntry[]) => preparedResourcePool('lighting', all, { retention: 'selection', decoding: 'sync' }) };
}
