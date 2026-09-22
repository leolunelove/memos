const $ = id => document.getElementById(id);
const ui = Object.fromEntries(['new','count','recording-list','empty','title','metadata','export','notice','state-label','time','waveform','seek','tick-start','tick-middle','tick-end','pause','back','record','play','forward','delete','control-label','recorder-hint','microphone','refresh','mic-hint','audio','delete-dialog','delete-message'].map(id=>[id,$(id)]));
let clips=[], selected=null, mode='idle', recorder=null, stream=null, context=null, analyser=null, chunks=[], peaks=[], db=null;
let startedAt=0, elapsed=0, duration=0, animation=0, sampleAt=0, recordingName='', microphoneName='', acquiring=false, exporting=false, ffmpeg=null, ffmpegLoading=null;
const canvas=ui.waveform, ctx=canvas.getContext('2d');
const clock = (seconds, fraction=false) => {
  const ms=Math.floor(Math.max(0,seconds||0)*100); const mins=Math.floor(ms/6000); const secs=Math.floor(ms/100)%60;
  return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}${fraction?'.'+String(ms%100).padStart(2,'0'):''}`;
};
const recordingSeconds=()=>elapsed+(mode==='recording'?(performance.now()-startedAt)/1000:0);
const active=()=>mode==='recording'||mode==='paused'||mode==='stopping';
function notice(message, success=false){ui.notice.textContent=message;ui.notice.hidden=!message;ui.notice.classList.toggle('success',success);}
function displayTime(seconds){const [whole,part]=clock(seconds,true).split('.');ui.time.innerHTML=`${whole}<span>.${part}</span>`;}
function dateLabel(timestamp){return new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric'}).format(timestamp);}
function requestTransaction(action,record){return new Promise((resolve,reject)=>{if(!db)return reject(new Error('Storage unavailable'));const tx=db.transaction('recordings','readwrite');const store=tx.objectStore('recordings');store[action](record);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
function storedClip(clip){const {url,persisted,...record}=clip;return record;}
async function persist(clip){try{await requestTransaction('put',storedClip(clip));clip.persisted=true;return true;}catch{clip.persisted=false;notice('Your recording is ready, but it could not be saved in this browser. Export it before closing this tab.');return false;}}
async function openStorage(){
  try{
    db=await new Promise((resolve,reject)=>{const req=indexedDB.open('memos-voice-recorder',1);req.onupgradeneeded=()=>req.result.createObjectStore('recordings',{keyPath:'id'});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);req.onblocked=()=>reject(new Error('Storage blocked'));});
    const saved=await new Promise((resolve,reject)=>{const req=db.transaction('recordings').objectStore('recordings').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
    clips=saved.map(clip=>({...clip,url:URL.createObjectURL(clip.blob),persisted:true})).sort((a,b)=>b.created-a.created);renderList();
  }catch{notice('Browser storage is unavailable. Export your recordings before closing this tab.');}
}
function renderList(){
  ui['recording-list'].replaceChildren();ui.count.textContent=clips.length;ui.empty.hidden=clips.length>0;
  for(const clip of clips){
    const button=document.createElement('button');button.className='recording-item'+(selected?.id===clip.id?' selected':'');button.disabled=active()||acquiring||exporting;button.setAttribute('aria-pressed',String(selected?.id===clip.id));
    const title=document.createElement('strong');title.textContent=clip.title;
    const meta=document.createElement('span');meta.className='recording-meta';const date=document.createElement('span');date.textContent=dateLabel(clip.created);const len=document.createElement('span');len.textContent=clock(clip.duration);meta.append(date,len);button.append(title,meta);button.addEventListener('click',()=>selectClip(clip));ui['recording-list'].append(button);
  }
}
function resetPlayback(){ui.audio.pause();ui.audio.removeAttribute('src');ui.audio.load();cancelAnimationFrame(animation);}
function selectClip(clip){
  if(active()||acquiring||exporting)return;resetPlayback();selected=clip;mode='playback';duration=clip.duration;ui.audio.src=clip.url;ui.title.value=clip.title;ui.metadata.textContent=new Intl.DateTimeFormat(undefined,{month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}).format(clip.created);
  ui.seek.max=clip.duration;ui.seek.value=0;displayTime(0);notice('');renderList();updateControls();drawWave();
}
function newRecording(){
  if(active()||acquiring||exporting)return;resetPlayback();selected=null;mode='idle';duration=0;peaks=[];ui.title.value='New recording';ui.metadata.textContent='Not recorded yet';notice('');displayTime(0);renderList();updateControls();drawWave();
}
function updateControls(){
  const isActive=active(), playback=mode==='playback';
  ui.new.disabled=isActive||acquiring||exporting;ui.title.disabled=isActive||acquiring||exporting;
  ui.record.hidden=playback;ui.record.disabled=acquiring||mode==='stopping';ui.record.classList.toggle('recording',isActive);ui.record.setAttribute('aria-label',isActive?'Stop recording':'Start recording');
  ui.play.hidden=!playback;ui.play.disabled=exporting;ui.pause.hidden=!isActive||mode==='stopping';ui.pause.setAttribute('aria-label',mode==='paused'?'Resume recording':'Pause recording');ui.pause.innerHTML=`<svg><use href="#i-${mode==='paused'?'play':'pause'}"/></svg>`;
  ui.back.hidden=!playback;ui.forward.hidden=!playback;ui.delete.hidden=!playback;ui.delete.disabled=exporting;ui.back.disabled=exporting;ui.forward.disabled=exporting;
  ui.export.disabled=!playback||exporting;ui.microphone.disabled=isActive||acquiring||exporting;ui.refresh.disabled=isActive||acquiring||exporting;ui.seek.hidden=!playback;ui.seek.disabled=exporting;
  ui['state-label'].textContent=acquiring?'Waiting for microphone…':mode==='recording'?'Recording':mode==='paused'?'Paused':mode==='stopping'?'Saving recording…':playback?(ui.audio.paused?'Ready to listen':'Playing'):'Ready to record';
  ui['state-label'].classList.toggle('active',mode==='recording');ui['control-label'].textContent=acquiring?'Allow access':isActive?'Stop':playback?(ui.audio.paused?'Play':'Pause'):'Record';
  ui.play.setAttribute('aria-label',ui.audio.paused?'Play recording':'Pause playback');ui.play.innerHTML=`<svg><use href="#i-${ui.audio.paused?'play':'pause'}"/></svg>`;
  ui['recorder-hint'].textContent=isActive?(mode==='paused'?'Pick up where you left off.':'Listening. Make it yours.'):playback?`${clock(duration)} · ${selected?.microphone||'Audio recording'}`:'Press record. Take your time.';
  document.querySelector('.playhead').style.left=playback?'0%':'50%';
  for(const b of ui['recording-list'].children)b.disabled=isActive||acquiring||exporting;
}
async function enumerateMicrophones(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  const chosen=ui.microphone.value==='__enable'?'':ui.microphone.value;
  const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
  ui.microphone.replaceChildren(new Option('System default',''));
  for(const [i,device] of devices.entries()){if(device.deviceId&&device.deviceId!=='default')ui.microphone.add(new Option(device.label||`Microphone ${i+1}`,device.deviceId));}
  if([...ui.microphone.options].some(o=>o.value===chosen))ui.microphone.value=chosen;
  if(!devices.some(d=>d.label)){ui.microphone.add(new Option('Choose a microphone…','__enable'));ui['mic-hint'].textContent='Allow microphone access to choose an input.';}
  else ui['mic-hint'].textContent='Choose your input before recording.';
}
function microphoneError(error){
  const messages={NotAllowedError:'Microphone access is blocked. Allow it in your browser’s site settings, then try again.',NotFoundError:'No microphone was found. Connect a microphone and refresh the list.',NotReadableError:'This microphone is unavailable. Close other apps using it, or choose another input.',OverconstrainedError:'That microphone is no longer available. Refresh the list and choose another input.',SecurityError:'Microphone access is unavailable. Open this page in a secure browser tab.'};
  notice(messages[error.name]||'Could not start the microphone. Check your input and try again.');
}
async function enableMicrophones(){
  if(acquiring||active())return;acquiring=true;updateControls();notice('');let temporary;
  try{temporary=await navigator.mediaDevices.getUserMedia({audio:true});await enumerateMicrophones();notice('Microphones are ready. Choose an input below.',true);}catch(error){microphoneError(error);}finally{temporary?.getTracks().forEach(t=>t.stop());acquiring=false;updateControls();}
}
function releaseMicrophone(){stream?.getTracks().forEach(t=>t.stop());stream=null;context?.close().catch(()=>{});context=null;analyser=null;}
async function startRecording(){
  if(acquiring||active()||exporting)return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notice('Recording is unavailable in this browser. Open this site in a current browser over HTTPS.');return;}
  notice('');acquiring=true;updateControls();
  try{
    // Create/resume the audio context in the click gesture for Safari.
    context=new(window.AudioContext||window.webkitAudioContext)();await context.resume();
    const deviceId=ui.microphone.value;stream=await navigator.mediaDevices.getUserMedia({audio:deviceId?{deviceId:{exact:deviceId}}:true});
    await enumerateMicrophones();microphoneName=stream.getAudioTracks()[0]?.label||'System default';
    const mimeType=['audio/mp4;codecs=mp4a.40.2','audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    recorder=new MediaRecorder(stream,mimeType?{mimeType,audioBitsPerSecond:128000}:{});chunks=[];peaks=[];elapsed=0;duration=0;recordingName=ui.title.value.trim()||'New recording';
    analyser=context.createAnalyser();analyser.fftSize=1024;context.createMediaStreamSource(stream).connect(analyser);
    recorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};recorder.onstop=finishRecording;
    recorder.onerror=()=>{notice('Recording was interrupted. Saving the audio captured so far.');if(recorder.state!=='inactive')stopRecording();};
    for(const track of stream.getTracks())track.addEventListener('ended',()=>{if(active()){notice('The microphone disconnected. Saving your recording.');stopRecording();}});
    recorder.start(1000);mode='recording';startedAt=performance.now();sampleAt=0;ui.metadata.textContent='Recording from '+microphoneName;
    renderList();tick();
  }catch(error){releaseMicrophone();mode='idle';microphoneError(error);}finally{acquiring=false;updateControls();}
}
function togglePause(){
  if(mode==='recording'){elapsed=recordingSeconds();recorder.pause();mode='paused';}
  else if(mode==='paused'){recorder.resume();startedAt=performance.now();mode='recording';}
  updateControls();
}
function stopRecording(){if(!recorder||!['recording','paused'].includes(mode))return;duration=recordingSeconds();mode='stopping';updateControls();cancelAnimationFrame(animation);if(recorder.state!=='inactive')recorder.stop();releaseMicrophone();}
async function finishRecording(){
  // A recorder error may stop the stream before the explicit stop action.
  if(mode!=='stopping'){duration=recordingSeconds();mode='stopping';releaseMicrophone();cancelAnimationFrame(animation);}
  const mime=recorder.mimeType||chunks[0]?.type||'audio/webm';const blob=new Blob(chunks,{type:mime});chunks=[];recorder=null;
  if(!blob.size){mode='idle';updateControls();notice('No audio was captured. Try recording again.');return;}
  const clip={id:crypto.randomUUID(),title:recordingName,created:Date.now(),duration:Math.max(.01,duration),blob,mime,peaks:peaks.slice(),microphone:microphoneName,persisted:false,url:URL.createObjectURL(blob)};
  clips.unshift(clip);mode='idle';selectClip(clip);await persist(clip);
}
function tick(){
  if(!active())return;
  const seconds=recordingSeconds();displayTime(seconds);
  if(mode==='recording'&&analyser&&performance.now()-sampleAt>45){const values=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(values);let sum=0;for(const v of values)sum+=v*v;peaks.push(Math.min(1,Math.sqrt(sum/values.length)*4));sampleAt=performance.now();}
  drawWave();animation=requestAnimationFrame(tick);
}
function drawWave(){
  const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;const ratio=window.devicePixelRatio||1;
  if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
  const playback=mode==='playback';const source=playback?selected?.peaks||[]:peaks;const count=Math.max(1,Math.floor(width/5));const progress=playback?Math.min(1,ui.audio.currentTime/(duration||1)):0;
  for(let i=0;i<count;i++){
    let value=0;
    if(playback&&source.length){const from=Math.floor(i*source.length/count),to=Math.max(from+1,Math.floor((i+1)*source.length/count));for(let j=from;j<to&&j<source.length;j++)value=Math.max(value,source[j]);}
    else if(active()){const at=source.length-Math.floor(count/2)+i;value=i<count/2?source[at]||0:0;}
    const bar=Math.max(2,value*(height-12));ctx.fillStyle=playback?(i/count<=progress?'#ed4447':'#c5c7d0'):active()&&i<count/2?'#ed4447':'#e4e5eb';ctx.beginPath();ctx.roundRect(i*5,(height-bar)/2,2,bar,1);ctx.fill();
  }
  const total=playback?duration:active()?recordingSeconds():0;
  ui['tick-start'].textContent='00:00';ui['tick-middle'].textContent=clock(total/2);ui['tick-end'].textContent=clock(total);
  document.querySelector('.playhead').style.left=playback?`${progress*100}%`:'50%';
}
async function togglePlayback(){
  if(!selected||exporting)return;
  if(ui.audio.paused){if(ui.audio.currentTime>=duration-.02)ui.audio.currentTime=0;try{await ui.audio.play();notice('');}catch{notice('Playback could not start. Try pressing play again.');}}else ui.audio.pause();
  updateControls();
}
function playbackTick(){if(mode!=='playback')return;displayTime(ui.audio.currentTime);ui.seek.value=ui.audio.currentTime;drawWave();if(!ui.audio.paused)animation=requestAnimationFrame(playbackTick);}
function seekTo(value){if(!selected)return;ui.audio.currentTime=Math.max(0,Math.min(duration,value));playbackTick();}
async function getEncoder(){
  if(ffmpeg)return ffmpeg;
  if(ffmpegLoading)return ffmpegLoading;
  ffmpegLoading=(async()=>{
    if(!window.FFmpegWASM)throw new Error('Audio exporter could not load');
    const encoder=new window.FFmpegWASM.FFmpeg();
    const buffers=await Promise.all([0,1,2,3,4].map(async part=>{const res=await fetch(new URL(`ffmpeg-core.wasm.${part}`,document.baseURI));if(!res.ok)throw new Error('Audio exporter could not load');return res.arrayBuffer();}));
    const wasmURL=URL.createObjectURL(new Blob(buffers,{type:'application/wasm'}));
    try{await encoder.load({coreURL:new URL('ffmpeg-core.js',document.baseURI).href,wasmURL});}catch(error){encoder.terminate();throw error;}finally{URL.revokeObjectURL(wasmURL);}
    ffmpeg=encoder;return ffmpeg;
  })();
  try{return await ffmpegLoading;}finally{ffmpegLoading=null;}
}
function download(blob,title){const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=(title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').trim()||'Recording')+'.mp4';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function exportMP4(){
  if(!selected||exporting)return;const clip=selected;exporting=true;ui.audio.pause();updateControls();notice('');const label=ui.export.querySelector('span');let encoder;
  try{
    let result=clip.blob;
    if(!clip.mime.includes('mp4')){
      label.textContent='Preparing…';encoder=await getEncoder();label.textContent='Exporting…';
      const onProgress=({progress})=>{label.textContent=`Exporting ${Math.min(99,Math.max(0,Math.round(progress*100)))}%`;};encoder.on('progress',onProgress);
      try{await encoder.writeFile('input-audio',new Uint8Array(await clip.blob.arrayBuffer()));const code=await encoder.exec(['-i','input-audio','-vn','-c:a','aac','-b:a','128k','-movflags','+faststart','-f','mp4','output.mp4']);if(code!==0)throw new Error('MP4 encoding failed');const output=await encoder.readFile('output.mp4');result=new Blob([output],{type:'audio/mp4'});}finally{encoder.off('progress',onProgress);await encoder.deleteFile('input-audio').catch(()=>{});await encoder.deleteFile('output.mp4').catch(()=>{});}
    }
    download(result,clip.title);notice('MP4 is ready. Your download has started.',true);
  }catch(error){console.error('MP4 export failed:',error);if(encoder){encoder.terminate();ffmpeg=null;}notice('MP4 export could not finish. Your recording is still here. Try exporting again, or use a desktop browser for a long recording.');}
  finally{exporting=false;label.textContent='Export MP4';updateControls();}
}
ui.record.addEventListener('click',()=>active()?stopRecording():startRecording());ui.pause.addEventListener('click',togglePause);ui.new.addEventListener('click',newRecording);ui.play.addEventListener('click',togglePlayback);ui.export.addEventListener('click',exportMP4);ui.refresh.addEventListener('click',enableMicrophones);
ui.microphone.addEventListener('change',()=>{if(ui.microphone.value==='__enable'){ui.microphone.value='';enableMicrophones();}else notice('');});
ui.title.addEventListener('change',async()=>{const title=ui.title.value.trim()||'New recording';ui.title.value=title;if(selected){selected.title=title;renderList();await persist(selected);}});
ui.back.addEventListener('click',()=>seekTo(ui.audio.currentTime-10));ui.forward.addEventListener('click',()=>seekTo(ui.audio.currentTime+10));ui.seek.addEventListener('input',()=>seekTo(Number(ui.seek.value)));
ui.audio.addEventListener('play',()=>{cancelAnimationFrame(animation);updateControls();playbackTick();});ui.audio.addEventListener('pause',()=>{if(mode==='playback'){updateControls();playbackTick();}});ui.audio.addEventListener('ended',()=>{updateControls();playbackTick();});ui.audio.addEventListener('loadedmetadata',()=>{if(selected&&Number.isFinite(ui.audio.duration)&&ui.audio.duration>0){duration=ui.audio.duration;ui.seek.max=duration;drawWave();}});
ui.audio.addEventListener('error',()=>{if(selected&&ui.audio.getAttribute('src'))notice('This browser cannot play this recording. You can still export it as MP4.');});
ui.delete.addEventListener('click',()=>{ui.audio.pause();ui['delete-message'].textContent=`“${selected.title}” will be removed from this browser. This cannot be undone.`;ui['delete-dialog'].showModal();});
ui['delete-dialog'].addEventListener('close',async()=>{
  if(ui['delete-dialog'].returnValue!=='delete'||!selected)return;const clip=selected;
  try{if(clip.persisted)await requestTransaction('delete',clip.id);clips=clips.filter(c=>c.id!==clip.id);newRecording();URL.revokeObjectURL(clip.url);}catch{notice('This recording could not be deleted. Try again.');}
});
window.addEventListener('beforeunload',event=>{if(active()||acquiring||exporting||clips.some(c=>!c.persisted)){event.preventDefault();event.returnValue='';}});
navigator.mediaDevices?.addEventListener('devicechange',()=>enumerateMicrophones().catch(()=>{}));new ResizeObserver(drawWave).observe(canvas);
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  for(const tool of [
    {name:'list_recordings',title:'List recordings',description:'Read recordings saved in this browser, including their IDs, names, and durations.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async input=>{if(!input||Object.keys(input).length)throw new Error('Expected an empty object');return clips.map(({id,title,duration})=>({id,title,duration}));}},
    {name:'select_recording',title:'Select a recording',description:'Open an existing recording in the player without starting playback or recording.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{if(!input||typeof input.id!=='string'||Object.keys(input).some(k=>k!=='id'))throw new Error('A recording ID is required');if(active()||acquiring||exporting)throw new Error('The recorder is busy');const clip=clips.find(c=>c.id===input.id);if(!clip)throw new Error('Recording not found');selectClip(clip);return {id:clip.id,title:clip.title,selected:true};}}
  ]){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
await openStorage();await enumerateMicrophones().catch(()=>{});updateControls();drawWave();
