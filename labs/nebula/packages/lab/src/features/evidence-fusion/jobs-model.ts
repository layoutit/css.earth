import type { Matrix } from '../observations/models/model.ts';

export const FUSION_VERSION = 'joint-evidence@1';
export type EvidenceChannel = 'all' | 'broad' | 'ridges' | 'compact';
export interface FusionRequest {
  action: 'apply'; imageId: 'joint-evidence'; cataloguePath: string;
  imageToFrame: Record<string, Matrix>;
  settings: { channel: EvidenceChannel; weights: number[]; sensitivity: number };
}
export interface FusionAsset { path: string; sha256: string }
export interface FusionResult {
  schema: 'cssearth-joint-evidence@1'; id: string; preparationVersion: string; inputIdentity: string;
  width: number; height: number; settings: FusionRequest['settings'];
  sources: { id: string; label: string; color: string; source: FusionAsset; evidence: FusionAsset }[];
  union: FusionAsset; agreement: FusionAsset; colors: FusionAsset; samples: FusionAsset;
}
export const fusionRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
export const fusionHash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export const fusionPath = (v: unknown): v is string => typeof v === 'string' && v.startsWith('.local/nebula-lab/') &&
  !/[\\:?#]/.test(v) && v.split('/').every(part => part && part !== '..' && part !== '.');
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const matrix = (v: unknown): v is Matrix => Array.isArray(v) && v.length === 6 && v.every(finite) && Math.abs(v[0] * v[3] - v[1] * v[2]) > 1e-12;
export function readFusionSettings(v: unknown): FusionRequest['settings'] {
  if (!fusionRecord(v) || !['all','broad','ridges','compact'].includes(String(v.channel)) || !Array.isArray(v.weights) ||
      v.weights.length < 2 || v.weights.length > 16 || !v.weights.every(weight => finite(weight) && weight >= 0 && weight <= 1) ||
      !finite(v.sensitivity) || v.sensitivity < .25 || v.sensitivity > 4) throw new TypeError('Invalid combined evidence settings.');
  const channel = v.channel === 'broad' || v.channel === 'ridges' || v.channel === 'compact' ? v.channel : 'all';
  return { channel, weights: [...v.weights], sensitivity: v.sensitivity };
}
export function readFusionRequest(v: unknown): FusionRequest {
  if (!fusionRecord(v) || v.action !== 'apply' || v.imageId !== 'joint-evidence' || !fusionPath(v.cataloguePath) ||
      !fusionRecord(v.imageToFrame) || Object.keys(v.imageToFrame).length > 16) throw new TypeError('Invalid combined evidence request.');
  const imageToFrame: Record<string, Matrix> = {};
  for (const [id, transform] of Object.entries(v.imageToFrame)) {
    if (!/^[a-z0-9-]+$/.test(id) || !matrix(transform)) throw new TypeError('Invalid evidence registration.');
    imageToFrame[id] = transform;
  }
  return { action: v.action, imageId: v.imageId, cataloguePath: v.cataloguePath, imageToFrame, settings: readFusionSettings(v.settings) };
}
function asset(v: unknown): FusionAsset {
  if (!fusionRecord(v) || !fusionPath(v.path) || !fusionHash(v.sha256)) throw new TypeError('Invalid evidence asset.');
  return { path: v.path, sha256: v.sha256 };
}
export function readFusionResult(v: unknown): FusionResult {
  if (!fusionRecord(v) || v.schema !== 'cssearth-joint-evidence@1' || !fusionHash(v.id) || !fusionHash(v.inputIdentity) ||
      typeof v.preparationVersion !== 'string' || !finite(v.width) || !finite(v.height) || !Number.isInteger(v.width) || !Number.isInteger(v.height) ||
      v.width < 1 || v.height < 1 || v.width * v.height > 1_000_000 || !Array.isArray(v.sources)) throw new TypeError('Invalid combined evidence result.');
  const settings = readFusionSettings(v.settings);
  const sources = v.sources.map((s: unknown) => {
    if (!fusionRecord(s) || typeof s.id !== 'string' || typeof s.label !== 'string' || typeof s.color !== 'string' || !/^#[a-f0-9]{6}$/i.test(s.color)) throw new TypeError('Invalid evidence source.');
    return { id: s.id, label: s.label, color: s.color, source: asset(s.source), evidence: asset(s.evidence) };
  });
  if (sources.length !== settings.weights.length || new Set(sources.map(s => s.id)).size !== sources.length) throw new TypeError('Evidence sources do not match the settings.');
  return { schema: v.schema, id: v.id, preparationVersion: v.preparationVersion, inputIdentity: v.inputIdentity,
    width: v.width, height: v.height, settings, sources, union: asset(v.union), agreement: asset(v.agreement), colors: asset(v.colors), samples: asset(v.samples) };
}
