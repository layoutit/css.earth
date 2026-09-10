from pathlib import Path
import json,gzip,re,subprocess,math,hashlib
import numpy as np
ROOT=Path(__file__).parent; CACHE=Path('output/population-prs/mars-crossers/research')
CACHE.mkdir(parents=True,exist_ok=True)
rows=json.loads((ROOT/'models.json').read_text()); selected={'Aethra':161,'Lyyli':2012,'Hela':454,'Kemi':1202,'Taurinensis':490}
akari={}
for line in gzip.decompress(Path('src/planets/proserpina/source/reference/AcuA_V1.txt.gz').read_bytes()).decode().splitlines():
 if line[:6].strip().isdigit():akari[int(line[:6])]=dict(number=int(line[:6]),name=line[7:25].strip(),diameterKm=float(line[52:59]),uncertaintyKm=float(line[60:65]),detections=int(line[49:51]),originalRow=line)
def fetch(url,name):
 p=CACHE/name
 if not p.exists():p.write_bytes(subprocess.check_output(['curl','-fsSL','--max-time','20',url]))
 return p.read_bytes()
results=[]
for r in rows:
 if selected.get(r['name'])!=r['modelId']:continue
 fetch(r['modelUrl'],f'model-{r["modelId"]}.html')
 f=r['fields'];mid=r['modelId'];num=int(re.search(r'\((\d+)\)',f['Asteroid'])[1]);assert f['Asteroid']==f'({num}) {r["name"]}'
 raw=fetch(r['files']['shape.txt'],f'shape-{mid}.txt');lines=[l.split() for l in raw.decode().splitlines() if l.strip()];nv,nf=map(int,lines[0]);v=np.array(lines[1:nv+1],float);faces=np.array(lines[nv+1:],int);tri=v[faces-1];vol=float(np.einsum('ij,ij->i',tri[:,0],np.cross(tri[:,1],tri[:,2])).sum()/6);vol2=float(np.einsum('ij,ij->i',tri.mean(axis=1),np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0])).sum()/6)
 assert vol>0 and abs(vol-vol2)<vol*1e-10 and faces.shape==(nf,3)
 edges={}
 for face in faces:
  for a,b in zip(face,np.roll(face,-1)):edges.setdefault(tuple(sorted([int(a),int(b)])),[]).append(1 if a<b else -1)
 assert all(len(e)==2 and sum(e)==0 for e in edges.values()) and nv-len(edges)+nf==2
 cat=akari[num];diameter=cat['diameterKm'];error=cat['uncertaintyKm'];d0=(6*vol/math.pi)**(1/3);scale=diameter/d0
 spin=next((k for k in r['files'] if k.startswith('IAUspin')),None)
 if spin:fetch(r['files'][spin],f'spin-{mid}.txt')
 refs=[]
 for ref in r['references']:
  u='https://damit.cuni.cz'+ref['url'] if ref['url'].startswith('/') else ref['url'];rid=u.split('/')[-1];fetch(u,f'reference-{rid}.html');refs.append({**ref,'url':u,'file':f'reference-{rid}.html'})
 alternatives=[{'modelId':a['modelId'],'url':a['modelUrl'],'pole':[a['fields']['λ'],a['fields']['β']],'version':a['fields']['Version']} for a in rows if a['name']==r['name'] and a['modelId']!=mid]
 notes='JPL SBDB class MCA confirms this body is a Mars-crosser. The original convex lightcurve inversion is not resolved terrain. '+('The selected pole is one of two published solutions; no preference is inferred from its lower archive ID. The competing pole remains unresolved.' if alternatives else 'Only the checked listed source model is used.')
 limits='AKARI fitted nonrotating-sphere effective diameter is transferred as a uniform volume-scale approximation to this independently obtained shape model. Quoted catalog error is statistical and omits additional shape, spin and thermal-model uncertainty. No total confidence interval or local terrain accuracy is inferred.'
 if cat['detections']==1:limits+=' Kemi has one catalog detection; this limited measurement support remains explicit.'
 cal={'method':'thermal-effective-diameter-as-volume-approximation','diameterKm':diameter,'uncertaintyKm':error,'reportedUncertaintyKm':error,'catalog':cat,'diameterSemantics':'AKARI effective diameter transferred as an explicit approximate volume scale','sourceUrl':'https://data.darts.isas.jaxa.jp/pub/akari/AKARI-IRC_Catalogue_AllSky_AcuA_1.0/','sourceLabel':'AKARI AcuA, Usui et al. (2011)','scaleKmPerSourceUnit':scale,'metersPerSourceUnit':scale*1000,'limitations':limits,'visibleDescription':f'Convex lightcurve reconstruction at approximate thermal scale: {diameter:g} km effective diameter (catalog ±{error:g} km; additional model uncertainty). Grid marks unavailable imagery; pole ambiguity is retained in source notes.'}
 b={**r,'number':num,'id':r['name'].lower(),'displayName':r['name'],'references':refs,'lambda':float(f['λ']),'beta':float(f['β']),'periodHours':float(f['P']),'version':f['Version'],'nonconvex':False,'calibrated':False,'archiveCalibrated':False,'diameterKm':diameter,'uncertaintyKm':error,'akari':cat,'shapeUrl':r['files']['shape.txt'],'spinUrl':r['files'].get(spin),'shapeSha256':hashlib.sha256(raw).hexdigest(),'shapeBytes':len(raw),'vertices':nv,'faces':nf,'signedVolume':vol,'independentSignedVolume':vol2,'originalVolumeEquivalentDiameter':d0,'firstVertex':v[0].tolist(),'firstFace':faces[0].tolist(),'radialRangeSourceUnits':[float(x) for x in [np.linalg.norm(v,axis=1).min(),np.linalg.norm(v,axis=1).max()]],'extentsSourceUnits':[[float(v[:,i].min()),float(v[:,i].max())] for i in range(3)],'scaleKmPerSourceUnit':scale,'alternatives':alternatives,'shapeKind':'Convex light-curve reconstruction','calibration':cal,'selectionNotes':notes}
 results.append(b);print(b['id'],nv,nf,diameter,error,flush=True)
Path('output/population-prs/mars-crossers/independent-intake.json').write_text(json.dumps(results,indent=2)+'\n')
