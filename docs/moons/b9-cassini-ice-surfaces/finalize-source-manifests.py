"""Pin final B9 products and authored body documents after source preparation."""
import hashlib
import json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
def read(p):return json.loads(p.read_text())
def pin(p):return {'expectedBytes':p.stat().st_size,'expectedSha256':hashlib.sha256(p.read_bytes()).hexdigest()}
for body in ['tethys','iapetus','phoebe']:
 s=ROOT/'src/planets'/body/'source';r=s/'cassini-ice';plan=read(r/'prepare.json');receipt=read(r/plan['receipt'])
 m=read(s/'manifest.json');m['inputs']=[x for x in m['inputs'] if not (x['path'].startswith('cassini-ice/') and '/native/' not in x['path'] and '/raw/' not in x['path'])]
 for kind,lens,label,consumer in [('depth','ice-absorption','Ice absorption','ice-absorption'),('rgbDisplay','infrared','Infrared','surfaces')]:
  path='cassini-ice/'+plan['outputs'][kind];width,height=plan['width'],plan['height']
  report=next(x for x in receipt['outputs'] if x['kind']==('depth' if kind=='depth' else 'rgb'))
  m['inputs'].append({'id':body+'-cassini-'+lens,'path':path,**pin(s/path),
   'origin':'https://vims.univ-nantes.fr/cube/'+plan['observations'][0]['id'],
   'credit':'NASA / Caltech-JPL / University of Arizona / Osuna-CNRS-Nantes Université; cssEarth offline detector mapping and display',
   'license':'CC-BY-4.0','licenseEvidence':['https://vims.univ-nantes.fr/about','cassini-ice/evidence/license-about.html','https://creativecommons.org/licenses/by/4.0/'],
   'acquisition':'Reproduce from pinned original C/N and raw QUB inputs with tools/objects/acquisition/'+('cassini-phoebe-surfaces.py' if body=='phoebe' else 'cassini-ice-surfaces.py')+' and cassini-ice/prepare.json.',
   'redistribution':'Derived source map under CC BY 4.0 with full archive attribution; original observations and lossless values retained.',
   'consumers':[consumer],'lensId':lens,'label':label,'falseColor':True,'width':width,'height':height,
   'projection':{'type':'equirectangular','centerLongitude':180 if kind=='rgbDisplay' else 0,'referenceRadiusMeters':plan['radiusMeters'],'longitudeDirection':'east-positive','latitudeType':'planetocentric'},
   'coverage':f"Supported detector apertures cover approximately {report['areaFraction']*100:.2f}% of the reference sphere by angular grid weighting, not measured physical mesh area. Native resolution varies; output grid spacing is not observation detail. Preserve unsupported gaps. No photometric correction; registration limits are in cassini-ice/evidence/registration.md.",
   'capture':{'spacecraftIds':['cassini'],'evidence':'https://vims.univ-nantes.fr/cube/'+plan['observations'][0]['id']}})
 declared={x['path'] for group in ['inputs','generatedIntermediates','documents'] for x in m[group]}
 for path in sorted(r.rglob('*')):
  if not path.is_file():continue
  rel=path.relative_to(s).as_posix()
  if rel not in declared:
   m['documents'].append({'path':rel,'purpose':'Pinned Cassini source mapping recipe, lossless spectral values, exact observation ownership, detector support or source registration and license evidence.',**pin(path)})
 for entry in m['documents']:
  if entry['path'].startswith('cassini-ice/') or entry['path'] in ['content/object.json','preparation/acquisition.json','preparation/terrestrial.json']:
   entry.update(pin(s/entry['path']))
 (s/'manifest.json').write_text(json.dumps(m,indent=2,ensure_ascii=False)+'\n')
 print(body,len(m['inputs']),'inputs',len(m['documents']),'documents')

 # Descriptor binds authored sources, and the existing shared material contract.
 object_dir=s.parent; descriptor_path=object_dir/'object.json';d=read(descriptor_path);recipe=d['properties']['recipe']
 for ref in recipe['sources']:ref['sha256']=pin(object_dir/ref['path'])['expectedSha256']
 lenses=recipe['surfaces'][0]['lenses']
 for lens in ['infrared','ice-absorption']:
  if not any(x['id']==lens for x in lenses):lenses.append({'id':lens,'source':'content','material':'lighting'})
 descriptor_path.write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
