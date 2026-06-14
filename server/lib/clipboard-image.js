import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIPBOARD_TIMEOUT_MS = 4000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WINDOWS_CLIPBOARD_SCRIPT = path.join(__dirname, 'clipboard-read-windows.ps1');

/**
 * Read a PNG image from the OS clipboard (Windows Snipping Tool, etc.).
 * Returns a Buffer or null if the clipboard has no image.
 */
export function readSystemClipboardImage() {
  if (process.platform === 'win32') {
    return readWindowsClipboard();
  }
  return null;
}

function readWindowsClipboard() {
  const tmp = path.join(os.tmpdir(), `sg-clip-${process.pid}-${Date.now()}.png`);

  const result = spawnSync(
    'powershell.exe',
    ['-NoProfile', '-Sta', '-NonInteractive', '-File', WINDOWS_CLIPBOARD_SCRIPT, '-OutPath', tmp],
    { stdio: 'pipe', timeout: CLIPBOARD_TIMEOUT_MS, windowsHide: true }
  );

  if (result.error?.code === 'ETIMEDOUT') {
    throw new Error('Clipboard read timed out — try copying the screenshot again.');
  }

  if (result.status === 2) return null;

  if (result.status !== 0) {
    const detail = result.stderr?.toString()?.trim();
    throw new Error(detail || 'Could not read Windows clipboard');
  }

  try {
    if (!fs.existsSync(tmp)) return null;
    const buffer = fs.readFileSync(tmp);
    fs.unlinkSync(tmp);
    return buffer.length ? buffer : null;
  } catch {
    try {
      if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
    throw new Error('Could not read clipboard image file');
  }
}

export function clipboardImageToDataUrl(buffer) {
  return `data:image/png;base64,${buffer.toString('base64')}`;
}
