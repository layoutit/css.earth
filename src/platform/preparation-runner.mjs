import { spawn } from "node:child_process";
import { realpath } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

export async function runPreparationSteps({
  objectName,
  toolDirectory,
  steps,
  projectRoot = resolve(import.meta.dirname, "../.."),
  runCommand = spawnPreparedStep,
}) {
  if (typeof objectName !== "string" || objectName.length === 0 ||
      typeof toolDirectory !== "string" || typeof projectRoot !== "string" || !Array.isArray(steps) ||
      steps.length === 0) {
    throw new TypeError("Preparation step plan is incompatible.");
  }
  const root = resolve(projectRoot);
  for (const step of steps) {
    if (!Array.isArray(step) || step.length === 0 ||
        step.some((value) => typeof value !== "string") ||
        isAbsolute(step[0]) ||
        !/^[a-z0-9][a-z0-9._-]*\.mjs$/u.test(step[0].split("/").at(-1)) ||
        step[0].split("/").slice(0, -1).some(part => !/^(?:\.{1,2}|[a-z0-9][a-z0-9._-]*)$/u.test(part))) {
      throw new TypeError(`${objectName} has an invalid preparation step.`);
    }
    const [script, ...argumentsList] = step;
    const scriptPath = resolve(toolDirectory, script);
    if (!inside(root, scriptPath)) throw new TypeError(`${objectName} preparation script escaped its project.`);
    await runCommand({
      objectName,
      projectRoot: root,
      script: scriptPath,
      argumentsList: Object.freeze(argumentsList),
    });
  }
}

function inside(root, path) {
  const location = relative(root, path);
  return location !== ".." && !location.startsWith("../") && !isAbsolute(location);
}

async function spawnPreparedStep({ objectName, projectRoot, script, argumentsList }) {
  if (!inside(await realpath(projectRoot), await realpath(script))) {
    throw new TypeError(`${objectName} preparation script link escaped its project.`);
  }
  return new Promise((resolvePromise, reject) => {
    const child = spawn(process.execPath, [script, ...argumentsList], {
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(
        `${objectName} preparation failed in ${script} with ${signal ?? `exit ${code}`}.`,
      ));
    });
  });
}
