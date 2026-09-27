// This package exposes one native executable path and does not ship types.
// Keep its unchecked export unknown; `prepared-webp.ts` validates it.
declare module 'cwebp-bin' {
  const executable: unknown;
  export default executable;
}
