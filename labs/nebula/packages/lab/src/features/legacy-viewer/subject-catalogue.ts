import records from '../../state/subjects.json';
import { readLabWorkflow } from '../../state/lab-workflows.ts';
import sourceCatalog from '../../adapters/sources/nebula-catalogue.ts';
import { relativePath } from './overlay-catalogue';
declare const __NEBULA_REPO_ROOT__: string;
export interface LabSubjectRecord {
  id: string;
  name: string;
  menuLabel?: string;
  workflow?: string;
  observationAlignment?: { manifest: string; recipe: string; dossier?: string; candidates?: { manifest: string; recipe: string; dossier: string } };
  alignmentOnly?: boolean;
  directory: string;
  /** Comparison image relative to directory, or imagePath relative to the repository. */
  image?: string;
  imagePath?: string;
  /** Reuse a photographed subject's reference catalogue for derived experiments. */
  sourceSubjectId?: string;
  comparisonImages?: { id: string; name: string; imagePath: string }[];
  sourcePageUrl?: string;
  credit?: string;
  modelNote?: string;
  framingRadiusUnits?: number;
  hasDetail?: boolean;
  emissionExperiment?: { directory?: string; modeled?: boolean; methodUrl?: string; statusNote?: string; structureDirectory?: string; sourceCatalogue?: string; observationStructures?: string; kinematicsSource?: string; jointFitSource?: string; compilerSource?: string; compilerPublished?: string };
  comparisonGroup?: string;
  reconstructionImage?: { group: string; label: string; note: string };
  referenceProjectionScale?: number;
  /** Calibrated observer for prepared photographic-volume experiments. */
  referenceDistanceUnits?: number;
  referenceEastLeft?: boolean;
  cloudParts?: { descriptor: string; catalogue: string };
  stars?: string;
  /** Fixed original-image plane prepared from this saved result's exact image registration. */
  reconstructionOverlay?: string;
  reconstructionNeutral?: { descriptor: string };
  /** Saved results sharing this model identity differ only in prepared material banks. */
  materialGeometry?: string;
  density?: { directory: string; modelNote: string; sourcePageUrl: string; credit: string; overlays?: string; processingPlan?: string; modelPlacement?: { path: string }; candidateImageIds?: string[];
    reconstructionReferenceImageId?: string; starAlignmentReference?: { path: string }; referenceFramingRadiusUnits?: number };
}
const subjectRecords: readonly LabSubjectRecord[] = records;
export const localFile = (path: string) => `/@fs${__NEBULA_REPO_ROOT__.replace(/\/$/, '')}/${path}`;
const recipes = import.meta.glob('../../../../../../../src/objects/*/source/recipe.json', { eager: true, import: 'default' }) as
  Record<string, { source: { publisherUrl: string; credit: string }; geometry: { supportRadiusKpc: number } }>;
function prepareSubjectRecord(record: LabSubjectRecord) {
  if (record.workflow !== undefined) readLabWorkflow(record.workflow);
  if (record.observationAlignment && (!relativePath(record.observationAlignment.manifest) || !relativePath(record.observationAlignment.recipe)))
    throw new TypeError(`Lab subject ${record.id} has invalid observation alignment paths.`);
  if (record.observationAlignment?.dossier && !relativePath(record.observationAlignment.dossier)) throw new TypeError('Invalid observation dossier path.');
  const candidates = record.observationAlignment?.candidates;
  if (candidates && ![candidates.manifest, candidates.recipe, candidates.dossier].every(relativePath)) throw new TypeError('Invalid observation candidate paths.');
  if (record.alignmentOnly !== undefined && (typeof record.alignmentOnly !== 'boolean' || !record.observationAlignment)) throw new TypeError('Alignment-only subjects require observation inputs.');
  if (record.emissionExperiment?.observationStructures !== undefined &&
      (!record.observationAlignment || !relativePath(record.emissionExperiment.observationStructures)))
    throw new TypeError(`Lab subject ${record.id} requires registered observations for its structure catalogue.`);
  if (record.emissionExperiment?.kinematicsSource !== undefined && !relativePath(record.emissionExperiment.kinematicsSource))
    throw new TypeError('Invalid kinematics source path.');
  if (record.emissionExperiment?.jointFitSource !== undefined && (!relativePath(record.emissionExperiment.jointFitSource) || !record.emissionExperiment.observationStructures))
    throw new TypeError('Joint fitting requires registered observations and a valid recipe.');
  if (record.emissionExperiment?.compilerSource !== undefined && (!relativePath(record.emissionExperiment.compilerSource) || !record.emissionExperiment.observationStructures))
    throw new TypeError('Nebula compilation requires registered observations and a valid recipe.');
  if (record.emissionExperiment?.compilerPublished !== undefined && (!relativePath(record.emissionExperiment.compilerPublished) || !record.emissionExperiment.compilerSource))
    throw new TypeError('A prepared compiler result requires a compiler recipe and valid local path.');
  const sharedDensity = record.density && subjectRecords.filter(item => item.density?.directory === record.density!.directory);
  const configuredRadii = sharedDensity?.flatMap(item => item.density?.referenceFramingRadiusUnits === undefined ? [] : [item.density.referenceFramingRadiusUnits]) ?? [];
  if (configuredRadii.some(value => !Number.isFinite(value) || value <= 0) || new Set(configuredRadii).size > 1)
    throw new TypeError('Subjects sharing a density field must share one positive Earth-view framing radius.');
  const sharedRadius = configuredRadii[0] ?? Math.max(...(sharedDensity?.map(item => item.framingRadiusUnits ?? 0) ?? [0]));
  const density = record.density ? { ...record.density, ...(sharedRadius > 0 ? { referenceFramingRadiusUnits: sharedRadius } : {}) } : undefined;
  if (record.reconstructionImage !== undefined) {
    const image = record.reconstructionImage;
    if (!image || typeof image !== 'object' || Array.isArray(image) ||
        Object.keys(image).some(key => !['group', 'label', 'note'].includes(key)) ||
        ![image.group, image.label, image.note].every(value => typeof value === 'string' && value.trim().length > 0) ||
        !record.comparisonGroup || subjectRecords.some(other => other.reconstructionImage?.group === image.group && other.comparisonGroup !== record.comparisonGroup)) {
      throw new TypeError(`Lab subject ${record.id} has invalid reconstruction image metadata.`);
    }
  }
  if (record.reconstructionNeutral && !relativePath(record.reconstructionNeutral.descriptor)) throw new TypeError('Invalid neutral material descriptor.');
  if (record.materialGeometry !== undefined && (typeof record.materialGeometry !== 'string' || !/^[a-f0-9]{64}$/.test(record.materialGeometry)))
    throw new TypeError('Invalid shared material geometry identity.');
  if (record.density?.processingPlan !== undefined && !relativePath(record.density.processingPlan))
    throw new TypeError(`Lab subject ${record.id} has an invalid density processing plan.`);
  const candidateIds = record.density?.candidateImageIds;
  if (candidateIds !== undefined && (!record.density?.overlays || !Array.isArray(candidateIds) || !candidateIds.length ||
      candidateIds.some(id => typeof id !== 'string' || !id.trim()) || new Set(candidateIds).size !== candidateIds.length)) {
    throw new TypeError(`Lab subject ${record.id} has invalid candidate image ids.`);
  }
  if (record.referenceProjectionScale !== undefined &&
      (!Number.isFinite(record.referenceProjectionScale) || record.referenceProjectionScale <= 0)) {
    throw new TypeError(`Lab subject ${record.id} has an invalid reference projection scale.`);
  }
  if (record.referenceDistanceUnits !== undefined && (!Number.isFinite(record.referenceDistanceUnits) || record.referenceDistanceUnits <= 0))
    throw new TypeError(`Lab subject ${record.id} has an invalid observer distance.`);
  if (record.referenceEastLeft !== undefined && typeof record.referenceEastLeft !== 'boolean')
    throw new TypeError(`Lab subject ${record.id} has an invalid sky handedness.`);
  if (record.reconstructionOverlay !== undefined && !relativePath(record.reconstructionOverlay))
    throw new TypeError(`Lab subject ${record.id} has an invalid original overlay path.`);
  const recipe = recipes[`../../../../../../../${record.directory}/source/recipe.json`];
  const imagePath = record.imagePath ?? (record.image ? `${record.directory}/${record.image}` : null);
  if (!imagePath && !density && !record.observationAlignment) throw new TypeError(`Lab subject ${record.id} has no image, density or registered-observation workspace.`);
  const sourceUrl = imagePath ? localFile(imagePath) : '';
  const sourcePageUrl = record.sourcePageUrl ?? recipe?.source.publisherUrl;
  const credit = record.credit ?? recipe?.source.credit;
  if (record.reconstructionImage && (!sourcePageUrl || !/^https?:\/\//i.test(sourcePageUrl) || !credit?.trim()))
    throw new TypeError(`Lab subject ${record.id} needs a reconstruction publisher URL and source credit.`);
  const declared = sourceCatalog.subjects.find(item => item.subjectId === (record.sourceSubjectId ?? record.id))?.sources;
  const sourceImages = declared?.map(source => ({ id: source.id, name: source.name,
    sourceUrl: localFile(`${sourceCatalog.pathBase}/${source.path}`), sourcePageUrl: source.sourcePageUrl, credit: source.credit }))
    ?? (imagePath ? [{ id: `${record.id}-source`, name: `${record.name} · source`, sourceUrl, sourcePageUrl, credit }] : []);
  for (const comparison of record.comparisonImages ?? []) {
    sourceImages.push({ id: comparison.id, name: comparison.name, sourceUrl: localFile(comparison.imagePath),
      sourcePageUrl: sourceImages[0]?.sourcePageUrl,
      credit: `Offline extraction used by this volume. ${sourceImages[0]?.credit ?? ''}` });
  }
  return { ...record, density, sourceUrl, sourcePageUrl, credit, sourceImages, hasDetail: record.hasDetail ?? Boolean(recipe),
    framingRadiusUnits: record.framingRadiusUnits ?? recipe?.geometry.supportRadiusKpc };
}
export const subjects = subjectRecords.map(prepareSubjectRecord);

/** Saved banks enter the same prepared-object loader as the checked-in benchmark. */
export function registerReconstructionSubject(record: LabSubjectRecord) {
  const base = subjects.find(item => item.id === record.sourceSubjectId);
  if (!/^reconstruction-[a-f0-9]{64}$/.test(record.id) || !base || !base.density ||
      !relativePath(record.directory) || !record.directory.startsWith('.local/nebula-lab/') ||
      !record.imagePath || !relativePath(record.imagePath) || !record.cloudParts ||
      !relativePath(record.cloudParts.descriptor) || !relativePath(record.cloudParts.catalogue) ||
      record.comparisonGroup !== base.comparisonGroup || record.referenceDistanceUnits !== base.referenceDistanceUnits ||
      record.referenceProjectionScale !== base.referenceProjectionScale || record.referenceEastLeft !== base.referenceEastLeft)
    throw new TypeError('Saved reconstruction does not match its prepared comparison frame.');
  const existing = subjects.find(item => item.id === record.id);
  if (existing) {
    if (existing.directory !== record.directory || existing.imagePath !== record.imagePath)
      throw new TypeError('Saved reconstruction identity changed.');
    return existing.id;
  }
  const prepared = prepareSubjectRecord({ ...record, density: base.density });
  subjects.push(prepared);
  return prepared.id;
}
