"""Bounded synthetic evidence for mask locality, shape gates and native accounting."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

import cv2
import numpy as np

spec = importlib.util.spec_from_file_location('star_separation', Path(__file__).with_name('star-separation.py'))
separation = importlib.util.module_from_spec(spec)
spec.loader.exec_module(separation)


def field(dtype=np.uint8, star=True, filament=False):
    yy, xx = np.mgrid[:97, :129]
    background = .07 + .0003 * xx + .0001 * yy
    if filament:
        background += .22 * np.exp(-((yy - 64) / 1.7) ** 2)
    signal = .65 * np.exp(-((xx - 43) ** 2 + (yy - 33) ** 2) / (2 * 1.8 ** 2)) if star else 0
    rgb = (background + signal)[:, :, None] * np.array([.8, 1., .7])
    return np.rint(rgb * np.iinfo(dtype).max).astype(dtype)


class StarSeparationTests(unittest.TestCase):
    def setUp(self):
        self.p = separation.parameters()

    def test_isolated_star_removed_filament_and_outskirts_bit_exact(self):
        original = field(filament=True)
        diffuse, stars, mask, accepted, _ = separation.separate(original, [[43, 33], [66, 64]], self.p)
        self.assertEqual(len(accepted), 1)
        self.assertGreater(int(stars[33, 43, 1]), 140)
        self.assertLess(int(diffuse[33, 43, 1]), 30)
        np.testing.assert_array_equal(diffuse[59:70], original[59:70])
        np.testing.assert_array_equal(diffuse[mask == 0], original[mask == 0])
        self.assertEqual(separation.verify(original, diffuse, stars, mask)['maximumReconstructionErrorCodeValues'], 0)

    def test_no_stars_is_identity_not_smoothed_diffuse(self):
        original = field(star=False, filament=True)
        points = separation.detect(original, self.p)
        diffuse, stars, mask, accepted, _ = separation.separate(original, points, self.p)
        self.assertEqual(accepted, [])
        self.assertEqual(np.count_nonzero(mask), 0)
        self.assertEqual(np.count_nonzero(stars), 0)
        np.testing.assert_array_equal(original, diffuse)

    def test_extended_round_nebula_rejected(self):
        yy, xx = np.mgrid[:97, :129]
        image = np.rint((.07 + .6 * np.exp(-((xx - 64) ** 2 + (yy - 48) ** 2) / (2 * 8 ** 2))) * 255).astype(np.uint8)
        diffuse, stars, mask, accepted, rejected = separation.separate(image, [[64, 48]], self.p)
        self.assertEqual(accepted, [])
        self.assertTrue(rejected)
        np.testing.assert_array_equal(diffuse, image)
        self.assertFalse(stars.any())

    def test_sixteen_bit_grid_channels_alpha_and_recombination(self):
        source = field(np.uint16)
        source = np.dstack([source, np.full(source.shape[:2], 65535, np.uint16)])
        source[:5, :, 3] = 0
        diffuse, stars, mask, accepted, _ = separation.separate(source, [[43, 33]], self.p)
        self.assertEqual(diffuse.dtype, np.uint16)
        self.assertEqual(diffuse.shape, source.shape)
        self.assertEqual(len(accepted), 1)
        self.assertTrue(np.any(diffuse[:, :, :3] % 257))
        np.testing.assert_array_equal(source[:, :, :3].astype(np.int32), diffuse[:, :, :3].astype(np.int32) + stars[:, :, :3].astype(np.int32))
        np.testing.assert_array_equal(source[:, :, 3], diffuse[:, :, 3])
        np.testing.assert_array_equal(source[:, :, 3], stars[:, :, 3])

    def test_native_detection_finds_star_and_deduplicates_tile_overlap(self):
        image = field()
        p = separation.parameters({'tileSize': 43})
        points = separation.detect(image, p)
        near = [point for point in points if np.hypot(point[0]-43, point[1]-33) < 2]
        self.assertEqual(len(near), 1)

    def test_explicit_native_candidate_capacity_is_bounded(self):
        self.assertEqual(separation.parameters({'maximumDetections': 2000000})['maximumDetections'], 2000000)
        with self.assertRaisesRegex(ValueError, 'bounded trial workspace'):
            separation.parameters({'maximumDetections': 2000001})

    def test_overlapping_centroids_cannot_double_count(self):
        image = field(np.uint16)
        a = separation.separate(image, [[43, 33]], self.p)
        b = separation.separate(image, [[43, 33], [43, 33]], self.p)
        np.testing.assert_array_equal(a[0], b[0])
        np.testing.assert_array_equal(a[1], b[1])

    def test_source_catalogue_identity_is_mandatory(self):
        image = dict(path='source.png', sha256='abc', nativeDimensions=[129, 97])
        document = dict(image=image, count=1, nativePixelCentres=[[43, 33]])
        self.assertEqual(separation.validate_centroids(document, 'source.png', 'abc', [129, 97], 10), [[43, 33]])
        for changed in ({'sha256': 'wrong'}, {'nativeDimensions': [97, 129]}, {'path': 'other.png'}):
            with self.assertRaises(ValueError):
                separation.validate_centroids({**document, 'image': {**image, **changed}}, 'source.png', 'abc', [129, 97], 10)

    def test_harmonic_background_preserves_affine_field(self):
        yy, xx = np.mgrid[:21, :21]
        original = np.repeat((200 + 3 * xx + 2 * yy)[:, :, None], 3, axis=2).astype(np.uint16)
        mask = (xx-10)**2 + (yy-10)**2 <= 8**2
        damaged = original.copy()
        damaged[mask] = 10000
        recovered = separation.interpolate(damaged, mask)
        np.testing.assert_allclose(recovered, original, atol=1e-8)

    def test_file_outputs_and_receipt_are_real_exact_native_data(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            source = directory / 'source.png'
            cv2.imwrite(str(source), field(np.uint16))
            output = directory / '.local' / 'trial'
            recipe = dict(schema='cssearth-star-separation@1', source=dict(path=str(source), sha256=separation.sha256(source), nativeDimensions=[129, 97]), outputDirectory=str(output))
            path = directory / 'recipe.json'
            path.write_text(json.dumps(recipe))
            receipt = separation.run(path)
            self.assertGreater(receipt['acceptedCount'], 0)
            self.assertTrue(receipt['verification']['encodedRoundTripExact'])
            self.assertEqual(receipt['verification']['maximumReconstructionErrorCodeValues'], 0)
            self.assertLessEqual((output / 'star-detection-map.png').stat().st_mtime_ns, (output / 'diffuse.png').stat().st_mtime_ns)
            for name, record in receipt['outputs'].items():
                self.assertEqual(separation.sha256(output / name), record['sha256'])
            recipe['source']['sha256'] = 'wrong'
            path.write_text(json.dumps(recipe))
            with self.assertRaisesRegex(ValueError, 'SHA256 mismatch'):
                separation.run(path)


if __name__ == '__main__':
    unittest.main()
