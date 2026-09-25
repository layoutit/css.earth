/** Offline lens/axis WebP delivery. Geometry and non-slice resources remain unchanged. */
import sharp from 'sharp';
import { createHash } from 'node:crypto';
import { validatePreparedCssVolume } from '../../renderers/css/volume/validation.js';
import type { PreparedCssVolume, PreparedVolumeLeaf, PreparedVolumeLeafStyle } from '../../renderers/css/volume/types.js';

const GUTTER = 2, MAX_SIZE = 8192;
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
interface Rectangle { path: string; width: number; height: number; x: number; y: number }
function pack(rectangles: Rectangle[]) {
  let best: { width: number; height: number; rectangles: Rectangle[] } | undefined;
  const ordered = [...rectangles].sort((a,b) => b.height-a.height || b.width-a.width || a.path.localeCompare(b.path));
  for (let width = 2048; width <= MAX_SIZE; width += 128) {
    let x = 0, y = 0, row = 0, used = 0;
    const placed: Rectangle[] = [];
    for (const rectangle of ordered) {
      const w = rectangle.width + 2*GUTTER, h = rectangle.height + 2*GUTTER;
      if (w > width) { y = MAX_SIZE + 1; break; }
      if (x+w > width) { y += row; x = 0; row = 0; }
      placed.push({...rectangle,x:x+GUTTER,y:y+GUTTER});
      x += w; used = Math.max(used,x); row = Math.max(row,h);
    }
    const height = y+row;
    if (height > MAX_SIZE) continue;
    if (!best || used*height < best.width*best.height) best = {width:used,height,rectangles:placed};
  }
  if (!best) throw new TypeError('Volume axis exceeds the 8192px atlas budget.');
  return best;
}

/** A slice's background once its texture sits at `rectangle` in `atlas`. The leaf keeps its box, so it keeps its own texel
 * density: a slice compiled at TEXELS_PER_CSS_PIXEL samples the atlas at that density too. */
export function atlasLeafStyle(leaf: PreparedVolumeLeaf, atlas: { width: number; height: number }, rectangle: { x: number; y: number }): PreparedVolumeLeafStyle {
  const box = (field: 'width' | 'height') => {
    const value = leaf.style[field], pixels = /^\d+(?:\.\d+)?px$/u.test(value) ? Number(value.slice(0, -2)) : Number.NaN;
    if (!(pixels > 0)) throw new TypeError(`Atlas slice ${leaf.id} needs a positive CSS pixel ${field}, not ${value}.`);
    return pixels;
  };
  const scaleX = box('width') / leaf.widthPx, scaleY = box('height') / leaf.heightPx;
  return {...leaf.style,backgroundSize:`${atlas.width*scaleX}px ${atlas.height*scaleY}px`,
    backgroundPosition:`${-rectangle.x*scaleX}px ${-rectangle.y*scaleY}px`};
}

export async function prepareVolumeAtlases(options: {
  volume: PreparedCssVolume;
  prefix: string;
  readResource: (path: string) => Promise<Uint8Array>;
  writeResource: (path: string, bytes: Uint8Array) => Promise<void>;
}): Promise<PreparedCssVolume> {
  const volume = validatePreparedCssVolume(options.volume);
  if (!/^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(options.prefix)) throw new TypeError('Unsafe volume atlas prefix.');
  const metadata = new Map(volume.resources.map(resource => [resource.path,resource]));
  const removed = new Set<string>(), additions: PreparedCssVolume['resources'][number][] = [];
  const stacks: PreparedCssVolume['stacks'][number][] = [];
  for (const stack of volume.stacks) {
    if (!stack.leaves.length) { stacks.push(stack); continue; }
    const rectangles = new Map<string,Rectangle>();
    for (const leaf of stack.leaves) {
      const resource = metadata.get(leaf.texturePath)!;
      if (leaf.widthPx !== resource.width || leaf.heightPx !== resource.height ||
          leaf.style.backgroundSize !== `${leaf.style.width} ${leaf.style.height}` || leaf.style.backgroundPosition !== '0px 0px') {
        throw new TypeError(`Atlas preparation needs ${stack.axis} slice ${leaf.id} to draw its whole ${resource.width}×${resource.height} texture ` +
          `${leaf.texturePath} across its box; it declares ${leaf.widthPx}×${leaf.heightPx} texels, box ${leaf.style.width} ${leaf.style.height}, ` +
          `background-size ${leaf.style.backgroundSize}, background-position ${leaf.style.backgroundPosition}.`);
      }
      rectangles.set(resource.path,{path:resource.path,width:resource.width,height:resource.height,x:0,y:0});
    }
    const atlas = pack([...rectangles.values()]), raw = Buffer.alloc(atlas.width*atlas.height*4);
    for (const rectangle of atlas.rectangles) {
      const resource = metadata.get(rectangle.path)!, bytes = await options.readResource(rectangle.path);
      if (bytes.byteLength !== resource.bytes || hash(bytes) !== resource.sha256) throw new TypeError(`Atlas source hash mismatch: ${rectangle.path}`);
      const {data,info} = await sharp(bytes).ensureAlpha().raw().toBuffer({resolveWithObject:true});
      if (info.width !== rectangle.width || info.height !== rectangle.height || info.channels !== 4) throw new TypeError('Atlas source dimensions mismatch.');
      for (let y = -GUTTER; y < rectangle.height+GUTTER; y++) {
        const sy = Math.max(0,Math.min(rectangle.height-1,y));
        for (let x = -GUTTER; x < rectangle.width+GUTTER; x++) {
          const sx = Math.max(0,Math.min(rectangle.width-1,x));
          const source = (sy*rectangle.width+sx)*4, target = ((rectangle.y+y)*atlas.width+rectangle.x+x)*4;
          data.copy(raw,target,source,source+4);
        }
      }
      removed.add(rectangle.path);
    }
    // Invisible RGB has no contribution; removing it improves compression without cutting signal.
    for (let i = 0; i < raw.length; i += 4) if (raw[i+3] === 0) raw.fill(0,i,i+3);
    const bytes = await sharp(raw,{raw:{width:atlas.width,height:atlas.height,channels:4}})
      .webp({quality:80,alphaQuality:80,effort:4}).toBuffer();
    const path = `${options.prefix}/${stack.axis}.webp`;
    if (metadata.has(path)) throw new TypeError('Atlas output would overwrite an input resource.');
    await options.writeResource(path,bytes);
    additions.push({path,sha256:hash(bytes),bytes:bytes.length,width:atlas.width,height:atlas.height});
    const placements = new Map(atlas.rectangles.map(rectangle => [rectangle.path,rectangle]));
    stacks.push({...stack,leaves:stack.leaves.map(leaf => {
      return {...leaf,texturePath:path,style:atlasLeafStyle(leaf,atlas,placements.get(leaf.texturePath)!)};
    })});
  }
  return validatePreparedCssVolume({...volume,stacks,resources:[...volume.resources.filter(resource => !removed.has(resource.path)),...additions]});
}
