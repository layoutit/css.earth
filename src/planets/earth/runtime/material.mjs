import { preparedIlluminationState } from "../../../platform/prepared-illumination.mjs";
import { viewSunDirectionToPreparedLightDirection } from "../../../platform/directional-sun-coordinate.mjs";
import { PREPARED_EARTH_SCENE } from "./preparedScene.mjs";
import { PREPARED_EARTH_LENSES } from "./preparedLenses.mjs";
import { canonicalPreparedAsset } from "../../../platform/prepared-object-assets.mjs";
import { earthSurfaceBankInventory } from "./surface-pages.mjs";
export const banks = earthSurfaceBankInventory();
export const pageKeys = id => {
  const bankId = PREPARED_EARTH_LENSES.controls.find(lens => lens.id === id)?.surfaceBankId ?? id;
  return banks.find(bank => bank.id === bankId).urls.map((_, index) => `page:${bankId}:${index}`);
};
export const interiorUrls = [...new Set([
  PREPARED_EARTH_SCENE.interior.outerAssets.poles,
  ...PREPARED_EARTH_SCENE.interior.shells.flatMap(shell => shell.leaves.map(leaf => leaf.asset)),
  ...PREPARED_EARTH_SCENE.interior.sectionLeaves.map(leaf => leaf.asset),
].map(pair => canonicalPreparedAsset(pair)))];
export function materialState(selection, view) {
  const frameCount = PREPARED_EARTH_SCENE.material.lighting.frameCount;
  const frame = Math.round(Math.max(0, Math.min(1, (view.sunViewDirection[2] + 1) / 2)) * (frameCount - 1));
  const pitch = 65 - frame / (frameCount - 1) * 65;
  const exterior = PREPARED_EARTH_LENSES.controls.find(lens => lens.id === selection.lensId).view !== "interior";
  const state = { frame };
  for (const id of ["lighting", "atmosphere"]) {
    const plan = PREPARED_EARTH_SCENE.material[id];
    const illumination = plan.illumination
      ? preparedIlluminationState(plan.illumination, viewSunDirectionToPreparedLightDirection(view.skySunViewDirection))
      : null;
    const mode = illumination ? "directional" : id === "lighting" && !selection.shadows ? "shadowless"
      : Math.abs(pitch - plan.defaultScenePitchDegrees) < 0.01 ? "default" : "directional";
    const enabled = exterior && (id === "lighting" ? selection.shadows && selection.lensId !== "night-lights" : selection.atmosphere);
    const selectedFrame = illumination?.frame ?? frame;
    state[id] = { mode, enabled, frame: selectedFrame, rollDegrees: illumination?.rollDegrees,
      row: plan.frames[selectedFrame].rowIndex,
      key: mode === "directional" ? `${id}:${plan.frames[selectedFrame].rowIndex}` : `${mode}:${id}` };
  }
  return state;
}
export function materialDemand(selection, view, previousPlan) {
  const state = materialState(selection, view), required = [], prewarm = [], neighborhoods = {};
  for (const id of ["lighting", "atmosphere"]) {
    const item = state[id], plan = PREPARED_EARTH_SCENE.material[id];
    const previous = previousPlan?.neighborhoods[id] ?? {
      row: plan.transport.defaultRow, rows: plan.transport.initialWarmRows,
    };
    const rows = previous.row === item.row ? [...previous.rows] : [item.row];
    if (previous.row !== item.row) for (let distance = 1; rows.length < plan.transport.maximumRetainedRowCount; distance++) {
      if (item.row - distance >= 0) rows.push(item.row - distance);
      if (rows.length < plan.transport.maximumRetainedRowCount && item.row + distance < plan.preparedRows.length) rows.push(item.row + distance);
    }
    neighborhoods[id] = Object.freeze({ row: item.row, rows: Object.freeze(rows) });
    if (item.mode !== "directional") { required.push(item.key); continue; }
    if (!item.enabled) continue;
    required.push(item.key);
    prewarm.push(...rows.filter(row => row !== item.row).map(row => `${id}:${row}`));
  }
  return { required, prewarm, neighborhoods: Object.freeze(neighborhoods) };
}
