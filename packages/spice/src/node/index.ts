// Node-only helpers: kernel files on disk. They import `node:*` built-ins, so they live behind `@cssearth/spice/node` and
// never reach the browser entry.
export { loadKernelSet, type KernelSet, type LoadedKernel } from './kernel-set.js';
export {
  KERNEL_BANK_ROOT, kernelBankRoot, kernelBanks, readPinnedFile, type KernelBankManifest, type KernelBankManifestLocation, type KernelBankOptions,
} from './kernel-bank.js';
