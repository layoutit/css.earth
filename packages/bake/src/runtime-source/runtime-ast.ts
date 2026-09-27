import type { Node, Property, ObjectExpression } from 'estree';
import { isRecord } from '@cssearth/core';

/** Shared accessors for the ESTree shapes emitted by both source parsers. */
export function nodeName(node: Node | null | undefined): string | undefined {
  return node?.type === 'Identifier' || node?.type === 'PrivateIdentifier' ? node.name : undefined;
}
export function propertyKey(node: Node | null | undefined): string | number | undefined {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'Literal' && (typeof node.value === 'string' || typeof node.value === 'number')) return node.value;
  return undefined;
}
export function sourceStart(node: Node): number {
  if (isRecord(node) && typeof node.start === 'number') return node.start;
  return node.range?.[0] ?? 0;
}
export function sourceEnd(node: Node): number {
  if (isRecord(node) && typeof node.end === 'number') return node.end;
  return node.range?.[1] ?? sourceStart(node);
}
export function objectProperty(node: Node | null | undefined, name: string): Property | undefined {
  return node?.type === 'ObjectExpression' ? node.properties.find((property): property is Property => property.type === 'Property' && propertyKey(property.key) === name) : undefined;
}
export function staticObjectProperties(node: ObjectExpression): Property[] {
  if (node.properties.some(property => property.type !== 'Property' || property.computed || property.method || property.kind !== 'init')) throw new TypeError('Expected static object properties.');
  return node.properties.filter((property): property is Property => property.type === 'Property');
}
