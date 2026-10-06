"""The calls into the published codes that photometry.mts and methods.mts make (toolchain.json pins them). Nothing is
computed here.

  tools.py light-curve <job.json>          a star's light from its pixels in one TESS sector (lightkurve), with the
                                           sky's own variation regressed out, and the period of what is left
                                           (astropy's Lomb-Scargle)

  tools.py mission-light-curve <job.json>  a K2 campaign's light curve as the mission publishes it: the PDC-MAP flux
                                           of its long-cadence file, read by lightkurve

  tools.py rotation <job.json>             the periods of a K2 light curve by the three methods of Reinhold & Hekker
                                           (2020, A&A 635, A43): generalized Lomb-Scargle (astropy), wavelet and
                                           autocorrelation (star-privateer, Breton et al. 2024), after the paper's own
                                           preparation of the light curve

  tools.py map <job.json>                  the brightness map that reproduces a rotational light curve (starry); run
                                           with the starry toolchain's interpreter

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


def mission_light_curve(job):
    """The light curve a mission's pipeline publishes for a star, as it is: lightkurve reads the long-cadence file's
    PDC-MAP flux with its default quality mask, and the campaign from the file's header."""
    warnings.filterwarnings('ignore')
    import numpy as np
    import lightkurve as lk

    curve = lk.read(job['file'], flux_column='pdcsap_flux').remove_nans()
    flux = np.asarray(curve.flux.value, dtype=float)
    return {'frames': int(len(flux)), 'window': int(curve.campaign), 'pipeline': str(curve.meta.get('PROCVER', '')),
            'time': [round(float(value), 5) for value in np.asarray(curve.time.value, dtype=float)], 'flux': [round(float(value), 6) for value in flux / np.mean(flux)]}


def rotation(job):
    """Reinhold & Hekker (2020), Sects. 2 and 3: the light curve is divided by a third-order polynomial, points more than
    six median absolute deviations from the median are dropped, and it is binned to three hours; then the highest peak of
    the generalized Lomb-Scargle periodogram between the time span and the Nyquist frequency, the highest peak of the
    wavelet power spectrum summed over time, and the autocorrelation's period. The variability range is the 95th less the
    5th percentile of the light. Deciding what these numbers allow is photometry.mts's."""
    warnings.filterwarnings('ignore')
    import numpy as np
    import star_privateer as sp
    from astropy.timeseries import LombScargle

    time, flux, width = np.asarray(job['time'], dtype=float), np.asarray(job['flux'], dtype=float), job['binDays']
    flux = flux / np.polynomial.Polynomial.fit(time, flux, job['trendDegree'])(time)
    middle = np.median(flux)
    kept = np.abs(flux - middle) <= job['outlierDeviations'] * np.median(np.abs(flux - middle))
    time, flux = time[kept], flux[kept]
    # Three-hour bins on a regular grid from the first image: the autocorrelation and the wavelet need even sampling.
    count = int(np.floor((time[-1] - time[0]) / width)) + 1
    index = np.floor((time - time[0]) / width).astype(int)
    filled = np.bincount(index, minlength=count) > 0
    binned = np.bincount(index, flux, count)[filled] / np.bincount(index, minlength=count)[filled]
    grid = (time[0] + width * (np.arange(count) + 0.5))[filled]
    light = binned / np.mean(binned)
    span = float(grid[-1] - grid[0])
    frequency = np.linspace(1 / span, 1 / (2 * width), job['frequencies'])
    periodogram = LombScargle(grid, light - 1, fit_mean=True, center_data=True, normalization='standard')
    power = periodogram.power(frequency)
    best = int(np.argmax(power))
    # star-privateer reads a regular series in parts per million, zero where no image was kept (its own K2 example).
    series = np.zeros(count)
    series[filled] = (light - 1) * 1e6
    periods, _, summed, _, _ = sp.compute_wps(series, width * 86400, normalise=True)
    lags, correlation = sp.compute_acf(series, width, normalise=True)
    return {'starPrivateer': sp.__version__, 'spanDays': span, 'variabilityRange': float(np.percentile(light, 95) - np.percentile(light, 5)),
            'peakHeight': float(power[best]), 'lombScargleDays': float(1 / frequency[best]),
            'waveletDays': float(periods[int(np.argmax(summed))]), 'autocorrelationDays': float(sp.find_period_acf(lags, correlation)[0]),
            'time': [round(float(value), 5) for value in grid], 'flux': [round(float(value), 6) for value in light]}


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
    elif len(sys.argv) == 3 and sys.argv[1] == 'mission-light-curve':
        with open(sys.argv[2]) as handle:
            result = mission_light_curve(json.load(handle))
    elif len(sys.argv) == 3 and sys.argv[1] == 'rotation':
        with open(sys.argv[2]) as handle:
            result = rotation(json.load(handle))
    elif len(sys.argv) == 3 and sys.argv[1] == 'map':
        with open(sys.argv[2]) as handle:
            result = brightness_map(json.load(handle))
    else:
        raise SystemExit(__doc__)
    json.dump(result, sys.stdout)
