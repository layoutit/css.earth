import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { chromium } from 'playwright';
import { prepareActivationGroups } from './prepared-activation-groups.mjs';
import { prepareDepthPartitions, restoreDepthSource } from './prepared-depth-partitions.mjs';
import { verifyDepthStyles } from './prepared-depth-styles.mjs';

/** Resolve authored motion and immutable leaf facing offline. Runtime receives
 * explicit animation handles and planes, never a live style discovery pass. */
export async function preparePresentationBindings(definition, root) {
  definition = restoreDepthSource(definition);
  const pagePath = resolve(root, 'site/pages', `${definition.id}.astro`);
  const page = await readFile(pagePath, 'utf8');
  const styles = await Promise.all([...page.matchAll(/import\s+["']([^"']+\.css)["']/g)]
    .map(match => readFile(resolve(dirname(pagePath), match[1]), 'utf8')));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    // Prepared textures have no role in resolving authored motion. No asset
    // fetch is allowed during this CSS-only compilation step.
    await page.route('**/*', route => route.abort());
    await page.setContent('<main class="planet-stage example-stage"></main>');
    await page.addStyleTag({ content: styles.join('\n') });
    const prepared = await page.evaluate(definition => {
      const stage = document.querySelector('main');
      stage.dataset.objectId = definition.id;
      stage.classList.add(...definition.tree.stageClasses);
      const nodes = definition.tree.nodes.map(record => {
        const node = document.createElement(record.tag);
        if (record.className) node.className = record.className;
        node.style.cssText = record.style;
        for (const id of record.properties) {
          const p = definition.tree.properties[id];
          if (p.custom) node.style.setProperty(p.name, p.value); else node.style[p.name] = p.value;
        }
        for (const [name, value] of Object.entries(record.attributes)) node.setAttribute(name, value);
        return node;
      });
      nodes.forEach((node, i) => (definition.tree.nodes[i].parent < 0 ? stage : nodes[definition.tree.nodes[i].parent]).append(node));
      const index = new Map(nodes.map((node, i) => [node, i]));
      const tracks = new Map();
      const planes = new Map(), variablePlanes = new Set();
      const dynamic = new Set([
        ...definition.animations.map(plan => plan.target),
        ...definition.viewBindings.filter(binding => !['view-attribute', 'view-property'].includes(binding.kind)).map(binding => binding.target),
        ...definition.materials.map(track => track.target),
        // These properties have another publisher. A facing binding must not
        // override selection visibility or an authored changing transform.
        ...definition.variants.flatMap(variant => variant.writes.filter(write => write.kind === 'style' &&
          ['visibility', 'display', 'transform', 'transformOrigin', 'transform-origin'].includes(write.name)).map(write => write.target)),
      ]);
      function determinant(matrix) {
        const values = [0, 1, 2, 3].map(row => [0, 1, 2, 3].map(col => matrix[`m${col + 1}${row + 1}`]));
        let result = 1;
        for (let col = 0; col < 4; col++) {
          let pivot = col;
          for (let row = col + 1; row < 4; row++) if (Math.abs(values[row][col]) > Math.abs(values[pivot][col])) pivot = row;
          if (values[pivot][col] === 0) return 0;
          if (pivot !== col) { [values[col], values[pivot]] = [values[pivot], values[col]]; result = -result; }
          const diagonal = values[col][col]; result *= diagonal;
          for (let row = col + 1; row < 4; row++) {
            const factor = values[row][col] / diagonal;
            for (let column = col + 1; column < 4; column++) values[row][column] -= factor * values[col][column];
          }
        }
        return result;
      }
      function facingPlane(target) {
        const leaf = nodes[target];
        if (leaf.children.length || getComputedStyle(leaf).backfaceVisibility !== 'hidden') return null;
        let matrix = new DOMMatrix(), cursor = target;
        while (cursor !== definition.tree.scene && cursor >= 0) {
          if (dynamic.has(cursor)) return null;
          const style = getComputedStyle(nodes[cursor]);
          // Nonzero layout offsets, individual transforms and nested perspective
          // need their own prepared projection contract. Never guess a plane.
          if (![style.left, style.top].every(v => v === 'auto' || parseFloat(v) === 0) ||
              style.translate !== 'none' || style.rotate !== 'none' || style.scale !== 'none' || style.perspective !== 'none') return null;
          const origin = style.transformOrigin.split(' ').map(parseFloat);
          const transform = new DOMMatrix(style.transform === 'none' ? undefined : style.transform);
          matrix = new DOMMatrix().translate(origin[0], origin[1], origin[2] ?? 0)
            .multiply(transform).translate(-origin[0], -origin[1], -(origin[2] ?? 0)).multiply(matrix);
          cursor = definition.tree.nodes[cursor].parent;
        }
        if (cursor < 0) return null;
        const inverse = matrix.inverse();
        const plane = [inverse.m13, inverse.m23, inverse.m33, inverse.m43];
        const length = Math.hypot(...plane.slice(0, 3));
        // Chromium tests cofactor33 * determinant against float epsilon.
        // Preserve its scale-dependent tolerance when normalizing the plane.
        const det = determinant(matrix);
        const tolerance = 2 ** -23 / (length * det * det);
        return length > 0 && plane.every(Number.isFinite) && Number.isFinite(tolerance)
          ? { plane: plane.map(value => value / length), tolerance } : null;
      }
      function depthSurface() {
        const source = definition.surfaceHit;
        if (!source || definition.pageLayers?.length || definition.motionFrame?.length) return null;
        const body = nodes[source.target], leaves = [...body.children].map(node => index.get(node));
        if (leaves.length <= 64 || leaves.length !== source.triangles.length) return null;
        const chain = new Set();
        let matrix = new DOMMatrix();
        for (let cursor = source.target; cursor !== definition.tree.scene;) {
          if (cursor < 0 || dynamic.has(cursor)) return null;
          chain.add(cursor);
          const style = getComputedStyle(nodes[cursor]);
          if (style.opacity !== '1' || style.perspective !== 'none' || style.translate !== 'none' || style.rotate !== 'none' || style.scale !== 'none') return null;
          const origin = style.transformOrigin.split(' ').map(parseFloat);
          matrix = new DOMMatrix().translate(origin[0], origin[1], origin[2] ?? 0)
            .multiply(new DOMMatrix(style.transform === 'none' ? undefined : style.transform))
            .translate(-origin[0], -origin[1], -(origin[2] ?? 0)).multiply(matrix);
          cursor = definition.tree.nodes[cursor].parent;
        }
        const affected = new Set([definition.tree.scene, ...chain, ...leaves]);
        // Frame-owned attributes/properties can alter cloned ancestor selectors
        // or material variables. Only the common stage/camera publishers may
        // affect these static groups; unsupported local owners keep native depth.
        if (definition.viewBindings.some(binding => affected.has(binding.target))) return null;
        // A closed static surface is one independent presentation. Siblings,
        // animated shells and layered geometry keep their original depth space.
        for (const node of nodes[definition.tree.scene].querySelectorAll('*')) {
          const id = index.get(node);
          if (!chain.has(id) && !leaves.includes(id)) return null;
          for (const pseudo of ['::before', '::after']) if (!['none', 'normal'].includes(getComputedStyle(node, pseudo).content)) return null;
        }
        for (const [face, target] of leaves.entries()) {
          if (!facingPlane(target)) return null;
          const style = getComputedStyle(nodes[target]);
          if (!style.transformOrigin.split(' ').every(value => parseFloat(value) === 0)) return null;
          if (style.cornerTopLeftShape !== 'bevel' || style.cornerTopRightShape !== 'bevel' ||
              style.borderTopLeftRadius !== '50% 100%' || style.borderTopRightRadius !== '50% 100%') return null;
          const width = parseFloat(style.width), height = parseFloat(style.height);
          const inverse = new DOMMatrix(style.transform).inverse();
          // Prove that source face i is carried by leaf i, rather than assuming
          // that a hit-test mesh happens to share the renderer's ordering.
          for (const vertex of source.triangles[face]) {
            const p = inverse.transformPoint(new DOMPoint(...vertex));
            const u = p.x / width, v = p.y / height;
            // CSSOM matrix serialization rounds to six significant digits.
            // Bound the plane check relative to the source coordinate scale;
            // the in-triangle check remains in normalized texture coordinates.
            const planeTolerance = 1e-5 * Math.max(1, ...vertex.map(Math.abs));
            if (![u, v, p.z].every(Number.isFinite) || Math.abs(p.z) > planeTolerance ||
                v < -1e-4 || v > 1.0001 || Math.abs(u - 0.5) > v * 0.5 + 1e-4) return null;
          }
        }
        return { target: source.target, leaves, bodyFromScene: Array.from(matrix.inverse().toFloat64Array()) };
      }
      // Preserve the default CSS animation order for existing saved playback
      // times. Hidden variants may expose additional prepared motion handles.
      const selections = [null, ...definition.variants];
      let motionIdentities, surface, variableSurface = false;
      for (const variant of selections) {
        if (variant) for (const binding of variant.writes) {
          const node = binding.target < 0 ? stage : nodes[binding.target];
          if (binding.kind === 'attribute') {
            if (binding.value === null) node.removeAttribute(binding.name); else node.setAttribute(binding.name, binding.value);
          } else if (binding.kind === 'class') node.classList.toggle(binding.name, binding.value);
          else if (binding.kind === 'style') {
            if (binding.name.startsWith('--')) node.style.setProperty(binding.name, binding.value);
            else node.style[binding.name] = binding.value;
          }
        }
        const identities = [];
        for (const animation of stage.getAnimations({ subtree: true })) {
          if (!(animation instanceof CSSAnimation)) throw new TypeError('Only authored CSS motion enters the motion compiler.');
          const target = index.get(animation.effect.target);
          if (target === undefined) throw new TypeError('Authored motion must target a prepared node.');
          dynamic.add(target);
          const timing = animation.effect.getTiming();
          const frames = animation.effect.getKeyframes().map(frame => {
            if (Object.keys(frame).some(key => !['offset', 'computedOffset', 'easing', 'composite', 'transform'].includes(key)) ||
                typeof frame.transform !== 'string' || frame.easing !== 'linear' || !['auto', 'replace'].includes(frame.composite)) {
              throw new TypeError('Authored motion must supply final linear transform keyframes.');
            }
            return { offset: frame.computedOffset, transform: frame.transform };
          });
          if (!(timing.duration > 0) || timing.delay !== 0 || timing.endDelay !== 0 || timing.easing !== 'linear' ||
              timing.direction !== 'normal' || timing.iterations !== Infinity) throw new TypeError('Unsupported authored motion timing.');
          const track = { target, id: animation.animationName, keyframes: frames, duration: timing.duration, timings: [] };
          const identity = `${target}:${animation.animationName}`;
          if (identities.includes(identity)) throw new TypeError('Authored motion identities must be unique per node.');
          identities.push(identity);
          const previous = tracks.get(identity);
          if (previous) {
            if (JSON.stringify(previous.keyframes) !== JSON.stringify(track.keyframes)) throw new TypeError('Selection-dependent motion keyframes require explicit preparation.');
            if (variant && timing.duration !== previous.duration) previous.timings.push({ when: variant.when, duration: timing.duration });
          } else tracks.set(identity, track);
        }
        motionIdentities ??= [...identities].sort();
        if (JSON.stringify(motionIdentities) !== JSON.stringify([...identities].sort())) {
          throw new TypeError('Selection-dependent motion membership requires explicit preparation.');
        }
        for (let target = 0; target < nodes.length; target++) {
          if (variablePlanes.has(target)) continue;
          const plane = facingPlane(target);
          if (planes.has(target) && JSON.stringify(planes.get(target)) !== JSON.stringify(plane)) {
            planes.delete(target); variablePlanes.add(target);
          } else planes.set(target, plane);
        }
        const nextSurface = depthSurface();
        if (surface !== undefined && JSON.stringify(surface) !== JSON.stringify(nextSurface)) variableSurface = true;
        surface = nextSurface;
      }
      // Recheck after every variant has declared its motion targets.
      return { surface: variableSurface ? null : depthSurface(), motion: [...tracks.values()], facing: [...planes].filter(([target, plane]) => plane && facingPlane(target))
        .map(([target, binding]) => ({ target, ...binding })) };
    }, definition);
    const { surface, ...bindings } = prepared;
    const source = { ...definition, ...bindings, tree: { ...definition.tree, activationGroups: prepareActivationGroups(definition) } };
    let compiled = prepareDepthPartitions(source, surface);
    if (!await verifyDepthStyles(page, source, compiled, surface)) compiled = source;
    return { ...compiled, tree: { ...compiled.tree, activationGroups: prepareActivationGroups(compiled) } };
  } finally { await browser.close(); }
}
