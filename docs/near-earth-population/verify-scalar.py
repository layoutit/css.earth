import importlib.util,json,numpy as np,sys
sys.dont_write_bytecode=True
from pathlib import Path
spec=importlib.util.spec_from_file_location('independent','docs/near-earth-population/independent-counted-source.py');mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
base=Path('output/near-earth-population')
for id in sys.argv[1:] or [x['id'] for x in json.loads(Path('docs/near-earth-population/inputs.json').read_text())]:
 v,f,cfg,sha=mod.read_mesh(id);lens=cfg['raster']['scientific'][0];out=[]
 for q in json.loads((base/id/'scalar-queries.json').read_text()):
  r=mod.closest(v,f,np.array(q['point']));r['kind']=q['kind'];r['query']=q['point'];r['value']=r['radius']*lens['valueTransform']['scale']+lens['valueTransform']['offset'];r['accepted']=r['distanceMeters']<=lens['surfaceSampling']['maximumDistanceMeters'];out.append(r)
 report={'id':id,'sourceSha256':sha,'method':'Existing independent NumPy plane/edge projection against every original source triangle; all prepared retained face centroids and six source coordinate extrema. Radial multiple-hit probes are reported separately in surface-fit.json.','count':len(out),'withheld':sum(not c['accepted'] for c in out),'maximumDistanceMeters':max(c['distanceMeters'] for c in out),'checks':out}
 (base/id/'scalar-independent.json').write_text(json.dumps(report,indent=2)+'\n');print(id,report['count'],report['withheld'],report['maximumDistanceMeters'])
