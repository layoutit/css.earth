#!/usr/bin/env python3
"""Fit the orbits a wide binary's measurements allow, with LOFTI (Pearce et al. 2020).

    python tools/objects/binary-orbits/lofti-fit.py <mode> <orbits> <output.txt>

LOFTI ("Orbits for the Impatient") draws orbits from the standard priors, scales and rotates each one onto the measured
separation and position angle, and keeps it with the probability of its chi-squared against the measured relative proper
motion (and radial velocity, where one is used). It reads both stars' rows from the Gaia archive itself, including the
bright-star proper-motion correction of Cantat-Gaudin & Brandt (2021), so the fit is the authors' own procedure.

Modes for HD 189733 A and B, whose two published relative radial velocities disagree:
  none   only Gaia astrometry: position, and motion across the sky.
  bakos  adds the 2005 CfA radial velocities of Bakos et al. (2006): B - A = -0.72 +/- 1.02 km/s.
  gaia   adds Gaia DR3's own radial velocities: B - A = +3.99 +/- 1.21 km/s.

Masses: 0.807 +/- 0.005 solar masses for A (Lally et al. 2025, Table 1) and 0.193 +/- 0.020 for B (TESS Input Catalog v8.2).
"""
import sys
import numpy as np
from lofti_gaia import lofti

A, B = 1827242816201846144, 1827242816176111360
MASS_A, MASS_B = (0.807, 0.005), (0.193, 0.020)
BAKOS_RV_A, BAKOS_RV_B = (-2.38, 0.20), (-3.1, 1.0)  # Bakos et al. (2006), section 2.2, km/s
BAKOS_EPOCH = 2005.95  # 2005 December

def main(mode: str, orbits: int, output: str) -> None:
    fitter = lofti.Fitter(A, B, MASS_A, MASS_B, Norbits=orbits, results_filename=output, catalog='gaiadr3.gaia_source')
    if mode in ('none', 'bakos'):
        fitter.rv = [0, 0]  # drop the Gaia radial velocities the constructor read
    if mode == 'bakos':
        fitter.use_user_rv = True
        # lofti flips the sign of a user radial velocity, so the difference is passed as measured.
        fitter.user_rv = np.array([[-(BAKOS_RV_B[0] - BAKOS_RV_A[0])], [np.hypot(BAKOS_RV_B[1], BAKOS_RV_A[1])]])
        fitter.user_rv_dates = np.array([BAKOS_EPOCH])
    print(f'{mode}: separation {fitter.sep[0]:.1f} mas, position angle {fitter.pa[0]:.2f} deg, '
          f'relative motion {fitter.pmRA[0]:.3f}, {fitter.pmDec[0]:.3f} km/s, radial velocity {fitter.rv}', flush=True)
    lofti.FitOrbit(fitter, write_stats=False, write_results=True)

if __name__ == '__main__':
    if len(sys.argv) != 4 or sys.argv[1] not in ('none', 'bakos', 'gaia'):
        raise SystemExit('Usage: lofti-fit.py <none|bakos|gaia> <orbits> <output.txt>')
    main(sys.argv[1], int(sys.argv[2]), sys.argv[3])
