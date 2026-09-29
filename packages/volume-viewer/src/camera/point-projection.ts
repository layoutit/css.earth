/** Project the lab's prepared point coordinates without depending on a retired scene owner. */
export function projectPreparedPoint(position: readonly number[], eye: readonly number[], rotation: readonly number[], focal: number, ox = 0, oy = 0) {
  const x = position[0]! - eye[0]!, y = position[1]! - eye[1]!, z = position[2]! - eye[2]!;
  const depth = -(rotation[6]! * x + rotation[7]! * y + rotation[8]! * z);
  return { x: ox + focal * (rotation[0]! * x + rotation[1]! * y + rotation[2]! * z) / depth,
    y: oy + focal * (rotation[3]! * x + rotation[4]! * y + rotation[5]! * z) / depth,
    depth, distanceUnits: Math.hypot(x, y, z) };
}
