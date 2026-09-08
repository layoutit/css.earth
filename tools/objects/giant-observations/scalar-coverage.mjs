import { polarZeroCoverage } from '../observed-coverage.mjs';

/** Preserve measured values and mark only non-finite or polar-connected zero fill. */
export function measureScalarCoverage(source, config) {
  if (!Number.isSafeInteger(source.width) || source.width < 1 || !Number.isSafeInteger(source.height) || source.height < 2 || source.values.length !== source.width * source.height || config.noData !== 0 || config.coverage !== 'polar-connected-zero') throw new TypeError('Invalid measured scalar coverage.');
  const candidates = Uint8Array.from(source.values, value => value === 0 || !Number.isFinite(value) ? 0 : 255);
  const missing = polarZeroCoverage(candidates, {width:source.width,height:source.height,channels:1});
  let first=source.height,last=-1,sourceMissingPixels=0;
  for(let i=0;i<source.values.length;i++) {
    if(!Number.isFinite(source.values[i]))missing[i]=1;
    if(missing[i])sourceMissingPixels++;
    else {const row=Math.floor(i/source.width);first=Math.min(first,row);last=Math.max(last,row);}
  }
  if(first>last)throw new Error('Scalar map has no measured coverage.');
  return {...source,missing,sourceMissingPixels,firstMeasuredRow:first,lastMeasuredRow:last};
}

export function finitePercentiles(values, lower, upper,minimumCoverageFraction, missing) {
  if(!(lower>=0&&lower<upper&&upper<=1&&minimumCoverageFraction>0&&minimumCoverageFraction<=1))throw new TypeError('Invalid scalar percentile bounds.');
  const finite = [...values].filter((value, index) => Number.isFinite(value) && !missing?.[index])
    .sort((left, right) => left - right);
  if (finite.length < values.length * minimumCoverageFraction) throw new Error("Scalar map coverage is incomplete.");
  return [
    finite[Math.floor((finite.length - 1) * lower)],
    finite[Math.floor((finite.length - 1) * upper)],
  ];
}

export function falseColorMap(source, palette, minimum, maximum) {
  const output = Buffer.alloc(source.width * source.height * 4);
  for (let index = 0; index < source.values.length; index += 1) {
    if(source.missing?.[index]) continue;
    const amount = Math.max(0, Math.min(1,
      (source.values[index] - minimum) / (maximum - minimum)));
    const color = samplePalette(palette, Math.sqrt(amount));
    const offset = index * 4;
    output[offset] = color[0];
    output[offset + 1] = color[1];
    output[offset + 2] = color[2];
    output[offset + 3] = 255;
  }
  return output;
}

function samplePalette(palette, amount) {
  const scaled = amount * (palette.length - 1);
  const index = Math.min(palette.length - 2, Math.floor(scaled));
  const local = scaled - index;
  return [0, 1, 2].map((channel) => Math.round(
    palette[index][channel] * (1 - local) + palette[index + 1][channel] * local,
  ));
}
