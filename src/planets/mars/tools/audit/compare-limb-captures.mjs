import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const baselineRoot = resolve(process.argv[2]);
const candidateRoot = resolve(process.argv[3]);
const outputRoot = resolve(process.argv[4]);
await mkdir(outputRoot, { recursive: true });

const comparisons = [];
for (const density of [1, 2]) {
  for (const pitch of [0, 18, 65]) {
    const name = `dpr${density}-pitch-${pitch}-composite.png`;
    const baselinePath = resolve(baselineRoot, name);
    const candidatePath = resolve(candidateRoot, name);
    const [baseline, candidate] = await Promise.all([
      readPng(baselinePath),
      readPng(candidatePath),
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
      for (let channel = 0; channel < 4; channel += 1) {
        const difference = Math.abs(
          baseline.data[index + channel] - candidate.data[index + channel],
        );
        absoluteDiff.data[index + channel] = difference;
        absoluteChannelDifference += difference;
      }
      absoluteDiff.data[index + 3] = 255;
    }
    const pixelmatchPath = resolve(outputRoot, name.replace(
      "-composite.png",
      "-pixelmatch.png",
    ));
    const absolutePath = resolve(outputRoot, name.replace(
      "-composite.png",
      "-absolute.png",
    ));
    await Promise.all([
      writeFile(pixelmatchPath, PNG.sync.write(pixelmatchDiff)),
      writeFile(absolutePath, PNG.sync.write(absoluteDiff)),
    ]);
    comparisons.push(Object.freeze({
      density,
      pitch,
      baselinePath,
      candidatePath,
      pixelmatchPath,
      absolutePath,
      width: baseline.width,
      height: baseline.height,
      changedPixelCount,
      changedPixelRatio: Number((
        changedPixelCount / (baseline.width * baseline.height)
      ).toFixed(9)),
      absoluteChannelDifference,
    }));
  }
}

const report = Object.freeze({
  schema: "cssmars-limb-capture-comparison@1",
  createdAt: new Date().toISOString(),
  baselineRoot,
  candidateRoot,
  threshold: 0.1,
  comparisons,
});
await writeFile(resolve(outputRoot, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({
  outputRoot,
  comparisons: comparisons.map(({ density, pitch, changedPixelCount,
    changedPixelRatio, absolutePath }) => ({
    density,
    pitch,
    changedPixelCount,
    changedPixelRatio,
    absolute: basename(absolutePath),
  })),
}, null, 2));

async function readPng(path) {
  return PNG.sync.read(await readFile(path));
}
