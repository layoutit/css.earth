"""Small analytical and independent all-face checks; never rasterize a grid."""
import hashlib
import importlib.util
import json
from pathlib import Path
import unittest

import numpy as np

SPEC = importlib.util.spec_from_file_location('fixed_mesh', Path(__file__).with_name('cassini-fixed-mesh.py'))
mesh_module = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(mesh_module)
FixedMesh = mesh_module.FixedMesh
ROOT = Path(__file__).resolve().parents[3]
TERRAIN = ROOT/'src/planets/phoebe/prepared/terrain.json'
TERRAIN_SHA = 'a6eb3c92075986288ddfc6e59d85391891ca0d96dc0f2c427ea7fbab2e576178'


def triangle(z=0):
    return [[-1, -1, z], [1, -1, z], [0, 1, z]]


def brute_plane_oracle(triangles, origins, directions):
    """All faces, plane hit then Gram-matrix barycentrics; no BVH or M-T."""
    a, b, c = triangles[:, 0], triangles[:, 1], triangles[:, 2]
    e, f = b-a, c-a
    normal = np.cross(e, f)
    ee, ef, ff = (e*e).sum(axis=1), (e*f).sum(axis=1), (f*f).sum(axis=1)
    gram = ee*ff-ef*ef
    results = []
    for origin, ray in zip(origins, directions):
        denominator = normal @ ray
        distances = np.full(len(triangles), np.inf)
        np.divide((normal*(a-origin)).sum(axis=1), denominator, out=distances, where=denominator != 0)
        candidates = np.flatnonzero(np.isfinite(distances) & (distances > 0))
        points = origin+distances[candidates, None]*ray
        rel = points-a[candidates]
        re, rf = (rel*e[candidates]).sum(axis=1), (rel*f[candidates]).sum(axis=1)
        u = (ff[candidates]*re-ef[candidates]*rf)/gram[candidates]
        v = (ee[candidates]*rf-ef[candidates]*re)/gram[candidates]
        interior = candidates[(u >= 0) & (v >= 0) & (u+v <= 1)]
        if not len(interior):
            results.append((-1, np.inf))
        else:
            order = np.lexsort((interior, distances[interior]))
            face = interior[order[0]]
            results.append((int(face), float(distances[face])))
    return results


class FixedMeshTests(unittest.TestCase):
    def test_front_back_parallel_miss_and_strictly_positive(self):
        mesh = FixedMesh([triangle()])
        origins = [[0, 0, 2], [0, 0, -2], [0, 0, 2], [3, 0, 2], [0, 0, 0], [0, 0, 2]]
        directions = [[0, 0, -1], [0, 0, 1], [1, 0, 0], [0, 0, -1], [0, 0, 1], [0, 0, 1]]
        result = mesh.intersect(origins, directions)
        np.testing.assert_array_equal(result['face'], [0, 0, -1, -1, -1, -1])
        np.testing.assert_allclose(result['distance'][:2], [2, 2])
        np.testing.assert_array_equal(result['point'][:2], [[0, 0, 0], [0, 0, 0]])
        self.assertTrue(np.isinf(result['distance'][2:]).all())
        self.assertTrue(np.isnan(result['point'][2:]).all())

    def test_nearest_occluder_and_exact_tie_original_index(self):
        mesh = FixedMesh([triangle(0), triangle(2), triangle(1), triangle(2)], leaf_size=1)
        result = mesh.intersect([0, 0, 3], [[0, 0, -1]])
        np.testing.assert_array_equal(result['face'], [1])
        np.testing.assert_array_equal(result['distance'], [1])
        np.testing.assert_array_equal(result['point'], [[0, 0, 2]])

    def test_shared_edge_vertex_and_parallel_slab_boundaries(self):
        triangles = [[[0, 0, 0], [1, 0, 0], [1, 1, 0]], [[0, 0, 0], [1, 1, 0], [0, 1, 0]]]
        mesh = FixedMesh(triangles, leaf_size=1)
        result = mesh.intersect([[.5, .5, 2], [0, 0, 2], [1, 1, 2], [1.0001, 1, 2]], [[0, 0, -1]]*4)
        np.testing.assert_array_equal(result['face'], [0, 0, 0, -1])

    def test_winding_normals_immutable_geometry_and_broadcast_batching(self):
        original = np.array([triangle(), list(reversed(triangle(1)))], dtype=float)
        before = original.copy()
        mesh = FixedMesh(original, batch_size=7)
        original[:] = 99
        np.testing.assert_array_equal(mesh.triangles, before)
        np.testing.assert_array_equal(mesh.normals, [[0, 0, 1], [0, 0, -1]])
        self.assertFalse(mesh.triangles.flags.writeable)
        self.assertFalse(mesh.normals.flags.writeable)
        result = mesh.intersect([[0, 0, 3]], np.tile([0, 0, -1.], (1025, 1)))
        np.testing.assert_array_equal(result['face'], np.ones(1025, dtype=int))
        np.testing.assert_array_equal(result['distance'], np.full(1025, 2.))
        np.testing.assert_array_equal(result['point'], np.tile([0, 0, 1.], (1025, 1)))

    def test_unit_input_validation_and_empty_queries(self):
        mesh = FixedMesh([triangle()])
        for origins, rays in [([0, 0, 2], [0, 0, -2]), ([0, 0, 2], [0, 0, 0]),
                              ([0, 0, float('nan')], [0, 0, 1]), ([[0, 0, 2]]*2, [[0, 0, 1]]*3)]:
            with self.assertRaises(ValueError):
                mesh.intersect(origins, rays)
        result = mesh.intersect([0, 0, 0], np.empty((0, 3)))
        self.assertEqual(result['point'].shape, (0, 3))
        for value in ([], [[[0, 0, 0]]*3], [[[float('inf'), 0, 0], [1, 0, 0], [0, 1, 0]]]):
            with self.assertRaises(ValueError):
                FixedMesh(value)
        with self.assertRaises(ValueError):
            FixedMesh([triangle()], batch_size=1025)

    def test_fixed_phoebe_mesh_against_independent_all_faces(self):
        original = TERRAIN.read_bytes()
        self.assertEqual(hashlib.sha256(original).hexdigest(), TERRAIN_SHA)
        faces = json.loads(original)['faces']
        self.assertEqual(len(faces), 3500)
        triangles = np.array([face['vertices'] for face in faces])*(106.5/230)
        mesh = FixedMesh(triangles)
        supplied = np.array([face['normal'] for face in faces])
        np.testing.assert_allclose(mesh.normals, supplied, atol=2e-12, rtol=0)
        # Explicit dispersed radial rays: no full720x360 map and no fitter.
        lonlat = [(0, 0), (35, 22), (89, -31), (137, 58), (185, -52),
                  (224, 12), (279, 39), (321, -65), (51, 84), (242, -82)]
        directions = np.array([[np.cos(np.radians(lat))*np.cos(np.radians(lon)),
                                np.cos(np.radians(lat))*np.sin(np.radians(lon)), np.sin(np.radians(lat))]
                               for lon, lat in lonlat])
        origins = np.zeros_like(directions)
        # Source-derived final fixed-frame fixtures at dispersed original rows,
        # with the independently qualified nominal image offsets and origin.
        # This test verifies intersection arithmetic, not those registration fits.
        anchors_path = ROOT/'tests/objects/fixtures/phoebe/regional-mask.json'
        evidence = json.loads(anchors_path.read_text())
        self.assertEqual(evidence['terrainSha256'], TERRAIN_SHA)
        anchors = [evidence['acceptedPixels'][i]['nominal'] for i in (0, 8, 16, 24, 32, 40)]
        source_origins = np.array([entry['observerKm'] for entry in anchors])
        source_rays = np.array([entry['unitRayFixedFrame'] for entry in anchors])
        origins = np.concatenate((origins, source_origins, source_origins))
        directions = np.concatenate((directions, source_rays, -source_rays))
        expected = brute_plane_oracle(triangles, origins, directions)
        actual = mesh.intersect(origins, directions)
        np.testing.assert_array_equal(actual['face'], [row[0] for row in expected])
        np.testing.assert_array_equal(actual['face'][10:16], [entry['faceIndex'] for entry in anchors])
        np.testing.assert_allclose(actual['point'][10:16], [entry['pointKm'] for entry in anchors], atol=2e-9, rtol=0)
        np.testing.assert_allclose(actual['distance'], [row[1] for row in expected], atol=2e-9, rtol=2e-13)
        for origin, ray, point, (face, distance) in zip(origins, directions, actual['point'], expected):
            if face >= 0:
                np.testing.assert_allclose(point, origin+distance*ray, atol=2e-9, rtol=0)
        self.assertEqual(hashlib.sha256(TERRAIN.read_bytes()).hexdigest(), TERRAIN_SHA)


if __name__ == '__main__':
    unittest.main()
