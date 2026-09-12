import assert from 'node:assert/strict';
import { test } from 'node:test';
import { imageLinks, isFitsUrl } from './image-links';
import { imageFromRow } from './archives';

const fits = 'https://irsa.ipac.caltech.edu/data/SPITZER/example.fits';
const image = imageFromRow('mast', { obs_id: 'ob1', calib_level: 2, access_url: fits, access_format: 'image/fits' }, fits);
test('cached FITS Source links view the exact file instead of opening the download endpoint', () => {
  const links = imageLinks(image), url = new URL(links.sourceUrl);
  assert.equal(url.origin, 'https://irsa.ipac.caltech.edu'); assert.equal(url.pathname, '/irsaviewer/');
  assert.equal(url.searchParams.get('api'), 'image'); assert.equal(url.searchParams.get('url'), fits);
  assert.equal(links.downloadUrl, fits); assert.equal(links.viewUrl, links.sourceUrl);
  assert.equal(isFitsUrl('https://archive.example/download?uri=mast%3AHST%2Fproduct%2Ffile.fits.gz'), true);
});
test('real source pages remain source pages; direct preview and FITS download remain independent', () => {
  const sourceUrl = 'https://archive.eso.org/dataset/ADP.example', previewUrl = 'https://archive.example/preview.jpg';
  const links = imageLinks({ ...image, sourceUrl, previewUrl });
  assert.equal(links.sourceUrl, sourceUrl); assert.equal(links.viewUrl, previewUrl); assert.equal(links.downloadUrl, fits);
});
test('DataLink metadata opens as browser records and cannot masquerade as an image or FITS download', () => {
  const accessUrl = 'https://irsa.ipac.caltech.edu/datalink/links?ID=ivo%3A%2F%2Fexample';
  const links = imageLinks({ ...image, sourceUrl: accessUrl, accessUrl, accessFormat: 'application/x-votable+xml;content=datalink' });
  assert.equal(new URL(links.sourceUrl).searchParams.get('api'), 'table');
  assert.equal(new URL(links.sourceUrl).searchParams.get('source'), accessUrl);
  assert.equal(links.viewUrl, null); assert.equal(links.downloadUrl, null);
  assert.equal(links.sourceLabel, 'File listing');
});
