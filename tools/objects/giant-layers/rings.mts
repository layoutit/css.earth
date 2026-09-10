import type {RadiusMapping, RadialBand, RadialShadow, RadialVariant, RadialOverlay, AnnularLayer, ObservedRadialLayer, RadialProfile} from './radial-contract.mts';
/** Preparation-only radial fields. Body identities and interpretation live in JSON. */
const clamp = (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value));
const smoothstep = (start: number, end: number, value: number) => {
  const amount = clamp((value - start) / (end - start), 0, 1);
  return amount * amount * (3 - 2 * amount);
};

function interval(value: number, bounds: readonly [number, number], inclusive: readonly boolean[] = [true, true]) {
  return (inclusive[0] ? value >= bounds[0] : value > bounds[0]) &&
    (inclusive[1] ? value <= bounds[1] : value < bounds[1]);
}
function angularDistance(left: number, right: number) {
  const delta = Math.abs(left - right) % (Math.PI * 2);
  return Math.min(delta, Math.PI * 2 - delta);
}

export function mapRadius(value: number, mapping: RadiusMapping, inverse = false) {
  if (mapping.kind === 'linear') return inverse ? value / mapping.scale : value * mapping.scale;
  const column = inverse ? 1 : 0;
  let segment = mapping.knots.length - 2;
  for (let index = 0; index < mapping.knots.length - 1; index++) {
    if (value <= mapping.knots[index + 1][column]) { segment = index; break; }
  }
  const [sourceMinimum, outputMinimum] = mapping.knots[segment];
  const [sourceMaximum, outputMaximum] = mapping.knots[segment + 1];
  if (inverse) {
    const amount = (value - outputMinimum) / (outputMaximum - outputMinimum);
    return Math.exp(Math.log(sourceMinimum) + amount * (Math.log(sourceMaximum) - Math.log(sourceMinimum)));
  }
  const amount = (Math.log(value) - Math.log(sourceMinimum)) / (Math.log(sourceMaximum) - Math.log(sourceMinimum));
  return outputMinimum + amount * (outputMaximum - outputMinimum);
}

/** A ray from a ring plane toward a point/directional light, in physical units. */
export function ringRayOccluded(x: number, y: number, shadow: RadialShadow) {
  const light = shadow.direction;
  const inverseEquatorialSquared = 1 / (shadow.equatorialRadius ** 2);
  const inversePolarSquared = 1 / (shadow.polarRadius ** 2);
  const a = (light[0] ** 2 + light[1] ** 2) * inverseEquatorialSquared + light[2] ** 2 * inversePolarSquared;
  const b = 2 * (x * light[0] + y * light[1]) * inverseEquatorialSquared;
  const c = (x ** 2 + y ** 2) * inverseEquatorialSquared - 1;
  const discriminant = b ** 2 - 4 * a * c;
  if (discriminant <= 0) return false;
  const root = Math.sqrt(discriminant);
  return (-b - root) / (2 * a) > 0 || (-b + root) / (2 * a) > 0;
}

function prepareBand(band: RadialBand, mapping: RadiusMapping, kilometersPerPixel: number) {
  if (band.envelope === 'smooth-annulus') {
    const inner = mapRadius(band.bounds[0], mapping), outer = mapRadius(band.bounds[1], mapping);
    const innerFade = inner - mapRadius(band.bounds[0] - band.fade[0], mapping);
    const outerFade = mapRadius(band.bounds[1] + band.fade[1], mapping) - outer;
    const expandedInner = inner - Math.max(0, (band.minimumPresentationWidth ?? 0) - (outer - inner));
    return { ...band, inner: expandedInner, outer, innerFade, outerFade };
  }
  if (band.envelope === 'tent') return { ...band,
    halfWidth: Math.max(band.width / 2, kilometersPerPixel * (band.minimumHalfWidthPixels ?? 0)) };
  return band;
}

function bandCoverage(radius: number, angle: number, band: ReturnType<typeof prepareBand>) {
  const arcs = band.arcs;
  if (arcs && !arcs.centers.some(center => angularDistance(angle, center) < arcs.halfWidth)) return 0;
  if (band.envelope === 'constant') return interval(radius, band.bounds, band.inclusive) ? 1 : 0;
  if (band.envelope === 'tent') {
    const distance = Math.abs(radius - band.center);
    if (distance > band.halfWidth) return 0;
    return Math.min(1, (1 - distance / band.halfWidth) * band.edgeGain);
  }
  if (radius <= band.inner - band.innerFade || radius >= band.outer + band.outerFade) return 0;
  return smoothstep(band.inner - band.innerFade, band.inner, radius) *
    (1 - smoothstep(band.outer, band.outer + band.outerFade, radius));
}

/** Supports optical-depth composition, narrow observed bands and angular arcs. */
export function rasterAnnularField(recipe: AnnularLayer, size: number) {
  const { grid, mapping } = recipe;
  const center = (size - grid.centerInset) / 2;
  const maximumRadius = center - grid.marginPixels;
  const pixelScale = recipe.outerRadius / maximumRadius;
  const preparedBands = recipe.bands.map(band => prepareBand(band, mapping,
    mapRadius(recipe.outerRadius, mapping, true) / maximumRadius));
  const data = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x + grid.sampleOffset - center, dy = y + grid.sampleOffset - center;
      // Preserve the authored multiplication order at source/pixel boundaries.
      const radius = grid.scaleOrder === 'divide-multiply'
        ? Math.hypot(dx, dy) / maximumRadius * recipe.outerRadius
        : Math.hypot(dx * pixelScale, dy * pixelScale);
      const angle = grid.scaleOrder === 'divide-multiply' ? Math.atan2(dy, dx) : Math.atan2(dy * pixelScale, dx * pixelScale);
      let alpha = 0;
      let color: readonly number[] = recipe.defaultColor ?? [0, 0, 0];
      const premultiplied = [0, 0, 0];
      for (const band of preparedBands) {
        const coverage = bandCoverage(radius, angle, band);
        if (coverage === 0) continue;
        const bandAlpha = Math.min(recipe.alphaUnits, band.opacity * coverage);
        if (recipe.composition === 'front-to-back') {
          const contribution = bandAlpha * (1 - alpha);
          for (let channel = 0; channel < 3; channel++) premultiplied[channel] += band.color[channel] * contribution;
          alpha += contribution;
        } else {
          alpha = Math.max(alpha, bandAlpha);
          color = band.color;
        }
      }
      if (alpha <= 0) continue;
      if (recipe.composition === 'front-to-back') {
        if (recipe.shadow) {
          const sourceRadius = mapRadius(radius, mapping, true);
          if (ringRayOccluded(sourceRadius * Math.cos(angle), sourceRadius * Math.sin(angle), recipe.shadow)) {
            for (let channel = 0; channel < 3; channel++) premultiplied[channel] *= recipe.shadow.luminance;
          }
        }
        color = premultiplied.map(channel => Math.round(channel / alpha));
      }
      const offset = (y * size + x) * 4;
      for (let channel = 0; channel < 3; channel++) data[offset + channel] = color[channel];
      data[offset + 3] = recipe.alphaUnits === 1
        ? Math.round(Math.min(1, alpha) * 255)
        : clamp(Math.round(alpha), 0, recipe.maximumAlpha);
    }
  }
  return data;
}

export function applyLinearTint(channel: number, factor: number) {
  const encoded = channel / 255;
  const linear = encoded <= 0.04045 ? encoded / 12.92 : ((encoded + 0.055) / 1.055) ** 2.4;
  const tinted = Math.max(0, Math.min(1, linear * factor));
  const output = tinted <= 0.0031308 ? tinted * 12.92 : 1.055 * tinted ** (1 / 2.4) - 0.055;
  return Math.max(0, Math.min(255, Math.round(output * 255)));
}

/** Sample a pinned one-dimensional observed color/transparency profile. */
export function sampleRadialProfile(radius: number, recipe: ObservedRadialLayer, inputs: RadialProfile) {
  if (!interval(radius, recipe.bounds)) return [0, 0, 0, 0];
  const { color, transparency, width } = inputs;
  let sample: number[];
  if (radius < recipe.sourceBounds[0]) {
    const band = recipe.interior;
    const peak = Math.max(...band.centers.map(center => Math.exp(-Math.pow((radius - center) / band.sigma, 2))));
    sample = [...band.color, Math.round(255 * (band.baseAlpha + peak * band.peakAlpha))];
  } else {
    const amount = (radius - recipe.sourceBounds[0]) / (recipe.sourceBounds[1] - recipe.sourceBounds[0]);
    const index = Math.max(0, Math.min(width - 1, Math.round(amount * (width - 1))));
    const offset = index * 3;
    const alpha = (transparency[offset] + transparency[offset + 1] + transparency[offset + 2]) / 3;
    sample = [color[offset], color[offset + 1], color[offset + 2], Math.max(0, Math.min(255, Math.round(255 - alpha)))];
    for (const operation of recipe.operations) {
      if (!interval(radius, operation.bounds, operation.inclusive)) continue;
      if (operation.kind === 'alpha-cap') sample[3] = Math.min(sample[3], operation.maximum);
      else if (operation.kind === 'clear') sample[3] = 0;
      else if (operation.kind === 'edge-core') {
        const offset = (width - 1) * 3;
        const core = Math.exp(-Math.pow((radius - operation.center) / operation.sigma, 2));
        const opticalDepth = operation.baseDepth + operation.peakDepth * core;
        sample[0] = color[offset]; sample[1] = color[offset + 1]; sample[2] = color[offset + 2];
        sample[3] = Math.max(sample[3], Math.round(255 * (1 - Math.exp(-opticalDepth))));
      } else if (operation.kind === 'alpha-gain') {
        sample[3] = Math.round((1 - Math.pow(1 - sample[3] / 255, operation.gain)) * 255);
      }
    }
  }
  return sample.map((value, index) => index < 3 ? applyLinearTint(value, recipe.channelFactors[index]) : value);
}

/** Pixel readability is authored separately from the physical source profile. */
export function prepareRadialReadability(recipe: ObservedRadialLayer, size: number, minimumPixels: number, inputs: RadialProfile) {
  const samples = new Map<number, number[]>(), outerPixels = (size - 1) / 2;
  for (const feature of recipe.readability.features) {
    const pixels = minimumPixels + (feature.additionalPixels ?? 0);
    const centerPixel = Math.round(feature.radius / recipe.bounds[1] * outerPixels);
    const source = sampleRadialProfile(feature.radius, recipe, inputs);
    const sample = feature.kind === 'bright-hairline'
      ? [...source.slice(0, 3), Math.round((1 - Math.pow(1 - source[3] / 255,
        feature.alphaGain ?? recipe.readability.alphaGain)) * 255 * (feature.alphaScale ?? 1))] : source;
    const firstOffset = -Math.floor((pixels - 1) / 2);
    for (let index = 0; index < pixels; index++) samples.set(centerPixel + firstOffset + index, sample);
  }
  return samples;
}

export function rasterObservedRadialField(recipe: ObservedRadialLayer, size: number, minimumPixels: number, inputs: RadialProfile) {
  const samples = prepareRadialReadability(recipe, size, minimumPixels, inputs);
  const output = Buffer.alloc(size * size * 4), center = (size - 1) / 2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const radius = Math.hypot(x - center, y - center) / center;
    if (radius > 1) continue;
    const sample = samples.get(Math.round(radius * center)) ?? sampleRadialProfile(radius * recipe.bounds[1], recipe, inputs);
    const offset = (y * size + x) * 4;
    for (let channel = 0; channel < 4; channel++) output[offset + channel] = sample[channel];
  }
  return output;
}

/** A source-qualified spectral presentation over the prepared radial morphology. */
export function colorizeRadialField(source: Uint8Array, width: number, height: number, recipe: RadialVariant) {
  const output = Buffer.alloc(source.length), center = (width - 1) / 2;
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const offset = (y * width + x) * 4, alpha = source[offset + 3];
    output[offset + 3] = alpha;
    if (alpha === 0) continue;
    const radius = Math.hypot(x - center, y - center) / center * recipe.outerRadius;
    const bandGain = recipe.radialGains.find(band => radius < band.upperBound)?.gain ?? recipe.outerGain;
    const luminance = (source[offset] * recipe.luminance[0] + source[offset + 1] * recipe.luminance[1] +
      source[offset + 2] * recipe.luminance[2]) / 255;
    const intensity = clamp(Math.pow(luminance, recipe.exponent) * bandGain * recipe.gain, 0, 1);
    const segment = intensity < 0.5 ? 0 : 1;
    const mix = intensity < 0.5 ? intensity * 2 : (intensity - 0.5) * 2;
    for (let channel = 0; channel < 3; channel++) output[offset + channel] = Math.round(recipe.palette[segment][channel] +
      (recipe.palette[segment + 1][channel] - recipe.palette[segment][channel]) * mix);
  }
  return output;
}
/** Declared projected-strip attenuation on an existing scientific radial field. */
export function rasterProjectedStripShadow(data: Uint8Array,size: number,config: RadialOverlay) {
  const output=Buffer.alloc(size*size*4),center=(size-config.centerInset)/2,maximumRadius=center-config.marginPixels;
  const radius=config.bodyRadius/config.outerRadius*maximumRadius,length=Math.hypot(...config.direction)||1,direction=config.direction.map(value=>value/length),perpendicular=[-direction[1],direction[0]];
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const offset=(y*size+x)*4,alpha=data[offset+3]/255;if(alpha<=0)continue;
    const dx=x-center,dy=y-center,along=dx*direction[0]+dy*direction[1],across=Math.abs(dx*perpendicular[0]+dy*perpendicular[1]);
    if(along<=radius*config.startFraction||across>=radius)continue;
    const edge=Math.max(0,Math.min(1,(radius-across)/Math.max(1,size*config.edgeFraction)));
    output.set(config.color,offset);output[offset+3]=Math.max(0,Math.min(config.maximumAlpha,Math.round(alpha*edge*config.maximumAlpha)));
  }
  return output;
}
