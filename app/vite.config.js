import { defineConfig } from 'vite';
import { resolve, join, extname } from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const MEDIA_ROOT = join(ROOT, 'public/media');

const MEDIA_MIME = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** Serve pasted uploads from disk — public/media is watch-ignored so Vite's static cache misses new files. */
function servePublicMediaPlugin() {
  function middleware(req, res, next) {
    const urlPath = (req.url ?? '').split('?')[0];
    if (!urlPath.startsWith('/media/')) return next();

    const rel = urlPath.slice('/media/'.length);
    if (!rel || rel.includes('..')) return next();

    const filePath = join(MEDIA_ROOT, rel);
    let stat;
    try {
      stat = fs.statSync(filePath);
    } catch {
      return next();
    }
    if (!stat.isFile()) return next();

    const ext = extname(filePath).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MEDIA_MIME[ext] ?? 'application/octet-stream');
    res.setHeader('Cache-Control', 'public, max-age=60');
    fs.createReadStream(filePath).pipe(res);
  }

  return {
    name: 'serve-public-media',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [servePublicMediaPlugin()],
  resolve: {
    alias: {
      '@data': resolve(__dirname, '../data'),
    },
  },
  server: {
    host: true,
    watch: {
      ignored: [
        resolve(__dirname, '../data/raw/bands.json'),
        resolve(__dirname, '../data/raw/musicians.json'),
        resolve(__dirname, '../data/raw/media-overrides.json'),
        resolve(__dirname, '../data/raw/media.json'),
        resolve(__dirname, 'public/media/**'),
      ],
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  preview: {
    host: true,
    port: 4173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
