import { isRecord } from '@cssearth/core';
import { readObjectDescriptors } from '@cssearth/objects/node';

/** The dot bank that holds the plain dots of `classification` around `hostId`: the catalogue point bank `hostId` hosts
 * that declares them (`properties.plainDots`). Their world rows are in its file and their places are its dots, so no
 * preparation step names the bank. Undefined when no bank declares them. */
export async function plainDotBank(objectsDirectory: string, hostId: string, classification: string): Promise<string | undefined> {
  const found = [...await readObjectDescriptors(objectsDirectory)].flatMap(([id, descriptor]) =>
    isRecord(descriptor) && descriptor.type === 'catalogue-point-bank' && isRecord(descriptor.properties)
      && descriptor.properties.host === hostId && descriptor.properties.plainDots === classification ? [id] : []);
  if (found.length > 1) {
    throw new TypeError(`${found.map(id => `src/objects/${id}/object.json`).join(' and ')} each declare properties.plainDots ${classification} for ${hostId}: one bank holds them.`);
  }
  return found[0];
}
