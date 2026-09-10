import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { conformanceBrowserLaunch } from "./conformance-browser-launch.mts";

test("the standard browser launch stays unchanged unless explicitly opted in", async () => {
  assert.deepEqual(await conformanceBrowserLaunch({ redirectStdio: false }), {
    options: { headless: true, channel: "chrome" }, diagnostics: null,
  });
  await assert.rejects(conformanceBrowserLaunch({ redirectStdio: true, platform: "linux" }),
    /requires macOS/);
});

test("the Chrome wrapper retains logs and arguments while preserving both CDP pipes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "cssearth-chrome-launch-"));
  try {
    const executable = join(directory, "Chrome 'fixture'");
    await writeFile(executable, '#!/bin/sh\nprintf "OUT:%s\\n" "$1"\nprintf "ERR\\n" >&2\nprintf "THREE\\n" >&3\nprintf "FOUR\\n" >&4\n', { mode: 0o755 });
    const { options, diagnostics } = await conformanceBrowserLaunch({
      redirectStdio: true, platform: "darwin", evidenceDirectory: directory,
      chromeExecutable: executable,
    });
    const argument = "spaces ' quotes $() ` unchanged";
    const child = spawn(options.executablePath, [argument], {
      stdio: ["ignore", "pipe", "pipe", "pipe", "pipe"],
    });
    const output = ["", "", "", ""];
    for (let index = 1; index <= 4; index++) child.stdio[index].on("data", bytes => output[index - 1] += bytes);
    const code = await new Promise((resolve, reject) => {
      child.once("error", reject); child.once("close", resolve);
    });
    assert.equal(code, 0);
    assert.deepEqual(output, ["", "", "THREE\n", "FOUR\n"]);
    assert.equal(await readFile(diagnostics.stdioLogPath, "utf8"), `OUT:${argument}\nERR\n`);
    assert.match(diagnostics.wrapperSha256, /^[a-f0-9]{64}$/);
    assert.equal(diagnostics.executablePath, executable);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
