import {t} from './i18n.js';
export const OFFLINE_CACHE='memos-encoder-v1-'+encodeURIComponent(new URL('../',import.meta.url).pathname);
const exporter=['ffmpeg-core.js','814.ffmpeg.js',...Array.from({length:5},(_,i)=>`ffmpeg-core.wasm.${i}`)].map(p=>new URL('../vendor/ffmpeg/'+p,import.meta.url).href);
export function setupOffline(){
  const $=id=>document.getElementById(id);let key='Preparing offline access…',values={},controller=null,installPrompt=null,ready=false;
  const refresh=()=>{$('offline-status').textContent=t(key,values);};
  const status=(next,args={})=>{key=next;values=args;refresh();};
  async function checkCache(){const cache=await caches.open(OFFLINE_CACHE);return (await Promise.all(exporter.map(url=>cache.match(url)))).every(Boolean);}
  async function start(){
    // Synthetic QA pages never install a worker over the real recorder.
    if(!('serviceWorker' in navigator)||location.pathname.includes('__qa')){status('Offline access is unavailable in this browser.');return;}
    try{
      await navigator.serviceWorker.register(new URL('../sw.js',import.meta.url),{scope:new URL('../',import.meta.url).pathname});
      await navigator.serviceWorker.ready;ready=true;$('offline-download').disabled=false;
      status(await checkCache()?'App and MP4 exporter are ready offline. Browser storage can still be cleared.':'The app is ready offline. Download the exporter to also export MP4 offline.');
    }catch{status('Offline access is unavailable in this browser.');}
  }
  $('offline-download').addEventListener('click',async()=>{
    if(!ready||controller)return;controller=new AbortController();$('offline-download').disabled=true;$('offline-cancel').hidden=false;
    try{
      const cache=await caches.open(OFFLINE_CACHE);let count=0;
      for(const url of exporter){
        if(controller.signal.aborted)throw new DOMException('Cancelled','AbortError');
        status('Downloading exporter · {count} of 7 files',{count});
        if(!await cache.match(url)){const response=await fetch(url,{signal:controller.signal});if(!response.ok)throw new Error('Download failed');await cache.put(url,response);}
        count++;
      }
      status('App and MP4 exporter are ready offline. Browser storage can still be cleared.');
    }catch(error){status(error.name==='AbortError'?'Download cancelled. You can try again later.':'Offline download did not finish. Connect to the internet and try again.');}
    finally{controller=null;$('offline-download').disabled=false;$('offline-cancel').hidden=true;}
  });
  $('offline-cancel').addEventListener('click',()=>controller?.abort());
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();installPrompt=event;$('install').hidden=false;});
  $('install').addEventListener('click',async()=>{if(!installPrompt)return;await installPrompt.prompt();installPrompt=null;$('install').hidden=true;});
  window.addEventListener('appinstalled',()=>{$('install').hidden=true;});
  start();return {refresh};
}
