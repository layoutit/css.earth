import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { chromium } from 'playwright';
import { prepareActivationGroups } from './prepared-activation-groups.mjs';

/** Resolve authored motion and immutable leaf facing offline. Runtime receives
 * explicit animation handles and planes, never a live style discovery pass. */
export async function preparePresentationBindings(definition, root) {
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
      // Preserve the default CSS animation order for existing saved playback
      // times. Hidden variants may expose additional prepared motion handles.
      const selections = [null, ...definition.variants];
      let motionIdentities;
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
      }
      // Recheck after every variant has declared its motion targets.
      return { motion: [...tracks.values()], facing: [...planes].filter(([target, plane]) => plane && facingPlane(target))
        .map(([target, binding]) => ({ target, ...binding })) };
    }, definition);
    return { ...definition, ...prepared, tree: { ...definition.tree, activationGroups: prepareActivationGroups(definition) } };
  } finally { await browser.close(); }
}
