import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const baselineRoot = resolve(process.argv[2]);
const candidateRoot = resolve(process.argv[3]);
const outputRoot = resolve(process.argv[4]);
await mkdir(outputRoot, { recursive: true });

const comparisons = [];
for (const density of [1, 2]) {
  const name = `dpr${density}-default.png`;
  const [baseline, candidate] = await Promise.all([
    readPng(resolve(baselineRoot, name)),
    readPng(resolve(candidateRoot, name)),
  ]);
  if (baseline.width !== candidate.width || baseline.height !== candidate.height) {
    throw new Error(`Capture dimensions differ for ${name}.`);
  }
  const pixelmatchDiff = new PNG({ width: baseline.width, height: baseline.height });
  const changedPixelCount = pixelmatch(
    baseline.data,
    candidate.data,
    pixelmatchDiff.data,
    baseline.width,
    baseline.height,
    { threshold: 0.1 },
  );
  const absoluteDiff = new PNG({ width: baseline.width, height: baseline.height });
  let absoluteChannelDifference = 0;
  for (let index = 0; index < baseline.data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      const difference = Math.abs(
        baseline.data[index + channel] - candidate.data[index + channel],
      );
      absoluteDiff.data[index + channel] = difference;
      absoluteChannelDifference += difference;
    }
    absoluteDiff.data[index + 3] = 255;
  }
  const pixelmatchPath = resolve(outputRoot, `dpr${density}-pixelmatch.png`);
  const absolutePath = resolve(outputRoot, `dpr${density}-absolute.png`);
  await Promise.all([
    writeFile(pixelmatchPath, PNG.sync.write(pixelmatchDiff)),
    writeFile(absolutePath, PNG.sync.write(absoluteDiff)),
  ]);
  comparisons.push(Object.freeze({
    density,
    width: baseline.width,
    height: baseline.height,
    changedPixelCount,
    changedPixelRatio: Number((
      changedPixelCount / (baseline.width * baseline.height)
    ).toFixed(9)),
    absoluteChannelDifference,
    baseline: resolve(baselineRoot, name),
    candidate: resolve(candidateRoot, name),
    pixelmatch: pixelmatchPath,
    absolute: absolutePath,
  }));
}

const report = Object.freeze({
  schema: "cssmars-encoded-capture-comparison@1",
  createdAt: new Date().toISOString(),
  threshold: 0.1,
  comparisons,
});
await writeFile(resolve(outputRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));

async function readPng(path) {
  return PNG.sync.read(await readFile(path));
}
