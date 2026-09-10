"""Retain original captures and prove reusable rendering bytes after doc integration."""
import hashlib,json,subprocess
from pathlib import Path
root=Path.cwd();out=root/'docs/moons/b10-lunar-thermal/evidence';out.mkdir(exist_ok=True)
def sha(p):
    with p.open('rb') as f:return hashlib.file_digest(f,'sha256').hexdigest()
def retain(file):
    original=root/file['path'];assert sha(original)==file['sha256']
    folder=out/('styles' if original.suffix=='.css' else 'screenshots');folder.mkdir(exist_ok=True)
    target=folder/(file['sha256']+original.suffix)
    if not target.exists():target.write_bytes(original.read_bytes())
    return str(target.relative_to(out))
chosen={}
for path in sorted((root/'output/playwright/b10-surfaces').glob('integrated-*/report.json')):
    r=json.loads(path.read_text())
    if r['startedAt']<'2026-09-10T02:11' or r['status']!='CAPTURED_UNREVIEWED':continue
    assert r['shutdown']['browserClose']=='COMPLETE'
    for case in r['cases']:
        for view in case['views']:
            key=(r['viewport']['width'],r['dprs'][0],view['lensId']);chosen[key]=(path,r,case,view)
assert len(chosen)==8,chosen.keys()
# Only documentation/provenance changed after these earlier views. Assert every
# rendering/interaction record and every shared captured source stays exact.
render_files=['prepared/runtime.json','prepared/controls.json','prepared/lenses.json','prepared/scene.json','prepared/page.json','runtime-assets.json']
render=[]
for name in render_files:
    p=root/'src/planets/moon'/name
    before=subprocess.check_output(['git','show','ff9b389a0:src/planets/moon/'+name])
    assert before==p.read_bytes(),name
    render.append({'path':str(p.relative_to(root)),'sha256':sha(p)})
reports=out/'reports';reports.mkdir(exist_ok=True);items=[]
for (width,dpr,lens),(path,r,case,view) in sorted(chosen.items()):
    for f in r['sharedFiles']:assert sha(root/f['path'])==f['sha256'],f['path']
    for f in r['frozenFiles']:
        if f['path'].startswith('public/scenes/moon/'):assert sha(root/f['path'])==f['sha256']
    assert sha(root/r['script']['path'])==r['script']['sha256']
    name=f'{width}px-dpr{dpr}-{lens}.json';(reports/name).write_bytes(path.read_bytes())
    styles=[retain(f) for f in r['styleArtifacts']]
    images=[{'original':f['path'],'retained':retain(f),'sha256':f['sha256']} for f in view['screenshots'] if f['path'].endswith(('-scene.png','-close-zoom.png','-mobile-globe.png'))]
    items.append({'lens':lens,'width':width,'dpr':dpr,'report':'reports/'+name,'screenshots':images,'styles':styles,'selectorLabels':view['selectorLabels']})
result={'status':'RENDERING_BYTES_MATCH_CURRENT_INTEGRATION','head':subprocess.check_output(['git','rev-parse','HEAD']).decode().strip(),'earlierImplementation':'ff9b389a0','renderingRecords':render,'reasonForReuse':'The main integration renames SOURCE.md to README.md and updates provenance pins. All six runtime/rendering records, 51 captured shared source files and every Moon image remain byte-identical. Fresh desktop/mobile captures also exercise the integrated prepared-object transport.','cases':items}
used={x['retained'] for row in items for x in row['screenshots']}
for image in (out/'screenshots').glob('*.png'):
    if str(image.relative_to(out)) not in used:image.unlink()
(out/'browser-index.json').write_text(json.dumps(result,indent=2)+'\n')
for label in ['b10-main-package-closure-final','b10-integrated-desktop','b10-integrated-mobile','b10-main-prepare-final','b10-main-finalize']:
    for ext in ['json','log']:
        source=root/'output/b3-resume'/f'{label}.{ext}'
        if source.exists():(out/'checks'/source.name).write_bytes(source.read_bytes())
(out/'packages-integrated.json').write_bytes((root/'output/b10-qualification/packages.json').read_bytes())
print('Retained',len(items),'browser cases;',sum(p.stat().st_size for p in out.rglob('*') if p.is_file()),'evidence bytes')
