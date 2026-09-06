import type { PreparedMaterialTrack, PreparedMaterialSelection, PreparedMaterialDemand, PreparedMaterialView } from "./prepared-material.js";
import { preparedMaterialState } from "./prepared-material.js";

export function resolvePreparedMaterialDemand(track: PreparedMaterialTrack, selected: PreparedMaterialSelection, view: PreparedMaterialView): PreparedMaterialDemand {
  const state = preparedMaterialState(track, selected, view);
  const address = state.address;
  return {
    required: state.enabled && address?.resource != null ? [address.resource] : [],
    prewarm: state.enabled ? address?.prewarm ?? [] : [],
    frame: state.frame, row: state.row, mode: state.mode, bank: state.bank.id,
  };
}
