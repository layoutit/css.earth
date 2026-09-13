import { isPreparedCluster, parsePreparedGalaxyCatalog, parsePreparedClusterCatalog } from '@cssearth/catalog';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import { admitGalaxyLabels, projectCatalogAperture, projectCatalogPosition } from './galaxy-catalog-layout.js';
import type { ProjectedGalaxy } from './galaxy-catalog-layout.js';
import { screenPicking } from '../navigation/screen-picking.js';
import type { ScreenPickTarget } from '../navigation/screen-picking.js';

interface Entry {
  readonly object: PreparedCatalogObject;
  readonly marker: HTMLElement;
  readonly label: HTMLElement;
  readonly aperture: HTMLElement | null;
  readonly activate: (event: Event) => void;
  width: number;
  height: number;
  /** Last published label interactivity; null until the first publication. */
  interactive: boolean | null;
}

/** One fixed catalogue bank, shared by every detailed scene and every camera focus. */
export function mountPreparedGalaxyCatalog({ host, before, payload, clusters, onSelect = () => {}, pickingHost = host }: {
  host: HTMLElement; before: Element; payload: unknown; clusters?: unknown; onSelect?: (object: PreparedCatalogObject) => void; pickingHost?: HTMLElement;
}) {
  const catalog = parsePreparedGalaxyCatalog(payload), document = host.ownerDocument;
  const clusterCatalog = clusters === undefined ? null : parsePreparedClusterCatalog(clusters);
  if (clusterCatalog && (clusterCatalog.frame.referenceFrame !== catalog.frame.referenceFrame || clusterCatalog.frame.epochJdTt !== catalog.frame.epochJdTt)) throw new TypeError('Prepared catalogues must share one frame and epoch.');
  const objects: readonly PreparedCatalogObject[] = [...catalog.objects.filter(object => object.membership.group === 'local-group'), ...clusterCatalog?.objects ?? []];
  if (new Set(objects.map(object => object.id)).size !== objects.length) throw new TypeError('Prepared catalogue focus identifiers must be unique.');
  const root = document.createElement('div');
  root.className = 'prepared-galaxy-catalog';
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none';
  host.insertBefore(root, before);
  const picking = screenPicking(pickingHost);
  const fader = createOpacityFader(document.defaultView!);
  // The source bank also preserves Local Volume nonmembers for future scopes.
  // Membership is a prepared scientific fact, never a runtime distance cut.
  const entries: Entry[] = objects.map(object => {
    const marker = document.createElement('span'), label = document.createElement('span');
    const aperture = isPreparedCluster(object) ? document.createElement('span') : null;
    if (aperture) {
      aperture.dataset.clusterAperture = object.id;
      aperture.style.cssText = 'position:absolute;left:50%;top:50%;box-sizing:border-box;border:1px solid #80a1cc;border-radius:50%;opacity:0;pointer-events:none';
      aperture.title = 'R500 overdensity aperture; not the cluster boundary';
      root.append(aperture);
    }
    marker.dataset.galaxyMarker = object.id;
    marker.style.cssText = 'position:absolute;left:50%;top:50%;width:2px;height:2px;border-radius:50%;background:#c2ccd8;opacity:0;pointer-events:none';
    label.dataset.galaxyLabel = object.id;
    label.dataset.objectNavigate = object.id;
    label.dataset.objectNavigateActivation = 'dblclick';
    label.textContent = object.name;
    label.title = isPreparedCluster(object) ? `${object.name} — MCXC-II centre; outline is R500, not a cluster boundary` : object.status === 'candidate' ? `${object.name} — candidate galaxy` : object.name;
    label.style.cssText = 'position:absolute;left:50%;top:50%;font:11px system-ui;color:#c2ccd8;white-space:nowrap;opacity:0;pointer-events:none;cursor:pointer';
    const activate = (event: Event) => {
      if (label.style.pointerEvents !== 'auto') return;
      event.preventDefault(); event.stopPropagation(); onSelect(object);
    };
    label.addEventListener('dblclick', activate);
    label.addEventListener('keydown', event => { if (event.key === 'Enter') activate(event); });
    label.setAttribute('role', 'button'); label.tabIndex = -1;
    root.append(marker, label);
    return { object, marker, label, aperture, activate, width: 0, height: 0, interactive: null };
  });
  let destroyed = false, selectedId: string | null = null;
  let exclusions: readonly LabelScreenRect[] = [];
  let dormant = false;
  // Labels are measured when the catalogue first wakes, not at mount: reading
  // their sizes then forced a layout of the whole starting page for labels that
  // only appear at intergalactic range. Font changes mark the sizes stale.
  let measured = false;
  const measure = () => { measured = false; };
  document.fonts?.addEventListener('loadingdone', measure);
  return Object.freeze({ root, catalog,
    select(id: string | null) { selectedId = id; },
    resolve(id: string) { return entries.find(entry => entry.object.id === id)?.object ?? null; },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, opacity: number, blockerRects: readonly LabelScreenRect[] = [], clusterOpacity = opacity) {
      if (destroyed) return exclusions;
      if (world.referenceFrame !== catalog.frame.referenceFrame || world.epochJdTt !== catalog.frame.epochJdTt) {
        throw new TypeError('Galaxy catalogue and observer must share a reference frame and epoch.');
      }
      const width = viewport.widthPixels ?? host.clientWidth, height = viewport.heightPixels ?? host.clientHeight;
      const candidates: ProjectedGalaxy[] = [];
      const visible = new Set<string>();
      const apertures = new Set<string>();
      const alpha = Math.max(0, Math.min(1, opacity));
      const clusterAlpha = Math.max(0, Math.min(1, clusterOpacity));
      // Invisible catalogues still animate out: publish one complete frame at
      // zero, then skip projection and DOM writes until a fade rises again.
      if (alpha === 0 && clusterAlpha === 0) {
        if (dormant) return exclusions;
        dormant = true;
      } else dormant = false;
      if (!measured && !dormant) {
        for (const entry of entries) { entry.width = entry.label.offsetWidth; entry.height = entry.label.offsetHeight; }
        measured = true;
      }
      for (const entry of entries) {
        const point = projectCatalogPosition(entry.object.positionM, world, viewport);
        if (!point || !(width > 0 && height > 0)) continue;
        if (entry.aperture && isPreparedCluster(entry.object)) {
          const ellipse = projectCatalogAperture(entry.object.aperture.comovingRadiusM, point, viewport);
          if (ellipse && ellipse.b >= 2 && ellipse.a < Math.max(width, height) * 2 &&
              Math.abs(ellipse.x) < width / 2 + ellipse.a && Math.abs(ellipse.y) < height / 2 + ellipse.a) {
            entry.aperture.style.width = `${ellipse.a * 2}px`; entry.aperture.style.height = `${ellipse.b * 2}px`;
            entry.aperture.style.transform = `translate(${ellipse.x - ellipse.a}px,${ellipse.y - ellipse.b}px) rotate(${ellipse.angle}deg)`;
            apertures.add(entry.object.id);
          }
        }
        if (Math.abs(point.x) > width / 2 + 4 || Math.abs(point.y) > height / 2 + 4) continue;
        visible.add(entry.object.id);
        entry.marker.style.transform = `translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
        const y = point.y - 8;
        entry.label.style.transform = `translate(${point.x}px,${y}px) translate(-50%,-100%)`;
        const labelRect = { left: point.x - entry.width / 2, right: point.x + entry.width / 2,
          top: y - entry.height, bottom: y };
        const objectAlpha = isPreparedCluster(entry.object) ? clusterAlpha : alpha;
        if (labelRect.left >= -width / 2 && labelRect.right <= width / 2 && labelRect.top >= -height / 2 && labelRect.bottom <= height / 2 && objectAlpha > 0) {
          candidates.push({ object: entry.object, ...point, labelRect });
        }
      }
      const admitted = admitGalaxyLabels(candidates, blockerRects, selectedId);
      const admittedById = new Map(admitted.map(entry => [entry.object.id, entry]));
      const pickTargets: ScreenPickTarget[] = [];
      for (const entry of entries) {
        const objectAlpha = isPreparedCluster(entry.object) ? clusterAlpha : alpha;
        const projected = admittedById.get(entry.object.id);
        const labelOpacity = projected ? objectAlpha * .85 : 0;
        fader.set(entry.label, labelOpacity, 200);
        fader.set(entry.marker, visible.has(entry.object.id) ? objectAlpha * .45 : 0, 200);
        if (entry.aperture) fader.set(entry.aperture, apertures.has(entry.object.id) ? objectAlpha * .2 : 0, 200);
        // Interactivity flips rarely; rewriting it for every galaxy each frame reflected three attributes.
        const interactive = labelOpacity > .1;
        if (entry.interactive !== interactive) {
          entry.label.style.pointerEvents = interactive ? 'auto' : 'none';
          entry.label.tabIndex = interactive ? 0 : -1;
          entry.label.ariaHidden = interactive ? 'false' : 'true';
          entry.interactive = interactive;
        }
        // Catalogue labels remain behind the focus point and detailed bodies.
        if (projected && labelOpacity > .1) pickTargets.push({ element: entry.label, rank: -2,
          shape: { kind: 'rect', ...projected.labelRect } });
      }
      picking.publish(root, pickTargets);
      exclusions = admitted.map(entry => entry.labelRect);
      root.dataset.visibleLabels = String(admitted.length);
      root.dataset.catalogueCount = String(entries.length);
      return exclusions;
    },
    inspect() { return { count: entries.length, clusterCount: clusterCatalog?.objects.length ?? 0, selectedId,
      labels: Object.fromEntries(entries.map(entry => [entry.object.id, entry.label])) }; },
    destroy() {
      if (destroyed) return; destroyed = true; fader.destroy();
      picking.remove(root);
      document.fonts?.removeEventListener('loadingdone', measure);
      for (const entry of entries) entry.label.removeEventListener('dblclick', entry.activate);
      root.remove();
    },
  });
}
