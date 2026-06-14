import http from 'node:http';
import { loadEnv, geminiApiKey, serverPort } from './lib/env.js';
import { syncAllMediaToDist } from './lib/media-overrides.js';
import { handleRequest } from './handler.js';

loadEnv();

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

const port = serverPort();
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${port} is already in use. Stop the other process, run only "npm run dev", or set GEMINI_API_PORT.`
    );
    process.exit(1);
  }
  throw err;
});

server.listen(port, () => {
  syncAllMediaToDist();
  const configured = Boolean(geminiApiKey());
  console.log(`Supergroup API listening on http://localhost:${port}`);
  console.log(
    configured
      ? 'Gemini album generation enabled'
      : 'GEMINI_API_KEY not set — album generation disabled'
  );
});
