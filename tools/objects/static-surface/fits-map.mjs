/** FITS observation decoding and data-defined latitude/longitude/color mapping. */
export function readFitsPrimary(bytes) {
  let endCard = -1;
  const header = {};
  for (let offset = 0; offset + 80 <= bytes.length; offset += 80) {
    const card = bytes.toString('ascii', offset, offset + 80), key = card.slice(0, 8).trim();
    if (key === 'END') { endCard = offset + 80; break; }
    if (card[8] === '=') header[key] = card.slice(10).split('/')[0].trim();
  }
  if (endCard < 0) throw new Error('FITS header has no END card.');
  const bitpix = Number(header.BITPIX), width = Number(header.NAXIS1), height = Number(header.NAXIS2);
  const dataOffset = Math.ceil(endCard / 2880) * 2880, bytesPerValue = Math.abs(bitpix) / 8;
  if (![-32, -64].includes(bitpix) || !Number.isSafeInteger(width) || width < 1 || !Number.isSafeInteger(height) || height < 1 || dataOffset + width * height * bytesPerValue > bytes.length) throw new Error('Unsupported or truncated floating FITS image.');
  const values = new Float64Array(width * height);
  for (let index = 0; index < values.length; index++) values[index] = bitpix === -32
    ? bytes.readFloatBE(dataOffset + index * bytesPerValue) : bytes.readDoubleBE(dataOffset + index * bytesPerValue);
  return { bitpix, width, height, values };
}

export function prepareFitsMap(bytes, width, height, recipe) {
  const fits = readFitsPrimary(bytes);
  if (fits.bitpix !== recipe.bitpix || fits.width !== recipe.width || fits.height !== recipe.height) throw new Error('Pinned synoptic FITS geometry changed.');
  if (!['sine-latitude', 'equirectangular'].includes(recipe.latitude)) throw new TypeError('Unsupported synoptic latitude mapping.');
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const latitude = Math.PI / 2 - (y + 0.5) / height * Math.PI;
    const sourceY = recipe.latitude === 'sine-latitude'
      ? clamp(Math.round((Math.sin(latitude) + 1) / 2 * (fits.height - 1)), 0, fits.height - 1)
      : clamp(Math.round((1 - (y + 0.5) / height) * fits.height), 0, fits.height - 1);
    for (let x = 0; x < width; x++) {
      const fraction = (x + 0.5) / width;
      const sourceX = modulo(Math.round((recipe.reverseLongitude ? 1 - fraction : fraction) * fits.width), fits.width);
      const value = nearestValidValue(fits, sourceX, sourceY, recipe);
      const color = scientificFalseColor(value, recipe.color);
      const offset = (y * width + x) * 4;
      output.set(color, offset); output[offset + 3] = 255;
    }
  }
  return output;
}

export function scientificFalseColor(value, color) {
  if (color.kind === 'signed-asinh') {
    const [negative, neutral, positive] = color.palette;
    if (!Number.isFinite(value)) return neutral;
    const signed = clamp(Math.asinh(value / color.softening) / Math.asinh(color.maximum / color.softening), -1, 1);
    const end = signed < 0 ? negative : positive, amount = Math.abs(signed);
    return neutral.map((channel, index) => Math.round(channel + (end[index] - channel) * amount));
  }
  if (color.kind !== 'positive-log') throw new TypeError('Unsupported scientific color transform.');
  const safe = Number.isFinite(value) && value > 0 ? value : 0;
  const normalized = safe === 0 ? 0 : clamp((Math.log(safe) - Math.log(color.range[0])) / (Math.log(color.range[1]) - Math.log(color.range[0])), 0, 1);
  const scaled = normalized * (color.palette.length - 1), left = Math.min(color.palette.length - 2, Math.floor(scaled)), amount = scaled - left;
  return color.palette[left].map((channel, index) => Math.round(channel + (color.palette[left + 1][index] - channel) * amount));
}

function nearestValidValue(fits, x, y, recipe) {
  const valid = value => Number.isFinite(value) && (!recipe.positiveOnly || value > 0);
  const direct = fits.values[y * fits.width + x];
  if (valid(direct)) return direct;
  for (let distance = 1; distance <= recipe.nearestLatitudeLimit; distance++) {
    for (const candidateY of [y - distance, y + distance]) {
      if (candidateY < 0 || candidateY >= fits.height) continue;
      const candidate = fits.values[candidateY * fits.width + x];
      if (valid(candidate)) return candidate;
    }
  }
  return 0;
}
const modulo = (value, divisor) => ((value % divisor) + divisor) % divisor;
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
