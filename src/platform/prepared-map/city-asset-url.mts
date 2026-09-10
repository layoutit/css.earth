
const DATASET = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const FILENAME = /^[a-z0-9][a-z0-9._-]*$/u;
export const isPreparedAssetPath = (value: unknown): value is string => typeof value === "string" && /^\/scenes\/[a-z][a-z0-9-]*\/$/u.test(value);

export function normalizeCityAssetOrigin(value: unknown) {
  if (typeof value !== "string") throw new TypeError("Invalid prepared city asset origin.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.origin !== value || url.pathname !== "/" ||
      url.search || url.hash || url.username || url.password) {
    throw new TypeError("Invalid prepared city asset origin.");
  }
  return url.origin;
}

export function preparedCityAssetUrl(assetOrigin: unknown, keyPrefix: unknown, filename: unknown) {
  const origin = normalizeCityAssetOrigin(assetOrigin);
  if (typeof keyPrefix !== "string" || !/^[a-z0-9]+(?:\/[a-z0-9]+)*$/u.test(keyPrefix) ||
      typeof filename !== "string" || !FILENAME.test(filename)) {
    throw new TypeError("Invalid prepared city asset path.");
  }
  return `${origin}/${keyPrefix}/${filename}`;
}

export function isPreparedCityAssetUrl(plan: { assetPath?: string; dataset?: string; assetOrigin?: string } | null, value: string, kind: string, sha256: string) {
  if (!plan || !isPreparedAssetPath(plan.assetPath) || (typeof plan.dataset !== "string" || !DATASET.test(plan.dataset)) ||
      !/^[0-9a-f]{64}$/u.test(sha256 ?? "")) return false;
  let origin;
  try { origin = normalizeCityAssetOrigin(plan.assetOrigin); } catch { return false; }
  let url;
  try { url = new URL(value); } catch { return false; }
  if (url.origin !== origin || url.search || url.hash) return false;
  if (!url.pathname.startsWith(plan.assetPath)) return false;
  const prefix = kind === "index" ? "city-index-" : kind === "page" ? "city-" : null;
  const extension = kind === "index" ? "json" : kind === "page" ? "webp" : null;
  if (!prefix) return false;
  const escapedDataset = plan.dataset.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  return new RegExp(
    `^${prefix}${escapedDataset}-\\d+-\\d+-\\d+-${sha256.slice(0, 16)}\\.${extension}$`,
    "u",
  ).test(url.pathname.slice(plan.assetPath.length));
}
