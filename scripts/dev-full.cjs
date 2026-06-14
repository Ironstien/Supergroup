const { spawn, execSync } = require('child_process');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const VITE_PORT = Number(process.env.VITE_PORT || 5173);
const API_PORT = Number(process.env.GEMINI_API_PORT || 3001);
/** Must match server API_ALBUM_VERSION */
const EXPECTED_ALBUM_API_VERSION = 5;

const children = [];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function logShareableUrls(port) {
  const lanIp = getLanIp();
  if (!lanIp) return;
  console.log(`Share on Wi-Fi: http://${lanIp}:${port}/`);
}

async function fetchHealth() {
  try {
    const response = await fetch(`http://localhost:${API_PORT}/api/health`);
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
      const pids = new Set();
      for (const line of out.split('\n')) {
        const match = line.trim().match(/LISTENING\s+(\d+)\s*$/i);
        if (match) pids.add(match[1]);
      }
      for (const pid of pids) {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Stopped stale process ${pid} on port ${port}`);
      }
      return pids.size > 0;
    }

    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore', shell: true });
    return true;
  } catch {
    return false;
  }
}

function run(command, args, label, cwd = ROOT) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    windowsHide: true,
  });

  children.push(child);

  child.on('exit', (code) => {
    if (code && code !== 0) {
      console.error(`${label} exited with code ${code}`);
      process.exit(code);
    }
  });

  return child;
}

function shutdown() {
  for (const child of children) {
    child.kill();
  }
  process.exit(0);
}

async function ensureApi() {
  const health = await fetchHealth();

  if (health?.ok && health.albumApiVersion >= EXPECTED_ALBUM_API_VERSION) {
    console.log(`Album API v${health.albumApiVersion} already running on http://localhost:${API_PORT}`);
    return;
  }

  if (health?.ok) {
    console.warn(`Stale album API on port ${API_PORT} — restarting with v${EXPECTED_ALBUM_API_VERSION} routes…`);
    killPort(API_PORT);
    await sleep(800);
  }

  run(process.execPath, [path.join(ROOT, 'server', 'index.js')], 'API');
}

async function main() {
  await ensureApi();
  logShareableUrls(VITE_PORT);

  const viteBin = path.join(ROOT, 'app', 'node_modules', 'vite', 'bin', 'vite.js');
  run(process.execPath, [viteBin, '--host'], 'Vite', path.join(ROOT, 'app'));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
