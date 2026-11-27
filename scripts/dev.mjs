// `pnpm dev` — the whole game on http://127.0.0.1:8787, no accounts, no cloud.
import { startLocalWorker } from './local.mjs';

const port = Number(process.env.PORT ?? 8787);
const worker = await startLocalWorker({ port, quiet: false });
console.log(`\nLinejam is running at ${worker.url}  (Ctrl-C stops it)\n`);
const stop = async () => {
  await worker.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
