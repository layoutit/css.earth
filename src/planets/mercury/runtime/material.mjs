import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../../../site/runtime-policy.mjs";
import { PREPARED_MERCURY_ASSETS } from "./preparedAssets.mjs";
export const materialBank = PREPARED_MERCURY_ASSETS.lighting.banks[String(CANONICAL_PREPARED_IMAGE_DENSITY)];
// The far view's lighting: every frame in one small atlas, so the billboard
// keeps the phase while the row shards stop streaming.
export const billboardLighting = materialBank.billboard;
if (billboardLighting?.schema !== "cssmercury-prepared-lighting-billboard@1" ||
    billboardLighting.presentations.length !== PREPARED_MERCURY_ASSETS.lighting.frameCount) {
  throw new Error("Mercury has no prepared billboard lighting atlas.");
}
export const BILLBOARD_LIGHTING_KEY = "lighting-billboard";
// As soon as the billboard starts fading in, the overlay draws from the
// billboard atlas and the row shards stop streaming; at that size the two are
// the same picture. Before the camera's first perspective publication the
// view carries no level of detail and the geometry stage applies.
export function materialSourceFor(view) {
  return (view?.levelOfDetail?.stage ?? "geometry") === "geometry" ? "rows" : "billboard";
}
export function materialFrameFor(selection, view) {
  const lighting = PREPARED_MERCURY_ASSETS.lighting;
  return selection.shadows ? Math.round(Math.max(0, Math.min(1,
    (view.sunViewDirection[2] - lighting.minimumLightViewZ) /
    (lighting.maximumLightViewZ - lighting.minimumLightViewZ))) * (lighting.frameCount - 1)) : lighting.frameCount - 1;
}
export function materialDemand(selection, view) {
  if (materialSourceFor(view) === "billboard") return { required: [BILLBOARD_LIGHTING_KEY], prewarm: [] };
  if (!selection.shadows) return { required: ["shadowless"], prewarm: [] };
  const row = materialBank.presentations[materialFrameFor(selection, view)].rowIndex;
  const rows = [row];
  for (let distance = 1; rows.length < materialBank.transport.maximumRetainedRowCount; distance++) {
    if (row - distance >= 0) rows.push(row - distance);
    if (rows.length < materialBank.transport.maximumRetainedRowCount && row + distance < materialBank.rows.length) rows.push(row + distance);
  }
  return { required: [`lighting:${row}`], prewarm: rows.slice(1).map(index => `lighting:${index}`) };
}
