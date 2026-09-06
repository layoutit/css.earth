import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const sha = bytes => createHash("sha256").update(bytes).digest("hex");

async function mapBounded(items, concurrency, action) {
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error("Publication concurrency must be between one and eight.");
  let next = 0, failure;
  const results = [];
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (!failure && next < items.length) {
      const index = next++;
      try { results[index] = await action(items[index]); } catch (error) { failure ??= error; }
    }
  }));
  if (failure) throw failure;
  return results;
}

export async function verifyPublicationInputs(assets) {
  const keys = new Set();
  for (const asset of assets) {
    if (!/^[a-z0-9][a-z0-9@._-]*$/u.test(asset.filename ?? "") || !/^[a-f0-9]{64}$/u.test(asset.sha256 ?? "") ||
        asset.key !== `runtime-assets/${asset.sha256}/${asset.filename}` || keys.has(asset.key) ||
        !Number.isSafeInteger(asset.bytes) || asset.bytes < 1) throw new Error("Invalid immutable publication input.");
    keys.add(asset.key);
    const bytes = await readFile(asset.file);
    if (bytes.length !== asset.bytes || sha(bytes) !== asset.sha256) throw new Error(`Prepare ${asset.filename} before publication.`);
  }
}

// The immutable object address is also the resume journal: already present
// outputs are skipped, including successful writes from an interrupted batch.
export async function planRuntimePublication(assets, { fetcher = fetch, concurrency = 4 } = {}) {
  await verifyPublicationInputs(assets);
  const states = await mapBounded(assets, concurrency, async asset => {
    const response = await fetcher(asset.url, { method: "HEAD", signal: AbortSignal.timeout(30000) });
    await response.body?.cancel();
    if (response.status === 404) return { asset, state: "missing" };
    if (!response.ok || Number(response.headers.get("content-length")) !== asset.bytes) {
      throw new Error(`Immutable asset cannot be reused: ${asset.filename} (HTTP ${response.status}).`);
    }
    return { asset, state: "present" };
  });
  return { missing: states.filter(item => item.state === "missing").map(item => item.asset),
    present: states.filter(item => item.state === "present").map(item => item.asset) };
}

export async function verifyPublishedAssets(assets, { fetcher = fetch, concurrency = 4 } = {}) {
  return mapBounded(assets, concurrency, async asset => {
    const response = await fetcher(asset.url, { signal: AbortSignal.timeout(120000) });
    if (!response.ok || !response.body) {
      await response.body?.cancel();
      throw new Error(`Published asset unavailable: ${asset.filename} (HTTP ${response.status}).`);
    }
    const digest = createHash("sha256"); let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.length;
      if (bytes > asset.bytes) throw new Error(`Published asset exceeds its pin: ${asset.filename}.`);
      digest.update(chunk);
    }
    const hash = digest.digest("hex");
    if (bytes !== asset.bytes || hash !== asset.sha256) throw new Error(`Published asset hash mismatch: ${asset.filename}.`);
    return { filename: asset.filename, bytes, sha256: hash,
      cacheControl: response.headers.get("cache-control"), contentType: response.headers.get("content-type") };
  });
}

export async function publishRuntimeAssetChanges(assets, { upload, publishRelease, fetcher = fetch, concurrency = 4 } = {}) {
  if (typeof upload !== "function") throw new Error("Publication requires an explicit upload adapter.");
  const plan = await planRuntimePublication(assets, { fetcher, concurrency });
  if (plan.missing.length) await upload(plan.missing);
  // HEAD is only a diff optimization. Verify every byte, including reused
  // objects, before exposing a release manifest that refers to them.
  const verified = await verifyPublishedAssets(assets, { fetcher, concurrency });
  if (publishRelease) await publishRelease();
  return { uploaded: plan.missing.length, reused: plan.present.length,
    uploadedBytes: plan.missing.reduce((sum, asset) => sum + asset.bytes, 0), verified };
}
