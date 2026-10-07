"""The calls into the published codes that methods.mts and map.mts make (toolchain.json pins them). Nothing is
computed here.

  tools.py mission-light-curve <job.json>  a K2 campaign's light curve as the mission publishes it: the PDC-MAP flux
                                           of its long-cadence file, read by lightkurve

  tools.py rotation <job.json>             the periods of a K2 light curve by the three methods of Reinhold & Hekker
                                           (2020, A&A 635, A43): generalized Lomb-Scargle (astropy), wavelet and
                                           autocorrelation (star-privateer, Breton et al. 2024), after the paper's own
                                           preparation of the light curve

  tools.py spinspotter <job.json>          a star's TESS 2-minute light curves through SpinSpotter (Holcomb et al.
                                           2022), as its authors call it: each sector and the stitched light curve

  tools.py input-catalogue <job.json>      what the TESS Input Catalog says of a light curve's target, as the
                                           file's own header carries it and lightkurve reads it

  tools.py maps <job.json>                 the brightness map that reproduces each of a star's rotational light curves
                                           (starry), all in one process; run with the starry toolchain's interpreter

It prints one JSON document.
"""
import json
import sys
import warnings


def mission_light_curve(job):
    """The light curve a mission's pipeline publishes for a star, as it is: lightkurve reads the long-cadence file's
    PDC-MAP flux with its default quality mask, and the campaign from the file's header, with what the header says of
    the light in the aperture (`aperture_light`)."""
    warnings.filterwarnings('ignore')
    import numpy as np
    import lightkurve as lk

    curve = lk.read(job['file'], flux_column='pdcsap_flux').remove_nans()
    flux = np.asarray(curve.flux.value, dtype=float)
    return {'frames': int(len(flux)), 'window': int(curve.campaign), 'pipeline': str(curve.meta.get('PROCVER', '')), **aperture_light(curve),
            'time': [round(float(value), 5) for value in np.asarray(curve.time.value, dtype=float)], 'flux': [round(float(value), 6) for value in flux / np.mean(flux)]}


def aperture_light(curve):
    """What the pipeline's own header says of the light in a light curve's aperture, as lightkurve reads it: CROWDSAP,
    the share of the aperture's light that is the target's ("ratio of target flux to total flux in op. ap."), and
    FLFRCSAP, the share of the target's light the aperture holds (TESS Science Data Products Description Document,
    EXP-TESS-ARC-ICD-TM-0014 Rev F, Table 14). A value the header leaves blank is null. Nothing is worked out."""
    return {'targetShare': curve.meta.get('CROWDSAP'), 'targetHeld': curve.meta.get('FLFRCSAP')}


def input_catalogue(job):
    """The target's temperature, surface gravity and TESS Input Catalog number, and the catalog's version, from the
    primary header of a TESS 2-minute light curve (TEFF, LOGG, TICID, TICVER), as lightkurve reads the file. A value the
    header leaves blank is null. Nothing is worked out."""
    warnings.filterwarnings('ignore')
    import lightkurve as lk

    meta = lk.read(job['file']).meta
    return {'tic': meta.get('TICID'), 'version': meta.get('TICVER'), 'effectiveTemperatureK': meta.get('TEFF'), 'surfaceGravityLogg': meta.get('LOGG')}


def rotation(job):
    """Reinhold & Hekker (2020), Sects. 2 and 3: the light curve is divided by a third-order polynomial, points more than
    six median absolute deviations from the median are dropped, and it is binned to three hours; then the highest peak of
    the generalized Lomb-Scargle periodogram between the time span and the Nyquist frequency, the highest peak of the
    wavelet power spectrum summed over time, and the autocorrelation's period. The variability range is the 95th less the
    5th percentile of the light. Deciding what these numbers allow is methods.mts's."""
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


def spinspotter(job):
    """Holcomb et al. (2022), Sect. II: SpinSpotter on each sector's light curve and, for several sectors, on the
    stitched one, with the package's own cleaning (transits masked when given, bins of the job's size, normalized
    about zero). What is returned of each is what the paper's criteria read: the period, and the height, width and fit
    of the autocorrelation's peaks; and the midpoint and distance of the light's 5th and 95th percentiles (the paper's
    X_var and Y_var). lightkurve reads each file's PDC-MAP flux, and what its header says of the light in the aperture
    (`aperture_light`), which is kept and decides nothing. Deciding is methods.mts's."""
    warnings.filterwarnings('ignore')
    import numpy as np
    import lightkurve as lk
    import SpinSpotter as ss
    from importlib.metadata import version

    size, transit = job['binSeconds'], job.get('transit')

    def measured(fits, result):
        light = np.asarray(fits['flux_even'], dtype=float)
        time = np.asarray(fits['time_even'], dtype=float)
        seen = np.isfinite(light)
        low, high = np.percentile(light[seen], 5), np.percentile(light[seen], 95)
        number = lambda value: float(value) if np.isfinite(value) else None
        return {'periodDays': number(ss.bins_to_days(result['P_avg'], size)), 'height': number(result['A_avg']), 'width': number(result['B_avg']), 'fit': number(result['R_avg']),
                'centre': float((low + high) / 2), 'range': float(high - low),
                # The package counts time in Julian days; the mission's own clock starts at `timeZero`.
                'time': [round(float(value) - job['timeZero'], 5) for value in time[seen]], 'flux': [round(float(value) + 1, 6) for value in light[seen]]}

    curves = [lk.read(path) for path in job['files']]
    sectors = [{'sector': int(curve.meta['SECTOR']), 'pipeline': str(curve.meta.get('PROCVER', '')), 'frames': int(len(curve)), **aperture_light(curve), **measured(*ss.process_LightCurve(curve, bs=size, transit=transit))} for curve in curves]
    stitched = None
    if len(curves) > 1:
        # The authors' own stitching (each sector normalized by its median), with transits taken out of each sector first as their cleaning does.
        clean = [curve[~curve.create_transit_mask(*transit)] if transit else curve for curve in curves]
        whole = measured(*ss.process_LightCurve(ss.prep_LightCurveCollection(lk.LightCurveCollection(clean), bs=size), bs=size, precleaned=True))
        stitched = {key: value for key, value in whole.items() if key not in ('time', 'flux')}
    return {'spinSpotter': version('spinspotter'), 'sectors': sectors, 'stitched': stitched}


def brightness_maps(job):
    """starry's own inversion of a rotational light curve (Luger et al. 2019), once for each light curve of the job: the
    spherical-harmonic map, seen at the star's tilt and turning with its period, that reproduces the light curve, with
    starry's Gaussian prior on the map. One process makes all of a star's maps: starry is imported and compiled once.
    A map's values are its brightness over its mean, as starry gives them: how many decimals a table keeps is map.mts's."""
    import numpy as np
    import starry
    starry.config.lazy = False
    starry.config.quiet = True
    period = job['periodDays']
    longitudes, latitudes = np.array(job['longitudesDegrees']), np.array(job['latitudesDegrees'])
    lon, lat = np.meshgrid(longitudes, latitudes)
    made = []
    for curve in job['curves']:
        time, flux = np.array(curve['time']), np.array(curve['flux'])
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
        values = np.array(star.intensity(lat=lat.ravel(), lon=lon.ravel())).reshape(lat.shape)
        values = values / np.mean(values)
        made.append({'noise': noise, 'residual': float(np.std(flux - model)), 'values': [[float(value) for value in row] for row in values]})
    return {'starry': starry.__version__, 'maps': made}


def brightness_map(job):
    """One light curve's map, as `brightness_maps` makes it."""
    answer = brightness_maps({**job, 'curves': [{'time': job['time'], 'flux': job['flux']}]})
    return {'starry': answer['starry'], **answer['maps'][0]}


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == 'mission-light-curve':
        with open(sys.argv[2]) as handle:
            result = mission_light_curve(json.load(handle))
    elif len(sys.argv) == 3 and sys.argv[1] == 'input-catalogue':
        with open(sys.argv[2]) as handle:
            result = input_catalogue(json.load(handle))
    elif len(sys.argv) == 3 and sys.argv[1] == 'rotation':
        with open(sys.argv[2]) as handle:
            result = rotation(json.load(handle))
    elif len(sys.argv) == 3 and sys.argv[1] == 'spinspotter':
        with open(sys.argv[2]) as handle:
            result = spinspotter(json.load(handle))
    elif len(sys.argv) == 3 and sys.argv[1] == 'map':
        with open(sys.argv[2]) as handle:
            result = brightness_map(json.load(handle))
    elif len(sys.argv) == 3 and sys.argv[1] == 'maps':
        with open(sys.argv[2]) as handle:
            result = brightness_maps(json.load(handle))
    else:
        raise SystemExit(__doc__)
    json.dump(result, sys.stdout)
