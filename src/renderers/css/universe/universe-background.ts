import type { SceneLifetime } from '@cssearth/engine';
import type { PreparedCssVolume, VolumeCameraPublication } from '../volume/types.js';
import type { PreparedPointAppearance } from '../stars/types.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import { mountPreparedVolumeLod } from '../volume/prepared-volume-lod.js';
import { projectedVolumeOpacity, volumeFramingRadiusUnits } from '../volume/projected-volume-visibility.js';
import { mountPreparedCssSky } from '../sky/prepared-sky-runtime.js';
import { prefetchPreparedResources } from '../rendering/prepared-prefetch.js';
import { mountStellarPoints, stellarPointsOpacity } from './stellar-points.js';
import { logarithmicFade, preparedVolumeOpacity } from './prepared-world-context.js';
import type { PreparedWorldContext } from './prepared-world-context.js';

/** Retained sky, stellar sample and galaxy share one exposure-aware handoff. */
export function createUniverseBackground({ root, end, lifetime, plan, payload, pointAppearance, sky, resolveResource,
  prefetchUrls, prefetchDistanceM }: {
  root: HTMLElement; end: Node; lifetime: SceneLifetime; plan: PreparedWorldContext;
  payload: PreparedCssVolume; pointAppearance: PreparedPointAppearance; sky: boolean;
  resolveResource(path: string): string;
  prefetchUrls: readonly string[]; prefetchDistanceM: number;
}) {
  const document = root.ownerDocument;
  const volumeHost = document.createElement('div');
  volumeHost.className = 'prepared-volume-context';
  volumeHost.style.cssText = 'position:absolute;inset:0;pointer-events:none;display:none';
  volumeHost.style.background = '#000';
  volumeHost.style.transformStyle = 'flat';
  root.insertBefore(volumeHost, end);
  const volumeImage = document.createElement('div');
  volumeImage.className = 'prepared-volume-image';
  volumeImage.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  volumeImage.style.transformStyle = 'flat';
  volumeHost.appendChild(volumeImage);
  const volumeEnd = document.createElement('span'); volumeEnd.hidden = true; volumeImage.appendChild(volumeEnd);
  let skyLayer: ReturnType<typeof mountPreparedCssSky> | null = null;
  let stellarPoints: ReturnType<typeof mountStellarPoints> = null;
  let volumeLayer: ReturnType<typeof mountPreparedVolumeLod> | null = null;
  let stellarEnabled = true, stellarPublication: VolumeCameraPublication | null = null, stellarOpacity = 0;
  let publishedVolumeAlpha = NaN, publishedImageAlpha = NaN, publishedSkyAlpha = NaN;
  let publishedVolumeOpacity = NaN, publishedVolumeBrightness = NaN;
  let publishedVolumeVisible: boolean | undefined;
  const volumeFramingUnits = volumeFramingRadiusUnits(payload.frame);
  const prefetchAbort = new AbortController();
  lifetime.onDispose(() => prefetchAbort.abort());
  let galaxyPrefetched = false;

  return {
    // Separate host placement from layer mounting to retain startup and DOM order.
    mount() {
      if (sky && payload.sky) {
        skyLayer = mountPreparedCssSky({ host: root, before: volumeHost, payload: payload.sky, resources: payload.resources, resolveResource });
        lifetime.onDispose(() => skyLayer?.destroy());
      }
      stellarPoints = mountStellarPoints({ host: root, before: volumeHost, field: pointAppearance });
      lifetime.onDispose(() => stellarPoints?.destroy());
      volumeLayer = mountPreparedVolumeLod({ host: volumeImage, before: volumeEnd, payload, resolveResource }, () => 1);
      lifetime.onDispose(() => volumeLayer?.destroy());
      if (payload.impostors) volumeLayer.setDetail(false);
    },
    setDetail(enabled: boolean) { if (!lifetime.disposed && payload.impostors) volumeLayer?.setDetail(enabled); },
    setStellarPointsEnabled(enabled: boolean) {
      const next = enabled === true;
      if (lifetime.disposed || stellarEnabled === next) return false;
      stellarEnabled = next;
      return true;
    },
    publishStellarPoints() {
      if (!lifetime.disposed && stellarPublication) stellarPoints?.publish(stellarPublication, stellarEnabled ? stellarOpacity : 0);
    },
    prefetch(distanceM: number) {
      if (lifetime.disposed || galaxyPrefetched || distanceM < prefetchDistanceM) return;
      galaxyPrefetched = true;
      const target = document.defaultView;
      if (typeof target?.fetch === 'function') void prefetchPreparedResources(prefetchUrls, target.fetch.bind(target), prefetchAbort.signal);
    },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, distanceM: number,
      selectedPositionM: readonly number[], detailContextOpacity: number): number {
      if (lifetime.disposed) return 0;
      const starsHandoff = logarithmicFade(distanceM, plan.stars.fadeStartDistanceM, plan.stars.fullDistanceM);
      // Every placed body starts inside the galaxy, so its own distance gates the volume.
      const volumeDistanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - selectedPositionM[axis]!));
      const volumeOpacity = preparedVolumeOpacity(volumeDistanceM, plan.volume.opacityProfile);
      const volumeBrightness = preparedVolumeOpacity(volumeDistanceM, plan.volume.brightnessProfile);
      const volumeSize = projectedVolumeOpacity(world, viewport, payload.frame, volumeFramingUnits);
      const volumeVisible = volumeOpacity * detailContextOpacity > 0;
      if (volumeVisible !== publishedVolumeVisible) { volumeHost.style.display = volumeVisible ? '' : 'none'; publishedVolumeVisible = volumeVisible; }
      if (volumeOpacity !== publishedVolumeOpacity) { volumeHost.dataset.volumeOpacity = String(volumeOpacity); publishedVolumeOpacity = volumeOpacity; }
      if (volumeBrightness !== publishedVolumeBrightness) { volumeImage.dataset.volumeBrightness = String(volumeBrightness); publishedVolumeBrightness = volumeBrightness; }
      // A detailed focus suppresses the volume without brightening the sky behind it.
      const completedContribution = skyLayer ? volumeOpacity * volumeBrightness : volumeOpacity;
      const alpha = completedContribution * detailContextOpacity;
      if (alpha !== publishedVolumeAlpha) { volumeHost.style.opacity = String(alpha); publishedVolumeAlpha = alpha; }
      if (skyLayer) skyLayer.root.dataset.skyContribution = String(1 - completedContribution);
      const imageAlpha = (skyLayer ? 1 : volumeBrightness) * volumeSize;
      if (imageAlpha !== publishedImageAlpha) {
        volumeImage.style.opacity = skyLayer && imageAlpha === 1 ? '' : String(imageAlpha);
        volumeImage.style.display = imageAlpha > 0 ? '' : 'none';
        publishedImageAlpha = imageAlpha;
      }
      const skyAlpha = alpha < 1 ? (1 - completedContribution) / (1 - alpha) : 0;
      if (skyLayer && skyAlpha !== publishedSkyAlpha) { skyLayer.root.style.opacity = String(skyAlpha); publishedSkyAlpha = skyAlpha; }
      skyLayer?.publish(world, viewport, completedContribution < 1, 1 - starsHandoff);
      stellarPublication = { world, viewport };
      stellarOpacity = stellarPointsOpacity(starsHandoff, completedContribution) * detailContextOpacity;
      stellarPoints?.publish(stellarPublication, stellarEnabled ? stellarOpacity : 0);
      if (volumeVisible && volumeSize > 0) volumeLayer!.publish({ world, viewport });
      return volumeOpacity;
    },
  };
}
