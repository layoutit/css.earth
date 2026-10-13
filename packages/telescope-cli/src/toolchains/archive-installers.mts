/** Installed command entries over the existing archive installers; their checkout scripts remain usable. */
export const archiveInstallers: Readonly<Record<string, () => Promise<string>>> = {
  chandra: async () => (await import('../archives/chandra/toolchain.mts')).installChandra(),
  spitzer: async () => (await import('../archives/spitzer/toolchain.mts')).installSpitzer(),
  hst: async () => (await import('../archives/hst/toolchain.mts')).installHst(),
  keck: async () => (await import('../archives/keck/toolchain.mts')).installKeck(),
  gemini: async () => (await import('../archives/gemini/toolchain.mts')).installGemini(),
  naco: async () => (await import('../archives/naco/toolchain.mts')).installNacoToolchain(),
  tess: async () => (await import('../archives/tess/toolchain.mts')).installToolchain(),
  mearth: async () => (await import('../archives/mearth/toolchain.mts')).installToolchain(),
  espadons: async () => (await import('../archives/espadons/toolchain.mts')).installToolchain(),
  eureka: async () => (await import('../archives/jwst/toolchain.mts')).installToolchain('eureka'),
  klip: async () => (await import('../archives/jwst/toolchain.mts')).installToolchain('klip'),
  ...Object.fromEntries(['squeeze', 'rotir', 'pionier', 'amber', 'gravity', 'matisse', 'casa'].map(id =>
    [id, async () => (await import('../archives/interferometry/toolchain.mts')).installToolchain(id)])),
};
