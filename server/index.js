import { createApplication } from './app.js';

const port = Number(process.env.TRACEPOINT_API_PORT || 4100);
const app = createApplication();
app.server.listen(port, '127.0.0.1', () => console.log(`Tracepoint API: http://127.0.0.1:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => app.server.close(() => { app.store.close(); process.exit(0); }));
