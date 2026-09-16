/** Checked-in authored fits are separate from detection evidence and browser drafts. */
import type { StructureImage } from '../../../features/observations/models/structures-model.ts';
import type { GeometryMap } from '../../../features/observations/models/geometry-model.ts';
import { initializeShapeCloud, readShapeCloudSettings } from '../../../features/shape-cloud/model.ts';
import type { ShapeCloudSettings } from '../../../features/shape-cloud/types.ts';
export interface ShapeCloudPreset {
  schema: 'cssearth-shape-cloud-fit@1'; id: string; label: string; cataloguePath: string; imageId: string;
  sourceSha256: string; mapSha256: string; geometrySha256: string; width: number; height: number;
  settings: ShapeCloudSettings; note: string;
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const hash = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
export function readShapeCloudPreset(value: unknown): ShapeCloudPreset {
  if (!record(value) || value.schema !== 'cssearth-shape-cloud-fit@1' || !text(value.id) || !/^[a-z0-9-]+$/.test(value.id) ||
      !text(value.label) || !text(value.note) || !text(value.imageId) || !text(value.cataloguePath) ||
      !value.cataloguePath.startsWith('.local/nebula-lab/') || /[\\?#]/.test(value.cataloguePath) || value.cataloguePath.split('/').some(p => p === '..' || p === '.') ||
      !hash(value.sourceSha256) || !hash(value.mapSha256) || !hash(value.geometrySha256) ||
      typeof value.width !== 'number' || typeof value.height !== 'number') throw new TypeError('Invalid saved shape-cloud fit.');
  return { schema: value.schema, id: value.id, label: value.label, note: value.note, cataloguePath: value.cataloguePath,
    imageId: value.imageId, sourceSha256: value.sourceSha256, mapSha256: value.mapSha256, geometrySha256: value.geometrySha256,
    width: value.width, height: value.height, settings: readShapeCloudSettings(value.settings, value.width, value.height) };
}
export function validateShapeCloudPreset(preset: ShapeCloudPreset, image: StructureImage, geometry: GeometryMap) {
  if (preset.imageId !== image.id || preset.sourceSha256 !== image.sourceSha256 || preset.mapSha256 !== image.mapSha256 ||
      preset.geometrySha256 !== image.geometry?.sha256 || preset.width !== image.width || preset.height !== image.height)
    throw new TypeError('Saved fit belongs to different source evidence.');
  const detected = initializeShapeCloud(geometry);
  if (preset.settings.components.length !== detected.components.length || preset.settings.components.some(component => {
    const owner = detected.components.find(item => item.id === component.id);
    return !owner || owner.groupId !== component.groupId || JSON.stringify(owner.memberIds) !== JSON.stringify(component.memberIds);
  })) throw new TypeError('Saved fit does not match the detected components.');
  return preset.settings;
}
