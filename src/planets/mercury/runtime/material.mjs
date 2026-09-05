import { CANONICAL_PREPARED_IMAGE_DENSITY } from "../../../../site/runtime-policy.mjs";
import { PREPARED_MERCURY_ASSETS } from "./preparedAssets.mjs";
export const materialBank = PREPARED_MERCURY_ASSETS.lighting.banks[String(CANONICAL_PREPARED_IMAGE_DENSITY)];
export function materialFrameFor(selection, view) {
  const lighting = PREPARED_MERCURY_ASSETS.lighting;
  return selection.shadows ? Math.round(Math.max(0, Math.min(1,
    (view.sunViewDirection[2] - lighting.minimumLightViewZ) /
    (lighting.maximumLightViewZ - lighting.minimumLightViewZ))) * (lighting.frameCount - 1)) : lighting.frameCount - 1;
}
export function materialDemand(selection, view) {
  if (!selection.shadows) return { required: ["shadowless"], prewarm: [] };
  const row = materialBank.presentations[materialFrameFor(selection, view)].rowIndex;
  const rows = [row];
  for (let distance = 1; rows.length < materialBank.transport.maximumRetainedRowCount; distance++) {
    if (row - distance >= 0) rows.push(row - distance);
    if (rows.length < materialBank.transport.maximumRetainedRowCount && row + distance < materialBank.rows.length) rows.push(row + distance);
  }
  return { required: [`lighting:${row}`], prewarm: rows.slice(1).map(index => `lighting:${index}`) };
}
