export interface Sprite {url?:string;index:number;count:number;size:number;}
export interface SpriteImage {url:string;index:number;count:number;}
/** `detail` is a larger prepared image of the same marker, drawn from `fromDiameterPixels`. */
export interface SpriteWithUrl extends Sprite {url:string; minimumDiameterPixels?: number;
  detail?: SpriteImage & {fromDiameterPixels:number};}

/** Readable core for an unresolved body that remains a navigation target. */
export const MINIMUM_BODY_MARKER_DIAMETER_PIXELS = 2.4;

// The tile at `index` of the atlas strip, the whole tile scaled to `size`
// pixels, centred on the element's layout position.
export function applySprite(element:HTMLElement, sprite:SpriteWithUrl) {
  element.style.width = `${sprite.size}px`;
  element.style.height = `${sprite.size}px`;
  element.style.margin = `${-sprite.size / 2}px 0 0 ${-sprite.size / 2}px`;
  applySpriteImage(element, sprite);
}

export function applySpriteImage(element:HTMLElement, sprite:SpriteImage) {
  element.style.backgroundImage = `url("${sprite.url}")`;
  element.style.backgroundPosition = `${(sprite.index /
    Math.max(1, sprite.count - 1) * 100).toFixed(4)}% center`;
  element.style.backgroundSize = `${sprite.count * 100}% 100%`;
}
