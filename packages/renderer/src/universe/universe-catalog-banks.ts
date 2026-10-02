import { createImageFocusBank, createPointFocusBank } from './prepared-focus-bank.js';
import type { SceneLifetime } from '@cssearth/engine';
import { type PreparedCatalogObject, type DensityVolumeFrame, type WorldCameraPose } from '@cssearth/objects';
import type { WorldCameraViewport } from '../navigation/world-camera.js';
import { mountPreparedCssImageLayers } from '../image-layers/prepared-image-layer-runtime.js';
import { outsideVolumeOpacity, projectedVolumeOpacity, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';
import { mountPreparedGalaxyCatalog } from './prepared-galaxy-catalog.js';
import { mountDatasetBillboards } from './dataset-billboards.js';
import { fetchPreparedCatalogueBank, mountCataloguePoints } from './catalogue-points.js';
import type { PreparedCatalogBank, PreparedUniverseOptions } from './prepared-universe-types.js';
import type { PreparedImageLayerMount } from './prepared-universe-types.js';

interface ImageBank {
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly radiusUnits: number;
  mounted: ReturnType<typeof mountPreparedCssImageLayers> | null;
  /** Its catalogue dots, mounted beside its slices and given their opacity, or their own from inside the galaxy. */
  points: ReturnType<typeof mountCataloguePoints>[];
  /** Whether the dots drew on the last publication: a hidden bank is told once, not every frame. */
  dotsShown: boolean;
  loading: Promise<void> | null;
  publishedOpacity: number;
  /** Its leaf in the billboard layer, and whether that billboard fades with the Milky Way; -1 without a billboard. */
  billboardIndex: number;
  billboardRadiusUnits: number;
  independent: boolean;
}

/** Catalogue and image layers remain descriptor-only until visibility or navigation admits them. */
export function createUniverseCatalogBanks({ root, end, stage, lifetime, declarations, initialImages, volumeDeclarations,
  initialCatalog, catalogBank, loadCatalog, loadImageLayer, requestPublication, billboards: prepared, stellarExtents = {}, prepareBillboardAtlas,
  pointBanks = [] }: {
  root: HTMLElement; end: Element; stage: HTMLElement; lifetime: SceneLifetime;
  declarations: readonly { id: string; frame: DensityVolumeFrame }[];
  initialImages: ReadonlyMap<string, PreparedImageLayerMount>;
  volumeDeclarations: readonly { id: string; frame: DensityVolumeFrame }[];
  initialCatalog?: PreparedCatalogBank;
  catalogBank: PreparedUniverseOptions['catalogBank'];
  loadCatalog: PreparedUniverseOptions['loadCatalog'];
  loadImageLayer: PreparedUniverseOptions['loadImageLayer'];
  requestPublication?: () => boolean;
  prepareBillboardAtlas: () => boolean;
  /** Published stellar extents in metres by object id (PreparedUniverseOptions.stellarExtents). */
  stellarExtents?: Readonly<Record<string, number>>;
  /** The prepared billboards: a galaxy with one shows its Sun-facing view from afar, before and without its slices. */
  billboards?: PreparedUniverseOptions['datasetBillboards'];
  /** Packages that are only catalogue dots (PreparedUniverseOptions.pointBanks). */
  pointBanks?: PreparedUniverseOptions['pointBanks'];
}) {
  let catalog: ReturnType<typeof mountPreparedGalaxyCatalog> | null = null;
  let catalogPayload = initialCatalog, catalogLoading: Promise<void> | null = null;
  let billboardCount = 0;
  const images: ImageBank[] = declarations.map(bank => {
    const facts = prepared?.plan.banks.get(bank.id);
    return { ...bank, radiusUnits: volumeFramingRadiusUnits(bank.frame), mounted: null, points: [], dotsShown: false, loading: null, publishedOpacity: NaN,
      billboardIndex: facts?.billboard ? billboardCount++ : -1, billboardRadiusUnits: facts?.billboard?.radiusUnits ?? 0,
      independent: facts?.contextVisibility === 'independent' };
  });
  const byId = new Map(images.map(bank => [bank.id, bank]));
  // A package that is only catalogue dots mounts them the first time its catalogue row is selected; they draw while it is.
  const points = (pointBanks ?? []).map(bank => ({ id: bank.id, url: bank.url, host: bank.host, mounted: null as ReturnType<typeof mountCataloguePoints> | null }));
  lifetime.onDispose(() => { for (const bank of points) { bank.mounted?.destroy(); bank.mounted = null; } });
  const billboardEntries = images.flatMap(bank => {
    const billboard = prepared?.plan.banks.get(bank.id)?.billboard;
    return billboard ? [{ id: bank.id, frame: bank.frame, billboard }] : [];
  });
  // Mounted with the bank declarations, after the opaque galaxy backdrop: the atlas itself loads when one first shows.
  const billboards = billboardEntries.length ? mountDatasetBillboards({ host: root, before: end, atlasUrl: prepared!.atlasUrl,
    atlas: prepared!.plan.atlas, entries: billboardEntries, prepareAtlas: prepareBillboardAtlas }) : null;
  if (billboards) lifetime.onDispose(() => billboards.destroy());
  lifetime.onDispose(() => {
    const mounted = catalog;
    catalog = null;
    catalogPayload = undefined;
    catalogLoading = null;
    mounted?.destroy();
  });
  for (const bank of images) lifetime.onDispose(() => {
    const mounted = bank.mounted, points = bank.points;
    bank.mounted = null;
    bank.points = [];
    bank.loading = null;
    for (const layer of points) layer.destroy();
    mounted?.destroy();
  });

  function publishResidency() {
    if (lifetime.disposed) return;
    root.dataset.imageLayerDeclaredBankCount = String(images.length);
    root.dataset.imageLayerResidentBankCount = String(images.filter(bank => bank.mounted).length);
    root.dataset.imageLayerLoadingBankCount = String(images.filter(bank => bank.loading).length);
    root.dataset.catalogResident = String(Boolean(catalog));
    root.dataset.catalogLoading = String(Boolean(catalogLoading));
  }
  function mountCatalog(bank: PreparedCatalogBank) {
    if (catalog || lifetime.disposed) return;
    globalThis.performance?.mark?.('cssEarth:catalog:mount');
    catalog = mountPreparedGalaxyCatalog({ host: root, before: end, payload: bank.payload, galaxySample: bank.galaxySample,
      clusters: bank.clusters?.payload, nebulae: bank.nebulae });
    publishResidency();
  }
  function ensureCatalog(): Promise<void> {
    if (lifetime.disposed || catalog) return Promise.resolve();
    if (catalogPayload) { mountCatalog(catalogPayload); return Promise.resolve(); }
    if (!loadCatalog) return Promise.resolve();
    if (catalogLoading) return catalogLoading;
    catalogLoading = loadCatalog().then(bank => {
      if (lifetime.disposed) return;
      catalogPayload = bank;
      mountCatalog(bank);
      requestPublication?.();
    }).finally(() => { catalogLoading = null; publishResidency(); });
    publishResidency();
    return catalogLoading;
  }
  function ensureImage(bank: ImageBank): Promise<void> {
    if (lifetime.disposed || bank.mounted) return Promise.resolve();
    if (bank.loading) return bank.loading;
    const eager = initialImages.get(bank.id);
    const loading = eager ? Promise.resolve(eager) : loadImageLayer?.(bank.id);
    if (!loading) return Promise.resolve();
    bank.loading = loading.then(loaded => {
      if (lifetime.disposed || bank.mounted) return;
      if (loaded.payload.id !== bank.id || JSON.stringify(loaded.payload.frame) !== JSON.stringify(bank.frame)) {
        throw new TypeError('Prepared image-layer identity/frame mismatch.');
      }
      bank.mounted = mountPreparedCssImageLayers({ host: root, before: end, payload: loaded.payload, resolveResource: loaded.resolveResource });
      bank.mounted.root.style.display = 'none';
      // The dots are mounted beside the slices, not inside them: from inside the galaxy they draw without its photograph.
      bank.points = (loaded.cataloguePointUrls ?? []).map(url => mountCataloguePoints({ host: root, before: end, url,
        loadBank: target => fetchPreparedCatalogueBank(target, (input, init) => root.ownerDocument.defaultView!.fetch(input, init)) }));
      requestPublication?.();
    }).finally(() => { bank.loading = null; publishResidency(); });
    publishResidency();
    return bank.loading;
  }

  return {
    get catalog() { return catalog; },
    get presentation() { return catalogPayload ?? catalogBank; },
    ensureCatalog,
    publishResidency,
    loadInitialImages() {
      for (const bank of images) if (initialImages.has(bank.id)) void ensureImage(bank);
    },
    mountInitialCatalog() { if (catalogPayload) mountCatalog(catalogPayload); },
    focusBank(id: string) {
      const bank = byId.get(id);
      if (bank) return createImageFocusBank(bank.id, bank.frame, () => ensureImage(bank));
      // A bank of dots has one dataset, its members; the dots mount when they are first shown.
      return points.some(point => point.id === id) ? createPointFocusBank(id) : null;
    },
    /** Draw the selected package's catalogue dots, and those of the selected body's system (`systemIds`: the body and the
     * centre it orbits), and hide every other's. */
    publishPoints(world: WorldCameraPose, viewport: WorldCameraViewport, selectedObjectId?: string, systemIds: readonly string[] = []) {
      if (lifetime.disposed) return;
      for (const bank of points) {
        const selected = bank.id === selectedObjectId || bank.host !== undefined && systemIds.includes(bank.host);
        if (!bank.mounted && !selected) continue;
        bank.mounted ??= mountCataloguePoints({ host: root, before: end, url: bank.url,
          loadBank: target => fetchPreparedCatalogueBank(target, (input, init) => root.ownerDocument.defaultView!.fetch(input, init)) });
        bank.mounted.publish({ world, viewport }, selected ? 1 : 0);
      }
    },
    /** While the camera coasts no billboard is revealed or hidden (motion-freezes-membership.md). */
    setCoasting(active: boolean) { billboards?.setCoasting(active); },
    /** The image bank whose framing sphere holds `positionM`: the galaxy a selected star is in. */
    imageBankContaining(positionM: readonly number[]): string | undefined {
      return images.find(bank => Math.hypot(...positionM.map((value, axis) => value - bank.frame.originM[axis]!)) <= bank.radiusUnits * bank.frame.metersPerUnit)?.id;
    },
    /** `inside` is the galaxy the selected body is in, and how much of its dots show: a star of M33 stands among M33's
     * catalogue dots, without the photograph that is the galaxy seen from outside. */
    publishImages(world: WorldCameraPose, viewport: WorldCameraViewport, volumeOpacity: number, detailedObjectId?: string,
      inside?: { readonly objectId: string; readonly opacity: number }) {
      if (lifetime.disposed) return;
      for (const bank of images) {
        // A galaxy's slices paint only for the observer who selected it, at any distance from it: the context's distance
        // fade is measured from the selected body, which is the galaxy itself.
        const opacity = bank.id === detailedObjectId ? projectedVolumeOpacity(world, viewport, bank.frame, bank.radiusUnits) : 0;
        // Its billboard shows it from everywhere else, and gives way as the loaded slices fade in.
        if (billboards && bank.billboardIndex >= 0) {
          const context = bank.independent ? 1 : volumeOpacity;
          const handoff = bank.mounted ? Math.min(1, opacity / Math.max(context, Number.MIN_VALUE)) : 0;
          billboards.publish(bank.billboardIndex, context * projectedVolumeOpacity(world, viewport, bank.frame, bank.billboardRadiusUnits) * (1 - handoff) *
            outsideVolumeOpacity(world, bank.frame, bank.radiusUnits), world, viewport);
        }
        const dotOpacity = Math.max(opacity, inside?.objectId === bank.id ? inside.opacity : 0);
        if (!bank.mounted) {
          if (dotOpacity > 0) void ensureImage(bank).catch(() => {});
          continue;
        }
        if (dotOpacity > 0 || bank.dotsShown) {
          for (const points of bank.points) points.publish({ world, viewport }, dotOpacity);
          bank.dotsShown = dotOpacity > 0;
        }
        if (opacity !== bank.publishedOpacity) {
          bank.mounted.root.style.opacity = String(opacity);
          if (opacity > 0 && bank.mounted.root.style.display === 'none') bank.mounted.revealLarge();
          bank.mounted.root.style.display = opacity > 0 ? '' : 'none';
          bank.publishedOpacity = opacity;
        }
        if (opacity > 0) bank.mounted.publish({ world, viewport });
      }
    },
  };
}
