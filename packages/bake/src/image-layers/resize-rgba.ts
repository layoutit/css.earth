/**
 * Independent implementation of the libvips 8.18.3 Lanczos3 uchar method.
 * See docs/galaxies/README.md#reproduction-and-evidence for method references.
 */
interface RgbaRaster { readonly data: Uint8Array; readonly width: number; readonly height: number }
interface Sample { readonly index: number; readonly coefficients: Int16Array }
type Axis = 0 | 1;

const clipByte = (value: number): number => Math.max(0, Math.min(255, value));
const nearestEven = (value: number): number => {
  const lower = Math.floor(value);
  return value - lower === .5 ? lower + lower % 2 : Math.round(value);
};

/** Keep coordinate cancellation independent of native floating-point contraction. */
function multiplyAdd(a: number, b: number, c: number): number {
  const product = a * b;
  const splitter = 134217729; // 2^27 + 1 splits a binary64 significand.
  const splitA = splitter * a, splitB = splitter * b;
  const highA = splitA - (splitA - a), lowA = a - highA;
  const highB = splitB - (splitB - b), lowB = b - highB;
  const productError = ((highA * highB - product) + highA * lowB + lowA * highB) + lowA * lowB;
  const sum = product + c, added = sum - product;
  const sumError = (product - (sum - added)) + (c - added);
  return sum + (productError + sumError);
}

function sinc(value: number): number {
  if (value === 0) return 1;
  const radians = Math.PI * value;
  return Math.sin(radians) / radians;
}

function coefficientTable(shrink: number, count: number): readonly Int16Array[] {
  return Array.from({ length: 65 }, (_, phase) => {
    const center = phase / 64 + count / 2 - 1;
    const weights = Array.from({ length: count }, (_, index) => {
      const position = (index - center) / shrink;
      return Math.abs(position) <= 3 ? sinc(position) * sinc(position / 3) : 0;
    });
    const sum = weights.reduce((total, weight) => total + weight, 0);
    return Int16Array.from(weights, weight => Math.trunc(weight / sum * 4096));
  });
}

function shrinkAxis(image: RgbaRaster, factor: number, axis: Axis): RgbaRaster {
  if (factor === 1) return image;
  const { data, width, height } = image;
  const nextWidth = axis === 0 ? Math.ceil(width / factor) : width;
  const nextHeight = axis === 1 ? Math.ceil(height / factor) : height;
  const output = Buffer.alloc(nextWidth * nextHeight * 4);
  const rounding = Math.floor(factor / 2), multiplier = Math.floor(2 ** 24 / factor);
  for (let y = 0; y < nextHeight; y++) for (let x = 0; x < nextWidth; x++) for (let channel = 0; channel < 4; channel++) {
    let sum = rounding;
    for (let sample = 0; sample < factor; sample++) {
      const sourceX = axis === 0 ? Math.min(width - 1, x * factor + sample) : x;
      const sourceY = axis === 1 ? Math.min(height - 1, y * factor + sample) : y;
      sum += data[4 * (sourceY * width + sourceX) + channel]!;
    }
    output[4 * (y * nextWidth + x) + channel] = Math.floor(sum * multiplier / 2 ** 24);
  }
  return { data: output, width: nextWidth, height: nextHeight };
}

function reduceAxis(original: RgbaRaster, shrink: number, axis: Axis): RgbaRaster {
  const sourceSize = axis === 0 ? original.width : original.height;
  const targetSize = Math.round(sourceSize / shrink);
  const integerShrink = Math.max(1, Math.floor(sourceSize / targetSize / 2));
  const extraPixels = multiplyAdd(targetSize, shrink, -sourceSize) / integerShrink;
  const residual = shrink / integerShrink, offset = (1 + extraPixels) / 2 - 1;
  const image = shrinkAxis(original, integerShrink, axis);
  if (residual === 1) return image;

  const count = 2 * nearestEven(3 * residual) + 1;
  const table = coefficientTable(residual, count), border = Math.ceil(count / 2) - 1;
  const { data, width, height } = image;
  const nextWidth = axis === 0 ? targetSize : width;
  const nextHeight = axis === 1 ? targetSize : height;
  const output = Buffer.alloc(nextWidth * nextHeight * 4);
  const samples: Sample[] = [];
  // Fixed spans preserve the accepted coordinate evaluation order without using
  // native worker tiles. Advancing a whole row from zero changes boundary phases.
  for (let start = 0; start < targetSize; start += 128) {
    let position = multiplyAdd(start + .5, residual, -.5) - offset;
    for (let destination = start; destination < Math.min(targetSize, start + 128); destination++, position += residual) {
      const phase = ((Math.trunc(position * 128) & 127) + 1) >> 1;
      samples[destination] = { index: Math.trunc(position) - border, coefficients: table[phase]! };
    }
  }
  for (let y = 0; y < nextHeight; y++) for (let x = 0; x < nextWidth; x++) {
    const { index, coefficients } = samples[axis === 0 ? x : y]!;
    for (let channel = 0; channel < 4; channel++) {
      let sum = 2048;
      for (let sample = 0; sample < count; sample++) {
        const sourceX = axis === 0 ? Math.max(0, Math.min(width - 1, index + sample)) : x;
        const sourceY = axis === 1 ? Math.max(0, Math.min(height - 1, index + sample)) : y;
        sum += data[4 * (sourceY * width + sourceX) + channel]! * coefficients[sample]!;
      }
      output[4 * (y * nextWidth + x) + channel] = clipByte(Math.floor(sum / 4096));
    }
  }
  return { data: output, width: nextWidth, height: nextHeight };
}

/** Downsample straight-alpha RGBA with Lanczos3 and a centered cover crop. */
export function resizeRgbaLanczos3(rgba: Uint8Array, width: number, height: number, targetWidth: number, targetHeight: number): Buffer {
  if ([width, height, targetWidth, targetHeight].some(value => !Number.isSafeInteger(value) || value < 1)) {
    throw new TypeError('RGBA resize dimensions must be positive integers.');
  }
  if (!Number.isSafeInteger(width * height * 4) || rgba.length !== width * height * 4) {
    throw new TypeError('RGBA resize dimensions disagree with the input bytes.');
  }
  if (targetWidth > width || targetHeight > height) throw new TypeError('RGBA resize supports downsampling only.');
  if (width === targetWidth && height === targetHeight) return Buffer.from(rgba);

  const scale = Math.min(width / targetWidth, height / targetHeight), shrink = 1 / (1 / scale);
  const premultiplied = Buffer.from(rgba);
  for (let pixel = 0; pixel < width * height; pixel++) {
    const index = 4 * pixel, alpha = Math.fround(rgba[index + 3]! / 255);
    for (let channel = 0; channel < 3; channel++) {
      premultiplied[index + channel] = clipByte(Math.trunc(Math.fround(rgba[index + channel]! * alpha)));
    }
  }
  let image: RgbaRaster = { data: premultiplied, width, height };
  image = reduceAxis(image, shrink, 1);
  image = reduceAxis(image, shrink, 0);
  const straight = Buffer.from(image.data);
  for (let pixel = 0; pixel < image.width * image.height; pixel++) {
    const index = 4 * pixel, alpha = straight[index + 3]!;
    const factor = alpha === 0 ? 0 : Math.fround(255 / alpha);
    for (let channel = 0; channel < 3; channel++) {
      straight[index + channel] = clipByte(Math.trunc(Math.fround(straight[index + channel]! * factor)));
    }
  }
  const output = Buffer.alloc(targetWidth * targetHeight * 4);
  const left = Math.ceil((image.width - targetWidth) / 2), top = Math.ceil((image.height - targetHeight) / 2);
  for (let y = 0; y < targetHeight; y++) {
    straight.copy(output, y * targetWidth * 4, ((y + top) * image.width + left) * 4, ((y + top) * image.width + left + targetWidth) * 4);
  }
  return output;
}
