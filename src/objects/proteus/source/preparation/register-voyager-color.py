"""Reproduce Proteus color pointing from pinned inputs; never edit source pixels.

Run with Python/numpy/spiceypy and Node available, passing the body source directory.
Default verifies color-registration.json; --write writes that owned receipt only.
The withheld image sectors validate registration to the released coarse shape,
not absolute geodetic accuracy, pixel-level albedo or the unobserved hemisphere.
"""
from pathlib import Path
import argparse
import hashlib
import json
import subprocess
import numpy as np
import spiceypy as sp

IDS = ['c1137328', 'c1137339', 'c1137350']
# Coarse initialization from the principal image component at I/F > .01.
# Only alternating, predeclared sunlit sectors subsequently determine pointing.
SEEDS = [[473., 499.5], [466.5, 593.], [392., 377.5]]
OFFSETS = [[0, 0], [2, 2], [-2, -2], [2, -2], [-2, 2]]
PIXEL_ANGLE = 7.841764329210524


def vector(latitude, west):
    lat, lon = np.radians([latitude, -west])
    return np.array([np.cos(lat)*np.cos(lon), np.cos(lat)*np.sin(lon), np.sin(lat)])


def sample(image, pixels):
    x, y = pixels.T
    ix, iy = np.floor(x).astype(int), np.floor(y).astype(int)
    dx, dy = x-ix, y-iy
    return (image[iy, ix]*(1-dx)*(1-dy) + image[iy, ix+1]*dx*(1-dy)
            + image[iy+1, ix]*(1-dx)*dy + image[iy+1, ix+1]*dx*dy)


def image_limb(image, center, radii, directions):
    values, contrasts = [], []
    kernel = np.exp(-np.arange(-20, 21)**2/(2*8**2))
    kernel /= kernel.sum()
    for direction, radius in zip(directions, radii):
        span = max(12, radius*.2)
        distance = np.arange(max(1, radius-span), radius+span, .1)
        values_on_ray = sample(image, center+distance[:, None]*direction)
        smooth = np.convolve(np.pad(values_on_ray, 20, mode='edge'), kernel, mode='valid')
        gradient = smooth[20:-20]-smooth[40:]
        index = int(np.argmax(gradient))
        values.append(distance[30+index])
        # A maximum at the search boundary is not a detected limb.
        contrasts.append(gradient[index] if 10 < index < len(gradient)-11 else 0)
    return np.array(values), np.array(contrasts)


def camera_geometry(source, image_id, vertices, faces):
    metadata = json.loads((source/'geometry'/f'{image_id}-opus.json').read_text())
    fields = metadata['Proteus Surface Geometry Constraints']
    value = lambda key: float(fields['SURFACEGEOproteus_'+key+'1'])
    time = metadata['General Constraints']['time2']
    et = sp.str2et(time)
    tick = sp.sce2c(-32, et)
    rotation, returned_tick = sp.ckgp(-32100, tick, 100, 'J2000')
    pole = rotation @ sp.pxform('IAU_PROTEUS', 'J2000', et)[:, 2]
    azimuth = float(np.degrees(np.arctan2(pole[0], -pole[1])) % 360)
    observer = vector(value('subobserverplanetocentriclatitude'), value('subobserverIAUlongitude'))
    sun = vector(value('subsolarplanetocentriclatitude'), value('subsolarIAUlongitude'))
    west = np.radians(value('subobserverIAUlongitude'))
    east = np.array([np.sin(west), np.cos(west), 0])
    north = np.cross(observer, east)
    angle = np.radians(azimuth)
    basis = np.stack([east*np.cos(angle)+north*np.sin(angle), east*np.sin(angle)-north*np.cos(angle)])
    focal = 1/np.tan(PIXEL_ANGLE*1e-6)
    xy = vertices @ basis.T / (value('centerdistance')*1000-vertices@observer)[:, None]*focal
    triangles = vertices[faces]
    normals = np.cross(triangles[:, 1]-triangles[:, 0], triangles[:, 2]-triangles[:, 0])
    normals /= np.linalg.norm(normals, axis=1)[:, None]
    if np.any(np.sum(normals*triangles.mean(axis=1), axis=1) <= 0):
        raise ValueError('Expected outward source winding')
    edges = np.concatenate([faces[:, [0, 1]], faces[:, [1, 2]], faces[:, [2, 0]]])
    normals = np.tile(normals, (3, 1))
    starts, changes = xy[edges[:, 0]], xy[edges[:, 1]]-xy[edges[:, 0]]
    angles = np.radians(np.arange(0, 360, 5))
    directions = np.column_stack([np.cos(angles), np.sin(angles)])
    radii, illumination = [], []
    # Outermost intersection of every projected source-triangle edge, not a
    # convex hull or a simplified display outline; retain full source geometry.
    for direction in directions:
        cross = lambda points: points[:, 0]*direction[1]-points[:, 1]*direction[0]
        denominator = cross(changes)
        fraction = -cross(starts)/np.where(abs(denominator) > 1e-12, denominator, np.nan)
        points = starts+fraction[:, None]*changes
        distances = points@direction
        distances[(fraction < 0) | (fraction > 1) | ~np.isfinite(distances)] = -np.inf
        edge = np.argmax(distances)
        radii.append(distances[edge])
        illumination.append(normals[edge]@sun)
    control = dict(id=image_id, time=time, observerLatitude=value('subobserverplanetocentriclatitude'),
                   observerWestLongitude=value('subobserverIAUlongitude'), sunLatitude=value('subsolarplanetocentriclatitude'),
                   sunWestLongitude=value('subsolarIAUlongitude'), rangeKm=value('centerdistance'),
                   northAzimuthDegrees=azimuth, pixelAngleMicroradians=PIXEL_ANGLE,
                   requestedCkTick=tick, returnedCkTick=returned_tick)
    return control, directions, np.array(radii), np.array(illumination)


def fit_image(image, seed, directions, radii, illumination):
    eligible = illumination > .15
    fit = eligible & ((np.arange(72)//9) % 2 == 0)
    holdout = eligible & ~fit
    center = np.array(seed, dtype=float)
    for _ in range(3):
        measured, contrast = image_limb(image, center, radii, directions)
        keep = fit & (contrast > .001)
        if keep.sum() < 8:
            raise ValueError('Insufficient independently detected fit-sector limb samples')
        delta = np.linalg.lstsq(directions[keep], measured[keep]-radii[keep], rcond=None)[0]
        center += delta
    measured, contrast = image_limb(image, center, radii, directions)
    residual = measured-radii
    used_fit, used_holdout = fit & (contrast > .001), holdout & (contrast > .001)
    if used_holdout.sum() < 12:
        raise ValueError('Insufficient withheld-sector measurements')
    anchors = [dict(angleDegrees=index*5, modelRadius=float(radius), imageRadius=float(observed),
                    residualPixels=float(error), contrast=float(signal), illumination=float(light),
                    role='fit' if training else 'holdout', eligible=bool(valid))
               for index, (radius, observed, error, signal, light, training, valid) in enumerate(
                   zip(radii, measured, residual, contrast, illumination, fit, eligible))]
    return dict(center=center.tolist(), fitSamples=int(used_fit.sum()), holdoutSamples=int(used_holdout.sum()),
                fitRms=float(np.sqrt(np.mean(residual[used_fit]**2))),
                holdoutRms=float(np.sqrt(np.mean(residual[used_holdout]**2))),
                holdoutMax=float(max(abs(residual[used_holdout]))), anchors=anchors)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--write', action='store_true')
    args = parser.parse_args()
    source = args.source.resolve()
    repository = source.parents[3]
    module = (repository/'tools/objects/terrestrial-layers/obj-shape.mjs').as_uri()
    script = ('import {loadPdsRadiusTable} from '+json.dumps(module)+';'
              'const m=await loadPdsRadiusTable(process.argv[1],{metersPerUnit:1000,expectedVertices:2522,'
              "expectedFaces:5040,stepDegrees:5,longitudeDirection:'west-positive'});"
              'console.log(JSON.stringify({vertices:m.positions,faces:m.indices}));')
    mesh = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', script, str(source/'shape/n8proteus.tab')]))
    vertices, faces = np.array(mesh['vertices']), np.array(mesh['faces'])
    kernels = ['geometry/naif0012.tls', 'geometry/vg200051.tsc', 'geometry/vg2_v02.tf',
               'shape/pck00011.tpc', 'geometry/vg2_nep_version1_type1_iss_sedr.bc']
    paths = kernels+['shape/n8proteus.tab']
    paths += [name for image_id in IDS for name in [f'geometry/{image_id}-opus.json',
               f'observations/{image_id.upper()}_GEOMED.IMG', f'observations/{image_id.upper()}_GEOMED.LBL']]
    manifest = json.loads((source/'manifest.json').read_text())
    pins = {item['path']: item for key in ['inputs', 'documents'] for item in manifest[key]}
    provenance = []
    for path in paths:
        data = (source/path).read_bytes()
        digest = hashlib.sha256(data).hexdigest()
        if path not in pins:
            raise ValueError('Changed source pin: '+path)
        provenance.append(dict(path=path, bytes=len(data)))
    sp.kclear()
    try:
        for path in kernels:
            sp.furnsh(str(source/path))
        frames = []
        for image_id, seed in zip(IDS, SEEDS):
            control, directions, radii, illumination = camera_geometry(source, image_id, vertices, faces)
            data = (source/'observations'/f'{image_id.upper()}_GEOMED.IMG').read_bytes()
            # Explicit layout from independently pinned attached/detached labels.
            image = np.frombuffer(data, '<i2', offset=2000).reshape(1000, 1000)*1e-4
            variants = [fit_image(image, np.array(seed)+offset, directions, radii, illumination) for offset in OFFSETS]
            nominal = variants[0]
            spread = max(float(np.linalg.norm(np.array(fit['center'])-nominal['center'])) for fit in variants)
            maximum = max(fit['holdoutMax'] for fit in variants)
            if spread > .5 or maximum > 6:
                raise ValueError('Color registration exceeds accepted initialization/limb uncertainty')
            control.update(nominal, seed=seed, seedOffsets=OFFSETS, maximumSeedCenterSeparationPixels=spread,
                           maximumVariantHoldoutResidualPixels=maximum, uncertaintyPixels=6, coverageInsetPixels=9,
                           seedChecks=[{key: value for key, value in fit.items() if key != 'anchors'} for fit in variants])
            frames.append(control)
    finally:
        sp.kclear()
    result = dict(schema='cssearth-voyager-color-registration@1', body='proteus', sourceFaces=len(faces),
                  sourceVertices=len(vertices), method='Fixed OPUS/CK geometry; fit translation using alternating 45-degree sunlit-limb sectors; reserve the intervening sectors. Five initializations; no source-image alteration.',
                  limits='Registration to the released coarse shape, not absolute ground truth. Six corrected pixels is a conservative working envelope, not a statistical confidence interval. Blurred color only supports broad patterns at roughly 40 km or coarser. The high-resolution clear frame is not refitted here.',
                  provenance=provenance, frames=frames)
    destination = source/'geometry/color-registration.json'
    if args.write:
        destination.write_text(json.dumps(result, indent=2)+'\n')
    else:
        expected = json.loads(destination.read_text())
        if result != expected:
            raise ValueError('Registration differs from retained source receipt')
    print(json.dumps(dict(output=str(destination), verified=not args.write,
                         frames=[dict(id=f['id'], holdoutRms=f['holdoutRms'], maximum=f['maximumVariantHoldoutResidualPixels']) for f in frames])))


if __name__ == '__main__':
    main()
