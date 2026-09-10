"""Stage pinned B9 sources and body recipes; no numerical preparation or geometry."""
import hashlib
import json
import math
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[3]
REVIEW = ROOT / 'docs/moons/b9-cassini-ice-surfaces/source-review'
CREDIT = 'NASA / Caltech-JPL / University of Arizona / Osuna-CNRS-Nantes Université'
LICENSE = ['https://vims.univ-nantes.fr/about', 'cassini-ice/evidence/license-about.html', 'https://creativecommons.org/licenses/by/4.0/']

def read(path): return json.loads(path.read_text())
def write(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n')
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def copy(old, new):
    new.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(old, new)
def pin(path): return {'expectedBytes': path.stat().st_size, 'expectedSha256': sha(path)}

for body in ['tethys', 'iapetus', 'phoebe']:
    source = ROOT / 'src/planets' / body / 'source'
    out = source / 'cassini-ice'
    trial = ROOT / 'output/b9-source-intake' / body
    plan = read(trial / 'prepare-trial.json')
    manifest = read(source / 'manifest.json')
    manifest['inputs'] = [e for e in manifest['inputs'] if not e['path'].startswith('cassini-ice/')]
    manifest['documents'] = [e for e in manifest['documents'] if not e['path'].startswith('cassini-ice/')]
    acquisition = read(source / 'preparation/acquisition.json')
    acquisition['operations'] = [e for e in acquisition['operations'] if not e.get('path','').startswith('cassini-ice/')]
    receipt_lookup = {e['file']: e for e in read(trial / 'native/download-receipts.json')}
    raw_receipts = {e['file']: e for e in read(REVIEW / 'tethys/download-receipts.json')}
    originals = []
    plan['pins'] = {}
    for entry in plan['observations']:
        for key in ['calibrated', 'navigation', 'rawOriginal']:
            old = trial / entry[key]
            name = old.name
            relative = ('raw/' if key == 'rawOriginal' else 'native/') + name
            copy(old, out / relative)
            entry[key] = relative
            plan['pins'][relative] = sha(out / relative)
            receipt = (raw_receipts if key == 'rawOriginal' else receipt_lookup)[name]
            originals.append({**receipt, 'file': relative})
            source_path = 'cassini-ice/' + relative
            manifest['inputs'].append({
                'id': body+'-cassini-original-'+name.lower().replace('.','-'),
                'path': source_path, **pin(out / relative),
                'origin': receipt['url'], 'credit': CREDIT, 'license': 'CC-BY-4.0',
                'licenseEvidence': LICENSE,
                'acquisition': 'Exact original archive bytes; restore with the shared acquisition plan.',
                'redistribution': 'Retain archive authors and CC BY 4.0 attribution.',
                'consumers': ['cassini-ice-originals']})
            acquisition['operations'].append({'kind':'download','groups':['refresh'],
                'path': source_path, 'url':receipt['url']})
    if body == 'phoebe':
        plan['width'], plan['height'] = 1440, 720
        plan['terrain'] = '../../prepared/terrain.json'
        plan['rotationPath'] = '../preparation/rotation.json'
        for key, name in [('originComparison','source-model-comparison.json')]:
            copy(REVIEW / 'phoebe' / name, out / 'evidence' / name)
            plan[key] = 'evidence/' + name
        for entry in plan['observations']:
            for key, name in [('region','regional-mask.json'),('fitReceipt','native-registration-fit.json')]:
                copy(REVIEW / 'phoebe' / name, out / 'evidence' / name)
                entry[key] = 'evidence/' + name
                plan['pins'][entry[key]] = sha(out / entry[key])
        for key in ['terrain','rotationPath','originComparison']:
            plan['pins'][plan[key]] = sha(out / plan[key])
        registration = ('Coarse regional mapping on the unchanged 3500-face Phoebe mesh. Source pole and origin transfer are explicit. A two-angle fit has seven untouched limb checks with maximum residual 0.704 fast sample. The sampled pointing-sensitivity mask retains 41 native pixels; the second IR1465670650_1 observation is withheld for systematic holdout bias. Nine exposure poses, incidence/emission, closest-hit visibility, self-shadow and radial ambiguity checks constrain output support. Registration uncertainty remains; the source-model translation is fitted, not an author-supplied vector.')
    else:
        registration = ('Native source-camera center reconstruction and independent dense aperture checks qualify physical detector support. A conservative angular inset guards tested between-pose boundary motion. '+
            ('Independent exact USGS image comparisons support gross longitude and latitude framing; precise absolute registration remains unqualified.' if body=='iapetus' else 'Selected Cassini regions use released native navigation. Independent registration to the separate fixed normal-map control is not established; there is no resolved Odysseus-center claim.'))
        plan['registrationEvidence'] = {'file':'evidence/registration.md', 'qualification':registration}
    evidence = out / 'evidence/registration.md'
    evidence.parent.mkdir(parents=True,exist_ok=True)
    evidence.write_text('# Cassini VIMS registration and interpretation\n\n'+registration+'\n\nThe source review and reproducible independent checks are in docs/moons/b9-cassini-ice-surfaces/source-review. The output samples measured detector support only; grid density does not increase native resolution. Original detector saturation, special values and source filtering dependencies are excluded per band. No photometric correction or cross-observation level matching is applied. Color and absorption retain source illumination, filtering and viewing-angle effects. Absorption is a continuum-relative spectral measure, not ice abundance.\n')
    if body != 'phoebe': plan['registrationEvidence']['sha256'] = sha(evidence)
    plan['status'] = 'Qualified regional source mapping under the recorded registration and detector limits; mounted-view qualification is separate.'
    plan['outputs'] = {'depth':body+'-ice-absorption.tif','rgb':body+'-infrared-if.tif','rgbDisplay':body+'-infrared-display.tif'}
    plan['receipt'] = 'preparation-receipt.json'
    write(out / 'prepare.json', plan)
    write(out / 'evidence/download-receipts.json', originals)
    copy(ROOT / 'src/planets/enceladus/source/vims-chemistry/evidence/license-about.html',out / 'evidence/license-about.html')
    # Existing production preparers consume these final names after Python mapping.
    width,height,radius=plan['width'],plan['height'],plan['radiusMeters']
    scale=.5 if body=='phoebe' else .125
    minimum, maximum, labels = {'tethys':(.55,.75,['0.55','0.65','0.75']), 'iapetus':(0,.8,['0','0.4','0.8']), 'phoebe':(.1,.3,['0.1','0.2','0.3'])}[body]
    config=read(source/'preparation/terrestrial.json')
    config['raster']['observations']=[x for x in config['raster']['observations'] if x['id']!='infrared']
    config['raster']['observations'].append({'id':'infrared','textureScale':scale,
        'validity':{'kind':'geotiff-rgb-bands','samples':[0,1,2],'alphaBand':3,'sampleBytes':2,'noData':0,
            'centerLongitude':180,'resolutionMeters':2*math.pi*radius/width,
            'origin':[-math.pi*radius, math.pi*radius/2],
            'grid':{'pixelsPerDegree':width/360,'sampleOffset':width/2-.5,'lineOffset':height/2-.5}}})
    url='https://vims.univ-nantes.fr/cube/'+plan['observations'][0]['id']
    config['raster']['scientific']=[x for x in config['raster']['scientific'] if x['id']!='ice-absorption']
    config['raster']['scientific'].append({'id':'ice-absorption','label':'Ice absorption','format':'geotiff',
        'path':'cassini-ice/'+plan['outputs']['depth'],'consumer':'ice-absorption',
        'title':'Partial Cassini VIMS water-ice signature','description':'Near-2.02 µm water-ice absorption in selected Cassini observations; not ice abundance.',
        'minimum':minimum,'maximum':maximum,'colors':['#312b66','#327caf','#7fcdbb','#edf8b1'],
        'labels':labels,'units':'band-depth fraction','sourceUrl':url,'sampling':'nearest','displaySampling':'nearest','textureScale':scale,
        'grid':{'width':width,'height':height,'centerLongitude':0,'referenceRadiusMeters':radius,'noData':-9999,
                'origin':[-math.pi*radius,math.pi*radius/2],'resolution':[2*math.pi*radius/width,-math.pi*radius/height],'wrapLongitude':True}})
    write(source/'preparation/terrestrial.json',config)
    write(source/'preparation/acquisition.json',acquisition)
    # Manifest is finalized after numerical outputs and authored content are complete.
    write(source/'manifest.json',manifest)
    print(body, len(plan['observations']), 'original groups staged')
