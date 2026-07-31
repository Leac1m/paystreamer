import { start, stop, runCycle } from './scheduler/index.js';
import * as http from 'http';

console.log('[App] PayStreamer Scheduler Initializing');

// Export serverless handler for Vercel Cron and Serverless Functions
export default async function handler(req: http.IncomingMessage, res: http.ServerResponse) {
  const url = req.url || '/';
  if (url.startsWith('/api/cron') || url.startsWith('/cron') || url.startsWith('/execute')) {
    console.log('[Vercel Cron] Triggering payment cycle...');
    try {
      await runCycle();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'success', timestamp: Date.now() }));
    } catch (err: any) {
      console.error('[Vercel Cron] Error during execution:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', error: err?.message || 'Cycle failed' }));
    }
    return;
  }

  if (url === '/health' || url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'OK', service: 'PayStreamer Scheduler' }));
  } else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found\n');
  }
}

// When running as a standalone service (e.g. Docker, DigitalOcean, local dev), start interval loop and server.
// In Vercel serverless environments (VERCEL or VERCEL_ENV), rely purely on Vercel Cron scheduled invocations.
if (!process.env.VERCEL && !process.env.VERCEL_ENV) {
  console.log('[App] Starting in standalone service mode with 10s interval...');
  start(10000);

  const PORT = process.env.PORT || 8080;
  const server = http.createServer(handler);

  server.listen(PORT, () => {
    console.log(`[Server] Listening on port ${PORT}`);
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
}
