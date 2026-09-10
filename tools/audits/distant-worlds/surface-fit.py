"""Finite radial samples against the adopted analytical models, not a Hausdorff proof."""
import json, math
from pathlib import Path
Path('output/distant-worlds').mkdir(parents=True,exist_ok=True)
bodies=json.loads(Path('tools/objects/source-authoring/distant-worlds/inputs.json').read_text())['bodies']
results=[]
for b in bodies:
    terrain=json.loads(Path(f'src/planets/{b["id"]}/prepared/terrain.json').read_text())
    to_meters=b['radiusKm']*1000/230
    axes=[x*500 for x in b['fullAxesKm']]
    errors=[]
    points=[]
    for f in terrain['faces']:
        v=[[c*to_meters for c in p] for p in f['vertices']]
        samples=v+[[sum(v[j][a] for j in range(3))/3 for a in range(3)]]
        samples += [[(v[j][a]+v[(j+1)%3][a])/2 for a in range(3)] for j in range(3)]
        for p in samples:
            radius=math.sqrt(sum(c*c for c in p))
            factor=math.sqrt(sum((p[a]/axes[a])**2 for a in range(3)))
            errors.append(abs(radius/factor-radius))
        points.extend(v)
    topology=terrain['simplification']['topology']
    assert topology['components']==1 and topology['eulerCharacteristic']==2
    max_error=max(errors)
    results.append(dict(id=b['id'],samples=len(errors),maximumSampledRadialErrorMeters=max_error,
      maximumShareOfModelRadius=max_error/(b['radiusKm']*1000),fullAxesKm=b['fullAxesKm'],
      meshBoundsMeters=[[min(p[a] for p in points),max(p[a] for p in points)] for a in range(3)]))
Path('output/distant-worlds/surface-fit.json').write_text(json.dumps(dict(scope='Vertices, edge midpoints and triangle centroids compared radially with the adopted published/illustrative ellipsoid. This finite sample does not bound all surface distances and is not a Hausdorff proof.',results=results),indent=2)+'\n')
print('Nine adopted ellipsoids: finite radial deviations recorded separately from meshoptimizer error; closed connected topology.')
