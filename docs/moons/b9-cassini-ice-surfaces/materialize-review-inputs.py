#!/usr/bin/env python3
"""Restore only selected historical B9 review inputs from final body packages.

No downloads, mapping, or generated TIFF/receipt copies. Existing equal bytes
are reused; differing files fail without overwriting. C/N originals go under
output/b9-source-intake/<body>/native; raw QUB originals go to the historical
docs/moons/b9-cassini-ice-surfaces/source-review/tethys location. Unselected
Phoebe0650 originals and other historical review dependencies are untouched.
The preferred production reproduction path is reproduce-sources.py.
"""
import hashlib
import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[3]


def digest(path):
    h=hashlib.sha256()
    with Path(path).open('rb') as stream:
        for data in iter(lambda:stream.read(65536),b''):
            h.update(data)
    return h.hexdigest()


def main():
    operations=[]
    for body in ('tethys','iapetus','phoebe'):
        package=ROOT/'src/planets'/body/'source/cassini-ice'
        plan=json.loads((package/'prepare.json').read_text())
        for observation in plan['observations']:
            for key in ('calibrated','navigation','rawOriginal'):
                relative=observation[key]
                source=(package/relative).resolve()
                if not source.is_relative_to(package) or source.suffix not in ('.cub','.qub'):
                    raise ValueError('Unqualified original source path')
                expected=plan['pins'][relative]
                if digest(source)!=expected:
                    raise ValueError('Final original pin differs: '+relative)
                folder=(ROOT/'docs/moons/b9-cassini-ice-surfaces/source-review/tethys' if key=='rawOriginal'
                        else ROOT/'output/b9-source-intake'/body/'native')
                target=folder/source.name
                if target.exists() and (not target.is_file() or digest(target)!=expected):
                    raise ValueError('Historical file differs; refusing overwrite: '+str(target))
                operations.append((source,target,expected))
    rows=[]
    for source,target,expected in operations:
        existed=target.exists()
        if not existed:
            target.parent.mkdir(parents=True,exist_ok=True)
            shutil.copyfile(source,target)
        if digest(target)!=expected:
            raise ValueError('Restored original hash differs')
        rows.append({'source':source.relative_to(ROOT).as_posix(),
                     'destination':target.relative_to(ROOT).as_posix(),
                     'bytes':target.stat().st_size,'sha256':expected,'action':'reused' if existed else 'copied'})
    output=ROOT/'output/b9-source-reproduction/review-inputs.json'
    output.parent.mkdir(parents=True,exist_ok=True)
    output.write_text(json.dumps({'schema':'b9-review-input-materialization@1','status':'PASS',
                                  'generatedFilesCopied':[],'files':rows},indent=2)+'\n')
    print(f'Restored/reused {len(rows)} selected source originals; receipt: {output}')


if __name__=='__main__':
    main()
