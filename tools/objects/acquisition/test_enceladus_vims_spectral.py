"""Numerical and missing-data regressions for the bounded Enceladus converter."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

import numpy as np

SPEC = importlib.util.spec_from_file_location('enceladus_vims', Path(__file__).with_name('enceladus-vims-spectral.py'))
vims = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(vims)


def waves():
    result = np.linspace(.85, 5.1, 256)
    for band, wavelength in {48: 1.66, 58: 1.82, 70: 2.01, 81: 2.20,
                             134: 3.08, 135: 3.10, 136: 3.12}.items():
        result[band-1] = wavelength
    return result


def observation(longitudes=(-2, 2), value=3, resolution=10, invalid=None):
    latitude = np.array([[2, 2], [-2, -2]])
    longitude = np.array([longitudes, longitudes])
    eligible = np.ones((2, 2), dtype=bool)
    if invalid is not None:
        eligible[invalid] = False
    values = np.array([[value, value+1], [value+2, value+3]], dtype='float32')
    return {'id': str(value), 'xyz': vims.directions(latitude, longitude),
            'eligible': eligible, 'indices': {'depth': (values, np.ones_like(eligible))},
            'navigation': {2: np.full((2, 2), 30), 6: np.full((2, 2), resolution)}}


class EnceladusSpectralTests(unittest.TestCase):
    def test_sloping_continuum_uses_native_wavelengths(self):
        # Native shoulders 1.82 and 2.20 place the 2.01 channel halfway.
        planes = {b: np.array([[1.]]) for b in (48, 58, 70, 81, 134, 135, 136)}
        planes[58], planes[81], planes[70] = np.array([[2.]]), np.array([[4.]]), np.array([[1.5]])
        planes[134], planes[135], planes[136] = np.array([[2.]]), np.array([[4.]]), np.array([[3.]])
        fields, weight = vims.spectral_indices(planes, waves())
        self.assertAlmostEqual(weight, .5)
        self.assertEqual(float(fields['depth'][0][0, 0]), .5)
        self.assertEqual(float(fields['ratio'][0][0, 0]), 3.)

    def test_zero_negative_noise_special_pixels_and_zero_continuum(self):
        planes = {b: np.ones((1, 6)) for b in (48, 58, 70, 81, 134, 135, 136)}
        planes[70][0] = [0, 2, -1, 1, 1, 1]
        null = np.array([0xff7ffffb], dtype='uint32').view('float32')[0]
        planes[58][0, 3] = null
        planes[58][0, 4] = planes[81][0, 4] = 0
        planes[70][0, 5] = np.nan
        planes[48][0, 4] = 0
        planes[134][0, 3] = null
        fields, _ = vims.spectral_indices(planes, waves())
        np.testing.assert_array_equal(fields['depth'][0], [[1, -1, 2, -9999, -9999, -9999]])
        np.testing.assert_array_equal(fields['depth'][1], [[True, True, True, False, False, False]])
        self.assertFalse(fields['ratio'][1][0, 3])
        self.assertFalse(fields['ratio'][1][0, 4])

    def test_native_band_offsets_and_little_endian_core(self):
        header = '''Object = IsisCube
 Object = Core
 StartByte = 65537
 Format = Tile
 TileSamples = 2
 TileLines = 2
 Group = Dimensions
 Samples = 2
 Lines = 2
 Bands = 3
 End_Group
 Group = Pixels
 Type = Real
 ByteOrder = Lsb
 Base = 0
 Multiplier = 1
 End_Group
 End_Object
 Group = Instrument
 TargetName = ENCELADUS
 Channel = IR
 End_Group
End_Object
End
'''.encode('ascii').ljust(65536, b'\x00')
        values = np.arange(12, dtype='<f4').reshape(3, 2, 2)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory)/'fixture.cub'
            path.write_bytes(header+values.tobytes()+b'CalibrationVersion        = RC19')
            _, selected = vims.read_cube(path, [3, 1], 3)
            np.testing.assert_array_equal(selected[3], [[8, 9], [10, 11]])
            np.testing.assert_array_equal(selected[1], [[0, 1], [2, 3]])
            with self.assertRaisesRegex(ValueError, 'layout'):
                vims.read_cube(path, [1], 6)
            path.write_bytes(header+values.tobytes()[:-1])
            with self.assertRaisesRegex(ValueError, 'Truncated'):
                vims.read_cube(path, [3], 3)

    def test_held_center_does_not_fit_its_own_prediction(self):
        lat = np.arange(-2, 3)[:, None]
        lon = np.arange(-2, 3)[None, :]
        xyz = vims.directions(lat, lon)
        valid = np.ones((5, 5), dtype=bool)
        errors, selected = vims.navigation_holdouts(xyz, valid, .25)
        self.assertTrue(selected[1:4, 1:4].all())
        self.assertFalse(selected[0].any())
        self.assertLess(errors[2, 2], .001)
        xyz[2, 2] = vims.directions(0, 1)
        errors, selected = vims.navigation_holdouts(xyz, valid, .25)
        self.assertGreater(errors[2, 2], .9)
        self.assertFalse(selected[2, 2])
        _, selected = vims.navigation_holdouts(np.ones((5, 5, 3)), valid, .25)
        self.assertFalse(selected.any())

    def test_spherical_triangle_excludes_opposite_hemisphere(self):
        triangle = vims.directions([0, 0, 4], [-4, 4, 0])
        query = vims.directions([1, 1, -1, 80], [0, 180, 0, 0])
        np.testing.assert_array_equal(vims.triangle_contains(query, triangle), [True, False, False, False])

    def test_partial_support_retains_source_values_and_no_gap_fill(self):
        obs = observation()
        result, owner, pixel, cells = vims.project([obs], 'depth', 360, 180)
        self.assertEqual(cells['3'], 1)
        # Analytic interior is near the origin; geographic poles and far
        # longitudes cannot gain support from a nearest-neighbor extrapolator.
        self.assertEqual(int((owner > 0).sum()), 16)
        self.assertEqual(int(owner[89, 179]), 1)
        self.assertEqual(int(owner[0, 0]), 0)
        np.testing.assert_array_equal(result[owner > 0], obs['indices']['depth'][0].ravel()[pixel[owner > 0]-1])
        missing = observation(invalid=(0, 0))
        result, owner, _, _ = vims.project([missing], 'depth', 360, 180)
        self.assertFalse(owner.any())
        self.assertTrue(np.all(result == -9999))

    def test_dateline_footprint_does_not_cross_the_map_center(self):
        result, owner, _, _ = vims.project([observation((178, -178))], 'depth', 360, 180)
        self.assertEqual(int((owner > 0).sum()), 16)
        self.assertTrue(owner[89:91, :2].all())
        self.assertTrue(owner[89:91, -2:].all())
        self.assertFalse(owner[:, 10:-10].any())

    def test_overlap_prefers_geometry_without_science_value_blending(self):
        low, high = observation(value=3, resolution=10), observation(value=30, resolution=5)
        result, owner, _, _ = vims.project([low, high], 'depth', 360, 180)
        self.assertTrue(np.all(owner[owner > 0] == 2))
        self.assertTrue(np.all(np.isin(result[owner > 0], [30, 31, 32, 33])))
        same = observation(value=100, resolution=5)
        result, owner, _, _ = vims.project([high, same], 'depth', 360, 180)
        self.assertTrue(np.all(owner[owner > 0] == 1))


if __name__ == '__main__':
    unittest.main()
