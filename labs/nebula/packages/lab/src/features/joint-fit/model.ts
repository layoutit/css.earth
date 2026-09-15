export * from '@cssearth/nebula-reconstruction/methods/joint/model';
import {jointRecord, jointPath, readJointControls, type JointControls} from '@cssearth/nebula-reconstruction/methods/joint/model';
import type { Matrix } from '../observations/models/model.ts';
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const range = (v: unknown, min: number, max: number): v is number => finite(v) && v >= min && v <= max;
export interface JointRequest {
  action: 'apply'; imageId: 'joint-fit'; cataloguePath: string; recipePath: string;
  imageToFrame: Record<string, Matrix>; evidence: { sensitivity: number; weights: number[] }; controls: JointControls;
}
export function readJointRequest(v: unknown): JointRequest {
  if (!jointRecord(v) || v.action !== 'apply' || v.imageId !== 'joint-fit' || !jointPath(v.cataloguePath) || !v.cataloguePath.startsWith('.local/nebula-lab/') ||
      !jointPath(v.recipePath) || !v.recipePath.startsWith('labs/nebula/models/') || !jointRecord(v.imageToFrame) || !jointRecord(v.evidence) ||
      !range(v.evidence.sensitivity, .25, 4) || !Array.isArray(v.evidence.weights) || v.evidence.weights.length < 2 || v.evidence.weights.length > 8 || !v.evidence.weights.every(n => range(n, 0, 1))) throw new TypeError('Invalid joint fit request.');
  const imageToFrame: Record<string, Matrix> = {};
  for (const [id, m] of Object.entries(v.imageToFrame)) {
    if (!/^[a-z0-9-]+$/.test(id) || !Array.isArray(m) || m.length !== 6 || !m.every(finite) || Math.abs(m[0] * m[3] - m[1] * m[2]) < 1e-12) throw new TypeError('Invalid joint image registration.');
    imageToFrame[id] = [m[0], m[1], m[2], m[3], m[4], m[5]];
  }
  return { action: v.action, imageId: v.imageId, cataloguePath: v.cataloguePath, recipePath: v.recipePath, imageToFrame,
    evidence: { sensitivity: v.evidence.sensitivity, weights: [...v.evidence.weights] }, controls: readJointControls(v.controls) };
}
