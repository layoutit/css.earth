import type { SceneLifetime } from '@cssearth/engine';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { createPreparedVolumeLenses } from '../volume/prepared-volume-lenses.js';
import { projectedVolumeOpacity, projectVolumeSphere, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';
import type { PreparedPointVisibility } from '../volume/projected-volume-visibility.js';
import { mountLensBillboards } from './lens-billboards.js';
import type { LensBankBillboard, LensBillboards } from './lens-billboards.js';
import type { PreparedUniverseOptions } from './prepared-universe-types.js';

type LensMount = ReturnType<ReturnType<typeof createPreparedVolumeLenses>['mount']>;
interface LensBank {
  readonly id: string;
  readonly facts: LensBankBillboard;
  readonly billboardIndex: number;
  mounted: LensMount | null;
  loading: Promise<void> | null;
  generation: number;
  explicitEnabled: boolean | undefined;
  pendingSelection: string | undefined;
  pendingStarsVisible: boolean | undefined;
  framing: { frame: DensityVolumeFrame; radiusUnits: number; visibility: PreparedPointVisibility };
  publishedOpacity: number;
  residentNodes: number;
  visible: boolean;
  lastUsed: number;
  subscribers: number;
  enabled: boolean;
}

/** One stable record owns each declared bank through load, publication and eviction. */
export function createUniverseLensBanks({ root, end, frontRoot, frontEnd, lifetime, declarations, facts, frame, visibility,
  billboards: preparedBillboards, load, warmDomNodeBudget, requestPublication }: {
  root: HTMLElement; end: Element; frontRoot: HTMLElement; frontEnd: Element; lifetime: SceneLifetime;
  declarations: readonly { id: string; frame: DensityVolumeFrame }[];
  facts: readonly LensBankBillboard[];
  frame: { referenceFrame: string; epochJdTt: number };
  visibility: PreparedPointVisibility;
  billboards?: { plan: LensBillboards; atlasUrl: string };
  load: PreparedUniverseOptions['loadVolumeLens'];
  warmDomNodeBudget: number;
  requestPublication?: () => boolean;
}) {
  let billboardCount = 0, useClock = 0;
  const banks: LensBank[] = declarations.map((declared, index) => ({
    id: declared.id, facts: facts[index]!, billboardIndex: facts[index]!.billboard ? billboardCount++ : -1,
    mounted: null, loading: null, generation: 0, explicitEnabled: undefined,
    pendingSelection: undefined, pendingStarsVisible: undefined,
    framing: { frame: declared.frame, radiusUnits: volumeFramingRadiusUnits(declared.frame), visibility },
    publishedOpacity: NaN, residentNodes: 0, visible: false, lastUsed: 0, subscribers: 0,
    enabled: !facts[index]!.attached,
  }));
  const byId = new Map(banks.map(bank => [bank.id, bank]));
  for (const bank of banks) lifetime.onDispose(() => {
    bank.generation++;
    const mounted = bank.mounted;
    bank.mounted = null;
    bank.loading = null;
    mounted?.destroy();
  });
  const billboardEntries = banks.flatMap(bank => bank.facts.billboard
    ? [{ id: bank.id, frame: bank.framing.frame, billboard: bank.facts.billboard }] : []);
  const billboards = billboardEntries.length ? mountLensBillboards({ host: root, before: end,
    atlasUrl: preparedBillboards!.atlasUrl, atlas: preparedBillboards!.plan.atlas, entries: billboardEntries }) : null;
  if (billboards) lifetime.onDispose(() => billboards.destroy());

  function publishResidency() {
    if (lifetime.disposed) return;
    const resident = banks.filter(bank => bank.mounted);
    const visible = resident.filter(bank => bank.visible);
    const pinned = resident.filter(bank => !bank.visible && bank.subscribers > 0);
    const warm = resident.filter(bank => !bank.visible && bank.subscribers === 0);
    root.dataset.volumeLensDeclaredBankCount = String(banks.length);
    root.dataset.volumeLensResidentBankCount = String(resident.length);
    root.dataset.volumeLensVisibleBankCount = String(visible.length);
    root.dataset.volumeLensPinnedBankCount = String(pinned.length);
    root.dataset.volumeLensWarmBankCount = String(warm.length);
    root.dataset.volumeLensPinnedDomNodes = String(pinned.reduce((nodes, bank) => nodes + bank.residentNodes, 0));
    root.dataset.volumeLensWarmDomNodes = String(warm.reduce((nodes, bank) => nodes + bank.residentNodes, 0));
    root.dataset.volumeLensWarmDomNodeBudget = String(warmDomNodeBudget);
  }
  function updateWeight(bank: LensBank) {
    bank.residentNodes = bank.mounted ? Number(bank.mounted.root.dataset.volumeResidentDomNodes) || 1 : 0;
  }
  function evict(bank: LensBank) {
    if (!bank.mounted || bank.visible || bank.subscribers > 0) return false;
    bank.mounted.destroy();
    bank.mounted = null;
    bank.residentNodes = 0;
    bank.publishedOpacity = NaN;
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
  function ensureLoaded(bank: LensBank): Promise<void> {
    if (lifetime.disposed) return Promise.resolve();
    if (bank.mounted || bank.loading) return bank.loading ?? Promise.resolve();
    if (!load) return Promise.resolve();
    const generation = bank.generation;
    const loading = load(bank.id).then(options => {
      if (lifetime.disposed || generation !== bank.generation || bank.mounted) return;
      const loadedFrame = options.payload.lenses[0]!.volume.frame;
      if (loadedFrame.referenceFrame !== frame.referenceFrame || loadedFrame.epochJdTt !== frame.epochJdTt) {
        throw new TypeError('Prepared volume lenses must share the universe reference frame and epoch.');
      }
      const pendingLens = bank.pendingSelection;
      if (pendingLens !== undefined && !options.payload.lenses.some(lens => lens.id === pendingLens)) {
        throw new TypeError(`Unknown prepared volume lens: ${pendingLens}.`);
      }
      const prepared = createPreparedVolumeLenses(options);
      const mounted = prepared.mount({ host: root, before: end, frontHost: frontRoot, frontBefore: frontEnd });
      try {
        mounted.root.style.display = 'none';
        if (pendingLens !== undefined) mounted.selectLens(pendingLens);
        if (bank.pendingStarsVisible !== undefined) mounted.setStarsVisible(bank.pendingStarsVisible);
      } catch (error) { mounted.destroy(); throw error; }
      if (lifetime.disposed || generation !== bank.generation) { mounted.destroy(); return; }
      bank.mounted = mounted;
      const pointVisibility = prepared.payload.pointVisibility!;
      bank.framing = { frame: loadedFrame, radiusUnits: prepared.payload.framingRadiusUnits, visibility: {
        hiddenBelowRadiusPixels: Math.max(pointVisibility.hiddenBelowRadiusPixels, visibility.hiddenBelowRadiusPixels),
        fullAboveRadiusPixels: Math.max(pointVisibility.fullAboveRadiusPixels, visibility.fullAboveRadiusPixels) } };
      bank.enabled = bank.explicitEnabled ?? prepared.payload.attachedTo === undefined;
      bank.lastUsed = ++useClock;
      bank.publishedOpacity = NaN;
      updateWeight(bank);
      trimWarmResidency();
      requestPublication?.();
    }).finally(() => { if (bank.loading === loading) bank.loading = null; });
    bank.loading = loading;
    return loading;
  }

  return {
    publishResidency,
    ensure(id: string) {
      const bank = byId.get(id);
      return bank ? ensureLoaded(bank) : Promise.reject(new TypeError('Unknown prepared volume lens bank.'));
    },
    // Authored framing replaces descriptor bounds when the payload arrives.
    frames() {
      return Object.fromEntries(banks.map(bank => [bank.id, { frame: bank.framing.frame, framingRadiusUnits: bank.framing.radiusUnits }]));
    },
    state(id: string) { return byId.get(id)?.mounted?.state() ?? null; },
    setEnabled(id: string, enabled: boolean) {
      if (lifetime.disposed || typeof enabled !== 'boolean') return;
      const bank = byId.get(id);
      if (!bank?.facts.attached || bank.enabled === enabled) return;
      bank.explicitEnabled = enabled;
      bank.enabled = enabled;
      requestPublication?.();
    },
    select(id: string, lens: string) {
      if (lifetime.disposed) return;
      const bank = byId.get(id);
      if (!bank) throw new TypeError('Unknown prepared volume lens bank.');
      bank.pendingSelection = lens;
      bank.lastUsed = ++useClock;
      if (bank.mounted) {
        bank.mounted.selectLens(lens);
        updateWeight(bank);
        trimWarmResidency();
      } else void ensureLoaded(bank).catch(() => {});
    },
    setStarsVisible(visible: boolean) {
      if (lifetime.disposed) return;
      for (const bank of banks) {
        bank.pendingStarsVisible = visible;
        bank.mounted?.setStarsVisible(visible);
      }
    },
    subscribe(id: string, listener: (state: ReturnType<LensMount['state']>) => void) {
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
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, volumeOpacity: number, detailContextOpacity: number, detailedObjectId?: string) {
      if (lifetime.disposed) return;
      let residencyChanged = false;
      for (const bank of banks) {
        const { frame, radiusUnits, visibility } = bank.framing;
        const presentationOpacity = bank.id === detailedObjectId ? 1 : detailContextOpacity;
        const contextOpacity = bank.facts.contextVisibility === 'independent' ? 1 : volumeOpacity;
        const shown = bank.enabled ? presentationOpacity * contextOpacity : 0;
        const opacity = shown * projectedVolumeOpacity(world, viewport, frame, radiusUnits, visibility);
        const billboard = bank.facts.billboard;
        if (billboards && billboard) {
          const billboardOpacity = shown * projectedVolumeOpacity(world, viewport, frame, billboard.radiusUnits) * (bank.mounted ? 1 - opacity / Math.max(shown, Number.MIN_VALUE) : 1);
          billboards.publish(bank.billboardIndex, billboardOpacity, world, viewport);
        }
        if (!bank.mounted) {
          const visible = opacity > 0 && projectVolumeSphere(world, viewport, frame, radiusUnits).visible;
          if (visible !== bank.visible) { bank.visible = visible; bank.lastUsed = ++useClock; residencyChanged = true; }
          if (visible) void ensureLoaded(bank).catch(() => {});
          continue;
        }
        const visible = opacity > 0;
        if (visible !== bank.visible) { bank.visible = visible; bank.lastUsed = ++useClock; residencyChanged = true; }
        if (opacity !== bank.publishedOpacity) {
          // Both retained roots carry the bank's visibility, including foreground clouds.
          for (const target of [bank.mounted.root, bank.mounted.frontRoot]) {
            if (!target) continue;
            target.style.opacity = String(opacity);
            target.style.display = opacity > 0 ? 'block' : 'none';
          }
          bank.publishedOpacity = opacity;
        }
        bank.mounted.publish({ world, viewport }, visible);
      }
      if (residencyChanged) trimWarmResidency();
    },
  };
}
