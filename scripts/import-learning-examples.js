import {readFile} from 'node:fs/promises';
import {createStore} from '../server/services/store.js';
import {documentService} from '../server/services/documents.js';
import {identifyDocument} from '../shared/learning/catalog.js';
const store=createStore(process.env.DATABASE_PATH||'./data/pinlight.sqlite'),service=documentService(store,'./data/documents');
try{for(const file of ['tmp/raspberry-pi-5-mechanical.pdf','arduino-uno-r3.pdf']){const result=await service.import(await readFile(file),file.split('/').at(-1));console.log(JSON.stringify({title:result.document.title,id:result.document.id,pages:result.document.pages.length,identity:identifyDocument(result.document)}));}}finally{store.close();}
