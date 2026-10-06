import { createImageFocusBank, createPointFocusBank } from './prepared-focus-bank.js';
import { STACK_OPACITY_CEILING } from '../volume/prepared-volume-runtime.js';
import type { SceneLifetime } from '@cssearth/engine';
import { type PreparedCatalogObject, type DensityVolumeFrame } from '@cssearth/objects';
import { type WorldCameraPose } from '@cssearth/engine';
import type { WorldCameraViewport } from '../navigation/world-camera.js';
import { mountPreparedCssImageLayers } from '../image-layers/prepared-image-layer-runtime.js';
import { outsideVolumeOpacity, projectedVolumeOpacity, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';
import { mountPreparedGalaxyCatalog } from './prepared-galaxy-catalog.js';
import { mountDatasetBillboards } from './dataset-billboards.js';
import { mountCataloguePoints } from './catalogue-points.js';
import { fetchPreparedCatalogueBank } from './catalogue-point-transport.js';
import type { PreparedCatalogBank, PreparedUniverseOptions, PreparedImageLayerMount } from './prepared-universe-types.js';

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
  /** Its light lies on walls around its middle, and the object it draws for: it stands in for that object around a body
   * inside it (ImageLayerBankDescriptor `surrounds` and `host`). */
  surrounds: boolean;
  host: string | undefined;
  /** The selected body it was last shown for: it is kept in layout only while that body stays selected. */
  shownFor: unknown;
}

/** Catalogue and image layers remain descriptor-only until visibility or navigation admits them. */
export function createUniverseCatalogBanks({ root, end, stage, lifetime, declarations, initialImages, volumeDeclarations,
  initialCatalog, catalogBank, loadCatalog, loadImageLayer, requestPublication, billboards: prepared, stellarExtents = {}, prepareBillboardImage,
  pointBanks = [], imagesBefore = end }: {
  root: HTMLElement; end: Element; stage: HTMLElement; lifetime: SceneLifetime;
  /** Where a galaxy's billboard and its image slices mount: under the world's dot layer, so its catalogue's dots and its
   * stars' show over its picture. Without one they mount where every other layer does. */
  imagesBefore?: Element;
  declarations: readonly { id: string; frame: DensityVolumeFrame; surrounds?: true; host?: string }[];
  initialImages: ReadonlyMap<string, PreparedImageLayerMount>;
  volumeDeclarations: readonly { id: string; frame: DensityVolumeFrame }[];
  initialCatalog?: PreparedCatalogBank;
  catalogBank: PreparedUniverseOptions['catalogBank'];
  loadCatalog: PreparedUniverseOptions['loadCatalog'];
  loadImageLayer: PreparedUniverseOptions['loadImageLayer'];
  requestPublication?: () => boolean;
  prepareBillboardImage: (url: string) => boolean;
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
    return { id: bank.id, frame: bank.frame, radiusUnits: volumeFramingRadiusUnits(bank.frame), mounted: null, points: [], dotsShown: false, loading: null, publishedOpacity: NaN,
      billboardIndex: facts?.billboard ? billboardCount++ : -1, billboardRadiusUnits: facts?.billboard?.radiusUnits ?? 0,
      independent: facts?.contextVisibility === 'independent', surrounds: bank.surrounds === true, host: bank.host, shownFor: undefined };
  });
  const byId = new Map(images.map(bank => [bank.id, bank]));
  // A package that is only catalogue dots mounts them the first time its catalogue row is selected; they draw while it is.
  const points = (pointBanks ?? []).map(bank => ({ id: bank.id, url: bank.url, host: bank.host, stars: bank.stars === true, mounted: null as ReturnType<typeof mountCataloguePoints> | null }));
  lifetime.onDispose(() => { for (const bank of points) { bank.mounted?.destroy(); bank.mounted = null; } });
  const billboardEntries = images.flatMap(bank => {
    const billboard = prepared?.plan.banks.get(bank.id)?.billboard;
    return billboard ? [{ id: bank.id, frame: bank.frame, billboard }] : [];
  });
  // Mounted with the bank declarations, after the opaque galaxy backdrop: a billboard's image loads when it first shows.
  const billboards = billboardEntries.length ? mountDatasetBillboards({ host: root, before: imagesBefore, imageUrl: prepared!.imageUrl,
    imagePx: prepared!.plan.imagePx, entries: billboardEntries, prepareImage: prepareBillboardImage }) : null;
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

  /** The bank last drawn for the selected body stays in layout at opacity 0 when it leaves the picture, until the body
   * changes or another of its banks takes that place. Out of layout, a bank shown again makes every layer anew: on an
   * iPad Cassiopeia A's 1,397 patches made a frame of 272 to 281 ms each time, 220 to 231 ms when hidden by
   * `visibility`, and 24 to 42 ms from opacity 0, where Safari keeps the layers and their surfaces. Its second bank of
   * 773 patches kept that way held 25 MB more in the page's process (2026-10-06). A reader who goes back to the
   * dataset before, or zooms out and in again, gets the kept bank. */
  let kept: ImageBank | null = null, keptFor: unknown;
  function leaveLayout(bank: ImageBank) { if (bank.mounted) bank.mounted.root.style.display = 'none'; }
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
      bank.mounted = mountPreparedCssImageLayers({ host: root, before: imagesBefore, payload: loaded.payload, resolveResource: loaded.resolveResource,
        onDrawn: () => { requestPublication?.(); } });
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
    /** Packages of catalogue dots declared after mount (their host's entry brought them); a known id is ignored. */
    addPointBanks(added: NonNullable<PreparedUniverseOptions['pointBanks']>) {
      if (lifetime.disposed) return;
      for (const bank of added) if (!points.some(point => point.id === bank.id)) points.push({ id: bank.id, url: bank.url, host: bank.host, stars: bank.stars === true, mounted: null });
    },
    focusBank(id: string) {
      const bank = byId.get(id);
      if (bank) return createImageFocusBank(bank.id, bank.frame, () => ensureImage(bank));
      // A bank of dots has one dataset, its members; the dots mount when they are first shown.
      return points.some(point => point.id === id) ? createPointFocusBank(id) : null;
    },
    /** Draw the selected package's catalogue dots, and those of the selected body's system (`systemIds`: the body and the
     * centre it orbits), and hide every other's. `stars`: a bank of plain-dot stars draws too while the selected body is
     * inside its host (`inside`: the objects it is inside), with the look every star dot has and without the dots at the
     * places of the stars a body marker draws (`look`, asked only while such a bank shows). */
    publishPoints(world: WorldCameraPose, viewport: WorldCameraViewport, selectedObjectId?: string, systemIds: readonly string[] = [],
      stars?: { readonly inside: readonly string[]; look(): { readonly opacity: number; readonly hiddenAtM: readonly (readonly number[])[] } }) {
      if (lifetime.disposed) return;
      for (const bank of points) {
        const selected = bank.id === selectedObjectId || bank.host !== undefined && (systemIds.includes(bank.host) || bank.stars && stars?.inside.includes(bank.host) === true);
        if (!bank.mounted && !selected) continue;
        bank.mounted ??= mountCataloguePoints({ host: root, before: end, url: bank.url,
          loadBank: target => fetchPreparedCatalogueBank(target, (input, init) => root.ownerDocument.defaultView!.fetch(input, init)) });
        const shown = selected && bank.stars ? stars?.look() : undefined;
        if (shown) bank.mounted.publish({ world, viewport }, shown.opacity, shown.hiddenAtM);
        else bank.mounted.publish({ world, viewport }, selected ? 1 : 0);
      }
    },
    /** While the camera coasts no billboard is revealed or hidden (motion-freezes-membership.md). */
    setCoasting(active: boolean) { billboards?.setCoasting(active); catalog?.setCoasting(active); },
    /** The image bank whose framing sphere holds `positionM`: the galaxy a selected star is in. */
    imageBankContaining(positionM: readonly number[]): string | undefined {
      // Asked on every frame of every bank: plain arithmetic, where a mapped array for each bank was 2.1 % of an iPad's
      // script time in a zoom out of Earth (2026-10-04).
      for (const bank of images) {
        const origin = bank.frame.originM, x = positionM[0]! - origin[0], y = positionM[1]! - origin[1], z = positionM[2]! - origin[2];
        const reachM = bank.radiusUnits * bank.frame.metersPerUnit;
        if (x * x + y * y + z * z <= reachM * reachM) return bank.id;
      }
      return undefined;
    },
    /** `inside` is the galaxy the selected body is in, and how much of its dots show: a star of M33 stands among M33's
     * catalogue dots, without the photograph that is the galaxy seen from outside. `within` is the objects the selected body
     * is inside, by the object tree: a bank whose light lies on walls (`surrounds`) draws around a body inside its host, as
     * a nebula's walls around its central star; the first such bank declared for that host stands for it. `bodyM` is
     * that body's place: the sheets through it are left out (prepared-image-layer-runtime.ts). */
    /** Whether the bank is on screen: shown, with a stack whose images are decoded. */
    drawing(id: string): boolean { const bank = byId.get(id); return bank?.mounted?.drawing() === true && bank.publishedOpacity > 0; },
    /** `standIn`: the bank drawn in the detailed one's place until that one draws (detailed-focus-context.ts), of either
     * kind: it is drawn as the detailed bank is, and while one stands in the detailed bank's billboard stays out. */
    publishImages(world: WorldCameraPose, viewport: WorldCameraViewport, volumeOpacity: number, detailedObjectId?: string,
      inside?: { readonly objectId: string; readonly opacity: number }, within: readonly string[] = [], bodyM?: readonly [number, number, number],
      standIn?: string, subject?: unknown) {
      if (lifetime.disposed) return;
      if (kept && subject !== keptFor) { leaveLayout(kept); kept = null; }
      let around: string | undefined;
      if (within.length) for (const bank of images) if (bank.surrounds && bank.host !== undefined && within.includes(bank.host)) { around = bank.id; break; }
      // A host with several banks shows one dataset at a time: the selected bank's slices stand for the host, so its other
      // banks' billboards give way with the selected bank's own. Near a nebula the context's fade hid them already; a
      // cluster's two banks are seen from where that context is in full view.
      const selected = images.find(bank => bank.id === detailedObjectId && bank.host !== undefined && bank.mounted);
      const selectedOpacity = selected ? projectedVolumeOpacity(world, viewport, selected.frame, selected.radiusUnits) : 0;
      for (const bank of images) {
        // A galaxy's slices paint only for the observer who selected it, at any distance from it: the context's distance
        // fade is measured from the selected body, which is the galaxy itself. Walls paint around a body inside them too.
        const opacity = bank.id === detailedObjectId || bank.id === around || bank.id === standIn ? projectedVolumeOpacity(world, viewport, bank.frame, bank.radiusUnits) : 0;
        // Its billboard shows it from everywhere else, and gives way as the loaded slices fade in.
        if (billboards && bank.billboardIndex >= 0) {
          const context = bank.independent ? 1 : volumeOpacity;
          const sibling = selected !== undefined && bank !== selected && bank.host === selected.host;
          // It gives way to slices that draw: a bank whose images are still decoding has nothing on screen to give way to,
          // unless another bank stands in for it.
          const draws = (sibling ? selected : bank).mounted?.drawing() === true || (standIn !== undefined && (bank.id === detailedObjectId || sibling));
          const handoff = draws ? Math.min(1, (sibling ? selectedOpacity : opacity) / Math.max(context, Number.MIN_VALUE)) : 0;
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
          // Never 1 (STACK_OPACITY_CEILING), as a stack's own opacity: Safari paints every leaf under the root again when its
          // opacity leaves or reaches 1. Cassiopeia A's 1,397 patches made a frame of 180 to 208 ms each way with the camera
          // still on an iPad, and none between 0.999 and 0.99 (2026-10-05): the first frames of every zoom out of a nebula.
          bank.mounted.root.style.opacity = String(Math.min(STACK_OPACITY_CEILING, opacity));
          if (opacity > 0) {
            if (bank.mounted.root.style.display === 'none') bank.mounted.resume();
            // A kept bank draws from this write: who waits for it to draw is told with the camera still.
            else if (!(bank.publishedOpacity > 0) && bank.mounted.drawing()) requestPublication?.();
            bank.mounted.root.style.display = '';
            bank.shownFor = subject;
            if (kept === bank) kept = null;
          } else if (bank.publishedOpacity > 0 && subject !== undefined && bank.shownFor === subject) {
            if (kept && kept !== bank) leaveLayout(kept);
            kept = bank; keptFor = subject;
          } else if (kept !== bank) bank.mounted.root.style.display = 'none';
          bank.publishedOpacity = opacity;
        }
        if (opacity > 0) bank.mounted.publish({ world, viewport }, bank.id === around && bank.id !== detailedObjectId && bodyM !== undefined ? bodyM : false);
      }
    },
  };
}
