const { spawn, execSync } = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const API_PORT = Number(process.env.GEMINI_API_PORT || 3001);

function killPort(port) {
  try {
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'ignore'],
      });
      const pids = new Set();
      for (const line of out.split('\n')) {
        const match = line.trim().match(/LISTENING\s+(\d+)\s*$/i);
        if (match) pids.add(match[1]);
      }
      for (const pid of pids) {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Stopped process ${pid} on port ${port}`);
      }
      return;
    }
    execSync(`lsof -ti:${port} | xargs kill -9 2>/dev/null || true`, { stdio: 'ignore', shell: true });
  } catch {
    // port already free
  }
}

killPort(API_PORT);
console.log(`Starting album API on port ${API_PORT}…`);

const child = spawn(process.execPath, [path.join(ROOT, 'server', 'index.js')], {
  cwd: ROOT,
  stdio: 'inherit',
  windowsHide: true,
});

child.on('exit', (code) => process.exit(code ?? 0));
