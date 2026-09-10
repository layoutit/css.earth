"""Reproduce all compact scalar grids in an empty output directory."""
import hashlib,json,subprocess,sys,tempfile
from pathlib import Path
root=Path.cwd();source=root/'src/planets/moon/source/science/diviner-ghrm'
output=Path(tempfile.mkdtemp(prefix='replay-',dir=root/'output/b10-intake'))
rows=[]
for product in ['tbol_m','tbol_anom','ra_sam']:
    plan=source/f'prepare-{product}.json'
    subprocess.run([sys.executable,'tools/objects/acquisition/diviner-ghrm.py',str(plan),'--output-directory',str(output)],check=True)
    config=json.loads(plan.read_text())
    for name in [config['output'],config['receipt']]:
        with (output/name).open('rb') as f:actual=hashlib.file_digest(f,'sha256').hexdigest()
        with (source/name).open('rb') as f:expected=hashlib.file_digest(f,'sha256').hexdigest()
        assert actual==expected,(name,actual,expected)
        rows.append({'file':name,'sha256':actual,'bytes':(output/name).stat().st_size})
(root/'docs/moons/b10-lunar-thermal/evidence/numeric-replay.json').write_text(json.dumps({'status':'PASS','output':str(output),'files':rows},indent=2)+'\n')
print('PASS: all three compact numeric grids and receipts reproduce exactly')
