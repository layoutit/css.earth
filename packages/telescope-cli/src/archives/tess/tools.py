"""The calls into the published codes that photometry.mts makes (toolchain.json pins them). Nothing is computed here.

  tools.py light-curve <job.json>      a star's light from its pixels in one sector (lightkurve), with the sky's own
                                       variation regressed out, and the period of what is left (astropy's Lomb-Scargle)

  tools.py map <job.json>              the brightness map that reproduces a rotational light curve (starry); run with
                                       the starry toolchain's interpreter

It prints one JSON document.
"""
import json
import sys
import warnings


def light_curve(job):
    warnings.filterwarnings('ignore')
    import numpy as np
    import lightkurve as lk
    from astropy.timeseries import LombScargle

    tpf = lk.TessTargetPixelFile(job['cutout'])
    tpf = tpf[tpf.quality == 0]
    mask = tpf.create_threshold_mask(threshold=job['threshold'], reference_pixel='center')
    if mask.sum() == 0:
        return {'frames': int(len(tpf.time)), 'aperturePixels': 0}
    raw = tpf.to_lightcurve(aperture_mask=mask)
    sky = lk.DesignMatrix(tpf.flux[:, ~mask].value, name='sky').pca(job['skyTerms']).append_constant()
    curve = lk.RegressionCorrector(raw).correct(sky).remove_nans().normalize()
    binned = curve.bin(time_bin_size=job['binDays']).remove_nans()
    time, flux = np.asarray(binned.time.value, dtype=float), np.asarray(binned.flux.value, dtype=float)

    def peak(t, f, longest):
        frequency = np.linspace(1 / longest, 1 / job['shortestDays'], job['frequencies'])
        periodogram = LombScargle(t, f - np.mean(f))
        power = periodogram.power(frequency)
        best = int(np.argmax(power))
        model = periodogram.model(t, frequency[best])
        return {'periodDays': float(1 / frequency[best]), 'power': float(power[best]), 'amplitude': float(model.max() - model.min())}

    # The two orbits of a sector, apart: the gap between them is the longest in the times.
    gap = int(np.argmax(np.diff(time)))
    halves = [(time[:gap + 1], flux[:gap + 1]), (time[gap + 1:], flux[gap + 1:])]
    span = float(time.max() - time.min())
    return {'frames': int(len(curve.time)), 'aperturePixels': int(mask.sum()), 'saturated': bool(np.nanmax(tpf.flux.value) > job['saturationElectronsPerSecond']),
            'spanDays': span, 'scatter': float(np.std(flux)), 'whole': peak(time, flux, span / 2),
            'halves': [peak(t, f, float(t.max() - t.min())) if len(t) > 10 else None for t, f in halves],
            'time': [round(float(value), 5) for value in time], 'flux': [round(float(value), 6) for value in flux]}


def brightness_map(job):
    """starry's own inversion of a rotational light curve (Luger et al. 2019): the spherical-harmonic map, seen at the
    star's tilt and turning with its period, that reproduces the light curve, with starry's Gaussian prior on the map."""
    import numpy as np
    import starry
    starry.config.lazy = False
    starry.config.quiet = True
    time, flux, period = np.array(job['time']), np.array(job['flux']), job['periodDays']
    theta = 360.0 * (time - time[0]) / period
    star = starry.Map(ydeg=job['degree'], inc=job['inclinationDegrees'])
    noise = float(np.std(np.diff(flux)) / np.sqrt(2))
    star.set_data(flux, C=noise ** 2)
    mean = np.zeros(star.Ny)
    mean[0] = 1.0
    width = np.full(star.Ny, job['priorWidth'])
    width[0] = job['priorWidth'] * 10
    star.set_prior(mu=mean, L=width)
    solution, _ = star.solve(theta=theta)
    star.amp = solution[0]
    star[1:, :] = solution[1:] / solution[0]
    model = star.flux(theta=theta)
    longitudes, latitudes = np.array(job['longitudesDegrees']), np.array(job['latitudesDegrees'])
    lon, lat = np.meshgrid(longitudes, latitudes)
    values = np.array(star.intensity(lat=lat.ravel(), lon=lon.ravel())).reshape(lat.shape)
    values = values / np.mean(values)
    return {'starry': starry.__version__, 'noise': noise, 'residual': float(np.std(flux - model)), 'values': [[round(float(value), 5) for value in row] for row in values]}


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == 'light-curve':
        with open(sys.argv[2]) as handle:
            result = light_curve(json.load(handle))
    elif len(sys.argv) == 3 and sys.argv[1] == 'map':
        with open(sys.argv[2]) as handle:
            result = brightness_map(json.load(handle))
    else:
        raise SystemExit(__doc__)
    json.dump(result, sys.stdout)
