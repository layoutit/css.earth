"""Numerical/source-identity tests for the native MUSE spectral-map converter."""
import contextlib
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np
import rasterio


SPEC = importlib.util.spec_from_file_location('muse_spectral_maps', Path(__file__).with_name('muse-spectral-maps.py'))
muse = importlib.util.module_from_spec(SPEC); SPEC.loader.exec_module(muse)


def write_fits(path, values, bitpix=-64):
    cards = [('SIMPLE','T'),('BITPIX',str(bitpix)),('NAXIS','2'),('NAXIS1','180'),('NAXIS2','90'),('EXTEND','T')]
    header = ''.join(f'{key:<8}= {value:>20}'.ljust(80) for key,value in cards) + 'END'.ljust(80)
    path.write_bytes(header.ljust(2880).encode('ascii') + values.astype('>f8').tobytes())


class MuseSpectralMapTests(unittest.TestCase):
    def test_fits_big_endian_values_nan_and_no_silent_metadata_change(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'source.fits'; values = np.full((90,180), np.nan)
            values[45,:3] = [0, -0.125, 6.25]; write_fits(path,values)
            decoded, _ = muse.read_map(path)
            np.testing.assert_array_equal(decoded[45,:3], [0,-.125,6.25]); self.assertTrue(np.isnan(decoded[0,0]))
            write_fits(path,values,bitpix=-32)
            with self.assertRaisesRegex(ValueError, 'layout or metadata'):
                muse.read_map(path)
            path.write_bytes(path.read_bytes()[:-1])
            with self.assertRaisesRegex(ValueError, '180 x 90'):
                muse.read_map(path)

    def test_infinity_and_output_nodata_collision_fail(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'source.fits'
            for invalid in [float('inf'),muse.MISSING,-9999.0001,1e100]:
                values = np.full((90,180),np.nan); values[0,0] = invalid; write_fits(path,values)
                with self.subTest(value=invalid), self.assertRaises(ValueError): muse.read_map(path)

    def test_missing_does_not_erase_valid_zero_or_negative_noise(self):
        values = np.full((90,180),np.nan); values[45,:3] = [0,-.01,1.005]
        output,checks = muse.encode_native(values,0)
        self.assertEqual(output[45,0],0); self.assertAlmostEqual(float(output[45,1]),-.01)
        self.assertEqual(output[45,3],-9999); self.assertEqual(checks['retainedNativeNodes'],3)

    def test_optional_edge_mask_wraps_without_filling_gaps(self):
        values = np.ones((90,180)); values[45,0] = np.nan; values[40,179] = 0
        output,checks = muse.encode_native(values,1)
        self.assertEqual(output[45,179],-9999); self.assertEqual(output[45,1],-9999)
        self.assertEqual(output[44,0],-9999); self.assertEqual(output[40,179],0)
        self.assertEqual(output[45,178],1); self.assertTrue((output[0]==-9999).all())
        self.assertGreater(checks['edgeNodesWithheld'],0)

    def test_first_valid_night_preserves_exact_values_without_averaging(self):
        first = np.array([[0,np.nan,1.01,np.nan]])
        second = np.array([[8,-.1,1.04,np.nan]])
        third = np.array([[9,5,1.02,np.nan]])
        combined,owner = muse.ordered_fallback([first,second,third])
        np.testing.assert_array_equal(combined[0,:3],[0,-.1,1.01])
        self.assertTrue(np.isnan(combined[0,3])); np.testing.assert_array_equal(owner,[[1,2,1,0]])
        comparisons = muse.overlap_statistics([first,second],['first','second'])
        self.assertEqual(comparisons[0]['overlapNodes'],2)
        self.assertAlmostEqual(comparisons[0]['meanSecondMinusFirst'],4.015)

    def test_native_integer_grid_reorder_geotransform_and_circular_edge(self):
        values = np.arange(90)[:,None]*1000 + np.arange(180)[None,:]
        output = muse.reorder_nodes(values)
        self.assertEqual(output[0,0],89090); self.assertEqual(output[44,90],45000)
        self.assertEqual(output[-1,-1],89)
        transform = muse.native_transform(180/np.pi)
        for lon,lat,expected in [(-180,0,45090),(180,0,45090),(179.6,0,45090),
                                 (0,0,45000),(358.5,0,45179),(-.5,0,45000)]:
            # Independently execute the existing scientific source sampler's
            # wrap-relative-to-center and containing-pixel-area rule.
            x = ((lon-muse.CENTER_LONGITUDE+180)%360)-180
            col = int(np.floor((x-transform.c)/transform.a)); row = int(np.floor((lat-transform.f)/transform.e))
            self.assertEqual(output[row,col],expected)
        self.assertLess((89.1-transform.f)/transform.e,0)
        self.assertEqual(muse.OBSERVABLES['577.3nm_band']['unit'],'ratio')

    def test_recipe_requires_interpretation_pin_and_retains_ratio(self):
        with tempfile.TemporaryDirectory() as directory:
            root=Path(directory); source=root/'577.3nm_band_ganymede_night_1.fits'
            values=np.full((90,180),np.nan); values[45,0]=1.015; write_fits(source,values)
            plan={'schema':muse.SCHEMA,'target':'ganymede','registration':{'mode':'author-grid-two-degree-nodes',
                  'absoluteSubpixelRegistration':'unresolved','evidence':['independent synthetic test fixture']},
                  'overlapPolicy':'first-valid-night-1-2-3','edgeWithholdNodes':0,'referenceRadiusMeters':2631200,
                  'pins':{source.name:muse.sha256(source)},'entries':[{'input':source.name,'kind':'577.3nm_band','night':1,'output':'ratio.tif'}],
                  'receipt':'receipt.json'}
            path=root/'recipe.json'; path.write_text(json.dumps(plan))
            with contextlib.redirect_stdout(io.StringIO()): receipt=muse.prepare(path)
            self.assertEqual(receipt['composites']['577.3nm_band']['validNodes'],1)
            with rasterio.open(root/'ratio.tif') as image:
                self.assertEqual(image.dtypes,('float32',)); self.assertEqual(image.nodata,-9999)
                self.assertAlmostEqual(float(image.read(1)[44,90]),1.015,places=6)
            plan['pins'][source.name]='0'*64; path.write_text(json.dumps(plan))
            with self.assertRaisesRegex(ValueError,'source changed'): muse.prepare(path)
            plan['registration']['absoluteSubpixelRegistration']='known'; path.write_text(json.dumps(plan))
            with self.assertRaisesRegex(ValueError,'unresolved subpixel'): muse.prepare(path)


if __name__ == '__main__': unittest.main()
