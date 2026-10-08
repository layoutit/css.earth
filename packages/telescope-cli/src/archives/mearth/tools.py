"""The call into sfit, the MEarth Project's own fitting code, that light-curves.mts makes (toolchain.json pins it).
Nothing is computed here but the model's own terms taken off the data, as the code's demonstration script does.

  tools.py model <job.json>   the sinusoid model of Newton et al. (2016, ApJ 821, 93, Sect. III.1) fitted to a star's
                              light curves at one period: for each light curve a baseline magnitude for every segment,
                              a scale of the common mode, and a sine and a cosine, by linear least squares (sfit.single)

It prints one JSON document.
"""
import json
import sys


def model(job):
    """Each light curve with its fitted baselines and common mode taken off: "the data with the common mode and varying
    baseline magnitudes removed" that the paper's authors inspect (Sect. III.1). The buffers are built as sfit's own
    test.py builds them for a MEarth release file; the common mode is the one external parameter, as in the paper."""
    import numpy
    import sfit
    from importlib.metadata import version

    buffers = []
    for curve in job['curves']:
        segments = sorted(set(curve['segment']))
        place = {segment: index for index, segment in enumerate(segments)}
        external = numpy.empty([1, len(curve['time'])], numpy.double)
        external[0] = curve['commonMode']
        buffers.append((numpy.array(curve['time'], numpy.double), numpy.array(curve['magnitude'], numpy.double), 1.0 / numpy.array(curve['error'], numpy.double) ** 2,
                        external, [place[segment] for segment in curve['segment']], None))
    chi_null = sfit.null(buffers)[0]
    chi_fit, fitted, _ = sfit.single(buffers, 1.0 / job['periodDays'])
    curves = []
    for (time, magnitude, weight, external, places, _), terms in zip(buffers, fitted):
        count = max(places) + 1
        baselines, scale, sine, cosine = terms[0:count], terms[count], terms[count + 1], terms[count + 2]
        corrected = magnitude - (baselines[places] + scale * external[0])
        curves.append({'baselines': [float(value) for value in baselines], 'commonModeScale': float(scale), 'sine': float(sine), 'cosine': float(cosine),
                       'corrected': [round(float(value), 6) for value in corrected]})
    return {'sfit': version('sfit'), 'chiSquaredNull': float(chi_null), 'chiSquared': float(chi_fit), 'curves': curves}


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == 'model':
        with open(sys.argv[2]) as handle:
            result = model(json.load(handle))
    else:
        raise SystemExit(__doc__)
    json.dump(result, sys.stdout)
