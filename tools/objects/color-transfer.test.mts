import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { bandColorDisplay, linearToSrgb, srgbToLinear, encodeBandColor } from './color-transfer.mts';

const display = () => bandColorDisplay(['IR3','IR1','UV3'], 'radiance-factor', [0, 1]);

test('ICC sRGB display values and channel ratios survive the final byte boundary',()=>{
  // IEC/ICC transfer: linear 18% gray is code 0.461356, not code 0.18.
  assert.ok(Math.abs(linearToSrgb(.18)-.46135612950044164)<1e-12);
  assert.ok(Math.abs(linearToSrgb(.0031308)-.040449936)<1e-12);
  const bytes=encodeBandColor(new Float32Array([.18,.18,.09]),new Uint8Array([0]),display());
  assert.deepEqual([...bytes],[118,118,85]);
  const ratio=srgbToLinear(bytes[2]/255)/srgbToLinear(bytes[1]/255);
  assert.ok(Math.abs(ratio-.5)<.01,'Source half-strength blue remains half-strength display light, within byte quantization.');
});

test('clipping and quantization happen after a complete floating composite',()=>{
  const mean=(1.5+.1)/2;
  const bytes=encodeBandColor(new Float32Array([mean,mean,mean,NaN,NaN,NaN]),new Uint8Array([0,1]),display());
  assert.deepEqual([...bytes],[231,231,231,0,0,0]);
  assert.notEqual(bytes[0],Math.round(255*linearToSrgb((1+.1)/2)),'Clipping an individual exposure would destroy overlap values.');
  assert.throws(()=>encodeBandColor(new Float32Array([NaN,1,1]),new Uint8Array([0]),display()),/finite/);
  // @ts-expect-error Deliberately exercise the runtime guard against encoding provider bytes again.
  assert.throws(()=>encodeBandColor(new Uint8Array([118,118,85]),new Uint8Array([0]),display()),/floating source values/);
});

test('a band display is always a scientific composite of three distinct source bands on one finite range',()=>{
  assert.deepEqual(display(),{kind:'band-composite',inputQuantity:'radiance-factor',bands:['IR3','IR1','UV3'],displayRange:[0,1],outputEncoding:'srgb'});
  assert.throws(()=>bandColorDisplay(['IR3','IR3','UV3'],'radiance-factor',[0,1]),/three distinct/);
  assert.throws(()=>bandColorDisplay(['IR3','IR1'],'radiance-factor',[0,1]),/three distinct/);
  assert.throws(()=>bandColorDisplay(['IR3','IR1','UV3'],'radiance-factor',[1,0]),/finite range/);
  assert.throws(()=>bandColorDisplay(['IR3','IR1','UV3'],'radiance-factor',undefined));
});
