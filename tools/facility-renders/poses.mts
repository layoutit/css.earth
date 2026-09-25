import { Quaternion, Vector3 } from 'three';

export type Vector = [number, number, number];
export interface FacilityPose {
  facingFeature: string;
  sourceAxis: Vector;
  modelQuaternion: [number, number, number, number];
  evidence: { url: string; identification: string };
}

/** Screen right/up/toward-viewer coordinates. Down-left from the upper-right card. */
export const inwardDirection: Vector = [-0.8, -0.45, 0.45];

/** Authored illustration poses, visually matched to pinned models and mission diagrams.
 * Source axes identify a visible dish or optical opening, not calibrated flight frames.
 * Quaternions rotate the source model before lighting; no image rotation follows capture. */
export const facilityPoses: Record<string, FacilityPose> = {
  'magellan': {
    facingFeature: "Radar antenna", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.824337466787, -0.386367893191, 0.201419799103, 0.361410648005],
    evidence: { url: 'https://science.nasa.gov/mission/magellan/', identification: "Radar uses the large high-gain dish." },
  },
  'mars-global-surveyor': {
    facingFeature: "MOC/MOLA science deck", sourceAxis: [0, 1, 0],
    modelQuaternion: [0.732040302959, -0.266590704802, 0.429207629784, 0.456976149808],
    evidence: { url: 'https://science.nasa.gov/mission/mars-global-surveyor/science-instruments/', identification: "Instrument apertures opposite the antenna-boom end." },
  },
};

export function getFacilityPose(id: string): FacilityPose {
  const pose = facilityPoses[id];
  if (!pose) throw new Error(`Unreviewed facility pose: ${id}`);
  const q = new Quaternion(...pose.modelQuaternion);
  const aim = new Vector3(...pose.sourceAxis).normalize().applyQuaternion(q);
  if (Math.abs(q.length() - 1) > 1e-8 || aim.distanceTo(new Vector3(...inwardDirection).normalize()) > 1e-8) {
    throw new Error(`Invalid inward facility pose: ${id}`);
  }
  return pose;
}
