import { isPreparedCityAssetUrl } from "../../runtime/city-asset-url.mjs";
import { pageKey } from "./page-geometry.mjs";

export function expectedGlobalCityFace(face, jobs) {
  const ancestors = new Set();
  let finePages = 0;
  for (const job of jobs) {
    for (let level = job.root.level; level <= job.lastLevel; level++) {
      finePages += 4 ** (level - job.root.level);
    }
    for (let level = 0; level < job.root.level; level++) {
      const factor = 2 ** (job.root.level - level);
      ancestors.add(pageKey({ level, x: Math.floor(job.root.x / factor),
        y: Math.floor(job.root.y / factor) }));
    }
  }
  return { face: { ...face, key: pageKey(face) }, jobs: jobs.length, finePages,
    pages: finePages + ancestors.size,
    sourceObjects: new Set(jobs.flatMap(({ sources }) => sources.map(({ tile }) => tile))).size,
    maximumWindowPixels: Math.max(0, ...jobs.map(({ window }) => window.pixels)) };
}

export function validateGlobalCityFaceReceipt(receipt, expected, source, catalogSha256) {
  if (receipt?.schema !== "cssearth-earth-city-global-face@1" ||
      receipt.dataset !== source.dataset || receipt.catalogSha256 !== catalogSha256 ||
      JSON.stringify(receipt.face) !== JSON.stringify(expected.face) ||
      receipt.jobs !== expected.jobs || receipt.finePages !== expected.finePages ||
      receipt.pages !== expected.pages || receipt.sourceObjects !== expected.sourceObjects ||
      receipt.maximumWindowPixels !== expected.maximumWindowPixels ||
      receipt.qualification !== "One verified global-build face; not global runtime coverage." ||
      !Array.isArray(receipt.provenance) || receipt.provenance.length !== expected.jobs ||
      !Array.isArray(receipt.heads) || receipt.heads.length !== 1 ||
      receipt.heads[0].key !== expected.face.key ||
      receipt.publish?.mode !== "publish-and-verify" ||
      receipt.publish.bucket !== source.delivery.bucket ||
      receipt.publish.origin !== source.delivery.assetOrigin ||
      receipt.publish.webp?.objects !== receipt.pages ||
      receipt.publish.json?.objects !== receipt.indexes ||
      receipt.publish.objects !== receipt.pages + receipt.indexes ||
      receipt.publish.bytes !== receipt.publish.webp.bytes + receipt.publish.json.bytes ||
      receipt.compressedBytes !== receipt.publish.webp.bytes) {
    throw new Error(`Invalid global city face receipt: ${expected.face.key}`);
  }
  const directory = receipt.heads[0].directory;
  if (!directory || !Number.isSafeInteger(directory.bytes) || directory.bytes < 1 ||
      !isPreparedCityAssetUrl({ dataset: source.dataset, assetOrigin: source.delivery.assetOrigin },
        directory.url, "index", directory.sha256)) {
    throw new Error(`Invalid global city face head: ${expected.face.key}`);
  }
  return receipt;
}
