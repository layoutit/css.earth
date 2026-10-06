/** The files the world step writes into many packages' `prepared/` and pins itself (pin-world-files.mts): each object's bodies
 * (`members.json`), their orbit banks (`orbits/`), the places of its children's systems (`places.json`), its system views
 * (`views/`), the dots of the plain stars inside it, and the root object's summary, index and full context. */
export const worldFile = (name: string) => ['members.json', 'places.json', 'plain-stars.bin', 'plain-stars-far.bin', 'world.json', 'world-index.json', 'world-context.json'].includes(name) || name.startsWith('views/') || name.startsWith('orbits/');
