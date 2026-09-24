#!/usr/bin/env python3
"""One orbit from the posterior an orbit paper distributes through whereistheplanet (Wang et al. 2021).

    python tools/objects/hosted-orbits/posterior-pick.py <pick.json> <orbit.json>

When a paper's own orbitize! posterior is published, no refit is needed: the orbit is one of its samples. The pick file
names the whereistheplanet key, the companion (body 1 unless a joint fit of several says otherwise) and the paper's measured
positions (an orbitize! input table). The sample kept is the one
with the highest stored likelihood; a posterior that stores no likelihoods, or stores them all equal, is scored instead
against the measured positions with orbitize!'s own orbit function and the published errors, and the smallest chi-squared
is kept. The residual at every measured position is written beside the orbit.

A paper may instead publish its posterior as a FITS table of its own sampler's columns (Octofitter; Thompson et al. 2023).
The pick file then names that file, which column holds each element, their angle unit, the periastron-time column (MJD)
and the column to rank by. PlanetOrbits.jl, which Octofitter orbits are computed with, writes the sky offsets with the same
formulas as orbitize! and gives the orbiting body's argument of periastron, so the elements carry over unchanged. The
sample kept is the one with the highest log-posterior: with informative priors (the star's mass), the highest likelihood
alone can sit where the paper's own prior rules it out.

A joint fit of several companions with their masses stores each companion's six elements, the parallax, the companions'
masses and the star's. As orbitize! does without N-body integration, a companion's Keplerian orbit uses the star's mass plus
the masses of every companion at or inside its semi-major axis. The orbit written is that Keplerian orbit alone; the few
hundredths of a milliarcsecond the other companions move the star are not in it, and show in the residuals.
"""
import json
import os
import sys

import h5py
import numpy as np
import whereistheplanet
import whereistheplanet.whereistheplanet as catalogue
from orbitize import kepler, read_input

ELEMENTS = ['sma', 'ecc', 'inc', 'aop', 'pan', 'tau']
LABELS = [f'{name}1' for name in ELEMENTS] + ['plx', 'mtot']
ANGLES = {'inc1', 'aop1', 'pan1'}


def labels(posterior, width: int) -> list[str]:
    """The posterior's column names: stored, or rebuilt from the fit's own settings as orbitize!'s standard basis orders them."""
    if 'col_names' in posterior:
        return [name.decode() if isinstance(name, bytes) else str(name) for name in posterior['col_names']]
    bodies = int(posterior.attrs.get('num_secondary_bodies', 1))
    names = [f'{name}{body}' for body in range(1, bodies + 1) for name in ELEMENTS] + ['plx']
    names += [f'm{body}' for body in range(1, bodies + 1)] + ['m0'] if bool(posterior.attrs.get('fit_secondary_mass', False)) else ['mtot']
    if len(names) != width:
        raise ValueError(f'{posterior.filename}: {width} posterior columns, but the fit settings name {len(names)}: {names}')
    return names


def one_body(sample, names: list[str], body: int) -> np.ndarray:
    """One companion's elements, parallax and the total mass its Keplerian orbit uses."""
    value = dict(zip(names, sample))
    if 'mtot' in value:
        mass = value['mtot']
    else:
        bodies = sorted({int(name[3:]) for name in names if name.startswith('sma')})
        mass = value['m0'] + sum(value[f'm{other}'] for other in bodies if value[f'sma{other}'] <= value[f'sma{body}'])
    return np.array([value[f'{name}{body}'] for name in ELEMENTS] + [value['plx'], mass])


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


def from_fits(pick: dict, pick_path: str, output: str) -> None:
    from astropy.io import fits
    spec = pick['posteriorFits']
    with fits.open(os.path.join(os.path.dirname(pick_path), spec['path'])) as posterior:
        table = posterior[1].data
        column = lambda name: np.asarray(table[name], dtype=float).ravel()
        rank = column(spec['rankColumn'])
        best = int(np.argmax(rank))
        value = {label: float(column(name)[best]) for label, name in spec['columns'].items()}
        extra = {label: float(column(name)[best]) for label, name in spec.get('extra', {}).items()}
    scale = np.degrees(1.0) if spec['angleUnit'] == 'radian' else 1.0
    for label in ANGLES:
        value[label] = (value[label] * scale) % 360
    tau_reference = float(pick['tauReferenceMjd'])
    period_days = np.sqrt(value['sma1'] ** 3 / value['mtot']) * 365.25
    value['tau1'] = ((value.pop('periastronMjd') - tau_reference) / period_days) % 1.0
    sample = np.array([value['sma1'], value['ecc1'], np.radians(value['inc1']), np.radians(value['aop1']), np.radians(value['pan1']),
                       value['tau1'], value['plx'], value['mtot']])
    table = read_input.read_file(os.path.join(os.path.dirname(pick_path), pick['measurements']))
    table = table[[kind in ('radec', 'seppa') for kind in table['quant_type']]]
    residuals = []
    for row in table:
        ra, dec = position(sample, row['epoch'], tau_reference)
        model = [ra, dec] if row['quant_type'] == 'radec' else [float(np.hypot(ra, dec)), float(np.degrees(np.arctan2(ra, dec)) % 360)]
        residuals.append({'epoch': float(row['epoch']), 'kind': str(row['quant_type']), 'measured': [float(row['quant1']), float(row['quant2'])],
                          'error': [float(row['quant1_err']), float(row['quant2_err'])], 'model': model})
    result = {'source': spec['source'], 'rule': f"highest {spec['rankColumn']} ({rank[best]:.2f}) of {len(rank):,} samples", 'samples': int(len(rank)),
              'tauReferenceMjd': tau_reference, 'orbit': {label: float(value[label]) for label in LABELS}, 'residuals': residuals}
    result.update(extra)
    with open(output, 'w') as handle:
        json.dump(result, handle, indent=1)
    print(json.dumps({k: v for k, v in result.items() if k != 'residuals'}, indent=1))


def main(pick_path: str, output: str) -> None:
    with open(pick_path) as handle:
        pick = json.load(handle)
    if 'posteriorFits' in pick:
        return from_fits(pick, pick_path, output)
    key, body = pick['whereistheplanetKey'], int(pick.get('body', 1))
    filename, reference = catalogue.post_dict[key][0], catalogue.post_dict[key][1]
    with h5py.File(os.path.join(catalogue.datadir, filename)) as posterior:
        stored = np.array(posterior['post'], dtype=float)
        names = labels(posterior, stored.shape[1])
        samples = np.array([one_body(sample, names, body) for sample in stored])
        likelihood = np.array(posterior['lnlike'], dtype=float) if 'lnlike' in posterior else None
        tau_reference = float(posterior.attrs['tau_ref_epoch'])
    table = read_input.read_file(os.path.join(os.path.dirname(pick_path), pick['measurements']))
    table = table[[kind in ('radec', 'seppa') and int(number) == body for kind, number in zip(table['quant_type'], table['object'])]]
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
    if f'm{body}' in names:
        result['companionMassSolar'] = float(stored[best][names.index(f'm{body}')])
    with open(output, 'w') as handle:
        json.dump(result, handle, indent=1)
    print(json.dumps({k: v for k, v in result.items() if k != 'residuals'}, indent=1))


if __name__ == '__main__':
    if len(sys.argv) != 3:
        raise SystemExit(__doc__)
    main(sys.argv[1], sys.argv[2])
