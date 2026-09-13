import { mountPreparedCssVolume } from './prepared-volume-runtime.js';
import { mountPreparedVolumeLod } from './prepared-volume-lod.js';
import { parseObjectDescriptor, parseDensityVolumeFrame, readPreparedObject } from '@cssearth/objects';
import type { PreparedCssTransport } from '../loader.js';
import { validatePreparedCssVolume } from './validation.js';
import type { PreparedCssVolume, VolumeAxis, VolumeCameraPublication } from './types.js';
import type { PreparedAssets } from '../rendering/prepared-residency.js';
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
}
export interface PreparedPointVisibility {
  readonly hiddenBelowRadiusPixels: number;
  readonly fullAboveRadiusPixels: number;
}
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
const DEFAULT_POINT_VISIBILITY = Object.freeze({ hiddenBelowRadiusPixels: 2, fullAboveRadiusPixels: 24 });

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
      (value.contextVisibility !== undefined && !['galactic', 'independent'].includes(value.contextVisibility))) {
    throw new TypeError('Prepared volume lens identity, framing or bank is invalid.');
  }
  const ids = new Set<string>(), resources = new Map<string, string>();
  const lenses = value.lenses.map(lens => {
    if (!lens || !validId(lens.id) || ids.has(lens.id) || [lens.label, lens.title, lens.description].some(text => typeof text !== 'string' || !text.trim()) ||
        typeof lens.sourceUrl !== 'string' || !/^https:\/\//u.test(lens.sourceUrl)) throw new TypeError('Prepared volume lens content is invalid.');
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
      sourceUrl: lens.sourceUrl, volume, stars, brightness: Object.freeze({ ...lens.brightness }) });
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

/** Fixed prepared resource bank. The application awaits prepareObjectResources(assets).ready before mounting. */
export function createPreparedVolumeLenses({ payload, resolveResource }: {
  payload: PreparedVolumeLenses; resolveResource(path: string): string;
}) {
  const data = validatePreparedVolumeLenses(payload), pool = `volume-lenses:${data.id}`;
  const paths = [...new Set(data.lenses.flatMap(lens => lens.volume.resources.map(resource => resource.path)))];
  const urls = new Map(paths.map(path => {
    const url = resolveResource(path);
    if (typeof url !== 'string' || !url) throw new TypeError('Prepared volume lens resource URL is missing.');
    return [path, url] as const;
  }));
  const entries = paths.map(path => ({ key: `${pool}:${path}`, url: urls.get(path)!, pool }));
  const assets: PreparedAssets = Object.freeze({ entries: Object.freeze(entries),
    pools: Object.freeze([{ id: pool, retention: 'mount' as const, capacity: paths.length, concurrency: 4,
      reuse: false, decoding: 'async' as const }]), startup: Object.freeze(entries.map(entry => entry.key)) });
  const resolvePrepared = (path: string) => {
    const url = urls.get(path);
    if (!url) throw new TypeError(`Undeclared prepared volume lens resource: ${path}.`);
    return url;
  };
  return Object.freeze({ assets, payload: data,
    mount({ host, before }: { host: HTMLElement; before: Element }) {
      const document = host.ownerDocument, root = document.createElement('div');
      root.className = 'prepared-volume-lenses'; root.dataset.volumeLensObject = data.id;
      Object.assign(root.style, { position: 'absolute', inset: '0', pointerEvents: 'none' });
      const end = document.createElement('span'); end.hidden = true; root.append(end);
      let selected = data.defaultLens, destroyed = false, latest: VolumeCameraPublication | null = null;
      let starsVisible = data.starsEnabled ?? true;
      const listeners = new Set<(state: PreparedVolumeLensState) => void>();
      const lensContent = Object.freeze(data.lenses.map(({ id, label, title, description, sourceUrl }) =>
        Object.freeze({ id, label, title, description, sourceUrl })));
      const banks: { lens: PreparedVolumeLens; surface: HTMLElement; runtime: ReturnType<typeof mountPreparedCssVolume> }[] = [];
      let stars: ReturnType<typeof mountPreparedCataloguePoints> | null = null;
      const state = (): PreparedVolumeLensState => Object.freeze({ id: selected, defaultLens: data.defaultLens, selectedLens: selected,
        objectId: data.id, starsVisible, lenses: lensContent });
      const notify = () => { const next = state(); for (const listener of listeners) listener(next); };
      const destroy = () => {
        if (destroyed) return; destroyed = true; latest = null; listeners.clear();
        for (const bank of banks) bank.runtime.destroy();
        stars?.destroy(); root.remove();
      };
      const publish = (publication: VolumeCameraPublication) => {
        if (destroyed) return;
        const bank = banks.find(candidate => candidate.lens.id === selected)!;
        bank.runtime.publish(publication);
        const opacity = volumeLensCompositeOpacity(bank.runtime.roots.map((axisRoot, index) => ({
          axis: (['x', 'y', 'z'] as const)[index], opacity: Number(axisRoot.style.opacity), visible: axisRoot.style.visibility !== 'hidden',
        })), bank.lens.brightness);
        // Impostors contain the saved exposure; their detail wrapper owns the matching full-volume exposure.
        bank.surface.style.opacity = bank.lens.volume.impostors ? '1' : String(opacity);
        const frame = bank.lens.volume.frame, { world, viewport } = publication;
        const distanceUnits = Math.hypot(...world.pose.positionM.map((value, axis) => value - frame.originM[axis])) / frame.metersPerUnit;
        const radiusPixels = viewport.focalPixels * data.framingRadiusUnits / Math.max(Number.MIN_VALUE, distanceUnits);
        const thresholds = data.pointVisibility!;
        const t = Math.max(0, Math.min(1, (radiusPixels - thresholds.hiddenBelowRadiusPixels) /
          (thresholds.fullAboveRadiusPixels - thresholds.hiddenBelowRadiusPixels)));
        const pointOpacity = t * t * (3 - 2 * t);
        stars!.root.style.opacity = String(pointOpacity);
        stars!.root.style.display = starsVisible && pointOpacity > 0 ? 'block' : 'none';
        if (starsVisible && pointOpacity > 0) stars!.publish(publication);
        root.dataset.pointOpacity = String(pointOpacity); root.dataset.cloudOpacity = String(opacity);
        latest = publication;
      };
      try {
        for (const lens of data.lenses) {
          const surface = document.createElement('div'); surface.className = 'prepared-volume-lens-cloud'; surface.dataset.volumeLens = lens.id;
          Object.assign(surface.style, { position: 'absolute', inset: '0', pointerEvents: 'none', display: lens.id === selected ? 'block' : 'none' });
          const marker = document.createElement('span'); marker.hidden = true; surface.append(marker); root.insertBefore(surface, end);
          const runtime = mountPreparedVolumeLod({ host: surface, before: marker, payload: lens.volume, resolveResource: resolvePrepared },
            detail => volumeLensCompositeOpacity(detail.roots.map((axisRoot, index) => ({
              axis: (['x', 'y', 'z'] as const)[index], opacity: Number(axisRoot.style.opacity), visible: axisRoot.style.visibility !== 'hidden',
            })), lens.brightness));
          // The shared universe must remain visible through the cloud and beyond its prepared footprint.
          for (const axisRoot of runtime.roots) axisRoot.style.background = 'transparent';
          banks.push({ lens, surface, runtime });
        }
        stars = mountPreparedCataloguePoints({ host: root, before: end, payload: banks.find(bank => bank.lens.id === selected)!.lens.stars });
        stars.root.style.display = starsVisible ? 'block' : 'none';
        root.dataset.selectedLens = selected; host.insertBefore(root, before);
        return Object.freeze({ root, publish, state, destroy,
          subscribe(listener: (state: PreparedVolumeLensState) => void) {
            if (!destroyed) listeners.add(listener);
            return () => { listeners.delete(listener); };
          },
          setStarsVisible(visible: boolean) {
            if (destroyed) return;
            if (typeof visible !== 'boolean') throw new TypeError('Catalogue point visibility must be a boolean.');
            if (visible === starsVisible) return;
            starsVisible = visible;
            stars!.root.style.display = visible ? 'block' : 'none';
            if (latest) publish(latest);
            notify();
          },
          selectLens(id: string) {
            if (destroyed) return;
            const next = banks.find(bank => bank.lens.id === id);
            if (!next) throw new TypeError(`Unknown prepared volume lens: ${id}.`);
            if (id === selected) return;
            stars!.setPresentation(next.lens.stars);
            selected = id;
            for (const bank of banks) bank.surface.style.display = bank === next ? 'block' : 'none';
            root.dataset.selectedLens = selected;
            if (latest) publish(latest);
            notify();
          },
        });
      } catch (error) { destroy(); throw error; }
    },
  });
}
