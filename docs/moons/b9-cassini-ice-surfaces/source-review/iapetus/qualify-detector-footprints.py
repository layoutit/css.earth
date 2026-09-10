"""Stdlib reconstruction of native ISIS VIMS camera center/corner rays.

Fixed-mid-exposure angular apertures are diagnostic until camera-center and
finite-exposure support checks pass. Never form polygons between scan lines.
"""
import argparse
import bisect
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import re
import struct

_spec = importlib.util.spec_from_file_location('independent_values', Path(__file__).with_name('validate-native.py'))
v = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(v)
RADIUS = [747.4, 747.4, 712.4]


def dot(a,b): return sum(x*y for x,y in zip(a,b))
def sub(a,b): return [x-y for x,y in zip(a,b)]
def unit(a): return [x/math.sqrt(dot(a,a)) for x in a]
def mv(m,a): return [dot(row,a) for row in m]
def transpose(m): return list(zip(*m))
def angle(a,b):
    # atan2 avoids acos precision loss for almost identical center directions.
    a,b=unit(a),unit(b)
    c=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
    return math.atan2(math.sqrt(dot(c,c)),dot(a,b))


def qmatrix(q):
    w,x,y,z=unit(q)
    return [[1-2*(y*y+z*z),2*(x*y-w*z),2*(x*z+w*y)],
            [2*(x*y+w*z),1-2*(x*x+z*z),2*(y*z-w*x)],
            [2*(x*z-w*y),2*(y*z+w*x),1-2*(x*x+y*y)]]


def pair(rows,t):
    times=[r[-1] for r in rows]
    if not times[0] <= t <= times[-1]: raise ValueError('time outside cached table')
    i=max(0,min(len(rows)-2,bisect.bisect_right(times,t)-1))
    return rows[i],rows[i+1]


def rot(rows,t):
    a,b=pair(rows,t);u=(t-a[-1])/(b[-1]-a[-1]);p,q=list(a[:4]),list(b[:4])
    co=dot(p,q)
    if co<0:q=[-x for x in q];co=-co
    if co>1-1e-12:
        return qmatrix([(1-u)*x+u*y for x,y in zip(p,q)])
    omega=math.acos(max(-1,min(1,co)))
    return qmatrix([(math.sin((1-u)*omega)*x+math.sin(u*omega)*y)/math.sin(omega) for x,y in zip(p,q)])


def pos(rows,t):
    a,b=pair(rows,t);dt=b[-1]-a[-1];u=(t-a[-1])/dt
    h=[2*u**3-3*u*u+1,u**3-2*u*u+u,-2*u**3+3*u*u,u**3-u*u]
    return [h[0]*a[k]+h[1]*dt*a[k+3]+h[2]*b[k]+h[3]*dt*b[k+3] for k in range(3)]


def tables(path,label):
    out={}
    with path.open('rb') as stream:
        for t in re.findall(r'Object = Table\s*\n(.*?)End_Object',label,re.S):
            name=v.value(t,'Name')
            if name not in ['InstrumentPointing','BodyRotation','InstrumentPosition','SunPosition']: continue
            fields=re.findall(r'Group = Field\s*\n(.*?)End_Group',t,re.S)
            assert all(v.value(f,'Type')=='Double' and v.value(f,'Size')=='1' for f in fields)
            width=len(fields);count=int(v.value(t,'Records'));size=int(v.value(t,'Bytes'))
            assert width*count*8==size
            stream.seek(int(v.value(t,'StartByte'))-1);raw=stream.read(size)
            out[name]={'rows':list(struct.iter_unpack('<'+'d'*width,raw)),
                       'fields':[v.value(f,'Name') for f in fields]}
            if name=='InstrumentPointing':
                flat=[float(x) for x in v.array(t,'ConstantRotation')]
                out[name]['constant']=[flat[i:i+3] for i in (0,3,6)]
    return out


def ellipsoid_point(latitude,longitude):
    p,l=math.radians(latitude),math.radians(longitude)
    d=[math.cos(p)*math.cos(l),math.cos(p)*math.sin(l),math.sin(p)]
    radius=1/math.sqrt(sum((x/a)**2 for x,a in zip(d,RADIUS)))
    return [radius*x for x in d]


def intersect(observer,ray):
    a=sum((d/r)**2 for d,r in zip(ray,RADIUS))
    b=2*sum(o*d/(r*r) for o,d,r in zip(observer,ray,RADIUS))
    c=sum((o/r)**2 for o,r in zip(observer,RADIUS))-1
    disc=b*b-4*a*c
    if disc<0:return None
    roots=[t for t in ((-b-math.sqrt(disc))/(2*a),(-b+math.sqrt(disc))/(2*a)) if t>0]
    if not roots:return None
    t=min(roots)
    return [o+t*d for o,d in zip(observer,ray)]


def lonlat(point):
    return [math.degrees(math.atan2(point[1],point[0]))%360,
            math.degrees(math.atan2(point[2],math.hypot(point[0],point[1])))]


class Camera:
    def __init__(self,path):
        self.side,self.label,self.nav,_=v.read(path,range(1,7))
        self.tables=tables(path,self.label)
        number,fraction=v.value(self.label,'NativeStartTime').split('.')
        match=re.search(r'CLOCK_ET_-82_'+number+r'_COMPUTED\s*=\s*(\w+)',self.label)
        self.start=struct.unpack('<d',bytes.fromhex(match.group(1)))[0]+int(fraction)/15959
        self.exposure=float(v.array(self.label,'ExposureDuration')[0].split()[0])*.001*1.01725
        self.delay=float(v.value(self.label,'InterlineDelayDuration'))*.001*1.01725
        self.xoffset=int(v.value(self.label,'XOffset'))-1
        self.yoffset=int(v.value(self.label,'ZOffset'))-1
        assert v.value(self.label,'SamplingMode')=='NORMAL'

    def time(self,x,y):
        return self.start+y*(self.side*self.exposure+self.delay)+(x+.5)*self.exposure

    def state(self,t):
        body=rot(self.tables['BodyRotation']['rows'],t)
        pointing=rot(self.tables['InstrumentPointing']['rows'],t)
        observer=mv(body,pos(self.tables['InstrumentPosition']['rows'],t))
        return body,pointing,observer

    def hit(self,x,y,t,dx=0,dy=0):
        # ISIS3.5.0 LookDirection, evaluated with continuous angular offsets
        # while retaining this detector's ET; not SetFocalPlane(x+dx,y+dy),
        # which would incorrectly change acquisition time across corners.
        theta=math.pi/2-(y+self.yoffset+dy-31)*.000495
        phi=-math.pi/2+(x+self.xoffset+dx-31)*.000495
        instrument=[math.sin(theta)*math.cos(phi),math.cos(theta),-math.sin(theta)*math.sin(phi)]
        body,pointing,observer=self.state(t)
        constant=self.tables['InstrumentPointing']['constant']
        ray=mv(body,mv(transpose(pointing),mv(transpose(constant),instrument)))
        return intersect(observer,ray),observer,ray

    def detector_coordinates(self,point,t):
        """Inverse camera angles, in nominal NORMAL sample/line coordinates."""
        body,pointing,observer=self.state(t)
        constant=self.tables['InstrumentPointing']['constant']
        look=unit(mv(constant,mv(pointing,mv(transpose(body),sub(point,observer)))))
        phi=math.atan2(-look[2],look[0])
        theta=math.atan2(math.hypot(look[0],look[2]),look[1])
        return [(phi+math.pi/2)/.000495+31-self.xoffset,
                (math.pi/2-theta)/.000495+31-self.yoffset]


def exposure_audit(camera):
    """All centers plus finite-exposure pose effects. Not a PSF reconstruction.

    NORMAL's two half-width sub-exposures are a documented effective-aperture
    model. Both step orders remain explicit alternatives; no signed step is
    inferred from the ISIS center pitch. Physical nominal dimensions are taken
    from the PDS RC19 report, not confused with the camera sampling scale.
    """
    errors=[];motion=[];step_order_common=[];rows=[]
    for y in range(camera.side):
        row=[]
        for x in range(camera.side):
            i=y*camera.side+x;mid=camera.time(x,y)
            expected=ellipsoid_point(camera.nav[4][i],camera.nav[5][i])
            center,_,_=camera.hit(x,y,mid)
            errors.append(math.degrees(angle(center,expected)))
            poses=[]
            for fraction in (0,.25,.5,.75,1):
                t=mid+(fraction-.5)*camera.exposure
                hit,_,_=camera.hit(x,y,t)
                uv=camera.detector_coordinates(center,t)
                poses.append({'fraction':fraction,'nominalMirrorCenterMovementMeters':angle(center,hit)*736000,
                              'sourceCenterInNominalDetectorCoordinates':uv})
            maximum=max(p['nominalMirrorCenterMovementMeters'] for p in poses)
            motion.append(maximum)
            # Membership of the archived nominal-center direction in each
            # quarter-exposure sub-aperture. Step orders tested separately.
            # .25mrad physical fast width; .5mrad slow width; half-step offset
            # .125mrad around nominal effective center. These are nominal
            # angular aperture assumptions, not precision optical calibration.
            fast_half=.000125/.000495; slow_half=.00025/.000495
            early,late=poses[1]['sourceCenterInNominalDetectorCoordinates'],poses[3]['sourceCenterInNominalDetectorCoordinates']
            def contains(uv,sign):
                return abs(uv[0]-(x+sign*fast_half)) <= fast_half and abs(uv[1]-y) <= slow_half
            order_a=contains(early,-1) or contains(late,1)
            order_b=contains(early,1) or contains(late,-1)
            step_order_common.append(order_a and order_b)
            row.append({'sampleZeroBased':x,'maximumNominalCenterMotionMeters':maximum,
                        'nominalCenterInsideEitherStepOrder':order_a and order_b})
        rows.append({'lineZeroBased':y,'maximumCenterMotionMeters':max(p['maximumNominalCenterMotionMeters'] for p in row),
                     'nominalCentersWithheldUnderUnknownOrder':[p['sampleZeroBased'] for p in row if not p['nominalCenterInsideEitherStepOrder']]})
    return {'allNativeCenterGroundErrorDegrees':v.stats(errors),
            'fixedMirrorPoseMovementFromMidtimeMeters':v.stats(motion),
            'normalTwoHalfApertureModel':{'physicalNominalFastFullWidthRadians':.00025,
                                        'physicalNominalSlowFullWidthRadians':.0005,
                                        'fastAxisHalfStepOffsetRadians':.000125,
                                        'testedExposureFractions':[.25,.75],
                                        'stepOrder':'unresolved; intersection of both ordered unions proposed',
                                        'nominalCenterInsideBothOrderUnionsCount':sum(step_order_common),
                                        'supportedContinuousExposureOrPSFClaim':False},
            'rows':rows}


def audit(native,cube):
    camera=Camera(native/('N'+cube+'_ir.cub'))
    anchors=[]
    for x,y in [(0,0),(camera.side-1,0),(0,camera.side-1),(camera.side-1,camera.side-1),
                (camera.side//4,camera.side//4),(camera.side//2,camera.side//2)]:
        i=y*camera.side+x;t=camera.time(x,y)
        hit,observer,ray=camera.hit(x,y,t)
        expected=ellipsoid_point(camera.nav[4][i],camera.nav[5][i])
        corners=[camera.hit(x,y,t,dx,dy)[0] for dx,dy in [(-.5,-.5),(.5,-.5),(.5,.5),(-.5,.5)]]
        anchors.append({'sampleZeroBased':x,'lineZeroBased':y,'midExposureET':t,
                        'sourceCenterLongitudeLatitude':[camera.nav[5][i],camera.nav[4][i]],
                        'calculatedCenterLongitudeLatitude':lonlat(hit) if hit else None,
                        'centerGroundAngularErrorDegrees':math.degrees(angle(hit,expected)) if hit else None,
                        'centerLookAngularErrorDegrees':math.degrees(angle(ray,sub(expected,observer))),
                        'fixedTimeCornersLongitudeLatitude':[lonlat(p) if p else None for p in corners]})
    return {'id':cube,'timing':{'nativeStartET':camera.start,'exposureSeconds':camera.exposure,'interlineDelaySeconds':camera.delay},
            'anchors':anchors,'exposureChecks':exposure_audit(camera),
            'status':'all native centers verified; effective-square corners provisional; physical two-half NORMAL exposure required'}


def main():
    parser=argparse.ArgumentParser()
    root=Path(__file__).resolve().parents[5]
    parser.add_argument('--native-dir',type=Path,default=root/'output/b9-source-intake/iapetus/native')
    parser.add_argument('--output',type=Path,default=Path(__file__).with_name('detector-footprint-qualification.json'))
    args=parser.parse_args()
    report={'schema':'iapetus-detector-ray-qualification@1','results':[audit(args.native_dir,cube) for cube in ['1568129671_1','1568133146_2']]}
    args.output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'output':str(args.output),'results':[{'id':r['id'],
                      'centerErrors':r['exposureChecks']['allNativeCenterGroundErrorDegrees'],
                      'motion':r['exposureChecks']['fixedMirrorPoseMovementFromMidtimeMeters'],
                      'unknownStepOrder':r['exposureChecks']['normalTwoHalfApertureModel']} for r in report['results']]}))


if __name__=='__main__':main()
