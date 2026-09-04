export const MARS_BODY_LATITUDE_SEGMENTS = 18;
export const MARS_BODY_LONGITUDE_SEGMENTS = 32;
export const MARS_POLAR_BOUNDARY_LATITUDE_DEGREES = 87.1875;
export const MARS_BODY_LATITUDE_BOUNDS_DEGREES = Object.freeze([
  -MARS_POLAR_BOUNDARY_LATITUDE_DEGREES,
  ...Array.from({ length: 15 }, (_, index) => -78.75 + index * 11.25),
  MARS_POLAR_BOUNDARY_LATITUDE_DEGREES,
]);
export const MARS_EQUATORIAL_RADIUS_KM = 3_396.19;
export const MARS_POLAR_RADIUS_KM = 3_376.2;
export const MARS_EQUATORIAL_RADIUS = 230;
export const MARS_POLAR_RADIUS = MARS_EQUATORIAL_RADIUS *
  MARS_POLAR_RADIUS_KM / MARS_EQUATORIAL_RADIUS_KM;
export const MARS_AXIAL_TILT_DEGREES = 25.19;
export const MARS_BODY_ROTATION_DEGREES = 145;

export function marsBodyRasterBands(height) {
  if (!Number.isInteger(height) || height <= 0) {
    throw new RangeError("Mars surface height must be a positive integer.");
  }
  return Object.freeze(Array.from(
    { length: MARS_BODY_LATITUDE_BOUNDS_DEGREES.length - 1 },
    (_, bandIndex) => {
      const south = MARS_BODY_LATITUDE_BOUNDS_DEGREES[bandIndex];
      const north = MARS_BODY_LATITUDE_BOUNDS_DEGREES[bandIndex + 1];
      const y = Math.round((90 - north) / 180 * height);
      const bottom = Math.round((90 - south) / 180 * height);
      return Object.freeze({ y, height: bottom - y });
    },
  ));
}

export function marsBodyPoint(latitude, longitude) {
  const latitudeRadius = Math.cos(latitude);
  return [
    MARS_EQUATORIAL_RADIUS * latitudeRadius * Math.cos(longitude),
    MARS_EQUATORIAL_RADIUS * latitudeRadius * Math.sin(longitude),
    MARS_POLAR_RADIUS * Math.sin(latitude),
  ];
}

export function marsBodySilhouetteVertices() {
  const vertices = MARS_BODY_LATITUDE_BOUNDS_DEGREES.flatMap(
    (latitudeDegrees) => {
      const latitude = latitudeDegrees * Math.PI / 180;
      return Array.from(
        { length: MARS_BODY_LONGITUDE_SEGMENTS },
        (_, longitudeIndex) => marsBodyPoint(
          latitude,
          longitudeIndex / MARS_BODY_LONGITUDE_SEGMENTS * Math.PI * 2,
        ),
      );
    },
  );
  vertices.push(
    [0, 0, -MARS_POLAR_RADIUS],
    [0, 0, MARS_POLAR_RADIUS],
  );
  return vertices;
}
