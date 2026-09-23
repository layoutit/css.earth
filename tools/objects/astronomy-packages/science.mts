/** Astropy owns FITS units/WCS; css.earth owns association, conservative masks and claims. */
import { spawn } from 'node:child_process';
import { astroqueryToolchain } from './toolchain.mts';
import { requireRecord, requireString } from '../../sources/source-values.mts';
import { CUBE_OUTPUT_PYTHON } from './cube-outputs.mts';
export const SCIENCE_PYTHON = String.raw`
import json, sys, warnings
from contextlib import ExitStack
import numpy as np
import astropy
from astropy import units as u
from astropy.io import fits
from astropy.wcs import WCS, WCSCOMPARE_ANCILLARY
from astropy.coordinates import SkyCoord
from astropy.utils.exceptions import AstropyWarning
warnings.simplefilter('error')
request = json.load(sys.stdin)
${CUBE_OUTPUT_PYTHON}
def unit(text):
    if text is None: return None
    aliases = {'I/F':'1', 'DIMENSIONLESS':'1', 'DN':'adu', 'counts':'count', 'electrons':'electron'}
    try: return u.Unit(aliases.get(text, text), parse_strict='raise')
    except (ValueError, Warning): return None

def merged(ranges):
    out=[]
    for a,b in sorted(ranges):
        if out and a <= out[-1][1] + 1e-12*max(abs(a),abs(b)): out[-1][1]=max(out[-1][1],b)
        else: out.append([a,b])
    return out

def read_science(path):
    # Section reads retain bounded memory, including scaled integer images.
    with warnings.catch_warnings(record=True) as format_warnings:
        warnings.simplefilter('always', AstropyWarning)
        opened = fits.open(path, memmap=False, lazy_load_hdus=False)
    with ExitStack() as stack:
        hdus=stack.enter_context(opened)
        primary=hdus[0].header
        images=[(i,h) for i,h in enumerate(hdus) if isinstance(h,(fits.PrimaryHDU,fits.ImageHDU,fits.CompImageHDU)) and h.header.get('NAXIS',0)>0]
        science=[(i,h) for i,h in images if h.name.upper()=='SCI']
        # ESO science data products declare each array's role (HDUCLAS2) and name their companions (ERRDATA, QUALDATA,
        # SCIDATA); a file that declares roles is read by them, not by extension names.
        declared=any('HDUCLAS2' in h.header for _,h in images)
        if not science and declared: science=[(i,h) for i,h in images if str(h.header.get('HDUCLAS2','')).upper()=='DATA']
        auxnames={'ERR','ERROR','VAR','VARIANCE','IVAR','DQ','MASK','WMAP','WHT','CON','CONTEXT','VAR_POISSON','VAR_RNOISE','VAR_FLAT'}
        if not science: science=[(i,h) for i,h in images if h.name.upper() not in auxnames]
        if not science: raise ValueError('No science image in FITS product')
        external_error=None; coverage=None
        if request.get('companions'):
            if len(science)!=1 or len(science[0][1].shape)!=2: raise ValueError('External FITS companions require one two-dimensional science image')
            def external(role):
                other=stack.enter_context(fits.open(request['companions'][role],memmap=False,lazy_load_hdus=False))
                arrays=[h for h in other if isinstance(h,(fits.PrimaryHDU,fits.ImageHDU,fits.CompImageHDU)) and h.header.get('NAXIS',0)>0]
                if len(arrays)!=1: raise ValueError(role+' FITS companion needs one image array')
                result=arrays[0]; science_hdu=science[0][1]
                if tuple(result.shape)!=tuple(science_hdu.shape): raise ValueError(role+' FITS companion shape differs from science')
                a=WCS(science_hdu.header,fix=False).celestial; b=WCS(result.header,fix=False).celestial
                if not a.has_celestial or not b.has_celestial or not a.wcs.compare(b.wcs,cmp=WCSCOMPARE_ANCILLARY,tolerance=1e-8):
                    raise ValueError(role+' FITS companion WCS differs from science')
                return result
            external_error=external('uncertainty'); coverage=external('coverage')
        seen=set(); structures=[]; refs=[]
        for key,val in primary.items():
            if key.startswith('R_') and isinstance(val,str) and val.startswith('crds://'):
                refs.append({'field':key,'value':val})
        for index,hdu in science:
            h=hdu.header; shape=tuple(hdu.shape); version=h.get('EXTVER',1)
            identity=(hdu.name,version)
            if identity in seen: raise ValueError('Duplicate science EXTNAME/EXTVER')
            seen.add(identity)
            limits=[str(w.message) for w in format_warnings]; name=f'HDU {index} ({hdu.name}, EXTVER={version})'
            row={'structure':name,'fitsHdu':index,'shape':list(shape),'calibration':[], 'limitations':limits}
            rawunit=h.get('BUNIT'); dataunit=unit(rawunit)
            if dataunit is not None: row['units']={'value':rawunit,'source':name+':BUNIT','canonical':str(dataunit)}
            else: limits.append('Missing or unsupported science unit: '+str(rawunit))
            def linked(keyword, role):
                target=h.get(keyword)
                if target is None: return None
                candidates=[x for _,x in images if x.name==str(target)]
                if len(candidates)!=1: raise ValueError(keyword+' of '+name+' names '+str(len(candidates))+' extensions called '+str(target))
                result=candidates[0]
                if str(result.header.get('HDUCLAS2','')).upper()!=role: raise ValueError(keyword+' of '+name+' names '+result.name+', whose HDUCLAS2 is not '+role)
                if result.header.get('SCIDATA') not in (None, hdu.name): raise ValueError(result.name+' links back to '+str(result.header.get('SCIDATA'))+', not '+hdu.name)
                if tuple(result.shape)!=shape: raise ValueError('Companion shape mismatch: '+result.name+' for '+name)
                return result
            def companion(names):
                candidates=[x for _,x in images if x.name.upper() in names and x.header.get('EXTVER',1)==version]
                if len(candidates)>1: raise ValueError('Ambiguous companion '+str(names)+' for '+name)
                if not candidates: return None
                if sum(x.header.get('EXTVER',1)==version for _,x in science)>1: raise ValueError('Ambiguous science association for companion '+name)
                result=candidates[0]
                if tuple(result.shape)!=shape: raise ValueError('Companion shape mismatch: '+result.name+' for '+name)
                return result
            error_kind=None; error_unit_valid=False
            if declared:
                error=linked('ERRDATA','ERROR'); dq=linked('QUALDATA','QUALITY')
                if error is not None:
                    error_kind={'MSE':'variance','RMSE':'standard-deviation','INVMSE':'inverse-variance'}.get(str(error.header.get('HDUCLAS3','')).upper())
                    if error_kind is None:
                        limits.append('Uncertainty kind '+str(error.header.get('HDUCLAS3'))+' of '+error.name+' is not supported; uncertainty ignored.'); error=None
            else:
                error=companion({'ERR','ERROR','VAR','VARIANCE','IVAR'})
                dq=companion({'DQ','MASK'})
            if external_error is not None:
                if error is not None or dq is not None: raise ValueError('External FITS companions conflict with in-file science companions')
                error=external_error; error_kind='standard-deviation'
            if error is not None:
                if error_kind is None: error_kind='variance' if error.name.upper() in ('VAR','VARIANCE') else 'inverse-variance' if error.name.upper()=='IVAR' else 'standard-deviation'
                eu=unit(error.header.get('BUNIT')); wanted=None if dataunit is None else dataunit**(2 if error_kind=='variance' else -2 if error_kind=='inverse-variance' else 1)
                if eu is not None and wanted is not None:
                    if not eu.is_equivalent(wanted): raise ValueError('Uncertainty units disagree with science: '+name)
                    error_unit_valid=True
                else: limits.append('Uncertainty units cannot be established for '+name)
            else: limits.append('No associated uncertainty array.')
            # WCSLIB owns both nonlinear and table-backed transforms, with the HDUList supplying -TAB arrays.
            spec=None; specaxis=None; centers=None; edges=None
            ctypes=[str(h.get('CTYPE'+str(i+1),'')) for i in range(len(shape))]
            if any(t.startswith(('WAVE','FREQ','AWAV','VRAD','VOPT','VELO')) for t in ctypes):
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter('ignore', fits.verify.VerifyWarning)
                        w=WCS(h, fobj=hdus, fix=False)
                    sw=w.wcs.spec
                    if sw<0: raise ValueError('No spectral WCS axis')
                    linked=np.flatnonzero(w.axis_correlation_matrix[sw])
                    if len(linked)!=1: raise NotImplementedError('Spatially coupled spectral WCS needs a coordinate field')
                    pixelaxis=int(linked[0]); specaxis=len(shape)-1-pixelaxis; n=shape[specaxis]
                    if n>1000000: raise ValueError('Spectral coordinate array exceeds budget')
                    def wavelength(pixels):
                        coords=np.tile(np.asarray(w.wcs.crpix)-1,(len(pixels),1)); coords[:,pixelaxis]=pixels
                        values=w.all_pix2world(coords,0)[:,sw]; su=u.Unit(w.world_axis_units[sw]); ct=str(w.wcs.ctype[sw])
                        if ct.startswith('AWAV'): raise NotImplementedError('Air-wavelength conversion requires a stated convention')
                        if su.is_equivalent(u.m/u.s):
                            rest=h.get('RESTFRQ',h.get('RESTFREQ'))
                            restq=rest*u.Hz if rest else h.get('RESTWAV',0)*u.m
                            if restq.value<=0: raise NotImplementedError('Velocity WCS requires a recorded rest wavelength/frequency')
                            eq=u.doppler_radio(restq) if ct.startswith('VRAD') else u.doppler_optical(restq) if ct.startswith('VOPT') else u.doppler_relativistic(restq)
                            return (values*su).to(u.Hz,equivalencies=eq).to_value(u.um,equivalencies=u.spectral())
                        return (values*su).to_value(u.um,equivalencies=u.spectral())
                    centers=wavelength(np.arange(n,dtype=float))
                    if not np.all(np.isfinite(centers)&(centers>0)) or (n>1 and not (np.all(np.diff(centers)>0) or np.all(np.diff(centers)<0))): raise ValueError('Invalid/nonmonotonic wavelength coordinates')
                    # A lookup table defines coordinates at its knots, not an extrapolated optical passband.
                    if '-TAB' not in str(w.wcs.ctype[sw]):
                        edges=wavelength(np.arange(n+1,dtype=float)-.5)
                        if not np.all(np.isfinite(edges)&(edges>0)): raise ValueError('Invalid spectral bin edges')
                    else: limits.append('Tabulated centers qualified; continuous bin edges are not inferred between knots.')
                    row['spectral']={'centersMicrometres':centers.tolist(),'axis':specaxis,'source':name+':Astropy WCSLIB'}
                    if edges is not None: row['spectral']['binEdgesMicrometres']=edges.tolist()
                except (NotImplementedError, u.UnitConversionError) as exc: limits.append(str(exc)); specaxis=None
            extract=request.get('operation')=='extract' and request.get('hdu')==index
            output_values=None; output_sigma=None; aggregate=None; measurement={}
            if extract:
                if len(shape)<2 or any(n!=1 for n in shape[:max(0,len(shape)-3)]): raise ValueError('Output needs two spatial axes and at most one spectral axis')
                if (len(shape)>2 and shape[-3]>1 or specaxis is not None) and specaxis!=len(shape)-3: raise ValueError('Output needs a qualified leading spectral axis')
                kind=request['kind']; w=shape[-1]; height=shape[-2]
                if kind=='image':
                    plane=request.get('plane')
                    if specaxis is not None:
                        if not isinstance(plane,int) or plane<0 or plane>=shape[specaxis]: raise ValueError('Select an explicit zero-based spectral plane')
                    elif plane is not None: raise ValueError('A two-dimensional image has no spectral plane selector')
                    output_values=science_array('values',(height,w),np.nan); output_sigma=science_array('sigma',(height,w),np.nan)
                elif kind=='spectrum':
                    x=request.get('x'); y=request.get('y')
                    if specaxis!=len(shape)-3 or centers is None: raise ValueError('Output needs a qualified wavelength axis')
                    if not isinstance(x,int) or not isinstance(y,int) or not 0<=x<w or not 0<=y<height: raise ValueError('Select an explicit in-bounds zero-based pixel')
                    output_values=np.full(len(centers),np.nan); output_sigma=np.full(len(centers),np.nan)
                elif kind in ('band-image','aperture-spectrum','feature-map'):
                    if specaxis!=len(shape)-3: raise ValueError('Aggregation needs a qualified leading wavelength axis')
                    aggregate=CubeOutput(request,shape,centers,edges,dataunit,error_unit_valid)
                else: raise ValueError('Unknown output kind')
            total=0; finite=0; goodcount=0; baderror=0; flagged=0
            region_check=None; region_wcs=None; region_center=None; region_radius=None; region_usable=0; region_bad=0
            if request.get('region'):
                region_check={'answer':'unknown','reason':'No supported two-dimensional celestial WCS for the requested region.'}
                try:
                    if len(shape)!=2: raise ValueError('Region checks currently require one two-dimensional science image')
                    with warnings.catch_warnings():
                        warnings.simplefilter('ignore', AstropyWarning)
                        region_wcs=WCS(h,hdus).celestial
                    if not region_wcs.has_celestial: raise ValueError('No celestial WCS')
                    r=request['region']; region_center=SkyCoord(r['raDegrees']*u.deg,r['decDegrees']*u.deg,frame='icrs'); region_radius=r['radiusDegrees']*u.deg
                    boundary=region_center.directional_offset_by(np.arange(0,360,0.5)*u.deg,region_radius)
                    bx,by=region_wcs.world_to_pixel(boundary)
                    outside=np.any(~np.isfinite(bx)|~np.isfinite(by)|(bx<-.5)|(bx>shape[1]-.5)|(by<-.5)|(by>shape[0]-.5))
                    region_check={'answer':'partial' if outside else 'unknown','reason':'Requested boundary positions lie outside the returned image.' if outside else 'Boundary samples are in the image; complete continuous-region coverage is not established by samples alone.'}
                except Exception as e:
                    region_wcs=None
                    region_check['reason']=str(e)
            usable=np.zeros(shape[specaxis],dtype=bool) if specaxis is not None else None
            # Bound temporary masks to about one million samples; no whole-cube boolean allocations.
            flatlast=shape[-1]; leading=int(np.prod(shape[:-1])) if len(shape)>1 else 1
            for lead in range(leading):
                prefix=np.unravel_index(lead,shape[:-1]) if len(shape)>1 else ()
                for start in range(0,flatlast,1000000):
                    sl=prefix+(slice(start,min(start+1000000,flatlast)),)
                    a=np.asarray(hdu.section[sl]); good=np.isfinite(a); finite+=int(good.sum()); total+=a.size
                    if dq is not None:
                        q=np.asarray(dq.section[sl])
                        if not np.issubdtype(q.dtype,np.integer): raise ValueError('Quality flags must be integers')
                        flagged+=int(np.count_nonzero(q)); good &= q==0
                    if coverage is not None:
                        c=np.asarray(coverage.section[sl]); covered=np.isfinite(c)&(c>0)
                        flagged+=int(np.count_nonzero(~covered)); good &= covered
                    if error is not None:
                        e=np.asarray(error.section[sl]); bad=np.isfinite(e)&(e<0)&good
                        if bad.any(): raise ValueError('Negative unmasked uncertainty')
                        valid=np.isfinite(e)&(e>0 if error_kind=='inverse-variance' else e>=0)
                        baderror+=int(np.count_nonzero(good&~valid)); good &= valid
                        if not error_unit_valid: good[:]=False
                    if extract:
                        sigma=np.full(a.shape,np.nan)
                        if error_unit_valid:
                            scaled=e*eu.to(wanted)
                            with np.errstate(divide='ignore',invalid='ignore'):
                                sigma=np.sqrt(scaled) if error_kind=='variance' else 1/np.sqrt(scaled) if error_kind=='inverse-variance' else scaled
                        if aggregate is not None:
                            aggregate.add(prefix[specaxis],prefix[-1],start,a,sigma,good)
                        elif kind=='image' and (specaxis is None or prefix[specaxis]==plane):
                            output_values[prefix[-1],start:start+a.size]=np.where(good,a,np.nan)
                            output_sigma[prefix[-1],start:start+a.size]=np.where(good,sigma,np.nan)
                        elif kind=='spectrum' and prefix[-1]==y and start<=x<start+a.size:
                            output_values[prefix[specaxis]]=a[x-start] if good[x-start] else np.nan
                            output_sigma[prefix[specaxis]]=sigma[x-start] if good[x-start] else np.nan
                    goodcount+=int(good.sum())
                    if usable is not None:
                        if specaxis==len(shape)-1: usable[start:start+a.size] |= good
                        elif good.any(): usable[prefix[specaxis]]=True
            row['quality']={'policy':'finite-science; DQ/MASK=0; external coverage > 0 when supplied; finite nonnegative uncertainty when supplied','samples':total,'finite':finite,'usable':goodcount,'flagged':flagged,'invalidUncertainty':baderror,'mask':dq.name if dq is not None else 'external coverage > 0' if coverage is not None else None}
            if request.get('position'):
                point={'status':'unknown','reason':'This science array has no supported two-dimensional celestial WCS.'}
                try:
                    if len(shape)!=2: raise ValueError('A position check requires a two-dimensional science image.')
                    with warnings.catch_warnings():
                        warnings.simplefilter('ignore', AstropyWarning)
                        celestial=WCS(h, fobj=hdus, fix=False).celestial
                    if not celestial.has_celestial: raise ValueError('No celestial WCS in the science image.')
                    position=request['position']
                    coordinate=SkyCoord(position['raDegrees']*u.deg,position['decDegrees']*u.deg,frame='icrs')
                    x,y=celestial.world_to_pixel(coordinate)
                    if not np.isfinite(x) or not np.isfinite(y): raise ValueError('Celestial WCS returned no finite pixel position.')
                    inside=-.5<=x<shape[1]-.5 and -.5<=y<shape[0]-.5
                    point={'status':'in-field' if inside else 'outside-field',
                           'reason':'The requested ICRS position projects inside the science pixel grid.' if inside else 'The requested ICRS position projects outside the science pixel grid.',
                           'pixel':[float(x),float(y)]}
                except Exception as e:
                    point['reason']=str(e)
                row['skyPosition']=point
            if region_check is not None:
                # Reuse the extraction mask policy, row by row, without allocating a whole-image sky grid.
                if region_wcs is not None:
                    for y in range(shape[0]):
                        world=region_wcs.pixel_to_world(np.arange(shape[1]),np.full(shape[1],y))
                        within=world.icrs.separation(region_center)<=region_radius
                        valid=np.isfinite(np.asarray(hdu.section[y,:]))
                        if dq is not None: valid &= np.asarray(dq.section[y,:])==0
                        if coverage is not None:
                            c=np.asarray(coverage.section[y,:]); valid &= np.isfinite(c)&(c>0)
                        if error is not None:
                            e=np.asarray(error.section[y,:]); valid &= np.isfinite(e)&(e>0 if error_kind=='inverse-variance' else e>=0)
                        region_usable+=int((within&valid).sum()); region_bad+=int((within&~valid).sum())
                    if region_bad:
                        region_check={'answer':'partial','reason':'Some pixel centers in the requested circle have invalid science, quality flags or invalid supplied uncertainty.'}
                row['regionCoverage']={**region_check,'region':request['region'],'usablePixelCenters':region_usable,'invalidPixelCenters':region_bad}
            row['uncertainty']={'status':'validated' if error_unit_valid else 'unknown','kind':error_kind,'structure':error.name if error is not None else None}
            if usable is not None:
                row['spectral']['usableBands']=usable.tolist()
                if edges is not None: row['wavelengthIntervalsMicrometres']=merged([[float(min(edges[i],edges[i+1])),float(max(edges[i],edges[i+1]))] for i in range(len(usable)) if usable[i]])
            beam=None; beams=[x for x in hdus if x.name=='BEAMS']
            if beams:
                if len(beams)!=1 or len(science)!=1 or specaxis is None: limits.append('Beam table cannot be assigned uniquely.')
                else:
                    table=beams[0]; cols=set(table.columns.names)
                    if not {'BMAJ','BMIN','CHAN','POL'}.issubset(cols): raise ValueError('Incomplete per-plane beam table')
                    # Only a single Stokes component is admitted here; do not discard polarization-dependent beams.
                    if set(np.asarray(table.data['POL']).tolist())!={0}: limits.append('Multiple polarization beams require explicit selection.')
                    else:
                        majors=(table.data['BMAJ']*u.Unit(table.columns['BMAJ'].unit)).to_value(u.arcsec)
                        minors=(table.data['BMIN']*u.Unit(table.columns['BMIN'].unit)).to_value(u.arcsec)
                        channels=np.asarray(table.data['CHAN']); n=shape[specaxis]
                        if len(channels)!=n or set(channels.tolist())!=set(range(n)) or not np.all(np.isfinite(majors)&np.isfinite(minors)&(majors>=minors)&(minors>0)): raise ValueError('Beam table does not cover every channel with valid axes')
                        if goodcount: beam=float(max(majors[i] for i,c in enumerate(channels) if usable[c]))
                        row['calibration'].append({'field':'BEAMS','value':'Complete channel-indexed restoring beams; maximum usable major-axis FWHM.'})
            elif 'BMAJ' in h or 'BMIN' in h:
                major=h.get('BMAJ'); minor=h.get('BMIN')
                if major is None or minor is None or not np.isfinite(major) or not np.isfinite(minor) or not major>=minor>0: raise ValueError('Invalid restoring beam axes')
                if h.get('CASAMBM',False): limits.append('Per-plane beam flag is set but the BEAMS table is absent.')
                elif goodcount: beam=float(major)*3600
                row['calibration'] += [{'field':name+':'+k,'value':str(h[k])} for k in ('BMAJ','BMIN','BPA') if k in h]
            if beam is not None and dataunit is not None and dataunit.is_equivalent(u.Jy/u.beam): row['angularResolutionArcsec']=beam
            else: limits.append('No applicable measured PSF or restoring beam; pixel sampling is not achieved resolution.')
            if extract:
                if aggregate is not None: output_values,output_sigma,measurement=aggregate.result()
                def nullable(a): return np.where(np.isfinite(a),a,None).tolist()
                if request.get('arrayDirectory'):
                    Path(request['arrayDirectory']).mkdir(parents=True,exist_ok=True)
                    for key,array in [('values',output_values),('sigma',output_sigma)]:
                        if not isinstance(array,np.memmap):np.save(Path(request['arrayDirectory'])/(key+'.npy'),array)
                        else:array.flush()
                    payload={'arrays':{'values':'values.npy','sigma':'sigma.npy'}}
                else:payload={'values':nullable(output_values),'sigma':nullable(output_sigma)}
                row['extraction']={'kind':kind,**payload,'unit':rawunit,
                    'wavelengthsMicrometres':centers.tolist() if centers is not None else None,
                    'plane':request.get('plane'),'x':request.get('x'),'y':request.get('y'),**measurement}
            structures.append(row)
        return {'structures':structures,'references':refs,'primary':{k:v for k,v in primary.items() if k not in ('COMMENT','HISTORY','') and isinstance(v,(str,int,float,bool))},'astropy':astropy.__version__}

if request['operation'] in ('fits','extract'): answer=read_science(request['path'])
elif request['operation']=='units':
    answer={'units':[None if unit(text) is None else str(unit(text)) for text in request['units']], 'astropy':astropy.__version__}
elif request['operation']=='spectral-convert':
    source=unit(request['unit'])
    if source is None: raise ValueError('Unsupported spectral coordinate unit')
    values=np.asarray(request['values'],dtype=float)
    if values.ndim != 1 or not np.all(np.isfinite(values)): raise ValueError('Spectral coordinates must be finite')
    try: converted=(values*source).to_value(u.um,equivalencies=u.spectral())
    except u.UnitConversionError as exc: raise ValueError('Unit is not a supported spectral coordinate: '+str(source)) from exc
    answer={'valuesMicrometres':converted.tolist(),'sourceUnit':str(source),'astropy':astropy.__version__}
else: raise ValueError('Unknown science operation')
json.dump(answer,sys.stdout,allow_nan=False,separators=(',',':'))
`;
export async function sciencePackage(request: { operation: 'fits'; path: string; region?: import('../telescopes/vo/contracts.mts').IcrsCircle; position?: { readonly raDegrees:number;readonly decDegrees:number }; companions?: { readonly uncertainty: string; readonly coverage: string } } | { operation:'extract';path:string;hdu:number;arrayDirectory?:string;kind:'image'|'spectrum'|'band-image'|'aperture-spectrum'|'feature-map';plane?:number;x?:number;y?:number;band?:readonly number[];aperture?:readonly number[];background?:'none'|readonly number[];continuum?:readonly number[];uncertainty?:'omit'|'independent'; companions?: { readonly uncertainty: string; readonly coverage: string } } | { operation: 'units'; units: readonly string[] } | {operation:'spectral-convert';values:readonly number[];unit:string}): Promise<Record<string, unknown>> {
  const tc = await astroqueryToolchain();
  return new Promise((done, fail) => {
    const child = spawn(tc.python, ['-c', SCIENCE_PYTHON], { env: { ...process.env, ...tc.env }, stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '', err = '';
    child.stdout.setEncoding('utf8').on('data', s => { out += s; }); child.stderr.setEncoding('utf8').on('data', s => { err += s; });
    child.on('error', fail); child.on('close', code => { if (code !== 0) return fail(new Error(`Astropy metadata failed: ${err.slice(-2500)}`));
      try { const result = requireRecord(JSON.parse(out)); if (requireString(result.astropy) !== '8.0.1') throw new Error('Unexpected Astropy version'); done(result); } catch (error) { fail(error); } });
    child.stdin.end(JSON.stringify(request));
  });
}
