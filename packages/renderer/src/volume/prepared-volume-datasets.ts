import { samePreparedCatalogueGeometry, validatePreparedVolumeDatasets, type PreparedVolumeDataset, type PreparedVolumeDatasetBrightness, type PreparedVolumeDatasets, PREPARED_VOLUME_DATASETS_SCHEMA, parseObjectDescriptor, parseDensityVolumeFrame, readPreparedObject, type PreparedAssets, type PreparedCssVolume, type VolumeAxis } from '@cssearth/objects';
import { writeData, writeStyle } from '../rendering/retained-write.js';
import { preparedVolumeTexturePaths } from './prepared-volume-runtime.js';
import { projectVolumeImpostors } from './volume-impostor-projection.js';
import { preparedDomAdoption } from '../rendering/prepared-dom-adoption.js';
import { mountPreparedVolumeLod, samePreparedVolumeTopology } from './prepared-volume-lod.js';
import type { PreparedCssTransport } from '../loader.js';
import type { VolumeCameraPublication } from './types.js';
import { projectedVolumeOpacity, projectedVolumeRadiusPixels } from './projected-volume-visibility.js';
import { nativeProjectedFade } from '../rendering/native-projection.js';
import { presentPhysicalPoseInVolume } from '@cssearth/engine';
import { mountPreparedCataloguePoints } from '../stars/prepared-catalogue-points.js';

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
  if (descriptor.type !== 'volume-dataset-bank' || descriptor.prepared?.format !== PREPARED_VOLUME_DATASETS_SCHEMA) {
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
