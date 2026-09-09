"""Focused numerical regressions for the Cassini VIMS source conversion."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

import numpy as np


SPEC = importlib.util.spec_from_file_location('cassini_vims', Path(__file__).with_name('cassini-vims.py'))
vims = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(vims)


class CassiniVimsTests(unittest.TestCase):
    def test_bsq_plane_offsets_and_little_endian_values(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory)/'cube.img'
            original = np.array([[[1, 2], [3, -999]], [[5, 6], [7, 8]],
                                 [[9, 10], [11, 12]]], dtype='<f4')
            source.write_bytes(original.tobytes())
            planes = vims.read_planes(source, [3, 1], width=2, height=2, count=3)
            np.testing.assert_array_equal(planes[3], original[2])
            np.testing.assert_array_equal(planes[1], original[0])
            source.write_bytes(original.tobytes()[:-1])
            with self.assertRaisesRegex(ValueError, 'length'):
                vims.read_planes(source, [1], width=2, height=2, count=3)

    def test_no_partial_rgb_or_neighbor_fill(self):
        values = np.ones((3, 1, 5))*.5
        values[1, 0, 1] = -999
        values[2, 0, 2] = np.nan
        values[0, 0, 3] = np.inf
        rgb, valid = vims.encode_rgb(values, [[0, 1]]*3, -999)
        np.testing.assert_array_equal(valid, [[True, False, False, False, True]])
        np.testing.assert_array_equal(rgb[:, 0, 1:4], 0)
        np.testing.assert_array_equal(rgb[:, 0, [0, 4]], 128)

    def test_dark_observations_remain_observed(self):
        values = np.array([[[0, -.1, 2]]]*3)
        rgb, valid = vims.encode_rgb(values, [[0, 1]]*3, -999)
        self.assertTrue(valid.all())
        np.testing.assert_array_equal(rgb[0], [[1, 1, 255]])

    def test_sloping_continuum_and_dimensionless_depth(self):
        depth, valid, weight = vims.band_depth(np.array([[2.0]]), np.array([[1.5]]),
                                             np.array([[4.0]]), [1.0, 1.5, 2.0], -999)
        self.assertTrue(valid.all())
        self.assertEqual(weight, .5)
        self.assertEqual(float(depth[0, 0]), .5)

    def test_invalid_continuum_is_missing_but_negative_depth_is_retained(self):
        depth, valid, _ = vims.band_depth(np.array([[0, -999, 1, 1]]),
                                         np.array([[0, 1, np.nan, 2]]),
                                         np.array([[0, 1, 1, 1]]), [1, 2, 3], -999)
        np.testing.assert_array_equal(valid, [[False, False, False, True]])
        np.testing.assert_array_equal(depth, [[-9999, -9999, -9999, -1]])

    def test_angular_rows_and_longitude_seam_have_exact_native_owners(self):
        source = np.arange(180)[:, None]*1000 + np.arange(360)[None, :]
        source[10, 359] = -9999
        result = vims.guide_grid_sample(source, 360, 180)
        # Canonical first center -179.5E belongs to native column180; the
        # 0-degree seam runs between canonical columns179 and180.
        self.assertEqual(result[0, 0], 180)
        self.assertEqual(result[0, 179], 359)
        self.assertEqual(result[0, 180], 0)
        self.assertEqual(result[-1, -1], 179179)
        self.assertEqual(result[10, 179], -9999)
        enlarged = vims.guide_grid_sample(source, 720, 360)
        np.testing.assert_array_equal(enlarged[20:22, 358:360], -9999)
        self.assertEqual(enlarged[20, 357], 10358)

    def test_new_grid_interpretation_cannot_be_implicit(self):
        with tempfile.TemporaryDirectory() as directory:
            plan = Path(directory)/'recipe.json'
            plan.write_text(json.dumps({'schema': vims.SCHEMA}))
            with self.assertRaisesRegex(ValueError, 'Explicit guide-grid'):
                vims.prepare(plan)

    def test_rejects_oversized_grid_and_invalid_spectrum(self):
        with self.assertRaisesRegex(ValueError, 'bounded'):
            vims.guide_grid_sample(np.zeros((180, 360)), 4096, 2048)
        with self.assertRaisesRegex(ValueError, 'continuum wavelengths'):
            vims.band_depth(np.ones(1), np.ones(1), np.ones(1), [1, 3, 2], -999)
        with self.assertRaisesRegex(ValueError, 'display range'):
            vims.encode_rgb(np.ones((3, 1)), [[0, 0]]*3, -999)


if __name__ == '__main__':
    unittest.main()
