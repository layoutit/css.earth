import prepared from './prepared.json' with { type: 'json' };
import { worldRotationFromQuaternion } from '../../src/renderers/css/dist/navigation.js';
import './minimap.css';

// Spatial overview, published by the same camera as the main world.
// No second scene/camera, navigation writes, ephemeris work, or runtime geometry.
export function mountSpaceMinimap(documentTarget) {
  const overlays = documentTarget.querySelector('.planet-scene-overlays');
  if (!overlays) throw new Error('Minimap preview requires the shared scene overlay layer.');
  const root = documentTarget.createElement('div');
  root.className = 'space-minimap';
  root.setAttribute('role', 'img');
  root.setAttribute('aria-label', 'Local space minimap, following the main camera position, orientation and zoom.');
  root.innerHTML = `<div class="space-minimap-shell" aria-hidden="true"><div class="space-minimap-content"><div class="space-minimap-galaxy" hidden></div><div class="space-minimap-world">${prepared.gridMarkup}</div><div class="space-minimap-points">${prepared.pointMarkup}</div></div></div>`;
  overlays.append(root);
  const dots = [...root.querySelectorAll('.space-minimap-dot')];
  const markerRadii = new Map();
  const dotRadii = dots.map(dot => {
    const classification = dot.dataset.classification;
    if (!markerRadii.has(classification)) {
      markerRadii.set(classification, parseFloat(documentTarget.defaultView.getComputedStyle(dot).width) / 2);
    }
    return markerRadii.get(classification);
  });
  const rings = [...root.querySelectorAll('.space-minimap-ring[data-radius-m]')];
  const galaxy = root.querySelector('.space-minimap-galaxy');
  let focus = prepared.defaultFocus, lastView = '', destroyed = false;
  return {
    selectObject(frame) { focus = { positionM: frame.originM, radiusM: frame.bodyRadiusM }; lastView = ''; },
    publish(world, viewport) {
      if (destroyed) return;
      const compatible = world.referenceFrame === prepared.referenceFrame && world.epochJdTt === prepared.epochJdTt;
      root.hidden = !compatible;
      if (!compatible) return;
      const view = [...world.pose.orientationXyzw, ...world.pose.positionM, viewport.focalPixels, viewport.widthPixels, viewport.heightPixels].join(',');
      if (view === lastView) return;
      lastView = view;
      const cameraToReference = worldRotationFromQuaternion(world.pose.orientationXyzw);
      const referenceToCamera = transpose(cameraToReference);
      const toFocus = focus.positionM.map((value, axis) => value - world.pose.positionM[axis]);
      const focusEye = rotate(referenceToCamera, toFocus);
      const depth = Math.max(focus.radiusM, -focusEye[2], Math.hypot(...toFocus) * .05);
      const spanPixels = Math.min(viewport.widthPixels ?? 1000, viewport.heightPixels ?? 800);
      const rangeM = Math.max(1, depth * spanPixels / (2 * viewport.focalPixels) * 1.15);
      const forward = rotate(cameraToReference, [0, 0, -depth]);
      const centerM = world.pose.positionM.map((value, axis) => value + forward[axis]);
      const scale = prepared.radius / rangeM;
      const galaxyFade = Math.max(0, Math.min(1, Math.log(rangeM / prepared.galaxy.fadeStartM) / Math.log(prepared.galaxy.fullM / prepared.galaxy.fadeStartM)));
      const plane = galaxyFade > 0 ? prepared.galaxy.planeToReference : prepared.diagramToReference;
      const diagramToCamera = multiply(referenceToCamera, plane);
      root.style.setProperty('--map-rotation', cssMatrix(diagramToCamera));
      root.dataset.radiusM = String(rangeM);
      root.dataset.centerM = centerM.join(',');
      root.dataset.scope = galaxyFade > 0 ? 'galaxy' : rangeM > 1e16 ? 'stellar' : 'system';
      for (let index = 0; index < rings.length; index++) {
        const ring = rings[index], fraction = prepared.ringRadiiM[index] / rangeM;
        const hidden = fraction <= .08 || fraction >= 1;
        if (ring.hidden !== hidden) ring.hidden = hidden;
        if (hidden) continue;
        const diameter = `${2 * prepared.ringRadiiM[index] * scale}px`;
        ring.style.width = diameter;
        ring.style.height = diameter;
        ring.style.opacity = String(Math.min(1, (fraction - .08) / .06, (1 - fraction) / .08));
      }
      let visibleBodies = 0, visibleStars = 0;
      for (let index = 0; index < dots.length; index++) {
        const point = prepared.points[index], dot = dots[index];
        const delta = point.positionM.map((value, axis) => value - centerM[axis]);
        // Bound the 3D neighborhood independently of the middle plane's tilt.
        // Inset by the marker radius so its full screen projection stays inside
        // the invisible sphere, including when the grid is exactly edge-on.
        const insetRadius = prepared.radius - dotRadii[index] - .5;
        const fraction = Math.hypot(...delta) * scale / insetRadius;
        const hidden = fraction >= 1;
        if (dot.hidden !== hidden) dot.hidden = hidden;
        if (hidden) continue;
        const eye = rotate(referenceToCamera, delta);
        const x = eye[0] * scale, y = eye[1] * scale;
        dot.style.transform = `translate(${x}px,${y}px)`;
        const opacity = point.classification === 'catalog-star' ? .6
          : ['planet', 'star'].includes(point.classification) ? 1 : .85;
        dot.style.opacity = String(opacity * Math.min(1, (1 - fraction) / .06));
        if (point.classification === 'catalog-star') visibleStars++; else visibleBodies++;
      }
      root.dataset.visibleBodies = String(visibleBodies);
      root.dataset.visibleStars = String(visibleStars);
      galaxy.hidden = galaxyFade === 0;
      if (!galaxy.hidden) {
        const eye = rotate(referenceToCamera, prepared.galaxy.positionM.map((value, axis) => value - centerM[axis]));
        const rotation = multiply(referenceToCamera, prepared.galaxy.planeToReference);
        const size = prepared.galaxy.widthM * scale / 176;
        galaxy.style.transform = `translate(${eye[0] * scale}px,${eye[1] * scale}px) ${cssMatrix(rotation.map(value => value * size))}`;
        galaxy.style.opacity = String(galaxyFade * .65);
      }
    },
    destroy() { destroyed = true; root.remove(); },
  };
}

// Transport the prepared diagram into the shared camera's eye coordinates.
function transpose(m) { return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]; }
function rotate(m, p) { return [0, 1, 2].map(row => m[row * 3] * p[0] + m[row * 3 + 1] * p[1] + m[row * 3 + 2] * p[2]); }
function multiply(a, b) {
  return [0, 1, 2].flatMap(row => [0, 1, 2].map(col =>
    a[row * 3] * b[col] + a[row * 3 + 1] * b[3 + col] + a[row * 3 + 2] * b[6 + col]));
}
function cssMatrix(m) {
  return `matrix3d(${[m[0], m[3], m[6], 0, m[1], m[4], m[7], 0, m[2], m[5], m[8], 0, 0, 0, 0, 1].join(',')})`;
}
