#!/usr/bin/env python3
"""Read Charon LEISA with astropy, independently of the TypeScript FITS reader.

The fixture checks native byte order, wavelength/geometry planes, and the
source spectra contributing to cells near Grundy et al.'s published Organa
coordinate (310.9 E, 54.3 N). The recipe supplies declared spectral windows
and spatial averaging policy, never computed pipeline values.
"""
import json, sys
from pathlib import Path
import numpy as np
import astropy
from astropy.io import fits
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fixture import ROOT, write

source = ROOT / 'src/objects/charon/source'
recipe = json.loads((source / 'science/leisa/bands.json').read_text())
inputs, products = [source / 'science/leisa/bands.json'], []

def valid(values):
    return np.isfinite(values) & (np.abs(values) < 1e30)

def position(g, x, y):
    x0, y0 = int(np.floor(x)), int(np.floor(y))
    if x0 < 0 or y0 < 0 or x0+1 >= g.shape[2] or y0+1 >= g.shape[1]:
        return None
    patch = g[:, y0:y0+2, x0:x0+2].astype(np.float64)
    if not valid(patch[1:]).all() or not ((patch[1:3] >= 0).all() and (patch[1] <= recipe['maximumEmission']).all() and (patch[2] <= recipe['maximumIncidence']).all()):
        return None
    lat, lon = np.deg2rad(patch[3]), np.deg2rad(patch[4])
    weights = np.outer([1-(y-y0), y-y0], [1-(x-x0), x-x0])
    v = np.array([(weights*np.cos(lat)*np.cos(lon)).sum(), (weights*np.cos(lat)*np.sin(lon)).sum(), (weights*np.sin(lat)).sum()])
    return np.rad2deg([np.arctan2(v[1],v[0]), np.arctan2(v[2],np.hypot(v[0],v[1]))]).tolist()

for scan in recipe['scans']:
    paths = [source / scan[key] for key in ['cube','wavelengths','geometry']]
    inputs += paths
    cube, waves, geometry = [fits.getdata(path, memmap=True) for path in paths]
    rng = np.random.default_rng(5509 if scan['width'] == 640 else 1308)
    raw = []
    for name, data in zip(['cube','wavelengths','geometry'], [cube,waves,geometry]):
        picks = []
        while len(picks) < 24:
            plane = int(rng.integers(0, 197 if name != 'geometry' else 5))
            index = int(rng.integers(0, scan['width']*scan['height']))
            value = float(data[plane].reshape(-1)[index])
            if valid(value): picks.append({'plane':plane, 'index':index, 'value':value})
        raw.append({'name':name, 'shape':list(data.shape), 'samples':picks,
                    'corner':float(data.reshape(-1)[0]) if valid(data.reshape(-1)[0]) else None})
    maps = []
    for policy in scan['mapBlocks']:
        block, cells = policy['block'], []
        for y in range(0, scan['height']-block, block):
            for x in range(0, scan['width']-block, block):
                p = position(geometry, x+(block-1)/2, y+(block-1)/2)
                if p is None: continue
                lon, lat = p
                delta = (lon-310.9+180)%360-180
                if abs(delta)*np.cos(np.deg2rad(lat)) >= 2 or abs(lat-54.3) >= 2: continue
                if any(position(geometry, cx, cy) is None for cx,cy in [(x-.5,y-.5),(x+block-.5,y-.5),(x+block-.5,y+block-.5),(x-.5,y+block-.5)]): continue
                g = geometry[:,y:y+block,x:x+block]
                if not valid(g[1:]).all() or not ((g[1:3] >= 0).all() and (g[1] <= recipe['maximumEmission']).all() and (g[2] <= recipe['maximumIncidence']).all()): continue
                c = cube[recipe['firstBand']:recipe['lastBand']+1,y:y+block,x:x+block].astype(np.float64)
                w = waves[recipe['firstBand']:recipe['lastBand']+1,y:y+block,x:x+block].astype(np.float64)
                sums = []
                for window in policy['windows']:
                    mask = valid(c) & valid(w) & (w >= window['minimum']) & (w <= window['maximum'])
                    if (mask.sum(axis=0) < window['minimumChannels']).any(): break
                    sums.append([float(c[mask].sum()),float(w[mask].sum()),int(mask.sum())])
                if len(sums) != 3: continue
                left, middle, right = np.array(sums)
                band = middle[0]/middle[2]
                if policy['method'] == 'continuum-ratio':
                    value = (left[0]+right[0])/(left[2]+right[2])/band
                else:
                    intensity = [left[0]/left[2], right[0]/right[2]]
                    wavelength = [left[1]/left[2], right[1]/right[2]]
                    value = 1-band/np.interp(middle[1]/middle[2], wavelength, intensity)
                cells.append({'x':x,'y':y,'longitude':lon,'latitude':lat,'value':float(value),'windows':sums})
        maps.append({'id':policy['id'],'cells':cells})
    # Independent aperture check on native spectra, without selecting by band
    # strength. These are averages of resampled measurements, not uncertainties.
    longitude, latitude = np.deg2rad(geometry[4]), np.deg2rad(geometry[3])
    distance = np.rad2deg(np.arccos(np.clip(np.sin(latitude)*np.sin(np.deg2rad(54.3)) + np.cos(latitude)*np.cos(np.deg2rad(54.3))*np.cos(longitude-np.deg2rad(310.9)), -1, 1)))
    regions = []
    for inner, outer in [(0,2),(2,4),(4,8)]:
        region = valid(geometry[3]) & (distance >= inner) & (distance < outer) & (geometry[1] <= recipe['maximumEmission']) & (geometry[2] <= recipe['maximumIncidence'])
        c = cube[recipe['firstBand']:recipe['lastBand']+1,region].astype(np.float64)
        w = waves[recipe['firstBand']:recipe['lastBand']+1,region].astype(np.float64)
        windows = next(p for p in scan['mapBlocks'] if p['id'] == 'ammonia')['windows']
        masks = [valid(c) & valid(w) & (w >= p['minimum']) & (w <= p['maximum']) for p in windows]
        accepted = np.logical_and.reduce([m.sum(axis=0) >= p['minimumChannels'] for m,p in zip(masks,windows)])
        masks = [m & accepted[None,:] for m in masks]
        sums = [float(c[m].sum()) for m in masks]; counts = [int(m.sum()) for m in masks]
        index = (sums[0]+sums[2])/(counts[0]+counts[2])/(sums[1]/counts[1])
        regions.append({'innerRadiusDegrees':inner,'outerRadiusDegrees':outer,'sourcePixels':int(accepted.sum()),'continuumRatio':index})
    products.append({'id':scan['id'],'raw':raw,'maps':maps,'organaApertures':regions})
write('fits/charon-leisa.json','astropy','tools/oracles/fits/charon-leisa.py',{'astropy':astropy.__version__},inputs,{'products':products})
