"""Refresh authored-document pins only; original scientific input pins never change."""
from pathlib import Path
import json,hashlib

def read(p):return json.loads(p.read_text())
def write(p,x):p.write_text(json.dumps(x,indent=2,ensure_ascii=False)+'\n')
def sha(p):
 with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
for body in ['titan','dione','rhea']:
 root=Path('src/planets')/body;s=root/'source';m=read(s/'manifest.json')
 known={e['path'] for kind in ['inputs','documents','generatedIntermediates'] for e in m[kind]}
 for p in s.rglob('*'):
  if not p.is_file():continue
  rel=p.relative_to(s).as_posix()
  if rel=='manifest.json' or rel in known:continue
  if p.suffix not in ['.json','.md'] or p.stat().st_size>1024*1024:raise ValueError('Unclassified source: '+str(p))
  m['documents'].append({'path':rel,'purpose':'Cassini atlas preparation recipe, source review or conversion receipt.'})
 for e in m['documents']:
  p=s/e['path'];e.update(expectedBytes=p.stat().st_size,expectedSha256=sha(p))
 write(s/'manifest.json',m)
 d=read(root/'object.json');recipe=d['properties']['recipe']
 for e in recipe['sources']:e['sha256']=sha(root/e['path'])
 source=next(x['id'] for x in recipe['sources'] if x['path']=='source/content/object.json')
 surface=recipe['surfaces'][0]
 for lens in (['geology'] if body=='titan' else ['infrared','ice-absorption']):
  if not any(x['id']==lens for x in surface['lenses']):surface['lenses'].append({'id':lens,'source':source,'material':'lighting'})
 write(root/'object.json',d)
 print(body,'document pins refreshed')
