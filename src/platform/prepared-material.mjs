import { preparedScenePitch } from "./cubic-sky-runtime.mjs";
import { viewSunDirectionToPreparedLightDirection } from "./directional-sun-coordinate.mjs";
import { createPreparedPlanarRotationPublisher } from "./prepared-planar-rotation.mjs";
import { createPreparedEllipsoidProjection } from "./prepared-ellipsoid-projection.mjs";

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const degrees=angle=>(angle%360+540)%360-180;
export function remapPreparedScalar(value,remap) {
  if(remap===null)return value;
  const [lowerStart,lowerEnd]=remap.lowerTransition,[plateauStart,plateauEnd]=remap.plateau,[upperStart,upperEnd]=remap.upperTransition;
  if(value<=lowerStart||value>=upperEnd)return value;
  if(value<lowerEnd){const amount=(value-lowerStart)/(lowerEnd-lowerStart);return value*(1-amount)+remap.plateauViewZ*amount;}
  if(value>=plateauStart&&value<=plateauEnd)return remap.plateauViewZ;
  const amount=(value-upperStart)/(upperEnd-upperStart);return remap.plateauViewZ*(1-amount)+value*amount;
}
export function preparedMaterialFrame(mapping,view,camera) {
  let value;
  if(mapping.source==="sun-z")value=view.sunViewDirection[2];
  else if(mapping.source==="prepared-light-z")value=viewSunDirectionToPreparedLightDirection(view.skySunViewDirection)[2];
  else if(mapping.source==="scene-pitch")value=preparedScenePitch(view.controlPitch,camera);
  else if(mapping.source==="reference-sun-z")value=view.reference.sunViewDirection[2]-view.sunViewDirection[2];
  else throw new TypeError("Unknown prepared frame source.");
  value=remapPreparedScalar(value,mapping.remap);
  const frame=mapping.baseFrame+(mapping.step===undefined
    ?(value-mapping.minimum)/(mapping.maximum-mapping.minimum)*(mapping.span??mapping.count-1)
    :(value-mapping.minimum)/mapping.step);
  return Math.round(clamp(frame,0,mapping.maximumFrame??mapping.count-1));
}
export function preparedMaterialState(track,selected,view,camera,previous) {
  const calculatedFrame=preparedMaterialFrame(track.frame,view,camera),frame=selected.frameOverride??(calculatedFrame+(selected.frameOffset??0));
  const useDefault=track.defaultPose.every(test=>{
    const value=test.source==="control-pitch"?view.controlPitch:test.source==="control-yaw"?view.controlYaw:calculatedFrame;
    return Math.abs(value*test.scale+test.offset-test.value)<test.epsilon;
  });
  // Past the geometry stage the far bank (when the track has one) replaces
  // the selected bank: the same frame from one small atlas.
  const far=track.farBank!==undefined&&(view.levelOfDetail?.stage??"geometry")!=="geometry";
  const bank=track.banks.find(bank=>bank.id===(far?track.farBank:selected.bank));
  const mode=selected.mode==="fixed"?selected.fixedMode:selected.mode==="default-pose"&&useDefault?"default":"directional";
  const address=selected.mode==="fixed"?bank.fixed:selected.mode==="default-pose"&&useDefault?bank.default:bank.frames[frame];
  const row=track.demand.holdHiddenNeighborhood&&selected.mode==="fixed"&&previous?.mode===selected.fixedMode&&previous.bank===bank.id
    ?previous.row:bank.frames[frame].row;
  return {frame,calculatedFrame,useDefault,bank,address,row,mode,
    enabled:selected.enabled,rotationEnabled:selected.rotationEnabled,
    sunViewDirection:track.frame.source==="prepared-light-z"?view.skySunViewDirection:view.sunViewDirection};
}

export function preparedMaterialAddress(track, state, resources) {
  const address = state.address;
  if (!address || address.resource === null || resources.has(address.resource)) return address;
  if (track.demand.fallback === "hold") return null;
  // The bank carries row extents and addresses; no atlas is constructed here.
  // Match the native receipt order when equally distant rows are available.
  let nearest = null, distance = Infinity;
  for (const key of resources.readyKeys()) {
    const row = state.bank.rows.find(row => row.resource === key);
    if (!row) continue;
    const delta = Math.abs(row.row - state.row);
    if (delta < distance) { nearest = row; distance = delta; }
  }
  if (!nearest) return null;
  const frame = track.demand.fallback === "same-column"
    ? Math.min(nearest.lastFrame, nearest.firstFrame + state.frame % track.demand.framesPerRow)
    : clamp(state.frame, nearest.firstFrame, nearest.lastFrame);
  return state.bank.frames[frame];
}

export function createPreparedMaterialPublisher(track,element,camera) {
  let lastAddress=null;
  let state={bank:null,frame:track.demand.defaultFrame,calculatedFrame:track.demand.defaultFrame,appliedFrame:null,appliedRow:null,row:null,mode:null,
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
        const direction=rotation.source==="prepared-light"?viewSunDirectionToPreparedLightDirection(view.skySunViewDirection):view.sunViewDirection;
        const reference=rotation.source==="prepared-light"?viewSunDirectionToPreparedLightDirection(view.reference.skySunViewDirection):view.reference.sunViewDirection;
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
