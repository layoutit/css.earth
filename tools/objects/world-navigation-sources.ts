import { buildPolyMeshTransform } from '@layoutit/polycss';
import { multiply, rotation, type Matrix3 } from './world-navigation.js';

type Input = Record<string, any>;
const IDENTITY: Matrix3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];
export interface AuthoredPresentationBasis { readonly bodyToPresentation: Matrix3; readonly sourceRadiusUnits: number; readonly tilePixels: number; }

/** Read each capability's existing authored axes; object identities never select a backend. */
export function authoredPresentationBasis(sources: ReadonlyMap<string, Input>, eclipticBasis: Matrix3): AuthoredPresentationBasis {
  const model = sources.get('shape-model');
  if (model?.schema === 'cssearth-shape-model@1') return checked(eclipticBasis, model.displayRadius, 50);
  const solar = sources.get('solar-system'), terrestrial = sources.get('terrestrial');
  const geometry = sources.get('geometry'), presentation = sources.get('presentation'), paged = sources.get('paged-ellipsoid');
  if (solar?.schema === 'cssearth-solar-system-preparation@1') {
    return checked(eclipticBasis, solar.bodyRadiusUnits, 50);
  }
  if (terrestrial?.schema === 'cssearth-terrestrial-preparation@1') {
    if (terrestrial.kind === 'solid-observation-body') return checked(eclipticBasis, terrestrial.geometry.radius, 50);
    if (terrestrial.kind === 'affine-photographic-atmosphere') {
      const shape = sources.get('ellipsoid');
      if (!shape) throw new TypeError('Affine navigation requires its authored ellipsoid.');
      return checked(chain(mesh([shape.axialTiltDegrees, 0, 0]), mesh([0, 0, shape.bodyRotationDegrees])), shape.equatorialRadius, terrestrial.projection.tileSize);
    }
  }
  if (geometry?.schema === 'cssearth-static-surface-geometry@1' && geometry.kind === 'disc-poles') {
    return checked(chain(geometry.metadata.body.systemTransform, geometry.metadata.body.meshTransform), geometry.parameters.displayRadius, geometry.parameters.tileSize);
  }
  if (geometry?.schema === 'cssearth-layered-oblate-preparation@1') {
    const p = geometry.parameters;
    return checked(chain(mesh([0, 0, p.objectPresentationNodeDegrees]), mesh([p.objectObliquityDegrees, 0, 0]), mesh([0, 0, p.meshRotationZ])), p.equatorialRadius, p.tileSize);
  }
  if (geometry?.schema === 'cssearth-banded-ellipsoid@1') {
    if (presentation?.schema === 'cssearth-normalized-disc-presentation@1') {
      return checked(chain(mesh(presentation.systemRotation), mesh([0, 0, -presentation.bodyRotationZDegrees])), geometry.shape.equatorialRadius, geometry.planOptions.tileSize);
    }
    if (presentation?.schema === 'cssearth-layered-surface-presentation@1') {
      return checked(chain(authoredTransform(presentation.systemTransform), authoredTransform(presentation.meshTransform)), geometry.shape.equatorialRadius, geometry.planOptions.tileSize);
    }
  }
  if (paged?.schema === 'cssearth-paged-ellipsoid@1') {
    const p = paged.geometry;
    return checked(chain(mesh([0, 0, p.PRESENTATION_NODE_DEGREES]), mesh([p.OBLIQUITY_DEGREES, 0, 0]), mesh([0, 0, p.MESH_ROTATION_Z])), p.EQUATORIAL_RADIUS, p.TILE_SIZE);
  }
  throw new TypeError('Authored capability has no physical presentation basis. Supply numerical frame preparation for this capability.');
}

function mesh(rotation: readonly number[]): string {
  if (!Array.isArray(rotation) || rotation.length !== 3 || rotation.some(value => !Number.isFinite(value))) throw new TypeError('Authored mesh rotation must be finite.');
  return buildPolyMeshTransform({ rotation: [...rotation] as [number, number, number] }) ?? '';
}
function authoredTransform(value: Input): string {
  if (value?.kind === 'literal' && typeof value.value === 'string') return value.value;
  if (value?.kind === 'mesh-sequence' && Array.isArray(value.rotations)) return value.rotations.map(mesh).join(' ');
  throw new TypeError('Unsupported authored presentation transform.');
}
function checked(bodyToPresentation: Matrix3, sourceRadiusUnits: number, tilePixels: number): AuthoredPresentationBasis {
  rotation(bodyToPresentation);
  if (![sourceRadiusUnits, tilePixels].every(value => Number.isFinite(value) && value > 0)) throw new TypeError('Authored scene dimensions must be positive.');
  return { bodyToPresentation, sourceRadiusUnits, tilePixels };
}

/** CSS is interpreted only during preparation; retained runtime consumes the numeric result. */
export function chain(...transforms: string[]): Matrix3 {
  return transforms.reduce((left, value) => multiply(left, cssRotation(value)), IDENTITY);
}
function cssRotation(value: string): Matrix3 {
  let remaining = value.replace(/^transform:/u, '').trim(), result = IDENTITY;
  if (!remaining || remaining === 'none') return result;
  for (const match of remaining.matchAll(/matrix3d\(([^)]+)\)|rotate([XYZ])\((-?[\d.e+]+)deg\)/gu)) {
    let next: Matrix3;
    if (match[1]) {
      const m = match[1].split(',').map(Number);
      if (m.length !== 16 || m.some(number => !Number.isFinite(number)) || m[3] || m[7] || m[11] || m[12] || m[13] || m[14] || m[15] !== 1) throw new TypeError('Physical presentation needs a pure rotation.');
      next = [m[0], m[4], m[8], m[1], m[5], m[9], m[2], m[6], m[10]];
    } else {
      const angle = Number(match[3]) * Math.PI / 180, c = Math.cos(angle), s = Math.sin(angle);
      next = match[2] === 'X' ? [1, 0, 0, 0, c, -s, 0, s, c]
        : match[2] === 'Y' ? [c, 0, s, 0, 1, 0, -s, 0, c] : [c, -s, 0, s, c, 0, 0, 0, 1];
    }
    rotation(next); result = multiply(result, next); remaining = remaining.replace(match[0], '');
  }
  if (remaining.trim()) throw new TypeError(`Unsupported physical presentation transform: ${value}`);
  return result;
}
