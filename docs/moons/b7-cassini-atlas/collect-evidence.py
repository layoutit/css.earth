"""Copy completed browser receipts and original screenshots; never alter pixels."""
from pathlib import Path
import hashlib,json,re,shutil,os

ROOT=Path(__file__).resolve().parents[3]
DEST=ROOT/'docs/moons/b7-cassini-atlas/evidence'
LENSES={'titan':['geology'],'dione':['infrared','ice-absorption'],'rhea':['infrared','ice-absorption']}
LABELS=['b7-titan-browser-dpr1','b7-titan-browser-dpr2',
        'b7-dione-browser-final-dpr1','b7-dione-browser-final-dpr2',
        'b7-rhea-browser-final-dpr1','b7-rhea-browser-final-dpr2']
if os.environ.get('B7_INTEGRATED')=='1':
    DEST=DEST/'integration'
    LABELS=[f'b7-integrated-{body}-dpr{dpr}' for body in LENSES for dpr in [1,2]]
index={'status':'CAPTURED_FOR_VISUAL_REVIEW','files':[],'cases':[]}
def digest(path):
    with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
def read(path):return json.loads(path.read_text())
def copy(source,target):
    destination=DEST/target;destination.parent.mkdir(parents=True,exist_ok=True)
    shutil.copyfile(source,destination)
    assert digest(source)==digest(destination)
    index['files'].append(dict(source=str(source.relative_to(ROOT)),path=target,
                              bytes=destination.stat().st_size,sha256=digest(destination)))
for label in LABELS:
    receipt=ROOT/f'output/b3-resume/{label}.json'
    assert read(receipt)['status']=='PASS',label
    log=(ROOT/f'output/b3-resume/{label}.log').read_text()
    report_path=Path(re.findall(r'^(/.*?/report\.json)$',log,re.M)[-1])
    report=read(report_path)
    assert report['status']=='CAPTURED_UNREVIEWED'
    assert report['shutdown']['browserClose']=='COMPLETE'
    for entry in report['frozenFiles']:
        assert digest(ROOT/entry['path'])==entry['sha256'],entry['path']
    copy(report_path,f'browser/{label}.json')
    copy(receipt,f'checks/{label}.json')
    for case in report['cases']:
        assert not case['errors']
        row=dict(id=case['id'],dpr=case['dpr'],browser=report['browserVersion'],views=[])
        for view in case['views']:
            before=view['beforeDrag']
            assert before['ownerSame'] and before['retainedStable'] and before['ready']
            if 'drag' in view:assert view['drag']['allNodesRetained'] and view['drag']['ownerSame']
            row['views'].append(dict(lens=view['lensId'],shadows=view['shadows'],
                surfaceLeaves=before['surfacePaint']['leaves'],dragChecked='drag' in view))
            if view['lensId'] not in LENSES[case['id']]:continue
            for shot in view['screenshots']:
                # Keep the complete visible scene and interpretation, in both states.
                if not shot['path'].endswith('-scene.png'):continue
                assert digest(ROOT/shot['path'])==shot['sha256']
                name=f"{case['id']}-dpr{case['dpr']}-{Path(shot['path']).name}"
                copy(ROOT/shot['path'],'screenshots/'+name)
        index['cases'].append(row)
    for style in report['styleArtifacts']:
        destination='styles/'+Path(style['path']).name
        if not any(entry['path']==destination for entry in index['files']):copy(ROOT/style['path'],destination)
(DEST/'browser-index.json').write_text(json.dumps(index,indent=2)+'\n')
print(json.dumps(dict(cases=len(index['cases']),views=sum(len(c['views']) for c in index['cases']),
                     files=len(index['files']),bytes=sum(f['bytes'] for f in index['files']))))
