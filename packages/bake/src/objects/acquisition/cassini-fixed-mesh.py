"""Offline closest-ray intersections against an existing, unchanged triangle mesh.

The caller owns geometry/frame/units and input pins. This helper neither loads
nor generates a shape, changes winding, fits registration, or offsets ray
origins. Pass the fixed Phoebe terrain vertices in kilometres (display vertices
times106.5/230) when using it for the B9 source mapper.

Two-sided float64 Moller-Trumbore intersections retain strictly positive ray
parameters. Exactly equal computed distances choose the lowest original face
index. There is no barycentric expansion, distance cutoff or hidden self-hit
epsilon. Surface visibility callers must state any origin/endpoint policy.

A deterministic median BVH accelerates exact triangle tests. Only its bounds
expand outward by one float64 step; this cannot create a triangle intersection.
Ray batches are at most1024 and leaves at most64 triangles, so temporary work
never scales as all rays times all faces. Inputs must contain finite unit rays;
directions are validated, never silently normalized.
"""
import numpy as np


class FixedMesh:
    def __init__(self, triangles, *, leaf_size=16, batch_size=1024):
        if (type(leaf_size) is not int or not 1 <= leaf_size <= 64
                or type(batch_size) is not int or not 1 <= batch_size <= 1024):
            raise ValueError('Expected leaf_size1..64 and batch_size1..1024')
        mesh = np.array(triangles, dtype=np.float64, order='C', copy=True)
        if mesh.ndim != 3 or mesh.shape[1:] != (3, 3) or len(mesh) == 0 or not np.isfinite(mesh).all():
            raise ValueError('Finite nonempty (faces,3,3) triangles required')
        edge1, edge2 = mesh[:, 1]-mesh[:, 0], mesh[:, 2]-mesh[:, 0]
        cross = np.cross(edge1, edge2)
        length = np.linalg.norm(cross, axis=1)
        if not np.isfinite(length).all() or np.any(length == 0):
            raise ValueError('Degenerate or unrepresentable triangle')
        normals = cross/length[:, None]
        # Immutable private copy: callers retain their original arrays unchanged.
        for value in (mesh, edge1, edge2, normals):
            value.flags.writeable = False
        self.triangles, self.normals = mesh, normals
        self._edge1, self._edge2 = edge1, edge2
        self.batch_size = batch_size
        self._nodes = []
        low, high = mesh.min(axis=1), mesh.max(axis=1)
        centers = low+(high-low)/2

        def build(faces):
            index = len(self._nodes)
            bounds_low = np.nextafter(low[faces].min(axis=0), -np.inf)
            bounds_high = np.nextafter(high[faces].max(axis=0), np.inf)
            self._nodes.append(None)
            if len(faces) <= leaf_size:
                # Original face order resolves ties independently of traversal.
                self._nodes[index] = (bounds_low, bounds_high, -1, -1, np.sort(faces))
            else:
                extent = np.ptp(centers[faces], axis=0)
                axis = int(np.argmax(extent))
                ordered = faces[np.argsort(centers[faces, axis], kind='stable')]
                split = len(ordered)//2
                left, right = build(ordered[:split]), build(ordered[split:])
                self._nodes[index] = (bounds_low, bounds_high, left, right, None)
            return index

        build(np.arange(len(mesh), dtype=np.int64))

    @staticmethod
    def _box(origins, directions, low, high, best):
        """Conservative slab lookup; parallel axes never produce0/0 or0*inf."""
        moving = directions != 0
        first = np.full(directions.shape, -np.inf)
        second = np.full(directions.shape, np.inf)
        np.divide(low-origins, directions, out=first, where=moving)
        np.divide(high-origins, directions, out=second, where=moving)
        near = np.minimum(first, second).max(axis=1)
        far = np.maximum(first, second).min(axis=1)
        outside_parallel = ((~moving) & ((origins < low) | (origins > high))).any(axis=1)
        return (~outside_parallel) & (far >= near) & (far > 0) & (near <= best)

    def _leaf(self, origins, directions, faces):
        """Vectorized two-sided Moller-Trumbore against this bounded leaf."""
        a = self.triangles[faces, 0]
        edge1, edge2 = self._edge1[faces], self._edge2[faces]
        p = np.cross(directions[:, None, :], edge2[None, :, :])
        determinant = np.einsum('rfk,fk->rf', p, edge1)
        tvec = origins[:, None, :]-a[None, :, :]
        u = np.einsum('rfk,rfk->rf', tvec, p)
        q = np.cross(tvec, edge1[None, :, :])
        v = np.einsum('rk,rfk->rf', directions, q)
        numerator = np.einsum('fk,rfk->rf', edge2, q)
        sign = np.sign(determinant)
        u, v, positive_t = u*sign, v*sign, numerator*sign
        valid = ((determinant != 0) & (u >= 0) & (v >= 0)
                 & (u+v <= np.abs(determinant)) & (positive_t > 0))
        distance = np.full(determinant.shape, np.inf)
        np.divide(numerator, determinant, out=distance, where=valid)
        distance[~np.isfinite(distance)] = np.inf
        closest = distance.min(axis=1)
        chosen = np.where(distance == closest[:, None], faces[None, :], np.iinfo(np.int64).max).min(axis=1)
        chosen[~np.isfinite(closest)] = -1
        return chosen, closest

    def intersect(self, origins, directions):
        """Return face(N), distance(N), point(N,3); misses are−1/inf/NaN.

        Origins may be(3,), (1,3) or(N,3); directions may be(3,) or(N,3).
        All results retain original ray order. A one-ray input returns arrays
        of length one, never a scalar. Ray direction norm tolerance is1e−12.
        """
        directions = np.asarray(directions, dtype=np.float64)
        origins = np.asarray(origins, dtype=np.float64)
        if directions.shape == (3,):
            directions = directions.reshape(1, 3)
        if origins.shape == (3,):
            origins = origins.reshape(1, 3)
        if (directions.ndim != 2 or directions.shape[1:] != (3,)
                or origins.ndim != 2 or origins.shape[1:] != (3,)
                or len(origins) not in (1, len(directions))
                or not np.isfinite(directions).all() or not np.isfinite(origins).all()):
            raise ValueError('Finite(N,3) rays and one orN origins required')
        if np.any(np.abs(np.linalg.norm(directions, axis=1)-1) > 1e-12):
            raise ValueError('Unit ray directions required; no implicit normalization')
        count = len(directions)
        origins = np.broadcast_to(origins, (count, 3))
        face = np.full(count, -1, dtype=np.int64)
        distance = np.full(count, np.inf)
        point = np.full((count, 3), np.nan)
        for start in range(0, count, self.batch_size):
            stop = min(count, start+self.batch_size)
            o, d = origins[start:stop], directions[start:stop]
            best_face, best_distance = face[start:stop], distance[start:stop]
            stack = [(0, np.arange(stop-start))]
            while stack:
                index, rays = stack.pop()
                low, high, left, right, faces = self._nodes[index]
                keep = self._box(o[rays], d[rays], low, high, best_distance[rays])
                rays = rays[keep]
                if not len(rays):
                    continue
                if faces is None:
                    stack.append((right, rays))
                    stack.append((left, rays))
                    continue
                candidate_face, candidate_distance = self._leaf(o[rays], d[rays], faces)
                take = ((candidate_face >= 0)
                        & ((candidate_distance < best_distance[rays])
                           | ((candidate_distance == best_distance[rays]) & (candidate_face < best_face[rays]))))
                selected = rays[take]
                best_distance[selected], best_face[selected] = candidate_distance[take], candidate_face[take]
            hit = best_face >= 0
            point[start:stop][hit] = o[hit]+best_distance[hit, None]*d[hit]
        return {'face': face, 'distance': distance, 'point': point}
