import { RASTER_RECIPE_SCHEMA } from '@cssearth/objects';
import { alternativeForDataset } from '../layers/terrestrial/index.ts';
import { requireArray, requireRecord, requireString } from '@cssearth/core';
import type { InputRole } from '@cssearth/objects/provenance';

const record = requireRecord, text = requireString;
const records = (value: unknown) => requireArray(value).map(item => requireRecord(item));
const maybeRecord = (value: unknown) => value == null ? undefined : requireRecord(value);
const optionalText = (value: unknown) => value == null ? undefined : requireString(value);
const namedRecords = (value: unknown) => records(value).map(item => Object.assign({}, item, { id: requireString(item.id) }));

export interface ManifestInput { readonly path: string; readonly consumers: readonly string[]; readonly datasetId?: string }
/** One prepared product and the manifest paths its recipe operation reads. */
export interface ProductBinding {
  id: string; label: string; datasetIds: string[]; inputPaths: string[]; parents: string[];
  inputRoles?: Readonly<Record<string, { role: InputRole; evidence: string }>>;
  observationAttribution: 'source-lineage' | 'none';
  interpretation?: { kind?: string; sourceKind?: string };
  limitations: string[];
}
const kind = (value: string) => ({ kind: value });
/** An artist's surface (a model's base-color texture or a published global map): shown unchanged, never an observation. */
const illustration = (plan: Record<string, unknown>) => ['glb-base-color', 'equirectangular-illustration'].includes(String(maybeRecord(plan.science)?.kind));

/**
 * Which manifest paths each prepared product of a layered body reads, by preparation family. These follow acquisition paths
 * and recipe operations, never factsheet links, publisher names, or UI credits; a dataset whose family names no binding has no
 * product. `controls` are the prepared dataset controls, `noise` the geographic noise pin when the body has one.
 */
export function lineageProducts({ id, recipes, inputs, paths: declared, controls: rawControls, noise }: {
  id: string; recipes: ReadonlyMap<string, { path: string; parameters: Record<string, unknown> }>;
  inputs: readonly ManifestInput[]; paths: ReadonlySet<string>; controls: readonly unknown[];
  noise?: { id: string; directory: string; file: string };
}): ProductBinding[] {
  const products: ProductBinding[] = [], prefix = `/scenes/${id}/`;
  const controls = namedRecords(rawControls).map(dataset => Object.assign({}, dataset, { label: optionalText(dataset.label), qualification: optionalText(dataset.qualification), description: optionalText(dataset.description) }));
  const recipe = (name: string) => recipes.get(name)?.parameters;
  const paths = (value: unknown, base = '') => {
    const found = new Set<string>();
    const visit = (node: unknown): void => {
      if (typeof node === 'string') {
        const path = declared.has(node) ? node : declared.has(base + node) ? base + node : null;
        if (path) found.add(path);
      } else if (Array.isArray(node)) node.forEach(visit);
      else if (node && typeof node === 'object') {
        for (const [key, child] of Object.entries(node)) {
          // Pin inventories and descriptive references do not imply consumption.
          if (!['sourcePins', 'sources', 'descriptor', 'provenance', 'sourceUrls', 'sourceUrl'].includes(key)) visit(child);
        }
      }
    };
    visit(value); return [...found];
  };
  const group = (consumer: string) => inputs.filter(input => input.consumers.includes(consumer)).map(input => input.path);
  const add = (key: string, used: string[], extra: Partial<ProductBinding> = {}) => {
    const dataset = controls.find(dataset => dataset.id === key);
    products.push({ id: key, label: dataset?.label ?? key, observationAttribution: 'source-lineage', inputPaths: [...new Set(used)], parents: [],
      limitations: [dataset?.qualification, dataset?.description].filter((value): value is string => Boolean(value)), datasetIds: dataset ? [key] : [], ...extra });
  };
  const raster = recipe('raster'), terrestrial = recipe('terrestrial');
  const addObservationDatasets = () => namedRecords(record(recipe('observations')).datasets).forEach(plan => add(plan.id,
    [...paths(plan), ...paths(maybeRecord(plan.coverage)?.sources)]));
  // A body on the shared sphere lane takes only its lighting bank from the raster recipe; its datasets are observations.
  const lightingOnlyRaster = raster?.schema === RASTER_RECIPE_SCHEMA && Array.isArray(raster.surfaces) && !raster.surfaces.length;
  if (raster?.schema === RASTER_RECIPE_SCHEMA) {
    namedRecords(raster.surfaces).forEach((plan, index) => {
      // A science block names its pinned inputs (continuum frames, off-limb context images) beside the surface source.
      // An HMI continuum mosaic names its frames under the science block; its `source` is their directory, not an input.
      const frames = maybeRecord(maybeRecord(plan.science)?.synoptic)?.kind === 'hmi-continuum-mosaic';
      const sourcePath = text(plan.source), sourceBase = sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1);
      const used = [...(frames ? [] : [sourcePath]), ...paths(plan.coverage), ...paths(plan.science, sourceBase)];
      // A surface-observation dataset consumes its whole pinned group (frames, cameras, companions) and its reference shape.
      const surfaceObservation = maybeRecord(plan.science)?.kind === 'surface-observation' ? record(plan.science) : null;
      if (surfaceObservation) used.push(...group(text(record(surfaceObservation.dataset).consumer)), text(record(surfaceObservation.shape).path));
      const controlledDetail = maybeRecord(maybeRecord(plan.science)?.detailMosaic);
      if (controlledDetail?.format === 'controlled-geotiff') used.push(...group(text(controlledDetail.consumer)));
      const detailPhotometry = maybeRecord(controlledDetail?.photometry);
      if (detailPhotometry) used.push(text(detailPhotometry.model), text(detailPhotometry.subSolarPoints));
      add(plan.id, used, {
        inputRoles: frames ? {} : { [sourcePath]: { role: 'appearance', evidence: `Raster source at /surfaces/${index}/source.` } },
        ...(illustration(plan) ? { observationAttribution: 'none' as const, interpretation: kind('illustrative-model') } : {}),
      });
    });
    if (raster.interior) {
      const plan = record(raster.interior);
      add('interior', [text(plan.source), text(plan.surface)], { observationAttribution: 'none', interpretation: kind('schematic-interior') });
    }
    if (raster.lighting) {
      const file = optionalText(maybeRecord(record(raster.lighting).metadata)?.rendererSourceSnapshot)?.replace(/^source\//u, '');
      add('lighting', file ? [file] : [], { datasetIds: [], interpretation: kind('rendering-model') });
    }
    if (raster.atmosphere) add('atmosphere', paths(raster.atmosphere), { datasetIds: [] });
    if (lightingOnlyRaster && recipe('observations')?.datasets) addObservationDatasets();
  } else if (terrestrial?.kind === 'solid-observation-body') {
    const plans = record(terrestrial.raster), geometry = record(terrestrial.geometry);
    namedRecords(plans.observations).forEach((plan, index) => {
      // This is the same datasetId/consumer join used by prepareSolidRasters.
      const observation = inputs.filter(input => input.consumers.includes('surfaces') && input.datasetId === plan.id);
      add(plan.id, observation.map(input => input.path), {
        inputRoles: Object.fromEntries(observation.map(input => [input.path, { role: 'appearance', evidence: `Observation selected at /raster/observations/${index}.` }])),
        parents: plan.monochromeBase ? [text(plan.monochromeBase)] : [],
      });
    });
    for (const family of ['scientific', 'observedColors', 'shapeViews', 'surfaceObservations']) {
      namedRecords(plans[family] ?? []).forEach(plan => {
        const used = paths(plan);
        if (plan.consumer) used.push(...group(text(plan.consumer)));
        if (family === 'shapeViews') used.push(...paths(geometry.radialTerrain));
        // A shape view painted with its published whole-disc color is that measurement, not a neutral shape.
        const science = family === 'shapeViews' ? maybeRecord(plan.science)?.kind : undefined;
        add(plan.id, used, { parents: plan.monochromeBase ? [text(plan.monochromeBase)] : [], interpretation: kind(typeof science === 'string' ? science : family) });
      });
    }
    // Mesh geometry changes the final sampled surface as well as its silhouette.
    if (geometry.radialTerrain) {
      for (const product of products) {
        // A dataset read from another model and drawn on the body's mesh (display "body-mesh") has both shapes as its geometry.
        const alternative = alternativeForDataset(records(geometry.radialTerrainAlternatives ?? []), product.id);
        const modelPaths = [...paths(alternative ?? geometry.radialTerrain), ...(alternative?.display === 'body-mesh' ? paths(geometry.radialTerrain) : [])];
        product.inputPaths = [...new Set([...product.inputPaths, ...modelPaths])];
        product.inputRoles = { ...product.inputRoles, ...Object.fromEntries(modelPaths.map(path => [path, { role: 'geometry' as const, evidence: 'Source selected by the terrestrial radial-terrain geometry recipe.' }])) };
      }
    }
  } else if (terrestrial?.kind === 'affine-photographic-atmosphere') {
    const datasets = record(terrestrial.datasets);
    add(text(record(datasets.normal).id), [text(record(terrestrial.source).path)]);
    namedRecords(datasets.plans).forEach(plan => add(plan.id, [...paths(plan), ...paths(terrestrial.shapePath), ...paths(terrestrial.atmospherePath)]));
  } else if (recipe('shape-model')) {
    const plan = record(recipe('shape-model'));
    const surfaces = Array.isArray(plan.surfaces) ? namedRecords(plan.surfaces.map(item => ({ ...record(item), id: text(record(item).dataset) }))) : [];
    // The shape source is the measurement record the manifest binds to this recipe; each dataset adds its own surface source.
    for (const dataset of controls) {
      const surface = surfaces.find(item => item.id === dataset.id), science = maybeRecord(surface?.science)?.kind;
      const used = [...group('shape-model').filter(path => !surfaces.some(item => item.source === path && item.id !== dataset.id)), ...paths(surface?.science)];
      if (science === 'glb-base-color') add(dataset.id, used, { observationAttribution: 'none', interpretation: kind('illustrative-model') });
      else if (science === 'disc-integrated-color' || science === 'disc-integrated-band-color') add(dataset.id, used, { interpretation: kind(science) });
      else add(dataset.id, used, { observationAttribution: 'none', interpretation: kind('neutral-shape') });
    }
  } else if (recipe('surface')?.datasets) {
    if (recipe('observations')?.datasets) addObservationDatasets();
    const plan = record(recipe('surface'));
    const materialControls = namedRecords(record(plan.descriptor).controls);
    // In this family geometry.sources is an executable input map, not an
    // attribution inventory. The material preparer reads these exact paths.
    const baseInputs = [...paths(recipe('geometry')?.sources), ...paths(recipe('materials')), ...paths(recipe('rings'))];
    namedRecords(plan.datasets).forEach(dataset => add(dataset.id, [...paths(dataset, `${String(plan.sourceSubdirectory)}/`), ...baseInputs], {
      observationAttribution: 'source-lineage',
      ...(typeof dataset.sourceKind === 'string' ? { interpretation: { sourceKind: dataset.sourceKind } } : {}),
    }));
    // The base material and cutaway are produced by the material recipe.
    for (const dataset of controls.filter(dataset => !products.some(product => product.id === dataset.id))) {
      const materialControl = materialControls.find(control => control.id === dataset.id);
      const qualification = materialControl ? optionalText(materialControl.qualification) : undefined;
      add(dataset.id, baseInputs, { ...(qualification ? { limitations: [qualification] } : {}),
        ...(dataset.view === 'interior' ? { observationAttribution: 'none' as const, interpretation: kind('schematic-interior') } : {}) });
    }
  } else if (recipe('observations')?.datasets) {
    addObservationDatasets();
  } else if (recipe('paged-ellipsoid')) {
    const plan = record(recipe('paged-ellipsoid')), planSurface = record(plan.surface), maps = records(planSurface.maps);
    for (const map of maps) {
      const dataset = controls.find(dataset => dataset.surfaceUrl === prefix + text(map.name) + '.webp');
      if (!dataset) continue;
      const scientific = maybeRecord(map.scientific)?.kind, fill = maybeRecord(map.deepOceanFill);
      add(dataset.id, [text(map.path), ...paths(map.scientific), ...(map.compositeClouds ? [text(record(planSurface.clouds).path)] : []), ...(fill ? [text(fill.path)] : [])],
        fill ? { interpretation: kind('observed-color-with-depth-shaded-deep-ocean') }
          : scientific === 'gebco-elevation' ? { interpretation: kind('modeled-elevation') } : {});
    }
    for (const dataset of controls.filter(dataset => !products.some(product => product.id === dataset.id))) {
      if (dataset.view === 'interior') {
        const tomography = dataset.interiorSource ? recipe(text(dataset.interiorSource)) : null;
        add(dataset.id, [text(plan.interiorPath), ...paths(tomography)], {
          observationAttribution: tomography ? 'source-lineage' : 'none',
          interpretation: kind(tomography ? 'seismic-model-with-schematic-layers' : 'schematic-interior'),
          parents: controls.filter(control => control.surfaceUrl === prefix + text(maps[0]!.name) + '.webp').map(control => control.id),
        });
      } else if (noise?.id === dataset.id) {
        add(dataset.id, [`${noise.directory}/manifest.json`, `${noise.directory}/${noise.file}`], { observationAttribution: 'none', interpretation: kind('modeled-noise') });
      }
      // Geographic pages carry a separate release; the global base map a dataset button falls back to does not establish them.
    }
  }
  // A dataset that names a companion cloud prepares nothing of its own: it keeps the plates of the dataset it borrows and
  // turns on a volume another package prepares. Its parent is that dataset; the cloud's own sources are that package's.
  for (const dataset of controls) {
    const volume = maybeRecord(dataset.volume);
    // On an object with no surface the dataset is the companion alone: it borrows no surface, so it has no parent.
    if (volume && !products.some(product => product.id === dataset.id)) add(dataset.id, [], { parents: volume.surface === dataset.id ? [] : [text(volume.surface)], interpretation: kind('companion-volume') });
  }
  const content = recipes.get('content');
  if (content) add('content', [content.path.replace(/^source\//u, '')], { label: 'Object information', datasetIds: [] });
  records(recipe('charts')?.charts ?? []).forEach((plan, index) => add(`chart:${index}`,
    paths([plan.source, ...(plan.kind === 'retrieved-profile' ? records(plan.series).map(series => series.path) : [])]),
    { label: text(plan.title ?? plan.kind), datasetIds: [], ...(typeof plan.kind === 'string' ? { interpretation: kind(plan.kind) } : {}) }));
  const features = recipe('features');
  if (features?.schema === 'cssearth-surface-features@2') {
    const directory = text(features.directory), traces = maybeRecord(features.traces), sites = maybeRecord(features.sites), landmarks = maybeRecord(features.landmarks);
    add('features', [`${directory}/manifest.json`, ...(features.archive === null ? [] : [`${directory}/${text(features.archive)}`]), text(features.surfaceMap),
      ...(typeof features.notes === 'string' ? [`${directory}/${features.notes}`] : []),
      ...(sites ? [`${directory}/${text(sites.document)}`, ...(Array.isArray(sites.inputs) ? sites.inputs.map(item => `${directory}/${text(item)}`) : [])] : []),
      ...(landmarks ? [`${directory}/${text(landmarks.document)}`, ...paths(landmarks.inputs)] : []),
      ...(traces ? [`${text(traces.directory)}/manifest.json`, `${text(traces.directory)}/${text(traces.archive)}`] : [])],
    { label: 'Named features', datasetIds: [], interpretation: kind('nomenclature-centre-points') });
  }
  return products;
}
