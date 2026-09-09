import json, os, pathlib, subprocess, sys
runner=pathlib.Path(__file__).parent
out=pathlib.Path.cwd()/"output/b3-resume"
out.mkdir(parents=True,exist_ok=True)
plan={'titania':['geology','normal','elevation'],'miranda':['geology','normal','elevation'],
      'callisto':['enhanced','normal'],'proteus':['filter-color','normal','elevation'],
      'hyperion':['normal','elevation'],'phoebe':['normal','elevation','maplet-resolution','image-count']}
rows=[]
for body,lenses in plan.items():
    for lens in lenses:
        for dpr in [1,2]:
            label=f'browser-{body}-{lens}-{dpr}'
            receipt=out/(label+'.json')
            old=json.loads(receipt.read_text()) if receipt.exists() else {}
            if os.environ.get('B3_RESUME')=='1' and old.get('status')=='PASS':
                rows.append({'body':body,'lens':lens,'dpr':dpr,'receipt':str(receipt),'status':'PASS'}); continue
            env={**os.environ,'B3_LENS':lens,'B3_DPR':str(dpr)}
            code=subprocess.call([sys.executable,str(runner/'run-bounded.py'),label,'node',str(runner/'browser-one.mjs'),body],env=env)
            result=json.loads(receipt.read_text())
            rows.append({'body':body,'lens':lens,'dpr':dpr,'receipt':str(receipt),'status':result['status']})
            (out/'browser-serial.json').write_text(json.dumps(rows,indent=2)+'\n')
            print(f'{body} {lens} DPR{dpr}: {result["status"]}',flush=True)
            if code: sys.exit(code)
(out/'browser-serial.json').write_text(json.dumps(rows,indent=2)+'\n')
