import test from 'node:test';
import assert from 'node:assert/strict';
import { projectCityPage } from './prepared-map/city-page-selection.mjs';
import { selectBackingReplacements } from './prepared-map/backing-replacements.mjs';

const matrix=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1], viewport={width:800,height:600};
const shape={corners:[[-20,-20,0],[20,-20,0],[20,20,0],[-20,20,0]],normal:[0,0,1]};
const group=key=>({key,lineage:['root',key],pages:[key+'-image']});
function fixture(){
  const nodes=new Map([['root',{key:'root',...shape,children:['a','b','c','d']}],
    ...['a','b','c','d'].map(key=>[key,{key,...shape,children:[]}]),
    ['backing',{key:'backing',...shape,replacement:{branches:[['root']]}}]]);
  const backing=[{key:'backing',lineage:['backing'],pages:['backing']}];
  return {nodes,backing,fine:{groups:['a','b','c','d'].map(group)}};
}
test('retirement requires a complete prepared cut through every replacement root',()=>{
  const {nodes,backing,fine}=fixture();
  const select=()=>selectBackingReplacements(backing,fine,nodes,node=>projectCityPage(node,matrix,1,viewport).visible);
  assert.deepEqual(select()[0].replacements,['a','b','c','d']);
  fine.groups[3].pending=true; assert.deepEqual(select(),[]);
  fine.groups[3].pending=false; nodes.get('root').children.pop(); assert.deepEqual(select(),[]);
  nodes.get('root').children.push('d'); nodes.get('d').stub=true; assert.deepEqual(select(),[]);
});
test('unrelated metadata and conservatively culled branches do not block local replacement',()=>{
  const {nodes,backing,fine}=fixture();
  nodes.get('d').normal=[0,0,-1]; fine.groups.pop();
  fine.groups.push({key:'elsewhere',lineage:['elsewhere'],pages:[],pending:true});
  assert.deepEqual(selectBackingReplacements(backing,fine,nodes,node=>projectCityPage(node,matrix,1,viewport).visible)[0].replacements,['a','b','c']);
  nodes.get('backing').replacement.branches.push(['missing']);
  assert.deepEqual(selectBackingReplacements(backing,fine,nodes,node=>projectCityPage(node,matrix,1,viewport).visible),[]);
});
