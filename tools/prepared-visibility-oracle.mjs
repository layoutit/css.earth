import assert from 'node:assert/strict';

const sub = (a, b) => a.map((v, i) => v - b[i]);
const dot = (a, b) => a.reduce((sum, v, i) => sum + v * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
// Independent Moller-Trumbore intersection, not the face-plane relation used
// by the compiler. The nearest front-facing ray hit must win the group painter.
export function verifyRayOrder(triangles, signs, plan, eyes, targets) {
  const owner = new Map(plan.groups.flatMap((members, group) => members.map(face => [face, group])));
  assert.equal(owner.size, triangles.length);
  let rays = 0, overlaps = 0;
  for (const eye of eyes) {
    const order = [];
    function visit(node) {
      if ('group' in node) order.push(node.group);
      else if ('sequence' in node) node.sequence.forEach(visit);
      else {
        const front = dot(node.plane.slice(0, 3), eye) + node.plane[3] >= 0;
        visit(front ? node.back : node.front); visit(front ? node.front : node.back);
      }
    }
    visit(plan.order);
    const ranks = new Map(order.map((group, rank) => [group, rank]));
    for (const target of targets) {
      const direction = sub(target, eye), hits = [];
      triangles.forEach(([a, b, c], face) => {
        const u = sub(b, a), v = sub(c, a), p = cross(direction, v), determinant = dot(u, p);
        if (determinant * signs[face] <= 1e-10) return;
        const relative = sub(eye, a), x = dot(relative, p) / determinant;
        const q = cross(relative, u), y = dot(direction, q) / determinant;
        const distance = dot(v, q) / determinant;
        if (x > 1e-8 && y > 1e-8 && x + y < 1 - 1e-8 && distance > 0) hits.push({ face, distance });
      });
      hits.sort((a, b) => a.distance - b.distance);
      rays++;
      if (hits.length < 2) continue;
      overlaps++;
      const expected = hits[0];
      const painted = hits.toSorted((a, b) => ranks.get(owner.get(b.face)) - ranks.get(owner.get(a.face)) || a.distance - b.distance)[0];
      assert.ok(Math.abs(expected.distance - painted.distance) < 1e-8, `Visibility changed at eye ${eye}, target ${target}: ${expected.face} became ${painted.face}`);
    }
  }
  return { rays, overlaps };
}
