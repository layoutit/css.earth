import { parseObjectDescriptor, type ObjectDescriptor } from '@cssearth/objects';

const SELECTOR = 'script[data-prepared-descriptor]';

/** Read the build-decorated descriptor that owns this document or navigation fragment. */
export function readPreparedDescriptor(documentTarget: Document, objectId: string): ObjectDescriptor | undefined {
  const element = documentTarget.querySelector<HTMLScriptElement>(SELECTOR);
  if (!element) return undefined;
  const descriptor = parseObjectDescriptor(element.textContent ?? '');
  if (descriptor.id !== objectId) throw new TypeError(`Prepared descriptor does not match object ${objectId}.`);
  return descriptor;
}

/** Keep a retained document's descriptor aligned with its currently committed object. */
export function publishPreparedDescriptor(documentTarget: Document, descriptor: ObjectDescriptor) {
  const element = documentTarget.querySelector<HTMLScriptElement>(SELECTOR);
  if (!element) throw new Error('The prepared object descriptor is missing from the document.');
  element.textContent = JSON.stringify(descriptor).replace(/</gu, '\\u003c');
}
