// This package exposes one native executable path and does not ship types.
// Keep its unchecked export unknown; the importing implementation validates it.
declare module 'cwebp-bin' {
  const executable: unknown;
  export default executable;
}
