"""Independent full-source verification: planar projection plus closest edges.
No product projection/intersection code is imported. Source arrays are compact;
triangles are evaluated in bounded chunks, including Bennu's 3.37M faces.
"""
import json, hashlib, gzip, sys
from pathlib import Path
import numpy as np

ROOT=Path.cwd()
OUT=ROOT/'output/faithfulness-fixes/source-surface'

def read_mesh(id):
 p=ROOT/f'src/objects/{id}/source'
 cfg=json.loads((p/'preparation/terrestrial.json').read_text())
 spec=cfg['geometry']['radialTerrain']; path=p/spec['path']; profile=spec['grid']
 with path.open('rb') as f: sha=hashlib.file_digest(f,'sha256').hexdigest()
 entry=next(x for x in json.loads((p/'manifest.json').read_text())['inputs'] if x['path']==spec['path'])
 if spec['format']=='pds-vertex-facet':
  n=profile['expectedVertices']; v=np.loadtxt(path,skiprows=1,max_rows=n,usecols=(1,2,3));f=np.loadtxt(path,skiprows=n+1,usecols=(1,2,3),dtype=np.int32)-1
 else:
  v=np.empty((profile['expectedVertices'],3),dtype=np.float64);f=np.empty((profile['expectedFaces'],3),dtype=np.int32);iv=it=0
  opener=gzip.open if profile.get('compression')=='gzip' else open
  with opener(path,'rt') as file:
   for line in file:
    if line.startswith('v '):v[iv]=[float(x) for x in line.split()[1:4]];iv+=1
    elif line.startswith('f '):f[it]=[int(x.split('/')[0])-1 for x in line.split()[1:4]];it+=1
  assert iv==len(v) and it==len(f)
 assert len(f)==profile['expectedFaces']; v*=profile['metersPerUnit']
 return v,f,cfg,sha

def closest(v,f,p):
 best=None
 for first in range(0,len(f),100000):
  tri=v[f[first:first+100000]];a,b,c=tri[:,0],tri[:,1],tri[:,2];ab=b-a;ac=c-a;n=np.cross(ab,ac);nn=np.einsum('ij,ij->i',n,n)
  planar=p-n*(np.einsum('ij,ij->i',p-a,n)/nn)[:,None]
  ap=planar-a;aa=np.einsum('ij,ij->i',ab,ab);cc=np.einsum('ij,ij->i',ac,ac);abac=np.einsum('ij,ij->i',ab,ac);abap=np.einsum('ij,ij->i',ab,ap);acap=np.einsum('ij,ij->i',ac,ap);den=aa*cc-abac*abac
  u=(cc*abap-abac*acap)/den;w=(aa*acap-abac*abap)/den
  inside=(u>=-1e-12)&(w>=-1e-12)&(u+w<=1+1e-12)
  points=planar.copy();d=np.einsum('ij,ij->i',p-points,p-points);d[~inside]=np.inf
  for start,end in [(a,b),(b,c),(c,a)]:
   edge=end-start;t=np.clip(np.einsum('ij,ij->i',p-start,edge)/np.einsum('ij,ij->i',edge,edge),0,1)
   q=start+t[:,None]*edge;qd=np.einsum('ij,ij->i',p-q,p-q);use=qd<d;points[use]=q[use];d[use]=qd[use]
  i=int(np.argmin(d))
  if best is None or d[i]<best['distanceSquared']:
   index=first+i;q=points[i]
   best={'sourceFace':index,'point':q.tolist(),'radius':float(np.linalg.norm(q)),'distanceSquared':float(d[i]),'distanceMeters':float(np.sqrt(d[i])),'normal':(n[i]/np.sqrt(nn[i])).tolist(),'triangle':tri[i].tolist()}
 return best

def hits(v,f,d):
 result=[]
 for first in range(0,len(f),100000):
  tri=v[f[first:first+100000]];a,b,c=tri[:,0],tri[:,1],tri[:,2];ab=b-a;ac=c-a;h=np.cross(d,ac);det=np.einsum('ij,ij->i',ab,h);inv=np.zeros(len(det));ok=np.abs(det)>1e-12;inv[ok]=1/det[ok]
  u=np.einsum('ij,ij->i',-a,h)*inv;q=np.cross(-a,ab);w=q@d*inv;t=np.einsum('ij,ij->i',ac,q)*inv
  ok&=(u>=-1e-9)&(w>=-1e-9)&(u+w<=1+1e-9)&(t>0)
  result.extend((float(t[i]),int(first+i)) for i in np.flatnonzero(ok))
 return sorted(result)

def main():
 fixtures=json.loads((ROOT/'tools/objects/terrestrial-layers/fixtures/source-surface-cases.json').read_text())['cases']
 selected=set(sys.argv[1:] or [x['id'] for x in fixtures]); results=[]
 for fixture in fixtures:
  if fixture['id'] not in selected: continue
  id=fixture['id'];v,f,cfg,sha=read_mesh(id)
  policy=cfg['raster']['scientific'][0];query=np.array(fixture['checks'][0]['query']);ray=hits(v,f,query/np.linalg.norm(query))
  assert abs(ray[0][0]*policy['valueTransform']['scale']+policy['valueTransform']['offset']-fixture['oldFirstRayHeight'])<1e-7
  if 'oldRadialGrid' in fixture:
   old=fixture['oldRadialGrid'];width=old['width'];height=old['height'];x=old['longitude']/360*(width-1);y=(90-old['latitude'])/180*(height-1)
   corners=[]
   for gx,gy in [(int(x),int(y)),(int(x)+1,int(y)),(int(x),int(y)+1),(int(x)+1,int(y)+1)]:
    lon=np.deg2rad(gx/(width-1)*360);lat=np.deg2rad(90-gy/(height-1)*180)
    corners.append(hits(v,f,np.array([np.cos(lat)*np.cos(lon),np.cos(lat)*np.sin(lon),np.sin(lat)]))[0][0])
   assert np.max(np.abs(np.array(corners)-np.array(old['cornerRadii'])))<1e-6,(id,'old interpolation source rays')
   u=x-int(x);w=y-int(y);a,b,c,d=corners;radius=(a*(1-u)+b*u)*(1-w)+(c*(1-u)+d*u)*w
   assert abs(radius*policy['valueTransform']['scale']+policy['valueTransform']['offset']-old['scalarValue'])<1e-7
  for face in fixture['triangles']:
   assert np.max(np.abs(v[f[face['sourceFace']]]-np.array(face['vertices'])))<1e-10,(id,'source fixture drift')
  values=[]
  for check in fixture['checks']:
   result=closest(v,f,np.array(check['query']));policy=cfg['raster']['scientific'][0]
   value=result['radius']*policy['valueTransform']['scale']+policy['valueTransform']['offset']
   assert np.max(np.abs(np.array(result['point'])-np.array(check['expectedPoint'])))<1e-6,(id,check['kind'],'closest source point')
   assert abs(value-check['expectedValue'])<1e-7,(id,check['kind'],'scientific scalar')
   assert abs(result['distanceMeters']-check['expectedDistanceMeters'])<1e-6
   values.append({'kind':check['kind'],'sourceFace':result['sourceFace'],'sourcePointMeters':result['point'],'value':value,'distanceMeters':result['distanceMeters']})
  results.append({'id':id,'sourceFaces':len(f),'checks':values})
  print(id, 'PASS',len(f),'source faces;',len(values),'independent whole-source projections',flush=True)
 OUT.mkdir(parents=True,exist_ok=True)
 (OUT/'independent-verification.json').write_text(json.dumps(results,indent=2)+'\n')

if __name__ == "__main__":
 main()
