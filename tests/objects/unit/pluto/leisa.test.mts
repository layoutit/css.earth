import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { array, shape, text, number, nullable } from '../../../../tools/objects/terrestrial-layers/source-records.mts';
import { requireRecord } from '../../../../tools/sources/source-values.mts';
import { decodeFitsImageMap } from '../../../../tools/objects/terrestrial-layers/fits-image-map.mts';
import { loadScienceSurface } from '../../../../tools/objects/terrestrial-layers/scientific-raster.mts';
import { pinnedOracleVersions } from '../../../../tools/oracles/fixture.mts';

const root = new URL('../../../../src/objects/pluto/source/', import.meta.url);
const fixture = shape({ astropy: text, numpy: text, inputs: array(shape({ path: text, bytes: number })),
  cases: array(shape({ hdu: number, name: text, units: text, missingTupleCells: number, acceptedCells: number,
    acceptedAreaFraction: number, north60to90Mean: number,
    samples: array(shape({ x: number, y: number, raw: number, error: number, expected: nullable(number) })) }))
})(JSON.parse(await readFile(new URL('../../fixtures/pluto/leisa-astropy.json', import.meta.url), 'utf8')));
const config = shape({ surfaces: array(shape({ id: text, science: requireRecord })) })(
  JSON.parse(await readFile(new URL('preparation/raster.json', root), 'utf8')));

test('Pluto LEISA sampling and coverage agree with independent Astropy and NumPy values', async () => {
  const versions = await pinnedOracleVersions();
  assert.equal(fixture.astropy, versions.get('astropy')); assert.equal(fixture.numpy, versions.get('numpy'));
  for (const input of fixture.inputs) {
    const bytes = await readFile(new URL('../../../../' + input.path, import.meta.url));
    assert.equal(bytes.length, input.bytes);
  }
  const raw = await readFile(new URL('science/leisa/params_ls.fits', root));
  for (const [i, id] of ['methane-ice', 'nitrogen-ice', 'water-ice'].entries()) {
    const lens = config.surfaces.find(s => s.id === id)?.science;
    assert.ok(lens);
    const expected = fixture.cases[i], source = await loadScienceSurface(root.pathname, lens), native = decodeFitsImageMap(raw, lens);
    for (const p of expected.samples) {
      const longitude = (p.x + .5) / 1067 * 360, latitude = 90 - (p.y + .5) / 534 * 180;
      assert.equal(source.sample(longitude, latitude), p.expected, `${id} cell ${p.x},${p.y}`);
    }
    let accepted = 0, missing = 0, sumArea = 0, acceptedArea = 0, northSum = 0, northCount = 0;
    for (let y = 0; y < 534; y++) {
      const latitude = 90 - (y + .5) / 534 * 180, area = Math.cos(latitude * Math.PI / 180);
      for (let x = 0; x < 1067; x++) {
        const v = source.sample((x + .5) / 1067 * 360, latitude), n = native.sampleCell(x, y);
        sumArea += area; if (v !== null) { accepted++; acceptedArea += area; }
        if (n === null) missing++;
        if (y < 89 && n !== null) { northSum += n; northCount++; }
      }
    }
    assert.equal(accepted, expected.acceptedCells); assert.equal(missing, expected.missingTupleCells);
    assert.ok(Math.abs(acceptedArea / sumArea - expected.acceptedAreaFraction) < 1e-10);
    assert.ok(Math.abs(northSum / northCount - expected.north60to90Mean) < 1e-4);
    if (i < 2) assert.equal(Math.round(northSum / northCount), [69, 20][i], 'Independent paper Figure 9 / section 3 northern averages');
  }
});
