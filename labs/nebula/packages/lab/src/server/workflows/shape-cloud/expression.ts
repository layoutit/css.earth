import type { ShapeCloudSettings } from '../../../features/shape-cloud/types.ts';

const number = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/;
const alias = /^S([1-9]\d*)/;

/** Stable aliases name array positions; only coefficients/signs are edited by the formula. */
export function formatShapeExpression(settings: ShapeCloudSettings): string {
  const terms: string[] = [];
  settings.components.forEach((component, index) => {
    if (!component.enabled || component.weight === 0) return;
    if (!Number.isFinite(component.weight) || component.weight < 0 || component.weight > 5) throw new TypeError('Shape weights must be between 0 and 5.');
    const negative = component.operation === 'subtract';
    const term = `${component.weight} * S${index + 1}`;
    terms.push(terms.length ? `${negative ? '-' : '+'} ${term}` : `${negative ? '- ' : ''}${term}`);
  });
  return terms.join(' ') || '0';
}

/** Small signed-sum grammar, never JavaScript. Geometry and exposure remain untouched. */
export function parseShapeExpression(text: string, settings: ShapeCloudSettings): ShapeCloudSettings {
  if (typeof text !== 'string' || text.length > 4096 || !text.trim()) throw new TypeError('Enter a shape sum, for example S1 + 0.4 * S2, or 0.');
  const source = text.trim(), coefficients = settings.components.map(() => 0), magnitudes = settings.components.map(() => 0);
  let position = 0, terms = 0;
  const whitespace = () => { position += /^\s*/.exec(source.slice(position))![0].length; };
  if (source !== '0') while (position < source.length) {
    whitespace();
    let sign = 1;
    if (source[position] === '+' || source[position] === '-') sign = source[position++] === '-' ? -1 : 1;
    else if (terms) throw new TypeError('Separate shape terms with + or -.');
    whitespace();
    const coefficient = number.exec(source.slice(position));
    let weight = 1;
    if (coefficient) {
      weight = Number(coefficient[0]); position += coefficient[0].length; whitespace();
      if (!Number.isFinite(weight) || weight < 0 || weight > 5) throw new TypeError('Each shape coefficient must be between 0 and 5.');
      if (source[position++] !== '*') throw new TypeError('Use * between a coefficient and its shape, for example 0.4 * S2.');
      whitespace();
    }
    const shape = alias.exec(source.slice(position));
    if (!shape) throw new TypeError('Use a shape alias such as S1 or S2 after each sign/coefficient.');
    const index = Number(shape[1]) - 1;
    if (!Number.isSafeInteger(index) || index >= settings.components.length) throw new TypeError(`Unknown shape ${shape[0]}.`);
    coefficients[index]! += sign * weight; magnitudes[index]! += weight;
    position += shape[0].length; terms++; whitespace();
  }
  const tolerance = (index: number) => Number.EPSILON * magnitudes[index]! * 4;
  if (coefficients.some((value, index) => !Number.isFinite(value) || Math.abs(value) > 5 + tolerance(index))) throw new TypeError('The combined coefficient for each shape must be between -5 and 5.');
  return { ...settings, components: settings.components.map((component, index) => {
    const total = coefficients[index]!;
    const coefficient = Math.abs(total) <= tolerance(index) ? 0 : Math.max(-5, Math.min(5, total));
    return { ...component, enabled: coefficient !== 0, weight: Math.abs(coefficient),
      operation: coefficient === 0 ? component.operation : coefficient < 0 ? 'subtract' : 'add' };
  }) };
}
