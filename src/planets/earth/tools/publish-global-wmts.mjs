import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { releaseFiles, verifyLocalPack, publishedPackMatches, WMTS_CACHE_CONTROL } from "./city/wmts-release.mjs";
import { CITY_R2_WRANGLER_VERSION } from "./city/r2-publish.mjs";
import { wmtsS3Environment,publishWmtsS3,verifyWmtsS3 } from "./city/wmts-s3-publish.mjs";

const { values } = parseArgs({ options: {
  sample: { type: "boolean" }, upload: { type: "boolean" },
  "verify-only": { type: "boolean" }, output: { type: "string" },
} });
if (values.upload && values["verify-only"]) throw new Error("Choose upload or verification.");
const root = resolve(import.meta.dirname, "../../../..");
const release = JSON.parse(await readFile(new URL("../source/city/wmts-release.json", import.meta.url), "utf8"));
const { delivery } = JSON.parse(await readFile(new URL("../source/city/manifest.json", import.meta.url), "utf8"));
if (delivery.bucket !== "cssearth-assets" || delivery.assetOrigin !== "https://earth-assets.lowpoly.cc" ||
    delivery.keyPrefix !== "scenes/earth" || !/^[a-f0-9]{32}$/u.test(delivery.accountId)) throw new Error("Unexpected release target.");
const directory = resolve(root, ".local/wmts-global", release.version);
const output = resolve(root, values.output ?? `output/earth-city/global-release/${Date.now()}`);
await mkdir(output, { recursive: true });
const prefix = `${delivery.keyPrefix}/wmts-${release.version}`;
const inspection = Date.now();
const files = releaseFiles(release, values.sample), assets = [];
const report = { schema: "cssearth-wmts-publication@1", version: release.version,
  mode: values.upload ? "upload" : values["verify-only"] ? "verify-only" : "plan",
  sample: !!values.sample, bucket: delivery.bucket, prefix,
  objects: files.length, bytes: files.reduce((sum, f) => sum + f.bytes, 0),
  output, cacheControl: WMTS_CACHE_CONTROL, uploaded: 0, existing: 0 };
console.log(JSON.stringify(report));
try {
  for (const file of files) {
    assets.push({ ...await verifyLocalPack(directory, file), key: `${prefix}/${file.filename}` });
    if (assets.length % 1000 === 0) console.log(JSON.stringify({ verifiedLocal: assets.length, total: files.length }));
  }
  await writeFile(resolve(output, "inventory.json"), JSON.stringify(assets, null, 2) + "\n");
  if (values.upload && !values.sample) {
    await new Promise((accept, reject) => {
      const child = spawn(process.execPath, [resolve(import.meta.dirname, "verify-global-wmts-delivery.mjs")], { cwd: root, stdio: "inherit" });
      child.once("error", reject); child.once("exit", code => code === 0 ? accept() : reject(new Error("Complete the public sample delivery proof before uploading the world.")));
    });
  }
  const s3=(values.upload||values["verify-only"])&&!values.sample?wmtsS3Environment(delivery):null;
  if(s3){
    report.uploader="rclone-s3";
    const verifyOrPublish=values.upload?publishWmtsS3:verifyWmtsS3;
    report.s3=await verifyOrPublish({assets,directory,delivery,prefix,output,environment:s3});
    report.uploaded=null;report.existing=null;
    for(const asset of [assets[0],assets.at(-1)]){
      if(!await publishedPackMatches(`${delivery.assetOrigin}/${asset.key}?verify=${asset.sha256}`,asset))throw new Error("Published S3 release is not public.");
    }
  } else if (values.upload || values["verify-only"]) {
    // Check immutable bytes before writing. Resume only missing objects; never
    // overwrite a mismatched published key. Single-part R2 ETags are MD5s.
    for (let offset = 0; offset < assets.length; offset += 128) {
      const batch = assets.slice(offset, offset + 128), missing = [];
      let cursor = 0;
      await Promise.all(Array.from({ length: Math.min(8, batch.length) }, async () => {
        while (cursor < batch.length) {
          const asset = batch[cursor++];
          // Do not leave a cached 404 on the application's canonical URL before
          // uploading a missing object. Each publication inspects a fresh key.
          if (await publishedPackMatches(`${delivery.assetOrigin}/${asset.key}?inventory=${inspection}`, asset)) report.existing++;
          else missing.push(asset);
        }
      }));
      if (missing.length && values["verify-only"]) throw new Error(`${missing.length} packs missing in batch ${offset}.`);
      if (missing.length) {
        const manifest = resolve(output, `upload-${offset}.json`);
        await writeFile(manifest, JSON.stringify(missing.map(({ key, path: file }) => ({ key, file }))));
        await new Promise((accept, reject) => {
          const child = spawn("npx", ["--yes", `wrangler@${CITY_R2_WRANGLER_VERSION}`, "r2", "bulk", "put", delivery.bucket,
            "--filename", manifest, "--concurrency", "8", "--remote", "--force",
            "--content-type", "application/octet-stream", "--cache-control", WMTS_CACHE_CONTROL],
          { cwd: root, stdio: "inherit", env: { ...process.env, CLOUDFLARE_ACCOUNT_ID: delivery.accountId } });
          child.once("error", reject); child.once("exit", code => code === 0 ? accept() : reject(new Error(`Upload exited ${code}.`)));
        });
        let verifyCursor=0;
        await Promise.all(Array.from({length:Math.min(8,missing.length)},async()=>{
          while(verifyCursor<missing.length){
          const asset=missing[verifyCursor++];
          let matched = false;
          for (let attempt = 0; attempt < 4 && !matched; attempt++) {
            // A query avoids a negative CDN cache left by the pre-upload HEAD.
            matched = await publishedPackMatches(`${delivery.assetOrigin}/${asset.key}?verify=${asset.sha256}`, asset);
            if (!matched) await new Promise(done => setTimeout(done, 1000));
          }
          if (!matched) throw new Error(`Uploaded pack unavailable: ${asset.filename}`);
          report.uploaded++;
          }
        }));
      }
      console.log(JSON.stringify({ checked: offset + batch.length, total: assets.length, uploaded: report.uploaded, existing: report.existing }));
      await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n");
    }
  }
  report.complete = true;
} catch (error) { report.error = error.message; throw error; }
finally { await writeFile(resolve(output, "report.json"), JSON.stringify(report, null, 2) + "\n"); }
