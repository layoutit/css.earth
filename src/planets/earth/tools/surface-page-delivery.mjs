import sharp from "sharp";
import { createHash } from "node:crypto";
import { EARTH_SURFACE_ATLAS } from "./surface-raster.mjs";

export function visibleRgbaHash(bytes) {
  const normalized = Buffer.from(bytes);
  // Transparent RGB is unobservable after premultiplication. WebP's lossless
  // encoder clears it; preserve and verify every alpha and visible RGB byte.
  for (let i = 0; i < normalized.length; i += 4) if (!normalized[i + 3]) normalized.fill(0, i, i + 3);
  return createHash("sha256").update(normalized).digest("hex");
}

export async function writeEarthSurfaceDelivery({ plan, density, encodeSourcePage, writePage }) {
  const ratio = density / EARTH_SURFACE_ATLAS.density;
  if (![2, 4, 8].includes(density) || plan.pages.length !== plan.pageSources?.length || !plan.encodingPages?.length) throw new Error("Earth strip delivery plan is incompatible.");
  const receipt = { density, source: [], pages: [] };
  for (const [index, dimensions] of plan.encodingPages.entries()) {
    const encoded = await encodeSourcePage(index);
    const source = await sharp(encoded).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    if (source.info.width !== dimensions.width * ratio || source.info.height !== dimensions.height * ratio) throw new Error("Accepted Earth encoding dimensions drifted.");
    receipt.source.push({ index, bytes: encoded.length, sha256: createHash("sha256").update(encoded).digest("hex") });
    for (const [page, address] of plan.pageSources.entries()) {
      if (address.page !== index) continue;
      const extent = plan.pages[page], width = extent.width * ratio, height = extent.height * ratio, top = address.top * ratio;
      if (extent.height > EARTH_SURFACE_ATLAS.maximumDeliveryHeight || width !== source.info.width ||
          !Number.isInteger(top) || top < 0 || !Number.isInteger(height) || height <= 0 || top + height > source.info.height) throw new Error("Earth delivery strip exceeds its prepared bounds.");
      const pixels = source.data.subarray(top * width * 4, (top + height) * width * 4);
      const bytes = await sharp(pixels, { raw: { width, height, channels: 4 } }).webp({ lossless: true, effort: 6 }).toBuffer();
      const decoded = await sharp(bytes).ensureAlpha().raw().toBuffer();
      const pixelsSha256 = visibleRgbaHash(pixels);
      if (visibleRgbaHash(decoded) !== pixelsSha256) throw new Error("Earth delivery strip changed visible source pixels.");
      await writePage(page, bytes);
      receipt.pages.push({ page, sourcePage: index, top, width, height, bytes: bytes.length, pixelsSha256,
        sha256: createHash("sha256").update(bytes).digest("hex") });
    }
  }
  if (receipt.pages.length !== plan.pages.length) throw new Error("Earth delivery strip is missing its source.");
  return receipt;
}
