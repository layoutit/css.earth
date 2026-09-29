/** Retained prepared catalogue points; the host validates catalogue provenance and supplies camera projection. */
import { cloudDensityWeight, validateCloudDensityFilter, type CloudDensityFilter } from '@cssearth/bake/volume';
export interface PreparedCataloguePoint {
  id: string; magnitude: number; positionUnits: readonly [number, number, number];
  sizePx: number; colorCss: string; opacity: number; cloudSignal: number; cloudPartIds: readonly string[];
}
export interface CatalogueProjection {
  halfWidth: number; halfHeight: number;
  project(position: readonly [number, number, number]): { x: number; y: number; depth: number };
}

export function mountCatalogueStars<Publication>({ host, payload, before = null, className, projection }: {
  host: HTMLElement; payload: { stars: readonly PreparedCataloguePoint[] }; before?: Node | null; className: string;
  projection(publication: Publication, host: HTMLElement): CatalogueProjection;
}) {
  const root = host.ownerDocument.createElement('div'); root.className = className; root.ariaHidden = 'true';
  root.dataset.starCount = String(payload.stars.length);
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:1';
  const nodes = payload.stars.map(star => {
    const node = host.ownerDocument.createElement('s'); node.dataset.catalogueSource = star.id;
    node.style.cssText = `position:absolute;left:50%;top:50%;display:block;width:${star.sizePx}px;height:${star.sizePx}px;border-radius:50%;background:${star.colorCss};opacity:${star.opacity};visibility:hidden;text-decoration:none`;
    root.append(node); return node;
  });
  host.insertBefore(root, before);
  let enabled = true, destroyed = false, visibleCount = 0, sizeScale = 1;
  const support = new Float64Array(payload.stars.length).fill(1);
  const publish = (publication: Publication) => {
    if (destroyed) return;
    const { project, halfWidth, halfHeight } = projection(publication, host);
    visibleCount = 0;
    payload.stars.forEach((star, index) => {
      const p = project(star.positionUnits), node = nodes[index]!;
      const size = star.sizePx * sizeScale;
      const shown = support[index]! > 0 && p.depth > 0 && Math.abs(p.x) < halfWidth + size && Math.abs(p.y) < halfHeight + size;
      node.style.visibility = shown ? '' : 'hidden';
      if (shown) {
        visibleCount++;
        // CSS Y and the parent east-left reflection follow the same convention as the existing point renderer.
        node.style.transform = `translate(${p.x - size / 2}px,${p.y - size / 2}px)`;
      }
    });
    root.dataset.visibleStars = String(enabled ? visibleCount : 0);
  };
  return Object.freeze({ root, count: payload.stars.length,
    magnitudeRange: [Math.min(...payload.stars.map(s => s.magnitude)), Math.max(...payload.stars.map(s => s.magnitude))] as [number, number],
    publish,
    setSize(value: number) {
      if (!Number.isFinite(value) || value < .5 || value > 3) throw new TypeError('Star size must be between 50% and 300%.');
      sizeScale = value;
      payload.stars.forEach((star, index) => {
        nodes[index]!.style.width = nodes[index]!.style.height = `${star.sizePx * sizeScale}px`;
      });
    },
    setCloudSupport(filter: CloudDensityFilter, partIds: readonly string[]) {
      const valid = validateCloudDensityFilter(filter), selected = new Set(partIds);
      payload.stars.forEach((star, index) => {
        const weight = cloudDensityWeight(star.cloudSignal, valid);
        support[index] = star.cloudPartIds.some(id => selected.has(id)) ? (valid.showRemoved ? 1 - weight : weight) : 0;
        nodes[index]!.style.opacity = String(star.opacity * support[index]!);
        if (!support[index]) nodes[index]!.style.visibility = 'hidden';
      });
    },
    setVisible(value: boolean) { enabled = value; root.style.visibility = value ? '' : 'hidden';
      // Explicit child visibility can escape a hidden parent, so hide the root's display as one retained layer.
      root.style.display = value ? 'block' : 'none'; root.dataset.visibleStars = String(value ? visibleCount : 0); },
    destroy() { if (destroyed) return; destroyed = true; root.remove(); },
  });
}
