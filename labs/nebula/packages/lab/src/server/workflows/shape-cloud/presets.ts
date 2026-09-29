/** Checked-in authored fits are separate from detection evidence and browser drafts. */
import type { StructureImage } from '../../../features/observations/models/structures-model.ts';
import type { GeometryMap } from '../../../features/observations/models/geometry-model.ts';
import { initializeShapeCloud, readShapeCloudSettings } from '../../../features/shape-cloud/model.ts';
import type { ShapeCloudSettings } from '../../../features/shape-cloud/types.ts';
export interface ShapeCloudPreset {
  schema: 'cssearth-shape-cloud-fit@1'; id: string; label: string; cataloguePath: string; imageId: string;
  width: number; height: number;
  settings: ShapeCloudSettings; note: string;
}
const record = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
export function readShapeCloudPreset(value: unknown): ShapeCloudPreset {
  if (!record(value) || value.schema !== 'cssearth-shape-cloud-fit@1' || !text(value.id) || !/^[a-z0-9-]+$/.test(value.id) ||
      !text(value.label) || !text(value.note) || !text(value.imageId) || !text(value.cataloguePath) ||
      !value.cataloguePath.startsWith('.local/nebula-lab/') || /[\\?#]/.test(value.cataloguePath) || value.cataloguePath.split('/').some(p => p === '..' || p === '.') ||
      typeof value.width !== 'number' || typeof value.height !== 'number') throw new TypeError('Invalid saved shape-cloud fit.');
  const keys = ['schema', 'id', 'label', 'note', 'cataloguePath', 'imageId', 'width', 'height', 'settings'];
  const unexpected = Object.keys(value).filter(key => !keys.includes(key));
  if (unexpected.length) throw new TypeError(`Saved shape-cloud fit ${value.id} has unexpected fields: ${unexpected.join(', ')}`);
  return { schema: value.schema, id: value.id, label: value.label, note: value.note, cataloguePath: value.cataloguePath,
    imageId: value.imageId, width: value.width, height: value.height, settings: readShapeCloudSettings(value.settings, value.width, value.height) };
}
export function validateShapeCloudPreset(preset: ShapeCloudPreset, image: StructureImage, geometry: GeometryMap) {
  if (preset.imageId !== image.id || preset.width !== image.width || preset.height !== image.height)
    throw new TypeError(`Saved fit ${preset.id} belongs to image ${preset.imageId} at ${preset.width}x${preset.height}, not ${image.id} at ${image.width}x${image.height}.`);
  const detected = initializeShapeCloud(geometry);
  if (preset.settings.components.length !== detected.components.length || preset.settings.components.some(component => {
    const owner = detected.components.find(item => item.id === component.id);
    return !owner || owner.groupId !== component.groupId || JSON.stringify(owner.memberIds) !== JSON.stringify(component.memberIds);
  })) throw new TypeError('Saved fit does not match the detected components.');
  return preset.settings;
}
