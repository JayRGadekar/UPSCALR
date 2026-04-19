const { spawn } = require('node:child_process');
const waitOn = require('wait-on');

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const electronPath = require('electron');

const children = [];
let shuttingDown = false;

const spawnCommand = (command, args, options = {}) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: isWindows,
    ...options
  });

  children.push(child);
  return child;
};

const stopChildren = () => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
};

process.on('SIGINT', () => {
  stopChildren();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopChildren();
  process.exit(0);
});

const backend = spawnCommand(npmCommand, ['run', 'dev', '--prefix', 'backend']);
const frontend = spawnCommand(npmCommand, ['run', 'dev', '--prefix', 'frontend']);

const exitIfChildFails = (label, code) => {
  if (code === 0 || shuttingDown) {
    return;
  }

  console.error(`${label} exited with code ${code}`);
  stopChildren();
  process.exit(code || 1);
};

backend.on('exit', (code) => exitIfChildFails('Backend', code));
frontend.on('exit', (code) => exitIfChildFails('Frontend', code));

waitOn({
  resources: ['http://localhost:5174'],
  timeout: 60000
})
  .then(() => {
    if (shuttingDown) {
      return;
    }

    const electron = spawn(electronPath, ['.'], {
      stdio: 'inherit',
      shell: isWindows
    });

    children.push(electron);

    electron.on('exit', (code) => {
      stopChildren();
      process.exit(code || 0);
    });

    electron.on('error', (error) => {
      console.error('Failed to start Electron:', error);
      stopChildren();
      process.exit(1);
    });
  })
  .catch((error) => {
    console.error('Timed out waiting for the frontend dev server:', error.message);
    stopChildren();
    process.exit(1);
  });
