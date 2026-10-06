// The Worker's site/prepared/prepared-world-context-node-source.mts: a Worker has no project directory, so the bundle
// step (deploy/cloudflare/bundle-worker.mts) writes the project files the page handler reads into the script, each
// as its JSON text under its project path.
declare const CSSEARTH_PROJECT_FILES: Readonly<Record<string, string>>;
const files = CSSEARTH_PROJECT_FILES;

/** A checked-in project file's JSON, from the bundle. */
export async function readProjectJson(_fromUrl: string | URL, path: string): Promise<unknown> {
  const text = Object.hasOwn(files, path) ? files[path] : undefined;
  if (text === undefined) throw new Error(`The Worker's bundle holds no ${path}; WORKER_PROJECT_FILES (deploy/cloudflare/worker-project-files.mts) lists what it carries.`);
  return JSON.parse(text);
}

/** Nothing in a Worker resolves a project path to a file. */
export function nodeProjectFileUrl(_fromUrl: string | URL, path: string): never {
  throw new Error(`The Worker has no project directory to resolve ${path} in; read it with readProjectJson.`);
}
