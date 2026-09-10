import math
from pathlib import Path
import struct
import tempfile
import unittest

from cmod import decode, inspect


def fixture(vertices, faces):
    pack = lambda fmt, *values: struct.pack('<' + fmt, *values)
    data = b'#celmodel_binary' + pack('3H3fH', 1001, 1003, 7, 1, 1, 1, 1002)
    data += pack('10H', 1009, 1011, 0, 2, 3, 2, 5, 1, 1012, 1013)
    data += pack('I', len(vertices))
    for row in vertices:
        data += pack('8f', *row, 0, 0, 1, .25, .75)
    data += pack('H2I', 0, 0, len(faces) * 3)
    data += b''.join(pack('3I', *f) for f in faces) + pack('H', 1010)
    return data


class CmodTest(unittest.TestCase):
    vertices = [(0, 0, 0), (1, 0, 0), (0, 2, 0), (0, 0, 3)]
    faces = [(0, 2, 1), (0, 1, 3), (0, 3, 2), (1, 2, 3)]

    def test_exact_binary_decode_and_geometry_conversion(self):
        data = fixture(self.vertices, self.faces)
        rows, faces = decode(data)[0]
        self.assertEqual(faces, self.faces)
        self.assertEqual(rows[1], (1, 0, 0, 0, 0, 1, .25, .75))
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, 'source.cmod'); path.write_bytes(data)
            positions, _, output_faces, report = inspect(path, 600)
        self.assertEqual(output_faces, self.faces)
        self.assertEqual(positions[0], (-100, 300, -200))
        self.assertEqual(report['fullExtentsMeters'], [200, 600, 400])
        self.assertAlmostEqual(report['signedVolumeCubicMeters'], 8_000_000)
        self.assertAlmostEqual(report['volumeEquivalentRadiusKm'], (6_000_000 / math.pi) ** (1 / 3) / 1000)

    def test_omits_only_exact_zero_area_source_triangles(self):
        vertices = self.vertices + [(2, 0, 0)]
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory, 'source.cmod'); path.write_bytes(fixture(vertices, self.faces + [(0, 1, 4)]))
            _, _, faces, report = inspect(path, 600)
        self.assertEqual(faces, self.faces)
        self.assertEqual(report['omittedZeroAreaSourceFaceIndices'], [4])

    def test_rejects_truncation_nonfinite_vertices_and_bad_indices(self):
        valid = fixture(self.vertices, self.faces)
        for invalid in [b'bad' + valid[3:], valid[:-1], fixture([(float('nan'), 0, 0)] + self.vertices[1:], self.faces), fixture(self.vertices, [(0, 1, 9)])]:
            with self.subTest(size=len(invalid)), self.assertRaises(ValueError):
                decode(invalid)


if __name__ == '__main__':
    unittest.main()
