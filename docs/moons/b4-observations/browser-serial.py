"""One body at a time; render its real route, close Astro, then inspect each chart."""
import json,os,pathlib,subprocess,sys
ids='himalia epimetheus telesto pandora ymir albiorix siarnaq methone pallene'.split()
assert len(sys.argv)==2 and sys.argv[1] in ids,'Select exactly one B4 body.'
id=sys.argv[1]
monitor='docs/moons/b3-preparation/final/resource-tools/run-bounded.py'
def run(label,limit,*args):
 env=os.environ.copy();env['B3_RSS_LIMIT_BYTES']=str(limit)
 subprocess.run([sys.executable,monitor,label,'node',*args],env=env,check=True)
run(f'b4-panel-{id}',2684354560,'docs/moons/b4-observations/prepare-panel.mjs',id)
for c in json.loads(pathlib.Path(f'src/planets/{id}/prepared/content.json').read_text())['charts']:
 for dpr in [1,2]:run(f'b4-{id}-{c["id"]}-dpr{dpr}',1610612736,'docs/moons/b4-observations/browser-one.mjs',id,c['id'],str(dpr))
