const mix = (start: number, end: number, amount: number) => start + (end - start) * amount;

export function writeMaterialAtlasTile({
  output,
  outputWidth,
  source,
  sourceSize,
  frameX,
  frameY,
  gutter,
}: {output: Buffer; outputWidth: number; source: Buffer; sourceSize: number; frameX: number; frameY: number; gutter: number}) {
  for (let row = 0; row < sourceSize; row += 1) {
    const sourceStart = row * sourceSize * 4;
    const targetStart = ((frameY + row) * outputWidth + frameX) * 4;
    source.copy(
      output,
      targetStart,
      sourceStart,
      sourceStart + sourceSize * 4,
    );
    for (let amount = 1; amount <= gutter; amount += 1) {
      output.copy(
        output,
        targetStart - amount * 4,
        targetStart,
        targetStart + 4,
      );
      const sourceEnd = targetStart + (sourceSize - 1) * 4;
      output.copy(
        output,
        sourceEnd + amount * 4,
        sourceEnd,
        sourceEnd + 4,
      );
    }
  }
  const rowBytes = (sourceSize + gutter * 2) * 4;
  const firstRowStart = (
    frameY * outputWidth + frameX - gutter
  ) * 4;
  const lastRowStart = firstRowStart +
    (sourceSize - 1) * outputWidth * 4;
  for (let amount = 1; amount <= gutter; amount += 1) {
    output.copy(
      output,
      firstRowStart - amount * outputWidth * 4,
      firstRowStart,
      firstRowStart + rowBytes,
    );
    output.copy(
      output,
      lastRowStart + amount * outputWidth * 4,
      lastRowStart,
      lastRowStart + rowBytes,
    );
  }
}

export function sampleRgbaBilinear(data: Uint8Array, size: number, x: number, y: number) {
  const x0 = Math.max(0, Math.min(size - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(size - 1, Math.floor(y)));
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const amountX = x - x0;
  const amountY = y - y0;
  return Array.from({ length: 4 }, (_, channel) => {
    const sample = (sampleX: number, sampleY: number) =>
      data[(sampleY * size + sampleX) * 4 + channel];
    return mix(
      mix(sample(x0, y0), sample(x1, y0), amountX),
      mix(sample(x0, y1), sample(x1, y1), amountX),
      amountY,
    );
  });
}

export function sampleAlphaBilinear(data: Uint8Array, size: number, x: number, y: number) {
  const x0 = Math.max(0, Math.min(size - 1, Math.floor(x)));
  const y0 = Math.max(0, Math.min(size - 1, Math.floor(y)));
  const x1 = Math.min(size - 1, x0 + 1);
  const y1 = Math.min(size - 1, y0 + 1);
  const amountX = x - x0;
  const amountY = y - y0;
  const alpha00 = data[(y0 * size + x0) * 4 + 3] / 255;
  const alpha10 = data[(y0 * size + x1) * 4 + 3] / 255;
  const alpha01 = data[(y1 * size + x0) * 4 + 3] / 255;
  const alpha11 = data[(y1 * size + x1) * 4 + 3] / 255;
  return mix(
    mix(alpha00, alpha10, amountX),
    mix(alpha01, alpha11, amountX),
    amountY,
  );
}
