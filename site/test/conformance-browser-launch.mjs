import { constants } from "node:fs";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const shellQuote = value => `'${value.replaceAll("'", "'\"'\"'")}'`;

// Opt-in test plumbing for macOS Chrome helpers that inherit stderr after the
// browser exits. Keep their output, but do not let that inherited stream hold
// Playwright's process-close event open. CDP's separate pipes stay untouched.
export async function conformanceBrowserLaunch({
  channel = "chrome",
  evidenceDirectory,
  redirectStdio = process.env.CSSEARTH_CHROME_LOG_STDIO === "1",
  platform = process.platform,
  chromeExecutable = MAC_CHROME,
} = {}) {
  const options = { headless: true, channel };
  if (!redirectStdio) return { options, diagnostics: null };
  if (platform !== "darwin" || channel !== "chrome" || !evidenceDirectory) {
    throw new Error("CSSEARTH_CHROME_LOG_STDIO requires macOS, channel chrome, and a conformance evidence directory.");
  }
  await access(chromeExecutable, constants.X_OK);
  await mkdir(evidenceDirectory, { recursive: true });
  const directory = await mkdtemp(join(evidenceDirectory, "chrome-process-"));
  const logPath = join(directory, "stdout-stderr.log");
  const wrapperPath = join(directory, "launch-chrome.sh");
  const wrapper = `#!/bin/sh\nexec ${shellQuote(chromeExecutable)} "$@" >>${shellQuote(logPath)} 2>&1\n`;
  await writeFile(logPath, "", { flag: "wx" });
  await writeFile(wrapperPath, wrapper, { mode: 0o755, flag: "wx" });
  return {
    options: { ...options, executablePath: wrapperPath },
    diagnostics: {
      mode: "installed-chrome-with-retained-stdio",
      executablePath: chromeExecutable,
      wrapperPath: relative(process.cwd(), wrapperPath),
      wrapperSha256: createHash("sha256").update(wrapper).digest("hex"),
      stdioLogPath: relative(process.cwd(), logPath),
      protocol: "Playwright CDP pipes on descriptors 3 and 4 are unchanged; only stdout and stderr are redirected.",
    },
  };
}
