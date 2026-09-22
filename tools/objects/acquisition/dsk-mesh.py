"""Pinned source extraction, not terrain synthesis. Requires SpiceyPy 6.0.3/N0067."""
import hashlib
import io
import json
import pathlib
import sys
import zipfile
import numpy as np


def archive_mesh(vertices, plates, recipe, descriptor):
    # Exact floating-point equality only; no epsilon, smoothing, scale or rotation.
    _, first, inverse = np.unique(vertices, axis=0, return_index=True, return_inverse=True)
    order = np.argsort(first)
    old_to_new = np.empty(len(first), dtype=np.uint32)
    old_to_new[order] = np.arange(len(first), dtype=np.uint32)
    mapping = old_to_new[inverse]
    welded = vertices[first[order]]
    faces = mapping[plates - 1]
    if len(welded) != recipe['weldedVertices']:
        raise ValueError('Exact source duplicate count differs')
    if np.any(faces[:, 0] == faces[:, 1]) or np.any(faces[:, 1] == faces[:, 2]) or np.any(faces[:, 0] == faces[:, 2]):
        raise ValueError('DSK contains collapsed triangles')
    if not np.array_equal(welded[mapping], vertices):
        raise ValueError('Welding changed source coordinates')
    mapping_bytes = mapping.astype('<u4').tobytes()
    obj = io.StringIO()
    obj.write('# Exact CSPICE DSK extraction; kilometres; original plate winding.\n')
    for point in welded:
        obj.write('v ' + ' '.join(format(float(value), '.17g') for value in point) + '\n')
    for face in faces:
        obj.write('f ' + ' '.join(str(int(i) + 1) for i in face) + '\n')
    obj_bytes = obj.getvalue().encode('ascii')
    receipt = {
        'schema':'cssearth-dsk-mesh-provenance@1',
        'source':{'bytes':recipe['inputBytes']},
        'toolchain':{'spiceypy':recipe['spiceypyVersion'],'cspice':recipe['cspiceVersion']},
        'descriptor':descriptor,
        'units':'kilometres',
        'transform':'None; exact duplicate XYZ vertices welded in first-occurrence order; original triangle winding retained.',
        'sourceVertices':len(vertices),'sourceFaces':len(plates),'weldedVertices':len(welded),
        'duplicateVertices':len(vertices)-len(welded),
        'mapping':{'member':'source-vertex-to-output-vertex.u32le','indexBase':0,'encoding':'little-endian uint32','entries':len(mapping),'sha256':hashlib.sha256(mapping_bytes).hexdigest()},
        'mesh':{'member':recipe['member'],'bytes':len(obj_bytes),'sha256':hashlib.sha256(obj_bytes).hexdigest()},
        'geometry':{'verticesFloat64LeSha256':hashlib.sha256(welded.astype('<f8').tobytes()).hexdigest(),'facesUint32LeSha256':hashlib.sha256(faces.astype('<u4').tobytes()).hexdigest()},
    }
    output = io.BytesIO()
    with zipfile.ZipFile(output, 'w') as archive:
        for name, data in [(recipe['member'],obj_bytes),('source-vertex-to-output-vertex.u32le',mapping_bytes),('provenance.json',(json.dumps(receipt,sort_keys=True,indent=2)+'\n').encode('utf8'))]:
            info = zipfile.ZipInfo(name, date_time=(1980,1,1,0,0,0))
            info.create_system = 3
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info,data,compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    return output.getvalue(), receipt


def main():
    import spiceypy as spice
    source, recipe_text, output = sys.argv[1:]
    recipe = json.loads(recipe_text)
    if spice.__version__ != recipe['spiceypyVersion'] or spice.tkvrsn('TOOLKIT') != recipe['cspiceVersion']:
        raise ValueError('Install the pinned SpiceyPy/CSPICE conversion toolchain')
    content = pathlib.Path(source).read_bytes()
    if len(content) != recipe['inputBytes']:
        raise ValueError('DSK input identity differs')
    handle = spice.dasopr(source)
    try:
        segment = spice.dlabfs(handle)
        desc = spice.dskgd(handle, segment)
        if (desc.center,desc.frmcde,desc.surfce,desc.dtype,desc.dclass,desc.corsys) != (recipe['targetId'],recipe['frameId'],recipe['surfaceId'],2,1,1):
            raise ValueError('DSK frame, target, type or coordinate system differs')
        if (segment.bwdptr != -1 or segment.fwdptr != -1):
            raise ValueError('Expected one DSK surface segment')
        counts = spice.dskz02(handle,segment)
        if counts != (recipe['sourceVertices'],recipe['sourceFaces']):
            raise ValueError('DSK dimensions differ')
        vertices = spice.dskv02(handle,segment,1,counts[0])
        plates = spice.dskp02(handle,segment,1,counts[1])
        if not np.all(np.isfinite(vertices)) or np.min(plates)<1 or np.max(plates)>len(vertices):
            raise ValueError('Invalid DSK coordinates or connectivity')
        descriptor = {'targetId':int(desc.center),'frameId':int(desc.frmcde),'frameName':spice.frmnam(desc.frmcde),'surfaceId':int(desc.surfce),'type':int(desc.dtype),'dataClass':int(desc.dclass),'coordinateSystem':int(desc.corsys),'longitudeRadians':[desc.co1min,desc.co1max],'latitudeRadians':[desc.co2min,desc.co2max],'radiusKm':[desc.co3min,desc.co3max],'timeSecondsPastJ2000':[desc.start,desc.stop]}
    finally:
        spice.dascls(handle)
    result, receipt = archive_mesh(vertices,plates,recipe,descriptor)
    pathlib.Path(output).write_bytes(result)
    print(json.dumps({'schema':'cssearth-dsk-mesh-conversion@1','bytes':len(result),'sha256':hashlib.sha256(result).hexdigest(),'provenance':receipt},sort_keys=True))

if __name__ == '__main__':
    main()
