import { test } from 'node:test';
import assert from 'node:assert/strict';
import { curveFit, forwardDifferenceJacobian, leastSquares, makeStrictlyFeasible, nextAfter, pairwiseSum, thinSvdSolveParts } from './least-squares.mts';

// Expected values: SciPy 1.18.1 (NumPy 2.5.4), least_squares(method='trf') and curve_fit, run once on these inputs.
const V = [-231.3, -154.2, -77.1, 0, 77.10000000000002, 154.20000000000005, 231.3];
const GAUSS_Y = [0.33228982610433494, 0.8746534323266444, 8.118556611897757, 11.104785156306473, 3.800716971455994, 0.5035681929191129, -0.3462991181172946];
const NARROW_Y = [0.3, -0.2, 0.5000047442796098, 2.197219738866798, 0.5997881560104451, 0.25000003380664493, -0.35];
const T = [0, 0.4166666666666667, 0.8333333333333334, 1.25, 1.6666666666666667, 2.0833333333333335, 2.5, 2.916666666666667, 3.3333333333333335, 3.75, 4.166666666666667, 4.583333333333334, 5, 5.416666666666667, 5.833333333333334, 6.25, 6.666666666666667, 7.083333333333334, 7.5, 7.916666666666667, 8.333333333333334, 8.75, 9.166666666666668, 9.583333333333334, 10];
const DECAY_Y = [3.5, 2.946960749152382, 2.4559802786200775, 2.1370204832446804, 1.7646374832094052, 1.6037036428174103, 5.310733090307163, 1.2478706341644565, 1.0179277091342076, 1.0050100383654088, 0.8346165186143675, 0.8342410396111364, 0.7248458623968889, 0.7107355181519712, 0.6627098534976297, 0.6203001219666845, 0.6290948892249975, 0.5553719018883794, 0.6099384989172333, 0.5120215296168058, 0.5953724114918125, 0.48776748298641615, 0.5792765631277207, 0.48011340929474106, 0.5589083750751509];

const gaussian = (v: Float64Array, p: Float64Array) => Float64Array.from(v, q => p[0]! * Math.exp(-0.5 * ((q - p[1]!) / p[2]!) ** 2));
const GAUSS_BOUNDS = { lower: [0, -120, 45], upper: [Infinity, 80, 130] };
const residualsOf = (y: number[]) => (p: Float64Array) => Float64Array.from(gaussian(Float64Array.from(V), p), (q, i) => q - y[i]!);
const decay = (p: Float64Array) => Float64Array.from(T, (t, i) => p[0]! * Math.exp(-p[1]! * t) + p[2]! - DECAY_Y[i]!);
const DECAY_OPTIONS = { lower: [0, 0, -1], upper: [10, 0.3, 2], loss: 'soft_l1' as const, fScale: 0.2 };
const near = (actual: ArrayLike<number>, expected: number[], relative: number) => expected.forEach((e, i) => assert.ok(Math.abs(actual[i]! - e) <= relative * Math.max(1, Math.abs(e)), `component ${i}: ${actual[i]} against ${e}`));

test('a bounded Gaussian fit takes SciPy\'s path: the same evaluations, status and optimum', () => {
  const r = leastSquares(residualsOf(GAUSS_Y), [Math.max(...GAUSS_Y), -20, 70], GAUSS_BOUNDS);
  assert.equal(r.nfev, 6); assert.equal(r.status, 2); assert.ok(r.success);
  near(r.x, [11.79844461196612, -20.0993050258655, 63.889749009585245], 1e-8);
  assert.ok(Math.abs(r.cost - 0.24811059268184574) < 1e-14);
  const narrow = leastSquares(residualsOf(NARROW_Y), [Math.max(...NARROW_Y), -20, 70], GAUSS_BOUNDS);
  assert.equal(narrow.nfev, 10); assert.equal(narrow.status, 2);
  near(narrow.x, [2.199956110526957, 2.8697599876838344, 46.34115379581145], 1e-7);
  assert.ok(Math.abs(narrow.cost - 0.15639222264010444) < 1e-14);
});

test('curveFit returns the optimum, and throws when the evaluations run out, as curve_fit raises', () => {
  near(curveFit(gaussian, V, GAUSS_Y, [Math.max(...GAUSS_Y), -20, 70], [[0, -120, 45], [Infinity, 80, 130]]), [11.79844461196612, -20.0993050258655, 63.889749009585245], 1e-8);
  assert.throws(() => curveFit(gaussian, V, GAUSS_Y, [Math.max(...GAUSS_Y), -20, 70], [[0, -120, 45], [Infinity, 80, 130]], 2), /optimal parameters not found/u);
});

test('soft L1 resists an outlier and stops on an active bound as SciPy does', () => {
  const r = leastSquares(decay, [1, 0.1, 0], DECAY_OPTIONS);
  assert.equal(r.nfev, 9); assert.equal(r.njev, 9); assert.equal(r.status, 1);
  near(r.x, [2.8761696543350883, 0.29999999999999927, 0.21396335765459587], 1e-8);
  assert.ok(r.x[1]! < 0.3, 'strictly inside the upper bound');
  assert.ok(Math.abs(r.cost - 0.935292033238486) < 1e-14);
  // Four evaluations: SciPy's status 0 and its iterate.
  const short = leastSquares(decay, [1, 0.1, 0], { ...DECAY_OPTIONS, maxNfev: 4 });
  assert.equal(short.status, 0); assert.equal(short.success, false); assert.equal(short.nfev, 4);
  near(short.x, [2.7580385653260073, 0.27216542246938413, 0.21572514872005114], 1e-8);
  assert.ok(Math.abs(short.cost - 1.007373450521274) < 1e-8);
});

test('a bounded Rosenbrock valley: each iterate on the way is SciPy\'s (reflections off the bounds, the trust radius, the Levenberg-Marquardt parameter)', () => {
  const residuals = (x: Float64Array) => Float64Array.of(10 * (x[1]! - x[0]! ** 2), 1 - x[0]!, 0.3 * (x[0]! + x[1]!));
  const path: [number | undefined, number[], number, number, number][] = [[2, [-1.3596802809825923, 1.8088149291306002], 2, 2.8727855073226216, 0], [3, [-1.3277662747957726, 1.7696426396845928], 3, 2.720265069487255, 0],
    [6, [-1.0463824757894344, 1.092117736324936], 6, 2.094326339654805, 0], [10, [-0.5408599866848285, 0.2856739108532388], 10, 1.1924051186829319, 0], [undefined, [0.7247045091007634, 0.5240727251542587], 23, 0.10813196739103056, 2]];
  // Pressed against the bounds (x1 from 1 to 3): three reflected steps and two cut or anti-gradient steps on the way.
  const pressed: typeof path = [[2, [-1.576567964128307, 2.5863160670285854], 2, 3.872756146549148, 0], [3, [-1.5702409273282298, 2.4721228607865595], 3, 3.341762454161505, 0],
    [5, [-1.464052764050785, 2.1393902175557917], 5, 3.057125935459624, 0], [6, [-1.285292401441579, 1.626584802822764], 6, 2.6487593622156154, 0], [8, [-1.0087738563084911, 1.0048179112932798], 8, 2.025787590225608, 0],
    [10, [-0.9951231660424404, 1.0000031530352256], 10, 1.994995896373186, 0], [undefined, [-0.9949758917344793, 1.0000000000000002], 13, 1.9949885414351685, 2]];
  for (const [maxNfev, x, nfev, cost, status, x0, lower, upper] of [...path.map(row => [...row, [-1.5, 1.8], [-2, -1], [0.8, 2]] as const), ...pressed.map(row => [...row, [-1.5, 2.9], [-2, 1], [0.9, 3]] as const)]) {
    const r = leastSquares(residuals, x0, { lower, upper, ...(maxNfev === undefined ? {} : { maxNfev }) });
    assert.equal(r.nfev, nfev); assert.equal(r.status, status); // Forward differences magnify a last-bit difference in a step (LAPACK's SVD against this one) to about 1e-8 relative.
    near(r.x, x, 1e-7); assert.ok(Math.abs(r.cost - cost) < 1e-7, `cost ${r.cost} against ${cost}`);
  }
});

test('a knot\'s ambient-line fit (knots3d.py) that wanders: SciPy\'s path while it is defined, and SciPy\'s end with the same residuals', () => {
  // One knot's spectrum near rest velocity. Its fit is ill-posed: SciPy with NumPy's exp ends at A 145509 on the width's
  // bound after 90 evaluations, but with an exp one last bit different (or computed as below, identically in both
  // languages) SciPy itself stops at A 74805. The exp here is (1 + t/2^20)^(2^20) by squaring, so both sides see the
  // same residuals to the bit; the iterates then agree until forward differences magnify a last-bit step difference.
  const v = [-223.4241943359375, -146.33816528320312, -69.25215148925781, 7.833866596221924, 84.91988372802734, 162.0059051513672, 239.0919189453125];
  const y = [24825.230224609375, 72735.2041015625, 126770.97265625, -13168.546875, -30006.384643554688, 100514.966796875, 57621.0712890625];
  const exp = (t: number) => { let r = 1 + t / 1048576; for (let k = 0; k < 20; k++) r *= r; return r; };
  const residuals = (p: Float64Array) => Float64Array.from(v, (q, i) => { const z = (q - p[1]!) / p[2]!; return p[0]! * exp(-0.5 * (z * z)) - y[i]!; });
  for (const [maxNfev, x] of [[2, [72844.92252036626, -61.75658127800481, 86.95564006032943]], [3, [73201.2201690307, -96.75816658390684, 77.97132332895285]]] as const)
    near(leastSquares(residuals, [126770.97265625, -20, 70], { ...GAUSS_BOUNDS, maxNfev }).x, [...x], 1e-7);
  const end = leastSquares(residuals, [126770.97265625, -20, 70], GAUSS_BOUNDS);
  assert.equal(end.status, 3);
  near(end.x, [74804.69609929527, -100.79115689789649, 64.80813405169714], 1e-3);
});

test('the forward difference turns back at a bound', () => {
  const f = (x: Float64Array) => Float64Array.of(x[0]! ** 2, Math.sqrt(1 - x[0]!));
  const lb = Float64Array.of(0), ub = Float64Array.of(1), x0 = Float64Array.of(1 - 1e-12), J = forwardDifferenceJacobian(f, x0, f(x0), lb, ub);
  // A forward step would leave the bound and take the square root of a negative number.
  assert.ok(Number.isFinite(J[1]!) && J[1]! < 0 && Math.abs(J[0]! - 2) < 1e-6, `a backward step: ${Array.from(J)}`);
});

test('the helpers: pairwise sums, nextafter, strict feasibility and the SVD parts', () => {
  const values = Float64Array.from({ length: 300 }, (_, i) => 0.1 * (i % 7) + 1e-9 * i);
  let plain = 0; for (const v of values) plain += v;
  assert.ok(Math.abs(pairwiseSum(values) - plain) < 1e-11);
  assert.equal(pairwiseSum([0.1, 0.2, 0.3]), 0.1 + 0.2 + 0.3);
  assert.equal(nextAfter(1, 2), 1 + 2 ** -52); assert.equal(nextAfter(1, 0), 1 - 2 ** -53); assert.equal(nextAfter(-1, 0), -1 + 2 ** -53);
  assert.deepEqual(Array.from(makeStrictlyFeasible(Float64Array.of(0, 5, 10), Float64Array.of(0, 0, 0), Float64Array.of(10, 10, 10))), [1e-10, 5, 10 - 1e-9]);
  const A = Float64Array.of(3, 1, 1, 3, 0, 0, 1, 1), { s, V: Vm, ub } = thinSvdSolveParts(A, 4, 2, Float64Array.of(1, 2, 3, 4));
  near(s, [Math.sqrt(18), Math.sqrt(4)], 1e-12);
  // The least-squares solution V diag(1/s) Uᵀ b equals the normal equations' answer.
  const x = [0, 1].map(i => Vm[i * 2]! * ub[0]! / s[0]! + Vm[i * 2 + 1]! * ub[1]! / s[1]!);
  near(x, [22 / 72, 58 / 72], 1e-12);
});

test('bad input is refused', () => {
  assert.throws(() => leastSquares(decay, [1, 0.1, 0], {}), /only bounded problems/u);
  assert.throws(() => leastSquares(decay, [1, 0.5, 0], DECAY_OPTIONS), /outside the bounds/u);
  assert.throws(() => leastSquares(decay, [1, 0.1, 0], { ...DECAY_OPTIONS, lower: [0, 1, -1] }), /strictly less/u);
});
