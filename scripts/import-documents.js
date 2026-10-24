import { createApplication } from '../server/app.js';
const app = createApplication();
try {
  console.log(JSON.stringify(await app.documents.importLocal(process.cwd()), null, 2));
  for (const d of app.store.list('document')) console.log(`${d.title}: ${d.pages.length} pages, ${d.references.length} references, ${d.pages.reduce((n, p) => n + p.items.length, 0)} text items`);
} finally { app.store.close(); }
