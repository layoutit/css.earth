"""Bounded, stdlib-only reconstruction of pinned Nantes/ISIS VIMS navigation.

Coordinates are native body-frame kilometers; longitude is east-positive and
latitude planetocentric. This module creates no scene geometry or raster and
never forms coverage cells between detector samples/scan lines.

Center timing/look equations follow ISIS 3.5.0 VimsGroundMap, lines 134-195,
224-227 and 523-534 (including integer division in the HI-RES swath offset):
https://isis.astrogeology.usgs.gov/3.5.0/Object/Programmer/_vims_ground_map_8cpp_source.html
Cached Hermite observer and quaternion rotations follow the independently
checked Iapetus detector-ray reconstruction in the B9 source evidence.

Sampling pitch is NOT instantaneous aperture. RC19 describes NORMAL as two
0.25 x 0.5 mrad half-exposures separated by a 0.25 mrad fast-axis step; HI-RES
uses that narrow aperture throughout. Footprints therefore require an explicit
nominal-aperture policy; the default returns no mapped support. Returned
frusta describe sampled temporal support, not a continuously integrated PSF.
https://pds-rings.seti.org/pds4/bundles/cassini_vims/cassini_vims_cruise/document/vims-wavelength-and-radiometric-calibration-report.pdf

The caller owns full C/N file pins and independent alignment qualification.
Labels/table byte hashes are returned to bind this module's exact inputs.
"""
import bisect
import hashlib
import math
from pathlib import Path
import re
import struct


LABEL_BYTES = 65536
VALID_MIN = struct.unpack('<f', struct.pack('<I', 0xff7ffffa))[0]
NAV_NAMES = ('Phase Angle', 'Emission Angle', 'Incidence Angle',
             'Latitude', 'Longitude', 'Pixel Resolution')
# These are the selected source frames/ellipsoids, not display-shape definitions.
QUALIFIED_NATIVE_FRAMES = {
    'IAPETUS': (608, 10046, (747.4, 747.4, 712.4)),
    'TETHYS': (603, 10041, (540.4, 531.1, 527.5)),
    # Source-camera coordinates only: never admitted to ellipsoid map support.
    'PHOEBE': (609, 10047, (115., 110., 105.)),
}
APERTURE_POLICY = 'rc19-nominal-aperture-unknown-step-order@1'
APERTURE_SOURCE = ('https://pds-rings.seti.org/pds4/bundles/cassini_vims/'
                   'cassini_vims_cruise/document/'
                   'vims-wavelength-and-radiometric-calibration-report.pdf')


def dot(a, b):
    return sum(x * y for x, y in zip(a, b))


def sub(a, b):
    return tuple(x - y for x, y in zip(a, b))


def unit(vector):
    norm = math.hypot(*vector)
    if not math.isfinite(norm) or norm == 0:
        raise ValueError('Invalid direction or quaternion')
    return tuple(x / norm for x in vector)


def mv(matrix, vector):
    return tuple(dot(row, vector) for row in matrix)


def transpose(matrix):
    return tuple(zip(*matrix))


def angular_distance(a, b):
    a, b = unit(a), unit(b)
    cross = (a[1]*b[2] - a[2]*b[1], a[2]*b[0] - a[0]*b[2],
             a[0]*b[1] - a[1]*b[0])
    return math.atan2(math.hypot(*cross), dot(a, b))


def quaternion_matrix(quaternion):
    w, x, y, z = unit(quaternion)
    return ((1-2*(y*y+z*z), 2*(x*y-w*z), 2*(x*z+w*y)),
            (2*(x*y+w*z), 1-2*(x*x+z*z), 2*(y*z-w*x)),
            (2*(x*z-w*y), 2*(y*z+w*x), 1-2*(x*x+y*y)))


def _bracket(rows, times, et):
    if not math.isfinite(et) or not times[0] <= et <= times[-1]:
        raise ValueError('ET outside cached navigation; extrapolation forbidden')
    index = min(len(rows)-2, max(0, bisect.bisect_right(times, et)-1))
    return rows[index], rows[index+1]


def interpolate_rotation(table, et):
    a, b = _bracket(table['rows'], table['times'], et)
    fraction = (et-a[-1]) / (b[-1]-a[-1])
    p, q = unit(a[:4]), unit(b[:4])
    cosine = dot(p, q)
    if cosine < 0:
        q, cosine = tuple(-x for x in q), -cosine
    if cosine > 1-1e-12:
        return quaternion_matrix(tuple((1-fraction)*x + fraction*y for x, y in zip(p, q)))
    omega = math.acos(min(1, max(-1, cosine)))
    return quaternion_matrix(tuple((math.sin((1-fraction)*omega)*x
                                    + math.sin(fraction*omega)*y) / math.sin(omega)
                                   for x, y in zip(p, q)))


def interpolate_position(table, et):
    a, b = _bracket(table['rows'], table['times'], et)
    dt = b[-1]-a[-1]
    u = (et-a[-1])/dt
    h = (2*u**3-3*u*u+1, u**3-2*u*u+u, -2*u**3+3*u*u, u**3-u*u)
    return tuple(h[0]*a[k] + h[1]*dt*a[k+3] + h[2]*b[k] + h[3]*dt*b[k+3]
                 for k in range(3))


def ellipsoid_point(latitude_degrees, longitude_degrees, radii_km):
    latitude, longitude = math.radians(latitude_degrees), math.radians(longitude_degrees)
    direction = (math.cos(latitude)*math.cos(longitude),
                 math.cos(latitude)*math.sin(longitude), math.sin(latitude))
    radius = 1/math.sqrt(sum((x/a)**2 for x, a in zip(direction, radii_km)))
    return tuple(radius*x for x in direction)


def intersect_ellipsoid(observer, ray, radii_km):
    """Nearest strictly positive analytical ray hit; no far-side replacement."""
    if (len(observer) != 3 or len(ray) != 3 or len(radii_km) != 3
            or not all(math.isfinite(x) for x in (*observer, *ray, *radii_km))
            or min(radii_km) <= 0):
        raise ValueError('Invalid ellipsoid ray')
    a = sum((d/r)**2 for d, r in zip(ray, radii_km))
    b = 2*sum(o*d/(r*r) for o, d, r in zip(observer, ray, radii_km))
    c = sum((o/r)**2 for o, r in zip(observer, radii_km))-1
    if a == 0 or c <= 0:  # spacecraft must be outside the source ellipsoid
        return None
    discriminant = b*b-4*a*c
    if discriminant < 0:
        return None
    q = -.5*(b+math.copysign(math.sqrt(discriminant), b))
    roots = (q/a, c/q) if q != 0 else (-b/(2*a),)
    positive = [distance for distance in roots if distance > 0]
    if not positive:
        return None
    distance = min(positive)
    return tuple(o+distance*d for o, d in zip(observer, ray))


def longitude_latitude(point):
    return (math.degrees(math.atan2(point[1], point[0])) % 360,
            math.degrees(math.atan2(point[2], math.hypot(point[0], point[1]))))


def _field(label, name):
    match = re.search(r'^\s*'+re.escape(name)+r'\s*=\s*([^\n]+)', label, re.M)
    if match is None:
        raise ValueError('Missing ISIS field: '+name)
    return match.group(1).strip().strip('"')


def _array(label, name):
    match = re.search(r'\b'+re.escape(name)+r'\s*=\s*\((.*?)\)', label, re.S)
    if match is None:
        raise ValueError('Missing ISIS array: '+name)
    return tuple(part.strip().strip('"') for part in match.group(1).split(','))


def _label(path, expected_bands, target, channel):
    with Path(path).open('rb') as stream:
        raw = stream.read(LABEL_BYTES)
    if len(raw) != LABEL_BYTES:
        raise ValueError('Truncated ISIS label')
    text = raw.decode('ascii', errors='strict').rstrip('\x00')
    core = text[:text.index('Group = Instrument')]
    width, height = int(_field(core, 'Samples')), int(_field(core, 'Lines'))
    if (not 1 <= width <= 64 or not 1 <= height <= 64
            or _field(core, 'Format') != 'Tile' or _field(core, 'Type') != 'Real'
            or _field(core, 'ByteOrder') != 'Lsb'
            or int(_field(core, 'StartByte')) != LABEL_BYTES+1
            or int(_field(core, 'Bands')) != expected_bands
            or int(_field(core, 'TileSamples')) != width
            or int(_field(core, 'TileLines')) != height
            or float(_field(core, 'Base')) != 0 or float(_field(core, 'Multiplier')) != 1
            or _field(text, 'TargetName') != target
            or _field(text, 'SpacecraftName') != 'Cassini-Huygens'
            or _field(text, 'InstrumentId') != 'VIMS' or _field(text, 'Channel') != channel
            or _field(text, 'CameraVersion') != '1' or _field(text, 'ShapeModel') != 'Null'
            or _field(text, 'InstrumentModeId') != 'IMAGE'
            or _field(text, 'SpectralSummingFlag') != 'OFF'
            or _field(text, 'SpectralEditingFlag') != 'OFF'
            or int(_field(text, 'SwathWidth')) != width
            or int(_field(text, 'SwathLength')) != height):
        raise ValueError('Unsupported native VIMS camera/layout')
    if Path(path).stat().st_size < LABEL_BYTES+width*height*expected_bands*4:
        raise ValueError('Truncated native VIMS core')
    return text, width, height, hashlib.sha256(raw).hexdigest()


def _tables(path, label, core_end):
    required = {
        'InstrumentPointing': ('J2000Q0', 'J2000Q1', 'J2000Q2', 'J2000Q3', 'AV1', 'AV2', 'AV3', 'ET'),
        'BodyRotation': ('J2000Q0', 'J2000Q1', 'J2000Q2', 'J2000Q3', 'AV1', 'AV2', 'AV3', 'ET'),
        'InstrumentPosition': ('J2000X', 'J2000Y', 'J2000Z', 'J2000XV', 'J2000YV', 'J2000ZV', 'ET'),
    }
    result, extents = {}, []
    file_size = Path(path).stat().st_size
    with Path(path).open('rb') as stream:
        for text in re.findall(r'Object\s*=\s*Table\s*\n(.*?)End_Object', label, re.S):
            name = _field(text, 'Name')
            if name not in required:
                continue
            fields = re.findall(r'Group\s*=\s*Field\s*\n(.*?)End_Group', text, re.S)
            names = tuple(_field(field, 'Name') for field in fields)
            count, size = int(_field(text, 'Records')), int(_field(text, 'Bytes'))
            start = int(_field(text, 'StartByte'))-1
            if (name in result or names != required[name] or not 2 <= count <= 65536
                    or _field(text, 'ByteOrder') != 'Lsb'
                    or any(_field(field, 'Type') != 'Double' or _field(field, 'Size') != '1' for field in fields)
                    or size != count*len(names)*8 or start < core_end or start+size > file_size
                    or any(start < end and first < start+size for first, end in extents)):
                raise ValueError('Unsupported cached navigation table: '+name)
            stream.seek(start)
            raw = stream.read(size)
            if len(raw) != size:
                raise ValueError('Truncated navigation table')
            rows = tuple(struct.iter_unpack('<'+'d'*len(names), raw))
            times = tuple(row[-1] for row in rows)
            if (not all(math.isfinite(x) for row in rows for x in row)
                    or any(a >= b for a, b in zip(times, times[1:]))):
                raise ValueError('Invalid navigation values/time ordering')
            if name != 'InstrumentPosition' and any(abs(math.hypot(*row[:4])-1) > 1e-6 for row in rows):
                raise ValueError('Nonunit cached quaternion')
            result[name] = {'rows': rows, 'times': times, 'label': text,
                            'sha256': hashlib.sha256(raw).hexdigest(), 'bytes': size}
            extents.append((start, start+size))
    if set(result) != set(required):
        raise ValueError('Missing required cached navigation table')
    if _field(result['InstrumentPosition']['label'], 'CacheType') != 'HermiteSpline':
        raise ValueError('Only qualified Hermite observer interpolation is supported')
    return result


def sampling_model(mode, xoffset, yoffset, width, *, height=None, channel='IR'):
    """ISIS center step/bore parameters only; these do not define physical IFOV."""
    if channel == 'VIS':
        if mode == 'NORMAL':
            return (.00051, .00051, 31., 31., xoffset-1, yoffset-1)
        if mode == 'HI-RES' and type(height) is int and height > 0:
            return (.00051/3, .00051/3, 94., 94.,
                    3*(xoffset+width//2)-width//2, 3*(yoffset+height//2)-height//2)
        raise ValueError('Unsupported VIS sampling mode/dimensions')
    if channel != 'IR':
        raise ValueError('Unsupported channel')
    if mode == 'NORMAL':
        return (.000495, .000495, 31., 31., xoffset-1, yoffset-1)
    if mode == 'HI-RES':
        return (.000495/2, .000495, 62.5, 31.,
                2*((xoffset-1)+((width-1)//4)), yoffset-1)
    raise ValueError('Unsupported IR sampling mode')


class Camera:
    @classmethod
    def from_pair(cls, calibrated_path, navigation_path, *, expected_target,
                  expected_radii_km, expected_frame_id, expected_channel='IR', ray_only=False):
        if expected_target not in QUALIFIED_NATIVE_FRAMES or (expected_target == 'PHOEBE' and not ray_only):
            raise ValueError('Unqualified native frame; Phoebe mapping is not admitted')
        if expected_channel not in ('IR', 'VIS') or (expected_channel == 'VIS' and not ray_only):
            raise ValueError('VIS is available only for explicit camera-ray diagnostics')
        body_id, frame_id, radii = QUALIFIED_NATIVE_FRAMES[expected_target]
        if tuple(expected_radii_km) != radii or expected_frame_id != frame_id:
            raise ValueError('Unqualified source ellipsoid/frame expectation')
        c, width, height, c_hash = _label(calibrated_path, 256 if expected_channel == 'IR' else 96, expected_target, expected_channel)
        n, n_width, n_height, n_hash = _label(navigation_path, 6, expected_target, expected_channel)
        if (width, height) != (n_width, n_height) or _array(n, 'Name') != NAV_NAMES:
            raise ValueError('C/N dimensions or navigation planes differ')
        keys = ('ProductId', 'NativeStartTime', 'NativeStopTime', 'StartTime', 'StopTime',
                'SamplingMode', 'XOffset', 'ZOffset', 'SwathWidth', 'SwathLength',
                'InterlineDelayDuration', 'NaifFrameCode', 'BODY_FRAME_CODE')
        if any(_field(c, key) != _field(n, key) for key in keys):
            raise ValueError('C/N identity, timing or frame mismatch')
        if _array(c, 'ExposureDuration') != _array(n, 'ExposureDuration'):
            raise ValueError('C/N exposure mismatch')
        for label in (c, n):
            if (int(_field(label, 'BODY_FRAME_CODE')) != frame_id
                    or int(_field(label, 'NaifFrameCode')) != (-82371 if expected_channel == 'IR' else -82370)
                    or tuple(float(x) for x in _array(label, f'BODY{body_id}_RADII')) != radii):
                raise ValueError('Unexpected native body frame/radii')
        camera = cls()
        camera.width, camera.height = width, height
        camera.channel, camera.ray_only = expected_channel, bool(ray_only)
        camera.target, camera.frame_id, camera.radii_km = expected_target, frame_id, radii
        camera.product_id, camera.mode = _field(c, 'ProductId'), _field(c, 'SamplingMode')
        camera.model = sampling_model(camera.mode, int(_field(c, 'XOffset')), int(_field(c, 'ZOffset')), width,
                                      height=height, channel=expected_channel)
        number, fraction = _field(n, 'NativeStartTime').split('.')
        if not number.isdigit() or not fraction.isdigit():
            raise ValueError('Unsupported spacecraft clock encoding')
        clock_key = 'CLOCK_ET_-82_'+number+'_COMPUTED'
        if _field(c, clock_key) != _field(n, clock_key):
            raise ValueError('C/N cached clock differs')
        clock = bytes.fromhex(_field(n, clock_key))
        if len(clock) != 8:
            raise ValueError('Unsupported cached clock bytes')
        camera.start_et = struct.unpack('<d', clock)[0]+int(fraction)/15959
        exposure, vis_exposure = _array(n, 'ExposureDuration')
        if not exposure.endswith('<IR>') or not vis_exposure.endswith('<VIS>'):
            raise ValueError('Unidentified exposure channel')
        camera.ir_exposure_seconds = float(exposure.split()[0])*.001*1.01725
        camera.exposure_seconds = (camera.ir_exposure_seconds if expected_channel == 'IR'
                                   else float(vis_exposure.split()[0])*.001)
        camera.interline_delay_seconds = float(_field(n, 'InterlineDelayDuration'))*.001*1.01725
        if (not all(math.isfinite(x) for x in (camera.start_et, camera.exposure_seconds, camera.ir_exposure_seconds, camera.interline_delay_seconds))
                or camera.exposure_seconds <= 0 or camera.ir_exposure_seconds <= 0 or camera.interline_delay_seconds < 0):
            raise ValueError('Invalid source timing')
        camera.tables = _tables(navigation_path, n, LABEL_BYTES+width*height*6*4)
        pointing, body = camera.tables['InstrumentPointing']['label'], camera.tables['BodyRotation']['label']
        if (_array(pointing, 'TimeDependentFrames') != ('-82000', '1')
                or _array(pointing, 'ConstantFrames') != (str(-82371 if expected_channel == 'IR' else -82370), '-82000')
                or _array(body, 'TimeDependentFrames') != (str(frame_id), '1')):
            raise ValueError('Unexpected quaternion frame chain')
        constant = tuple(float(x) for x in _array(pointing, 'ConstantRotation'))
        if len(constant) != 9 or not all(math.isfinite(x) for x in constant):
            raise ValueError('Invalid constant camera rotation')
        camera.constant = tuple(constant[i:i+3] for i in (0, 3, 6))
        if any(abs(dot(a, b)-(i == j)) > 1e-8
               for i, a in enumerate(camera.constant) for j, b in enumerate(camera.constant)):
            raise ValueError('Nonorthogonal constant camera rotation')
        with Path(navigation_path).open('rb') as stream:
            stream.seek(LABEL_BYTES)
            raw = stream.read(width*height*6*4)
        if len(raw) != width*height*6*4:
            raise ValueError('Truncated native navigation planes')
        values = struct.unpack('<'+'f'*(width*height*6), raw)
        camera.navigation = {band+1: values[band*width*height:(band+1)*width*height] for band in range(6)}
        camera.input_evidence = {'calibratedLabelSha256': c_hash, 'navigationLabelSha256': n_hash,
                                 'navigationPlanesSha256': hashlib.sha256(raw).hexdigest(),
                                 'tables': {name: {'sha256': table['sha256'], 'bytes': table['bytes']}
                                            for name, table in camera.tables.items()}}
        return camera

    def _pixel(self, x, y):
        if type(x) is not int or type(y) is not int or not 0 <= x < self.width or not 0 <= y < self.height:
            raise ValueError('Native zero-based pixel required')

    def pixel_time(self, x, y, exposure_fraction=.5):
        self._pixel(x, y)
        if not math.isfinite(exposure_fraction) or not 0 <= exposure_fraction <= 1:
            raise ValueError('Time must stay within this pixel exposure')
        if self.channel == 'VIS':
            return (self.start_et+(self.ir_exposure_seconds*self.width-self.exposure_seconds)/2
                    +(y+exposure_fraction)*self.exposure_seconds)
        return (self.start_et+y*(self.width*self.exposure_seconds+self.interline_delay_seconds)
                +(x+exposure_fraction)*self.exposure_seconds)

    def state(self, et):
        body = interpolate_rotation(self.tables['BodyRotation'], et)
        pointing = interpolate_rotation(self.tables['InstrumentPointing'], et)
        observer = mv(body, interpolate_position(self.tables['InstrumentPosition'], et))
        return body, pointing, observer

    def look_direction(self, x, y, offset_radians=(0., 0.)):
        self._pixel(x, y)
        if len(offset_radians) != 2 or not all(math.isfinite(x) for x in offset_radians):
            raise ValueError('Invalid angular offset')
        pitch_x, pitch_y, bore_x, bore_y, offset_x, offset_y = self.model
        theta = math.pi/2-(y+offset_y-bore_y)*pitch_y-offset_radians[1]
        phi = -math.pi/2+(x+offset_x-bore_x)*pitch_x+offset_radians[0]
        return (math.sin(theta)*math.cos(phi), math.cos(theta), -math.sin(theta)*math.sin(phi))

    def ray(self, x, y, et, offset_radians=(0., 0.), state=None):
        body, pointing, observer = state if state is not None else self.state(et)
        instrument = self.look_direction(x, y, offset_radians)
        ray = unit(mv(body, mv(transpose(pointing), mv(transpose(self.constant), instrument))))
        return observer, ray

    def hit(self, x, y, et, offset_radians=(0., 0.)):
        observer, ray = self.ray(x, y, et, offset_radians)
        return intersect_ellipsoid(observer, ray, self.radii_km), observer, ray

    def center_residual(self, x, y):
        self._pixel(x, y)
        index = y*self.width+x
        values = tuple(self.navigation[band][index] for band in range(1, 7))
        if (not all(math.isfinite(v) and v >= VALID_MIN for v in values)
                or not -90 <= values[3] <= 90 or not 0 <= values[4] <= 360 or values[5] <= 0):
            return None
        try:
            point, observer, ray = self.hit(x, y, self.pixel_time(x, y))
        except ValueError:
            return None
        if point is None:
            return None
        expected = ellipsoid_point(values[3], values[4], self.radii_km)
        look_error = angular_distance(ray, sub(expected, observer))
        return {'lookAngularErrorRadians': look_error,
                'lookErrorPixels': look_error/min(self.model[:2]),
                'groundAngularErrorDegrees': math.degrees(angular_distance(point, expected)),
                'calculatedLongitudeLatitude': longitude_latitude(point),
                'nativeLongitudeLatitude': (values[4], values[3])}

    def exposure_motion(self, x, y):
        """Five source poses; reported maxima are sampled, not continuous bounds."""
        poses = []
        for fraction in (0., .25, .5, .75, 1.):
            et = self.pixel_time(x, y, fraction)
            body, pointing, observer = self.state(et)
            ray = self.ray(x, y, et, state=(body, pointing, observer))[1]
            hit = intersect_ellipsoid(observer, ray, self.radii_km)
            poses.append({'exposureFraction': fraction, 'et': et,
                          'observerKilometers': observer, 'fixedMirrorCenterUnitRay': ray,
                          'fixedMirrorCenterHitKilometers': hit,
                          'bodyRotation': body, 'instrumentPointing': pointing})
        pairs = [(a, b) for index, a in enumerate(poses) for b in poses[index+1:]]
        ground = [math.dist(a['fixedMirrorCenterHitKilometers'], b['fixedMirrorCenterHitKilometers'])*1000
                  for a, b in pairs if a['fixedMirrorCenterHitKilometers'] is not None
                  and b['fixedMirrorCenterHitKilometers'] is not None]
        return {'poses': poses,
                'maximumObserverDisplacementMeters': max(math.dist(a['observerKilometers'], b['observerKilometers'])*1000 for a, b in pairs),
                'maximumFixedMirrorRayMotionRadians': max(angular_distance(a['fixedMirrorCenterUnitRay'], b['fixedMirrorCenterUnitRay']) for a, b in pairs),
                'maximumFixedMirrorGroundMotionMeters': max(ground) if ground else None,
                'qualification': 'pairwise maxima at five exposure poses, not continuous-motion bounds'}

    def _frustum(self, x, y, fraction, fast_axis_offset, inset_radians):
        et = self.pixel_time(x, y, fraction)
        state = self.state(et)
        # Physical nominal detector IFOV, independent of the ISIS center pitch.
        half_x, half_y = .00025/2-inset_radians[0], .0005/2-inset_radians[1]
        rays, hits = [], []
        for dx, dy in ((-half_x, -half_y), (half_x, -half_y),
                       (half_x, half_y), (-half_x, half_y)):
            observer, ray = self.ray(x, y, et, (fast_axis_offset+dx, dy), state)
            point = intersect_ellipsoid(observer, ray, self.radii_km)
            if point is None:
                raise ValueError('Aperture intersects unsupported limb/off-body region')
            rays.append(ray)
            hits.append(point)
        observer, center_ray = self.ray(x, y, et, (fast_axis_offset, 0.), state)
        return {'et': et, 'exposureFraction': fraction, 'observerKilometers': state[2],
                'fastAxisOffsetRadians': fast_axis_offset, 'cornerUnitRays': rays,
                'apertureCenterUnitRay': center_ray,
                'apertureCenterHitKilometers': intersect_ellipsoid(observer, center_ray, self.radii_km),
                'cornerHitsKilometers': hits,
                'cornerLongitudeLatitude': [longitude_latitude(point) for point in hits]}

    def footprint(self, x, y, *, maximum_center_error_pixels, aperture_policy=None,
                  inset_radians=(0., 0.)):
        """Return per-pixel frusta; default refuses unqualified aperture mapping.

        `orders` is a tuple of possible normal-mode half-step orders. Each order
        is a union of sub-exposures; each sub-exposure is an intersection of its
        sampled frusta. Accept a point only in EVERY possible order. Test the
        surface-point-minus-observer direction against the angular frusta;
        connecting the four ground hits with great circles is not equivalent.

        Time samples do not bound continuous motion or prove a full-exposure
        response. The result is a subset of the nominal sampled exposure union,
        with unresolved absolute pointing and nominal subpixel aperture geometry.
        """
        self._pixel(x, y)
        if not math.isfinite(maximum_center_error_pixels) or maximum_center_error_pixels <= 0:
            raise ValueError('A finite positive center-error threshold is required')
        if len(inset_radians) != 2 or not all(math.isfinite(x) and x >= 0 for x in inset_radians):
            raise ValueError('Finite nonnegative angular insets required')
        result = {'supported': False, 'sampleZeroBased': x, 'lineZeroBased': y,
                  'frameId': self.frame_id, 'radiiKilometers': self.radii_km,
                  'samplingMode': self.mode, 'samplingPitchRadians': self.model[:2],
                  'midExposureET': self.pixel_time(x, y), 'centerResidual': self.center_residual(x, y)}
        if self.ray_only or self.channel != 'IR':
            result['reason'] = 'Camera-ray diagnostics only; native-frame footprint mapping is not qualified'
            return result
        if result['centerResidual'] is None or result['centerResidual']['lookErrorPixels'] > maximum_center_error_pixels:
            result['reason'] = 'Native center is missing or reconstruction residual exceeds qualification'
            return result
        if aperture_policy != APERTURE_POLICY:
            result['reason'] = 'Explicit qualified nominal-aperture policy required'
            return result
        if inset_radians[0] >= .00025/2 or inset_radians[1] >= .0005/2:
            result['reason'] = 'Inset leaves no positive physical aperture'
            return result
        try:
            motion = self.exposure_motion(x, y)
            if self.mode == 'HI-RES':
                orders = [[tuple(self._frustum(x, y, fraction, 0., inset_radians) for fraction in (0., .5, 1.))]]
            else:
                halves = {}
                for index, fractions in enumerate(((0., .25, .5), (.5, .75, 1.))):
                    for sign in (-1, 1):
                        halves[index, sign] = tuple(self._frustum(x, y, fraction, sign*.000125, inset_radians) for fraction in fractions)
                orders = [[halves[0, -1], halves[1, 1]], [halves[0, 1], halves[1, -1]]]
        except ValueError as error:
            result['reason'] = str(error)
            return result
        result.update(supported=True, aperturePolicy=APERTURE_POLICY, apertureSource=APERTURE_SOURCE,
                      nominalPhysicalApertureRadians=(.00025, .0005),
                      retainedApertureRadians=(.00025-2*inset_radians[0], .0005-2*inset_radians[1]),
                      insetRadians=tuple(inset_radians), orders=orders, exposureMotion=motion,
                      supportRule='intersection of possible orders; union of sub-exposures; intersection of sampled frusta',
                      temporalQualification='time-sampled nominal support, not continuous integrated response',
                      absolutePointingAccuracy='unresolved')
        # An interior witness proves local positive support. Failure to find one
        # withholds this pixel; it does not assert that every possible overlap is
        # empty. In NORMAL the combined pixel center is often on a half boundary,
        # so use each half's interior, never require combined-center membership.
        grouped = {}
        for order in orders:
            for subexposure in order:
                for frustum in subexposure:
                    point = frustum['apertureCenterHitKilometers']
                    if point is not None:
                        grouped.setdefault(frustum['fastAxisOffsetRadians'], []).append(point)
        candidates = []
        for points in grouped.values():
            direction = unit(tuple(sum(point[k] for point in points) for k in range(3)))
            lon, lat = longitude_latitude(direction)
            candidates.append(ellipsoid_point(lat, lon, self.radii_km))
            candidates.extend(points)
        witness = next((point for point in candidates if footprint_margin(point, result) > 1e-12), None)
        if witness is None:
            result.update(supported=False, reason='No strictly interior nominal support witness found')
        else:
            result['positiveSupportWitnessKilometers'] = witness
        return result


def frustum_margin(point_km, frustum, radii_km):
    """Smallest signed angular half-space margin; negative also rejects far side."""
    observer = frustum['observerKilometers']
    normal = tuple(point_km[k]/radii_km[k]**2 for k in range(3))
    if dot(normal, sub(observer, point_km)) <= 0:
        return -math.inf
    ray = unit(sub(point_km, observer))
    corners = frustum['cornerUnitRays']
    center = frustum['apertureCenterUnitRay']
    margins = []
    for index, a in enumerate(corners):
        b = corners[(index+1) % len(corners)]
        cross = unit((a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]))
        sign = 1 if dot(cross, center) > 0 else -1
        margins.append(sign*dot(cross, ray))
    return min(margins)


def footprint_margin(point_km, footprint):
    """Exact stated AND/OR rule on angular frusta, not ground-corner polygons.

    Positive means strictly inside the supported nominal sampled region. The
    caller must supply a point on this source ellipsoid in this native frame.
    """
    radii = footprint['radiiKilometers']
    if (len(point_km) != 3 or not all(math.isfinite(x) for x in point_km)
            or abs(sum((x/r)**2 for x, r in zip(point_km, radii))-1) > 1e-8):
        raise ValueError('Support query must lie on the qualified source ellipsoid')
    if not footprint.get('supported'):
        return -math.inf
    return min(max(min(frustum_margin(point_km, frustum, radii) for frustum in subexposure)
                       for subexposure in order) for order in footprint['orders'])
