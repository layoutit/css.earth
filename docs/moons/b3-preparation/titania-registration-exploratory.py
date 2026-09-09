import json,math,numpy as np
from pathlib import Path
p=Path('/tmp/b3-uranus-gis/titania');features={f['name']:f for f in json.loads((p/'nomenclature.json').read_text())};anchors={f['id']:f for f in json.loads((p/'anchors.json').read_text())}
pairs={'Adriana':'23','Calphurnia':'15','Imogen':'5','Lucetta':'14','Katherine':'32','Ursula':'38','Iras':'17','Marina':'2','Phrynia':'6','Valeria':'27'}
train=['Adriana','Calphurnia','Imogen','Lucetta','Katherine','Ursula'];hold=['Iras','Marina','Phrynia','Valeria']
def polar(f):
 lon,lat=map(math.radians,[f['center_lon'],f['center_lat']]);r=math.tan(math.pi/4+lat/2);return [r*math.sin(lon),r*math.cos(lon)]
A=[];b=[]
for name in train:
 x,y=polar(features[name]);u,v=anchors[pairs[name]]['xy'];A.extend([[x,-y,1,0],[y,x,0,1]]);b.extend([u,v])
a,c,tx,ty=np.linalg.lstsq(np.array(A),np.array(b),rcond=None)[0];M=np.array([[a,-c],[c,a]]);rows=[]
for name,id in pairs.items():
 f=features[name];anchor=anchors[id];xy=np.array(anchor['xy']);q=np.linalg.solve(M,xy-np.array([tx,ty]));lon=math.degrees(math.atan2(*q))%360;lat=math.degrees(2*math.atan(np.linalg.norm(q))-math.pi/2)
 la,lb=map(math.radians,[f['center_lat'],lat]);dl=math.radians(f['center_lon']-lon);err=math.degrees(math.acos(np.clip(math.sin(la)*math.sin(lb)+math.cos(la)*math.cos(lb)*math.cos(dl),-1,1)))
 rows.append(dict(name=name,id=id,role='fit' if name in train else 'holdout',sourceXY=xy.tolist(),reference=[f['center_lon'],f['center_lat']],reconstructed=[lon,lat],angularResidualDegrees=err))
dictout=dict(matrix=M.tolist(),translation=[tx,ty],anchors=rows,model='Normalized south-polar stereographic sphere, east-positive; planar similarity fit to historical crater centres.')
(p/'geographic-fit.json').write_text(json.dumps(dictout,indent=2));print(json.dumps(dictout,indent=2))
