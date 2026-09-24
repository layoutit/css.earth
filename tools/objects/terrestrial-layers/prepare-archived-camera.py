"""Reproduce preparation-only OSIRIS or L'LORRI cameras from pinned archives.

Requires numpy, scipy, astropy and spiceypy. No ephemerides are fetched here; kernels are not committed, so restore
the body's sources first.
Usage: node tools/assets/restore-source-inputs.mts --object=<id>
       python prepare-archived-camera.py src/objects/<id>/source
"""
from pathlib import Path
import argparse, hashlib, json, re, subprocess, tempfile
import numpy as np
import spiceypy as sp


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def field(text, key):
    m = re.search(r'^\s*' + re.escape(key) + r'\s*=\s*(?:\r?\n\s*)?("[^"\r\n]+"|[^\r\n]+)', text, re.M)
    if not m:
        raise ValueError(key)
    return m.group(1).strip().strip('"')


def vector(text, key):
    m = re.search(re.escape(key) + r'\s*=\s*\(([^)]+)\)', text)
    return np.array([float(n) for n in re.sub(r'<[^>]+>', '', m.group(1)).split(',')])


def osiris(source, profile):
    data = (source / profile['image']).read_bytes()
    label = data[:65536].decode('ascii', errors='replace')
    block = re.search(r'^OBJECT\s*=\s*IMAGE\s*\n(.*?)^END_OBJECT\s*=\s*IMAGE', label, re.S | re.M).group(1)
    width, height = [int(field(block, k)) for k in ['LINE_SAMPLES', 'LINES']]
    first_sample, first_line = [int(field(block, k)) for k in ['FIRST_LINE_SAMPLE', 'FIRST_LINE']]
    start = field(label, 'START_TIME')
    et = sp.str2et(start)
    b2j = sp.pxform(profile['bodyFrame'], 'J2000', et)
    j2fixed = sp.tipbod('J2000', profile['bodyId'], et)
    sc_group = label.split('GROUP                         = SC_COORDINATE_SYSTEM')[1]
    # The SC quaternion's published prose conflicts with its values. Scalar-first
    # reproduces the independent RA/Dec and surface-intercept metadata below.
    sc = sp.q2m(vector(sc_group, 'ORIGIN_ROTATION_QUATERNION'))
    j2cam = sp.pxform('ROS_SPACECRAFT', profile['cameraFrame'], et) @ sc
    target = vector(label, 'SC_TARGET_POSITION_VECTOR')
    eye = -b2j.T @ target
    f = profile['correctedFocalLengthMm'] / profile['pixelPitchMm']
    cx, cy = 1023.5 - (first_sample - 1), 1023.5 - (first_line - 1)
    # BORESIGHT_V01 section 2 documents CCD orientation and the additional 180
    # degree rotation relative to the label's preferred display directions.
    sign = -1 if field(label, 'INSTRUMENT_ID') == 'OSIWAC' else 1
    k = np.array([[0,sign*f,cx],[f,0,cy],[0,0,1]])
    p = k @ np.column_stack([j2cam @ b2j, j2cam @ target])
    slat, slon = np.radians([float(field(label,k).split()[0]) for k in ['SUB_SOLAR_LATITUDE','SUB_SOLAR_LONGITUDE']])
    sun = b2j.T @ j2fixed.T @ np.array([np.cos(slat)*np.cos(slon),np.cos(slat)*np.sin(slon),np.sin(slat)])
    bore = j2cam.T @ np.array([0,0,1])
    radec = [np.degrees(np.arctan2(bore[1],bore[0])) % 360,np.degrees(np.arcsin(bore[2]))]
    anchor = [float(field(label,k).split()[0]) for k in ['RIGHT_ASCENSION','DECLINATION']]
    error = float(np.max(np.abs(np.array(radec)-anchor)))
    if error > .00001:
        raise ValueError('Camera does not reproduce archived boresight')
    checks = dict(boresightRADecDegrees=radec,archiveRADecDegrees=anchor,maximumBoresightResidualDegrees=error,
        quaternionConvention='SC scalar-first verified against independent archive boresight; use released camera FK.')
    if field(label,'ROSETTA:SURFACE_INTERCEPT_DISTANCE') != 'N/A':
        point = b2j.T @ j2fixed.T @ vector(label,'ROSETTA:SURF_INT_CART_COORD')
        h = p @ np.r_[point,1]; xy = h[:2]/h[2]; poi = vector(label,'ROSETTA:IMAGE_POI_PIXEL')
        residual = float(np.max(np.abs(xy-poi)))
        if residual > .02:
            raise ValueError('Camera does not reproduce archived surface intercept')
        checks.update(archivePointKm=point.tolist(),archivePointPixel=poi.tolist(),projectedPixel=xy.tolist(),maximumPointResidualPixels=residual)
    return dict(schema='cssearth-archived-camera@1',target=field(label,'TARGET_NAME'),startTime=start,
        filter=field(label,'FILTER_NAME'),width=width,height=height,firstSample=first_sample,firstLine=first_line,
        matrix=p.tolist(),rayMatrix=np.linalg.inv(p[:,:3]).tolist(),positionKm=eye.tolist(),sunDirection=sun.tolist(),checks=checks)


def llorri_target(header, profile):
    """The camera's body must be one of the frame's field-of-view targets; a frame showing several needs the profile to name it."""
    targets = [str(header[f'TRGFOV{i}']).strip() for i in range(1, int(header['TRGFOVN']) + 1)]
    target = profile.get('target', targets[0] if len(targets) == 1 else None)
    if target not in targets:
        raise ValueError(f"L'LORRI camera target {target} is not among the frame's field-of-view targets {targets}")
    return target


def body_frame_note(target, profile):
    """Name the body frame from the profile's one PCK kernel, which is valid near the encounter only."""
    kernels = [Path(path).stem for path in profile['kernels'] if path.endswith('.tpc')]
    if len(kernels) != 1:
        raise ValueError("Expected one body-frame PCK kernel in the L'LORRI profile")
    version = re.search(r'_(v\d+)$', kernels[0])
    return f"{target.title()} {version.group(1) if version else kernels[0]}; valid near the encounter epoch only"


def llorri(source, profile):
    from astropy.io import fits
    from astropy.wcs import WCS
    h = fits.getheader(source / profile['image']); w = WCS(h); target = llorri_target(h, profile)
    et = sp.str2et(h['MIDUTC']); r = sp.tipbod('J2000', profile['bodyId'], et).T
    eye = np.array([h['SPCTSC'+c] for c in 'XYZ']); sun = r.T @ np.array([h['SPCTSO'+c] for c in 'XYZ']); sun /= np.linalg.norm(sun)
    ra, dec = np.radians([h['CRVAL1'],h['CRVAL2']])
    east=np.array([-np.sin(ra),np.cos(ra),0]); north=np.array([-np.sin(dec)*np.cos(ra),-np.sin(dec)*np.sin(ra),np.cos(dec)])
    bore=np.array([np.cos(dec)*np.cos(ra),np.cos(dec)*np.sin(ra),np.sin(dec)])
    cd=np.array([[h['CD1_1'],h['CD1_2']],[h['CD2_1'],h['CD2_2']]]);ref=np.array([h['CRPIX1'],h['CRPIX2']])-1
    k=np.vstack([np.linalg.inv(cd)@np.stack([east,north])*180/np.pi+ref[:,None]*bore,bore])
    p=k@np.column_stack([r,-eye]);anchors=[]
    for anchor in profile['landmarks']:
        lat,lon=np.radians([anchor['latitude'],anchor['longitude']]);point=anchor['radiusKm']*np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)])
        v=r@point-eye;v/=np.linalg.norm(v);rd=[np.degrees(np.arctan2(v[1],v[0]))%360,np.degrees(np.arcsin(v[2]))]
        pred=w.all_world2pix([rd],0,tolerance=1e-10)[0]
        anchors.append(dict(name=anchor['name'],pointKm=point.tolist(),pixel=(np.array(anchor['pixelOneBased'])-1).tolist(),uncorrectedPixel=pred.tolist(),role=anchor['role']))
    fit=[a for a in anchors if a['role']=='fit']; holdout=[a for a in anchors if a['role']=='holdout']
    if len(fit)!=2 or len(holdout)!=1:
        raise ValueError('Expected two fit landmarks and one independent holdout')
    offset=np.mean([np.array(a['pixel'])-a['uncorrectedPixel'] for a in fit],axis=0)
    for a in anchors:
        a['correctedPixel']=(np.array(a['uncorrectedPixel'])+offset).tolist();a['residualPixels']=(np.array(a['correctedPixel'])-a['pixel']).tolist()
    maximum=max(abs(n) for a in holdout for n in a['residualPixels'])
    if maximum>3 or np.linalg.norm(offset)>64:
        raise ValueError('Published L\'LORRI landmarks do not support this pointing adjustment')
    terms=lambda prefix:[[i,d-i,h.get(f'{prefix}_{i}_{d-i}',0)] for d in [2,3] for i in range(d+1)]
    oracle=[]
    for x in [73,301,601,917]:
        for y in [41,211,557,933]:
            ra,dec=np.radians(w.all_pix2world([[x,y]],0)[0]);v=np.array([np.cos(dec)*np.cos(ra),np.cos(dec)*np.sin(ra),np.sin(dec)])
            oracle.append(dict(pointKm=(r.T@(eye+v*1272)).tolist(),pixel=(np.array([x,y])+offset).tolist()))
    return dict(schema='cssearth-archived-camera@1',target=target,startTime=h['STARTUTC'],filter='PANCHROMATIC',
        width=1024,height=1024,matrix=p.tolist(),rayMatrix=np.linalg.inv(k@r).tolist(),positionKm=(r.T@eye).tolist(),sunDirection=sun.tolist(),
        sip=dict(referencePixel=ref.tolist(),a=terms('A'),b=terms('B'),offsetPixels=offset.tolist()),
        checks=dict(anchors=anchors,maximumHoldoutResidualPixels=maximum,maximumAcceptedHoldoutResidualPixels=3,
            astropyProjectionAnchors=oracle,bodyFrame=body_frame_note(target,profile),
            pointing='Two published landmarks constrain translation; third withheld. Original TAN-SIP distortion unchanged.'))


def register_osiris(source, profile, camera, temporary):
    from scipy.ndimage import gaussian_filter
    from scipy.signal import fftconvolve
    camera_path=temporary/'camera.json';camera_path.write_text(json.dumps(camera))
    output=temporary/'reference.f32'
    subprocess.run(['node',str(Path(__file__).with_name('camera-reference.mts')),str(source),str(camera_path),str(source/profile['image']),str(output)],check=True)
    width,height=camera['width'],camera['height'];m=np.fromfile(output,'<f4').reshape(height,width)
    data=(source/profile['image']).read_bytes();offset=(int(field(data[:65536].decode('ascii',errors='replace'),'^IMAGE'))-1)*512
    a=np.frombuffer(data,dtype='<f4',count=width*height,offset=offset).reshape(height,width).astype('float64');a[~np.isfinite(a)]=0
    # A standard difference of Gaussians removes unmatched broad photometric
    # trends. Matching only estimates a translation, never modifies source pixels.
    a=gaussian_filter(a,2)-gaussian_filter(a,30);m=gaussian_filter(m,2)-gaussian_filter(m,30)
    pad=profile.get('registrationSearchRadiusPixels',128)
    if type(pad) is not int or not 128<=pad<=256:
        raise ValueError('Registration search must be between 128 and 256 source pixels')
    results=[]
    for window in profile['registrationWindows']:
        x0,y0,x1,y1=window['rectangle']
        if not (pad<=x0<x1<=width-pad and pad<=y0<y1<=height-pad):
            raise ValueError('Registration window and search margin must fit inside the source image')
        t=m[y0:y1,x0:x1];im=a[y0-pad:y1+pad,x0-pad:x1+pad];t=t-t.mean();ones=np.ones(t.shape);n=t.size
        sums=fftconvolve(im,ones,mode='valid');sq=fftconvolve(im*im,ones,mode='valid');cov=fftconvolve(im,t[::-1,::-1],mode='valid')
        cc=cov/np.sqrt(np.maximum(1e-30,(sq-sums*sums/n)*np.sum(t*t)));iy,ix=np.unravel_index(cc.argmax(),cc.shape)
        if min(ix,iy)<=0 or max(ix,iy)>=2*pad or cc[iy,ix]<.7:
            raise ValueError(f"Unqualified image/model correlation window {window['name']}: offset ({int(ix)-pad}, {int(iy)-pad}), correlation {float(cc[iy,ix]):.6f}")
        results.append(dict(**window,offsetPixels=[int(ix)-pad,int(iy)-pad],correlation=float(cc[iy,ix])))
    fits=[w for w in results if w['role']=='fit'];holdouts=[w for w in results if w['role']=='holdout']
    if len(fits)!=2 or len(holdouts)!=2:
        raise ValueError('Expected disjoint two-fit/two-holdout registration')
    delta=np.mean([w['offsetPixels'] for w in fits],axis=0)
    maximum=max(float(np.linalg.norm(np.array(w['offsetPixels'])-delta)) for w in holdouts)
    if maximum>12:
        raise ValueError('Independent registration holdouts exceed source-mesh tolerance')
    p=np.array(camera['matrix']);p[:2]+=delta[:,None]*p[2];camera['matrix']=p.tolist();camera['rayMatrix']=np.linalg.inv(p[:,:3]).tolist()
    camera['checks']['imageRegistration']=dict(method='Bounded zero-mean normalized image/model correlation; BORESIGHT_V01 section 4.2.',
        windows=results,offsetPixels=delta.tolist(),maximumHoldoutResidualPixels=maximum,maximumAcceptedHoldoutResidualPixels=12,
        interpretation='Registration to the pinned source shape; not absolute ground truth. Header pointing checks describe the camera before adjustment.')
    if pad!=128:
        camera['checks']['imageRegistration']['searchRadiusPixels']=pad


def main():
    parser=argparse.ArgumentParser();parser.add_argument('source',type=Path)
    parser.add_argument('--profile',default='preparation/camera.json',help='Pinned camera profile relative to the source directory')
    args=parser.parse_args();source=args.source.resolve()
    if Path(args.profile).is_absolute() or '..' in Path(args.profile).parts:
        raise ValueError('Camera profile must be inside its source package')
    profile=json.loads((source/args.profile).read_text());manifest=json.loads((source/'manifest.json').read_text())
    paths=[args.profile,profile['image'],*profile['kernels'],*profile['references'],profile['mesh']]
    pins={e['path']:e for e in manifest['inputs']};provenance=[]
    for path in paths:
        # A cited paper or archive document is named by its URL and recorded as cited; package files are checked against their pins.
        if path.startswith('https://'):
            provenance.append(dict(url=path));continue
        expected=pins[path]
        # A download is verified against its manifest pin; a file authored here is its own record.
        if 'expectedSha256' in expected and (digest(source/path)!=expected['expectedSha256'] or (source/path).stat().st_size!=expected['expectedBytes']):
            raise ValueError('Changed source pin: '+path)
        provenance.append(dict(path=path))
    sp.kclear()
    for path in profile['kernels']:
        sp.furnsh(str(source/path))
    camera=llorri(source,profile) if profile['format']=='llorri-camera' else osiris(source,profile)
    camera.update(provenance=provenance)
    with tempfile.TemporaryDirectory() as t:
        if profile.get('registrationWindows'):
            register_osiris(source,profile,camera,Path(t))
    destination=source/profile['output'];destination.write_text(json.dumps(camera,indent=2)+'\n')
    print(json.dumps(dict(output=str(destination),sha256=digest(destination),checks=camera['checks'])))


if __name__=='__main__':
    main()
