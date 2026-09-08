import test from 'node:test';
import assert from 'node:assert/strict';
import {createDestinationBrowser} from '../destination-browser.mjs';

class Element extends EventTarget {
  hidden=false; dataset={}; textContent='';
  querySelector(){return null;}
  querySelectorAll(){return [];}
}
function fixture(){
  const hint=new Element(),status=new Element(),panel=new Element(),list=new Element(),root=new Element();
  root.querySelector=selector=>selector==='.planet-destination-list'?list:hint;
  panel.querySelector=()=>status;
  const windowTarget=new EventTarget();windowTarget.location=new URL('https://example.test/earth/');
  const writes=[];
  windowTarget.history={state:null,...Object.fromEntries(['pushState','replaceState'].map(method=>[method,(_state,_title,url)=>{
    windowTarget.location=new URL(url,windowTarget.location);writes.push({method,url:windowTarget.location.href});
  }]))};
  let shown='earth',selected=null;
  const pending=new Map(),signals=new Map();
  const browser=createDestinationBrowser({
    documentTarget:{defaultView:windowTarget,querySelector:selector=>selector==='.planet-destination-results'?root:panel},
    card:{initial:{id:'earth',lensIds:['normal']},show(entity){shown=entity.id;},introductionLoading(){},showIntroduction(){}},
    onSelected(){},onReset(){},onResults(){},
  });
  const provider={
    async resolve(id,signal){signals.set(id,signal);await pending.get(id);return {entity:{id,name:id,coverage:'detail'},ancestors:[]};},
    async select(entity){selected=entity;return {arrival:null};},
    async reset(){selected=null;return {};},
    lens:()=>({id:'normal'}),selectLens:async()=>true,state:()=>selected,subscribe:()=>()=>{},search:async()=>[],
  };
  return {browser,provider,panel,status,writes,signals,
    shown:()=>shown,selected:()=>selected?.id??'earth',
    hold(id){let release;pending.set(id,new Promise(resolve=>{release=resolve;}));return release;},
    restore(id){windowTarget.location.hash=id==='earth'?'':`place=${id}`;return browser.restore();},
    hash:()=>windowTarget.location.hash,
  };
}

for(const previous of ['earth','3435910'])test(`late destination cannot replace a newer restoration to ${previous}`,async()=>{
  const f=fixture();
  try{
    await f.browser.bind(f.provider);
    if(previous!=='earth')await f.browser.selectById(previous);
    f.writes.length=0;
    const target=previous==='earth'?'3435910':'1850147',release=f.hold(target);
    const older=f.restore(target);
    await Promise.resolve();
    assert.ok(f.signals.has(target),'The old entity request is actually pending');
    await f.restore(previous);
    release();await older;
    assert.equal(f.shown(),previous,'A late response must not change the newer card');
    assert.equal(f.selected(),previous,'A late response must not change runtime selection');
    assert.equal(f.hash(),previous==='earth'?'':`#place=${previous}`);
    assert.deepEqual(f.writes,[],'Restoration must not push a stale history entry');
    assert.equal(f.panel.ariaBusy,'false');
    assert.equal(f.status.hidden,true,'A canceled request must not report a missing place on the restored card');
  }finally{f.browser.destroy();}
});
