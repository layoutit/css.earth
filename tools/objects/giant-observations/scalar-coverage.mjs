export function completeScalarCoverage(source,config) {
  if(!Number.isSafeInteger(source.width)||source.width<1||!Number.isSafeInteger(source.height)||source.height<2||source.values.length!==source.width*source.height||!Number.isFinite(config.lookbackDegrees)||config.lookbackDegrees<0||!Number.isFinite(config.convergenceExponent)||config.convergenceExponent<=0||!Number.isSafeInteger(config.edgeTransitionRows)||config.edgeTransitionRows<2||config.edgeTransitionRows>source.height)throw new TypeError('Invalid scalar continuation input.');
  const values = new Float32Array(source.values);
  const rowValid = new Uint8Array(source.height);
  for (let row = 0; row < source.height; row += 1) {
    let validCount = 0;
    for (let column = 0; column < source.width; column += 1) {
      const value = values[row * source.width + column];
      if (Number.isFinite(value) && value > 0) validCount += 1;
    }
    rowValid[row] = Number(validCount === source.width);
  }
  let first = 0;
  while (first < source.height && !rowValid[first]) first += 1;
  let last = source.height - 1;
  while (last >= 0 && !rowValid[last]) last -= 1;
  if (first >= last) throw new Error("Scalar map lost global coverage.");
  for (let row = first; row <= last; row += 1) {
    const validColumns = [];
    for (let column = 0; column < source.width; column += 1) {
      const index = row * source.width + column;
      if (Number.isFinite(values[index]) && values[index] > 0) {
        validColumns.push(column);
      }
    }
    if (validColumns.length === 0) continue;
    for (let validIndex = 0;
      validIndex < validColumns.length;
      validIndex += 1) {
      const left = validColumns[validIndex];
      const right = validColumns[(validIndex + 1) % validColumns.length];
      const span = (right - left + source.width) % source.width;
      if (span <= 1) continue;
      const leftValue = values[row * source.width + left];
      const rightValue = values[row * source.width + right];
      for (let offset = 1; offset < span; offset += 1) {
        const amount = offset / span;
        const column = (left + offset) % source.width;
        values[row * source.width + column] =
          leftValue * (1 - amount) + rightValue * amount;
      }
    }
  }
  convergePolarCoverage(values, source.width, source.height, first, true,config);
  convergePolarCoverage(values, source.width, source.height, last, false,config);
  return Object.freeze({
    width: source.width,
    height: source.height,
    values,
    firstMeasuredRow: first,
    lastMeasuredRow: last,
  });
}

function convergePolarCoverage(values, width, height, measuredRow, north,config) {
  const poleRow = north ? 0 : height - 1;
  const distance = Math.abs(measuredRow - poleRow);
  const inwardDirection = north ? 1 : -1;
  const lookbackRows = Math.max(1, Math.round(height * config.lookbackDegrees / 180));
  const longitudeBand = new Float64Array(width);
  let bandRows = 0;
  for (let offset = 0; offset <= lookbackRows; offset += 1) {
    const row = measuredRow + offset * inwardDirection;
    if (row < 0 || row >= height) continue;
    for (let column = 0; column < width; column += 1) {
      longitudeBand[column] += values[row * width + column];
    }
    bandRows += 1;
  }
  for (let column = 0; column < width; column += 1) {
    longitudeBand[column] /= bandRows;
  }
  const prefix = new Float64Array(width * 2 + 1);
  for (let index = 0; index < width * 2; index += 1) {
    prefix[index + 1] = prefix[index] + longitudeBand[index % width];
  }
  const start = north ? 0 : measuredRow + 1;
  const end = north ? measuredRow : height;
  for (let row = start; row < end; row += 1) {
    const normalized = distance === 0
      ? 1
      : Math.abs(row - poleRow) / distance;
    const windowRadius = Math.min(
      Math.floor((width - 1) / 2),
      Math.round((1 - normalized ** config.convergenceExponent) * (width - 1) / 2),
    );
    for (let column = 0; column < width; column += 1) {
      let sampleStart = column - windowRadius;
      while (sampleStart < 0) sampleStart += width;
      const sampleEnd = sampleStart + windowRadius * 2 + 1;
      values[row * width + column] =
        (prefix[sampleEnd] - prefix[sampleStart]) /
        (sampleEnd - sampleStart);
    }
  }
  const edgeTransitionRows = config.edgeTransitionRows;
  for (let offset = 0; offset < edgeTransitionRows; offset += 1) {
    const row = measuredRow + offset * inwardDirection;
    const measuredWeight = smootherStep(offset / (edgeTransitionRows - 1));
    for (let column = 0; column < width; column += 1) {
      const index = row * width + column;
      values[index] = longitudeBand[column] * (1 - measuredWeight) +
        values[index] * measuredWeight;
    }
  }

  function smootherStep(value) {
    const amount = Math.max(0, Math.min(1, value));
    return amount * amount * amount * (amount * (amount * 6 - 15) + 10);
  }
}

export function finitePercentiles(values, lower, upper,minimumCoverageFraction) {
  if(!(lower>=0&&lower<upper&&upper<=1&&minimumCoverageFraction>0&&minimumCoverageFraction<=1))throw new TypeError('Invalid scalar percentile bounds.');
  const finite = [...values].filter((value) => Number.isFinite(value) && value > 0)
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
