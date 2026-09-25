import {gunzipSync,gzipSync} from 'node:zlib';
type Vec3=[number,number,number];
export function copyDensityWindow(source:Buffer, options:{dimensions:Vec3;boundsMin:Vec3;boundsMax:Vec3;cellMin:Vec3;cellMax:Vec3;translation:Vec3;level:number}) {
 const {dimensions,boundsMin,boundsMax,cellMin,cellMax,translation,level}=options;
  const outputDimensions = dimensions.map((_, axis) => cellMax[axis]! - cellMin[axis]!) as Vec3;
  const [sourceWidth, sourceHeight] = dimensions;
  const [outputWidth, outputHeight, outputDepth] = outputDimensions;
  const raw = Buffer.alloc(outputWidth * outputHeight * outputDepth * 4);
  for (let z = 0; z < outputDepth; z++) for (let y = 0; y < outputHeight; y++) {
    const sourceIndex = ((z + cellMin[2]) * sourceHeight + y + cellMin[1]) * sourceWidth + cellMin[0];
    const outputIndex = (z * outputHeight + y) * outputWidth;
    source.copy(raw, outputIndex * 4, sourceIndex * 4, (sourceIndex + outputWidth) * 4);
  }

  let minimum = Number.POSITIVE_INFINITY, maximum = Number.NEGATIVE_INFINITY, sum = 0, nonzero = 0;
  for (let index = 0; index < raw.length / 4; index++) {
    const value = raw.readFloatLE(index * 4);
    if (!Number.isFinite(value) || value < 0) throw new Error(`Density cell ${index} is not finite and nonnegative.`);
    minimum = Math.min(minimum, value); maximum = Math.max(maximum, value); sum += value;
    if (value !== 0) nonzero++;
  }
  const cellSizeKpc = dimensions.map((value, axis) => (boundsMax[axis]! - boundsMin[axis]!) / value) as Vec3;
  const sourceWindowBoundsKpc = {
    min: boundsMin.map((value, axis) => value + cellMin[axis]! * cellSizeKpc[axis]!) as Vec3,
    max: boundsMin.map((value, axis) => value + cellMax[axis]! * cellSizeKpc[axis]!) as Vec3,
  };
  const translatedBoundsKpc = {
    min: sourceWindowBoundsKpc.min.map((value, axis) => value - translation[axis]!) as Vec3,
    max: sourceWindowBoundsKpc.max.map((value, axis) => value - translation[axis]!) as Vec3,
  };
  const encoded = gzipSync(raw, { level: level });
  const decoded = gunzipSync(encoded);
  if (!decoded.equals(raw)) throw new Error('Gzip round-trip changed the copied density bytes.');

  const sampleCells = [
    [0, 0, 0],
    [outputWidth - 1, 0, 0],
    [Math.floor(outputWidth / 2), Math.floor(outputHeight / 2), Math.floor(outputDepth / 2)],
    [0, outputHeight - 1, Math.floor(outputDepth / 2)],
    [outputWidth - 1, outputHeight - 1, outputDepth - 1],
  ] as Vec3[];
  const sampleValidation = sampleCells.map(outputCell => {
    const sourceCell = outputCell.map((value, axis) => value + cellMin[axis]!) as Vec3;
    const sourceIndex = (sourceCell[2] * sourceHeight + sourceCell[1]) * sourceWidth + sourceCell[0];
    const outputIndex = (outputCell[2] * outputHeight + outputCell[1]) * outputWidth + outputCell[0];
    const sourceBytes = source.subarray(sourceIndex * 4, sourceIndex * 4 + 4);
    const outputBytes = raw.subarray(outputIndex * 4, outputIndex * 4 + 4);
    if (!sourceBytes.equals(outputBytes)) throw new Error(`Copied sample differs at output cell ${outputCell.join(',')}.`);
    return { sourceCell, outputCell, value: raw.readFloatLE(outputIndex * 4), rawLittleEndianHex: outputBytes.toString('hex') };
  });

 return {outputDimensions,raw,encoded,cellSizeKpc,sourceWindowBoundsKpc,translatedBoundsKpc,sampleValidation,minimum,maximum,sum,nonzero};
}
