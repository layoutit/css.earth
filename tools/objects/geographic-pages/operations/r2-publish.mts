import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { normalizeCityAssetOrigin } from "../../../../src/platform/prepared-map/city-asset-url.mts";

import { parseDelivery, shape, array, text } from '../source-records.mts';
interface CityAsset { url: URL; filename: string; file: string; key: string; bytes: number; type: string }
export const CITY_R2_WRANGLER_VERSION = "4.129.0";
export const CITY_R2_CACHE_CONTROL = "public, max-age=31536000, immutable";
const MAX_OBJECT_BYTES = 300 * 1024 * 1024;

export async function publishPreparedCityAssets({ source: value, cors, assetUrls, staging, root, assetPath,
  verifyOnly = false, dryRun = false, batchSize = 256, concurrency = 2 }: { source: unknown; cors: unknown; assetUrls: readonly string[]; staging: string; root: string; assetPath: string; verifyOnly?: boolean; dryRun?: boolean; batchSize?: number; concurrency?: number }) {
  const source = shape({dataset:text,delivery:parseDelivery})(value);
  const origin = normalizeCityAssetOrigin(source.delivery?.assetOrigin);
  const bucket = source.delivery?.bucket;
  const accountId = source.delivery?.accountId;
  const keyPrefix = source.delivery?.keyPrefix;
  if (bucket !== "cssearth-assets" || !/^[a-f0-9]{32}$/u.test(accountId ?? "") ||
      typeof assetPath !== "string" || !/^\/scenes\/[a-z][a-z0-9-]*\/$/u.test(assetPath) || keyPrefix !== assetPath.slice(1,-1)) {
    throw new Error("Earth city delivery target is incompatible.");
  }
  for (const [name, value, minimum, maximum] of [
    ["batchSize", batchSize, 1, 1000], ["concurrency", concurrency, 1, 8],
  ] as const) if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new TypeError(`${name} must be an integer from ${minimum} through ${maximum}.`);
  }
  if (!assetUrls.length) throw new Error("No prepared Earth city assets found.");

  const assets: CityAsset[] = [];
  for (const value of assetUrls) {
    const url = new URL(value);
    const filename = basename(url.pathname);
    const match = filename.match(new RegExp(
      `^city-(?:index-)?${escapeRegExp(source.dataset)}-\\d+-\\d+-\\d+-([a-f0-9]{16})\\.(webp|json)$`, "u"));
    if (url.origin !== origin || url.pathname !== `/${keyPrefix}/${filename}` ||
        url.search || url.hash || !match) {
      throw new Error(`Prepared city asset escaped the pinned delivery path: ${value}`);
    }
    const file = resolve(staging, filename);
    const info = await stat(file);
    if (!info.isFile() || info.size > MAX_OBJECT_BYTES) {
      throw new Error(`Prepared city asset cannot be published: ${file}`);
    }
    const bytes = await readFile(file);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    if (!sha256.startsWith(match[1])) throw new Error(`Prepared city hash mismatch: ${filename}`);
    assets.push({ url, filename, file, key: `${keyPrefix}/${filename}`, bytes: info.size,
      type: match[2] === "webp" ? "image/webp" : "application/json" });
  }

  const credentials = r2S3Credentials();
  if (!verifyOnly && !dryRun && credentials) {
    const environment = { ...process.env,
      RCLONE_CONFIG_CSSEARTH_TYPE: "s3",
      RCLONE_CONFIG_CSSEARTH_PROVIDER: "Cloudflare",
      RCLONE_CONFIG_CSSEARTH_ACCESS_KEY_ID: credentials.accessKeyId,
      RCLONE_CONFIG_CSSEARTH_SECRET_ACCESS_KEY: credentials.secretAccessKey,
      RCLONE_CONFIG_CSSEARTH_ENDPOINT: `https://${accountId}.r2.cloudflarestorage.com`,
      RCLONE_CONFIG_CSSEARTH_REGION: "auto",
      RCLONE_CONFIG_CSSEARTH_NO_CHECK_BUCKET: "true",
      ...(credentials.sessionToken ? { RCLONE_CONFIG_CSSEARTH_SESSION_TOKEN: credentials.sessionToken } : {}) };
    await run("rclone", ["copy", staging, `cssearth:${bucket}/${keyPrefix}`,
      "--ignore-existing", "--no-traverse", "--transfers", "32", "--checkers", "32",
      "--s3-upload-concurrency", "4", "--header-upload", `Cache-Control: ${CITY_R2_CACHE_CONTROL}`,
      "--stats", "15s", "--stats-one-line"], root, environment);
  } else if (!verifyOnly && !dryRun) {
    const directory = await mkdtemp(resolve(root, ".local/geographic-city-r2-"));
    try {
      for (const type of ["image/webp", "application/json"]) {
        const group = assets.filter((asset) => asset.type === type);
        for (let offset = 0; offset < group.length; offset += batchSize) {
          const batch = group.slice(offset, offset + batchSize);
          const manifest = resolve(directory, `batch-${type.replace("/", "-")}-${offset}.json`);
          await writeFile(manifest, `${JSON.stringify(batch.map(({ key, file }) => ({ key, file })))}\n`);
          await run("npx", ["--yes", `wrangler@${CITY_R2_WRANGLER_VERSION}`, "r2", "bulk", "put", bucket,
            "--filename", manifest, "--concurrency", String(concurrency), "--remote", "--force",
            "--content-type", type, "--cache-control", CITY_R2_CACHE_CONTROL], root);
        }
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  }

  if (!dryRun) await verifyPublishedAssets(assets, cors);
  return { schema: "cssearth-earth-city-r2-publish@1", bucket, origin,
    mode: dryRun ? "dry-run" : verifyOnly ? "verify-only" : "publish-and-verify",
    uploader: credentials ? "rclone-s3" : "wrangler-rest",
    objects: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0),
    webp: summarize(assets.filter(({ type }) => type === "image/webp")),
    json: summarize(assets.filter(({ type }) => type === "application/json")),
    cacheControl: CITY_R2_CACHE_CONTROL };
}

function r2S3Credentials() {
  const accessKeyId = process.env.EARTH_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.EARTH_R2_SECRET_ACCESS_KEY;
  if (!accessKeyId && !secretAccessKey) return null;
  if (!accessKeyId || !secretAccessKey) throw new Error("Incomplete Earth R2 S3 credentials.");
  return { accessKeyId, secretAccessKey,
    sessionToken: process.env.EARTH_R2_SESSION_TOKEN || null };
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function summarize(assets: readonly CityAsset[]) {
  return { objects: assets.length, bytes: assets.reduce((sum, asset) => sum + asset.bytes, 0) };
}

async function verifyPublishedAssets(assets: readonly CityAsset[], value: unknown) {
  const cors=shape({rules:array(shape({allowed:shape({origins:array(text)})}))})(value);
  const allowedOrigins = cors?.rules?.[0]?.allowed?.origins;
  if (!Array.isArray(allowedOrigins) || !allowedOrigins.includes("https://css.earth") ||
      !allowedOrigins.includes("http://127.0.0.1:4210")) {
    throw new Error("Earth city CORS proof origins are incomplete.");
  }
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(8, assets.length) }, async () => {
    while (cursor < assets.length) {
      const asset = assets[cursor++];
      if (!await publishedAssetMatches(asset, "https://css.earth")) {
        throw new Error(`Published city asset failed delivery verification: ${asset.url}`);
      }
    }
  }));
  if (!await publishedAssetMatches(assets[0], "http://127.0.0.1:4210")) {
    throw new Error("Published city asset failed local-preview CORS verification.");
  }
}

async function publishedAssetMatches(asset: CityAsset, origin: string) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(asset.url, { method: "HEAD", cache: "no-store",
      headers: { Origin: origin, "Accept-Encoding": "identity" } }).catch(() => null);
    if (response?.ok && Number(response.headers.get("content-length")) === asset.bytes &&
        response.headers.get("content-type")?.split(";")[0] === asset.type &&
        response.headers.get("cache-control")?.replaceAll(" ", "") === CITY_R2_CACHE_CONTROL.replaceAll(" ", "") &&
        response.headers.get("access-control-allow-origin") === origin) return true;
    if (attempt < 3) await new Promise(resolveDelay => setTimeout(resolveDelay, 250 * 2 ** attempt));
  }
  return false;
}

async function run(command: string, arguments_: string[], root: string, environment = process.env) {
  await new Promise<void>((accept, reject) => {
    const child = spawn(command, arguments_, { cwd: root, stdio: "inherit", env: environment });
    child.once("error", reject);
    child.once("exit", (code, signal) => code === 0 ? accept() :
      reject(new Error(`${command} exited ${signal ?? code}.`)));
  });
}
