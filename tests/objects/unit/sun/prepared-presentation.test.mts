import { readPreparedFixture } from '../../fixtures.mts';
const runtimeDefinition = await readPreparedFixture('sun', 'runtime');
import assert from "node:assert/strict";
import test from "node:test";

import { preparedSelectionFixture } from "../../../../src/platform/test/object-runtime-package.mts";

function textures(f) {
  const nodes=f.stage.querySelectorAll("*");
  return [nodes.find(n=>n.className==="polycss-mesh sun-body").style.getPropertyValue("--sun-surface-image"),
    nodes.find(n=>n.className==="polycss-mesh sun-body").style.getPropertyValue("--sun-poles-image"),
    nodes.find(n=>n.className==="sun-corona-layer planet-render-root").style.getPropertyValue("--sun-corona-image"),
    nodes.find(n=>n.className==="sun-limb-layer planet-render-root").style.getPropertyValue("--sun-limb-image")];
}

test("all four sourced solar layers wait for the complete replacement group", async()=>{
  const f=await preparedSelectionFixture(runtimeDefinition);
  try {
    const nodes=f.stage.querySelectorAll("*"),before=textures(f),next=runtimeDefinition.controls.lenses.controls[1].id;
    const action=f.selection.dispatch({kind:"lens",id:next});await f.flush();
    const jobs=f.jobs.filter(job=>!job.done);assert.equal(jobs.length,4);
    for(const job of jobs.slice(0,3)){job.done=true;job.resolve();}await f.flush();
    assert.deepEqual(textures(f),before);assert.notEqual(f.stage.dataset.lens,next);
    jobs[3].done=true;jobs[3].resolve();await f.settle();assert.equal(await action,true);
    assert.ok(textures(f).every((value,index)=>value!==before[index]));
    assert.deepEqual(f.stage.querySelectorAll("*"),nodes);
    f.presentation.publishFrame({view:{...f.view,zoom:2.25,body:{visible:true,
      silhouette:{radial:[1,0],centre:[12,-8],radialSemiAxis:310,tangentialSemiAxis:248}}}});
    for(const node of nodes.filter(n=>n.className.includes("sun-corona-layer")||n.className.includes("sun-limb-layer"))){
      assert.equal(node.style.getPropertyValue("--sun-camera-zoom"),"1");
      assert.equal(node.style.transform,"translate(12px, -8px) rotate(0deg) scale(1.25, 1) rotate(0deg)");
    }
    assert.deepEqual(f.errors,[]);
  }finally{f.restore();}
});

test("failed or retired solar replacement preserves complete committed layers",async()=>{
  for(const retired of [false,true]){
    const f=await preparedSelectionFixture(runtimeDefinition);
    try{
      const before=textures(f),lens=f.stage.dataset.lens,next=runtimeDefinition.controls.lenses.controls[1].id;
      const action=f.selection.dispatch({kind:"lens",id:next});await f.flush();
      const jobs=f.jobs.filter(job=>!job.done);assert.equal(jobs.length,4);
      if(retired){f.lifetime.destroy();await f.settle();assert.equal(await action,false);assert.equal(f.stage.children.length,0);}
      else{
        const rejection=assert.rejects(action,/decode/);jobs[2].done=true;jobs[2].reject(new Error("injected corona decode failure"));
        await rejection;await f.settle();assert.equal(f.stage.dataset.lens,lens);assert.deepEqual(textures(f),before);
        const retry=f.selection.dispatch({kind:"lens",id:next});await f.settle();assert.equal(await retry,true);
        assert.equal(f.stage.dataset.lens,next);assert.equal(f.buttons.filter(button=>button["aria-pressed"]==="true").length,1);
      }
      assert.deepEqual(f.errors,[]);
    }finally{f.restore();}
  }
});
