import { writeData, writeStyle } from '../rendering/retained-write.js';
import { preparedVolumeTexturePaths } from './prepared-volume-runtime.js';
import { projectVolumeImpostors } from './volume-impostor-projection.js';
import { preparedDomAdoption } from '../rendering/prepared-dom-adoption.js';
import { mountPreparedVolumeLod, samePreparedVolumeTopology } from './prepared-volume-lod.js';
import { parseObjectDescriptor, parseDensityVolumeFrame, readPreparedObject } from '@cssearth/objects';
import type { PreparedCssTransport } from '../loader.js';
import { validatePreparedCssVolume } from './validation.js';
import type { PreparedCssVolume, VolumeAxis, VolumeCameraPublication } from './types.js';
import { DEFAULT_POINT_VISIBILITY, projectedVolumeOpacity, projectedVolumeRadiusPixels } from './projected-volume-visibility.js';
import { nativeProjectedFade } from '../rendering/native-projection.js';
import type { PreparedPointVisibility } from './projected-volume-visibility.js';
import type { PreparedAssets } from '../rendering/prepared-residency.js';
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { mountPreparedCataloguePoints, samePreparedCatalogueGeometry, samePreparedPhysicalFrame,
  validatePreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';
import type { PreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';

export interface PreparedVolumeDatasetBrightness { readonly overall: number; readonly x: number; readonly y: number; readonly z: number }
export interface PreparedVolumeDataset {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly sourceUrl: string;
  readonly volume: PreparedCssVolume;
  readonly brightness: PreparedVolumeDatasetBrightness;
  readonly stars: PreparedCataloguePoints;
  /** The centre of a compact structure that can pass in front of the body at the middle of this frame. The bank
   * composites this dataset over the detail scene while that centre is nearer to the camera than the body, and behind
   * it otherwise. Omitted for a dataset whose emission surrounds the body, which always composites behind it. */
  readonly occultingCentreUnits?: readonly [number, number, number];
}
export type { PreparedPointVisibility };
export interface PreparedVolumeDatasets {
  readonly schema: 'cssearth-volume-datasets@1';
  readonly id: string;
  readonly defaultDataset: string;
  readonly framingRadiusUnits: number;
  readonly datasets: readonly PreparedVolumeDataset[];
  /** Visibility remains toggleable; saved exposure and support belong in prepared point opacity. */
  readonly starsEnabled?: boolean;
  /** Nearby volumes must not inherit the Milky Way overview fade. */
  readonly contextVisibility?: 'galactic' | 'independent';
  /** The body this cloud accompanies. An accompanying cloud is not a place of its own and is drawn only while one of
   * that body's own datasets asks for it; a free-standing cloud names nothing and is drawn whenever it is in view. */
  readonly attachedTo?: string;
  readonly pointVisibility?: PreparedPointVisibility;
  readonly provenance?: unknown;
}
export type PreparedVolumeDatasetBank = PreparedVolumeDatasets;
export interface PreparedVolumeDatasetState {
  readonly id: string;
  readonly defaultDataset: string;
  readonly selectedDataset: string;
  readonly objectId: string;
  readonly starsVisible: boolean;
  readonly datasets: readonly Pick<PreparedVolumeDataset, 'id' | 'label' | 'title' | 'description' | 'sourceUrl'>[];
}

/** Decode the authored generic bank; preparation is never a runtime fallback. */
export async function loadPreparedVolumeDatasets(input: unknown, transport: PreparedCssTransport): Promise<PreparedVolumeDatasets> {
  const descriptor = parseObjectDescriptor(input);
  if (descriptor.type !== 'volume-dataset-bank' || descriptor.prepared?.format !== 'cssearth-volume-datasets@1') {
    throw new TypeError('A volume dataset bank requires its prepared artifact.');
  }
  const frame = parseDensityVolumeFrame(descriptor.properties.frame);
  const bytes = await transport.read(descriptor.prepared.url);
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const payload = readPreparedObject(value, descriptor, validatePreparedVolumeDatasets).data;
  if (payload.id !== descriptor.id || payload.datasets.some(dataset => JSON.stringify(dataset.volume.frame) !== JSON.stringify(frame))) {
    throw new TypeError('Prepared volume dataset identity/frame does not match its authored descriptor.');
  }
  return payload;
}

export function validatePreparedVolumeDatasets(input: unknown): PreparedVolumeDatasets {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Prepared volume datasets must be an object.');
  const value = input as PreparedVolumeDatasets, validId = (id: unknown) => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id);
  if (value.schema !== 'cssearth-volume-datasets@1' || !validId(value.id) || !Number.isFinite(value.framingRadiusUnits) ||
      value.framingRadiusUnits <= 0 || !Array.isArray(value.datasets) || !value.datasets.length ||
      (value.starsEnabled !== undefined && typeof value.starsEnabled !== 'boolean') ||
      (value.attachedTo !== undefined && (typeof value.attachedTo !== 'string' || !validId(value.attachedTo))) ||
      (value.contextVisibility !== undefined && !['galactic', 'independent'].includes(value.contextVisibility))) {
    throw new TypeError('Prepared volume dataset identity, framing or bank is invalid.');
  }
  const ids = new Set<string>(), resources = new Map<string, PreparedCssVolume['resources'][number]>();
  const datasets = value.datasets.map(dataset => {
    if (!dataset || !validId(dataset.id) || ids.has(dataset.id) || [dataset.label, dataset.title, dataset.description].some(text => typeof text !== 'string' || !text.trim()) ||
        typeof dataset.sourceUrl !== 'string' || !/^https:\/\//u.test(dataset.sourceUrl) ||
        (dataset.occultingCentreUnits !== undefined && (!Array.isArray(dataset.occultingCentreUnits) ||
          dataset.occultingCentreUnits.length !== 3 || !dataset.occultingCentreUnits.every(Number.isFinite)))) throw new TypeError('Prepared volume dataset content is invalid.');
    ids.add(dataset.id);
    const volume = validatePreparedCssVolume(dataset.volume), stars = validatePreparedCataloguePoints(dataset.stars);
    if (!samePreparedPhysicalFrame(volume.frame, stars.frame)) throw new TypeError('Prepared volume and catalogue must share a physical frame.');
    if (!dataset.brightness || !['overall', 'x', 'y', 'z'].every(key => {
      const number = dataset.brightness[key as keyof PreparedVolumeDatasetBrightness];
      return Number.isFinite(number) && number >= 0 && number <= 1;
    })) throw new TypeError('Prepared volume brightness must contain overall/X/Y/Z attenuation between zero and one.');
    for (const resource of volume.resources) {
      // One path is one published file: every dataset that names it must describe it alike.
      const known = resources.get(resource.path);
      if (known && (known.bytes !== resource.bytes || known.width !== resource.width || known.height !== resource.height)) {
        throw new TypeError(`Prepared volume dataset ${dataset.id} describes ${resource.path} differently from an earlier dataset in the fixed bank.`);
      }
      resources.set(resource.path, resource);
    }
    return Object.freeze({ id: dataset.id, label: dataset.label, title: dataset.title, description: dataset.description,
      sourceUrl: dataset.sourceUrl, volume, stars, brightness: Object.freeze({ ...dataset.brightness }),
      ...(dataset.occultingCentreUnits === undefined ? {} : { occultingCentreUnits: Object.freeze([...dataset.occultingCentreUnits] as [number, number, number]) }) });
  });
  if (!ids.has(value.defaultDataset)) throw new TypeError('Prepared default volume dataset is unavailable.');
  if (datasets.some(dataset => !samePreparedCatalogueGeometry(datasets[0].stars, dataset.stars))) {
    throw new TypeError('Prepared volume datasets must retain the same catalogue geometry.');
  }
  const visibility = value.pointVisibility ?? DEFAULT_POINT_VISIBILITY;
  if (!Number.isFinite(visibility.hiddenBelowRadiusPixels) || visibility.hiddenBelowRadiusPixels < 0 ||
      !Number.isFinite(visibility.fullAboveRadiusPixels) || visibility.fullAboveRadiusPixels <= visibility.hiddenBelowRadiusPixels) {
    throw new TypeError('Prepared point visibility needs increasing non-negative projected-radius thresholds.');
  }
  return Object.freeze({ schema: value.schema, id: value.id, defaultDataset: value.defaultDataset,
    contextVisibility: value.contextVisibility ?? 'galactic', framingRadiusUnits: value.framingRadiusUnits, datasets: Object.freeze(datasets), starsEnabled: value.starsEnabled ?? true,
    ...(value.attachedTo === undefined ? {} : { attachedTo: value.attachedTo }),
    pointVisibility: Object.freeze({ ...visibility }),
    ...(Object.hasOwn(value, 'provenance') ? { provenance: value.provenance } : {}) });
}

/** Same completed-image attenuation as Nebula Lab cloudCompositeOpacity; never attenuate individual slabs. */
export function volumeDatasetCompositeOpacity(banks: readonly { axis: VolumeAxis; opacity: number; visible: boolean }[],
  brightness: PreparedVolumeDatasetBrightness): number {
  let transmission = 1, gain = 0;
  for (let i = banks.length - 1; i >= 0; i--) {
    const bank = banks[i], alpha = bank.visible ? Math.max(0, Math.min(1, bank.opacity)) : 0;
    gain += alpha * transmission * brightness[bank.axis];
    transmission *= 1 - alpha;
  }
  return brightness.overall * gain;
}

/** Fixed declared bank; visible LODs attach their own textures on demand. */
export function createPreparedVolumeDatasets({ payload, resolveResource }: {
  payload: PreparedVolumeDatasets; resolveResource(path: string): string;
}) {
  const data = validatePreparedVolumeDatasets(payload), pool = `volume-datasets:${data.id}`;
  const topologyFamilies: PreparedVolumeDataset[][] = [];
  for (const dataset of data.datasets) {
    const family = topologyFamilies.find(candidate => samePreparedVolumeTopology(candidate[0]!.volume, dataset.volume));
    if (family) family.push(dataset); else topologyFamilies.push([dataset]);
  }
  const paths = [...new Set(data.datasets.flatMap(dataset => dataset.volume.resources.map(resource => resource.path)))];
  const urls = new Map(paths.map(path => {
    const url = resolveResource(path);
    if (typeof url !== 'string' || !url) throw new TypeError('Prepared volume dataset resource URL is missing.');
    return [path, url] as const;
  }));
  const entries = paths.map(path => ({ key: `${pool}:${path}`, url: urls.get(path)!, pool }));
  const assets: PreparedAssets = Object.freeze({ entries: Object.freeze(entries),
    pools: Object.freeze([{ id: pool, retention: 'mount' as const, capacity: paths.length, concurrency: 4,
      reuse: false, decoding: 'async' as const }]), startup: Object.freeze([]) });
  const resolvePrepared = (path: string) => {
    const url = urls.get(path);
    if (!url) throw new TypeError(`Undeclared prepared volume dataset resource: ${path}.`);
    return url;
  };
  return Object.freeze({ assets, payload: data,
    mount({ host, before, frontHost, frontBefore, nativeFocalCss }: { host: HTMLElement; before: Element;
      /** Where a dataset whose data lies wholly between the observer and the body composites; without it every dataset stays behind. */
      frontHost?: HTMLElement; frontBefore?: Element; nativeFocalCss?: string }) {
      const document = host.ownerDocument;
      const existing = [...document.querySelectorAll<HTMLElement>('.prepared-volume-datasets[data-prepared-volume-node="0"]')].find(root => root.dataset.volumeDatasetObject === data.id) ?? null;
      const dom = preparedDomAdoption(document, existing, nativeFocalCss !== undefined), create = dom.create;
      // Hidden detail and points are built on first use, except where server-rendered DOM is adopted node for node.
      const lazy = existing === null && nativeFocalCss === undefined;
      const selectedNative = existing?.dataset.selectedDataset;
      const root = create('div');
      root.className = 'prepared-volume-datasets'; root.dataset.volumeDatasetObject = data.id;
      Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
      const end = create('span'); end.hidden = true; root.append(end);
      const frontDatasets = frontHost && frontBefore ? data.datasets.filter(dataset => dataset.occultingCentreUnits !== undefined).length : 0;
      const frontRoot = frontDatasets ? create('div') : null;
      if (frontRoot) {
        frontRoot.className = 'prepared-volume-datasets-front'; frontRoot.dataset.volumeDatasetObject = data.id;
        Object.assign(frontRoot.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
      }
      const frontEnd = frontRoot ? create('span') : null;
      if (frontRoot && frontEnd) { frontEnd.hidden = true; frontRoot.append(frontEnd); }
      let selected = data.datasets.some(dataset => dataset.id === selectedNative) ? selectedNative! : data.defaultDataset, destroyed = false, latest: VolumeCameraPublication | null = null;
      let starsVisible = data.starsEnabled ?? true;
      const listeners = new Set<(state: PreparedVolumeDatasetState) => void>();
      const datasetContent = Object.freeze(data.datasets.map(({ id, label, title, description, sourceUrl }) =>
        Object.freeze({ id, label, title, description, sourceUrl })));
      const datasetById = new Map(data.datasets.map(dataset => [dataset.id, dataset] as const));
      const families: { datasets: readonly PreparedVolumeDataset[]; active: { dataset: PreparedVolumeDataset }; surface: HTMLElement;
        runtime: ReturnType<typeof mountPreparedVolumeLod> }[] = [];
      let stars: ReturnType<typeof mountPreparedCataloguePoints> | null = null;
      const mountStars = () => {
        stars = mountPreparedCataloguePoints({ host: root, before: end, payload: datasetById.get(selected)!.stars, createElement: create, nativeFocalCss });
        // Written directly while the points are built: the first publication's write through writeStyle always lands.
        stars.root.style.display = starsVisible ? 'block' : 'none';
      };
      const state = (): PreparedVolumeDatasetState => Object.freeze({ id: selected, defaultDataset: data.defaultDataset, selectedDataset: selected,
        objectId: data.id, starsVisible, datasets: datasetContent });
      const notify = () => { const next = state(); for (const listener of listeners) listener(next); };
      const destroy = () => {
        if (destroyed) return; destroyed = true; latest = null; listeners.clear();
        for (const family of families) family.runtime.destroy();
        stars?.destroy(); root.remove(); frontRoot?.remove();
      };
      const countDescendants = (node: Element): number => [...node.children]
        .reduce((count, child) => count + 1 + countDescendants(child), 0);
      const updateResidencyMetadata = () => {
        root.dataset.volumeDatasetCount = String(data.datasets.length);
        root.dataset.volumeTopologyCount = String(topologyFamilies.length);
        root.dataset.volumeResidentTopologyCount = String(families.length);
        root.dataset.volumeResidentDomNodes = String(1 + countDescendants(root) + (frontRoot ? 1 + countDescendants(frontRoot) : 0));
      };
      const ensureFamily = (dataset: PreparedVolumeDataset) => {
        const datasets = topologyFamilies.find(candidate => candidate.includes(dataset))!;
        const existingFamily = families.find(candidate => candidate.datasets === datasets);
        if (existingFamily) return existingFamily;
        const surface = create('div'); surface.className = 'prepared-volume-dataset-cloud'; surface.dataset.volumeDataset = dataset.id;
        surface.dataset.volumeDatasetTopology = datasets.map(candidate => candidate.id).join(' ');
        Object.assign(surface.style, { position: 'absolute', inset: '0', pointerEvents: 'none', display: 'none' });
        const marker = create('span'); marker.hidden = true; surface.append(marker); root.insertBefore(surface, end);
        const active = { dataset };
        const runtime = mountPreparedVolumeLod({ host: surface, before: marker, payload: dataset.volume, resolveResource: resolvePrepared, createElement: create, nativeFocalCss, lazyDetail: lazy },
          detail => volumeDatasetCompositeOpacity(detail.roots.map((axisRoot, index) => ({
            axis: (['x', 'y', 'z'] as const)[index], opacity: Number(axisRoot.style.opacity), visible: axisRoot.style.visibility !== 'hidden',
          })), active.dataset.brightness));
        for (const axisRoot of runtime.roots) axisRoot.style.background = 'transparent';
        const family = { datasets: Object.freeze(datasets), active, surface, runtime };
        families.push(family);
        updateResidencyMetadata();
        return family;
      };
      /** `holdMembership`: the camera coasts, so the surface keeps the root it is in until the coast stops
       * (motion-freezes-membership.md). */
      const publish = (publication: VolumeCameraPublication, visible = true, holdMembership = false) => {
        if (destroyed) return;
        // A hidden bank must forget its last near camera; otherwise selecting a
        // dataset while zoomed out could load detail using that stale publication.
        latest = visible ? publication : null;
        if (!visible) return;
        const bank = ensureFamily(datasetById.get(selected)!);
        const dataset = bank.active.dataset;
        // A compact structure passes in front of the body and behind it as the camera goes round. Two flattened
        // roots cannot interleave, so the whole surface moves to the side its centre is on; that is exact while the
        // structure stays clear of the body's silhouette in depth, which is why only a compact dataset declares one.
        const centre = dataset.occultingCentreUnits;
        if (frontRoot && frontEnd) {
          let target: HTMLElement = root, marker: HTMLElement = end;
          if (centre) {
            const [px, py, pz] = presentPhysicalPoseInVolume(publication.world.pose, dataset.volume.frame).positionUnits;
            const nearer = Math.hypot(px - centre[0], py - centre[1], pz - centre[2]) < Math.hypot(px, py, pz);
            if (nearer) { target = frontRoot; marker = frontEnd; }
          }
          if (bank.surface.parentNode !== target && !holdMembership) target.insertBefore(bank.surface, marker);
        }
        const builtRoots = bank.runtime.roots.length;
        bank.runtime.publish(publication);
        // The slice renderer is built on the first close publication; the bank's resident count follows it.
        if (bank.runtime.roots.length !== builtRoots) {
          for (const axisRoot of bank.runtime.roots.slice(builtRoots)) axisRoot.style.background = 'transparent';
          updateResidencyMetadata();
        }
        const opacity = volumeDatasetCompositeOpacity(bank.runtime.roots.map((axisRoot, index) => ({
          axis: (['x', 'y', 'z'] as const)[index], opacity: Number(axisRoot.style.opacity), visible: axisRoot.style.visibility !== 'hidden',
        })), dataset.brightness);
        // Impostors contain the saved exposure; their detail wrapper owns the matching full-volume exposure.
        writeStyle(bank.surface, 'opacity', dataset.volume.impostors ? '1' : String(opacity));
        const pointOpacity = projectedVolumeOpacity(publication.world, publication.viewport, dataset.volume.frame,
          data.framingRadiusUnits, data.pointVisibility!);
        const showPoints = starsVisible && (nativeFocalCss !== undefined || pointOpacity > 0);
        // Points are built the first time they show: a distant or disabled cluster keeps no hidden star nodes.
        if (showPoints && !stars) { mountStars(); updateResidencyMetadata(); }
        if (stars) {
          writeStyle(stars.root, 'opacity', nativeFocalCss === undefined ? String(pointOpacity)
            : nativeProjectedFade(projectedVolumeRadiusPixels(publication.world, publication.viewport, dataset.volume.frame, data.framingRadiusUnits),
              publication.viewport.focalPixels, nativeFocalCss, data.pointVisibility!.hiddenBelowRadiusPixels, data.pointVisibility!.fullAboveRadiusPixels));
          writeStyle(stars.root, 'display', showPoints ? 'block' : 'none');
          // Hidden points leave layout; projecting them only wrote styles nobody draws.
          if (showPoints) stars.publish(publication);
        }
        // Test hooks: rounded and written only on change, so a steady frame writes no attributes.
        const pointHook = String(Math.round(pointOpacity * 1000) / 1000), cloudHook = String(Math.round(opacity * 1000) / 1000);
        writeData(root, 'pointOpacity', pointHook);
        writeData(root, 'cloudOpacity', cloudHook);
      };
      try {
        const selectedDataset = datasetById.get(selected)!;
        const selectedFamily = ensureFamily(selectedDataset);
        selectedFamily.surface.style.display = 'block';
        if (!lazy) mountStars();
        root.dataset.selectedDataset = selected; host.insertBefore(root, before);
        if (frontRoot) frontHost!.insertBefore(frontRoot, frontBefore!);
        updateResidencyMetadata();
        dom.finish();
        // The bank's visibility is written on its roots from outside. A dataset that composites in front of the body
        // lives in the second root, so both must be gated or a disabled cloud keeps drawing over the star.
        return Object.freeze({ root, frontRoot, publish, state, destroy,
          /** Distant approach warms the contributing axis. Detail admission owns the selected dataset's
           * full rotation bank, so dragging cannot release an axis and hide the cloud to decode it again. */
          textureUrls(publication: VolumeCameraPublication, approaching = false): readonly string[] {
            const volume = datasetById.get(selected)!.volume;
            const projection = volume.impostors ? projectVolumeImpostors(publication, volume.frame, volume.impostors) : null;
            const paths = new Set<string>();
            if (!projection || (projection.visible && projection.volumeMix > 0)) {
              for (const stack of volume.stacks) for (const leaf of stack.leaves) paths.add(leaf.texturePath);
            } else if (projection.visible && approaching) {
              for (const path of preparedVolumeTexturePaths(volume, publication)) paths.add(path);
            }
            if (projection?.visible && projection.volumeMix < 1) {
              for (const view of projection.views) paths.add(volume.impostors!.views.find(candidate => candidate.id === view.id)!.texturePath);
            }
            return [...paths].map(resolvePrepared);
          },
          subscribe(listener: (state: PreparedVolumeDatasetState) => void) {
            if (!destroyed) listeners.add(listener);
            return () => { listeners.delete(listener); };
          },
          setStarsVisible(visible: boolean) {
            if (destroyed) return;
            if (typeof visible !== 'boolean') throw new TypeError('Catalogue point visibility must be a boolean.');
            if (visible === starsVisible) return;
            starsVisible = visible;
            if (stars) writeStyle(stars.root, 'display', visible ? 'block' : 'none');
            if (latest) publish(latest);
            notify();
          },
          selectDataset(id: string) {
            if (destroyed) return;
            const next = datasetById.get(id);
            if (!next) throw new TypeError(`Unknown prepared volume dataset: ${id}.`);
            if (id === selected) return;
            stars?.setPresentation(next.stars);
            const family = ensureFamily(next);
            family.active.dataset = next;
            family.runtime.setPresentation(next.volume);
            family.surface.dataset.volumeDataset = next.id;
            selected = id;
            for (const candidate of families) candidate.surface.style.display = candidate === family ? 'block' : 'none';
            root.dataset.selectedDataset = selected;
            updateResidencyMetadata();
            if (latest) publish(latest);
            notify();
          },
        });
      } catch (error) { destroy(); throw error; }
    },
  });
}
