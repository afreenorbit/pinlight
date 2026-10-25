import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
const execute=promisify(execFile);
export async function extractLayout({file,env=process.env}){
 if(env.DOCLING_ENABLED!=='on')return {engine:'pdfjs',notice:'Docling table extraction is not enabled.'};
 try{const {stdout}=await execute(env.DOCLING_PYTHON||'python',[resolve('server/workers/docling_extract.py'),file],{windowsHide:true,timeout:240000,maxBuffer:12*1024*1024});return JSON.parse(stdout);}catch{throw Error('Docling extraction failed. Check the Python worker installation.');}
}
