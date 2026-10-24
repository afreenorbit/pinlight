import { createApplication } from './app.js';

// Locally the API stays on 127.0.0.1:4100. Hosting platforms set PORT, and HOST=0.0.0.0 exposes it.
const port = Number(process.env.PORT || process.env.TRACEPOINT_API_PORT || 4100), host = process.env.HOST || '127.0.0.1';
const app = createApplication();
app.server.listen(port, host, () => {
  console.log(`Tracepoint API: http://${host}:${port}`);
  // A fresh server (empty database) imports the sample PDFs in the project root once.
  if (!app.store.list('document').length && process.env.SEED_SAMPLES !== 'off') app.documents.importLocal(process.cwd())
    .then(results => console.log(`Imported ${results.length} sample PDF(s).`))
    .catch(error => console.error('Sample PDF import failed:', error.message));
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.server.close(() => { app.store.close(); process.exit(0); }));
