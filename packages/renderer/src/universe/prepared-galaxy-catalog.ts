import { mountCatalogMarker } from './catalog-marker.js';
import { catalogueClassification, isPreparedCluster, isPreparedNebula, parsePreparedGalaxyCatalog, parsePreparedClusterCatalog, parsePreparedNebulaCatalog } from '@cssearth/catalog';
import { matchesObjectClassification } from '@cssearth/objects';
import type { PreparedCatalogObject } from '@cssearth/catalog';
import type { DensityVolumeFrame } from '@cssearth/objects';
import type { WorldCameraPose, WorldCameraViewport } from '../navigation/world-camera.js';
import type { LabelScreenRect } from '../labels/screen-label-layout.js';
import { createOpacityFader } from '../stars/opacity-fader.js';
import { admitGalaxyLabels, catalogVolumeCorners, projectCatalogBounds, projectCatalogPosition } from './galaxy-catalog-layout.js';
import type { ProjectedGalaxy } from './galaxy-catalog-layout.js';
import { screenPicking } from '../navigation/screen-picking.js';
import { DEFAULT_CONTEXT_LABEL_OPACITY } from '../labels/label-presentation.js';
import type { ScreenPickTarget } from '../navigation/screen-picking.js';
import { createLabelBudget, labelEligible, type LabelBudget } from '../labels/universe-label-policy.js';

import { projectGalaxyCaptionAnchor } from './galaxy-caption-anchor.js';
interface Entry {
  object: PreparedCatalogObject;
  readonly marker: HTMLElement;
  readonly dot: HTMLElement | null;
  readonly navigable: boolean;
  readonly label: HTMLElement;
  readonly activate: (event: Event) => void;
  readonly cornersM: readonly (readonly number[])[] | null;
  /** The object's drawn sphere and published stellar extent: its caption hangs under the one, hides inside the other. */
  readonly caption: GalaxyCaptionSource | null;
  placement: number; shown: boolean;
  width: number;
  height: number;
  /** This frame's projected label anchor; written to the label only while it shows or fades. */
  labelX: number;
  labelY: number;
  /** Last published label interactivity; null until the first publication. */
  interactive: boolean | null;
  /** The marker's and dot's last written transform, so an unmoved marker writes nothing. */
  transform: string;
}

export interface GalaxyCaptionSource { readonly frame: DensityVolumeFrame; readonly drawnRadiusUnits: number; readonly extentRadiusUnits: number }

/** One fixed catalogue bank, shared by every detailed scene and every camera focus. */
export function mountPreparedGalaxyCatalog({ host, before, payload, clusters, galaxySample, nebulae, nebulaFrames, renderedObjectIds, billboardedObjectIds, galaxyCaptions, onSelect = () => {}, pickingHost = host }: {
  host: HTMLElement; before: Element; payload: unknown; clusters?: unknown; nebulae?: unknown; onSelect?: (object: PreparedCatalogObject) => void; pickingHost?: HTMLElement;
  nebulaFrames?: ReadonlyMap<string, DensityVolumeFrame>;
  renderedObjectIds?: ReadonlySet<string>;
  /** Objects whose own image marks them from afar: their caption stands without a ring over that image. */
  billboardedObjectIds?: ReadonlySet<string>;
  /** Objects with a published stellar extent, by detailed object id: their caption hangs under their drawn sphere and
   * hides while the camera is inside the extent. */
  galaxyCaptions?: ReadonlyMap<string, GalaxyCaptionSource>;
  galaxySample?: unknown;
}) {
  const catalog = parsePreparedGalaxyCatalog(payload), document = host.ownerDocument;
  const clusterCatalog = clusters === undefined ? null : parsePreparedClusterCatalog(clusters);
  if (clusterCatalog && (clusterCatalog.frame.referenceFrame !== catalog.frame.referenceFrame || clusterCatalog.frame.epochJdTt !== catalog.frame.epochJdTt)) throw new TypeError('Prepared catalogues must share one frame and epoch.');
  const nebulaCatalog = nebulae === undefined ? null : parsePreparedNebulaCatalog(nebulae);
  if (nebulaCatalog && (nebulaCatalog.frame.referenceFrame !== catalog.frame.referenceFrame || nebulaCatalog.frame.epochJdTt !== catalog.frame.epochJdTt)) throw new TypeError('Prepared catalogues must share one frame and epoch.');
  let sampleIds: Set<string> | undefined;
  if (galaxySample !== undefined) {
    if (!galaxySample || typeof galaxySample !== 'object' || !('schema' in galaxySample) || galaxySample.schema !== 'cssearth-galaxy-display-sample@1' ||
        !('ids' in galaxySample) || !Array.isArray(galaxySample.ids) || galaxySample.ids.length > 48 ||
        !galaxySample.ids.every(id => typeof id === 'string' && catalog.objects.some(row => row.id === id && row.membership.group === 'local-group'))) throw new TypeError('Invalid baked galaxy sample.');
    sampleIds = new Set(galaxySample.ids);
  }
  const objects: readonly PreparedCatalogObject[] = [...catalog.objects.filter(object => object.membership.group === 'local-group' && (object.detailedObjectId || !sampleIds || sampleIds.has(object.id))), ...clusterCatalog?.objects ?? [], ...nebulaCatalog?.objects ?? []].filter(object => !isPreparedNebula(object) ||
    Boolean(object.detailedObjectId && (!renderedObjectIds || renderedObjectIds.has(object.detailedObjectId))));
  if (new Set(objects.map(object => object.id)).size !== objects.length) throw new TypeError('Prepared catalogue focus identifiers must be unique.');
  const root = document.createElement('div');
  root.className = 'prepared-galaxy-catalog';
  // Zero-size root at the stage centre, children placed from it (world-context.css): a full-screen box above the globe
  // became a full-screen layer. Dots and labels keep their fixed look there too; only their place, size, fade
  // and pointer state are inline.
  host.insertBefore(root, before);
  const picking = screenPicking(pickingHost);
  const fader = createOpacityFader(document.defaultView!, undefined, { hideAtZero: true });
  // The source bank also preserves Local Volume nonmembers for future scopes.
  // Membership is a prepared scientific fact, never a runtime distance cut.
  const createEntry = (object: PreparedCatalogObject): Entry => {
    const marker = document.createElement('span'), label = document.createElement('span');
    const navigable = isPreparedCluster(object) || Boolean(object.detailedObjectId && (!renderedObjectIds || renderedObjectIds.has(object.detailedObjectId)));
    const dot = !isPreparedCluster(object) && !isPreparedNebula(object) ? document.createElement('span') : null;
    if (dot) {
      dot.dataset.galaxyDot = object.id;
      dot.style.cssText = 'opacity:0;visibility:hidden';
      root.append(dot);
    }
    marker.dataset.galaxyMarker = object.id;
    mountCatalogMarker(marker, object);
    label.dataset.galaxyLabel = object.id;
    label.className = 'prepared-context-label';
    if (navigable) label.dataset.objectNavigate = object.id;
    label.dataset.objectNavigateActivation = 'click';
    label.textContent = object.name;
    label.title = isPreparedCluster(object) ? `${object.name} — MCXC-II centre` : object.status === 'candidate' ? `${object.name} — candidate galaxy` : object.name;
    label.style.cssText = 'opacity:0;visibility:hidden';
    const activate = (event: Event) => {
      if (label.style.pointerEvents !== 'auto') return;
      event.preventDefault(); event.stopPropagation(); onSelect(entry.object);
    };
    label.addEventListener(label.dataset.objectNavigateActivation, activate);
    label.addEventListener('keydown', event => { if (event.key === 'Enter') activate(event); });
    // A navigable label's pointer cursor follows its data-object-navigate attribute (world-context.css).
    if (navigable) label.setAttribute('role', 'button');
    label.tabIndex = -1;
    // Catalogue-only rows have no prepared scene. Keep their dots, but do not
    // mount inert marker/caption nodes that can resemble a destination. A cluster is its member galaxies' dots: its name
    // alone marks it.
    if (navigable) root.append(...isPreparedCluster(object) ? [label] : [marker, label]);
    const frame = isPreparedNebula(object) ? nebulaFrames?.get(object.detailedObjectId ?? object.id) : undefined;
    const caption = !isPreparedCluster(object) && object.detailedObjectId !== undefined ? galaxyCaptions?.get(object.detailedObjectId) ?? null : null;
    const entry: Entry = { object, marker, dot, navigable, label, activate, cornersM: frame && !caption ? catalogVolumeCorners(frame) : null, caption,
      placement: 0, shown: false, width: 0, height: 0, labelX: 0, labelY: 0, interactive: null, transform: '' };
    return entry;
  };
  const entries: Entry[] = objects.filter(object => labelEligible({ named: Boolean(object.name), notable: isPreparedCluster(object) || Boolean(object.detailedObjectId) })).map(createEntry);
  // Every catalogue row is a focus destination, but only the display sample is
  // drawn as context. One retained entry carries the focused row that has no
  // entry of its own, so the destination always shows its marker and caption.
  const unsampled = catalog.objects.filter(object => object.name && !object.detailedObjectId && !entries.some(entry => entry.object.id === object.id));
  const focusEntry = unsampled[0] ? createEntry(unsampled[0]) : null;
  let focusBound = false;
  let destroyed = false, selectedId: string | null = null;
  // A header pill's category: its entries rank first in label admission.
  let highlighted: ReadonlySet<string> = new Set();
  let exclusions: readonly LabelScreenRect[] = [];
  let dormant = false;
  // Labels are measured when the catalogue first wakes, not at mount: reading
  // their sizes then forced a layout of the whole starting page for labels that
  // only appear at intergalactic range. Font changes mark the sizes stale.
  let measured = false;
  const measure = () => { measured = false; };
  document.fonts?.addEventListener('loadingdone', measure);
  return Object.freeze({ root, catalog,
    select(id: string | null) {
      selectedId = entries.find(entry => entry.object.id === id || (!isPreparedCluster(entry.object) && entry.object.detailedObjectId === id))?.object.id ?? id;
      if (!focusEntry) return;
      const row = unsampled.find(object => object.id === selectedId);
      if (row && row !== focusEntry.object) {
        focusEntry.object = row; focusEntry.label.textContent = row.name;
        focusEntry.label.title = row.status === 'candidate' ? `${row.name} — candidate galaxy` : row.name;
        focusEntry.shown = false; focusEntry.placement = 0; focusEntry.width = 0;
      }
      if (!row && focusBound) for (const element of [focusEntry.label, focusEntry.marker, focusEntry.dot!]) fader.set(element, 0, 200);
      focusBound = Boolean(row);
    },
    highlight(classification: string | null) {
      highlighted = new Set(classification === null ? [] : entries.filter(entry =>
        matchesObjectClassification(catalogueClassification(entry.object), classification)).map(entry => entry.object.id));
      root.dataset.highlighted = String(highlighted.size);
    },
    resolve(id: string) { return [...catalog.objects, ...clusterCatalog?.objects ?? [], ...nebulaCatalog?.objects ?? []].find(object => object.id === id || (!isPreparedCluster(object) && object.detailedObjectId === id)) ?? null; },
    publish(world: WorldCameraPose, viewport: WorldCameraViewport, opacity: number, blockerRects: readonly LabelScreenRect[] = [], clusterOpacity = opacity, dotOpacity = opacity,
      budget?: LabelBudget, nebulaOpacity = opacity) {
      if (destroyed) return exclusions;
      if (world.referenceFrame !== catalog.frame.referenceFrame || world.epochJdTt !== catalog.frame.epochJdTt) {
        throw new TypeError('Galaxy catalogue and observer must share a reference frame and epoch.');
      }
      const width = viewport.widthPixels ?? host.clientWidth, height = viewport.heightPixels ?? host.clientHeight;
      const candidates: ProjectedGalaxy[] = [];
      const visible = new Set<string>();
      const alpha = Math.max(0, Math.min(1, opacity));
      const clusterAlpha = Math.max(0, Math.min(1, clusterOpacity));
      const objectOpacity = (object: PreparedCatalogObject) =>
        isPreparedCluster(object) ? clusterAlpha : isPreparedNebula(object) ? nebulaOpacity : alpha;
      // Only the extragalactic populations sleep with their fades. Nearby
      // nebulae keep following the camera and remain available as fly-to targets.
      if (alpha === 0 && dotOpacity === 0 && clusterAlpha === 0 && !nebulaCatalog?.objects.length) {
        if (dormant) return exclusions;
        dormant = true;
      } else dormant = false;
      if (!measured && !dormant) {
        for (const entry of entries) { entry.width = entry.label.offsetWidth; entry.height = entry.label.offsetHeight; }
        measured = true;
      }
      const drawn = focusBound && focusEntry ? [...entries, focusEntry] : entries;
      if (focusBound && focusEntry && !focusEntry.width) { focusEntry.width = focusEntry.label.offsetWidth; focusEntry.height = focusEntry.label.offsetHeight; }
      for (const entry of drawn) {
        const point = projectCatalogPosition(entry.object.positionM, world, viewport);
        if (!point || !(width > 0 && height > 0)) continue;
        const anchor = entry.caption ? projectGalaxyCaptionAnchor(world, viewport, entry.caption.frame, entry.caption.drawnRadiusUnits, entry.caption.extentRadiusUnits) : null;
        // Inside its published extent the camera is within the galaxy: no caption names it from outside.
        if (entry.caption && !anchor) continue;
        const reach = anchor ? anchor.y - anchor.centreY : 4, centre = anchor ? { x: anchor.x, y: anchor.centreY } : point;
        if (Math.abs(centre.x) > width / 2 + reach || Math.abs(centre.y) > height / 2 + reach) continue;
        visible.add(entry.object.id);
        // Written to both from one string, never read back from the style (a read serialises it).
        const transform = `translate(${point.x}px,${point.y}px) translate(-50%,-50%)`;
        if (transform !== entry.transform) {
          entry.marker.style.transform = transform;
          if (entry.dot) entry.dot.style.transform = transform;
          entry.transform = transform;
        }
        const bounds = anchor ? { left: anchor.x - reach, right: anchor.x + reach, top: anchor.centreY - reach, bottom: anchor.y }
          : entry.cornersM ? projectCatalogBounds(entry.cornersM, world, viewport) : null;
        if (entry.cornersM && !bounds) continue;
        const x = bounds ? (bounds.left + bounds.right) / 2 : point.x;
        const y = (bounds?.bottom ?? point.y) + 8 + entry.height;
        const labelRect = { left: x - entry.width / 2, right: x + entry.width / 2,
          top: y - entry.height, bottom: y };
        const objectAlpha = objectOpacity(entry.object);
        {
          const above = (bounds?.top ?? point.y) - 8;
          const alternateLabelRects = entry.navigable ? [
            { left: labelRect.left, right: labelRect.right, top: above - entry.height, bottom: above },
            { left: (bounds?.right ?? point.x) + 12, right: (bounds?.right ?? point.x) + 12 + entry.width,
              top: point.y - entry.height / 2, bottom: point.y + entry.height / 2 },
            { left: (bounds?.left ?? point.x) - 12 - entry.width, right: (bounds?.left ?? point.x) - 12,
              top: point.y - entry.height / 2, bottom: point.y + entry.height / 2 },
          ] : [];
          const previousRect = [labelRect, ...alternateLabelRects][entry.placement] ?? labelRect;
          // A rejected label keeps following the same side throughout its fade.
          entry.labelX = (previousRect.left + previousRect.right) / 2; entry.labelY = previousRect.bottom;
          // A marker and caption promise an available destination. Catalogue-only
          // rows remain as unobtrusive dots, but never enter the annotation layout.
          if (objectAlpha > 0 && entry.navigable) candidates.push({ object: entry.object, navigable: true, shown: entry.shown, placement: entry.placement,
            ...point, labelRect, alternateLabelRects });
        }
      }
      const admitted = admitGalaxyLabels(candidates, blockerRects, selectedId, budget ?? createLabelBudget(width, height), highlighted);
      // With a category highlighted its labels and markers show at full strength and the rest at a third, as the body markers do.
      const emphasised = (entry: Entry, base: number) => highlighted.size === 0 ? base : highlighted.has(entry.object.id) ? 1 : base * .3;
      const admittedById = new Map(admitted.map(entry => [entry.object.id, entry]));
      const pickTargets: ScreenPickTarget[] = [];
      for (const entry of drawn) {
        const objectAlpha = objectOpacity(entry.object);
        const projected = admittedById.get(entry.object.id);
        entry.shown = Boolean(projected);
        if (projected) { entry.placement = projected.placement ?? 0; entry.labelX = (projected.labelRect.left + projected.labelRect.right) / 2; entry.labelY = projected.labelRect.bottom; }
        const labelOpacity = projected ? objectAlpha * emphasised(entry, DEFAULT_CONTEXT_LABEL_OPACITY) : 0;
        fader.set(entry.label, labelOpacity, 200);
        // Only a shown or still-fading label follows its galaxy. Moving every on-screen
        // candidate restyled each hidden label on every camera frame.
        if (visible.has(entry.object.id) && (projected || fader.current(entry.label) > 0)) {
          entry.label.style.transform = `translate(${entry.labelX}px,${entry.labelY}px) translate(-50%,-100%)`;
        }
        const billboarded = !isPreparedCluster(entry.object) && entry.object.detailedObjectId !== undefined && billboardedObjectIds?.has(entry.object.detailedObjectId) === true;
        fader.set(entry.marker, projected && !billboarded ? objectAlpha * emphasised(entry, .45) : 0, 200);
        // Interactivity flips rarely; rewriting it for every galaxy each frame reflected three attributes.
        if (entry.dot) fader.set(entry.dot, visible.has(entry.object.id) ? Math.max(0, Math.min(1, dotOpacity)) * (1 - (projected ? objectAlpha : 0)) * .4 : 0, 200);
        const interactive = entry.navigable && labelOpacity > .1;
        if (entry.interactive !== interactive) {
          entry.label.style.pointerEvents = interactive ? 'auto' : 'none';
          entry.label.tabIndex = interactive ? 0 : -1;
          entry.label.ariaHidden = interactive ? 'false' : 'true';
          entry.interactive = interactive;
        }
        // Catalogue labels remain behind the focus point and detailed bodies.
        if (projected && interactive) pickTargets.push({ element: entry.label, rank: -2,
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
      for (const entry of entries) entry.label.removeEventListener(entry.label.dataset.objectNavigateActivation!, entry.activate);
      root.remove();
    },
  });
}
