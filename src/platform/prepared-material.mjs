import { createPreparedPlanarRotationPublisher } from "./prepared-planar-rotation.mjs";
import { createPreparedEllipsoidProjection } from "./prepared-ellipsoid-projection.mjs";

const degrees = angle => (angle % 360 + 540) % 360 - 180;
export function preparedMaterialFrame(mapping, view) {
  const phase = view.sunViewDirection[2];
  let low = 0, high = mapping.thresholds.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (phase < mapping.thresholds[middle]) high = middle;
    else low = middle + 1;
  }
  return mapping.indices[low];
}

export function preparedMaterialState(track, selected, view) {
  const calculatedFrame = preparedMaterialFrame(track.frame, view);
  const frame = selected.frameOverride ?? calculatedFrame + (selected.frameOffset ?? 0);
  const direction = view.sunViewDirection;
  const reference = view.reference?.sunViewDirection ?? view.sunViewDirection;
  const useDefault = view.sceneMatrix === view.reference?.sceneMatrix &&
    direction.every((value, i) => Math.abs(value-reference[i]) < 1e-9);
  const far = track.farBank !== undefined && (view.levelOfDetail?.stage ?? "geometry") !== "geometry";
  const bank = track.banks.find(bank => bank.id === (far ? track.farBank : selected.bank));
  const mode = selected.mode === "fixed" ? selected.fixedMode : useDefault && bank.default ? "default" : "directional";
  const address = selected.mode === "fixed" ? bank.fixed : useDefault && bank.default ? bank.default : bank.frames[frame];
  const zoomHidden = track.maximumZoom !== undefined && view.zoom > track.maximumZoom;
  return { frame, calculatedFrame, useDefault, bank, address, row: address?.row ?? null, mode,
    enabled: selected.enabled && !zoomHidden, zoomHidden, rotationEnabled: selected.rotationEnabled,
    sunViewDirection: direction, referenceDirection: reference };
}

export function preparedMaterialAddress(_track, state, resources) {
  const address = state.address;
  return address && (address.resource === null || resources.has(address.resource)) ? address : null;
}

export function createPreparedMaterialPublisher(track,element,camera) {
  let lastAddress=null;
  let state={bank:null,frame:track.defaultFrame,calculatedFrame:track.defaultFrame,appliedFrame:null,appliedRow:null,row:null,mode:null,
    lightRollDegrees:0,addressWrites:0,transformWrites:0,enabled:false,rotationEnabled:false,sunViewDirection:null};
  const planar=track.rotation?.kind==="planar"?createPreparedPlanarRotationPublisher({element,width:track.rotation.width,height:track.rotation.height}):null;
  const ellipsoid=track.rotation?.kind==="ellipsoid"?createPreparedEllipsoidProjection(track.rotation):null;
  const write=(name,value)=>{
    const current=name.startsWith("--")?element.style.getPropertyValue(name):element.style[name];
    if(current===value)return false;
    if(name.startsWith("--"))element.style.setProperty(name,value);else element.style[name]=value;
    return true;
  };
  return Object.freeze({
    publish(selected,view,resources,committedPlan){
      const next=preparedMaterialState(track,selected,view,camera,committedPlan);
      state={...state,bank:next.bank.id,frame:next.frame,calculatedFrame:next.calculatedFrame,row:next.row,mode:selected.modeLabel??next.mode,enabled:next.enabled,
        rotationEnabled:next.rotationEnabled,sunViewDirection:next.sunViewDirection};
      const address=preparedMaterialAddress(track,next,resources);
      const publishHidden=selected.publishWhenHidden??"always";
      const publishAddress=next.enabled||publishHidden==="always"||publishHidden==="static"&&next.mode!=="directional";
      let addressPublished=false;
      if(next.zoomHidden||!next.enabled&&selected.clearWhenHidden){if(write("backgroundImage","none"))state.addressWrites++;lastAddress=null;}
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
          for(const name of ["backgroundPosition","backgroundSize"])if(write(name,address[name]))state.addressWrites++;
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
        if(rotation.kind==="angle"){
          if(Math.abs(angle-state.lightRollDegrees)>=1e-9||!selected.rotationEnabled||rotation.publishWithAddress){
            if(write(rotation.property,`${angle}deg`))state.transformWrites++;
          }
        }else if(planar){if(planar(angle))state.transformWrites++;}
        else if(ellipsoid){
          const transform=ellipsoid({degrees:angle,sceneMatrix:view.sceneMatrix,
            counterMatrix:view.counterRotationFor(rotation.systemTransform),preserveDefault:next.useDefault});
          if(write("transform",transform))state.transformWrites++;
        }else throw new TypeError("Unknown prepared material rotation.");
        state.lightRollDegrees=angle;
      }
      if(track.frameAttribute)element.setAttribute(track.frameAttribute,String(state.frame));
      if(track.modeAttribute)element.setAttribute(track.modeAttribute,state.mode);
    },
    observe:()=>Object.freeze({...state}),
  });
}
