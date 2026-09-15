/** Transport prepared inspection pixels onto retained leaves, after the entire bank decodes. */
export interface ToneResource { sourcePath: string; url: string; width: number; height: number; }
export function createToneResourceController(options: { isAllowedUrl(url: string): boolean }) {
  const bindings = new Map<string, { width: number; height: number; nodes: HTMLElement[] }>();
  const urls = new Map<string, string>();
  let generation = 0;
  return {
    clear() { generation++; bindings.clear(); urls.clear(); },
    unbind(nodes: HTMLElement[]) {
      const removed = new Set(nodes);
      for (const binding of bindings.values()) binding.nodes = binding.nodes.filter(node => !removed.has(node));
    },
    bind(path: string, width: number, height: number, nodes: HTMLElement[] = []) {
      const prior = bindings.get(path);
      bindings.set(path, { width, height, nodes: [...(prior?.nodes ?? []), ...nodes] });
      const preparedUrl = urls.get(path);
      if (preparedUrl) for (const node of nodes) node.style.backgroundImage = `url(${JSON.stringify(preparedUrl)})`;
    },
    url(path: string, fallback: string) { return urls.get(path) ?? fallback; },
    async apply(resources: ToneResource[], expectedPaths: string[], isCurrent: () => boolean) {
      const version = generation, paths = new Set(resources.map(item => item.sourcePath));
      if (resources.length !== expectedPaths.length || paths.size !== resources.length || expectedPaths.some(path => !paths.has(path))) {
        throw new TypeError('Prepared tone resources do not match the selected image bank.');
      }
      for (const item of resources) {
        const binding = bindings.get(item.sourcePath);
        if (!binding || item.width !== binding.width || item.height !== binding.height || !options.isAllowedUrl(item.url)) {
          throw new TypeError('Prepared tone resource has an invalid extent or URL.');
        }
      }
      const queue = [...resources];
      await Promise.all(Array.from({ length: Math.min(8, queue.length) }, async () => {
        while (queue.length && version === generation && isCurrent()) {
          const resource = queue.shift()!, image = new Image(); image.src = resource.url; await image.decode();
          if (image.naturalWidth !== resource.width || image.naturalHeight !== resource.height) throw new TypeError('Prepared tone image decoded at the wrong size.');
        }
      }));
      if (version !== generation || !isCurrent()) return;
      for (const item of resources) {
        urls.set(item.sourcePath, item.url);
        for (const node of bindings.get(item.sourcePath)!.nodes) node.style.backgroundImage = `url(${JSON.stringify(item.url)})`;
      }
    },
  };
}
