import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { optimizePreparedLosslessWebp } from "../../../../tools/prepared-webp.mjs";

const objectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(objectRoot, "../../../public/scenes/saturn");
const filenames = Object.freeze([
  "saturn-rings.webp",
  "saturn-rings@2x.webp",
  "saturn-ring-shadow.webp",
  "saturn-starfield.webp",
  "saturn-ring-motion-c.webp",
  "saturn-ring-motion-c@2x.webp",
  "saturn-ring-motion-b-inner.webp",
  "saturn-ring-motion-b-inner@2x.webp",
  "saturn-ring-motion-b-outer.webp",
  "saturn-ring-motion-b-outer@2x.webp",
  "saturn-ring-motion-a.webp",
  "saturn-ring-motion-a@2x.webp",
]);

const results = [];
for (const filename of filenames) {
  results.push(await optimizePreparedLosslessWebp(resolve(publicRoot, filename)));
}

console.log(JSON.stringify({
  optimizedAssetCount: results.filter((result) => result.savedBytes > 0).length,
  savedBytes: results.reduce((total, result) => total + result.savedBytes, 0),
  results,
}, null, 2));
