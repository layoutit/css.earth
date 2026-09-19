"""Independent SVD fixture for ThERESA's signed-harmonic eigencurve convention."""
import sys
import urllib.request
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import external_record, write


COMMIT = '74a8fec0462f4583e336bbc44e2f2441b263a49f'
REFERENCE_URLS = [
    f'https://raw.githubusercontent.com/rychallener/ThERESA/{COMMIT}/theresa/lib/eigen.py',
    f'https://raw.githubusercontent.com/rychallener/ThERESA/{COMMIT}/theresa/lib/pca.py',
]

HARMONIC_CURVES = {
    'nondegenerate': np.array([
        [0.5, -1, 2, 0.25, 1.5, -0.75, 0.2, 1.1, -0.4],
        [1.2, 0.3, -0.8, 2.1, -1.4, 0.9, 1.7, -0.2, 0.6],
        [-0.4, 1.8, 0.7, -1.1, 0.2, 2.3, -0.9, 0.5, 1.4],
        [2, -0.5, 1.1, 0.8, -0.3, -1.6, 0.4, 1.9, -1.2],
    ], dtype=np.float64),
    # Four inputs spanning only two directions exercise rejection of the signed matrix's null spectrum.
    'rank-deficient': np.array([
        [1, 0, -1, 0, 1, -1, 0, 0],
        [2, 0, -2, 0, 2, -2, 0, 0],
        [0, 1, 0, -2, 0, 0.5, 1, -0.5],
        [1, 0.25, -1, -0.5, 1, -0.875, 0.25, -0.125],
    ], dtype=np.float64),
}
HARMONIC_CURVES['small-scale'] = HARMONIC_CURVES['nondegenerate'] * 1e-10
HARMONIC_CURVES['large-scale'] = HARMONIC_CURVES['nondegenerate'] * 1e80


def oracle_case(harmonic_curves):
    """Full LAPACK SVD of the matrix that ThERESA passes to TruncatedSVD."""
    signed = np.stack([curve for row in harmonic_curves for curve in (row, -row)])
    _, singular_values, right_vectors = np.linalg.svd(signed.T, full_matrices=False)
    squared = singular_values ** 2
    floor = np.max(squared) * 1e-12
    components = []
    for value, vector in zip(squared, right_vectors):
        coefficients = vector[0::2] - vector[1::2]
        if value <= floor or np.all(np.abs(coefficients) < 1e-9):
            continue
        curve = coefficients @ harmonic_curves
        components.append({
            'squaredSingularValue': float(value),
            # Eigenvector signs are arbitrary, so compare sign-invariant outer products.
            'coefficientProjector': np.outer(coefficients, coefficients).reshape(-1).tolist(),
            'curveProjector': np.outer(curve, curve).reshape(-1).tolist(),
        })
    return {
        'harmonics': int(harmonic_curves.shape[0]),
        'samples': int(harmonic_curves.shape[1]),
        'components': components,
    }


references = []
for url in REFERENCE_URLS:
    with urllib.request.urlopen(url, timeout=30) as response:
        data = response.read()
    references.append(external_record(url, data))

write(
    'eclipse-map/theresa-eigenbasis.json',
    'NumPy SVD following ThERESA 74a8fec signed-harmonic convention',
    'tools/oracles/eclipse-map/theresa-eigenbasis.py',
    {'method': 'numpy.linalg.svd'},
    [],
    {name: oracle_case(curves) for name, curves in HARMONIC_CURVES.items()},
    references,
)
