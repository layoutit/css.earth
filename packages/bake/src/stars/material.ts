import sharp from 'sharp';
import { createExposure, exposureLimits, POINT_MIN_RADIUS_PX, starPresentation } from '@cssearth/engine';
import type { PreparedCssPointFieldManifest as PreparedCssPointField, Rgb, StarsRecipe } from './types.ts';

function smoothstep(min: number, max: number, value: number) { const t = Math.max(0,Math.min(1,(value-min)/(max-min))); return t*t*(3-2*t); }
/** Offline integration of Galaxio's settled (zero-motion) compact core/halo PSF; ordinary PNG alpha. */
export async function preparePointAtlas(colors: readonly Rgb[], config: StarsRecipe['atlas']): Promise<Buffer> {
  const size = config.tileSize, width = size*colors.length, rgba = Buffer.alloc(width*size*4), n = config.samplesPerPixelAxis;
  for (let tile = 0; tile < colors.length; tile++) for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let alpha = 0;
    for (let sy = 0; sy < n; sy++) for (let sx = 0; sx < n; sx++) {
      const dx = ((x+(sx+.5)/n)/size*2-1), dy = ((y+(sy+.5)/n)/size*2-1), d = Math.hypot(dx,dy);
      const core = 1-smoothstep(config.coreInnerRadii/config.haloRadii,config.coreOuterRadii/config.haloRadii,d);
      const halo = (1-smoothstep(0,1,d))*config.haloPeak;
      alpha += Math.min(1,core+halo);
    }
    const offset = (y*width+tile*size+x)*4, color = colors[tile]!;
    rgba[offset]=color[0]; rgba[offset+1]=color[1]; rgba[offset+2]=color[2]; rgba[offset+3]=Math.round(alpha/(n*n)*255);
  }
  return sharp(rgba,{ raw: { width,height:size,channels:4 } }).png({ compressionLevel:9,adaptiveFiltering:false }).toBuffer();
}
export function preparePointPhotometry(config: StarsRecipe['photometry']): PreparedCssPointField['photometry'] {
  const exposure = createExposure({ fovDegrees:config.fovDegrees,screenFactor:config.screenFactor });
  const count = Math.round((config.maximumMagnitude-config.minimumMagnitude)/config.step)+1;
  const samples = Array.from({length:count},(_,i) => {
    const presentation = starPresentation(exposure,config.minimumMagnitude+i*config.step);
    // Publish display samples to 1e-12; native pow/log tails differ between V8
    // versions and carry no visible precision at this pixel/opacity scale.
    const sample = (value: number) => Number(value.toFixed(12));
    return { radiusPx: sample(presentation?.radiusPx ?? 0), luminance: sample(Math.min(1, Math.max(0, presentation?.luminance ?? 0))) };
  });
  const limits = exposureLimits(exposure);
  return { minimumMagnitude:config.minimumMagnitude,maximumMagnitude:config.maximumMagnitude,step:config.step,floor:config.floor,limitingMagnitude:limits.limitingMagnitude,hintsLimitMagnitude:limits.hintsLimitMagnitude,minimumRadiusPx:POINT_MIN_RADIUS_PX,samples };
}
