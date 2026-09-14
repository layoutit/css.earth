import { readShapeCloudPreset } from '../reconstruction/shape-cloud/presets';
const records = import.meta.glob('../../models/**/*-shape-fit.json', { eager: true, import: 'default' });
export const shapeCloudPresets = Object.values(records).map(readShapeCloudPreset);
if (new Set(shapeCloudPresets.map(preset => preset.id)).size !== shapeCloudPresets.length) throw new TypeError('Duplicate shape-cloud fit identity.');
