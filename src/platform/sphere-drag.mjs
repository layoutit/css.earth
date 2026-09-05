// Pointer-only virtual trackball math. No scene geometry is generated here.
export function projectSphereDrag({
  previousX, previousY, currentX, currentY,
  centerX, centerY, radius, focalLength,
  opticalCenterX = centerX, opticalCenterY = centerY,
}) {
  if (![previousX, previousY, currentX, currentY, centerX, centerY,
    opticalCenterX, opticalCenterY, radius, focalLength].every(Number.isFinite) ||
      radius <= 0 || focalLength <= 0) {
    throw new TypeError("Sphere drag projection is invalid.");
  }
  const distance = Math.hypot(1, focalLength / radius);
  const project = (x, y) => {
    let u = (x - centerX) / focalLength;
    let v = (y - centerY) / focalLength;
    let radial = u * u + v * v;
    const limb = 1 / (distance * distance - 1);
    // Native sky drags stay on the visible rim. Radial motion outside the
    // body is clamped; motion around the rim and onto the body continues.
    const onRim = radial >= limb * (1 - 1e-14);
    if (onRim) {
      const scale = Math.sqrt(limb / radial);
      u *= scale; v *= scale; radial = limb;
    }
    const t = onRim ? distance - 1 / distance :
      (distance - Math.sqrt(Math.max(0,
        1 - radial * (distance * distance - 1)))) / (1 + radial);
    const point = [t * u, t * v, distance - t];
    const length = Math.hypot(...point);
    return point.map((value) => value / length);
  };
  const a = project(previousX, previousY);
  const b = project(currentX, currentY);
  const rotation = [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
    1 + a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  ];
  const length = Math.hypot(...rotation);
  const result = rotation.map((value) => value / length);
  if (opticalCenterX === centerX && opticalCenterY === centerY) return result;
  // Transport the centered trackball axis into the optical camera frame.
  // Rodrigues' shortest-arc rotation maps +Z toward the eye; the angle of
  // the drag is unchanged. This is C * rotation * inverse(C), without trig.
  const dx = centerX - opticalCenterX, dy = centerY - opticalCenterY;
  const distanceToEye = Math.hypot(dx, dy, focalLength);
  const vx = dy / distanceToEye, vy = -dx / distanceToEye;
  const [x, y, z, w] = result;
  const tx = vy * z, ty = -vx * z, tz = vx * y - vy * x;
  const divisor = 1 + focalLength / distanceToEye;
  return [x + tx + vy * tz / divisor,
    y + ty - vx * tz / divisor,
    z + tz + (vx * ty - vy * tx) / divisor, w];
}

// Keep the order of coalesced pointer samples, but publish only once per event.
export function composeDragRotation(next, previous) {
  const [x, y, z, w] = next;
  const [a, b, c, d] = previous;
  return [w * a + x * d + y * c - z * b,
    w * b - x * c + y * d + z * a,
    w * c + x * b - y * a + z * d,
    w * d - x * a - y * b - z * c];
}

export function rotationFromAngularVelocity(velocity, elapsedMilliseconds) {
  const speed = Math.hypot(...velocity);
  if (speed < 1e-12) return [0, 0, 0, 1];
  const halfAngle = speed * elapsedMilliseconds / 2;
  const scale = Math.sin(halfAngle) / speed;
  return [velocity[0] * scale, velocity[1] * scale,
    velocity[2] * scale, Math.cos(halfAngle)];
}
