const digest = value => /^[a-f0-9]{64}$/u.test(value ?? "");
const text = value => typeof value === "string" && value.length > 0 && value.length <= 2048;

export function requireWmtsRasterSource(source) {
  let url;
  try { url = new URL(source?.urlTemplate); } catch { throw new Error("Invalid prepared WMTS provider URL."); }
  if (source?.schema !== "cssearth-wmts-raster-source@1" || source.identity !== "versioned-provider" ||
      !text(source.dataset) || !text(source.version) || source.matrixSet !== "webmercator" || source.tileSize !== 256 ||
      url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
      !/^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9_./-]+\/\{TileMatrix\}\/\{TileCol\}\/\{TileRow\}\.png$/u.test(source.urlTemplate) ||
      source.urlTemplate.includes("/../") || source.urlTemplate.includes("/./") ||
      !Array.isArray(source.levels) || source.levels.length < 1 || source.levels.length > 20 ||
      source.levels.some((label, i) => label !== String(i).padStart(2, "0")) ||
      !Array.isArray(source.extent) || source.extent.length !== 4 || source.extent.some(value => !Number.isFinite(value)) ||
      source.extent[0] < -180 || source.extent[2] > 180 || source.extent[1] < -85.0511287798066 || source.extent[3] > 85.0511287798066 ||
      source.extent[0] >= source.extent[2] || source.extent[1] >= source.extent[3]) throw new Error("Invalid prepared WMTS provider contract.");
  if (source.emptyImage !== undefined && (!digest(source.emptyImage.sha256) ||
      !Number.isSafeInteger(source.emptyImage.bytes) || source.emptyImage.bytes < 1 || source.emptyImage.bytes > 1024 ||
      source.emptyImage.width !== 1 || source.emptyImage.height !== 1)) throw new Error("Invalid prepared WMTS no-data identity.");
  return source;
}

export function preparedWmtsRasterUrl(source, page) {
  if (!Number.isInteger(page.level) || page.level < 0 || page.level >= source.levels.length ||
      ![page.x, page.y].every(value => Number.isInteger(value) && value >= 0 && value < 2 ** page.level)) {
    throw new Error("Invalid prepared WMTS raster address.");
  }
  // Only bind decoded addresses to their admitted transport template. Geometry,
  // crops, matrices and source pixels are neither generated nor changed here.
  return source.urlTemplate.replace("{TileMatrix}", source.levels[page.level])
    .replace("{TileCol}", String(page.x)).replace("{TileRow}", String(page.y));
}

export function bindPreparedWmtsRaster(page, source) {
  if (page.rasterSource !== "terrascope-wmts@1" || page.width !== 256 || page.height !== 256) {
    throw new Error("The admitted provider requires compatible prepared WMTS geometry.");
  }
  return { ...page, rasterSource: "prepared-wmts-raster@1", provider: source, url: preparedWmtsRasterUrl(source, page) };
}

export function isPreparedProviderWmtsImage(page) {
  if (page?.rasterSource !== "prepared-wmts-raster@1" || page.width !== 256 || page.height !== 256) return false;
  try { requireWmtsRasterSource(page.provider); return page.url === preparedWmtsRasterUrl(page.provider, page); }
  catch { return false; }
}
