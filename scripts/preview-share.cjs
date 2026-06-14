const { spawn } = require('child_process');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PREVIEW_PORT = 4173;

function getLanIp() {
  for (const nets of Object.values(os.networkInterfaces())) {
    for (const net of nets ?? []) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
}

const lanIp = getLanIp();
if (lanIp) {
  console.log(`Share on Wi-Fi: http://${lanIp}:${PREVIEW_PORT}/`);
}

const viteBin = path.join(ROOT, 'app', 'node_modules', 'vite', 'bin', 'vite.js');
const child = spawn(process.execPath, [viteBin, 'preview', '--host'], {
  cwd: path.join(ROOT, 'app'),
  stdio: 'inherit',
  windowsHide: true,
});

child.on('exit', (code) => process.exit(code ?? 0));

process.on('SIGINT', () => child.kill());
process.on('SIGTERM', () => child.kill());
