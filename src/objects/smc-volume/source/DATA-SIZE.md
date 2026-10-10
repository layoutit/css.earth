# SMC physical scale audit

The model is a collisionless stellar-mass simulation, not a measured nebular gas or dust cloud. The full tidal population and an optical image's bright central body are different extents. Do not resize the model to fit a photograph's rectangle.

## Verified original data

[Dryad README](https://datadryad.org/dataset/doi:10.5061/dryad.1vhhmgr82) specifies positions in kpc, velocities in km/s and masses in 232,000 solar masses. The SMC selection is the last 225,000 star-family particles after 240,000 MW and 1,620,000 LMC particles. We use snapshot00440: 2,200 Myr elapsed, the dataset's selected present-day comparison. Raw header time3.2 is not elapsed Gyr.

Directly reading all225,000 selected source records confirms the imported coordinates agree within0.00000191 kpc. Each particle represents about4,718 solar masses, not one star; total selected mass is1.06162 billion solar masses. The snapshot has no gas-family particles. The compact cloud input keeps XYZ/mass; source velocities and gravitational potential exist but do not supply image luminosity or gas/dust depth.

[Computed audit](size-audit.json) uses physical source coordinates, before the authored similarity fit:

| Population around coordinate-wise median | 3D enclosing radius |
| --- | ---: |
| 50% of stellar mass | 4.25 kpc |
| 90% | 8.95 kpc |
| 95% | 10.76 kpc |
| 99% | 13.24 kpc |
| All particles | 46.64 kpc |

These are spherical mass quantiles, not projected optical radii or bound-membership cuts. Extreme tidal particles do not define the luminous core's diameter.

## Paper cross-check

The accessible [paper preprint, Table1 and Section5.8/Figure24](https://arxiv.org/html/2602.05021v1#S5.SS8) gives initial SMC disc radial scale length1.4kpc and vertical scale0.26kpc. Neither is a present-day diameter. Its evolved simulated radial profile has core exponential scale0.46kpc and extended component scale7.87kpc, fitted to radius5.5kpc before a density break. The authors explicitly do not interpret that break as a hard disc truncation. They compare the simulated profile with a different observed Gaia profile; the model is not an exact photometric reconstruction. Final journal DOI:10.1093/mnras/stag1287; the numerical profile above was checked in the accessible preprint.

The pinned SMASH picture covers approximately5.31° ×4.43°, corresponding to5.79 ×4.83kpc at the lab's62.44kpc reference distance. This is the image footprint, not the full SMC extent. A 3D mass radius and a 2D photo width cannot be compared as interchangeable diameters.

## Consequence for the current work

The recent scale1.427 and rotation119.6° are an authored fit to central stellar light, not a physical calibration. The fit score ignores unseen outer tails and must not establish the model's size. Native physical scale must remain1kpc per unit. A physically justified placement needs the paper's observer/frame transformation and explicitly distinguished model/observed centres. Display brightness, observed surface-density profile and image coverage require separate evaluation; scaling or clipping all tidal material into the photo is not a valid fix.
