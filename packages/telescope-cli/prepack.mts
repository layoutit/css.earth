import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { preparePackageData, validatePublishPackage } from './src/package-data.mts';
import { publishDirectory } from './src/package-publish.mts';

const packageRoot = fileURLToPath(new URL('.', import.meta.url));
const root = fileURLToPath(new URL('../..', import.meta.url));
await mkdir(resolve(root, 'output'), { recursive: true });
const staging = await mkdtemp(resolve(root, 'output/telescope-package-data-'));
try {
  await preparePackageData(root, packageRoot, staging);
  await validatePublishPackage(root, packageRoot);
  await publishDirectory(resolve(staging, 'data'), resolve(packageRoot, 'data'));
} finally { await rm(staging, { recursive: true, force: true }); }
