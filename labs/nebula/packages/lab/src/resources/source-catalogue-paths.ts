/** Catalogue bases resolve from their owning file, independent of the lab's folder name. */
export function catalogueSourceUrl(catalogueFileUrl: string, pathBase: string, sourcePath: string): string {
  const catalogue = new URL(catalogueFileUrl);
  if (catalogue.protocol !== 'file:' || !pathBase || !sourcePath || sourcePath.startsWith('/') ||
      sourcePath.split('/').includes('..') || /[\\?#]/.test(pathBase + sourcePath))
    throw new TypeError('Expected a file catalogue and relative source paths.');
  const source = new URL(`${pathBase.replace(/\/$/, '')}/${sourcePath}`, catalogue);
  return `/@fs${decodeURIComponent(source.pathname)}`;
}
