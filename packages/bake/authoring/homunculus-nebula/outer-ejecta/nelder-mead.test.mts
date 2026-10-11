import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nelderMead } from './nelder-mead.mts';

// Expected values: SciPy 1.18.1, minimize(rosenbrock, x0, method='Nelder-Mead', options), run once.
const rosenbrock = (x: Float64Array) => { let s = 0; for (let i = 0; i < x.length - 1; i++) s += 100 * (x[i + 1]! - x[i]! ** 2) ** 2 + (1 - x[i]!) ** 2; return s; };

test('Nelder-Mead walks SciPy\'s simplex exactly: the same iterations, evaluations and point', () => {
  const tight = nelderMead(rosenbrock, [-1.2, 1, 0.5], { xatol: 1e-8, fatol: 1e-8, maxiter: 600 });
  assert.equal(tight.nit, 259); assert.equal(tight.nfev, 469); assert.equal(tight.status, 0);
  assert.deepEqual(Array.from(tight.x), [1.0000000003795209, 1.0000000005816028, 1.0000000008671737]);
  assert.equal(tight.fun, 1.239424259374864e-17);
  // register_heic.py's tolerances.
  const loose = nelderMead(rosenbrock, [-1.2, 1, 0.5], { xatol: 0.05, fatol: 1e-5, maxiter: 600 });
  assert.equal(loose.nit, 187); assert.equal(loose.nfev, 333);
  assert.deepEqual(Array.from(loose.x), [1.0005608225226292, 1.001243084196544, 1.002387664861785]);
});

test('a zero start takes the 0.00025 step, and the defaults stop at 200 per parameter', () => {
  const r = nelderMead(rosenbrock, [0, 0, 0]);
  assert.equal(r.nit, 165); assert.equal(r.nfev, 289);
  assert.deepEqual(Array.from(r.x), [0.9999888606606928, 0.9999784466502725, 0.9999546148282189]);
  const capped = nelderMead(rosenbrock, [-1.2, 1, 0.5], { xatol: 0, fatol: 0, maxiter: 20 });
  assert.equal(capped.nit, 20); assert.equal(capped.nfev, 35); assert.equal(capped.status, 2); assert.equal(capped.success, false);
  const fevs = nelderMead(rosenbrock, [-1.2, 1, 0.5], { xatol: 0, fatol: 0, maxfev: 30 });
  assert.equal(fevs.nfev, 30); assert.equal(fevs.nit, 17); assert.equal(fevs.status, 1);
});

test('on a kinked and a stepped surface it shrinks and breaks ties as SciPy does', () => {
  // A sum of absolute values (contractions fail, the simplex shrinks) and a staircase (equal values everywhere).
  const kinked = nelderMead(x => Math.abs(x[0]! - 0.3) + 2 * Math.abs(x[1]! + 0.7) + 0.5 * Math.abs(x[2]! - 1), [2, 1, -1], { xatol: 1e-6, fatol: 1e-6, maxiter: 600 });
  assert.equal(kinked.nit, 175); assert.equal(kinked.nfev, 330);
  assert.deepEqual(Array.from(kinked.x), [0.43737897151143035, -0.45924769153044753, 0.9999992827373338]);
  const stepped = nelderMead(x => Math.floor(4 * (x[0]! ** 2 + (x[1]! - 1) ** 2 + 0.5 * x[2]! ** 2)), [2, 1, -1], { xatol: 1e-4, fatol: 1e-4, maxiter: 600 });
  assert.equal(stepped.nit, 26); assert.equal(stepped.nfev, 85); assert.equal(stepped.fun, 2);
  assert.deepEqual(Array.from(stepped.x), [-3.9968028886505635e-15, 1.3111111111111073, -1.1166666666666658]);
});

test('bad input is refused', () => {
  assert.throws(() => nelderMead(rosenbrock, []), /finite/u);
  assert.throws(() => nelderMead(rosenbrock, [1, NaN]), /finite/u);
});
