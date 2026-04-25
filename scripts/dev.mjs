import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';

const processes = [
  spawn('npx', ['tsx', 'watch', 'server/index.ts'], {
    stdio: 'inherit',
    shell: isWindows,
  }),
  spawn('npx', ['vite', '--port=3000', '--host=0.0.0.0'], {
    stdio: 'inherit',
    shell: isWindows,
  }),
];

function stopAll(signal = 'SIGTERM') {
  for (const child of processes) {
    if (!child.killed) child.kill(signal);
  }
}

process.on('SIGINT', () => {
  stopAll('SIGINT');
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopAll('SIGTERM');
  process.exit(0);
});

for (const child of processes) {
  child.on('exit', (code) => {
    if (code && code !== 0) {
      stopAll();
      process.exit(code);
    }
  });
}
