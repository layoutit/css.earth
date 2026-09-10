"""Numerical regressions for native band arithmetic and shared RGB ownership."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

import numpy as np
import rasterio

SPEC = importlib.util.spec_from_file_location('ice', Path(__file__).with_name('cassini-ice-surfaces.py'))
ice = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(ice)


class CassiniIceTests(unittest.TestCase):
    def test_isis_digit_continuations_preserve_numeric_values(self):
        label = 'Center = (0.9-\n  92581,1.-\n  10746,-1.2,2.02759,-\n  2.04406)'
        self.assertEqual([float(x) for x in ice.sequence(label, 'Center')],
                         [.992581, 1.10746, -1.2, 2.02759, 2.04406])

    def test_invalid_policy_cannot_admit_missing_center_estimates(self):
        policy = {'minimumPhaseDegrees': 10, 'maximumPhaseDegrees': 120,
                  'maximumIncidenceEmissionDegrees': 70, 'maximumResolutionMeters': 10000,
                  'maximumCenterErrorPixels': .01}
        ice.validate_policy(policy)
        for key in policy:
            for value in (float('inf'), float('nan'), True):
                with self.assertRaises(ValueError):
                    ice.validate_policy({**policy, key: value})
        with self.assertRaises(ValueError):
            ice.validate_policy({**policy, 'maximumIncidenceEmissionDegrees': 95})

    def test_native_sloping_continuum_and_shared_missing_mask(self):
        wave = np.linspace(.85, 5.1, 256)
        for band, value in {58: 1.82, 70: 2.01, 81: 2.20}.items():
            wave[band - 1] = value
        channels = {'depth': [58, 70, 81], 'rgb': [70, 44, 25]}
        planes = {b: np.ones((1, 4)) for b in [58, 70, 81, 44, 25]}
        planes[58][:] = 2
        planes[81][:] = 4
        planes[70][:] = [1.5, 0, -1, 1.5]
        planes[44][0, 3] = np.array([0xff7ffffb], dtype='uint32').view('float32')[0]
        depth, ok, rgb, rgb_ok, weight = ice.products(planes, wave, channels)
        self.assertAlmostEqual(weight, .5)
        np.testing.assert_allclose(depth, [[.5, 1, 4 / 3, .5]])
        self.assertTrue(ok.all())
        np.testing.assert_array_equal(rgb_ok, [[True, True, True, False]])
        np.testing.assert_array_equal(rgb[0], planes[70])

    def test_zero_continuum_cannot_become_valid_absorption(self):
        wave = np.linspace(.85, 5.1, 256)
        wave[57], wave[69], wave[80] = 1.82, 2.01, 2.20
        planes = {b: np.zeros((1, 1)) for b in [58, 70, 81, 44, 25]}
        depth, ok, _, _, _ = ice.products(planes, wave, {'depth': [58, 70, 81], 'rgb': [70, 44, 25]})
        self.assertEqual(float(depth[0, 0]), ice.MISSING)
        self.assertFalse(ok[0, 0])
        planes[25][0, 0] = ice.MISSING
        with self.assertRaisesRegex(ValueError, 'collides'):
            ice.products(planes, wave, {'depth': [58, 70, 81], 'rgb': [70, 44, 25]})

    def test_all_rgb_channels_follow_one_observation_and_pixel(self):
        observations = [{'rgb': np.arange(12, dtype='float32').reshape(3, 2, 2)},
                        {'rgb': np.arange(12, dtype='float32').reshape(3, 2, 2) + 100}]
        owners = np.array([[1, 2, 0, 1]])
        pixels = np.array([[4, 2, 0, 1]])
        actual = ice.gather_rgb(observations, owners, pixels)
        np.testing.assert_array_equal(actual[:, 0, 0], [3, 7, 11])
        np.testing.assert_array_equal(actual[:, 0, 1], [101, 105, 109])
        np.testing.assert_array_equal(actual[:, 0, 2], [ice.MISSING] * 3)
        np.testing.assert_array_equal(actual[:, 0, 3], [0, 4, 8])

    def test_detector_union_does_not_fill_between_separate_apertures(self):
        def frustum(center):
            rays = np.array([[center + x, y, -2] for x, y in [(-.1, -.1), (.1, -.1), (.1, .1), (-.1, .1)]])
            rays /= np.linalg.norm(rays, axis=1)[:, None]
            return {'observerKilometers': [0, 0, 3], 'cornerUnitRays': rays}
        x = np.array([-.3, 0, .3, 0])
        points = np.stack((x, np.zeros(4), np.sqrt(1 - x*x)), axis=-1)
        points[-1, 2] = -1  # Far-side point lies in a cone but is occulted.
        left, right = frustum(-.3), frustum(.3)
        footprint = {'orders': [[[left], [right]]]}
        np.testing.assert_array_equal(ice.footprint_contains(points, footprint, [1, 1, 1]),
                                      [True, False, True, False])
        # Unknown temporal order is an intersection, not an optimistic union.
        footprint['orders'].append([[right]])
        np.testing.assert_array_equal(ice.footprint_contains(points, footprint, [1, 1, 1]),
                                      [False, False, True, False])

    def test_rgba_display_preserves_valid_black_and_distinct_missing(self):
        values = np.zeros((3, 2, 4), dtype='float32')
        owners = np.ones((2, 4), dtype='uint16')
        owners[0, 0] = 0
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'display.tif'
            ice.write_display_rgb(path, values, owners, 1000, {'ranges': [[0, 1]] * 3, 'gamma': 1})
            with rasterio.open(path) as dataset:
                output = dataset.read()
                self.assertEqual(dataset.nodata, 0)
                self.assertEqual(dataset.crs.to_dict()['lon_0'], 180)
                np.testing.assert_array_equal(output[:, 0, 2], [0, 0, 0, 0])
                np.testing.assert_array_equal(output[:, 0, 1], [1, 1, 1, 65535])


if __name__ == '__main__':
    unittest.main()
