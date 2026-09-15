import type { PreparedMaterialTrack, PreparedMaterialSelection, PreparedMaterialDemand, PreparedMaterialView } from "./prepared-material.js";
import { preparedMaterialState } from "./prepared-material.js";

export function resolvePreparedMaterialDemand(track: PreparedMaterialTrack, selected: PreparedMaterialSelection, view: PreparedMaterialView): PreparedMaterialDemand {
  const state = preparedMaterialState(track, selected, view);
  const address = state.address;
  // A disabled directional effect can still publish its prepared static
  // replacement (for example Earth's shadowless lighting). The publisher
  // needs that image before it can replace and fit the retained preview.
  const needsAddress = state.enabled || selected.publishWhenHidden === "static" && state.mode !== "directional";
  return {
    required: needsAddress && address?.resource != null ? [address.resource] : [],
    prewarm: state.enabled ? address?.prewarm ?? [] : [],
    frame: state.frame, row: state.row, mode: state.mode, bank: state.bank.id,
  };
}
