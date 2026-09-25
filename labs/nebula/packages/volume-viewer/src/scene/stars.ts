import { compilerStarAppearance, type CompilerBakeResult } from '@cssearth/bake/volume';
import type { CompilerViewerBackend } from './backend.ts';

export function mountStars<Bank, Publication>(backend: CompilerViewerBackend<Bank, Publication>, host: HTMLElement, result: CompilerBakeResult, atlasUrl?: string) {
  const root = host.ownerDocument.createElement('div'); root.dataset.compilerStars = String(result.stars.length);
  root.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:2'; host.append(root);
  const nodes = result.stars.map(star => {
    const node = host.ownerDocument.createElement('s'); node.dataset.starId = star.id;
    const color = `rgb(${star.rgb[0]} ${star.rgb[1]} ${star.rgb[2]})`;
    node.style.cssText = `position:absolute;left:50%;top:50%;display:block;border-radius:50%;background:${color};opacity:${star.alpha};visibility:hidden;text-decoration:none`;
    root.append(node); return node;
  });
  function applyAppearance(index: number, lens: string | null) {
    const appearance = compilerStarAppearance(result.stars[index]!, lens), node = nodes[index]!, sprites = result.starSprites;
    if (sprites && atlasUrl) {
      const entry = sprites.entries[appearance.rgb.join(',')]!;
      node.style.borderRadius = '0'; node.style.backgroundColor = 'transparent';
      node.style.backgroundImage = `url("${atlasUrl}")`; node.style.backgroundRepeat = 'no-repeat';
      node.style.backgroundSize = `${sprites.width / sprites.tileSize * 100}% ${sprites.height / sprites.tileSize * 100}%`;
      node.style.backgroundPosition = `${sprites.width === sprites.tileSize ? 0 : entry.x / (sprites.width - sprites.tileSize) * 100}% ${sprites.height === sprites.tileSize ? 0 : entry.y / (sprites.height - sprites.tileSize) * 100}%`;
      node.style.opacity = String(appearance.alpha * sprites.alphaScale);
    } else {
      node.style.backgroundColor = `rgb(${appearance.rgb[0]} ${appearance.rgb[1]} ${appearance.rgb[2]})`;
      node.style.opacity = String(appearance.alpha);
    }
  }
  result.stars.forEach((_star, index) => applyAppearance(index, null));
  let visible = true, destroyed = false, lensId: string | null = null;
  root.dataset.photometryLens = 'reference';
  return { publish(publication: Publication) {
    if (destroyed) return;
    const projection = backend.starProjection(publication, result.frame, { width: host.clientWidth, height: host.clientHeight });
    const { focal, halfWidth, halfHeight } = projection;
    let count = 0;
    result.stars.forEach((star, index) => {
      const point = projection.project(star.positionUnits), node = nodes[index]!;
      const appearance = compilerStarAppearance(star, lensId);
      const diameter = (appearance.diameterUnits === undefined ? appearance.widthPx! : appearance.diameterUnits * focal / point.depth) * (result.starSprites?.diameterScale ?? 1);
      const shown = visible && appearance.alpha > 0 && point.depth > 0 && Math.abs(point.x) < halfWidth + diameter && Math.abs(point.y) < halfHeight + diameter;
      node.style.visibility = shown ? '' : 'hidden'; if (shown) {
        count++; node.style.width = node.style.height = `${diameter}px`;
        node.style.transform = `translate(${point.x - diameter / 2}px,${point.y - diameter / 2}px)`;
      }
    });
    root.dataset.visibleStars = String(count);
  }, setLens(value: string | null) {
    lensId = value; root.dataset.photometryLens = value ?? 'reference';
    result.stars.forEach((_star, index) => applyAppearance(index, lensId));
  }, setVisible(value: boolean) { visible = value; root.style.display = value ? 'block' : 'none'; root.dataset.visibleStars = value ? root.dataset.visibleStars ?? '0' : '0'; },
  destroy() { destroyed = true; root.remove(); } };
}
