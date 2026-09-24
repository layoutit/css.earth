/** batman owns transit light curves and SciPy owns their nonlinear fit. cssEarth owns the time scale, fixed orbit, masks,
 * parameter policy and interpretation of the result. This synchronous boundary keeps existing preparation consumers synchronous. */
import { spawnSync } from 'node:child_process';
import { requireArray, requireFiniteNumber, requireRecord, requireString } from '@cssearth/core';
import { astroqueryToolchainSync } from './toolchain.mts';

const TRANSIT_PYTHON = String.raw`
import importlib.metadata
import json
import sys
import batman
import numpy as np
import scipy
from scipy.optimize import least_squares

r=json.load(sys.stdin)
t=np.asarray(r['timeDaysFromPrediction'],dtype=float)
flux=np.asarray(r['flux'],dtype=float)
error=np.asarray(r['error'],dtype=float)
if t.ndim!=1 or len(t)<100 or flux.shape!=t.shape or error.shape!=t.shape: raise ValueError('Transit arrays must be equal one-dimensional arrays with at least 100 samples')
if not np.all(np.isfinite(t)) or not np.all(np.isfinite(flux)) or not np.all(np.isfinite(error)&(error>0)): raise ValueError('Transit arrays must contain finite values and positive errors')

params=batman.TransitParams()
params.t0=0.
params.per=r['periodDays']
params.rp=r['startRadiusRatio']
params.a=r['semiMajorAxisStellarRadii']
params.inc=r['inclinationDegrees']
params.ecc=r['eccentricity']
params.w=r['argumentOfPeriapsisDegrees']
params.limb_dark='quadratic'
params.u=[.1,.1]
exposure=r.get('exposureSeconds')
kwargs={} if exposure is None else {'supersample_factor':7,'exp_time':exposure/86400.}
transit=batman.TransitModel(params,t,**kwargs)
x=t/r['windowDays']

def limb(q1,q2):
    root=np.sqrt(q1)
    return 2*root*q2,root*(1-2*q2)

def model(values,fixed_shift=None):
    shift,radius,q1,q2,c0,c1,c2=values if fixed_shift is None else [fixed_shift,*values]
    params.t0=shift/86400.
    params.rp=radius
    params.u=list(limb(q1,q2))
    return transit.light_curve(params)*(c0+c1*x+c2*x*x)

def initial(fixed_shift=None):
    shift=0. if fixed_shift is None else fixed_shift
    params.t0=shift/86400.
    base=transit.light_curve(params)
    design=np.column_stack((base,base*x,base*x*x))/error[:,None]
    c=np.linalg.lstsq(design,flux/error,rcond=None)[0]
    full=[0.,r['startRadiusRatio'],.04,.25,*c.tolist()]
    return full if fixed_shift is None else full[1:]

fixed=r.get('fixedShiftSeconds')
low=[-r['rangeSeconds'],.001,1e-8,0.,.5,-1.,-1.]
high=[r['rangeSeconds'],.5,1.,1.,1.5,1.,1.]
if fixed is not None: low=low[1:];high=high[1:]
fit=least_squares(lambda values:(model(values,fixed)-flux)/error,initial(fixed),bounds=(low,high),x_scale='jac',
                  ftol=1e-10,xtol=1e-10,gtol=1e-10,max_nfev=1000)
if not fit.success: raise RuntimeError('SciPy transit fit did not converge: '+fit.message)
values=fit.x.tolist() if fixed is None else [fixed,*fit.x.tolist()]
shift,radius,q1,q2,c0,c1,c2=values
u1,u2=limb(q1,q2)
predicted=model(fit.x,fixed)
standardized=(predicted-flux)/error
chi=float(standardized@standardized)
dof=len(t)-len(fit.x)
if dof<=0: raise ValueError('Transit fit has no residual degrees of freedom')
reduced=chi/dof
uncertainty=None
condition=float(np.linalg.cond(fit.jac.T@fit.jac))
if fixed is None:
    if np.linalg.matrix_rank(fit.jac)<len(fit.x): raise RuntimeError('Transit fit covariance is rank deficient')
    covariance=np.linalg.inv(fit.jac.T@fit.jac)*reduced
    uncertainty=float(np.sqrt(covariance[0,0]))
answer={'schema':'cssearth-transit-fit@1','shiftSeconds':shift,'shiftStandardErrorSeconds':uncertainty,
 'radiusRatio':radius,'limbDarkening':[float(u1),float(u2)],'baseline':[c0,c1,c2],
 'chiSquared':chi,'reducedChiSquared':reduced,'degreesOfFreedom':dof,'samples':len(t),
 'modelFlux':predicted.tolist(),'residualFlux':(flux-predicted).tolist(),
 'fit':{'converged':True,'evaluations':int(fit.nfev),'termination':str(fit.message),'activeBounds':fit.active_mask.tolist(),
        'covarianceCondition':condition,'uncertainty':'Local Jacobian covariance scaled by reduced chi-squared; fixed orbit and baseline model.'},
 'model':{'timeScale':'BMJD_TDB','epoch':'inferior-conjunction','limbDarkeningLaw':'quadratic','parameterization':'Kipping q1/q2',
          'exposureSeconds':exposure,'supersampleFactor':7 if exposure is not None else 1},
 'software':{'batman-package':importlib.metadata.version('batman-package'),'scipy':scipy.__version__,'numpy':np.__version__}}
json.dump(answer,sys.stdout,allow_nan=False,separators=(',',':'))
`;

export interface TransitFitRequest {
  readonly timeDaysFromPrediction: readonly number[];
  readonly flux: readonly number[];
  readonly error: readonly number[];
  readonly periodDays: number;
  readonly semiMajorAxisStellarRadii: number;
  readonly inclinationDegrees: number;
  readonly eccentricity: number;
  readonly argumentOfPeriapsisDegrees: number;
  readonly startRadiusRatio: number;
  readonly windowDays: number;
  readonly rangeSeconds: number;
  readonly exposureSeconds?: number;
  readonly fixedShiftSeconds?: number;
}

export interface TransitFitResult {
  readonly schema: 'cssearth-transit-fit@1'; readonly shiftSeconds: number; readonly shiftStandardErrorSeconds: number | null;
  readonly radiusRatio: number; readonly limbDarkening: readonly [number, number]; readonly baseline: readonly [number, number, number];
  readonly chiSquared: number; readonly reducedChiSquared: number; readonly degreesOfFreedom: number; readonly samples: number;
  readonly modelFlux: readonly number[]; readonly residualFlux: readonly number[];
  readonly fit: { readonly converged: true; readonly evaluations: number; readonly termination: string; readonly activeBounds: readonly number[];
    readonly covarianceCondition: number; readonly uncertainty: string };
  readonly model: { readonly timeScale: 'BMJD_TDB'; readonly epoch: 'inferior-conjunction'; readonly limbDarkeningLaw: 'quadratic';
    readonly parameterization: 'Kipping q1/q2'; readonly exposureSeconds: number | null; readonly supersampleFactor: number };
  readonly software: { readonly 'batman-package': string; readonly scipy: string; readonly numpy: string };
}

function finiteArray(value: unknown, name: string) { return requireArray(value, name).map((entry, index) => requireFiniteNumber(entry, `${name}.${index}`)); }
function tuple2(value: unknown, name: string) { const a = finiteArray(value, name); if (a.length !== 2) throw new TypeError(`${name} must have two values.`); return a as [number, number]; }
function tuple3(value: unknown, name: string) { const a = finiteArray(value, name); if (a.length !== 3) throw new TypeError(`${name} must have three values.`); return a as [number, number, number]; }

export function fitTransit(request: TransitFitRequest): TransitFitResult {
  const entries = Object.entries(request).filter(([, value]) => typeof value === 'number') as [string, number][];
  if (entries.some(([, value]) => !Number.isFinite(value))) throw new TypeError('Transit fit scalar inputs must be finite.');
  if (request.timeDaysFromPrediction.length !== request.flux.length || request.flux.length !== request.error.length) throw new TypeError('Transit arrays must have equal lengths.');
  if (request.timeDaysFromPrediction.length < 100 || request.timeDaysFromPrediction.some(value => !Number.isFinite(value)) || request.flux.some(value => !Number.isFinite(value)) ||
    request.error.some(value => !(Number.isFinite(value) && value > 0))) throw new RangeError('A transit fit needs at least 100 finite samples with positive errors.');
  if (!(request.periodDays > 0 && request.semiMajorAxisStellarRadii > 1 && request.inclinationDegrees > 0 && request.inclinationDegrees <= 90 &&
    request.eccentricity >= 0 && request.eccentricity < 1 && request.startRadiusRatio > 0 && request.startRadiusRatio < .5 && request.windowDays > 0 && request.rangeSeconds > 0))
    throw new RangeError('Transit orbit, radius, window and search range must be physical and positive.');
  if (request.exposureSeconds !== undefined && !(request.exposureSeconds > 0)) throw new RangeError('Transit exposure must be positive.');
  if (request.fixedShiftSeconds !== undefined && Math.abs(request.fixedShiftSeconds) > request.rangeSeconds) throw new RangeError('A profiled transit shift must be inside the search range.');
  const toolchain = astroqueryToolchainSync();
  const child = spawnSync(toolchain.python, ['-c', TRANSIT_PYTHON], { env: { ...process.env, ...toolchain.env }, input: JSON.stringify(request), encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (child.status !== 0) throw new Error(`Transit fit failed (status ${child.status}): ${(child.stderr ?? '').slice(-4000)}`);
  let value: unknown;
  try { value = JSON.parse(child.stdout); } catch (error) { throw new TypeError(`Transit fit returned invalid JSON: ${String(error)}`); }
  const raw = requireRecord(value, 'transit fit'), fit = requireRecord(raw.fit, 'transit fit status'), model = requireRecord(raw.model, 'transit model'), software = requireRecord(raw.software, 'transit software');
  if (raw.schema !== 'cssearth-transit-fit@1' || fit.converged !== true || model.timeScale !== 'BMJD_TDB' || model.epoch !== 'inferior-conjunction' ||
    model.limbDarkeningLaw !== 'quadratic' || model.parameterization !== 'Kipping q1/q2') throw new TypeError('Transit fit returned the wrong contract or conventions.');
  const batman = requireString(software['batman-package']), scipy = requireString(software.scipy);
  if (batman !== toolchain.batmanVersion || scipy !== toolchain.scipyVersion) throw new TypeError(`Transit fit used batman ${batman} and SciPy ${scipy}, not the pinned versions.`);
  const modelFlux = finiteArray(raw.modelFlux, 'modelFlux'), residualFlux = finiteArray(raw.residualFlux, 'residualFlux');
  if (modelFlux.length !== request.flux.length || residualFlux.length !== request.flux.length) throw new TypeError('Transit fit output arrays do not match the input samples.');
  const shiftError = raw.shiftStandardErrorSeconds === null ? null : requireFiniteNumber(raw.shiftStandardErrorSeconds, 'shiftStandardErrorSeconds');
  return { schema: 'cssearth-transit-fit@1', shiftSeconds: requireFiniteNumber(raw.shiftSeconds), shiftStandardErrorSeconds: shiftError,
    radiusRatio: requireFiniteNumber(raw.radiusRatio), limbDarkening: tuple2(raw.limbDarkening, 'limbDarkening'), baseline: tuple3(raw.baseline, 'baseline'),
    chiSquared: requireFiniteNumber(raw.chiSquared), reducedChiSquared: requireFiniteNumber(raw.reducedChiSquared), degreesOfFreedom: requireFiniteNumber(raw.degreesOfFreedom),
    samples: requireFiniteNumber(raw.samples), modelFlux, residualFlux, fit: { converged: true, evaluations: requireFiniteNumber(fit.evaluations),
      termination: requireString(fit.termination), activeBounds: finiteArray(fit.activeBounds, 'activeBounds'), covarianceCondition: requireFiniteNumber(fit.covarianceCondition), uncertainty: requireString(fit.uncertainty) },
    model: { timeScale: 'BMJD_TDB', epoch: 'inferior-conjunction', limbDarkeningLaw: 'quadratic', parameterization: 'Kipping q1/q2',
      exposureSeconds: model.exposureSeconds === null ? null : requireFiniteNumber(model.exposureSeconds), supersampleFactor: requireFiniteNumber(model.supersampleFactor) },
    software: { 'batman-package': batman, scipy, numpy: requireString(software.numpy) } };
}
