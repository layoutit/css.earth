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

export interface PreparedVolumeLensBrightness { readonly overall: number; readonly x: number; readonly y: number; readonly z: number }
export interface PreparedVolumeLens {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly sourceUrl: string;
  readonly volume: PreparedCssVolume;
  readonly brightness: PreparedVolumeLensBrightness;
  readonly stars: PreparedCataloguePoints;
  /** The centre of a compact structure that can pass in front of the body at the middle of this frame. The bank
   * composites this lens over the detail scene while that centre is nearer to the camera than the body, and behind
   * it otherwise. Omitted for a lens whose emission surrounds the body, which always composites behind it. */
  readonly occultingCentreUnits?: readonly [number, number, number];
}
export type { PreparedPointVisibility };
export interface PreparedVolumeLenses {
  readonly schema: 'cssearth-volume-lenses@1';
  readonly id: string;
  readonly defaultLens: string;
  readonly framingRadiusUnits: number;
  readonly lenses: readonly PreparedVolumeLens[];
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
export type PreparedVolumeLensBank = PreparedVolumeLenses;
export interface PreparedVolumeLensState {
  readonly id: string;
  readonly defaultLens: string;
  readonly selectedLens: string;
  readonly objectId: string;
  readonly starsVisible: boolean;
  readonly lenses: readonly Pick<PreparedVolumeLens, 'id' | 'label' | 'title' | 'description' | 'sourceUrl'>[];
}

/** Decode and verify the authored generic bank; preparation is never a runtime fallback. */
export async function loadPreparedVolumeLenses(input: unknown, transport: PreparedCssTransport): Promise<PreparedVolumeLenses> {
  const descriptor = parseObjectDescriptor(input);
  if (descriptor.type !== 'volume-lens-bank' || descriptor.prepared?.format !== 'cssearth-volume-lenses@1') {
    throw new TypeError('A volume lens bank requires its prepared artifact.');
  }
  const frame = parseDensityVolumeFrame(descriptor.properties.frame);
  const bytes = await transport.read(descriptor.prepared.url);
  const hash = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const digest = [...hash].map(value => value.toString(16).padStart(2, '0')).join('');
  if (digest !== descriptor.prepared.sha256) throw new TypeError('Prepared volume lens SHA-256 identity mismatch.');
  const value: unknown = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  const payload = readPreparedObject(value, descriptor, validatePreparedVolumeLenses).data;
  if (payload.id !== descriptor.id || payload.lenses.some(lens => JSON.stringify(lens.volume.frame) !== JSON.stringify(frame))) {
    throw new TypeError('Prepared volume lens identity/frame does not match its authored descriptor.');
  }
  return payload;
}

export function validatePreparedVolumeLenses(input: unknown): PreparedVolumeLenses {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('Prepared volume lenses must be an object.');
  const value = input as PreparedVolumeLenses, validId = (id: unknown) => typeof id === 'string' && /^[a-z][a-z0-9-]*$/u.test(id);
  if (value.schema !== 'cssearth-volume-lenses@1' || !validId(value.id) || !Number.isFinite(value.framingRadiusUnits) ||
      value.framingRadiusUnits <= 0 || !Array.isArray(value.lenses) || !value.lenses.length ||
      (value.starsEnabled !== undefined && typeof value.starsEnabled !== 'boolean') ||
      (value.attachedTo !== undefined && (typeof value.attachedTo !== 'string' || !validId(value.attachedTo))) ||
      (value.contextVisibility !== undefined && !['galactic', 'independent'].includes(value.contextVisibility))) {
    throw new TypeError('Prepared volume lens identity, framing or bank is invalid.');
  }
  const ids = new Set<string>(), resources = new Map<string, string>();
  const lenses = value.lenses.map(lens => {
    if (!lens || !validId(lens.id) || ids.has(lens.id) || [lens.label, lens.title, lens.description].some(text => typeof text !== 'string' || !text.trim()) ||
        typeof lens.sourceUrl !== 'string' || !/^https:\/\//u.test(lens.sourceUrl) ||
        (lens.occultingCentreUnits !== undefined && (!Array.isArray(lens.occultingCentreUnits) ||
          lens.occultingCentreUnits.length !== 3 || !lens.occultingCentreUnits.every(Number.isFinite)))) throw new TypeError('Prepared volume lens content is invalid.');
    ids.add(lens.id);
    const volume = validatePreparedCssVolume(lens.volume), stars = validatePreparedCataloguePoints(lens.stars);
    if (!samePreparedPhysicalFrame(volume.frame, stars.frame)) throw new TypeError('Prepared volume and catalogue must share a physical frame.');
    if (!lens.brightness || !['overall', 'x', 'y', 'z'].every(key => {
      const number = lens.brightness[key as keyof PreparedVolumeLensBrightness];
      return Number.isFinite(number) && number >= 0 && number <= 1;
    })) throw new TypeError('Prepared volume brightness must contain overall/X/Y/Z attenuation between zero and one.');
    for (const resource of volume.resources) {
      if (resources.has(resource.path) && resources.get(resource.path) !== resource.sha256) {
        throw new TypeError('Prepared lens resource paths must identify the same bytes throughout the fixed bank.');
      }
      resources.set(resource.path, resource.sha256);
    }
    return Object.freeze({ id: lens.id, label: lens.label, title: lens.title, description: lens.description,
      sourceUrl: lens.sourceUrl, volume, stars, brightness: Object.freeze({ ...lens.brightness }),
      ...(lens.occultingCentreUnits === undefined ? {} : { occultingCentreUnits: Object.freeze([...lens.occultingCentreUnits] as [number, number, number]) }) });
  });
  if (!ids.has(value.defaultLens)) throw new TypeError('Prepared default volume lens is unavailable.');
  if (lenses.some(lens => !samePreparedCatalogueGeometry(lenses[0].stars, lens.stars))) {
    throw new TypeError('Prepared volume lenses must retain the same catalogue geometry.');
  }
  const visibility = value.pointVisibility ?? DEFAULT_POINT_VISIBILITY;
  if (!Number.isFinite(visibility.hiddenBelowRadiusPixels) || visibility.hiddenBelowRadiusPixels < 0 ||
      !Number.isFinite(visibility.fullAboveRadiusPixels) || visibility.fullAboveRadiusPixels <= visibility.hiddenBelowRadiusPixels) {
    throw new TypeError('Prepared point visibility needs increasing non-negative projected-radius thresholds.');
  }
  return Object.freeze({ schema: value.schema, id: value.id, defaultLens: value.defaultLens,
    contextVisibility: value.contextVisibility ?? 'galactic', framingRadiusUnits: value.framingRadiusUnits, lenses: Object.freeze(lenses), starsEnabled: value.starsEnabled ?? true,
    ...(value.attachedTo === undefined ? {} : { attachedTo: value.attachedTo }),
    pointVisibility: Object.freeze({ ...visibility }),
    ...(Object.hasOwn(value, 'provenance') ? { provenance: value.provenance } : {}) });
}

/** Same completed-image attenuation as Nebula Lab cloudCompositeOpacity; never attenuate individual slabs. */
export function volumeLensCompositeOpacity(banks: readonly { axis: VolumeAxis; opacity: number; visible: boolean }[],
  brightness: PreparedVolumeLensBrightness): number {
  let transmission = 1, gain = 0;
  for (let i = banks.length - 1; i >= 0; i--) {
    const bank = banks[i], alpha = bank.visible ? Math.max(0, Math.min(1, bank.opacity)) : 0;
    gain += alpha * transmission * brightness[bank.axis];
    transmission *= 1 - alpha;
  }
  return brightness.overall * gain;
}

/** Fixed declared bank; visible LODs attach their own textures on demand. */
export function createPreparedVolumeLenses({ payload, resolveResource }: {
  payload: PreparedVolumeLenses; resolveResource(path: string): string;
}) {
  const data = validatePreparedVolumeLenses(payload), pool = `volume-lenses:${data.id}`;
  const topologyFamilies: PreparedVolumeLens[][] = [];
  for (const lens of data.lenses) {
    const family = topologyFamilies.find(candidate => samePreparedVolumeTopology(candidate[0]!.volume, lens.volume));
    if (family) family.push(lens); else topologyFamilies.push([lens]);
  }
  const paths = [...new Set(data.lenses.flatMap(lens => lens.volume.resources.map(resource => resource.path)))];
  const urls = new Map(paths.map(path => {
    const url = resolveResource(path);
    if (typeof url !== 'string' || !url) throw new TypeError('Prepared volume lens resource URL is missing.');
    return [path, url] as const;
  }));
  const entries = paths.map(path => ({ key: `${pool}:${path}`, url: urls.get(path)!, pool }));
  const assets: PreparedAssets = Object.freeze({ entries: Object.freeze(entries),
    pools: Object.freeze([{ id: pool, retention: 'mount' as const, capacity: paths.length, concurrency: 4,
      reuse: false, decoding: 'async' as const }]), startup: Object.freeze([]) });
  const resolvePrepared = (path: string) => {
    const url = urls.get(path);
    if (!url) throw new TypeError(`Undeclared prepared volume lens resource: ${path}.`);
    return url;
  };
  return Object.freeze({ assets, payload: data,
    mount({ host, before, frontHost, frontBefore, nativeFocalCss }: { host: HTMLElement; before: Element;
      /** Where a lens whose data lies wholly between the observer and the body composites; without it every lens stays behind. */
      frontHost?: HTMLElement; frontBefore?: Element; nativeFocalCss?: string }) {
      const document = host.ownerDocument;
      const existing = [...document.querySelectorAll<HTMLElement>('.prepared-volume-lenses[data-prepared-volume-node="0"]')].find(root => root.dataset.volumeLensObject === data.id) ?? null;
      const dom = preparedDomAdoption(document, existing, nativeFocalCss !== undefined), create = dom.create;
      // Hidden detail and points are built on first use, except where server-rendered DOM is adopted node for node.
      const lazy = existing === null && nativeFocalCss === undefined;
      const selectedNative = existing?.dataset.selectedLens;
      const root = create('div');
      root.className = 'prepared-volume-lenses'; root.dataset.volumeLensObject = data.id;
      Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
      const end = create('span'); end.hidden = true; root.append(end);
      const frontLenses = frontHost && frontBefore ? data.lenses.filter(lens => lens.occultingCentreUnits !== undefined).length : 0;
      const frontRoot = frontLenses ? create('div') : null;
      if (frontRoot) {
        frontRoot.className = 'prepared-volume-lenses-front'; frontRoot.dataset.volumeLensObject = data.id;
        Object.assign(frontRoot.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
      }
      const frontEnd = frontRoot ? create('span') : null;
      if (frontRoot && frontEnd) { frontEnd.hidden = true; frontRoot.append(frontEnd); }
      let selected = data.lenses.some(lens => lens.id === selectedNative) ? selectedNative! : data.defaultLens, destroyed = false, latest: VolumeCameraPublication | null = null;
      let starsVisible = data.starsEnabled ?? true;
      const listeners = new Set<(state: PreparedVolumeLensState) => void>();
      const lensContent = Object.freeze(data.lenses.map(({ id, label, title, description, sourceUrl }) =>
        Object.freeze({ id, label, title, description, sourceUrl })));
      const lensById = new Map(data.lenses.map(lens => [lens.id, lens] as const));
      const families: { lenses: readonly PreparedVolumeLens[]; active: { lens: PreparedVolumeLens }; surface: HTMLElement;
        runtime: ReturnType<typeof mountPreparedVolumeLod> }[] = [];
      let stars: ReturnType<typeof mountPreparedCataloguePoints> | null = null;
      const mountStars = () => {
        stars = mountPreparedCataloguePoints({ host: root, before: end, payload: lensById.get(selected)!.stars, createElement: create, nativeFocalCss });
        stars.root.style.display = starsVisible ? 'block' : 'none';
      };
      const state = (): PreparedVolumeLensState => Object.freeze({ id: selected, defaultLens: data.defaultLens, selectedLens: selected,
        objectId: data.id, starsVisible, lenses: lensContent });
      const notify = () => { const next = state(); for (const listener of listeners) listener(next); };
      const destroy = () => {
        if (destroyed) return; destroyed = true; latest = null; listeners.clear();
        for (const family of families) family.runtime.destroy();
        stars?.destroy(); root.remove(); frontRoot?.remove();
      };
      const countDescendants = (node: Element): number => [...node.children]
        .reduce((count, child) => count + 1 + countDescendants(child), 0);
      const updateResidencyMetadata = () => {
        root.dataset.volumeLensCount = String(data.lenses.length);
        root.dataset.volumeTopologyCount = String(topologyFamilies.length);
        root.dataset.volumeResidentTopologyCount = String(families.length);
        root.dataset.volumeResidentDomNodes = String(1 + countDescendants(root) + (frontRoot ? 1 + countDescendants(frontRoot) : 0));
      };
      const ensureFamily = (lens: PreparedVolumeLens) => {
        const lenses = topologyFamilies.find(candidate => candidate.includes(lens))!;
        const existingFamily = families.find(candidate => candidate.lenses === lenses);
        if (existingFamily) return existingFamily;
        const surface = create('div'); surface.className = 'prepared-volume-lens-cloud'; surface.dataset.volumeLens = lens.id;
        surface.dataset.volumeLensTopology = lenses.map(candidate => candidate.id).join(' ');
        Object.assign(surface.style, { position: 'absolute', inset: '0', pointerEvents: 'none', display: 'none' });
        const marker = create('span'); marker.hidden = true; surface.append(marker); root.insertBefore(surface, end);
        const active = { lens };
        const runtime = mountPreparedVolumeLod({ host: surface, before: marker, payload: lens.volume, resolveResource: resolvePrepared, createElement: create, nativeFocalCss, lazyDetail: lazy },
          detail => volumeLensCompositeOpacity(detail.roots.map((axisRoot, index) => ({
            axis: (['x', 'y', 'z'] as const)[index], opacity: Number(axisRoot.style.opacity), visible: axisRoot.style.visibility !== 'hidden',
          })), active.lens.brightness));
        for (const axisRoot of runtime.roots) axisRoot.style.background = 'transparent';
        const family = { lenses: Object.freeze(lenses), active, surface, runtime };
        families.push(family);
        updateResidencyMetadata();
        return family;
      };
      const publish = (publication: VolumeCameraPublication, visible = true) => {
        if (destroyed) return;
        // A hidden bank must forget its last near camera; otherwise selecting a
        // lens while zoomed out could load detail using that stale publication.
        latest = visible ? publication : null;
        if (!visible) return;
        const bank = ensureFamily(lensById.get(selected)!);
        const lens = bank.active.lens;
        // A compact structure passes in front of the body and behind it as the camera goes round. Two flattened
        // roots cannot interleave, so the whole surface moves to the side its centre is on; that is exact while the
        // structure stays clear of the body's silhouette in depth, which is why only a compact lens declares one.
        const centre = lens.occultingCentreUnits;
        if (frontRoot && frontEnd) {
          let target: HTMLElement = root, marker: HTMLElement = end;
          if (centre) {
            const [px, py, pz] = presentPhysicalPoseInVolume(publication.world.pose, lens.volume.frame).positionUnits;
            const nearer = Math.hypot(px - centre[0], py - centre[1], pz - centre[2]) < Math.hypot(px, py, pz);
            if (nearer) { target = frontRoot; marker = frontEnd; }
          }
          if (bank.surface.parentNode !== target) target.insertBefore(bank.surface, marker);
        }
        const builtRoots = bank.runtime.roots.length;
        bank.runtime.publish(publication);
        // The slice renderer is built on the first close publication; the bank's resident count follows it.
        if (bank.runtime.roots.length !== builtRoots) {
          for (const axisRoot of bank.runtime.roots.slice(builtRoots)) axisRoot.style.background = 'transparent';
          updateResidencyMetadata();
        }
        const opacity = volumeLensCompositeOpacity(bank.runtime.roots.map((axisRoot, index) => ({
          axis: (['x', 'y', 'z'] as const)[index], opacity: Number(axisRoot.style.opacity), visible: axisRoot.style.visibility !== 'hidden',
        })), lens.brightness);
        // Impostors contain the saved exposure; their detail wrapper owns the matching full-volume exposure.
        bank.surface.style.opacity = lens.volume.impostors ? '1' : String(opacity);
        const pointOpacity = projectedVolumeOpacity(publication.world, publication.viewport, lens.volume.frame,
          data.framingRadiusUnits, data.pointVisibility!);
        const showPoints = starsVisible && (nativeFocalCss !== undefined || pointOpacity > 0);
        // Points are built the first time they show: a distant or disabled cluster keeps no hidden star nodes.
        if (showPoints && !stars) { mountStars(); updateResidencyMetadata(); }
        if (stars) {
          stars.root.style.opacity = nativeFocalCss === undefined ? String(pointOpacity)
            : nativeProjectedFade(projectedVolumeRadiusPixels(publication.world, publication.viewport, lens.volume.frame, data.framingRadiusUnits),
              publication.viewport.focalPixels, nativeFocalCss, data.pointVisibility!.hiddenBelowRadiusPixels, data.pointVisibility!.fullAboveRadiusPixels);
          stars.root.style.display = showPoints ? 'block' : 'none';
          // Hidden points leave layout; projecting them only wrote styles nobody draws.
          if (showPoints) stars.publish(publication);
        }
        // Test hooks: rounded and written only on change, so a steady frame writes no attributes.
        const pointHook = String(Math.round(pointOpacity * 1000) / 1000), cloudHook = String(Math.round(opacity * 1000) / 1000);
        if (root.dataset.pointOpacity !== pointHook) root.dataset.pointOpacity = pointHook;
        if (root.dataset.cloudOpacity !== cloudHook) root.dataset.cloudOpacity = cloudHook;
      };
      try {
        const selectedLens = lensById.get(selected)!;
        const selectedFamily = ensureFamily(selectedLens);
        selectedFamily.surface.style.display = 'block';
        if (!lazy) mountStars();
        root.dataset.selectedLens = selected; host.insertBefore(root, before);
        if (frontRoot) frontHost!.insertBefore(frontRoot, frontBefore!);
        updateResidencyMetadata();
        dom.finish();
        // The bank's visibility is written on its roots from outside. A lens that composites in front of the body
        // lives in the second root, so both must be gated or a disabled cloud keeps drawing over the star.
        return Object.freeze({ root, frontRoot, publish, state, destroy,
          subscribe(listener: (state: PreparedVolumeLensState) => void) {
            if (!destroyed) listeners.add(listener);
            return () => { listeners.delete(listener); };
          },
          setStarsVisible(visible: boolean) {
            if (destroyed) return;
            if (typeof visible !== 'boolean') throw new TypeError('Catalogue point visibility must be a boolean.');
            if (visible === starsVisible) return;
            starsVisible = visible;
            if (stars) stars.root.style.display = visible ? 'block' : 'none';
            if (latest) publish(latest);
            notify();
          },
          selectLens(id: string) {
            if (destroyed) return;
            const next = lensById.get(id);
            if (!next) throw new TypeError(`Unknown prepared volume lens: ${id}.`);
            if (id === selected) return;
            stars?.setPresentation(next.stars);
            const family = ensureFamily(next);
            family.active.lens = next;
            family.runtime.setPresentation(next.volume);
            family.surface.dataset.volumeLens = next.id;
            selected = id;
            for (const candidate of families) candidate.surface.style.display = candidate === family ? 'block' : 'none';
            root.dataset.selectedLens = selected;
            updateResidencyMetadata();
            if (latest) publish(latest);
            notify();
          },
        });
      } catch (error) { destroy(); throw error; }
    },
  });
}
