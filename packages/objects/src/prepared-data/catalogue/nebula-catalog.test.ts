import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDeepStrictEqual } from 'node:util';
import { parsePreparedNebulaCatalog, isPreparedNebula } from './nebula-catalog.js';
const fixture=()=>({schema:'cssearth-nebula-catalog@1',frame:{referenceFrame:'sun-icrf',epochJdTt:2461286.5},
  sources:[{id:'paper',url:'https://example.org/paper',bytes:10,citation:'Original measurement'}],
  objects:[{id:'fixture',kind:'nebula',name:'Example',aliases:[],positionM:[3.085677581491367e18,0,0],skyPosition:{raDeg:0,decDeg:0,sourceRef:'paper'},
    distance:{valuePc:100,sourceRef:'paper',method:'Parallax'},introduction:{text:'An emission nebula with a source-backed reader introduction.',sourceRefs:['paper']},
    classification:{name:'Emission nebula',basis:'Observed extended emission; modeled depth.',sourceRef:'paper'},status:'confirmed',detailedObjectId:'fixture'}]});
test('nebula records preserve identity in the Galactic volume transport',()=>{
 const input=fixture(), parsed=parsePreparedNebulaCatalog(input);assert.equal(parsed, input);assert.equal(isPreparedNebula(parsed.objects[0]!), true);
 assert.equal(isPreparedNebula({}), false);
});
test('the shared Galactic volume transport preserves globular-cluster identity and source requirements', () => {
 const input=fixture(); input.objects[0]!.kind='globular-cluster';
 const parsed=parsePreparedNebulaCatalog(input);
 assert.equal(parsed.objects[0]!.kind, 'globular-cluster');
 assert.equal(isPreparedNebula(parsed.objects[0]!), true);
 input.objects[0]!.classification.sourceRef='missing';
 assert.throws(()=>parsePreparedNebulaCatalog(input), /Unknown nebula source reference/);
 input.objects[0]!.classification.sourceRef='paper'; input.objects[0]!.kind='galaxy';
 assert.throws(()=>parsePreparedNebulaCatalog(input), /Invalid nebula identity/);
});
test('nebula source references, sky domain and distance are guarded',()=>{
 for(const change of [(v:ReturnType<typeof fixture>)=>{v.objects[0]!.skyPosition.raDeg=360;},
  (v:ReturnType<typeof fixture>)=>{v.objects[0]!.distance.valuePc=0;},
  (v:ReturnType<typeof fixture>)=>{v.objects[0]!.introduction.sourceRefs=['missing'];},
  (v:ReturnType<typeof fixture>)=>{v.objects[0]!.classification.sourceRef='missing';},
  (v:ReturnType<typeof fixture>)=>{v.objects.push(v.objects[0]!);}]){const v=fixture();change(v);assert.throws(()=>parsePreparedNebulaCatalog(v));}
});

test('nebula introductions require bounded copy and distinct source references',()=>{
 const v=fixture(), row=v.objects[0]!;
 for(const introduction of [{text:'',sourceRefs:['paper']},{text:'x'.repeat(181),sourceRefs:['paper']},{text:'Copy',sourceRefs:[]},{text:'Copy',sourceRefs:['paper','paper']}])
  assert.throws(()=>parsePreparedNebulaCatalog({...v,objects:[{...row,introduction}]}));
});

test('optional statistical/systematic uncertainty is validated before focus-card use',()=>{
 for(const uncertainty of [{statisticalPc:NaN,systematicPc:1},{statisticalPc:1,systematicPc:-1},{statisticalPc:1},{statisticalPc:'1',systematicPc:1}]){
  const v=fixture(),distance={...v.objects[0]!.distance,uncertainty};
  assert.throws(()=>parsePreparedNebulaCatalog({...v,objects:[{...v.objects[0],distance}]}));
 }
 const v=fixture();assert.equal(parsePreparedNebulaCatalog({...v,objects:[{...v.objects[0],distance:{...v.objects[0]!.distance,uncertainty:{statisticalPc:0,systematicPc:1}}}]}).objects[0]!.distance.uncertainty?.systematicPc, 1);
});


test('an adopted distance preserves its measured subject without claiming a dust distance', () => {
 const v=fixture(), row=v.objects[0]!;
 const subject={id:'illuminating-cluster',name:'Illuminating cluster',relationship:'Associated stellar cluster',reason:'Stellar distance locates the dust scene.'};
 const value={...v,objects:[{...row,distance:{...row.distance,subject}}]};
 assert.deepEqual(parsePreparedNebulaCatalog(value).objects[0]!.distance.subject, subject);
 for(const invalid of [{...subject,id:row.id},{...subject,reason:''},{...subject,relationship:3}])
  assert.throws(()=>parsePreparedNebulaCatalog({...v,objects:[{...row,distance:{...row.distance,subject:invalid}}]}));
});
