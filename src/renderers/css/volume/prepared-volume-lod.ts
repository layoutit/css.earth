import { mountPreparedCssVolume } from './prepared-volume-runtime.js';
import { projectVolumeImpostors } from './volume-impostor-projection.js';
import type { PreparedVolumeMountOptions, PreparedVolumeRuntime, VolumeCameraPublication } from './types.js';

/** Retain the full geometry, but publish it only when depth can occupy visible screen pixels. */
export function mountPreparedVolumeLod(options: PreparedVolumeMountOptions, completedOpacity: (runtime: PreparedVolumeRuntime) => number): PreparedVolumeRuntime {
  const bank = options.payload.impostors;
  if (!bank) return mountPreparedCssVolume(options);
  const document = options.host.ownerDocument;
  const full = document.createElement('div'), distant = document.createElement('div');
  full.className = 'css-volume-detail'; distant.className = 'css-volume-impostors';
  for (const node of [full, distant]) Object.assign(node.style, {
    position: 'absolute', inset: '0', pointerEvents: 'none', display: 'none', transformStyle: 'flat',
  });
  const marker = document.createElement('span'); marker.hidden = true; full.append(marker);
  options.host.insertBefore(full, options.before); options.host.insertBefore(distant, options.before);
  const runtime = mountPreparedCssVolume({ ...options, host: full, before: marker });
  // The universe must remain visible outside the prepared cloud footprint.
  for (const root of runtime.roots) root.style.background = 'transparent';
  const views = new Map(bank.views.map(view => {
    const node = document.createElement('s');
    node.dataset.volumeImpostor = view.id;
    Object.assign(node.style, { position: 'absolute', left: '50%', top: '50%', display: 'none',
      pointerEvents: 'none', transformOrigin: '50% 50%', backgroundRepeat: 'no-repeat', backgroundSize: '100% 100%',
      backgroundImage: `url("${escapeUrl(options.resolveResource(view.texturePath))}")` });
    distant.append(node);
    return [view.id, node] as const;
  }));
  let destroyed = false, active: readonly string[] = [];
  const publish = (publication: VolumeCameraPublication) => {
    if (destroyed) return;
    const projection = projectVolumeImpostors(publication, options.payload.frame, bank);
    const { visible, volumeMix, diameterPixels, x, y } = projection;
    options.host.dataset.volumeDetailMix = String(volumeMix);
    options.host.dataset.volumeDiameterPixels = String(diameterPixels);
    full.style.display = visible && volumeMix > 0 ? 'block' : 'none';
    distant.style.display = visible && volumeMix < 1 ? 'block' : 'none';
    if (visible && volumeMix > 0) {
      runtime.publish(publication);
      full.style.opacity = String(volumeMix * completedOpacity(runtime));
    }
    distant.style.opacity = String(1 - volumeMix);
    const next = projection.views.map(view => view.id);
    for (const id of active) if (!next.includes(id)) views.get(id)!.style.display = 'none';
    // Only the few contributing projections receive screen transforms. Textures and cloud geometry stay fixed.
    for (const view of projection.views) {
      const node = views.get(view.id)!;
      node.style.display = 'block';
      node.style.opacity = String(view.weight);
      node.style.width = `${diameterPixels}px`; node.style.height = `${diameterPixels}px`;
      node.style.transform = `translate(${x - diameterPixels / 2}px,${y - diameterPixels / 2}px) matrix(${view.matrix.join(',')},0,0)`;
    }
    active = next;
    distant.dataset.activeViews = String(next.length);
  };
  return { roots: runtime.roots, publish, destroy() {
    if (destroyed) return; destroyed = true;
    runtime.destroy(); full.remove(); distant.remove();
  } };
}
function escapeUrl(value: string): string { return value.replace(/["\\\n\r]/gu, character => `\\${character}`); }
