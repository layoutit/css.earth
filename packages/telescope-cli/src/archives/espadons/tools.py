"""The calls into the published codes that lsd.mts and zdi.mts make (toolchain.json pins them). Nothing is computed here.

  tools.py lsd <job.json>                       the mask cleaned of SpecpolFlow's default regions, mean line profiles (LSDpy)
                                                and their longitudinal fields (SpecpolFlow)
  tools.py map <ZDIpy directory> <coefficients> <step in degrees>
                                                a ZDIpy map's field vectors on a longitude and latitude grid

Each prints one JSON document. ZDIpy's own programs (renormLSD.py, zdipy.py, comp-ana.py) are run by zdi.mts directly.
"""
import contextlib
import io
import json
import re
import sys


def lsd(job):
    # SpecpolFlow imports tkinter for its mask-cleaning window, which is never opened here.
    from unittest.mock import MagicMock
    for name in ('tkinter', 'tkinter.ttk', 'tkinter.filedialog', 'tkinter.messagebox', 'matplotlib.backends.backend_tkagg', 'matplotlib.backends._backend_tk'):
        sys.modules.setdefault(name, MagicMock())
    import matplotlib
    matplotlib.use('Agg')
    import numpy as np
    import LSDpy
    import specpolFlow

    # The mask without the lines in SpecpolFlow's default regions: the Earth's bands and the hydrogen lines.
    regions = specpolFlow.get_telluric_regions_default() + specpolFlow.get_Balmer_regions_default(job['hydrogenKmS'])
    mask = specpolFlow.read_mask(job['mask']).clean(regions).prune()
    mask.save(job['cleanMask'])
    depth = float(np.mean(mask.depth))
    wave = float(np.sum(mask.wl * mask.depth) / np.sum(mask.depth))
    lande = float(np.sum(mask.lande * mask.depth) / np.sum(mask.depth))

    def run(spectrum, out, centre, half):
        log = io.StringIO()
        with contextlib.redirect_stdout(log):
            profile = LSDpy.lsd(observation=spectrum, mask=job['cleanMask'], outName=out, velStart=centre - half, velEnd=centre + half,
                                velPixel=job['velPixel'], normDepth=depth, normLande=lande, normWave=wave, removeContPol=1, trimMask=0,
                                sigmaClipIter=0, sigmaClip=500., interpMode=1, fSaveModelS=0, fLSDPlotImg=0, fSavePlotImg=0)
        return profile, log.getvalue()

    # Where the star's line is: the lowest point of the first spectrum's mean line, looked for around the catalogued
    # velocity when there is one and over the whole range of nearby stars when there is none.
    seed, reach = (job['velocity'], job['searchKmS']) if job.get('velocity') is not None else (0., job['blindSearchKmS'])
    wide, _ = run(job['spectra'][0]['file'], job['searchProfile'], seed, reach + job['halfWidth'])
    centre = float(wide[0][int(np.argmin(wide[1]))])

    number = r'([-+0-9.eE]+)'
    out = []
    for spectrum in job['spectra']:
        _, text = run(spectrum['file'], spectrum['profile'], centre, job['halfWidth'])
        chi = {key: float(value) for key, value in re.findall(r'^(I|V|N1) reduced chi2 ' + number, text, re.M)}
        offsets = [float(value) for value in re.findall(r'continuum pol: ' + number, text)]
        bz = specpolFlow.read_lsd(spectrum['profile']).calc_bz(cog='I', norm='auto', lambda0=wave, geff=lande, plot=False,
                                                               velrange=[centre - job['lineHalfWidth'], centre + job['lineHalfWidth']])
        out.append({'product': spectrum['product'], 'chiSquare': {'intensity': chi.get('I'), 'stokesV': chi.get('V'), 'null': chi.get('N1')},
                    'offset': {'stokesV': offsets[0] if offsets else None, 'null': offsets[1] if len(offsets) > 1 else None},
                    'gauss': float(bz['V bz (G)']), 'error': float(bz['V bz sig (G)']), 'falseAlarm': float(bz['V FAP']),
                    'nullGauss': float(bz['N1 bz (G)']), 'nullFalseAlarm': float(bz['N1 FAP']), 'centreKmS': float(bz['cog'])})
    return {'mask': {'lines': int(len(mask.wl)), 'depth': depth, 'wavelengthNm': wave, 'lande': lande}, 'searchCentreKmS': centre,
            'searchDepth': float(1 - np.min(wide[1]) / np.median(wide[1])), 'spectra': out}


def field_map(zdipy, coefficients, step):
    sys.path.insert(0, zdipy)
    import numpy as np
    import core.magneticGeom as magneticGeom

    read = magneticGeom.magSphHarmoicsFromFile(coefficients, verbose=0)
    longitudes = np.arange(0., 360. + step / 2, step)
    latitudes = np.arange(-90., 90. + step / 2, step)
    lon, lat = np.meshgrid(longitudes, latitudes)
    # The poles themselves are singular in the tangential terms; the map is read a hair inside them.
    colatitude = np.clip(np.radians(90. - lat.ravel()), 1e-6, np.pi - 1e-6)
    geometry = magneticGeom.magSphHarmoics(read.nl)
    geometry.initMagGeom(colatitude, np.radians(lon.ravel()))
    geometry.alpha[:] = read.alpha
    geometry.beta[:] = read.beta
    geometry.gamma[:] = read.gamma
    radial, southward, eastward = geometry.getAllMagVectors()
    return {'longitudes': longitudes.tolist(), 'latitudes': latitudes.tolist(), 'maximumDegree': int(read.nl),
            'radial': radial.tolist(), 'colatitude': southward.tolist(), 'longitude': eastward.tolist()}


if __name__ == '__main__':
    if len(sys.argv) == 3 and sys.argv[1] == 'lsd':
        with open(sys.argv[2]) as handle:
            result = lsd(json.load(handle))
    elif len(sys.argv) == 5 and sys.argv[1] == 'map':
        result = field_map(sys.argv[2], sys.argv[3], float(sys.argv[4]))
    else:
        raise SystemExit(__doc__)
    json.dump(result, sys.stdout)
