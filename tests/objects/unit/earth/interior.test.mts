import {required} from '../../../../tools/contract/test-values.mts';
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import sharp from 'sharp';
import { cutInteriorPoles } from '../../../../tools/objects/paged-ellipsoid/interior-poles.mts';
import { runtimeDefinition, PREPARED_EARTH_SCENE } from './prepared-fixture.mts';
import { preparedSelectionFixture } from '../../../../src/platform/test/object-runtime-package.mts';

test('both polar faces remove the cut wedge and retain the opposite quadrant', () => {
  const size=8, pixels=Buffer.alloc(size*4*size*4,255);
  cutInteriorPoles(pixels,size,{centerLongitudeDegrees:-45,widthDegrees:90});
  const alpha=(tile: number,x: number,y: number)=>pixels[(y*size*4+tile*size+x)*4+3];
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
    const surface=required(nodes.find(n=>n.classList.contains('earth-cutaway-body')&&!n.classList.contains('earth-cutaway-body-polar')));
    const pole=required(nodes.find(n=>n.classList.contains('earth-cutaway-body-polar')));
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
    const select=async (id: string)=>{const pending=f.selection.dispatch({kind:'lens',id});await f.settle();assert.equal(await pending,true);};
    await select('cross-section');
    const nodes=f.stage.querySelectorAll('*');
    const faces=nodes.filter(n=>n.classList.contains('earth-interior-section-face'));
    const mantle=nodes.filter(n=>n.classList.contains('earth-interior-mantle-leaf'));
    const core=nodes.filter(n=>n.classList.contains('earth-interior-inner-core-leaf'));
    assert.ok(faces.length&&mantle.length&&core.length);
    const images=(items: typeof nodes)=>items.map(n=>n.style['background-image']);
    const original={faces:images(faces),mantle:images(mantle),core:images(core)};
    assert.ok(original.faces.every(url=>url.includes('earth-interior-section@2x')));
    await select('mantle-tomography');
    assert.ok(images(faces).every(url=>url.includes('earth-tomography-section@2x')));
    assert.ok(images(mantle).every(url=>url.includes('earth-tomography-mantle@2x')));
    assert.ok(images(core).every(url=>url.includes('earth-tomography-inner-core@2x')));
    assert.deepEqual(f.stage.querySelectorAll('*'),nodes);
    await select('cross-section');
    assert.deepEqual({faces:images(faces),mantle:images(mantle),core:images(core)},original);
    assert.deepEqual(f.stage.querySelectorAll('*'),nodes);
    assert.deepEqual(f.errors,[]);
  } finally {f.restore();}
});

test('the inner core follows the same open cut as the surrounding layers at both poles', async () => {
  const shells=PREPARED_EARTH_SCENE.interior.shells;
  assert.equal(required(shells.at(-1)).leaves.length,required(shells.find(s=>s.id==='outer-core')).leaves.length);
  for(const bank of ['interior','tomography']) {
    const file=new URL(`../../../../public/scenes/earth/earth-${bank}-inner-core-poles@2x.webp`,import.meta.url);
    const {data,info}=await sharp(await readFile(file)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const size=info.height;
    for(const tile of [0,1]) {
      const alpha=(x: number,y: number)=>data[(y*info.width+tile*size+x)*4+3];
      assert.equal(alpha(Math.floor(size*.7),Math.floor(size*.2)),0,'removed wedge stays open');
      assert.equal(alpha(Math.floor(size*.3),Math.floor(size*.8)),255,'opposite core remains opaque');
    }
  }
});
