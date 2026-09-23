#!/usr/bin/env python3
"""One orbit from the posterior an orbit paper distributes through whereistheplanet (Wang et al. 2021).

    python tools/objects/hosted-orbits/posterior-pick.py <pick.json> <orbit.json>

When a paper's own orbitize! posterior is published, no refit is needed: the orbit is one of its samples. The pick file
names the whereistheplanet key and the paper's measured positions (an orbitize! input table). The sample kept is the one
with the highest stored likelihood; a posterior that stores no likelihoods, or stores them all equal, is scored instead
against the measured positions with orbitize!'s own orbit function and the published errors, and the smallest chi-squared
is kept. The residual at every measured position is written beside the orbit.
"""
import json
import os
import sys

import h5py
import numpy as np
import whereistheplanet
import whereistheplanet.whereistheplanet as catalogue
from orbitize import kepler, read_input

LABELS = ['sma1', 'ecc1', 'inc1', 'aop1', 'pan1', 'tau1', 'plx', 'mtot']
ANGLES = {'inc1', 'aop1', 'pan1'}


def position(sample, epoch, tau_reference):
    ra, dec, _ = kepler.calc_orbit(np.array([epoch]), *sample[:6], sample[6], sample[7], tau_ref_epoch=tau_reference)
    return float(np.ravel(ra)[0]), float(np.ravel(dec)[0])


def chi_squared(sample, tau_reference, table):
    total = 0.0
    for row in table:
        ra, dec = position(sample, row['epoch'], tau_reference)
        if row['quant_type'] == 'radec':
            sra, sdec, rho = row['quant1_err'], row['quant2_err'], row['quant12_corr'] if np.isfinite(row['quant12_corr']) else 0.0
            miss = np.array([ra - row['quant1'], dec - row['quant2']])
            covariance = np.array([[sra ** 2, rho * sra * sdec], [rho * sra * sdec, sdec ** 2]])
            total += float(miss @ np.linalg.solve(covariance, miss))
        elif row['quant_type'] == 'seppa':
            angle = np.degrees(np.arctan2(ra, dec)) % 360
            total += ((np.hypot(ra, dec) - row['quant1']) / row['quant1_err']) ** 2
            total += (((angle - row['quant2'] + 180) % 360 - 180) / row['quant2_err']) ** 2
    return total


def main(pick_path: str, output: str) -> None:
    with open(pick_path) as handle:
        pick = json.load(handle)
    key = pick['whereistheplanetKey']
    filename, reference = catalogue.post_dict[key][0], catalogue.post_dict[key][1]
    with h5py.File(os.path.join(catalogue.datadir, filename)) as posterior:
        samples = np.array(posterior['post'], dtype=float)
        likelihood = np.array(posterior['lnlike'], dtype=float) if 'lnlike' in posterior else None
        tau_reference = float(posterior.attrs['tau_ref_epoch'])
    table = read_input.read_file(os.path.join(os.path.dirname(pick_path), pick['measurements']))
    table = table[[kind in ('radec', 'seppa') for kind in table['quant_type']]]
    if likelihood is not None and np.ptp(likelihood) > 0:
        best = int(np.argmax(likelihood))
        rule = f'highest stored likelihood (ln L {likelihood[best]:.2f})'
    else:
        scores = np.array([chi_squared(sample, tau_reference, table) for sample in samples])
        best = int(np.argmin(scores))
        rule = f'no stored likelihoods differ: smallest chi-squared against the {len(table)} measured positions ({scores[best]:.2f})'
    sample = samples[best]
    residuals = []
    for row in table:
        ra, dec = position(sample, row['epoch'], tau_reference)
        model = [ra, dec] if row['quant_type'] == 'radec' else [float(np.hypot(ra, dec)), float(np.degrees(np.arctan2(ra, dec)) % 360)]
        residuals.append({'epoch': float(row['epoch']), 'kind': str(row['quant_type']), 'measured': [float(row['quant1']), float(row['quant2'])],
                          'error': [float(row['quant1_err']), float(row['quant2_err'])], 'model': model})
    result = {'source': f'whereistheplanet {whereistheplanet.__version__}, {filename} ({reference})',
              'rule': rule, 'samples': int(len(samples)), 'tauReferenceMjd': tau_reference,
              'orbit': {label: float(np.degrees(v)) if label in ANGLES else float(v) for label, v in zip(LABELS, sample)},
              'residuals': residuals}
    with open(output, 'w') as handle:
        json.dump(result, handle, indent=1)
    print(json.dumps({k: v for k, v in result.items() if k != 'residuals'}, indent=1))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
