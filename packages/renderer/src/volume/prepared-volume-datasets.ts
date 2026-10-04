import { samePreparedCatalogueGeometry, validatePreparedVolumeDatasets, PREPARED_VOLUME_DATASETS_SCHEMA, parseObjectDescriptor, parseDensityVolumeFrame, readPreparedObject, samePreparedVolumeTopology, type PreparedVolumeDataset, type PreparedVolumeDatasetBrightness, type PreparedVolumeDatasets, type PreparedAssets, type PreparedCssVolume, type VolumeAxis } from '@cssearth/objects';
import { PREPARED_VOLUME_DATASET_INDEX_SCHEMA, splitPreparedVolumeDatasets, trustPreparedCataloguePoints, trustPreparedCssVolume, validatePreparedVolumeDatasetIndex,
  type DensityVolumeFrame, type PreparedCataloguePoints, type PreparedVolumeDatasetEntry, type PreparedVolumeDatasetIndex } from '@cssearth/objects';
import { readPrepared } from '../prepared-data-worker-client.js';
import { readPreparedHere } from '../prepared-data/prepared-readers.js';
import { PREPARED_CSS_VOLUME_READER, PREPARED_VOLUME_STARS_READER } from './prepared-volume-readers.js';
import { writeData, writeStyle } from '../rendering/retained-write.js';
import { preparedVolumeTexturePaths } from './prepared-volume-runtime.js';
import { projectVolumeImpostors } from './volume-impostor-projection.js';
import { preparedDomAdoption } from '../rendering/prepared-dom-adoption.js';
import { mountPreparedVolumeLod } from './prepared-volume-lod.js';
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

/**
 * What the page holds of a dataset bank: its index, and the files of the datasets it has shown. A bank's files are one
 * a dataset (@cssearth/objects volume-dataset-bank-files.ts); the page reads the index when the bank arrives and a
 * dataset's volume and stars when that dataset is first selected.
 */
export interface PreparedVolumeDatasetSource {
  readonly index: PreparedVolumeDatasetIndex;
  /** The frame every dataset of the bank shares. */
  readonly frame: DensityVolumeFrame;
  /** A dataset's files, once read. */
  volume(id: string): PreparedCssVolume | undefined;
  stars(id: string): PreparedCataloguePoints | undefined;
  /** Read a dataset's files. Every caller waiting for one dataset shares one read; a failed read is tried again. */
  load(id: string): Promise<void>;
}

/** A whole bank in memory as a source with every dataset read: what a preparation or a test holds. */
export function preparedVolumeDatasetSource(input: PreparedVolumeDatasets): PreparedVolumeDatasetSource {
  const bank = validatePreparedVolumeDatasets(input), byId = new Map(bank.datasets.map(dataset => [dataset.id, dataset] as const));
  return Object.freeze({ index: validatePreparedVolumeDatasetIndex(splitPreparedVolumeDatasets(bank).index), frame: bank.datasets[0]!.volume.frame,
    volume: (id: string) => byId.get(id)?.volume, stars: (id: string) => byId.get(id)?.stars, load: () => Promise.resolve() });
}

/** A reader of a bank's files over a transport that returns their bytes, on this thread: Node tools and tests. */
export function preparedTransportReader(transport: PreparedCssTransport) {
  return <Value>(kind: string, path: string): Promise<Value> =>
    readPreparedHere(kind, path, (async (url: string | URL | Request) => new Response(await transport.read(String(url)))) as typeof fetch).then(reading => reading.value as Value);
}

/** Read a bank's index and the files of one dataset (its default unless `dataset` names another); preparation is never
 * a runtime fallback. `resolve` gives the address of a file named as the descriptor names its index (`prepared/…`), and
 * `read` reads one by its kind, in the data worker unless the caller reads elsewhere. */
export async function loadPreparedVolumeDatasets(input: unknown, transport: PreparedCssTransport, { resolve, read = readPrepared, dataset }: {
  resolve(path: string): string; read?<Value>(kind: string, url: string): Promise<Value>; dataset?: string;
}): Promise<PreparedVolumeDatasetSource> {
  const descriptor = parseObjectDescriptor(input);
  if (descriptor.type !== 'volume-dataset-bank' || descriptor.prepared?.format !== PREPARED_VOLUME_DATASET_INDEX_SCHEMA) {
    throw new TypeError(`Volume dataset bank ${descriptor.id} requires its ${PREPARED_VOLUME_DATASET_INDEX_SCHEMA} index, got ${JSON.stringify(descriptor.prepared?.format ?? null)}.`);
  }
  const frame = parseDensityVolumeFrame(descriptor.properties.frame), reference = descriptor.prepared.url, directory = reference.replace(/[^/]*$/u, '');
  const bytes = await transport.read(reference);
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const index = readPreparedObject(value, descriptor, validatePreparedVolumeDatasetIndex).data;
  if (index.id !== descriptor.id) throw new TypeError(`Volume dataset bank ${descriptor.id}: its index is of ${index.id}.`);
  const entries = new Map(index.datasets.map(entry => [entry.id, entry] as const));
  const volumes = new Map<string, PreparedCssVolume>(), stars = new Map<string, PreparedCataloguePoints>(), starFiles = new Map<string, Promise<PreparedCataloguePoints>>();
  const loads = new Map<string, Promise<void>>();
  const readStars = (file: string) => {
    let reading = starFiles.get(file);
    if (!reading) {
      starFiles.set(file, reading = read<PreparedCataloguePoints>(PREPARED_VOLUME_STARS_READER, resolve(directory + file)).then(trustPreparedCataloguePoints));
      reading.catch(() => { if (starFiles.get(file) === reading) starFiles.delete(file); });
    }
    return reading;
  };
  const load = (id: string): Promise<void> => {
    const entry = entries.get(id);
    if (!entry) return Promise.reject(new TypeError(`Volume dataset bank ${index.id} has no dataset ${id}.`));
    let loading = loads.get(id);
    if (!loading) {
      const reading = loading = Promise.all([read<PreparedCssVolume>(PREPARED_CSS_VOLUME_READER, resolve(directory + entry.volume)), readStars(entry.stars)]).then(([volume, points]) => {
        if (JSON.stringify(volume.frame) !== JSON.stringify(frame)) throw new TypeError(`Volume dataset bank ${index.id}: dataset ${id} is not in its descriptor's frame.`);
        volumes.set(id, trustPreparedCssVolume(volume)); stars.set(id, points);
      });
      loads.set(id, reading);
      reading.catch(() => { if (loads.get(id) === reading) loads.delete(id); });
    }
    return loading;
  };
  await load(dataset !== undefined && entries.has(dataset) ? dataset : index.defaultDataset);
  return Object.freeze({ index, frame, volume: (id: string) => volumes.get(id), stars: (id: string) => stars.get(id), load });
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

/** A dataset as the mount holds it: its index entry, with its files read through the source. */
type MountedDataset = Omit<PreparedVolumeDatasetEntry, 'volume' | 'stars'> & { readonly volume: PreparedCssVolume; readonly stars: PreparedCataloguePoints };

/** Fixed declared bank; visible LODs attach their own textures on demand. `payload` is the bank's source (its index and
 * the datasets read so far), or a whole bank in memory. */
export function createPreparedVolumeDatasets({ payload, resolveResource }: {
  payload: PreparedVolumeDatasetSource | PreparedVolumeDatasets; resolveResource(path: string): string;
}) {
  const source = 'index' in payload ? payload : preparedVolumeDatasetSource(payload);
  const data = source.index, pool = `volume-datasets:${data.id}`;
  // A dataset's files are read before it is shown; reading one that is not is a fault of the caller, named here.
  const held = <Value>(id: string, value: Value | undefined, what: string): Value => {
    if (value === undefined) throw new TypeError(`Volume dataset bank ${data.id}: dataset ${id} is shown before its ${what} is read.`);
    return value;
  };
  const datasets: readonly MountedDataset[] = data.datasets.map(({ volume: _volume, stars: _stars, ...entry }) => Object.freeze({ ...entry,
    get volume() { return held(entry.id, source.volume(entry.id), 'volume'); }, get stars() { return held(entry.id, source.stars(entry.id), 'stars'); } }));
  // The datasets of one family share their geometry (the index's `topology`): one surface shows whichever is selected.
  const topologyFamilies: MountedDataset[][] = [];
  for (const dataset of datasets) (topologyFamilies[dataset.topology] ??= []).push(dataset);
  const paths = [...new Set(data.datasets.flatMap(dataset => dataset.resources.map(resource => resource.path)))];
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
  return Object.freeze({ assets, payload: data, source,
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
      // The dataset the server rendered, when its files are read; otherwise the bank's default, which the loader reads.
      let selected = selectedNative !== undefined && source.volume(selectedNative) ? selectedNative : data.defaultDataset, destroyed = false, latest: VolumeCameraPublication | null = null;
      // The dataset asked for last: a selection whose files are still being read is shown when they arrive, unless another was asked for since.
      let wanted = selected;
      let starsVisible = data.starsEnabled ?? true;
      const listeners = new Set<(state: PreparedVolumeDatasetState) => void>();
      const datasetContent = Object.freeze(data.datasets.map(({ id, label, title, description, sourceUrl }) =>
        Object.freeze({ id, label, title, description, sourceUrl })));
      const datasetById = new Map(datasets.map(dataset => [dataset.id, dataset] as const));
      const families: { datasets: readonly MountedDataset[]; active: { dataset: MountedDataset }; surface: HTMLElement;
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
      const ensureFamily = (dataset: MountedDataset) => {
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
          /** Show dataset `id`. One whose files are not read yet is read first and shown on arrival; the bank keeps the
           * dataset it shows until then. */
          selectDataset(id: string) {
            if (destroyed) return;
            const next = datasetById.get(id);
            if (!next) throw new TypeError(`Unknown prepared volume dataset: ${id}.`);
            wanted = id;
            if (id === selected) return;
            if (!source.volume(id) || !source.stars(id)) {
              source.load(id).then(() => { if (!destroyed && wanted === id) this.selectDataset(id); },
                (error: unknown) => { if (wanted === id) wanted = selected; console.error(`Volume dataset bank ${data.id}: dataset ${id} could not be read.`, error); });
              return;
            }
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
