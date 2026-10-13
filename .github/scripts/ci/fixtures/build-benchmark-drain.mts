import { spawn } from 'node:child_process';

if (process.argv[2] === 'late-output') {
  setTimeout(() => {
    process.stdout.write('Wrote 37 share images to dist/social (1.0 MB; 0 rendered, 37 reused).\n');
    process.stderr.write('LATE_STDERR_DRAINED\n');
  }, 300);
} else {
  const child = spawn(process.execPath, [import.meta.filename, 'late-output'], { stdio: 'inherit' });
  child.unref();
  process.exit(0);
}
