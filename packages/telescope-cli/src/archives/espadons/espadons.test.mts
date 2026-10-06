import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import test from 'node:test';
import { parseTecplotLonLat } from '@cssearth/bake/objects/raster';
import { assignTargets, guide, ledgerStar, recordedResults } from './archive-ledger.mts';
import { recordedStar } from './archive.mts';
import { runsOf } from './archive.mts';
import { compareFields } from './compare.mts';
import { chooseParameters, dwarfRow, parseDwarfSequence } from './catalogue.mts';
import { atomicLines, effectiveLande, lsLande } from './kurucz.mts';
import { maskFile, spectrumFile } from './lsd.mts';
import { candidates, candidateTable, parseCandidateTable, starMask, type MaskLine } from './mask.mts';
import { describeProduct, headerOf, readPolarisedSpectrum, type PolarisedSpectrum } from './product.mts';
import { parseProgram, PROGRAM_SCHEMA } from './program.mts';
import { chooseFit, ladderTargets } from './reduce.mts';
import { runJulia, toolchainPaths } from './toolchain.mts';
import { fieldGrid, lineInput, mapTable, parseFit, parseGeometry, renormInput, zdiInput, type MapRun } from './zdi.mts';

const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url), 'utf8');

test('a product header gives the layout and the mid-exposure time a paper prints for the same spectrum', async () => {
  const cards = (await fixture('921590p.header.txt')).split('\n').filter(Boolean), described = describeProduct(cards);
  assert.deepEqual([described.pixels, described.rows, described.object, described.exposureSeconds], [213794, 24, 'HD 189733', 3600]);
  // Fares et al. (2010), Table 1, 23 June 2007, first ESPaDOnS row: UT at mid-exposure 12:00:39.
  assert.ok(Math.abs((described.mjd - 40587) * 86400000 - Date.parse('2007-06-23T12:00:39Z')) <= 1000);
  assert.throws(() => describeProduct(cards.map(card => card.startsWith('COL3') ? card.replace('Stokes  ', 'Intensit') : card)), /not a polarimetric product/u);
  assert.throws(() => describeProduct(cards.filter(card => !card.startsWith('DATE4'))), /four/u);
  // The rows are big-endian floats, six rows of one value a pixel.
  const small = cards.map(card => card.startsWith('NAXIS1') ? 'NAXIS1  =                    3' : card), bytes = Buffer.alloc(6 * 3 * 4); [500, 500.01, 500.02, 1, 0.5, 1, 1e-4, -2e-4, 0, 1e-5, 0, 0, 0, 0, 0, 0.01, 0.02, 0.01].forEach((value, i) => bytes.writeFloatBE(value, i * 4));
  const spectrum = readPolarisedSpectrum(small, bytes);
  assert.ok(Math.abs(spectrum.wavelengthNm[1]! - 500.01) < 1e-4 && spectrum.intensity[1] === 0.5 && Math.abs(spectrum.stokesV[1]! + 2e-4) < 1e-9 && Math.abs(spectrum.error[1]! - 0.02) < 1e-9);
  assert.throws(() => readPolarisedSpectrum(small, bytes.subarray(4)), /bytes for six rows/u);
  const file = Buffer.from(`${small.map(card => card.padEnd(80)).join('')}${'END'.padEnd(80)}`.padEnd(2880 * 2));
  assert.equal(headerOf(file)!.dataOffset, 2880); assert.equal(headerOf(file.subarray(0, 800)), undefined);
});

test('Kurucz records give textbook Landé factors, with hyperfine components joined and the even level found from the lines', async () => {
  const { lines, entries, undecided } = atomicLines((await fixture('kurucz-excerpt.dat')).split('\n').filter(Boolean), 390, 900), near = (element: number, nm: number) => lines.filter(line => line.element === element && Math.abs(line.nm - nm) < 0.004);
  assert.ok(entries > 30); assert.deepEqual(undecided, []);
  // Fe I 630.25 and 617.33 nm, the two lines solar magnetographs use, have 2.5; Fe I 557.61 nm is the classic insensitive line.
  assert.equal(near(26, 630.2493)[0]!.lande.toFixed(2), '2.49'); assert.equal(near(26, 617.3334)[0]!.lande.toFixed(2), '2.50'); assert.ok(Math.abs(near(26, 557.6089)[0]!.lande) < 0.02);
  assert.equal(near(20, 610.2723)[0]!.lande.toFixed(1), '2.0');
  // The hyperfine components of Mn I 403.00 nm are one line with the transition's whole strength (log gf -3.691).
  const manganese = lines.filter(line => line.element === 25 && Math.abs(line.nm - 403.001) < 0.002);
  assert.equal(manganese.length, 1); assert.ok(Math.abs(manganese[0]!.logGf + 3.691) < 0.02, String(manganese[0]!.logGf));
  assert.ok(lines.every(line => line.charge === 0 && line.lowerCm >= 0));
  assert.equal(lsLande('d5 4s2 a4G', 5.5)!.toFixed(3), (1 + (5.5 * 6.5 + 1.5 * 2.5 - 4 * 5) / (2 * 5.5 * 6.5)).toFixed(3)); assert.equal(lsLande('no term', 2), undefined);
  assert.equal(effectiveLande(1.5, 1, 0, 0), 1.5); assert.equal(effectiveLande(1.5, 2, 1.5, 3), 1.5);
});

const LINES: MaskLine[] = [{ restNm: 500.5, depth: 0.6, lande: 1.5, element: 26, charge: 0 }, { restNm: 610.27, depth: 0.2, lande: 2, element: 20, charge: 1 }];
const CITE = (value: number) => ({ value, source: 'Paper, Table 1' });
const RUN: MapRun = { star: { vsiniKmS: CITE(3), inclinationDegrees: CITE(85), periodDays: CITE(12), shearRadPerDay: CITE(0.15), maximumDegree: CITE(5) }, means: { depth: 0.4, wavelengthNm: 527.94, lande: 1.625, lines: 2 }, profiles: [{ file: '/run/lsd/900001p.lsd', mjd: 54274.5 }, { file: '/run/lsd/900002p.lsd', mjd: 54280.5 }], velocityKmS: -2.1, lineHalfWidthKmS: 19, directory: '/run/zdi' };

test('the mask and a spectrum are written as LSDpy reads them', () => {
  assert.equal(maskFile(LINES), '2\n500.5000 26.00 0.6000 0.0 1.500 1\n610.2700 20.01 0.2000 0.0 2.000 1\n');
  // Pixels that are not numbers, or have no light or no error bar, are left out, and the header counts the rest.
  const row = (...values: number[]) => Float32Array.from(values), text = spectrumFile({ mjd: 54274.5, exposureSeconds: 3600, object: 'star', wavelengthNm: row(500, 500.01, 500.02, 500.03), intensity: row(0.9, NaN, 0.8, -0.1), stokesV: row(1e-4, 0, -2e-4, 0), check: row(1e-5, 0, 2e-5, 0), error: row(1e-3, 1e-3, 0, 1e-3) }, '900001p').split('\n');
  assert.deepEqual(text.slice(0, 2), ["***Reduced spectrum of '900001p'", '1 5']); assert.equal(text.length, 4);
  assert.deepEqual(text[2]!.split(' ').map(Number).map(value => Number(value.toPrecision(4))), [500, 0.9, 1e-4, 1e-5, 1e-5, 1e-3]);
});

test('ZDIpy\'s inputs are written in the order it reads them, and what it prints is read back', () => {
  assert.deepEqual(renormInput(RUN).trimEnd().split('\n'), ['1', '-19 19', '0.0 0.0', '1', '0', '0', '0', '-19 19', '../lsd/900001p.lsd -2.10', '../lsd/900002p.lsd -2.10']);
  assert.equal(lineInput(RUN), `${RUN.means.wavelengthNm.toFixed(2)} 0.6306 2.41 0.89 1.625 0.66 0.0\n`);
  const input = zdiInput(RUN, { target: 1.3, iterations: 150, startFrom: 'coefficients-1.4.dat' }).trimEnd().split('\n');
  assert.deepEqual(input.slice(0, 7), ['85 3 12 0.15', '0.0 0.0', '60', 'C 1.3 150', '0.0001', '1 5 100 Full', '1 coefficients-1.4.dat']);
  // The map's time is the middle of the run, and each mean line is read renormalised, at its Julian date.
  assert.deepEqual(input.slice(11), ['65000.', '-19 19', '2454278.00000', '../lsd/900001p.lsd.norm 2454275.00000 -2.10', '../lsd/900002p.lsd.norm 2454281.00000 -2.10']);
  assert.equal(zdiInput(RUN, { target: 2, iterations: 150 }).split('\n')[6], '0 none.dat');
  const printed = 'best match line strength is 0.751557 (ew 0.004925 )\nit   1  entropy      -0.00000  chi2  13.904444  Test   1.000000 meanBright  1.0000000 meanSpot  0.0000000 meanMag     0.0000\nit   2  entropy     -72.40000  chi2   1.300000  Test   0.000040 meanBright  1.0000000 meanSpot  0.0000000 meanMag    22.3000\n';
  assert.deepEqual(parseFit(printed, 1.3, 150), { target: 1.3, iterations: 2, converged: true, chiSquare: 1.3, chiSquareNoField: 13.904444, entropy: -72.4, test: 0.00004, lineStrength: 0.751557 });
  assert.equal(parseFit(printed, 1.3, 2).converged, false); assert.throws(() => parseFit('nothing', 1, 10), /no usable iteration/u);
  const geometry = parseGeometry('Bmean =    21.500 G\nBmax =     58.045 G\npoloidal:    46.365% (% tot)  (<B^2_poloidal> 1.0 G^2)\ntoroidal:    53.635% (% tot)  (<B^2_toroidal> 1.0 G^2)\ndipole:       5.002% (% pol)\naxisymmetric: 69.387% (% tot)\npoloidal axisymmetric: 35.905% (% pol)\n');
  assert.deepEqual([geometry.meanGauss, geometry.maxGauss, geometry.toroidalPercent, geometry.axisymmetricPercent, geometry.dipolePercent, geometry.quadrupolePercent], [21.5, 58.045, 53.635, 69.387, 5.002, null]);
  assert.throws(() => parseGeometry('Bmax = 3 G'), /no mean field/u);
});

test('the ladder starts under the fit with no field, and the map is the last step before more fit costs too much field', () => {
  assert.deepEqual(ladderTargets(5.5), [4.4, 3.52, 2.6, 2.3, 2, 1.8, 1.6, 1.5, 1.4, 1.3, 1.25, 1.2, 1.15, 1.1, 1.05, 1, 0.95, 0.9]); assert.deepEqual(ladderTargets(1.02), [0.95, 0.9]);
  // The first step buys little because the field starts from nothing; the price is best in the middle and then falls.
  const ladder = [{ chiSquare: 5, meanGauss: 4 }, { chiSquare: 4, meanGauss: 12 }, { chiSquare: 2, meanGauss: 30 }, { chiSquare: 1.3, meanGauss: 50 }, { chiSquare: 1.2, meanGauss: 62 }, { chiSquare: 1.15, meanGauss: 130 }];
  assert.equal(chooseFit(ladder, 0.3), ladder[4]); assert.equal(chooseFit(ladder, 0.5), ladder[3]); assert.equal(chooseFit(ladder, 0.01), ladder[5]);
  assert.equal(chooseFit(ladder.slice(0, 2)), ladder[1]); assert.throws(() => chooseFit([]), /no step/u);
});

test('a map is written as the table star packages already read, from the field ZDIpy\'s own harmonics give', async t => {
  const table = parseTecplotLonLat(mapTable('test', { longitudes: [0, 180, 360], latitudes: [-90, 0, 90], maximumDegree: 1, radial: [-5, -5, -5, 0, 0, 0, 5, 5, 5], colatitude: [0, 0, 0, 2, 2, 2, 0, 0, 0], longitude: [0, 0, 0, 3, 3, 3, 0, 0, 0] }), 'test.dat');
  assert.deepEqual([table.columns, table.rows, table.variables[2]], [3, 3, 'B<sub>R</sub> [G]']);
  // Radial, then east, then north: a field toward growing colatitude points south.
  assert.deepEqual([...table.values[4]!], [180, 0, 0, 3, -2]); assert.deepEqual([...table.values[8]!], [360, 90, 5, 0, 0]);
  if (!await toolchainPaths().then(() => true, () => false)) { t.skip('the magnetic mapping toolchain is not installed: node packages/telescope-cli/src/archives/espadons/toolchain.mts install'); return; }
  // A dipole along the axis, in ZDIpy's coefficient file: the radial, poloidal and toroidal coefficients of each degree and order.
  const directory = await mkdtemp(resolve(tmpdir(), 'zdi-')), coefficients = resolve(directory, 'dipole.dat'), rows = ' 1  0  1.000000e+02  0.000000e+00\n 1  1  0.000000e+00  0.000000e+00\n', none = rows.replace('1.000000e+02', '0.000000e+00');
  try { await writeFile(coefficients, `General poloidal plus toroidal field\n2 3 -3\n${rows}\n${none}\n${none}`);
    const grid = await fieldGrid(coefficients, 30), at = (longitude: number, latitude: number) => grid.radial[Math.round((latitude + 90) / 30) * grid.longitudes.length + Math.round(longitude / 30)]!;
    assert.deepEqual([grid.longitudes.length, grid.latitudes.length, grid.maximumDegree], [13, 7, 1]);
    // Outward at one pole, inward at the other by as much, nothing at the equator, and the same at every longitude.
    assert.ok(Math.abs(at(0, 90)) > 10 && Math.abs(at(0, 90) + at(0, -90)) < 1e-3 && Math.abs(at(90, 0)) < 1e-6 && Math.abs(at(60, 30) - at(300, 30)) < 1e-9 && Math.abs(at(0, 30) / at(0, 90) - 0.5) < 1e-3);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a mask is the candidate lines Korg finds deep enough in the star\'s atmosphere', async t => {
  const { lines } = atomicLines((await fixture('kurucz-excerpt.dat')).split('\n').filter(Boolean), 390, 900), kept = candidates(lines), table = candidateTable(kept);
  // Wavelength, log gf, species, lower level in eV, Kurucz's three damping constants, Landé factor: read back as written.
  const iron = kept.find(line => Math.abs(line.nm - 630.2493) < 0.001)!; assert.ok(table.split('\n').some(row => row.startsWith('630.2493\t-0.969\t26.00\t3.6864\t8.08\t-5.40\t-7.54\t')), String(table.split('\n').find(row => row.startsWith('630.2'))));
  assert.equal(iron.damping.length, 3); assert.ok(iron.damping.every(value => value !== 0));
  const back = parseCandidateTable(table); assert.equal(back.length, kept.length); assert.ok(back.every((line, i) => line.element === kept[i]!.element && line.charge === kept[i]!.charge && Math.abs(line.nm - kept[i]!.nm) < 1e-4 && Math.abs(line.lande - kept[i]!.lande) < 1e-4));
  assert.ok(kept.every((line, i) => i === 0 || line.nm >= kept[i - 1]!.nm)); assert.throws(() => parseCandidateTable('1\t2\n'), /not eight numbers/u);
  const depths = kept.map((_, i) => i % 2 ? 0.5 : 0.05), mask = starMask(kept, depths);
  assert.equal(mask.length, Math.floor(kept.length / 2)); assert.ok(mask.every(line => line.depth === 0.5)); assert.throws(() => starMask(kept, depths.slice(1)), /depths for/u); assert.throws(() => starMask(kept, depths.map(() => 1.2)), /has depth/u);
  const tools = await toolchainPaths().catch(() => undefined);
  if (!tools) { t.skip('the magnetic mapping toolchain is not installed: node packages/telescope-cli/src/archives/espadons/toolchain.mts install'); return; }
  // Korg, for a 5,000 K dwarf: the strong iron line at 630.25 nm is deep, and every depth is a share of the continuum.
  const directory = await mkdtemp(resolve(tmpdir(), 'korg-'));
  try { await writeFile(resolve(directory, 'lines.tsv'), table);
    const summary = JSON.parse(runJulia(tools, [resolve(import.meta.dirname, 'korg/depths.jl'), resolve(directory, 'lines.tsv'), '5000', '4.5', '0', resolve(directory, 'depths.tsv')]).trim().split('\n').at(-1)!) as { lines: number; synthesised: number };
    const computed = (await readFile(resolve(directory, 'depths.tsv'), 'utf8')).trimEnd().split('\n').map(Number);
    assert.equal(summary.lines, kept.length); assert.equal(computed.length, kept.length); assert.ok(computed.every(depth => depth >= 0 && depth < 1));
    assert.ok(computed[kept.indexOf(iron)]! > 0.5, String(computed[kept.indexOf(iron)])); assert.ok(summary.synthesised >= 5 && summary.synthesised <= kept.length);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('a star\'s atmosphere and velocity come from the catalogues, each value with its source', () => {
  const head = '#SpT   Teff  logT   BCv    logL   Mbol R_Rsun   Mv    Msun  SpT', row = (type: string, teff: number, radius: number, mass: number) => `${type}  ${teff}  3.5 -1.9 -1.8 9.2 ${radius} 11.2 ${mass} ${type}`;
  const table = [head, ...Array.from({ length: 40 }, (_, i) => row(`${'FGKM'[Math.floor(i / 10)]}${i % 10}V`, 7000 - 100 * i, 1.4 - 0.03 * i, 1.5 - 0.035 * i)), row('M6.5V', 2740, 0.126, 0.097), `${head}`, row('M3V', 9999, 1, 1)].join('\n'), dwarfs = parseDwarfSequence(table);
  // The first table of the file is the one read; the gravity is the Sun's times mass over radius squared.
  assert.equal(dwarfs.get('M3V')!.kelvin, 3700); assert.equal(dwarfs.get('M6.5V')!.logGravity, Number((4.438 + Math.log10(0.097 / 0.126 ** 2)).toFixed(2))); assert.throws(() => parseDwarfSequence(head), /gave 0 rows/u);
  assert.deepEqual(['dM3', 'M3.0Ve', 'M6.5Ve', 'K2V', 'G5VFe-0.7CH-1(k)', 'K0'].map(type => dwarfRow(type, dwarfs)?.type), ['M3V', 'M3V', 'M6.5V', 'K2V', 'G5V', 'K0V']);
  assert.deepEqual(['K2III', 'G8IV', 'M2Iab', '', 'DA3'].map(type => dwarfRow(type, dwarfs)), [undefined, undefined, undefined, undefined, undefined]);
  const star = { name: 'V*  AD Leo', spectralType: 'dM3', raDegrees: 154.9, decDegrees: 19.87, radialVelocityKmS: 12.43, radialVelocityBibcode: '2018MNRAS.475.1960F' };
  // The input catalogue when it has both numbers for the star itself; a neighbour 5 arcseconds away is not the star.
  const both = chooseParameters(star, [{ id: '9', separationArcsec: 5.1, kelvin: 6000, logGravity: 4 }, { id: '95431305', separationArcsec: 0.1, kelvin: 3414.4, logGravity: 4.8062, metallicity: -0.0499999 }], dwarfs);
  assert.deepEqual([both.atmosphere!.effectiveTemperatureK, both.atmosphere!.logGravity.value, both.atmosphere!.metallicity!.value, both.notes], [{ value: 3414, source: 'TESS Input Catalog 8.2 (VizieR IV/39/tic82), TIC 95431305: Teff' }, 4.81, -0.05, []]);
  assert.deepEqual(both.radialVelocity, { value: 12.43, source: 'SIMBAD, radial velocity of V* AD Leo (2018MNRAS.475.1960F)' });
  // Without both, the spectral type's row of the dwarf sequence.
  const byType = chooseParameters(star, [{ id: '95431305', separationArcsec: 0.1, logGravity: 4.8 }], dwarfs); assert.equal(byType.atmosphere!.effectiveTemperatureK.value, 3700); assert.match(byType.atmosphere!.logGravity.source, /row M3V, for SIMBAD's spectral type dM3: from the row's mass and radius/u);
  // A giant gets nothing from the dwarf table, and a star with no velocity says what that costs.
  const giant = chooseParameters({ ...star, spectralType: 'K2III', radialVelocityKmS: undefined }, [], dwarfs); assert.equal(giant.atmosphere, undefined); assert.equal(giant.radialVelocity, undefined); assert.equal(giant.notes.length, 2);
  assert.match(chooseParameters(undefined, [], dwarfs).notes[0]!, /SIMBAD has no star/u);
});

test('the ledger gives each archive target to the nearest shipped star and works a star\'s state out from its receipts', () => {
  const star = (id: string, raDeg: number, decDeg: number) => ({ id, names: [id], position: { raDeg, decDeg, radiusDeg: 0.5 / 60 } }), target = (name: string, raDegrees: number, decDegrees: number, spectra: number) => ({ name, raDegrees, decDegrees, spectra, firstMjd: 53900, lastMjd: 56560 });
  const stars = [star('hd-1-companion', 300.003, 22.7), star('hd-1', 300, 22.7), star('far', 10, 10)], targets = [target('HD 1', 300.0002, 22.7001, 40), target('hd1', 300, 22.7, 12), target('HD 1 B', 300.0028, 22.7, 3), target('elsewhere', 200, 0, 9)];
  const given = assignTargets(targets, stars); assert.deepEqual([...given].map(([id, list]) => [id, list.map(one => one.name)]), [['hd-1', ['HD 1', 'hd1']], ['hd-1-companion', ['HD 1 B']]]);
  const at = { raDegrees: 300, decDegrees: 22.7 }, held = ledgerStar(stars[1]!, given.get('hd-1')!, [], 'display convention');
  assert.deepEqual([held.spectra, held.state, held.firstYear, held.lastYear, held.typedNames], [52, 'held', 2006, 2013, ['HD 1', 'hd1']]);
  assert.equal(ledgerStar(stars[1]!, given.get('hd-1')!, [{ program: 'hd-1-2007-06', ...at }], 'measured').state, 'pinned');
  // A receipt is not in git: a run this machine has not reduced keeps what the ledger file records of it.
  assert.deepEqual([...recordedResults({ stars: [{ maps: [{ program: 'hd-1-2007-06', middleUtc: '2007-06-28', meanGauss: 24 }], reasons: ['hd-1-2006-06: The field is not detected.'] }] })], [['hd-1-2007-06', { mapped: true, middleUtc: '2007-06-28', meanGauss: 24 }], ['hd-1-2006-06', { mapped: false, reason: 'The field is not detected.' }]]);
  const refused = ledgerStar(stars[1]!, given.get('hd-1')!, [{ program: 'hd-1-2006-06', ...at, receipt: { mapped: false, reason: 'The field is not detected.' } }], 'measured'); assert.deepEqual([refused.state, refused.reasons], ['reduced, no map', ['hd-1-2006-06: The field is not detected.']]);
  const mapped = ledgerStar(stars[1]!, given.get('hd-1')!, [{ program: 'hd-1-2013-09', ...at, receipt: { mapped: true, middleUtc: '2013-09-20T10:00:00', meanGauss: 55.4 } }, { program: 'hd-1-2007-06', ...at, receipt: { mapped: true, middleUtc: '2007-06-29T00:00:00', meanGauss: 23.8 } }, { program: 'other', raDegrees: 10, decDegrees: 10 }], 'measured');
  assert.deepEqual([mapped.state, mapped.programs, mapped.maps.map(map => map.program)], ['mapped', ['hd-1-2007-06', 'hd-1-2013-09'], ['hd-1-2007-06', 'hd-1-2013-09']]);
  const page = guide({ schema: 'cssearth-espadons-ledger@1', surveyed: '2026-10-06', archive: { targetNames: 3005, spectra: 22652 }, shippedStars: 3105, stars: [mapped, { ...refused, id: 'hd-2' }, { ...held, id: 'hd-3', spectra: 3 }] });
  assert.match(page, /22,652 polarised spectra under 3,005 typed target names\. 3 of the 3,105 stars/u); assert.match(page, /2 stars have 6 or more and are listed\. Mapped: 1\. Reduced without a map: 1\. Pinned: 0\. Held: 1\./u);
  assert.match(page, /\| \[hd-1\]\(\.\.\/src\/objects\/hd-1\/README\.md\) \| 52 \| 2006 to 2013 \| HD 1, hd1 \| measured \| mapped: `hd-1-2007-06` \(24 G\), `hd-1-2013-09` \(55 G\) \|/u); assert.match(page, /- \*\*hd-2\*\*, hd-1-2006-06: The field is not detected\./u); assert.doesNotMatch(page, /hd-3/u);
});

test('runs are split at gaps, published fields are matched by time, and a program is refused by what it lacks', () => {
  const product = (id: number, mjdStart: number) => ({ product: `${id}p`, uri: `cadc:CFHT/${id}p.fits`, bytes: 20589120, targetName: 'HD 1', proposal: '07AC27', mjdStart, exposureSeconds: 3600 });
  const runs = runsOf([product(900001, 54274.4), product(900002, 54280.1), product(900003, 54620.2)]);
  assert.deepEqual(runs.map(run => [run.from, run.to, run.spectra]), [['2007-06-23', '2007-06-29', 2], ['2008-06-03', '2008-06-03', 1]]);
  const ours = [{ utc: '2007-06-23T12:00:38', gauss: -1.7, error: 0.6 }, { utc: '2007-06-23T14:47:55', gauss: -0.5, error: 0.6 }, { utc: '2007-06-27T08:04:37', gauss: -6.2, error: 0.6 }, { utc: '2007-07-05T08:35:23', gauss: 9, error: 1 }];
  const compared = compareFields(ours, [{ utc: '2007-06-23T12:00:39', gauss: -2.1, error: 0.7 }, { utc: '2007-06-23T14:47:56', gauss: -0.6, error: 0.7 }, { utc: '2007-06-27T08:04:38', gauss: -6.2, error: 0.7 }, { utc: '2007-06-30T08:36:26', gauss: -2, error: 2.3 }]);
  assert.equal(compared.pairs.length, 3); assert.ok(compared.correlation! > 0.99 && compared.rmsDifference! < 0.3 && compared.reducedChiSquare! < 1);
  const base = { schema: PROGRAM_SCHEMA, id: 'hd-1-2007-06', target: { name: 'HD 1', raDegrees: 1, decDegrees: 2, radiusDegrees: 0.02 }, span: { fromMjd: 54274, toMjd: 54287 }, observations: [product(900001, 54274.4)] }, cite = (value: number) => ({ value, source: 'Paper, Table 1' });
  assert.equal(parseProgram(base).star, undefined);
  assert.equal(parseProgram({ ...base, star: { vsiniKmS: cite(3), inclinationDegrees: cite(85), periodDays: cite(12), maximumDegree: cite(5) } }).star!.periodDays.value, 12);
  assert.throws(() => parseProgram({ ...base, star: { vsiniKmS: cite(3), inclinationDegrees: cite(95), periodDays: cite(12), maximumDegree: cite(5) } }), /tilt between 0 and 90/u);
  assert.throws(() => parseProgram({ ...base, star: { vsiniKmS: { value: 3, source: ' ' }, inclinationDegrees: cite(85), periodDays: cite(12), maximumDegree: cite(5) } }), /source is empty/u);
  assert.throws(() => parseProgram({ ...base, observations: [product(900001, 1), product(900001, 2)] }), /listed twice/u);
  assert.throws(() => parseProgram({ ...base, observations: [{ ...product(900001, 1), product: 'x' }] }), /not a polarimetric product id/u);
});

test('a star\'s rotation is taken from its own record, each value cited as the record cites it, or not at all', () => {
  const record = { rotationPeriodDays: 12.3, rotationPeriodSource: 'archive: 12.3 d', projectedRotationSpeedKmS: 3.23, projectedRotationSpeedSource: 'archive: 3.23 km/s', spinInclinationDegrees: 68.1, spinInclinationSource: 'computed here' };
  const star = recordedStar(record, 'src/objects/hd-1/source/measurements.json')!;
  assert.deepEqual([star.periodDays.value, star.vsiniKmS.value, star.inclinationDegrees.value, star.maximumDegree.value], [12.3, 3.23, 68.1, 15]);
  assert.equal(star.periodDays.source, 'src/objects/hd-1/source/measurements.json, rotationPeriodDays: archive: 12.3 d');
  // Without a tilt there is no map to fit: period and speed alone are not a rotation.
  assert.equal(recordedStar({ ...record, spinInclinationDegrees: undefined }, 'x'), undefined); assert.equal(recordedStar(null, 'x'), undefined);
});
