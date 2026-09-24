/** A source-profile bound measured from a POINT-classified cube, not a nominal
 * diffraction limit or a deconvolved PSF. Astropy owns the model and fitting. */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { sha256, sha256File } from '../../../../src/platform/sha256.mts';
import { requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { eurekaToolchain } from '../toolchain.mts';
import { toolchainPython } from '../mast.mts';
import { openSpectralCube } from './spectral-cube.mts';
import type { ProductFacts } from '../../telescopes/request-satisfaction.mts';

export const RESOLUTION_METHOD = 'jwst-point-source-profile@1';
export const RESOLUTION_PYTHON = String.raw`
import json, sys, warnings
import numpy as np
import astropy, scipy
from astropy.io import fits
from astropy.modeling import models, fitting
from astropy.wcs import WCS
from scipy.ndimage import maximum_filter
from stdatamodels.jwst.datamodels import dqflags
warnings.filterwarnings('ignore', category=RuntimeWarning)

def measure(path):
    result = {'status': 'unknown', 'method': 'jwst-point-source-profile@1',
      'software': {'astropy': astropy.__version__, 'scipy': scipy.__version__},
      'assumption': 'Archive POINT classification; observed source width includes intrinsic source extent.',
      'policy': {'windowPixels': 9, 'minimumPeakSnr': 5, 'maximumResidualFraction': .1,
                 'noiseAllowanceSigma': 3, 'fitSigmaMargin': 3, 'samplingMarginPixels': 1}, 'planes': []}
    with fits.open(path) as hdus:
        h = hdus['SCI'].header
        if h.get('SRCTYPE') != 'POINT' or hdus[0].header.get('SRCTYAPT') != 'POINT':
            return dict(result, reason='The archive does not classify this target as POINT.')
        a, error = hdus['SCI'].data, hdus['ERR'].data
        if 'DQ' not in hdus or hdus['DQ'].data.shape != a.shape:
            return dict(result, reason='Missing matching cube quality flags.')
        dq = hdus['DQ'].data
        excluded = dqflags.pixel['DO_NOT_USE'] | dqflags.pixel['SATURATED'] | dqflags.pixel['NON_SCIENCE']
        result['excludedQualityBits'] = int(excluded)
        # A few planes locate the source without allocating a second full cube.
        # Every individual plane is still fitted and must pass below.
        indices = np.linspace(0,len(a)-1,min(9,len(a))).astype(int)
        samples, errors = a[indices], error[indices]
        valid = np.isfinite(samples) & np.isfinite(errors) & (errors > 0) & ((dq[indices] & excluded) == 0)
        mean = np.nanmedian(np.where(valid, samples, np.nan), axis=0)
        yy, xx = np.indices(mean.shape)
        # Anchor to the header target coordinates, not the brightest field star.
        target_ra, target_dec = hdus[0].header.get('TARG_RA'), hdus[0].header.get('TARG_DEC')
        if target_ra is None or target_dec is None:
            return dict(result, reason='Missing target coordinates for profile association.')
        refx, refy = WCS(h).celestial.world_to_pixel_values(target_ra,target_dec)
        if not np.isfinite([refx,refy]).all():
            return dict(result, reason='Target coordinates do not map into the cube.')
        near = (xx-refx)**2 + (yy-refy)**2 <= 25
        if not np.any(np.isfinite(mean) & near):
            return dict(result, reason='No finite source near the target reference position.')
        y, x = np.unravel_index(np.nanargmax(np.where(near, mean, np.nan)), mean.shape)
        background = np.nanmedian(mean[near])
        peaks = (mean == maximum_filter(np.nan_to_num(mean,nan=-np.inf),size=3)) & near & (mean > background+.5*(mean[y,x]-background))
        if peaks.sum() != 1:
            return dict(result, reason='Ambiguous source peaks near the target coordinates.')
        result['sourcePixelZeroBased'] = [int(x), int(y)]
        result['targetPixelZeroBased'] = [float(refx),float(refy)]
        if min(x, y) < 4 or x+4 >= mean.shape[1] or y+4 >= mean.shape[0]:
            return dict(result, reason='The source profile is clipped by the cube boundary.')
        for k in range(len(a)):
            row = {'plane': k, 'wavelengthMicrometres': float(h['CRVAL3'] + (k+1-h['CRPIX3'])*h['CDELT3'])}
            cut, err = a[k,y-4:y+5,x-4:x+5], error[k,y-4:y+5,x-4:x+5]
            good = np.isfinite(cut) & np.isfinite(err) & (err > 0) & ((dq[k,y-4:y+5,x-4:x+5] & excluded) == 0)
            if good.sum() < 73 or not good[3:6,3:6].all():
                result['planes'].append(dict(row, reason='Missing or unweighted profile samples.')); continue
            Y, X = np.indices(cut.shape)
            background = float(np.median(cut[good])); amplitude = float(np.max(cut[good])-background)
            noise = float(np.median(err[good]))
            if amplitude < 5*noise:
                result['planes'].append(dict(row, reason='Peak SNR below five.')); continue
            model = models.Gaussian2D(amplitude,4,4,1,1,
                bounds={'amplitude':(0,None),'x_mean':(2,6),'y_mean':(2,6),
                        'x_stddev':(.3,2),'y_stddev':(.3,2)}) + models.Const2D(background)
            fitter = fitting.TRFLSQFitter(calc_uncertainties=True)
            try:
                fitted = fitter(model,X[good],Y[good],cut[good],weights=1/err[good],maxiter=200)
            except (ValueError, np.linalg.LinAlgError):
                result['planes'].append(dict(row, reason='Profile fit failed.')); continue
            covariance = fitter.fit_info['param_cov']
            residual = cut[good]-fitted(X[good],Y[good])
            rms = float(np.sqrt(np.mean(residual**2)))
            widths = np.array([fitted.x_stddev_0.value,fitted.y_stddev_0.value])
            centre = np.array([fitted.x_mean_0.value,fitted.y_mean_0.value])
            if (fitter.fit_info['status'] <= 0 or covariance is None or fitted.amplitude_0.value < 5*noise or
                np.any(widths <= .31) or np.any(widths >= 1.99) or np.any(abs(centre-4) >= 1.9) or
                rms > np.hypot(.1*fitted.amplitude_0.value,3*noise)):
                result['planes'].append(dict(row, reason='Unconstrained, clipped or unsuitable Gaussian profile.')); continue
            # Inflate formal fit errors when residual scatter exceeds supplied ERR.
            chi2 = float(np.sum((residual/err[good])**2)/(good.sum()-8))
            sigmas = np.sqrt(np.diag(covariance)[[3,4]]*max(1,chi2))
            if not np.all(np.isfinite(sigmas)) or np.any(sigmas > widths/2):
                result['planes'].append(dict(row, reason='Width uncertainty is unconstrained.')); continue
            fwhm = widths * np.sqrt(8*np.log(2))
            margin = sigmas * np.sqrt(8*np.log(2)) * 3
            result['planes'].append(dict(row, majorPixels=float(max(fwhm)), minorPixels=float(min(fwhm)),
                boundPixels=float(max(2,max(fwhm+margin)+1)), rmsOverPeak=rms/fitted.amplitude_0.value,
                peakSnr=fitted.amplitude_0.value/noise, background=float(fitted.amplitude_1.value),
                axisFwhmPixels=fwhm.tolist(), axisFitSigmaPixels=(sigmas*np.sqrt(8*np.log(2))).tolist(),
                thetaRadians=float(fitted.theta_0.value), centrePixelZeroBased=[float(x-4+centre[0]),float(y-4+centre[1])]))
        if not result['planes'] or any('boundPixels' not in p for p in result['planes']):
            return dict(result, reason='Every wavelength plane must have an accepted profile fit.')
        return dict(result, status='bounded', boundPixels=max(p['boundPixels'] for p in result['planes']))

print(json.dumps(measure(sys.argv[1]), allow_nan=False))
`;

export async function measureCubeResolution(file: string): Promise<{ receipt: string; bound?: ProductFacts['angularResolutionBound'] }> {
  const cube = await openSpectralCube(file), before = await sha256File(file);
  const result = await toolchainPython(await eurekaToolchain(requireString(cube.primary.CRDS_CTX, 'CRDS context')), dirname(file),
    RESOLUTION_PYTHON, [file], `${file}.resolution.log`, { maxRssBytes: 2 * 2 ** 30, progressLabel: 'JWST source profile' });
  const measured = requireRecord(JSON.parse(result.lastLine), 'resolution measurement');
  if (measured.status === 'unknown') console.error(`JWST source profile: ${requireString(measured.reason)}`);
  const after = await sha256File(file);
  if (before.sha256 !== after.sha256) throw new Error('Cube changed during resolution measurement.');
  if (measured.method !== RESOLUTION_METHOD || !['bounded', 'unknown'].includes(String(measured.status))) throw new Error('Invalid resolution result.');
  const arcsec = measured.status === 'bounded' ? requireFiniteNumber(measured.boundPixels, 'profile bound') * cube.arcsecPerPixel : undefined;
  if (arcsec !== undefined && !(arcsec > 0)) throw new Error('Invalid resolution bound.');
  const text = `${JSON.stringify({ schema: 'cssearth-cube-resolution@1', product: before,
    implementation: sha256(await readFile(new URL('./resolution.mts', import.meta.url))),
    softwarePins: await sha256File(resolve(import.meta.dirname, '../requirements.lock')),
    arcsecPerPixel: cube.arcsecPerPixel, upperBoundArcsec: arcsec, ...measured }, null, 2)}\n`;
  const receipt = `${file}.${sha256(text)}.resolution.json`;
  await writeFile(receipt, text);
  return { receipt, ...(arcsec === undefined ? {} : { bound: { arcsec, method: RESOLUTION_METHOD, receipt } }) };
}
