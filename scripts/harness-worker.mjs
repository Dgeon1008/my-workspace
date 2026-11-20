import { pathToFileURL } from 'node:url';

let server;
const close = () => {
  server?.close();
  server?.closeAllConnections();
  process.exit(0);
};
process.on('disconnect', close);
process.on('SIGTERM', close);
process.on('SIGINT', close);
try {
  const module = await import(pathToFileURL(process.env.MOA_WORKER_ENTRY).href);
  const factory = module[process.env.MOA_WORKER_FACTORY];
  if (typeof factory !== 'function') throw new Error('Project server factory unavailable');
  server = factory();
  server.on('error', error => { console.error('[project-worker]', error.message); process.exit(1); });
  server.listen(0, '127.0.0.1', () => process.send?.({ ready: true, port: server.address().port }));
} catch (error) {
  console.error('[project-worker]', error.message);
  process.exit(1);
}
