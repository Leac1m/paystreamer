import { start, stop } from './scheduler/index.js';
import * as http from 'http';

console.log('[App] PayStreamer Scheduler Starting');
start(10000);

// Set up a simple HTTP server for DigitalOcean App Platform Liveness Checks
const PORT = process.env.PORT || 8080;
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK\n');
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  }
});

server.listen(PORT, () => {
  console.log(`[Health Check] Liveness server listening on port ${PORT}`);
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Stopping.');
  server.close();
  stop();
  process.exit(0);
});
process.on('SIGINT', () => {
  console.log('SIGINT received. Stopping.');
  server.close();
  stop();
  process.exit(0);
});
