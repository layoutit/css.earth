import type { PreparedView } from "./prepared-presentation.js";
import type { PreparedResources } from "./prepared-residency.js";
import { readPreparedStyle, writePreparedStyle } from "./style-access.js";
export type PreparedMaterialView = Pick<PreparedView, "sunViewDirection" | "sceneMatrix" | "reference"> & Partial<Pick<PreparedView, "levelOfDetail" | "projection" | "viewportWidth" | "viewportHeight" | "motionAtRest">>;
export interface PreparedMaterialFrameMapping { thresholds: readonly number[]; indices: readonly number[]; }
export interface PreparedMaterialAddress { resource: string | null; backgroundPosition: string; backgroundSize: string; frame: number | null; row: number | null; prewarm?: readonly string[]; }
export interface PreparedMaterialBank { id: string; default?: PreparedMaterialAddress | null; fixed?: PreparedMaterialAddress | null; frames: readonly PreparedMaterialAddress[]; }
interface RotationPolicy { reference: "initial" | "prepared"; baseDegrees: number; polePolicy?: "azimuth" | "preserve"; zeroAtPole?: boolean; onlyWhenEnabled?: boolean; publishWithAddress?: boolean;
  physical?: Parameters<typeof createPreparedEllipsoidProjection>[0] & {systemTransform:string}; }
export type PreparedMaterialRotation = RotationPolicy & (
  { kind: "angle"; property: string } |
  { kind: "planar"; width: number; height?: number } |
  ({ kind: "ellipsoid"; systemTransform: string } & Parameters<typeof createPreparedEllipsoidProjection>[0])
);
export interface PreparedMaterialTrack {
  id: string; target: number; frame: PreparedMaterialFrameMapping; defaultFrame: number; farBank?: string;
  banks: readonly PreparedMaterialBank[]; rotation?: PreparedMaterialRotation | null; quoted?: boolean; frameAttribute?: string | null; modeAttribute?: string | null;
}
export interface PreparedMaterialSelection {
  track: string; bank: string; mode: "fixed" | "frames"; fixedMode: string; frameOverride?: number | null; frameOffset?: number;
  enabled: boolean; rotationEnabled: boolean; modeLabel?: string; publishWhenHidden?: "always" | "static" | "never"; clearWhenHidden?: boolean;
  addressAttributes?: readonly { source: "frame" | "mode" | "mode-or-frame" | "literal"; name: string; value: string | null }[];
}
export interface PreparedMaterialDemand { required: string[]; prewarm: readonly string[]; frame: number; row: number | null; mode: string; bank: string; }
export interface PreparedMaterialObservation {
  bank: string | null; frame: number; calculatedFrame: number; appliedFrame: number | null; appliedRow: number | null; row: number | null; mode: string | null;
  lightRollDegrees: number; addressWrites: number; transformWrites: number; enabled: boolean; rotationEnabled: boolean; sunViewDirection: readonly number[] | null;
}

import { createPreparedEllipsoidProjection } from "../prepared-data/prepared-ellipsoid-projection.js";

const degrees = (angle: number) => (angle % 360 + 540) % 360 - 180;
export function preparedMaterialFrame(mapping: PreparedMaterialFrameMapping, view: Pick<PreparedView, "sunViewDirection">) {
  if (!view.sunViewDirection) throw new TypeError("Prepared material requires a published Sun direction.");
  const phase = view.sunViewDirection[2];
  let low = 0, high = mapping.thresholds.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (phase < mapping.thresholds[middle]) high = middle;
    else low = middle + 1;
  }
  return mapping.indices[low];
}

export function preparedMaterialState(track: PreparedMaterialTrack, selected: PreparedMaterialSelection, view: PreparedMaterialView) {
  const calculatedFrame = preparedMaterialFrame(track.frame, view);
  const frame = selected.frameOverride ?? calculatedFrame + (selected.frameOffset ?? 0);
  const direction = view.sunViewDirection;
  if (!direction) throw new TypeError("Prepared material requires a published Sun direction.");
  const reference = view.reference?.sunViewDirection ?? direction;
  const useDefault = view.sceneMatrix === view.reference?.sceneMatrix &&
    direction.every((value, i) => Math.abs(value-reference[i]) < 1e-9);
  const far = track.farBank !== undefined && (view.levelOfDetail?.stage ?? "geometry") !== "geometry";
  const bank = track.banks.find(bank => bank.id === (far ? track.farBank : selected.bank));
  if (!bank) throw new TypeError(`Unprepared material bank: ${selected.bank}.`);
  const mode = selected.mode === "fixed" ? selected.fixedMode : useDefault && bank.default ? "default" : "directional";
  const address = selected.mode === "fixed" ? bank.fixed : useDefault && bank.default ? bank.default : bank.frames[frame];
  return { frame, calculatedFrame, useDefault, bank, address, row: address?.row ?? null, mode,
    enabled: selected.enabled, rotationEnabled: selected.rotationEnabled,
    sunViewDirection: direction, referenceDirection: reference };
}

export function preparedMaterialAddress(state: ReturnType<typeof preparedMaterialState>, resources: Pick<PreparedResources, "has">) {
  const address = state.address;
  return address && (address.resource === null || resources.has(address.resource)) ? address : null;
}

export function createPreparedMaterialPublisher(track: PreparedMaterialTrack,element: HTMLElement) {
  let lastAddress: string | null=null;
  let state: PreparedMaterialObservation={bank:null,frame:track.defaultFrame,calculatedFrame:track.defaultFrame,appliedFrame:null,appliedRow:null,row:null,mode:null,
    lightRollDegrees:0,addressWrites:0,transformWrites:0,enabled:false,rotationEnabled:false,sunViewDirection:null};
  const rotation = track.rotation;
  const projection = rotation?.physical ?? (rotation?.kind === "ellipsoid" ? rotation : null);
  if (rotation?.kind === "planar" && !projection) throw new TypeError("Planar materials require a prepared physical projection.");
  const project = projection ? createPreparedEllipsoidProjection(projection) : null;
  const write=(name: string,value: string)=>{
    const current=readPreparedStyle(element.style,name);
    if(current===value)return false;
    writePreparedStyle(element.style,name,value);
    return true;
  };
  return Object.freeze({
    publish(selected: PreparedMaterialSelection,view: PreparedView,resources: Pick<PreparedResources, "has" | "url">){
      const next=preparedMaterialState(track,selected,view);
      state={...state,bank:next.bank.id,frame:next.frame,calculatedFrame:next.calculatedFrame,row:next.row,mode:selected.modeLabel??next.mode,enabled:next.enabled,
        rotationEnabled:next.rotationEnabled,sunViewDirection:next.sunViewDirection};
      const address=preparedMaterialAddress(next,resources);
      const publishHidden=selected.publishWhenHidden??"always";
      const publishAddress=next.enabled||publishHidden==="always"||publishHidden==="static"&&next.mode!=="directional";
      let addressPublished=false;
      if(!next.enabled&&selected.clearWhenHidden){if(write("backgroundImage","none"))state.addressWrites++;lastAddress=null;}
      else if(address&&publishAddress){
        const url=address.resource===null?null:resources.url(address.resource);
        if(address.resource!==null&&!url)throw new Error("A ready prepared material has no decoded URL.");
        // CSSOM may quote or normalize a prepared declaration when reading it
        // back. Cache the published address, rather than rewriting that same
        // declaration on every frame because its serialization differs.
        const signature=JSON.stringify([next.bank.id,next.mode,selected.mode==="fixed"?null:next.frame,
          url,address.backgroundPosition,address.backgroundSize]);
        if(signature!==lastAddress){
          if(url!==null&&write("backgroundImage",track.quoted?`url(${JSON.stringify(url)})`:`url(${url})`))state.addressWrites++;
          for(const name of ["backgroundPosition","backgroundSize"] as const)if(write(name,address[name]))state.addressWrites++;
          lastAddress=signature;
        }
        state.appliedFrame=address.frame;state.appliedRow=address.row;
        addressPublished=true;
        for(const binding of selected.addressAttributes??[]){
          const value=binding.source==="frame"?String(next.frame):binding.source==="mode"?next.mode:
            binding.source==="mode-or-frame"?next.mode==="directional"?String(next.frame):next.mode:binding.value;
          if(value===null)element.removeAttribute(binding.name);else element.setAttribute(binding.name,value);
        }
      }
      if(track.rotation&&(!track.rotation.onlyWhenEnabled||next.enabled)&&(!track.rotation.publishWithAddress||addressPublished)){
        const rotation=track.rotation;
        const direction=next.sunViewDirection;
        const reference=next.referenceDirection;
        const base=rotation.reference==="initial"?Math.atan2(reference[1],reference[0])*180/Math.PI:rotation.baseDegrees;
        const angle=!selected.rotationEnabled?0:rotation.polePolicy!=="azimuth"&&Math.hypot(direction[0],direction[1])<1e-9?
          rotation.zeroAtPole?0:state.lightRollDegrees:degrees(Math.atan2(direction[1],direction[0])*180/Math.PI-base);
        if (project && projection) {
          const transform = project({ degrees: angle, projection: view.projection,
            counterMatrix: view.counterRotationFor(projection.systemTransform) });
          if (rotation.physical) {
            element.style.removeProperty('rotate');
            // These prepared textures carry their centre in the physical matrix.
            if (write('transformOrigin', '0 0')) state.transformWrites++;
          }
          if (write('transform', transform)) state.transformWrites++;
        } else if (rotation.kind === "angle") {
          if(Math.abs(angle-state.lightRollDegrees)>=1e-9||!selected.rotationEnabled||rotation.publishWithAddress){
            if(write(rotation.property,`${angle}deg`))state.transformWrites++;
          }
        } else throw new TypeError("Unknown prepared material rotation.");
        state.lightRollDegrees=angle;
      }
      if(track.frameAttribute)element.setAttribute(track.frameAttribute,String(state.frame));
      if(track.modeAttribute)element.setAttribute(track.modeAttribute,String(state.mode));
    },
    observe:()=>Object.freeze({...state}),
  });
}
