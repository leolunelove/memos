// Bump this version whenever app files change. Activation waits for old tabs to close.
const root=new URL('./',self.location.href),prefix='memos-shell-'+encodeURIComponent(root.pathname)+'-';
const SHELL=prefix+'memos-20260929',ENCODER='memos-encoder-v1-'+encodeURIComponent(root.pathname);
const paths=['./','index.html','app/main.js?v=memos-20260929','app/styles.css?v=memos-20260929','app/i18n.js','app/library.js','app/offline.js','app/storage.js','app/audio-processing.js','app/effects.js','assets/memos.svg','assets/icon-192.png','assets/icon-512.png','manifest.webmanifest','vendor/ffmpeg/ffmpeg.js'];
const urls=paths.map(p=>new URL(p,root).href);
self.addEventListener('install',event=>event.waitUntil(caches.open(SHELL).then(cache=>cache.addAll(urls))));
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const key of await caches.keys())if(key.startsWith(prefix)&&key!==SHELL)await caches.delete(key);await self.clients.claim();})()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==root.origin||!url.pathname.startsWith(root.pathname)||url.pathname.includes('__qa'))return;
  const encoder=url.pathname.startsWith(new URL('vendor/ffmpeg/',root).pathname)&&!url.pathname.endsWith('/ffmpeg.js');
  const navigation=event.request.mode==='navigate'&&(url.pathname===root.pathname||url.pathname===new URL('index.html',root).pathname);
  if(!navigation&&!encoder&&!urls.includes(url.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(encoder?ENCODER:SHELL);
    // Shell versions stay coherent until every old tab is closed.
    const cached=await cache.match(navigation?root.href:event.request);
    if(cached)return cached;
    const response=await fetch(event.request);
    if(encoder&&response.ok)await cache.put(event.request,response.clone());
    return response;
  })());
});
