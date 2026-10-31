import { test } from 'node:test';
import assert from 'node:assert/strict';
import { complexOf, fft, fft2, ifft, ifft2, transformColumnsThenRows, type Complex } from './fft.mts';

/** numpy.fft.fft of x[n] = sin(0.7 n) + 0.3 cos(1.3 n) + 0.1 n i, and numpy.fft.fft2 of the 5 x 6 array
 * sin(0.3 x + 0.5 y) + cos(0.2 x y) i (rows y), from the scratch venv's numpy: [real parts, imaginary parts]. */
const NUMPY_FFT = { 8: [[0.6938580872580213, -1.9402058476226591, 0.5025491938130354, 0.4577486946321464, 0.6032161312999809, 0.7891195445306225, 1.3025491938130354, -0.008834997724182697], [2.8000000000000003, -3.8890524116766616, -1.6879998137286885, -0.7215079112315239, -0.3999999999999999, -0.07849208876847635, 0.8879998137286885, 3.0890524116766622]], 12: [[1.9741435103189768, 2.495153750760079, -2.948221992285404, -1.4262333544413028, -0.881781919836436, -0.6027529575843967, -0.4177518556542591, -0.28121392666704903, -0.18896159680888525, -0.22623335444130277, -0.8697610232027512, 6.973614719842732], [6.600000000000001, -2.4616276443138863, 1.9114488300901624, -1.1595587128821165, -0.6449587349296436, -0.6009416884931877, -0.6000000000000008, -0.5990583115068128, -0.5550412650703566, -0.04044128711788347, -3.111448830090162, 1.261627644313886]], 31: [[2.9185074504657544, -12.06525624520288, -3.2009773897041143, 6.607012154026485, -11.61215342172941, -5.046624703988333, -2.67008137202774, -3.3395386022666185, -2.3455059787859076, -1.829334735623924, -1.4594116577177578, -1.1678301611707098, -0.9254037456522219, -0.7161426199680139, -0.5301563080534799, -0.36085544710858997, -0.20364124040166331, -0.05525377581172247, 0.08650299044788928, 0.22271018222960315, 0.35279243501420726, 0.47283311685284735, 0.5702438772024971, 0.6012637556367736, 0.2715291703809517, 1.783810163527692, 0.5385052137061859, -4.388299181745783, 16.487426499862213, 11.883797284969674, 18.4195322926361], [46.500000000000014, -1.6058115170447287, -1.7486100142333258, -2.7285372695849137, 0.3001322831973967, -0.12935444758969328, 2.0460136252705308, -3.6913103140088808, -2.2488013044976762, -1.9336955367255637, -1.796428875467616, -1.7180400457245621, -1.6654699583916102, -1.625917400105042, -1.5932762484472858, -1.5640760983649455, -1.535923901635058, -1.5067237515527183, -1.4740825998949598, -1.434530041608394, -1.381959954275441, -1.3035711245323898, -1.1663044632744408, -0.851198695502327, 0.5913103140088751, -5.1460136252705375, -2.9706455524103097, -3.4001322831974004, -0.37146273041508926, -1.3513899857666773, -1.4941884829552758]] };
const NUMPY_FFT2 = [[[19.784407049861088, 6.021108425508977, 2.0598511028494695, 0.5416512478502812, -1.2718236309795743, -7.7690605740392265], [5.0159515677918645, -4.096790678318625, -1.7228323366452487, -1.4501864290633368, -1.4213938555813055, -2.6764426251007216], [1.9370447124284236, -1.7565853664797058, -0.7580120134220953, -0.7986038242182613, -0.8901544679858184, -1.065061493930678], [-0.36837871855672333, -1.5338331180501699, -0.9368691205406849, -0.7464945467146259, -0.5529410346724128, 0.8071440849264819], [-8.503906300248957, -3.059699726040063, -1.6997449656731625, -0.44466916550713553, 1.0787056557873886, 6.277620144764558]], [[13.009531438345242, 2.4398705217962147, 2.2518451653214444, 2.7559578241253844, 3.4079160737893694, 6.134878976622345], [1.6087894076302542, 4.328430035452609, 0.7839027409225289, -0.036389783125090114, -0.7441900782937974, -2.9372959162390533], [2.7023286938829627, 0.49608660983419567, 0.4272214287181042, 0.04015865413091843, -0.447912426983171, -2.592174683592885], [4.145188332689286, -0.4034192867673208, -0.06106192757160614, -0.4363262286398265, -0.942050672821095, -2.9280384928795624], [8.534162127452255, -2.2304539203244547, -1.953141444917894, -2.323400466491387, -2.7225288581638836, -2.3078838439020872]]];

const signal = (n: number): Complex => ({ re: Float64Array.from({ length: n }, (_, k) => Math.sin(0.7 * k) + 0.3 * Math.cos(1.3 * k)), im: Float64Array.from({ length: n }, (_, k) => 0.1 * k) });
const close = (got: Complex, want: number[][] | number[][][], tolerance: number, label: string) => {
  const re = want[0]!.flat(), im = want[1]!.flat();
  for (let i = 0; i < re.length; i++) { assert.ok(Math.abs(got.re[i]! - (re[i] as number)) < tolerance, `${label} re[${i}]`); assert.ok(Math.abs(got.im[i]! - (im[i] as number)) < tolerance, `${label} im[${i}]`); }
};
/** The DFT by its definition, for lengths numpy's literals do not cover. */
const direct = (x: Complex): Complex => { const n = x.re.length, out = complexOf(n); for (let k = 0; k < n; k++) for (let j = 0; j < n; j++) { const a = -2 * Math.PI * ((k * j) % n) / n; out.re[k] += x.re[j]! * Math.cos(a) - x.im[j]! * Math.sin(a); out.im[k] += x.re[j]! * Math.sin(a) + x.im[j]! * Math.cos(a); } return out; };

test('fft matches numpy for power-of-two and other lengths', () => {
  for (const [n, want] of Object.entries(NUMPY_FFT)) close(fft(signal(Number(n))), want, 1e-12, `fft ${n}`);
  for (const n of [1, 2, 3, 5, 7, 16, 48, 76, 100, 168]) { const want = direct(signal(n)), got = fft(signal(n)); close(got, [Array.from(want.re), Array.from(want.im)], 1e-9, `fft ${n}`); }
});

test('ifft divides by the length and inverts fft', () => {
  for (const n of [1, 6, 31, 64]) { const back = ifft(fft(signal(n))), want = signal(n); close(back, [Array.from(want.re), Array.from(want.im)], 1e-12, `ifft ${n}`); }
  const one = ifft({ re: Float64Array.of(4, 0, 0, 0), im: new Float64Array(4) });
  assert.deepEqual(Array.from(one.re), [1, 1, 1, 1]);
});

test('fft2 matches numpy and ifft2 inverts it', () => {
  const grid = (): Complex => { const out = complexOf(30); for (let y = 0; y < 5; y++) for (let x = 0; x < 6; x++) { out.re[y * 6 + x] = Math.sin(0.3 * x + 0.5 * y); out.im[y * 6 + x] = Math.cos(0.2 * x * y); } return out; };
  close(fft2(grid(), 5, 6), NUMPY_FFT2, 1e-12, 'fft2');
  const back = ifft2(fft2(grid(), 5, 6), 5, 6), want = grid();
  close(back, [Array.from(want.re), Array.from(want.im)], 1e-12, 'ifft2');
});

test('transformColumnsThenRows equals the full transform on the rows it covers', () => {
  const make = (): Complex => { const out = complexOf(64); for (let i = 0; i < 64; i++) { out.re[i] = Math.sin(i); out.im[i] = Math.cos(2 * i); } return out; };
  const full = fft2(make(), 8, 8), part = make(); transformColumnsThenRows(part, 8, 8, 0, 3);
  for (let i = 0; i < 24; i++) { assert.ok(Math.abs(part.re[i]! - full.re[i]!) < 1e-12); assert.ok(Math.abs(part.im[i]! - full.im[i]!) < 1e-12); }
});

test('fft refuses mismatched arrays', () => {
  assert.throws(() => fft({ re: new Float64Array(4), im: new Float64Array(3) }), TypeError);
  assert.throws(() => fft2(complexOf(6), 2, 4), TypeError);
  assert.throws(() => fft(complexOf(0) as Complex), RangeError);
});
