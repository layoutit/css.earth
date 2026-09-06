import { preparedMaterialState } from "./prepared-material.mjs";

export function resolvePreparedMaterialDemand(track, selected, view) {
  const state = preparedMaterialState(track, selected, view);
  const address = state.address;
  return {
    required: state.enabled && address?.resource != null ? [address.resource] : [],
    prewarm: state.enabled ? address?.prewarm ?? [] : [],
    frame: state.frame, row: state.row, mode: state.mode, bank: state.bank.id,
  };
}
