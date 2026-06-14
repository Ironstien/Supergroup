import { loadEnv } from '../server/lib/env.js';
import { handleRequest } from '../server/handler.js';

loadEnv();

export default function handler(req, res) {
  return handleRequest(req, res);
}
