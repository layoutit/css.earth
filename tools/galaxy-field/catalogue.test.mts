import assert from 'node:assert/strict';
import { sourceTest } from '../../tests/objects/source-test.mts';
const test = sourceTest();
import { positionMpc, distanceModulusMpc, distanceModulusIntervalMpc } from './catalogue.mts';
test('distance moduli and equatorial axes preserve physical scale and direction',()=>{
  assert.equal(distanceModulusMpc(25),1);assert.equal(distanceModulusMpc(30),10);
  assert.deepEqual(positionMpc(0,0,10),[10,0,0]);
  const north=positionMpc(90,0,10);assert.ok(Math.abs(north[0])<1e-12);assert.equal(north[1],10);
  const pole=positionMpc(0,90,10);assert.ok(Math.abs(pole[0])<1e-12);assert.equal(pole[2],10);
  assert.throws(()=>positionMpc(0,100,1));assert.throws(()=>distanceModulusMpc(NaN));
});

test('modulus uncertainty keeps its asymmetric distance interval and rejects invalid errors', () => {
  const [lo, hi] = distanceModulusIntervalMpc(30, 1);
  assert.ok(Math.abs(lo - 6.309573444801933) < 1e-12);
  assert.ok(Math.abs(hi - 15.848931924611133) < 1e-12);
  assert.ok(hi - 10 > 10 - lo);
  assert.deepEqual(distanceModulusIntervalMpc(30, 0), [10, 10]);
  assert.throws(() => distanceModulusIntervalMpc(30, -1));
  assert.throws(() => distanceModulusIntervalMpc(30, NaN));
});
