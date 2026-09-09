import assert from 'node:assert/strict';
import test from 'node:test';
import { cutInteriorPoles } from '../../../../tools/objects/paged-ellipsoid/interior-poles.mjs';
import { runtimeDefinition } from './prepared-fixture.mjs';
import { preparedSelectionFixture } from '../../../../src/platform/test/object-runtime-package.mjs';

test('both polar faces remove the cut wedge and retain the opposite quadrant', () => {
  const size=8, pixels=Buffer.alloc(size*4*size*4,255);
  cutInteriorPoles(pixels,size,{centerLongitudeDegrees:-45,widthDegrees:90});
  const alpha=(tile,x,y)=>pixels[(y*size*4+tile*size+x)*4+3];
  for(const tile of [0,1]) {
    assert.equal(alpha(tile,6,1),0,'cut quadrant is transparent at both poles');
    assert.equal(alpha(tile,1,6),255,'opposite quadrant stays opaque');
  }
  assert.equal(alpha(2,6,1),255,'unselected inner apron tiles are unchanged');
});

test('a cut spanning the longitude seam removes both sides of 180 degrees', () => {
  const size=8, pixels=Buffer.alloc(size*4*size*4,255);
  cutInteriorPoles(pixels,size,{centerLongitudeDegrees:180,widthDegrees:90});
  for(const y of [2,5]) assert.equal(pixels[(y*size*4+1)*4+3],0);
  assert.equal(pixels[(2*size*4+6)*4+3],255);
});

test('Shadows publishes a complete distinct cutaway exterior bank without replacing DOM', async () => {
  const f=await preparedSelectionFixture(runtimeDefinition);
  try {
    const select=f.selection.dispatch({kind:'lens',id:'cross-section'});await f.settle();await select;
    const nodes=f.stage.querySelectorAll('*');
    const surface=nodes.find(n=>n.classList.contains('earth-cutaway-body')&&!n.classList.contains('earth-cutaway-body-polar'));
    const pole=nodes.find(n=>n.classList.contains('earth-cutaway-body-polar'));
    const read=()=>({pages:Array.from({length:7},(_,i)=>surface.style.getPropertyValue(`--earth-surface-page-${i}`)),poles:pole.style.getPropertyValue('--earth-poles-texture')});
    const unlit=read();
    const shadows=f.selection.dispatch({kind:'toggle',name:'shadows',value:true});await f.settle();assert.equal(await shadows,true);
    const lit=read();assert.ok(lit.pages.every((url,i)=>url!==unlit.pages[i]&&url.includes('-lit')));assert.notEqual(lit.poles,unlit.poles);
    const off=f.selection.dispatch({kind:'toggle',name:'shadows',value:false});await f.settle();await off;
    assert.deepEqual(read(),unlit);assert.deepEqual(f.stage.querySelectorAll('*'),nodes);assert.deepEqual(f.errors,[]);
  } finally {f.restore();}
});

test('structure and tomography swap textures on the same cutaway and restore the original structure', async () => {
  const f=await preparedSelectionFixture(runtimeDefinition);
  try {
    const select=async id=>{const pending=f.selection.dispatch({kind:'lens',id});await f.settle();assert.equal(await pending,true);};
    await select('cross-section');
    const nodes=f.stage.querySelectorAll('*');
    const faces=nodes.filter(n=>n.classList.contains('earth-interior-section-face'));
    const mantle=nodes.filter(n=>n.classList.contains('earth-interior-mantle-leaf'));
    const core=nodes.filter(n=>n.classList.contains('earth-interior-inner-core-leaf'));
    assert.ok(faces.length&&mantle.length&&core.length);
    const images=items=>items.map(n=>n.style['background-image']);
    const original={faces:images(faces),mantle:images(mantle),core:images(core)};
    assert.ok(original.faces.every(url=>url.includes('earth-interior-section@2x')));
    await select('mantle-tomography');
    assert.ok(images(faces).every(url=>url.includes('earth-tomography-section@2x')));
    assert.ok(images(mantle).every(url=>url.includes('earth-tomography-mantle@2x')));
    assert.deepEqual(images(core),original.core);
    assert.deepEqual(f.stage.querySelectorAll('*'),nodes);
    await select('cross-section');
    assert.deepEqual({faces:images(faces),mantle:images(mantle),core:images(core)},original);
    assert.deepEqual(f.stage.querySelectorAll('*'),nodes);
    assert.deepEqual(f.errors,[]);
  } finally {f.restore();}
});
