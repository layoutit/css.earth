import { createObjectRuntime } from '../runtime/object-runtime.js';
import type { ObjectRuntimeDefinition, ObjectMountOptions, WorldContextLayer } from '../runtime/object-runtime-types.js';
import { requireCamera } from '../validation/camera-controls.js';
import type { PreparedCssVolume } from '../volume/types.js';
import { mountPreparedCssVolume } from '../volume/prepared-volume-runtime.js';
import { validatePreparedCssVolume } from '../volume/validation.js';
import type { SpriteWithUrl } from '../solar-system/heliocentric-sprites.js';
import { logarithmicFade, mountPreparedWorldContext, parsePreparedWorldContext } from './prepared-world-context.js';
import type { PreparedWorldContext } from './prepared-world-context.js';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { PreparedCssPointField } from '../stars/types.js';
import { mountPreparedCssPointField } from '../stars/prepared-point-field-runtime.js';

/** The selected object's content and contextual representations share one runtime and physical observer. */
export function createWorldContextObjectRuntime({ definition, context, volume, stars, resolveStarResource, resolveResource, sprites }: {
  definition: ObjectRuntimeDefinition; context: unknown; volume: PreparedCssVolume;
  stars: PreparedCssPointField; resolveStarResource(path: string): string;
  resolveResource(path: string): string; sprites: Readonly<Record<string, SpriteWithUrl>>;
}) {
  const plan = parsePreparedWorldContext(context);
  const payload = validatePreparedCssVolume(volume);
  if (definition.id !== plan.focus.id || payload.id !== plan.volume.objectId ||
      payload.frame.referenceFrame !== plan.frame.referenceFrame || payload.frame.epochJdTt !== plan.frame.epochJdTt ||
      stars.id !== plan.stars.objectId || stars.frame.referenceFrame !== plan.frame.referenceFrame || stars.frame.epochJdTt !== plan.frame.epochJdTt) {
    throw new TypeError('Selected object, context and volume must share their prepared identities and epoch.');
  }
  const camera = { ...definition.camera, ...plan.camera.presentation };
  requireCamera(camera);
  const pool = `volume:${payload.id}`;
  const entries = payload.resources.map(resource => {
    const url = resolveResource(resource.path);
    if (typeof url !== 'string' || !url) throw new TypeError(`Missing prepared volume resource ${resource.path}.`);
    return { key: `${pool}:${resource.path}`, url, pool };
  });
  const starPool = `stars:${stars.id}`;
  const starEntries = stars.resources.filter(resource => resource.path === stars.atlas.path).map(resource => ({ key: `${starPool}:${resource.path}`,
    url: resolveStarResource(resource.path), pool: starPool }));
  const prepared = { ...definition, camera,
    ...(plan.sky.sceneRegistration === undefined ? {} : {
      sky: { ...definition.sky, cameraContract: 'scene-locked-unbounded-accumulated-matrix3d' as const,
        sceneRegistration: plan.sky.sceneRegistration },
    }), assets: {
    entries: [...definition.assets.entries, ...entries, ...starEntries],
    pools: [...definition.assets.pools, { id: pool, retention: 'mount' as const, capacity: entries.length,
      concurrency: 8, reuse: false, decoding: 'async' as const },
      { id: starPool, retention: 'mount' as const, capacity: starEntries.length, concurrency: 8, reuse: false, decoding: 'async' as const }],
    startup: [...definition.assets.startup, ...entries.map(entry => entry.key), ...starEntries.map(entry => entry.key)],
  } };
  const mount = createObjectRuntime(prepared);
  return (stage: HTMLElement, options: ObjectMountOptions) => mount(stage, {
    ...options, worldFrame: plan.frame,
    worldContext: { frame: plan.frame, bodyRadiusUnits: plan.frame.bodyRadiusM / plan.frame.metersPerUnit,
      kilometersPerUnit: plan.frame.metersPerUnit / 1000,
      maximumExtentUnits: plan.camera.maximumDistanceM / plan.frame.metersPerUnit,
      framingReferenceZoom: plan.camera.framingReferenceZoom,
      sceneRegistration: plan.sky.sceneRegistration },
    capabilities: { ...options.capabilities,
      mountWorldContext({ stage, before, skyElement }) {
        return mountLayers({ stage, before, skyElement, plan, payload, stars, resolveStarResource, resolveResource, sprites });
      },
    },
  });
}

function mountLayers({ stage, before, skyElement, plan, payload, stars, resolveStarResource, resolveResource, sprites }: {
  stage: HTMLElement; before: HTMLElement; skyElement: HTMLElement; plan: PreparedWorldContext;
  payload: PreparedCssVolume; resolveResource(path: string): string; sprites: Readonly<Record<string, SpriteWithUrl>>;
  stars: PreparedCssPointField; resolveStarResource(path: string): string;
}): WorldContextLayer {
  const document = stage.ownerDocument;
  const volumeHost = document.createElement('div');
  volumeHost.className = 'prepared-volume-context';
  volumeHost.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;visibility:hidden';
  stage.insertBefore(volumeHost, skyElement);
  const end = document.createElement('span'); end.hidden = true; volumeHost.appendChild(end);
  // This mount uses the physical galaxy as its background at every scale.
  // Retain the shared shell's cube for lifecycle/identity compatibility only.
  const skyFade = document.createElement('div');
  skyFade.className = 'prepared-context-sky-fade';
  skyFade.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:0;opacity:0;visibility:hidden';
  stage.insertBefore(skyFade, skyElement); skyFade.appendChild(skyElement);
  let volume: ReturnType<typeof mountPreparedCssVolume> | null = null;
  let spatial: ReturnType<typeof mountPreparedWorldContext> | null = null;
  let pointField: ReturnType<typeof mountPreparedCssPointField> | null = null;
  let destroyed = false;
  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    volume?.destroy(); spatial?.destroy(); pointField?.destroy(); volumeHost.remove();
    if (skyFade.parentNode && skyElement.parentNode === skyFade) skyFade.replaceWith(skyElement);
    else skyFade.remove();
    delete stage.dataset.contextScale;
  };
  try {
    volume = mountPreparedCssVolume({ host: volumeHost, before: end, payload, resolveResource });
    pointField = mountPreparedCssPointField({ host: stage, before, payload: stars, resolveResource: resolveStarResource, occluder: plan.focus });
    spatial = mountPreparedWorldContext({ host: stage, before, plan, sprites });
    return Object.freeze({ destroy,
      publish(world: WorldCameraPose, viewport: WorldCameraViewport) {
        if (destroyed) return;
        // The selected body's root can be laid out beside the sidebar. The
        // contextual layers occupy the whole stage, so express the same
        // principal point relative to their centre before projecting it.
        const bodyBounds = before.getBoundingClientRect(), stageBounds = stage.getBoundingClientRect();
        const stageViewport: WorldCameraViewport = { focalPixels: viewport.focalPixels,
          principalOffsetPixels: [
            viewport.principalOffsetPixels[0] + bodyBounds.x + bodyBounds.width / 2 - stageBounds.x - stageBounds.width / 2,
            viewport.principalOffsetPixels[1] + bodyBounds.y + bodyBounds.height / 2 - stageBounds.y - stageBounds.height / 2,
          ] };
        const distanceM = Math.hypot(...world.pose.positionM.map((value, axis) => value - plan.focus.positionM[axis]));
        const fade = logarithmicFade(distanceM, plan.volume.fadeStartDistanceM, plan.volume.fullDistanceM);
        const stellarFade = logarithmicFade(distanceM, plan.stars.fadeStartDistanceM, plan.stars.fullDistanceM);
        // The same physical volume remains behind the observer at every scale.
        // A photograph with a separately calibrated orientation cannot stand
        // in for its interior without breaking astrometric continuity.
        volumeHost.style.visibility = '';
        volumeHost.dataset.volumeOpacity = '1';
        volume!.publish({ world, viewport: stageViewport });
        pointField!.publish(world, stageViewport, 1 - fade);
        spatial!.publish(world, stageViewport);
        stage.dataset.contextScale = fade > 0 ? 'galactic' : stellarFade > 0 ? 'stellar' : distanceM > plan.focus.radiusM * 100 ? 'system' : 'object';
      },
    });
  } catch (error) { destroy(); throw error; }
}
