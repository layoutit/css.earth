"""Bounded stdlib-only native-navigation checks. No mesh edits or surface preparation."""
from pathlib import Path
import argparse, hashlib, json, math, re, struct
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--intake',type=Path,default=Path('output/b9-source-intake/phoebe'))
parser.add_argument('--output',type=Path)
args=parser.parse_args()
p=args.intake.resolve()
b=(p/'N1465670650_1_ir.cub').read_bytes()
if len(b)!=232454 or hashlib.sha256(b).hexdigest()!=json.loads((p/'nav-static-inspection.json').read_text())['sha256']:
 raise SystemExit('Native nav input does not match the pinned receipt')
s=b[:65536].decode('latin1').split('End\n',1)[0]
checks=json.loads((p/'nav-static-inspection.json').read_text())
tables={x['name']:x['sampledRecords'] for x in checks['tables']}
def vec(d,names):return [d[n] for n in names]
def minus(a,b):return [x-y for x,y in zip(a,b)]
def dot(a,b):return sum(x*y for x,y in zip(a,b))
def unit(v):return [x/math.sqrt(dot(v,v)) for x in v]
def angle(a,b):return math.degrees(math.acos(max(-1,min(1,dot(unit(a),unit(b))))))
def mv(m,v):return [dot(row,v) for row in m]
def quaternion_matrix(q):
 w,x,y,z=q
 return [[1-2*(y*y+z*z),2*(x*y-w*z),2*(x*z+w*y)], [2*(x*y+w*z),1-2*(x*x+z*z),2*(y*z-w*x)], [2*(x*z-w*y),2*(y*z+w*x),1-2*(x*x+y*y)]]
def rotation(t):
 a,c=tables['BodyRotation']; q1=vec(a,['J2000Q0','J2000Q1','J2000Q2','J2000Q3']);q2=vec(c,['J2000Q0','J2000Q1','J2000Q2','J2000Q3'])
 u=(t-a['ET'])/(c['ET']-a['ET']);co=dot(q1,q2)
 if co<0:q2=[-v for v in q2];co=-co
 w=math.acos(max(-1,min(1,co)))
 q=[(math.sin((1-u)*w)*x+math.sin(u*w)*y)/math.sin(w) for x,y in zip(q1,q2)]
 return quaternion_matrix(q)
def position(t):
 rows=tables['InstrumentPosition'];a,c=(rows[0],rows[1]) if t<=rows[1]['ET'] else (rows[1],rows[2]);dt=c['ET']-a['ET'];u=(t-a['ET'])/dt
 f=[2*u**3-3*u**2+1,u**3-2*u**2+u,-2*u**3+3*u**2,u**3-u**2]
 return [f[0]*a[n]+f[1]*dt*a[n+'V']+f[2]*c[n]+f[3]*dt*c[n+'V'] for n in ['J2000X','J2000Y','J2000Z']]
def sun(t):
 a,c=tables['SunPosition'];u=(t-a['ET'])/(c['ET']-a['ET']);return [a[n]*(1-u)+c[n]*u for n in ['J2000X','J2000Y','J2000Z']]
clockhex=re.search(r'CLOCK_ET_-82_1465670650_COMPUTED\s*=\s*(\w+)',s).group(1)
integerET=struct.unpack('<d',bytes.fromhex(clockhex))[0]
t0=integerET+13981/15959.;exp=.160*1.01725;delay=.415*1.01725
result={'scope':'Source-navigation consistency only. No absolute pointing, fixed-mesh registration, detector-footprint or spectral validity claim.','sourceVersion':'ISIS 3.5.0 VimsGroundMap timing; confirm unchanged 3.5.2 before implementation.','timing':{'cachedIntegerET':integerET,'nativeStartET':t0,'irExposureSeconds':exp,'interlineSeconds':delay,'firstPixelET':t0+.5*exp,'lastPixelET':t0+23*(48*exp+delay)+47.5*exp},'anchors':[]}
for line,sample in [(11,12),(17,12),(15,14)]:
 vals=[struct.unpack_from('<f',b,65536+band*48*24*4+(line*48+sample)*4)[0] for band in range(6)]
 phase,emission,incidence,lat,lon,res=vals;t=t0+line*(48*exp+delay)+(sample+.5)*exp
 lat,lon=map(math.radians,[lat,lon]);direction=[math.cos(lat)*math.cos(lon),math.cos(lat)*math.sin(lon),math.sin(lat)]
 axes=[115.,110.,105.];radius=1/math.sqrt(sum((v/a)**2 for v,a in zip(direction,axes)));hit=[radius*v for v in direction];normal=unit([v/a**2 for v,a in zip(hit,axes)])
 R=rotation(t);observer=mv(R,position(t));solar=mv(R,sun(t));toObserver=minus(observer,hit);toSun=minus(solar,hit)
 calculated=[angle(toObserver,toSun),angle(normal,toObserver),angle(normal,toSun)]
 result['anchors'].append({'lineZeroBased':line,'sampleZeroBased':sample,'ET':t,'sourceAnglesDegrees':dict(zip(['phase','emission','incidence'],vals[:3])),'calculatedAnglesDegrees':dict(zip(['phase','emission','incidence'],calculated)),'absoluteErrorsDegrees':dict(zip(['phase','emission','incidence'],[abs(x-y) for x,y in zip(vals[:3],calculated)])),'oldEllipsoidHitKm':hit,'observerJ2000Km':position(t),'observerOldFrameKm':observer,'nativeLookRayOldFrame':unit(minus(hit,observer))})
(args.output or p/'nav-anchor-qualification.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps(result,indent=2))
