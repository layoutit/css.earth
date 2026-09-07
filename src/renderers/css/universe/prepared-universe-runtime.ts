import { mountPreparedCssVolume } from '../volume/prepared-volume-runtime.js';
import { validatePreparedCssVolume } from '../volume/validation.js';
import type { PreparedCssVolume } from '../volume/types.js';
import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';
import { logarithmicFade, mountPreparedWorldContext, parsePreparedWorldContext, preparedVolumeOpacity } from './prepared-world-context.js';
import type { PreparedWorldCameraFrame, WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedCssPointField } from '../stars/types.js';
import { mountPreparedCssPointField } from '../stars/prepared-point-field-runtime.js';
import { mountWorldContextPointSource } from './world-context-point-source.js';
import type { PreparedAssets } from '../rendering/prepared-residency.js';
import type { PreparedCssSurfaceShell } from '../shell/types.js';
import { mountPreparedCssSurfaceShell } from '../shell/prepared-shell-runtime.js';
import { mountPreparedCssSky } from '../sky/prepared-sky-runtime.js';

/** Prepared, route-independent surroundings. One application owner holds the decoded bank and DOM. */
export function createPreparedUniverse({ context, volume, stars, resolveStarResource, resolveResource, sprites, shells = [] }: {
  context: unknown; volume: PreparedCssVolume; stars: PreparedCssPointField;
  resolveStarResource(path: string): string; resolveResource(path: string): string;
  sprites: Readonly<Record<string, SpriteWithUrl>>;
  shells?: readonly { payload: PreparedCssSurfaceShell; resolveResource(path: string): string }[];
}) {
  const plan = parsePreparedWorldContext(context), payload = validatePreparedCssVolume(volume);
  if (payload.id !== plan.volume.objectId || stars.id !== plan.stars.objectId ||
      [payload, stars].some(data => data.frame.referenceFrame !== plan.frame.referenceFrame || data.frame.epochJdTt !== plan.frame.epochJdTt)) {
    throw new TypeError('Context, volume and stars must share their prepared identities and epoch.');
  }
  const pool = `volume:${payload.id}`, starPool = `stars:${stars.id}`;
  const entries = payload.resources.map(resource => ({ key: `${pool}:${resource.path}`, url: resolveResource(resource.path), pool }));
  const starEntries = stars.resources.filter(resource => resource.path === stars.atlas.path).map(resource => ({
    key: `${starPool}:${resource.path}`, url: resolveStarResource(resource.path), pool: starPool }));
  const shellEntries = shells.flatMap(({ payload, resolveResource }) => {
    if (payload.frame.referenceFrame !== plan.frame.referenceFrame || payload.frame.epochJdTt !== plan.frame.epochJdTt) {
      throw new TypeError('Prepared shells must share the universe reference frame and epoch.');
    }
    return payload.resources.map(resource => ({ key: `shell:${payload.id}:${resource.path}`,
      url: resolveResource(resource.path), pool: `shell:${payload.id}` }));
  });
  const assets: PreparedAssets = {
    entries: [...entries, ...starEntries, ...shellEntries],
    pools: [{ id: pool, retention: 'mount', capacity: entries.length, concurrency: 8, reuse: false, decoding: 'async' },
      { id: starPool, retention: 'mount', capacity: starEntries.length, concurrency: 8, reuse: false, decoding: 'async' },
      ...shells.map(({ payload }) => ({ id: `shell:${payload.id}`, retention: 'mount' as const,
        capacity: payload.resources.length, concurrency: 2, reuse: false, decoding: 'async' as const }))],
    startup: [...entries, ...starEntries, ...shellEntries].map(entry => entry.key),
  };
  return Object.freeze({ assets,
    mount(stage: HTMLElement) {
      const document = stage.ownerDocument;
      const root = document.createElement('div');
      root.className = 'prepared-universe';
      root.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0';
      stage.insertBefore(root, stage.firstChild);
      const end = document.createElement('span'); end.hidden = true; root.appendChild(end);
      const volumeHost = document.createElement('div');
      volumeHost.className = 'prepared-volume-context';
      volumeHost.style.cssText = 'position:absolute;inset:0;pointer-events:none;visibility:hidden';
      volumeHost.style.background = '#000';
      volumeHost.style.transformStyle = 'flat';
      root.insertBefore(volumeHost, end);
      const volumeImage = document.createElement('div');
      volumeImage.className = 'prepared-volume-image';
      volumeImage.style.cssText = 'position:absolute;inset:0;pointer-events:none';
      volumeImage.style.transformStyle = 'flat';
      volumeHost.appendChild(volumeImage);
      const volumeEnd = document.createElement('span'); volumeEnd.hidden = true; volumeImage.appendChild(volumeEnd);
      let volumeLayer: ReturnType<typeof mountPreparedCssVolume> | null = null;
      let skyLayer: ReturnType<typeof mountPreparedCssSky> | null = null;
      let spatial: ReturnType<typeof mountPreparedWorldContext> | null = null;
      let pointField: ReturnType<typeof mountPreparedCssPointField> | null = null;
      let focusPoint: ReturnType<typeof mountWorldContextPointSource> = null;
      const shellLayers: ReturnType<typeof mountPreparedCssSurfaceShell>[] = [];
      let selected = plan.focus;
      let destroyed = false;
      const destroy = () => {
        if (destroyed) return;
        destroyed = true;
        volumeLayer?.destroy(); skyLayer?.destroy(); spatial?.destroy(); pointField?.destroy(); focusPoint?.destroy();
        for (const shell of shellLayers) shell.destroy();
        root.remove();
        delete stage.dataset.contextScale;
      };
      try {
        if (payload.sky) skyLayer = mountPreparedCssSky({ host: root, before: volumeHost, payload: payload.sky, resources: payload.resources, resolveResource });
        volumeLayer = mountPreparedCssVolume({ host: volumeImage, before: volumeEnd, payload, resolveResource });
        pointField = mountPreparedCssPointField({ host: root, before: end, payload: stars, resolveResource: resolveStarResource, occluder: plan.focus });
        for (const shell of shells) shellLayers.push(mountPreparedCssSurfaceShell({ host: root, before: end, ...shell }));
        spatial = mountPreparedWorldContext({ host: root, before: end, plan, sprites });
        focusPoint = mountWorldContextPointSource({ host: root, before: end, plan, field: stars, resolveResource: resolveStarResource });
        return Object.freeze({ root, destroy,
          selectObject(id: string, frame: PreparedWorldCameraFrame) {
            const body = [plan.focus, ...plan.bodies].find(body => body.id === id);
            if (!body || frame.referenceFrame !== plan.frame.referenceFrame || frame.epochJdTt !== plan.frame.epochJdTt ||
                frame.bodyRadiusM !== body.radiusM || !body.positionM.every((value, axis) => Math.abs(value - frame.originM[axis]) < .001)) {
              throw new TypeError('Selected detail does not match its prepared world context.');
            }
            selected = body;
            spatial!.selectObject(id);
            pointField!.setOccluder(body);
            root.dataset.selectedObject = id;
          },
          publish(world: WorldCameraPose, viewport: WorldCameraViewport) {
            if (destroyed) return;
            const distanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - plan.focus.positionM[axis]));
            const fade = logarithmicFade(distanceM, plan.volume.fadeStartDistanceM, plan.volume.fullDistanceM);
            const stellarFade = logarithmicFade(distanceM, plan.stars.fadeStartDistanceM, plan.stars.fullDistanceM);
            const volumeOpacity = preparedVolumeOpacity(distanceM, plan.volume.opacityProfile);
            const volumeBrightness = preparedVolumeOpacity(distanceM, plan.volume.brightnessProfile);
            volumeHost.style.visibility = volumeOpacity > 0 ? '' : 'hidden';
            volumeHost.style.opacity = String(volumeOpacity);
            volumeHost.dataset.volumeOpacity = String(volumeOpacity);
            // Attenuate the completed image against opaque black, outside every
            // camera's 3D context. This does not change slab optical coefficients.
            volumeImage.style.opacity = `var(--universe-volume-brightness-override, ${volumeBrightness})`;
            volumeImage.dataset.volumeBrightness = String(volumeBrightness);
            // Both backgrounds are opaque completed images. Keep the sky underlay
            // opaque: the two levels give (1-t)*sky+t*brightness*volume.
            skyLayer?.publish(world, viewport, volumeOpacity < 1);
            if (skyLayer) skyLayer.root.dataset.skyContribution = String(1 - volumeOpacity);
            if (volumeOpacity > 0) volumeLayer!.publish({ world, viewport });
            pointField!.publish(world, viewport, 1 - fade);
            for (const shell of shellLayers) shell.publish(world, viewport);
            spatial!.publish(world, viewport);
            focusPoint?.publish(world, viewport, { opacity: 1 - fade, selectedDetail: selected.id === plan.focus.id,
              ...(selected.id === plan.focus.id ? {} : { occluder: selected }) });
            stage.dataset.contextScale = fade > 0 ? 'galactic' : stellarFade > 0 ? 'stellar' : Math.hypot(...world.pose.positionM.map((value, axis) => value - selected.positionM[axis])) > selected.radiusM * 100 ? 'system' : 'object';
          },
        });
      } catch (error) { destroy(); throw error; }
    },
  });
}
