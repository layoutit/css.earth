/** Frames made of other frames: the filter bands of one colour photograph, and the strips of one push-frame band. */
import type { CameraKind, FootprintSample, ObservationCamera, ObservationFrame } from './contract.mts';

/** Three filter photographs shown together. Every band must qualify at a point, and the bands stay separate floats until display. */
export function bandSetFrame(id: string, bands: readonly ObservationFrame[], cameraKind: CameraKind = 'control-network'): ObservationFrame {
  const coarsest = bands.reduce((a, b) => b.footprint.nadirMedianMeters > a.footprint.nadirMedianMeters ? b : a);
  return { id, startTime: bands[0].startTime, filter: bands.map(frame => frame.filter).join(' / '), positionKm: coarsest.positionKm,
    cameraKind, geometrySource: 'source-mesh-rays', nominalPixelScaleMeters: coarsest.nominalPixelScaleMeters, footprint: coarsest.footprint,
    sample(point) {
      const color: number[] = [];
      let separationMeters = 0, gain = 0, maximumEmissionDegrees = 0, maximumIncidenceDegrees = 0;
      for (const frame of bands) {
        const sample = frame.sample(point);
        if (sample.reason !== undefined) return sample;
        color.push(sample.radiance); separationMeters = Math.max(separationMeters, sample.separationMeters); gain = Math.max(gain, sample.gain);
        maximumEmissionDegrees = Math.max(maximumEmissionDegrees, sample.maximumEmissionDegrees); maximumIncidenceDegrees = Math.max(maximumIncidenceDegrees, sample.maximumIncidenceDegrees);
      }
      // Level matching and coverage use the bands' mean; one gain then scales all three bands, so their measured ratios stay.
      return { radiance: (color[0] + color[1] + color[2]) / 3, color, gain, separationMeters, maximumEmissionDegrees, maximumIncidenceDegrees };
    },
    visible: point => bands.every(frame => frame.visible(point)),
    // A point is only as deep inside the set's disc as inside its shallowest band's.
    ...(bands.every(frame => frame.contourDepth) ? { contourDepth: (point: readonly number[]) => Math.min(...bands.map(frame => frame.contourDepth?.(point) ?? 0)) } : {}),
    report: { id, bands: bands.map(frame => frame.report) } };
}

/** One strip of a push-frame band: its frame, and the camera that says where a surface point falls in it. */
export interface Strip { frame: ObservationFrame; camera: Pick<ObservationCamera, 'project'>; width: number; height: number }

/**
 * One band of a push-frame photograph, as a single frame. Successive strips overlap by a few rows, so a surface point
 * can fall in two of them; it is sampled in the strip that holds it farthest from the strip's own edges, and in the
 * other only when the first withholds it. The strip that answered last is tried first, since neighbouring surface
 * points fall in the same strip.
 */
export function stripFrame(id: string, strips: readonly Strip[], cameraKind: CameraKind): ObservationFrame {
  if (!strips.length) throw new Error(`Push-frame band ${id} has no strip that sees the body.`);
  const medians = strips.map(strip => strip.frame.footprint.nadirMedianMeters).filter(Number.isFinite).sort((a, b) => a - b), first = strips[0].frame;
  const footprint = { pixelAngleMicroradians: first.footprint.pixelAngleMicroradians, nadirMedianMeters: medians[medians.length >> 1] ?? NaN,
    nadirMinimumMeters: Math.min(...strips.map(strip => strip.frame.footprint.nadirMinimumMeters).filter(Number.isFinite)), sampledPixels: strips.reduce((sum, strip) => sum + strip.frame.footprint.sampledPixels, 0) };
  let last = 0;
  /** How far inside strip `index` the point falls, measured from the strip's nearer long edge; negative when it falls outside. */
  const depthIn = (index: number, point: readonly number[]) => {
    const { camera, width, height } = strips[index], p = camera.project(point);
    return p && p[2] > 0 && p[0] >= 0 && p[1] >= 0 && p[0] < width - 1 && p[1] < height - 1 ? Math.min(p[1], height - 1 - p[1]) : -1;
  };
  /** The strips that hold the point, deepest first: the search runs outward from the strip that answered last, and a holder's two neighbours are the only others that can hold it. */
  const holders = (point: readonly number[]) => {
    let hit = -1;
    for (let offset = 0; offset < strips.length && hit < 0; offset++) {
      for (const index of offset ? [last + offset, last - offset] : [last]) if (index >= 0 && index < strips.length && depthIn(index, point) >= 0) { hit = index; break; }
    }
    if (hit < 0) return [];
    return [hit - 1, hit, hit + 1].filter(index => index >= 0 && index < strips.length).map(index => ({ index, depth: depthIn(index, point) })).filter(holder => holder.depth >= 0).sort((a, b) => b.depth - a.depth);
  };
  return { id, startTime: first.startTime, filter: first.filter, positionKm: strips[strips.length >> 1].frame.positionKm, cameraKind, geometrySource: 'source-mesh-rays', footprint,
    sample(point) {
      let withheld: FootprintSample | undefined;
      for (const { index } of holders(point)) {
        const sample = strips[index].frame.sample(point);
        if (sample.reason === undefined) { last = index; return sample; }
        withheld ??= sample;
      }
      return withheld ?? { reason: 'outside-detector' };
    },
    visible: point => { const [holder] = holders(point); return holder !== undefined && strips[holder.index].frame.visible(point); },
    report: { id, filter: first.filter, strips: strips.map(strip => strip.frame.report) } };
}
