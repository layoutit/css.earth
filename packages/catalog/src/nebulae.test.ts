import { expect, test } from 'vitest';
import { parsePreparedNebulaCatalog, isPreparedNebula } from './nebulae.js';
const fixture=()=>({schema:'cssearth-nebula-catalog@1',frame:{referenceFrame:'sun-icrf',epochJdTt:2461286.5},
  sources:[{id:'paper',url:'https://example.org/paper',sha256:'a'.repeat(64),bytes:10,citation:'Original measurement'}],
  objects:[{id:'fixture',kind:'nebula',name:'Example',aliases:[],positionM:[1,2,3],skyPosition:{raDeg:12,decDeg:-5,sourceRef:'paper'},
    distance:{valuePc:100,sourceRef:'paper',method:'Parallax'},classification:{name:'Emission nebula',basis:'Observed extended emission; modeled depth.',sourceRef:'paper'},status:'confirmed',detailedObjectId:'fixture'}]});
test('nebula records preserve scientific type and are never classified as galaxies',()=>{
 const input=fixture(), parsed=parsePreparedNebulaCatalog(input);expect(parsed).toBe(input);expect(isPreparedNebula(parsed.objects[0]!)).toBe(true);
 expect(isPreparedNebula({})).toBe(false);
});
test('nebula source references, sky domain and distance are guarded',()=>{
 for(const change of [(v:ReturnType<typeof fixture>)=>{v.objects[0]!.skyPosition.raDeg=360;},
  (v:ReturnType<typeof fixture>)=>{v.objects[0]!.distance.valuePc=0;},
  (v:ReturnType<typeof fixture>)=>{v.objects[0]!.classification.sourceRef='missing';},
  (v:ReturnType<typeof fixture>)=>{v.objects.push(v.objects[0]!);}]){const v=fixture();change(v);expect(()=>parsePreparedNebulaCatalog(v)).toThrow();}
});

test('optional statistical/systematic uncertainty is validated before focus-card use',()=>{
 for(const uncertainty of [{statisticalPc:NaN,systematicPc:1},{statisticalPc:1,systematicPc:-1},{statisticalPc:1},{statisticalPc:'1',systematicPc:1}]){
  const v=fixture(),distance={...v.objects[0]!.distance,uncertainty};
  expect(()=>parsePreparedNebulaCatalog({...v,objects:[{...v.objects[0],distance}]})).toThrow();
 }
 const v=fixture();expect(parsePreparedNebulaCatalog({...v,objects:[{...v.objects[0],distance:{...v.objects[0]!.distance,uncertainty:{statisticalPc:0,systematicPc:1}}}]}).objects[0]!.distance.uncertainty?.systematicPc).toBe(1);
});
