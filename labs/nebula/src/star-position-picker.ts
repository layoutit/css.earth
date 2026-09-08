import type { SamplePoint, StarSample } from './star-sampling-types';

interface Extent { x: number; y: number; width: number; height: number; }
export function magnifierPoint(x: number, y: number, width: number, height: number, extent: Extent): SamplePoint {
  return { x: Math.max(extent.x, Math.min(extent.x + extent.width - 1, extent.x + x / width * extent.width - .5)),
    y: Math.max(extent.y, Math.min(extent.y + extent.height - 1, extent.y + y / height * extent.height - .5)) };
}
/** Magnifies existing original pixels; selection never invokes fitting or generates imagery. */
export function createStarPositionPicker(host: HTMLElement, onPick: (point: SamplePoint) => void) {
  host.innerHTML = '<img alt="Magnified original image; click the star centre to refine its position" draggable="false" /><span class="star-loupe-crosshair" aria-hidden="true"></span><span class="star-loupe-label"></span>';
  const image = host.querySelector('img')!, crosshair = host.querySelector<HTMLElement>('.star-loupe-crosshair')!, label = host.querySelector<HTMLElement>('.star-loupe-label')!;
  let window: Extent | null = null;
  host.addEventListener('click', event => {
    if (!window) return; event.stopPropagation(); const bounds = host.getBoundingClientRect();
    onPick(magnifierPoint(event.clientX - bounds.left - host.clientLeft, event.clientY - bounds.top - host.clientTop, host.clientWidth, host.clientHeight, window));
  });
  return {
    show(point: SamplePoint | null, overview: { url: string; nativeDimensions: [number, number] }, sample?: StarSample) {
      host.hidden = !point;
      if (!point) { window = null; return; }
      const crop = sample?.cutout;
      const native = Boolean(crop && point.x >= crop.x && point.y >= crop.y && point.x < crop.x + crop.width && point.y < crop.y + crop.height);
      const source: Extent = native ? crop! : { x: 0, y: 0, width: overview.nativeDimensions[0], height: overview.nativeDimensions[1] };
      const span = native ? Math.min(128, source.width, source.height) : Math.min(192, source.width, source.height);
      window = { x: Math.max(source.x, Math.min(source.x + source.width - span, point.x + .5 - span / 2)),
        y: Math.max(source.y, Math.min(source.y + source.height - span, point.y + .5 - span / 2)), width: span, height: span };
      const size = host.clientWidth, scale = size / span;
      image.src = native ? sample!.images.source : overview.url;
      image.style.width = `${source.width * scale}px`; image.style.height = `${source.height * scale}px`;
      image.style.left = `${(source.x - window.x) * scale}px`; image.style.top = `${(source.y - window.y) * scale}px`;
      crosshair.style.left = `${(point.x + .5 - window.x) * scale}px`; crosshair.style.top = `${(point.y + .5 - window.y) * scale}px`;
      label.textContent = native ? 'Native crop' : 'Zoomed preview';
      host.title = native ? 'Original native pixels. Click the star centre, then Add sample.' : 'Magnified original preview. Click to refine the position, then Add sample; the native crop follows.';
      host.dataset.extent = JSON.stringify(window);
    },
  };
}
