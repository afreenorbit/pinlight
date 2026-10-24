import { createWorker } from 'tesseract.js';
import english from '@tesseract.js-data/eng';
import { createCanvas } from '@napi-rs/canvas';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { randomUUID } from 'node:crypto';

export async function readImagePages(bytes, pages) {
  const task=getDocument({data:new Uint8Array(bytes),isEvalSupported:false,useSystemFonts:true});
  let worker;
  try {
    const pdf=await task.promise;
    worker=await createWorker('eng',1,{langPath:english.langPath,gzip:true,cacheMethod:'none'});
    await worker.setParameters({tessedit_pageseg_mode:'11'});
    const results=[];
    for(const info of pages.filter(p=>!p.items.length).slice(0,10)) {
      const page=await pdf.getPage(info.page), base=page.getViewport({scale:1});
      const viewport=page.getViewport({scale:Math.min(4,3600/Math.max(base.width,base.height))});
      const canvas=createCanvas(Math.ceil(viewport.width),Math.ceil(viewport.height));
      await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;
      const {data}=await worker.recognize(canvas.toBuffer('image/png'),{},{tsv:true});
      const groups=new Map();
      for(const row of data.tsv.split('\n').slice(1)) {
        const [level,p,b,par,line,word,left,top,width,height,confidence,...text]=row.split('\t');
        const value=text.join('\t').trim();
        if(level!=='5'||!value||Number(confidence)<35)continue;
        const key=[p,b,par,line].join(':'), group=groups.get(key)||[];
        group.push({text:value,x:+left,y:+top,w:+width,h:+height,confidence:+confidence});groups.set(key,group);
      }
      const items=[],references=[];
      for(const words of groups.values()) {
        const text=words.map(w=>w.text).join(' '), x=Math.min(...words.map(w=>w.x)),y=Math.min(...words.map(w=>w.y));
        const width=Math.max(...words.map(w=>w.x+w.w))-x,height=Math.max(...words.map(w=>w.y+w.h))-y;
        const bounds={x:x/canvas.width,y:y/canvas.height,width:width/canvas.width,height:height/canvas.height};
        items.push({text,bounds,ocr:true,confidence:words.reduce((sum,w)=>sum+w.confidence,0)/words.length});
        if(!/[a-z]/i.test(text)||text.length>100)continue;
        const a=base.convertToPdfPoint(bounds.x*base.width,bounds.y*base.height),z=base.convertToPdfPoint((bounds.x+bounds.width)*base.width,(bounds.y+bounds.height)*base.height);
        references.push({id:randomUUID(),label:text,page:info.page,bounds,ocr:true,pdfBounds:{x:Math.min(a[0],z[0]),y:Math.min(a[1],z[1]),width:Math.abs(z[0]-a[0]),height:Math.abs(z[1]-a[1])}});
      }
      results.push({page:info.page,items,references});
    }
    return results;
  } finally {await worker?.terminate();await task.destroy();}
}
