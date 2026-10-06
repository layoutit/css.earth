import { writeStyle } from '../rendering/retained-write.js';
import { createVolumeTextureReadiness } from '../volume/volume-texture-readiness.js';
import type { PreparedFocusBank } from './prepared-focus-bank.js';
import type { SceneLifetime } from '@cssearth/engine';
import { type DensityVolumeFrame, type PreparedPointVisibility, type DatasetBankBillboard, type DatasetBillboards } from '@cssearth/objects';
import { type WorldCameraPose } from '@cssearth/engine';
import type { WorldCameraViewport } from '../navigation/world-camera.js';
import { createPreparedVolumeDatasets, type PreparedVolumeDatasetSource } from '../volume/prepared-volume-datasets.js';
import { STACK_OPACITY_CEILING } from '../volume/prepared-volume-runtime.js';
import { projectedVolumeOpacity, projectVolumeSphere, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';

import { mountDatasetBillboards } from './dataset-billboards.js';
import { mountCataloguePoints } from './catalogue-points.js';
import { fetchPreparedCatalogueBank } from './catalogue-point-transport.js';
import type { PreparedUniverseOptions } from './prepared-universe-types.js';

type DatasetMount = ReturnType<ReturnType<typeof createPreparedVolumeDatasets>['mount']>;
interface DatasetBank {
  readonly id: string;
  readonly facts: DatasetBankBillboard;
  readonly billboardIndex: number;
  mounted: DatasetMount | null;
  /** The cause of the bank's last failed load, already reported. */
  failure?: string;
  /** Catalogue points drawn inside the mounted bank, with its opacity. */
  points: ReturnType<typeof mountCataloguePoints>[];
  textures: ReturnType<typeof createVolumeTextureReadiness> | null;
  loading: Promise<void> | null;
  generation: number;
  explicitEnabled: boolean | undefined;
  /** The dataset asked for, or the one the bank mounted with: selected at each mount, and what the bank's billboard pictures. */
  pendingSelection: string | undefined;
  pendingStarsVisible: boolean | undefined;
  framing: { frame: DensityVolumeFrame; radiusUnits: number; visibility: PreparedPointVisibility };
  residentNodes: number;
  visible: boolean;
  lastUsed: number;
  subscribers: number;
  enabled: boolean;
  /** Whether the last publication drew its slices: shown, with the images its view demands decoded. */
  drawn: boolean;
}

/** One stable record owns each declared bank through load, publication and eviction. */
export function createUniverseDatasetBanks({ root, end, frontRoot, frontEnd, lifetime, declarations, facts, frame, visibility,
  billboards: preparedBillboards, load, warmDomNodeBudget, requestPublication, prepareBillboardImage }: {
  root: HTMLElement; end: Element; frontRoot: HTMLElement; frontEnd: Element; lifetime: SceneLifetime;
  declarations: readonly { id: string; frame: DensityVolumeFrame }[];
  facts: readonly DatasetBankBillboard[];
  frame: { referenceFrame: string; epochJdTt: number };
  visibility: PreparedPointVisibility;
  billboards?: { plan: DatasetBillboards; imageUrl: (id: string, dataset?: string) => string };
  load: PreparedUniverseOptions['loadVolumeDataset'];
  warmDomNodeBudget: number;
  requestPublication?: () => boolean;
  prepareBillboardImage: (url: string) => boolean;
}) {
  let billboardCount = 0, useClock = 0, coasting = false;
  const pictured = (bankFacts: DatasetBankBillboard) => bankFacts.billboard !== undefined || (bankFacts.datasets?.size ?? 0) > 0;
  const record = (declared: { id: string; frame: DensityVolumeFrame }, bankFacts: DatasetBankBillboard): DatasetBank => ({
    id: declared.id, facts: bankFacts, billboardIndex: pictured(bankFacts) ? billboardCount++ : -1,
    mounted: null, points: [], textures: null, loading: null, generation: 0, explicitEnabled: undefined,
    // A bank's own star points stay hidden unless a caller shows them.
    pendingSelection: undefined, pendingStarsVisible: false,
    framing: { frame: declared.frame, radiusUnits: volumeFramingRadiusUnits(declared.frame), visibility },
    residentNodes: 0, visible: false, lastUsed: 0, subscribers: 0, drawn: false,
    enabled: !bankFacts.attached,
  });
  const banks: DatasetBank[] = declarations.map((declared, index) => record(declared, facts[index]!));
  const byId = new Map(banks.map(bank => [bank.id, bank]));
  const release = (bank: DatasetBank) => lifetime.onDispose(() => {
    bank.generation++;
    const mounted = bank.mounted;
    bank.mounted = null;
    bank.loading = null;
    for (const points of bank.points) points.destroy();
    bank.points = [];
    mounted?.destroy();
    bank.textures?.destroy(); bank.textures = null;
  });
  for (const bank of banks) release(bank);
  const billboardEntry = (bank: DatasetBank) => ({ id: bank.id, frame: bank.framing.frame, billboard: bank.facts.billboard,
    defaultDataset: bank.facts.defaultDataset, datasets: bank.facts.datasets });
  const mountBillboards = (entries: ReturnType<typeof billboardEntry>[]) => {
    const mounted = mountDatasetBillboards({ host: root, before: end, imageUrl: preparedBillboards!.imageUrl,
      imagePx: preparedBillboards!.plan.imagePx, entries, prepareImage: prepareBillboardImage });
    lifetime.onDispose(() => mounted.destroy());
    return mounted;
  };
  const billboardEntries = banks.filter(bank => bank.billboardIndex >= 0).map(billboardEntry);
  let billboards = billboardEntries.length ? mountBillboards(billboardEntries) : null;

  function publishResidency() {
    if (lifetime.disposed) return;
    const resident = banks.filter(bank => bank.mounted);
    const visible = resident.filter(bank => bank.visible);
    const pinned = resident.filter(bank => !bank.visible && bank.subscribers > 0);
    const warm = resident.filter(bank => !bank.visible && bank.subscribers === 0);
    root.dataset.volumeDatasetDeclaredBankCount = String(banks.length);
    root.dataset.volumeDatasetResidentBankCount = String(resident.length);
    root.dataset.volumeDatasetVisibleBankCount = String(visible.length);
    root.dataset.volumeDatasetPinnedBankCount = String(pinned.length);
    root.dataset.volumeDatasetWarmBankCount = String(warm.length);
    root.dataset.volumeDatasetPinnedDomNodes = String(pinned.reduce((nodes, bank) => nodes + bank.residentNodes, 0));
    root.dataset.volumeDatasetWarmDomNodes = String(warm.reduce((nodes, bank) => nodes + bank.residentNodes, 0));
    root.dataset.volumeDatasetWarmDomNodeBudget = String(warmDomNodeBudget);
  }
  function updateWeight(bank: DatasetBank) {
    bank.residentNodes = bank.mounted ? Number(bank.mounted.root.dataset.volumeResidentDomNodes) || 1 : 0;
  }
  function evict(bank: DatasetBank) {
    if (!bank.mounted || bank.visible || bank.subscribers > 0) return false;
    for (const points of bank.points) points.destroy();
    bank.points = [];
    bank.mounted.destroy();
    bank.textures?.destroy(); bank.textures = null;
    bank.mounted = null;
    bank.residentNodes = 0;
    bank.generation++;
    return true;
  }
  function trimWarmResidency() {
    if (lifetime.disposed) return;
    const warm = banks.filter(bank => bank.mounted && !bank.visible && bank.subscribers === 0);
    // Slice leaves appear as a bank is approached; weigh its current DOM.
    for (const bank of warm) updateWeight(bank);
    let nodes = warm.reduce((total, bank) => total + bank.residentNodes, 0);
    for (const bank of warm.sort((left, right) => left.lastUsed - right.lastUsed)) {
      if (nodes <= warmDomNodeBudget) break;
      const weight = bank.residentNodes;
      if (evict(bank)) nodes -= weight;
    }
    publishResidency();
  }
  function ensureLoaded(bank: DatasetBank): Promise<void> {
    if (lifetime.disposed) return Promise.resolve();
    if (bank.mounted || bank.loading) return bank.loading ?? Promise.resolve();
    if (!load) return Promise.resolve();
    const generation = bank.generation;
    const loading = load(bank.id).then(options => {
      if (lifetime.disposed || generation !== bank.generation || bank.mounted) return;
      // A bank arrives as its source (its index and the datasets read so far) or, from a caller that holds one whole, as the bank.
      const source = options.payload, whole = 'index' in source ? null : source;
      const loadedFrame = whole ? whole.datasets[0]!.volume.frame : (source as PreparedVolumeDatasetSource).frame;
      const datasetIds = (whole ?? (source as PreparedVolumeDatasetSource).index).datasets.map(dataset => dataset.id);
      if (loadedFrame.referenceFrame !== frame.referenceFrame || loadedFrame.epochJdTt !== frame.epochJdTt) {
        throw new TypeError('Prepared volume datasets must share the universe reference frame and epoch.');
      }
      const pendingDataset = bank.pendingSelection;
      if (pendingDataset !== undefined && !datasetIds.includes(pendingDataset)) {
        throw new TypeError(`Unknown prepared volume dataset: ${pendingDataset}.`);
      }
      const prepared = createPreparedVolumeDatasets(options);
      const mounted = prepared.mount({ host: root, before: end, frontHost: frontRoot, frontBefore: frontEnd });
      try {
        mounted.root.style.display = 'none';
        if (pendingDataset !== undefined) mounted.selectDataset(pendingDataset);
        // A bank that adopts server-drawn nodes mounts with their dataset; its billboard pictures that one.
        else bank.pendingSelection = mounted.state().selectedDataset;
        if (bank.pendingStarsVisible !== undefined) mounted.setStarsVisible(bank.pendingStarsVisible);
      } catch (error) { mounted.destroy(); throw error; }
      if (lifetime.disposed || generation !== bank.generation) { mounted.destroy(); return; }
      bank.mounted = mounted;
      const host = mounted.root;
      bank.points = (options.cataloguePointUrls ?? []).map(url => mountCataloguePoints({ host, url, loadBank: target => fetchPreparedCatalogueBank(target) }));
      bank.textures = createVolumeTextureReadiness(() => { requestPublication?.(); });
      const pointVisibility = prepared.payload.pointVisibility!;
      bank.framing = { frame: loadedFrame, radiusUnits: prepared.payload.framingRadiusUnits, visibility: {
        hiddenBelowRadiusPixels: Math.max(pointVisibility.hiddenBelowRadiusPixels, visibility.hiddenBelowRadiusPixels),
        fullAboveRadiusPixels: Math.max(pointVisibility.fullAboveRadiusPixels, visibility.fullAboveRadiusPixels) } };
      bank.enabled = bank.explicitEnabled ?? prepared.payload.attachedTo === undefined;
      bank.lastUsed = ++useClock;
      updateWeight(bank);
      trimWarmResidency();
      requestPublication?.();
    }).catch((error: unknown) => {
      // A bank that cannot be read is asked for again on a later view; its failure is said once for each cause, by name.
      const cause = error instanceof Error ? error.message : String(error);
      if (bank.failure !== cause) { bank.failure = cause; console.error(`Volume dataset bank ${bank.id} could not be loaded.`, error); }
      throw error;
    }).finally(() => { if (bank.loading === loading) bank.loading = null; });
    bank.loading = loading;
    return loading;
  }

  /** Whether the images the bank's view demands are decoded. A dataset asked for while another is on screen decodes
   * behind it: the bank keeps the images it shows until every image of the next is decoded, then takes them in one
   * frame. Written at once, each atlas painted as it landed: picking a dataset on M42 on the iPad made frames of 99, 77
   * and 75 ms, and one of 143 ms when the last atlas came off the network three seconds later (2026-10-05). */
  function texturesReady(bank: DatasetBank, publication: { world: WorldCameraPose; viewport: WorldCameraViewport }, demanded: boolean, incoming: boolean,
    /** The bank is asked on screen, not only kept resident: images nothing drew are decoded again first (`undrawn`). */ shows: boolean): boolean {
    const { mounted, textures } = bank;
    if (!mounted || !textures) return false;
    const urls = () => demanded ? mounted.textureUrls(publication, incoming) : [];
    const next = mounted.stagedDataset(), shown = urls();
    if (next === null) return textures.ready(shown, shows);
    // Nothing of the shown dataset is on screen to keep.
    if (!shown.length || !shown.every(url => textures.decoded(url))) { mounted.selectDataset(next); return textures.ready(urls(), shows); }
    // The swap is a change of images: it waits for a coast to stop (motion-freezes-membership.md).
    if (textures.ready([...new Set([...shown, ...mounted.textureUrls(publication, incoming, next)])], shows) && !coasting) mounted.selectDataset(next);
    return true;
  }

  function select(id: string, dataset: string) {
    if (lifetime.disposed) return;
    const bank = byId.get(id);
    if (!bank) throw new TypeError('Unknown prepared volume dataset bank.');
    bank.pendingSelection = dataset;
    bank.lastUsed = ++useClock;
    if (bank.mounted) {
      // A bank on screen keeps the dataset it shows until the next one's images are decoded (texturesReady).
      bank.mounted.selectDataset(dataset, bank.visible);
      if (bank.visible) void bank.mounted.read(dataset).then(() => { requestPublication?.(); }, () => {});
      updateWeight(bank);
      trimWarmResidency();
    } else void ensureLoaded(bank).catch(() => {});
  }

  function subscribe(id: string, listener: (state: ReturnType<DatasetMount['state']>) => void) {
    const bank = byId.get(id);
    if (!bank || lifetime.disposed) return () => {};
    bank.subscribers++;
    bank.lastUsed = ++useClock;
    publishResidency();
    let released = false;
    const release = () => {
      if (released) return;
      released = true;
      bank.subscribers--;
      trimWarmResidency();
    };
    if (bank.mounted) {
      const unsubscribe = bank.mounted.subscribe(listener);
      return () => { unsubscribe(); release(); };
    }
    let cancelled = false, unsubscribe: (() => void) | null = null;
    void ensureLoaded(bank).then(() => {
      if (cancelled || lifetime.disposed || !bank.mounted) return;
      unsubscribe = bank.mounted.subscribe(listener);
      listener(bank.mounted.state());
    }).catch(() => {});
    return () => { cancelled = true; unsubscribe?.(); release(); };
  }

  return {
    publishResidency,
    /** Declare a bank after mount, as one declared with it is: its host's entry brought it. A known id is ignored. */
    declare(declared: { id: string; frame: DensityVolumeFrame }, bankFacts: DatasetBankBillboard) {
      if (lifetime.disposed || byId.has(declared.id)) return;
      const bank = record(declared, bankFacts);
      banks.push(bank); byId.set(bank.id, bank); release(bank);
      // Its billboard joins the mounted layer; the first one makes it, after what the universe mounted since.
      if (bank.billboardIndex >= 0) {
        if (billboards) billboards.add(billboardEntry(bank)); else billboards = mountBillboards([billboardEntry(bank)]);
        billboards.setCoasting(coasting);
      }
      publishResidency();
    },
    select,
    focusBank(id: string): PreparedFocusBank | null {
      const bank = byId.get(id);
      return bank ? {
        objectId: bank.id,
        framingRadiusM: () => bank.framing.radiusUnits * bank.framing.frame.metersPerUnit,
        state: () => bank.mounted?.state() ?? null,
        load: () => ensureLoaded(bank),
        selectDataset: dataset => select(id, dataset),
        subscribe: listener => subscribe(id, listener),
      } : null;
    },
    setEnabled(id: string, enabled: boolean) {
      if (lifetime.disposed || typeof enabled !== 'boolean') return;
      const bank = byId.get(id);
      if (!bank?.facts.attached || bank.enabled === enabled) return;
      bank.explicitEnabled = enabled;
      bank.enabled = enabled;
      requestPublication?.();
    },
    setStarsVisible(visible: boolean) {
      if (lifetime.disposed) return;
      for (const bank of banks) {
        bank.pendingStarsVisible = visible;
        bank.mounted?.setStarsVisible(visible);
      }
    },
    /** While the camera coasts no bank mounts, shows or hides: a shown bank fades, the rest wait for the coast to stop
     * (motion-freezes-membership.md). */
    setCoasting(active: boolean) { coasting = active; billboards?.setCoasting(active); },
    /** Whether the bank's slices are on screen (its last publication drew them). */
    drawing(id: string): boolean { return byId.get(id)?.drawn === true; },
    /** `standIn`: the bank drawn in the detailed one's place until that one draws (detailed-focus-context.ts), of either
     * kind: it is drawn as the detailed bank is, and while one stands in the detailed bank's billboard stays out. */
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, volumeOpacity: number, detailContextOpacity: number, detailedObjectId?: string, bodyContextOpacity = 1,
      standIn?: string) {
      if (lifetime.disposed) return;
      let residencyChanged = false, drawingChanged = false;
      for (const bank of banks) {
        const { frame, radiusUnits, visibility } = bank.framing;
        const detailed = bank.id === detailedObjectId || bank.id === standIn;
        const presentationOpacity = detailed ? 1
          : detailContextOpacity * (bank.facts.attached ? 1 : bodyContextOpacity);
        const contextOpacity = bank.facts.contextVisibility === 'independent' ? 1 : volumeOpacity;
        // An attached volume shows with its host's dataset, and always as the page's own focus (M87 on /m87/).
        const shown = bank.enabled || detailed ? presentationOpacity * contextOpacity : 0;
        const requestedOpacity = shown * projectedVolumeOpacity(world, viewport, frame, radiusUnits, visibility);
        const incoming = bank.id === detailedObjectId;
        const ready = texturesReady(bank, { world, viewport }, shown > 0 && (requestedOpacity > 0 || incoming), incoming, requestedOpacity > 0);
        const opacity = ready ? requestedOpacity : 0;
        if (billboards && bank.billboardIndex >= 0) {
          // The billboard pictures the selected dataset; a dataset with no view of its own draws none.
          const billboardRadiusUnits = billboards.radiusUnits(bank.billboardIndex, bank.pendingSelection);
          const covered = standIn !== undefined && bank.id === detailedObjectId && !ready;
          const billboardOpacity = billboardRadiusUnits === undefined || covered ? 0
            : shown * projectedVolumeOpacity(world, viewport, frame, billboardRadiusUnits) * (ready ? 1 - opacity / Math.max(shown, Number.MIN_VALUE) : 1);
          billboards.publish(bank.billboardIndex, billboardOpacity, world, viewport, bank.pendingSelection);
        }
        const drawn = bank.mounted !== null && Boolean(ready) && opacity > 0;
        if (drawn !== bank.drawn) { bank.drawn = drawn; drawingChanged = true; }
        if (!bank.mounted) {
          const visible = requestedOpacity > 0 && projectVolumeSphere(world, viewport, frame, radiusUnits).visible;
          if (visible !== bank.visible) { bank.visible = visible; bank.lastUsed = ++useClock; residencyChanged = true; }
          if (visible && !coasting) void ensureLoaded(bank).catch(() => {});
          continue;
        }
        // Keep a demanded bank resident while its images decode behind the billboard.
        const visible = requestedOpacity > 0;
        if (visible !== bank.visible) { bank.visible = visible; bank.lastUsed = ++useClock; residencyChanged = true; }
        // Opacity is compared with what was last written to each root (retained-write.ts), so a bank a coast faded while
        // membership stayed frozen is restored. Display is a keyword and is read from the style, which mounting also writes.
        // Never 1 (STACK_OPACITY_CEILING), as a stack's own opacity: Safari paints every slice under the root again when its
        // opacity leaves or reaches 1. Each zoom out of the Crab and back had three frames over 33 ms on an iPad: 48 to 56 ms
        // as its 171 slices began to fade, 56 to 57 ms as they came back and 51 to 57 ms as the root reached 1; under the
        // ceiling, with the images decoded again before the return (`undrawn`), one of 46 to 50 ms (2026-10-06).
        for (const target of [bank.mounted.root, bank.mounted.frontRoot]) {
          if (!target) continue;
          if (coasting && target.style.display === 'none') continue;
          writeStyle(target, 'opacity', String(Math.min(STACK_OPACITY_CEILING, opacity)));
          if (!coasting) {
            const display = opacity > 0 ? 'block' : 'none';
            if (target.style.display !== display) {
              target.style.display = display;
              // Out of layout nothing draws the bank's images: they are decoded again before it shows (volume-texture-readiness.ts).
              if (display === 'none') bank.textures?.undrawn();
            }
          }
        }
        bank.mounted.publish({ world, viewport }, visible && Boolean(ready), coasting);
        if (visible && ready) for (const points of bank.points) points.publish({ world, viewport });
      }
      if (residencyChanged) trimWarmResidency();
      // Who hands the picture over to a bank, or takes it back, learns that it draws with the camera still.
      if (drawingChanged) requestPublication?.();
    },
  };
}
