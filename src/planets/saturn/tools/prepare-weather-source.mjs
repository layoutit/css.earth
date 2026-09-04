import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { validateSaturnSourceGroup } from "./source-manifest.mjs";

await validateSaturnSourceGroup("weather");

const SOURCE = fileURLToPath(new URL(
  "../source/saturn-weather-static.webp",
  import.meta.url,
));
const OUTPUT = fileURLToPath(new URL(
  "../../../../public/scenes/saturn/saturn-weather.webp",
  import.meta.url,
));
const encoded = await readFile(SOURCE);
const { data, info } = await sharp(encoded)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
if (info.width !== 290 || info.height !== 34 || info.channels !== 4) {
  throw new Error("Saturn checked static weather dimensions changed.");
}
await writeFile(OUTPUT, encoded);
console.log(JSON.stringify({
  output: OUTPUT,
  width: info.width,
  height: info.height,
  sha256: createHash("sha256").update(encoded).digest("hex"),
  decodedRgbaSha256: createHash("sha256").update(data).digest("hex"),
}, null, 2));
