import { spawn } from "node:child_process";
import { resolve } from "node:path";

export async function runPreparationSteps({
  objectName,
  toolDirectory,
  steps,
  runCommand = spawnPreparedStep,
}) {
  if (typeof objectName !== "string" || objectName.length === 0 ||
      typeof toolDirectory !== "string" || !Array.isArray(steps) ||
      steps.length === 0) {
    throw new TypeError("Preparation step plan is incompatible.");
  }
  for (const step of steps) {
    if (!Array.isArray(step) || step.length === 0 ||
        step.some((value) => typeof value !== "string") ||
        !/^[a-z0-9][a-z0-9._-]*\.mjs$/u.test(step[0])) {
      throw new TypeError(`${objectName} has an invalid preparation step.`);
    }
    const [script, ...argumentsList] = step;
    await runCommand({
      objectName,
      script: resolve(toolDirectory, script),
      argumentsList: Object.freeze(argumentsList),
    });
  }
}

function spawnPreparedStep({ objectName, script, argumentsList }) {
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
