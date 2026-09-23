#!/usr/bin/env python3
"""Refit a directly imaged companion's orbit with orbitize! (Blunt et al. 2020) from a paper's published inputs.

    python tools/objects/hosted-orbits/orbitize-fit.py <fit.json> <results.hdf5>
    python tools/objects/hosted-orbits/orbitize-fit.py --refine <fit.json> <results.hdf5> <orbit.json>

A paper that fits an imaged companion's orbit usually publishes its measurements, priors and sampler settings but not
its posterior samples, and its table gives marginal medians, which are not one orbit. This runs the paper's own tool on
the paper's own inputs so that one orbit, the highest-likelihood sample, can be read from the posterior. The fit file
names the measurements (an orbitize! input table), the Gaussian priors on total mass and parallax, any correction the
paper applied to the measurements, and the sampler the paper used (parallel-tempered MCMC or OFTI rejection sampling);
each value cites where it comes from. Fewer walkers or steps than the paper used are allowed and
recorded there: the medians printed at the end are compared with the paper's table before the result is used.

The run is single-threaded linear algebra over a capped pool, so it does not take the whole machine.
"""
import json
import os
import sys

for variable in ('OMP_NUM_THREADS', 'OPENBLAS_NUM_THREADS', 'MKL_NUM_THREADS', 'VECLIB_MAXIMUM_THREADS', 'NUMEXPR_NUM_THREADS'):
    os.environ[variable] = '1'

import numpy as np
from orbitize import kepler, read_input, sampler, system


def astrometry(fit: dict, data: str):
    """The paper's measurements as orbitize! reads them, with the two corrections a paper may apply before fitting: an
    astrometric jitter added in quadrature to separation and position-angle errors (Bowler et al. 2020, section 4), and the
    shift from positions measured against the brighter star of a pair to positions against the pair's centre of mass, from the
    pair's own orbit and mass fraction (Inglis et al. 2026, section 3.2)."""
    table = read_input.read_file(data)
    jitter = fit.get('astrometricJitter')
    if jitter:
        rows = table['quant_type'] == 'seppa'
        table['quant1_err'][rows] = np.hypot(table['quant1_err'][rows], jitter['separationMas'])
        table['quant2_err'][rows] = np.hypot(table['quant2_err'][rows], jitter['positionAngleDegrees'])
    centre = fit.get('centreOfMass')
    if centre:
        pair, fraction = centre['pairOrbit'], centre['secondaryMassFraction']
        def secondary(epoch):
            # Secondary star relative to the primary at this epoch, from the pair's orbit.
            b_ra, b_dec, _ = kepler.calc_orbit(np.array([epoch]), pair['semiMajorAxisAu'], pair['eccentricity'],
                                               np.radians(pair['inclinationDegrees']), np.radians(pair['argumentOfPeriastronDegrees']),
                                               np.radians(pair['ascendingNodeDegrees']), pair['tau'], pair['parallaxMas'],
                                               pair['totalMassSolar'], tau_ref_epoch=pair['tauReferenceMjd'])
            return float(np.ravel(b_ra)[0]), float(np.ravel(b_dec)[0])
        for row in range(len(table)):
            kind = table['quant_type'][row]
            if kind not in ('seppa', 'radec'): continue
            b_ra, b_dec = secondary(table['epoch'][row])
            if kind == 'radec':
                table['quant1'][row] -= fraction * b_ra
                table['quant2'][row] -= fraction * b_dec
                continue
            sep, pa = table['quant1'][row], np.radians(table['quant2'][row])
            ra, dec = sep * np.sin(pa) - fraction * b_ra, sep * np.cos(pa) - fraction * b_dec
            table['quant1'][row], table['quant2'][row] = np.hypot(ra, dec), np.degrees(np.arctan2(ra, dec)) % 360
    return table


def main(fit_path: str, output: str) -> None:
    with open(fit_path) as handle:
        fit = json.load(handle)
    data = os.path.join(os.path.dirname(fit_path), fit['measurements'])
    mass, plx = fit['totalMassSolar'], fit['parallaxMas']
    table = astrometry(fit, data)
    # orbitize!'s Driver refuses radial velocities unless both masses are fitted. A differential radial velocity (companion minus
    # star, measured in one spectrum) is the relative orbit's own line-of-sight velocity, which a total-mass fit models directly:
    # with no secondary mass the star stays at the origin and body 1's vz is the relative velocity. The System class takes it.
    orbits = system.System(1, table, mass['value'], plx['value'], mass_err=mass['error'], plx_err=plx['error'],
                           tau_ref_epoch=fit['tauReferenceMjd'])
    settings = fit.get('mcmc') or fit['ofti']
    threads = max(1, min(int(settings.get('threads', 4)), (os.cpu_count() or 2) // 2))
    if 'mcmc' in fit:
        mcmc = fit['mcmc']
        np.random.seed(int(mcmc['seed']))
        # A run that has not converged continues from its walkers' last positions (orbitize!'s own restart), not from new priors.
        previous = mcmc.get('continueFrom')
        run = sampler.MCMC(orbits, num_temps=mcmc['temperatures'], num_walkers=mcmc['walkers'], num_threads=threads,
                           prev_result_filename=None if previous is None else os.path.join(os.path.dirname(fit_path), previous))
        run.run_sampler(int(mcmc['walkers'] * mcmc['savedStepsPerWalker']), burn_steps=int(mcmc['burnSteps']), thin=int(mcmc['thin']))
    else:
        ofti = fit['ofti']
        np.random.seed(int(ofti['seed']))
        run = sampler.OFTI(orbits)
        # OFTI otherwise starts one worker per core.
        run.run_sampler(int(ofti['acceptedOrbits']), num_cores=threads)
    results = run.results
    results.save_results(output)
    labels = list(results.labels)
    post, lnlike = np.asarray(results.post), np.asarray(results.lnlike)
    best = post[int(np.argmax(lnlike))]
    angles = {'inc1', 'aop1', 'pan1'}
    show = lambda label, value: float(np.degrees(value)) if label in angles else float(value)
    summary = {
        'samples': int(post.shape[0]),
        'bestLnLike': float(np.max(lnlike)),
        'best': {label: show(label, best[i]) for i, label in enumerate(labels)},
        'median': {label: show(label, float(np.median(post[:, i]))) for i, label in enumerate(labels)},
        'p16': {label: show(label, float(np.percentile(post[:, i], 16))) for i, label in enumerate(labels)},
        'p84': {label: show(label, float(np.percentile(post[:, i], 84))) for i, label in enumerate(labels)},
    }
    print(json.dumps(summary, indent=1))


def refine(fit_path: str, posterior: str, output: str) -> None:
    """The single orbit: starting from many points (below), maximise orbitize!'s own posterior
    (likelihood plus the paper's priors, MCMC._logl) with Nelder-Mead, and keep the best. A short run that has not converged
    still reaches the peak this way; the sampled spread is not claimed."""
    from scipy.optimize import minimize
    from orbitize.results import Results
    with open(fit_path) as handle:
        fit = json.load(handle)
    mass, plx = fit['totalMassSolar'], fit['parallaxMas']
    table = astrometry(fit, os.path.join(os.path.dirname(fit_path), fit['measurements']))
    orbits = system.System(1, table, mass['value'], plx['value'], mass_err=mass['error'], plx_err=plx['error'], tau_ref_epoch=fit['tauReferenceMjd'])
    mc = sampler.MCMC(orbits, num_temps=1, num_walkers=2, num_threads=1)
    run = Results(); run.load_results(posterior)
    post, lnlike = np.asarray(run.post), np.asarray(run.lnlike)
    cost = lambda p: -float(np.ravel(mc._logl(np.asarray(p), include_logp=True))[0]) if 0 <= p[1] < 1 and p[0] > 0 else np.inf
    # Starts: the run's twenty best samples, the paper's published medians when the fit file gives them (angles in degrees), and
    # thirty seeded draws inside the posterior's 1-99 percentile box. The posterior of a short arc is a flat ridge, so one start is not enough.
    rng = np.random.default_rng(int(fit.get('refineSeed', 1)))
    starts = [post[i] for i in np.argsort(lnlike)[-20:]]
    if 'paperMedians' in fit:
        starts.append(np.array([np.radians(fit['paperMedians'][label]) if label in ('inc1', 'aop1', 'pan1') else fit['paperMedians'][label] for label in run.labels]))
    low, high = np.percentile(post, 1, axis=0), np.percentile(post, 99, axis=0)
    starts += [rng.uniform(low, high) for _ in range(30)]
    polish = lambda x0: minimize(cost, x0, method='Nelder-Mead', options={'maxiter': 60000, 'maxfev': 60000, 'xatol': 1e-10, 'fatol': 1e-10})
    best = min((polish(polish(x0).x) for x0 in starts), key=lambda r: r.fun)
    labels = list(run.labels)
    model, _ = orbits.compute_model(best.x)
    angles = {'inc1', 'aop1', 'pan1'}
    result = {'logPosterior': -best.fun, 'logLikelihood': float(np.ravel(mc._logl(best.x))[0]), 'startedFromBestSampleLogLikelihood': float(np.max(lnlike)),
              'orbit': {label: float(np.degrees(v)) if label in angles else float(v) for label, v in zip(labels, best.x)},
              'residuals': [{'epoch': float(row['epoch']), 'kind': str(row['quant_type']), 'measured': [float(row['quant1']), float(row['quant2'])],
                             'error': [float(row['quant1_err']), float(row['quant2_err'])], 'model': [float(v) for v in np.ravel(m)]}
                            for row, m in zip(orbits.data_table, np.asarray(model).reshape(len(orbits.data_table), 2))]}
    with open(output, 'w') as handle:
        json.dump(result, handle, indent=1)
    print(json.dumps({k: v for k, v in result.items() if k != 'residuals'}, indent=1))


if __name__ == '__main__':
    if len(sys.argv) == 5 and sys.argv[1] == '--refine':
        refine(sys.argv[2], sys.argv[3], sys.argv[4])
    elif len(sys.argv) == 3:
        main(sys.argv[1], sys.argv[2])
    else:
        raise SystemExit(__doc__)
