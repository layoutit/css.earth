import assert from 'node:assert/strict';
import { test } from 'node:test';
import { GAIA_FLAME_COLUMNS, parseGaiaRows, parseHostRows, PSCOMPPARS_COLUMNS, spinInclination, starMetadata, withMetadata } from './star-metadata.mts';

const anchor = (name: string) => `"<a refstr=X href=https://ui.adsabs.harvard.edu/abs/2006ApJ...648..683G/abstract target=ref>${name}</a>"`;
const HOSTS = `${PSCOMPPARS_COLUMNS}\n"HD 1","Gaia DR3 123",10.5,-20.25,"K0 V",${anchor('Paredes et al. 2021')},0.04,"[Fe/H]",${anchor('Stassun et al. 2017')},-0.334,${anchor('Ge et al. 2006')},2.4,${anchor('Ge et al. 2006')},3.23,${anchor('Mallorqu&iacute;n et al. 2023')},12.3,${anchor('Ge et al. 2006')}\n"HD 2","",11,-21,"",,,,,,,,,,,,\n`;

test('the archive answer is read one host a row, each value with the paper the archive names', () => {
  const [first, second] = parseHostRows(HOSTS);
  assert.deepEqual(first!.rotationPeriodDays, { value: 12.3, label: 'Ge et al. 2006', url: 'https://ui.adsabs.harvard.edu/abs/2006ApJ...648..683G/abstract' });
  assert.equal(first!.gaiaDr3, '123'); assert.equal(first!.vsiniKmS!.label, 'Mallorquín et al. 2023'); assert.equal(first!.metallicity!.ratio, '[Fe/H]');
  assert.deepEqual(second, { host: 'HD 2', raDegrees: 11, decDegrees: -21 });
  assert.throws(() => parseHostRows('hostname,ra\n'), /answered with columns/u);
});

test('a tilt follows only when period, speed and radius give a sine under 1', () => {
  // 0.846 solar radii turning in 12.3 d moves 3.48 km/s at the equator.
  assert.equal(spinInclination(12.3, 3.23, 0.846 * 695700).degrees, 68.2);
  assert.equal(spinInclination(12, 9.2, 1.56 * 695700).degrees, undefined);
});

test('a star gains each catalogued value beside its source, the archive before SIMBAD and Gaia', () => {
  const [host] = parseHostRows(HOSTS), simbad = { name: 'HD   1', spectralType: { value: 'K1', bibcode: '1993yCat.3135....0C' }, vsiniKmS: { value: 2.9000000953, bibcode: '2005ApJS..159..141V' } };
  const [gaia] = parseGaiaRows(`${GAIA_FLAME_COLUMNS}\n123,00,0.46,0.45,0.47,6.1,4.2,8.3\n`);
  const hosted = starMetadata({ radiusKm: 0.846 * 695700, measuredAxis: false }, host, simbad, gaia);
  assert.equal(hosted.spectralType, 'K0 V'); assert.equal(hosted.projectedRotationSpeedKmS, 3.23); assert.equal(hosted.luminosityLogSolar, -0.334); assert.equal(hosted.ageGyr, 2.4); assert.equal(hosted.spinInclinationDegrees, 68.2);
  assert.match(String(hosted.rotationPeriodSource), /^NASA Exoplanet Archive, composite parameters of HD 1 \(pscomppars\): rotation period 12\.3 d, from Ge et al\. 2006 \(https:/u);
  assert.match(String(hosted.spinInclinationSource), /sin i = v sin i × P \/ \(2πR\) = 0\.928\. Not a measurement of the axis/u);
  // A page that draws a measured axis keeps it: no tilt is computed beside it.
  assert.equal('spinInclinationDegrees' in starMetadata({ radiusKm: 0.846 * 695700, measuredAxis: true }, host, simbad), false);
  const alone = starMetadata({ measuredAxis: false }, undefined, simbad, gaia);
  assert.deepEqual([alone.spectralType, alone.projectedRotationSpeedKmS, alone.luminosityLogSolar, alone.ageGyr], ['K1', 2.9, -0.337, 6.1]);
  assert.equal(alone.spectralTypeSource, 'SIMBAD, HD 1: spectral type K1 (1993yCat.3135....0C)'); assert.match(String(alone.ageSource), /flags_flame 00: age_flame 6\.1 Gyr \(16th to 84th percentiles 4\.2 to 8\.3\)/u);
  // FLAME's age stands only where its flags vouch for it; a giant's luminosity still does.
  const giant = starMetadata({ measuredAxis: false }, undefined, undefined, { ...gaia!, flags: '10' }); assert.equal('ageGyr' in giant, false); assert.equal(giant.luminosityLogSolar, -0.337);
  assert.deepEqual(starMetadata({ measuredAxis: false }, undefined, undefined, { ...gaia!, flags: '02' }), {});
});

test('the record keeps its own fields and order, with this pass\'s fields before the shape', () => {
  const record = { schema: 's', radiusKm: 1, ageGyr: 9, ageSource: 'old', shape: { kind: 'k' } };
  assert.deepEqual(Object.keys(withMetadata(record, { spectralType: 'K0', spectralTypeSource: 'x' })), ['schema', 'radiusKm', 'spectralType', 'spectralTypeSource', 'shape']);
  assert.deepEqual(withMetadata({ schema: 's' }, { ageGyr: 1 }), { schema: 's', ageGyr: 1 });
});
