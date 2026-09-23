import assert from 'node:assert/strict';
import { sourceTest } from '../../../../tests/objects/source-test.mts';
const test = sourceTest();
import { readKlipProgram } from './reduce.mts';

test('the HR 8799 programme pins the exposures and the settings Balmer et al. (2025) reduced', async () => {
  const program = await readKlipProgram('hr-8799-1194');
  assert.equal(program.crdsContext, 'jwst_1256.pmap');
  assert.deepEqual(program.bands.map(band => band.band), ['F250M', 'F300M', 'F335M', 'F410M', 'F430M', 'F460M'].map(filter => `NIRCAM-${filter}-MASKLWB`));
  for (const band of program.bands) {
    // Table 1: the two rolls of HR 8799 in observations 2 and 5, and HD 220657's 5-POINT-BAR dither in observation 4.
    assert.deepEqual(band.science.map(name => name.slice(0, 13)), ['jw01194002001', 'jw01194005001'], band.band);
    assert.deepEqual(band.references.map(name => name.slice(0, 13)), Array(5).fill('jw01194004001'), band.band);
    for (const name of [...band.science, ...band.references]) {
      assert.match(name, /_nrcalong_uncal\.fits$/u);
      assert.equal(program.files.get(name)!.uri, `mast:JWST/product/${name}`);
    }
  }
  const settings = program.settings as Record<string, any>;
  // Section III.2: headers from SIAF, 451 px padding, 201 px crop, the leakage masked and the square root for the shifts.
  assert.equal(settings.crFromSiaf, true);
  assert.deepEqual([400 + settings.padPixels[0] + settings.padPixels[1], 256 + settings.padPixels[2] + settings.padPixels[3]], [451, 451]);
  assert.deepEqual([451 - settings.cropPixels[0] - settings.cropPixels[1], 451 - settings.cropPixels[2] - settings.cropPixels[3]], [201, 201]);
  assert.equal(settings.align.mask_override, 'rec');
  assert.equal(settings.align.shft_exp, 0.5);
  assert.equal(settings.stage1.dark_current.skip, true);
  assert.equal(settings.stage1.jump.rejection_threshold, 4);
  assert.equal(settings.badPixels.bpclean_kwargs.sigclip, 5);
  // Section III.3: reference-star subtraction over the whole image; ADI+RDI subtracts planet e.
  assert.deepEqual([settings.klip.mode, settings.klip.annuli, settings.klip.subsections], [['RDI'], [1], [1]]);
});

test('the 51 Eridani programme pins the F410M exposures and the settings Balmer et al. (2025) state for it', async () => {
  const program = await readKlipProgram('hd-29391-1412');
  const [band] = program.bands;
  assert.equal(program.bands.length, 1);
  assert.equal(band!.band, 'NIRCAM-F410M-MASKLWB');
  // Table 1: 51 Eri in observations 12 and 15, HD 30562's 5-POINT-BAR dither in observation 14.
  assert.deepEqual(band!.science.map(name => name.slice(0, 13)), ['jw01412012001', 'jw01412015001']);
  assert.deepEqual(band!.references.map(name => name.slice(0, 13)), Array(5).fill('jw01412014001'));
  const settings = program.settings as Record<string, any>;
  // Section III.3: eight annuli, four subsections, the first annulus ending at 0.5 arcseconds; KL 50 in the text, 150 in Figure 4.
  assert.deepEqual([settings.klip.mode, settings.klip.annuli, settings.klip.subsections, settings.klip.numbasis], [['RDI'], [8], [4], [50, 150]]);
  assert.equal(settings.firstAnnulusOuterArcsec, 0.5);
  assert.equal(settings.spectralType, 'F0IV');
});
