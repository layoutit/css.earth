import type { SceneLifetime } from '@cssearth/engine';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { mountPreparedCssImageLayers } from '../image-layers/prepared-image-layer-runtime.js';
import { projectedVolumeOpacity, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';
import { mountPreparedGalaxyCatalog } from './prepared-galaxy-catalog.js';
import type { PreparedCatalogBank, PreparedImageLayerBank, PreparedUniverseOptions } from './prepared-universe-types.js';

interface ImageBank {
  readonly id: string;
  readonly frame: DensityVolumeFrame;
  readonly radiusUnits: number;
  mounted: ReturnType<typeof mountPreparedCssImageLayers> | null;
  loading: Promise<void> | null;
  publishedOpacity: number;
}

/** Catalogue and image layers remain descriptor-only until visibility or navigation admits them. */
export function createUniverseCatalogBanks({ root, end, stage, lifetime, declarations, initialImages, volumeDeclarations,
  initialCatalog, catalogBank, loadCatalog, loadImageLayer, onSelect, requestPublication }: {
  root: HTMLElement; end: Element; stage: HTMLElement; lifetime: SceneLifetime;
  declarations: readonly { id: string; frame: DensityVolumeFrame }[];
  initialImages: ReadonlyMap<string, PreparedImageLayerBank>;
  volumeDeclarations: readonly { id: string; frame: DensityVolumeFrame }[];
  initialCatalog?: PreparedCatalogBank;
  catalogBank: PreparedUniverseOptions['catalogBank'];
  loadCatalog: PreparedUniverseOptions['loadCatalog'];
  loadImageLayer: PreparedUniverseOptions['loadImageLayer'];
  onSelect?: (object: PreparedCatalogObject) => void;
  requestPublication?: () => boolean;
}) {
  let catalog: ReturnType<typeof mountPreparedGalaxyCatalog> | null = null;
  let catalogPayload = initialCatalog, catalogLoading: Promise<void> | null = null;
  const images: ImageBank[] = declarations.map(bank => ({ ...bank, radiusUnits: volumeFramingRadiusUnits(bank.frame),
    mounted: null, loading: null, publishedOpacity: NaN }));
  const byId = new Map(images.map(bank => [bank.id, bank]));
  lifetime.onDispose(() => {
    const mounted = catalog;
    catalog = null;
    catalogPayload = undefined;
    catalogLoading = null;
    mounted?.destroy();
  });
  for (const bank of images) lifetime.onDispose(() => {
    const mounted = bank.mounted;
    bank.mounted = null;
    bank.loading = null;
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
    catalog = mountPreparedGalaxyCatalog({ host: root, before: end, payload: bank.payload, galaxySample: bank.galaxySample,
      clusters: bank.clusters?.payload, nebulae: bank.nebulae,
      renderedObjectIds: new Set([...declarations.map(image => image.id), ...volumeDeclarations.map(lens => lens.id)]),
      nebulaFrames: new Map(volumeDeclarations.map(lens => [lens.id, lens.frame])), onSelect, pickingHost: stage });
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
      bank.mounted = mountPreparedCssImageLayers({ host: root, before: end, ...loaded });
      bank.mounted.root.style.display = 'none';
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
    ensureImageLayer(id: string) {
      const bank = byId.get(id);
      return bank ? ensureImage(bank) : Promise.resolve();
    },
    imageLayerFrames: Object.freeze(Object.fromEntries(declarations.map(bank => [bank.id, bank.frame]))),
    publishImages(world: WorldCameraPose, viewport: WorldCameraViewport, volumeOpacity: number, detailedObjectId?: string) {
      if (lifetime.disposed) return;
      for (const bank of images) {
        // A galaxy's slices paint only for the observer who selected it.
        const presentationOpacity = bank.id === detailedObjectId ? 1 : 0;
        const opacity = presentationOpacity * volumeOpacity * projectedVolumeOpacity(world, viewport, bank.frame, bank.radiusUnits);
        if (!bank.mounted) {
          if (opacity > 0) void ensureImage(bank).catch(() => {});
          continue;
        }
        if (opacity !== bank.publishedOpacity) {
          bank.mounted.root.style.opacity = String(opacity);
          bank.mounted.root.style.display = opacity > 0 ? '' : 'none';
          bank.publishedOpacity = opacity;
        }
        if (opacity > 0) bank.mounted.publish({ world, viewport });
      }
    },
  };
}
