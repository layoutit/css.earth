"""Collect the isolated B3 captures without treating partial runs as qualification."""
import hashlib, json, pathlib, shutil

root=pathlib.Path.cwd()
out=root/'docs/moons/b3-preparation/final'
captures=out/'browser'
captures.mkdir(exist_ok=True)
rows=json.loads((root/'output/b3-resume/browser-serial.json').read_text())
expected={
 'titania':['normal','elevation','geology'], 'miranda':['normal','elevation','geology'],
 'callisto':['normal','enhanced'], 'proteus':['normal','elevation','filter-color'],
 'hyperion':['normal','elevation'], 'phoebe':['normal','elevation','maplet-resolution','image-count']}
keys={(body,lens,dpr) for body,lenses in expected.items() for lens in lenses for dpr in (1,2)}
assert {(r['body'],r['lens'],r['dpr']) for r in rows} == keys
summary={'status':'CAPTURED_UNREVIEWED','scope':'Six bodies, 17 views, desktop Chrome DPR1/2; each view runs in a fresh browser and server. No native parity, production build, physical mobile or throughput claim.',
 'bodyCount':6,'lensCount':17,'isolatedRuns':len(rows),'lightingStates':0,'drags':0,'peakTaskRSSBytes':0,'runs':[]}
frozen={}
for row in rows:
 assert row['status']=='PASS',row
 receipt=json.loads(pathlib.Path(row['receipt']).read_text())
 summary['peakTaskRSSBytes']=max(summary['peakTaskRSSBytes'],receipt['peakRSSBytes'])
 lines=pathlib.Path(row['receipt']).with_suffix('.log').read_text().splitlines()
 paths=[pathlib.Path(s) for s in lines if s.endswith('/report.json')]
 assert len(paths)==1
 report=json.loads(paths[0].read_text())
 assert report['status']=='CAPTURED_UNREVIEWED' and report['shutdown']['browserClose']=='COMPLETE'
 assert len(report['cases'])==1
 case=report['cases'][0]
 assert case['id']==row['body'] and case['dpr']==row['dpr'] and not case['errors']
 assert case['contextClose']=='COMPLETE'
 assert len(case['views'])==2 and {v['lensId'] for v in case['views']}=={row['lens']}
 for file in report['frozenFiles']:
  old=frozen.setdefault(file['path'],file)
  assert old==file,('Prepared/shared input changed between isolated runs',file['path'])
 summary['lightingStates']+=len(case['views'])
 summary['drags']+=sum('drag' in v for v in case['views'])
 name=f"{row['body']}-{row['lens']}-dpr{row['dpr']}.json"
 shutil.copyfile(paths[0],captures/name)
 summary['runs'].append({'body':row['body'],'lens':row['lens'],'dpr':row['dpr'],
  'report':'browser/'+name,'sha256':hashlib.sha256(paths[0].read_bytes()).hexdigest(),
  'resourcePeakBytes':receipt['peakRSSBytes'],'resourceSeconds':receipt['seconds']})
for name,file in frozen.items():
 h=hashlib.sha256();n=0
 with (root/name).open('rb') as f:
  for b in iter(lambda:f.read(1024*1024),b''):h.update(b);n+=len(b)
 assert h.hexdigest()==file['sha256'] and n==file['bytes'],name
summary['frozenFilesVerified']=len(frozen)
(out/'browser-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
print(json.dumps({k:v for k,v in summary.items() if k!='runs'},indent=2))
