import type { OrbitSegment } from './heliocentric-view.js';
export interface Sprite {url?:string;index:number;count:number;size:number;}
export interface SpriteWithUrl extends Sprite {url:string;}
export interface PhaseAtlas {url:string;columns:number;rowCount:number;frameCount:number;minimumLightViewZ:number;maximumLightViewZ:number;baseLightAzimuthDegrees:number;}
export interface SystemMarkers {url:string;sun:Sprite;bodies:Readonly<Record<string,Sprite>>;phase:PhaseAtlas;}
// Writes screen-space segments onto a piece pool: each piece is a unit-width
// bar laid out at the overlay's centre, so the projection's centre-relative
// offsets are the translation as they are and the segment is the bar's x
// axis. Pieces beyond the segment count are hidden.
export function writePieces(pool:readonly HTMLElement[], segments:readonly OrbitSegment[], previousCount:number) {
  const count = Math.min(segments.length, pool.length);
  for (let index = 0; index < count; index += 1) {
    const [x0, y0, x1, y1, weight] = segments[index];
    const dx = x1 - x0;
    const dy = y1 - y0;
    const length = Math.hypot(dx, dy);
    const piece = pool[index];
    piece.style.transform = `matrix(${formatNumber(dx)},${formatNumber(dy)},${
      formatNumber(-dy / length)},${formatNumber(dx / length)},${
      formatNumber(x0)},${formatNumber(y0)})`;
    // The chord's trail weight: the line fades backwards from the body.
    const opacity = formatNumber(weight);
    if (piece.style.opacity !== opacity) piece.style.opacity = opacity;
    if (piece.style.visibility !== "") piece.style.visibility = "";
  }
  for (let index = count; index < previousCount; index += 1) {
    pool[index].style.visibility = "hidden";
  }
  return { count, overflowed: segments.length > pool.length };
}

// The lighting atlas: a grid of frames indexed by the light's view depth,
// lit from `baseLightAzimuthDegrees` at zero roll.
export function validPhaseAtlas(atlas:PhaseAtlas | null | undefined): atlas is PhaseAtlas {
  return typeof atlas?.url === "string" && Number.isSafeInteger(atlas.columns) && atlas.columns > 0 &&
    Number.isSafeInteger(atlas.rowCount) && atlas.rowCount > 0 &&
    Number.isSafeInteger(atlas.frameCount) && atlas.frameCount > 1 &&
    atlas.frameCount <= atlas.columns * atlas.rowCount &&
    Number.isFinite(atlas.minimumLightViewZ) && Number.isFinite(atlas.maximumLightViewZ) &&
    atlas.maximumLightViewZ > atlas.minimumLightViewZ &&
    Number.isFinite(atlas.baseLightAzimuthDegrees);
}

// The same frame choice as the object's own overlay: the light's view depth
// mapped across the atlas's range.
export function phaseFrameFor(atlas:PhaseAtlas, lightViewZ:number) {
  return Math.round(Math.max(0, Math.min(1,
    (lightViewZ - atlas.minimumLightViewZ) / (atlas.maximumLightViewZ - atlas.minimumLightViewZ))) *
    (atlas.frameCount - 1));
}

export function validSprite(sprite:Sprite|null|undefined): sprite is Sprite {
  return sprite != null && Number.isSafeInteger(sprite.index) && sprite.index >= 0 &&
    Number.isSafeInteger(sprite.count) && sprite.count > sprite.index &&
    sprite.size > 0;
}

// The tile at `index` of the atlas strip, the whole tile scaled to `size`
// pixels, centred on the element's layout position.
export function applySprite(element:HTMLElement, sprite:SpriteWithUrl) {
  element.style.width = `${sprite.size}px`;
  element.style.height = `${sprite.size}px`;
  element.style.margin = `${-sprite.size / 2}px 0 0 ${-sprite.size / 2}px`;
  element.style.backgroundImage = `url("${sprite.url}")`;
  element.style.backgroundPosition = `${(sprite.index /
    Math.max(1, sprite.count - 1) * 100).toFixed(4)}% center`;
  element.style.backgroundSize = `${sprite.count * 100}% 100%`;
}

export function formatNumber(value:number) {
  return Math.abs(value) < 1e-9 ? "0" : Number(value.toFixed(6)).toString();
}

export function clamp(value:number, minimum:number, maximum:number) {
  return Math.max(minimum, Math.min(maximum, value));
}
