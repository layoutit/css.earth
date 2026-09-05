import { preparedMaterialState } from "./prepared-material.mjs";

// Demand contains prepared resource identities only. Loading, cancellation,
// capacity, and protection of published rows remain in shared residency.
export function resolvePreparedMaterialDemand(track, selected, view, camera, previous) {
  const state = preparedMaterialState(track, selected, view, camera, previous);
  if (!["current", "visible", "visible-directional", "neighborhood", "away-enabled-or-lens-change"].includes(track.demand.mode) || !["none", "directional", "symmetric"].includes(track.demand.prewarm)) {
    throw new TypeError("Unsupported prepared material demand policy.");
  }
  const frame = selected.mode === "fixed" && track.demand.preserveFrameWhenFixed
    ? previous?.frame ?? track.demand.defaultFrame : state.frame;
  if (track.demand.mode === "visible-directional") {
    const initialRow=track.demand.defaultRow??state.bank.frames[track.demand.defaultFrame].row;
    const last=previous??{row:initialRow,rows:track.demand.initialRows};
    const rows=last.row===state.row&&last.rows?[...last.rows]:[state.row];
    for(let distance=1;last.row!==state.row&&rows.length<Math.min(track.demand.capacity,state.bank.rows.length);distance++) {
      for(const row of [state.row-distance,state.row+distance]) {
        if(row>=0&&row<state.bank.rows.length&&!rows.includes(row)&&rows.length<track.demand.capacity)rows.push(row);
      }
    }
    const required=state.mode!=="directional"||state.enabled?[state.address.resource]:[];
    const prewarm=state.mode==="directional"&&state.enabled?rows.filter(row=>row!==state.row).map(row=>state.bank.rows[row].resource):[];
    return {required,prewarm,frame,row:state.row,rows,mode:state.mode,bank:state.bank.id};
  }
  if (track.demand.mode === "visible" && !state.enabled) return { required: [], prewarm: [], frame, row: state.row, mode: state.mode, bank: state.bank.id };
  const required = track.demand.mode === "neighborhood"
    ? [...new Set(track.demand.neighborhoodOffsets.map(offset => state.bank.rows[
      Math.max(0, Math.min(state.bank.rows.length - 1, state.row + offset))].resource))]
    : track.demand.mode === "away-enabled-or-lens-change"
      ? !state.useDefault && (selected.mode !== "fixed" || previous?.bank !== state.bank.id)
        ? [state.bank.frames[state.frame].resource] : []
      : state.address?.resource == null ? [] : [state.address.resource];
  const prewarm = [];
  if (selected.mode !== "fixed" && state.address?.row != null && track.demand.prewarm === "symmetric") {
    for (let distance = 1; distance < state.bank.rows.length && prewarm.length < track.demand.capacity - 1; distance++) {
      for (const row of [state.row - distance, state.row + distance]) {
        if (row < 0 || row >= state.bank.rows.length || prewarm.length >= track.demand.capacity - 1) continue;
        prewarm.push(state.bank.rows[row].resource);
      }
    }
  }
  if (selected.mode !== "fixed" && state.address?.row != null && track.demand.prewarm === "directional") {
    const direction = Math.sign(frame - (previous?.frame ?? track.demand.defaultFrame));
    for (let distance = 1; direction && distance < track.demand.capacity; distance++) {
      const index = Math.max(0, Math.min(state.bank.rows.length - 1, state.row + direction * distance));
      const key = state.bank.rows[index].resource;
      if (!required.includes(key) && !prewarm.includes(key)) prewarm.push(key);
    }
  }
  return { required, prewarm, frame, row: state.row, mode: state.mode, bank: state.bank.id };
}
