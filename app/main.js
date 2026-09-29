import {t,language,initTranslations,setLanguage,preference,savePreference} from './i18n.js';
import {createBackup,readBackup} from './library.js';
import {setupOffline} from './offline.js';
import { RecordingStore, holdTake } from './storage.js';
const $=id=>document.getElementById(id);
const ui=Object.fromEntries(['new','count','recording-list','empty','title','rename','metadata','export','notice','state-label','time','waveform','seek','tick-start','tick-middle','tick-end','pause','back','record','play','forward','delete','control-label','recorder-hint','microphone','refresh','mic-hint','audio','delete-dialog','delete-message','effect','effect-hint','processing','processing-label','processing-progress','cancel-process','clip-actions','quick-new','trim-toggle','trim-panel','trim-selection','trim-handles','trim-start','trim-end','trim-start-label','trim-end-label','trim-length','trim-reset','trim-cancel','trim-apply','save-status'].map(id=>[id,$(id)]));
initTranslations();
const store=new RecordingStore(),canvas=ui.waveform,ctx=canvas.getContext('2d');
let clips=[],deleted=[],undoClip=null,undoTimer=null,shareFile=null,selected=null,mode='idle',loading=true,acquiring=false,operation=null;
let recorder=null,stream=null,context=null,analyser=null,chunks=[],peaks=[],take=null,releaseTake=null;
let elapsed=0,startedAt=0,duration=0,animation=0,sampleAt=0,journal=Promise.resolve(),pendingChunks=[],sequence=0,recoveryWarning=false,lastSavedStatus=-10;
let rendered=null,source=null,trimDraft=null,ffmpeg=null;
const active=()=>['recording','paused','stopping'].includes(mode);
const busy=()=>loading||active()||acquiring||!!operation;
const recordingSeconds=()=>elapsed+(mode==='recording'?(performance.now()-startedAt)/1000:0);
const clock=(seconds,fraction=false)=>{const ms=Math.floor(Math.max(0,seconds||0)*100),mins=Math.floor(ms/6000),secs=Math.floor(ms/100)%60;return `${String(mins).padStart(2,'0')}:${String(secs).padStart(2,'0')}${fraction?'.'+String(ms%100).padStart(2,'0'):''}`;};
function displayTime(seconds){const [whole,part]=clock(seconds,true).split('.');ui.time.innerHTML=`${whole}<span>.${part}</span>`;}
function notice(message,success=false){ui.notice.textContent=t(message);ui.notice.hidden=!message;ui.notice.classList.toggle('success',success);}
function saveStatus(message,warning=false){ui['save-status'].textContent=t(message);ui['save-status'].hidden=!message;ui['save-status'].classList.toggle('warning',warning);}
function nextName(){let n=1;for(const clip of [...clips,...deleted]){const match=/^(?:Recording |录音 )(\d+)(?: \(recovered\)|（已恢复）)?$/.exec(clip.title);if(match)n=Math.max(n,Number(match[1])+1);}return t('Recording {number}',{number:n});}
function clipLength(clip){return (clip.trim?clip.trim.end-clip.trim.start:clip.duration)+(clip.effect==='echo'?.39:0);}
async function persist(clip){
  try{await store.save(clip);clip.persisted=true;if(selected===clip)saveStatus(t('Saved in this browser · no cloud backup'));renderList();return true;}
  catch{clip.persisted=false;if(selected===clip)saveStatus(t('Not saved · export before closing this tab'),true);notice(t('Browser storage could not save this recording. Export it before closing this tab.'));renderList();return false;}
}
async function openStorage(){
  try{
    await store.open();let recovered=[];
    try{recovered=await store.recover();}catch{notice(t('An interrupted take could not be restored yet. Free some browser storage and reload to try again.'));}
    const all=(await store.list()).map(clip=>({...clip,url:URL.createObjectURL(clip.blob),persisted:true})).sort((a,b)=>b.created-a.created);
    clips=all.filter(c=>!c.deletedAt);deleted=all.filter(c=>c.deletedAt);
    for(const clip of [...deleted])if(Date.now()-clip.deletedAt>30*86400000){try{await store.remove(clip.id);deleted=deleted.filter(c=>c.id!==clip.id);URL.revokeObjectURL(clip.url);}catch{}}
    if(recovered.length)notice(t('Recovered {count} interrupted recordings. The final unsaved moments may be missing.',{count:recovered.length}),true);
    if(!store.recovery||!navigator.locks)notice(t('Recovery while recording is unavailable in this browser. Export important recordings after stopping.'));
  }catch{notice(t('Browser storage is unavailable. Recordings will stay in this tab only; export before closing it.'));}
  finally{loading=false;ui.title.value=nextName();renderList();updateControls();}
}
function renderList(){
  ui['recording-list'].replaceChildren();ui.count.textContent=clips.length;ui.empty.hidden=clips.length>0;
  const query=$('search').value.trim().toLocaleLowerCase(language),visible=clips.filter(c=>c.title.toLocaleLowerCase(language).includes(query));
  $('no-results').hidden=!query||visible.length>0;
  for(const clip of visible){
    const button=document.createElement('button');button.className='recording-item'+(selected?.id===clip.id?' selected':'');button.disabled=busy();button.setAttribute('aria-pressed',String(selected?.id===clip.id));
    const title=document.createElement('strong');title.textContent=clip.title;
    const meta=document.createElement('span');meta.className='recording-meta';const date=document.createElement('span');
    date.textContent=clip.persisted?new Intl.DateTimeFormat(language,{month:'short',day:'numeric'}).format(clip.created):t('Not saved');if(!clip.persisted)date.className='unsaved';
    const len=document.createElement('span');len.textContent=clock(clipLength(clip));meta.append(date,len);button.append(title,meta);button.addEventListener('click',()=>selectClip(clip));ui['recording-list'].append(button);
  }
}
function clearRendered(){if(rendered)URL.revokeObjectURL(rendered.url);rendered=null;}
function resetPlayback(){ui.audio.pause();ui.audio.removeAttribute('src');ui.audio.load();cancelAnimationFrame(animation);source=null;}
function renderKey(clip,effect=clip.effect||'none',trim=clip.trim||null,enhance=clip.enhance||false){return JSON.stringify([clip.id,effect,trim?.start||0,trim?.end??null,enhance]);}
function attachAudio(clip,processed=null,editing=false){
  ui.audio.pause();const trim=editing?trimDraft:processed?null:clip.trim;
  source={url:processed?.url||clip.url,processed:!!processed,start:trim?.start||0,end:trim?.end??processed?.duration??clip.duration,peaks:processed?.peaks||clip.peaks||[]};
  duration=source.end-source.start;ui.audio.src=source.url;ui.audio.playbackRate=Number($('speed').value);ui.seek.max=duration;ui.seek.value=0;
  if(source.start)ui.audio.currentTime=source.start;displayTime(0);drawWave();updateControls();
}
function selectedAudio(){return rendered?.key===renderKey(selected)?rendered:null;}
function selectClip(clip){
  if(busy())return;$('adjustments').open=false;shareFile=null;resetPlayback();clearRendered();trimDraft=null;selected=clip;mode='playback';ui.title.value=clip.title;
  ui.metadata.textContent=new Intl.DateTimeFormat(language,{month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}).format(clip.created);
  notice('');saveStatus(clip.persisted?t('Saved in this browser · no cloud backup'):t('Not saved · export before closing this tab'),!clip.persisted);attachAudio(clip);renderList();
}
function newRecording(){
  if(busy())return;$('adjustments').open=false;shareFile=null;resetPlayback();clearRendered();trimDraft=null;selected=null;mode='idle';duration=0;peaks=[];
  ui.title.value=nextName();ui.metadata.textContent=t('Not recorded yet');notice('');saveStatus('');displayTime(0);renderList();updateControls();drawWave();
}
function updateControls(){
  const isActive=active(),playback=mode==='playback',blocked=busy(),editing=!!trimDraft;
  for(const id of ['language','search','backup','restore','appearance','undo-delete'])$(id).disabled=blocked;
  $('backup').disabled=blocked||!clips.length;
  for(const button of $('deleted-list').querySelectorAll('button'))button.disabled=blocked;
  $('playback-options').hidden=!playback;$('speed').disabled=blocked;
  $('enhance').checked=selected?.enhance||false;$('enhance').disabled=blocked||editing;
  $('share').hidden=!playback||typeof navigator.share!=='function';$('share').disabled=blocked||editing;
  $('share').textContent=t(shareFile?'Share MP4':'Prepare to share');
  $('adjustments').hidden=!playback;$('adjustments-status').textContent=selected&&(selected.enhance||selected.effect&&selected.effect!=='none')?t('On'):'';

  ui.effect.value=selected?.effect||'none';ui.effect.disabled=!playback||blocked||editing;
  ui.effect.closest('.effects-row').dataset.active=String(ui.effect.value!=='none');
  ui['effect-hint'].textContent=editing?t('Trim preview: original voice'):!playback?t('Try after recording'):ui.effect.value==='none'?t('Playback & export'):t('Original kept');
  for(const id of ['new','quick-new','title','rename','microphone','refresh'])ui[id].disabled=blocked;
  ui.record.hidden=playback;ui.record.disabled=loading||acquiring||mode==='stopping'||!!operation;ui.record.classList.toggle('recording',isActive);ui.record.setAttribute('aria-label',isActive?t('Stop recording'):t('Start recording'));
  ui.play.hidden=!playback;ui.play.disabled=blocked;ui.pause.hidden=!isActive||mode==='stopping';ui.pause.setAttribute('aria-label',mode==='paused'?t('Resume recording'):t('Pause recording'));ui.pause.innerHTML=`<svg><use href="#i-${mode==='paused'?'play':'pause'}"/></svg>`;
  for(const id of ['back','forward','delete']){ui[id].hidden=!playback;ui[id].disabled=blocked;}
  ui.delete.disabled=blocked||editing;ui.export.disabled=!playback||blocked||editing;ui.seek.hidden=!playback||editing;ui.seek.disabled=blocked;
  ui['clip-actions'].hidden=!playback;ui['quick-new'].disabled=blocked;ui['trim-toggle'].disabled=blocked;ui['trim-toggle'].textContent=editing?t('Trimming…'):selected?.trim?t('Edit trim'):t('Trim');ui['trim-toggle'].setAttribute('aria-expanded',String(editing));
  for(const id of ['trim-panel','trim-handles','trim-selection'])ui[id].hidden=!editing;
  for(const id of ['trim-start','trim-end','trim-reset','trim-cancel','trim-apply'])ui[id].disabled=!!operation;
  ui['state-label'].textContent=operation?t('Processing…'):loading?t('Loading recordings…'):acquiring?t('Waiting for microphone…'):mode==='recording'?t('Recording'):mode==='paused'?t('Paused'):mode==='stopping'?t('Saving recording…'):editing?t('Trim recording'):playback?(ui.audio.paused?t('Ready to listen'):t('Playing')):t('Ready to record');
  ui['state-label'].classList.toggle('active',mode==='recording');ui['control-label'].textContent=acquiring?t('Allow access'):isActive?t('Stop'):playback?(ui.audio.paused?t('Play'):t('Pause')):t('Record');
  ui.play.setAttribute('aria-label',ui.audio.paused?t('Play recording'):t('Pause playback'));ui.play.innerHTML=`<svg><use href="#i-${ui.audio.paused?'play':'pause'}"/></svg>`;
  ui['recorder-hint'].textContent=isActive?(mode==='paused'?t('Pick up where you left off.'):t('Listening. Make it yours.')):editing?t('Play to check the selected part.'):playback?`${clock(clipLength(selected))} · ${selected?.microphone||t('Audio recording')}`:t('Press record. Take your time.');
  for(const button of ui['recording-list'].children)button.disabled=blocked;
}
async function enumerateMicrophones(){
  if(!navigator.mediaDevices?.enumerateDevices)return;
  const chosen=ui.microphone.value==='__enable'?'':ui.microphone.value,devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audioinput');
  ui.microphone.replaceChildren(new Option(t('System default'),''));
  for(const [i,device] of devices.entries())if(device.deviceId&&device.deviceId!=='default')ui.microphone.add(new Option(device.label||t('Microphone {number}',{number:i+1}),device.deviceId));
  if([...ui.microphone.options].some(o=>o.value===chosen))ui.microphone.value=chosen;
  if(!devices.some(d=>d.label)){ui.microphone.add(new Option(t('Choose a microphone…'),'__enable'));ui['mic-hint'].textContent=t('Allow microphone access to choose an input.');}else ui['mic-hint'].textContent=t('Choose your input before recording.');
}
function microphoneError(error){const messages={NotAllowedError:t('Microphone access is blocked. Allow it in your browser’s site settings, then try again.'),NotFoundError:t('No microphone was found. Connect a microphone and refresh the list.'),NotReadableError:t('This microphone is unavailable. Close other apps using it, or choose another input.'),OverconstrainedError:t('That microphone is no longer available. Refresh the list and choose another input.'),SecurityError:t('Microphone access is unavailable. Open this page in a secure browser tab.')};notice(messages[error.name]||t('Could not start the microphone. Check your input and try again.'));}
async function enableMicrophones(){
  if(busy())return;acquiring=true;updateControls();notice('');let temporary;
  try{temporary=await navigator.mediaDevices.getUserMedia({audio:true});await enumerateMicrophones();notice(t('Microphones are ready. Choose an input below.'),true);}catch(error){microphoneError(error);}finally{temporary?.getTracks().forEach(t=>t.stop());acquiring=false;updateControls();}
}
function releaseMicrophone(){wakeLock?.release().catch(()=>{});wakeLock=null;stream?.getTracks().forEach(t=>t.stop());stream=null;context?.close().catch(()=>{});context=null;analyser=null;}
function compactPeaks(values){const result=[],step=Math.max(1,Math.ceil(values.length/2000));for(let i=0;i<values.length;i+=step){let peak=0;for(let j=i;j<Math.min(values.length,i+step);j++)peak=Math.max(peak,values[j]);result.push(peak);}return result;}
function queueChunk(blob){
  if(!blob.size)return;chunks.push(blob);
  if(!navigator.locks){saveStatus(t('Recovery unavailable · export after stopping'),true);return;}
  const seconds=mode==='stopping'?duration:recordingSeconds();
  pendingChunks.push({blob,sequence:sequence++,draft:{...take,duration:Math.max(.01,seconds),peaks:compactPeaks(peaks),updated:Date.now()}});
  journal=journal.then(async()=>{
    try{
      while(pendingChunks.length){const entry=pendingChunks[0];await store.appendDraft(entry.draft,entry.blob,entry.sequence);pendingChunks.shift();
        if(mode!=='stopping'&&(entry.draft.duration-lastSavedStatus>=5||recoveryWarning)){lastSavedStatus=entry.draft.duration;saveStatus(t('Recovery saved through {time}',{time:clock(entry.draft.duration)}));}
      }
      recoveryWarning=false;
    }catch{if(!recoveryWarning)saveStatus(t('Recovery unavailable · keep this tab open until you export'),true);recoveryWarning=true;}
  });
}
async function startRecording(){
  if(busy())return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder){notice(t('Recording is unavailable in this browser. Open this site in a current browser over HTTPS.'));return;}
  notice('');acquiring=true;updateControls();
  try{
    context=new(window.AudioContext||window.webkitAudioContext)();await context.resume();
    const deviceId=ui.microphone.value;stream=await navigator.mediaDevices.getUserMedia({audio:deviceId?{deviceId:{exact:deviceId}}:true});
    await enumerateMicrophones();const microphone=stream.getAudioTracks()[0]?.label||t('System default');
    const mimeType=['audio/mp4;codecs=mp4a.40.2','audio/webm;codecs=opus','audio/ogg;codecs=opus','audio/mp4'].find(t=>MediaRecorder.isTypeSupported(t));
    recorder=new MediaRecorder(stream,mimeType?{mimeType,audioBitsPerSecond:128000}:{});chunks=[];peaks=[];elapsed=0;duration=0;pendingChunks=[];sequence=0;journal=Promise.resolve();recoveryWarning=false;lastSavedStatus=-10;
    take={language,id:crypto.randomUUID(),title:ui.title.value.trim()||nextName(),created:Date.now(),microphone,mime:recorder.mimeType||mimeType||'audio/webm'};
    releaseTake=await holdTake(take.id);ui.title.value=take.title;
    analyser=context.createAnalyser();analyser.fftSize=1024;context.createMediaStreamSource(stream).connect(analyser);
    recorder.ondataavailable=event=>queueChunk(event.data);recorder.onstop=finishRecording;
    recorder.onerror=()=>{notice(t('Recording was interrupted. Saving the audio captured so far.'));stopRecording();};
    for(const track of stream.getTracks())track.addEventListener('ended',()=>{if(['recording','paused'].includes(mode)){notice(t('The microphone disconnected. Saving your recording.'));stopRecording();}});
    recorder.start(1000);mode='recording';keepAwake();startedAt=performance.now();sampleAt=0;ui.metadata.textContent=t('Recording from {microphone}',{microphone});saveStatus(t('Preparing recovery…'));renderList();tick();
  }catch(error){releaseMicrophone();releaseTake?.();releaseTake=null;mode='idle';recorder=null;microphoneError(error);}finally{acquiring=false;updateControls();}
}
function flushRecorder(){if(recorder&&recorder.state!=='inactive')try{recorder.requestData();}catch{}}
function togglePause(){
  if(mode==='recording'){elapsed=recordingSeconds();recorder.pause();mode='paused';flushRecorder();}
  else if(mode==='paused'){recorder.resume();startedAt=performance.now();mode='recording';}
  updateControls();
}
function stopRecording(){if(!recorder||!['recording','paused'].includes(mode))return;duration=recordingSeconds();mode='stopping';updateControls();cancelAnimationFrame(animation);if(recorder.state!=='inactive')recorder.stop();releaseMicrophone();}
async function finishRecording(){
  if(mode!=='stopping'){duration=recordingSeconds();mode='stopping';releaseMicrophone();cancelAnimationFrame(animation);updateControls();}
  const blob=new Blob(chunks,{type:take.mime});chunks=[];recorder=null;
  await journal;
  if(!blob.size){releaseTake?.();releaseTake=null;mode='idle';updateControls();saveStatus('');notice(t('No audio was captured. Try recording again.'));return;}
  const clip={...take,duration:Math.max(.01,duration),blob,peaks:compactPeaks(peaks),effect:'none',persisted:false,url:URL.createObjectURL(blob)};
  clips.unshift(clip);const saved=await persist(clip);
  if(saved)await store.clearDraft(clip.id).catch(()=>{});
  pendingChunks=[];take=null;releaseTake?.();releaseTake=null;mode='idle';selectClip(clip);
  if(!saved)notice(t('This recording could not be saved. Export it before closing this tab.'));
}
function tick(){
  if(!active())return;displayTime(recordingSeconds());
  if(mode==='recording'&&analyser&&performance.now()-sampleAt>100){const values=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(values);let sum=0;for(const value of values)sum+=value*value;peaks.push(Math.min(1,Math.sqrt(sum/values.length)*4));sampleAt=performance.now();}
  drawWave();animation=requestAnimationFrame(tick);
}
function drawWave(){
  const width=canvas.clientWidth,height=canvas.clientHeight;if(!width||!height)return;const ratio=window.devicePixelRatio||1;
  if(canvas.width!==Math.round(width*ratio)||canvas.height!==Math.round(height*ratio)){canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);}
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
  const playback=mode==='playback',values=playback?source?.peaks||selected?.peaks||[]:peaks,count=Math.max(1,Math.floor(width/5));
  const progress=playback?(trimDraft?ui.audio.currentTime/(selected.duration||1):(ui.audio.currentTime-(source?.start||0))/(duration||1)):0;
  // Before processed audio is ready, show only the retained section of the original.
  const fromFraction=playback&&!trimDraft&&!source?.processed?(source?.start||0)/(selected.duration||1):0;
  const toFraction=playback&&!trimDraft&&!source?.processed?(source?.end||selected.duration)/(selected.duration||1):1;
  for(let i=0;i<count;i++){
    let value=0;
    if(playback&&values.length){const from=Math.floor((fromFraction+i/count*(toFraction-fromFraction))*values.length),to=Math.max(from+1,Math.floor((fromFraction+(i+1)/count*(toFraction-fromFraction))*values.length));for(let j=from;j<to&&j<values.length;j++)value=Math.max(value,values[j]);}
    else if(active()){const at=values.length-Math.floor(count/2)+i;value=i<count/2?values[at]||0:0;}
    const bar=Math.max(2,value*(height-12));ctx.fillStyle=playback?(i/count<=progress?'#ed4447':'#c5c7d0'):active()&&i<count/2?'#ed4447':'#e4e5eb';ctx.beginPath();ctx.roundRect(i*5,(height-bar)/2,2,bar,1);ctx.fill();
  }
  const total=trimDraft?selected.duration:playback?duration:active()?recordingSeconds():0;
  ui['tick-start'].textContent='00:00';ui['tick-middle'].textContent=clock(total/2);ui['tick-end'].textContent=clock(total);
  document.querySelector('.playhead').style.left=playback?`${Math.max(0,Math.min(1,progress))*100}%`:'50%';
}
function playbackTick(){
  if(mode!=='playback'||!source)return;
  if(ui.audio.currentTime>=source.end&&!ui.audio.paused){ui.audio.pause();ui.audio.currentTime=source.end;}
  const at=Math.max(0,Math.min(duration,ui.audio.currentTime-source.start));displayTime(at);ui.seek.value=at;drawWave();
  if(!ui.audio.paused){cancelAnimationFrame(animation);animation=requestAnimationFrame(playbackTick);}
}
function seekTo(value){if(!selected||!source||operation)return;ui.audio.currentTime=source.start+Math.max(0,Math.min(duration,value));playbackTick();}
const aborted=()=>new DOMException('Cancelled','AbortError');
function check(op){if(op.signal.aborted)throw op.signal.reason||aborted();}
function progress(op,label,value=null){check(op);ui['processing-label'].textContent=t(label);if(value===null)ui['processing-progress'].removeAttribute('value');else ui['processing-progress'].value=Math.max(0,Math.min(100,value));}
function abortable(promise,op){
  check(op);return new Promise((resolve,reject)=>{const cancel=()=>reject(op.signal.reason||aborted());op.signal.addEventListener('abort',cancel,{once:true});Promise.resolve(promise).then(resolve,reject).finally(()=>op.signal.removeEventListener('abort',cancel));});
}
async function runOperation(label,task,errorMessage){
  if(operation)return null;
  const controller=new AbortController(),op={controller,signal:controller.signal,committed:false};operation=op;ui.audio.pause();notice('');ui.processing.hidden=false;ui['cancel-process'].disabled=false;progress(op,label);updateControls();
  const timer=setTimeout(()=>controller.abort(new Error('Processing took too long. Please try a shorter recording.')),180000);
  try{return await task(op);}catch(error){if(!op.signal.aborted)controller.abort(error);if(error.name==='AbortError')notice(t('Cancelled. Your recording is unchanged.'));else{console.error(error);notice(errorMessage||t('Processing could not finish. Your original recording is safe. Try again.'));}return null;}
  finally{clearTimeout(timer);operation=null;ui.processing.hidden=true;updateControls();}
}
function commit(op){check(op);op.committed=true;ui['cancel-process'].disabled=true;}
async function renderClip(clip,effect,trim,op,enhance=clip.enhance||false){
  if(effect==='none'&&!trim&&!enhance)return null;
  const key=renderKey(clip,effect,trim,enhance);if(rendered?.key===key)return rendered;
  progress(op,t('Reading audio…'));let decoder;
  try{
    decoder=new(window.AudioContext||window.webkitAudioContext)({sampleRate:effect==='none'?48000:24000});
    const buffer=await abortable(decoder.decodeAudioData(await abortable(clip.blob.arrayBuffer(),op)),op);check(op);
    const channels=Array.from({length:buffer.numberOfChannels},(_,ch)=>buffer.getChannelData(ch).slice());
    progress(op,effect!=='none'?t('Applying voice effect…'):enhance?t('Evening out volume…'):t('Trimming audio…'));
    const result=await new Promise((resolve,reject)=>{
      const worker=new Worker(new URL('./audio-processing.js',import.meta.url),{type:'module'});
      const done=()=>{worker.terminate();op.signal.removeEventListener('abort',cancel);};
      const cancel=()=>{done();reject(op.signal.reason||aborted());};op.signal.addEventListener('abort',cancel,{once:true});
      worker.onmessage=({data})=>{if(data.progress){progress(op,data.progress);return;}done();data.error?reject(new Error(data.error)):resolve(data);};
      worker.onerror=event=>{event.preventDefault();done();reject(new Error('Audio processor could not load'));};
      worker.postMessage({channels,sampleRate:buffer.sampleRate,effect,trim,enhance},channels.map(channel=>channel.buffer));
    });
    check(op);return {...result,key,blob:new Blob([result.buffer],{type:'audio/wav'}),url:null};
  }finally{decoder?.close().catch(()=>{});}
}
function acceptRendered(result){if(rendered!==result){clearRendered();rendered=result;if(result){result.url=URL.createObjectURL(result.blob);delete result.buffer;}}}
async function prepareSelected(op){const result=await renderClip(selected,selected.effect||'none',selected.trim||null,op);acceptRendered(result);attachAudio(selected,result);return result?.blob||selected.blob;}
async function togglePlayback(){
  if(!selected||busy())return;
  if(!ui.audio.paused){ui.audio.pause();return;}
  if(!trimDraft&&(selected.trim||selected.enhance||selected.effect&&selected.effect!=='none')&&!selectedAudio()){
    const ok=await runOperation(t('Preparing playback…'),async op=>{await prepareSelected(op);return true;});if(!ok)return;
  }
  if(ui.audio.currentTime<source.start||ui.audio.currentTime>=source.end-.02)ui.audio.currentTime=source.start;
  try{await ui.audio.play();notice('');}catch{notice(t('Playback could not start. Try pressing play again.'));}updateControls();
}
async function changeEffect(){
  if(!selected||busy()||trimDraft)return;const clip=selected,effect=ui.effect.value;
  await runOperation(t('Applying voice effect…'),async op=>{const result=await renderClip(clip,effect,clip.trim||null,op);commit(op);shareFile=null;clip.effect=effect;acceptRendered(result);attachAudio(clip,result);await persist(clip);});
}
function updateTrim(){
  ui.audio.pause();source.start=trimDraft.start;source.end=trimDraft.end;duration=source.end-source.start;ui.audio.currentTime=source.start;
  ui['trim-start'].value=trimDraft.start;ui['trim-end'].value=trimDraft.end;
  ui['trim-start-label'].textContent=clock(trimDraft.start,true);ui['trim-end-label'].textContent=clock(trimDraft.end,true);ui['trim-length'].textContent=t('{time} selected',{time:clock(duration,true)});
  ui['trim-start'].setAttribute('aria-valuetext',clock(trimDraft.start,true));ui['trim-end'].setAttribute('aria-valuetext',clock(trimDraft.end,true));
  ui['trim-selection'].style.left=`${trimDraft.start/selected.duration*100}%`;ui['trim-selection'].style.width=`${duration/selected.duration*100}%`;displayTime(0);drawWave();
}
function openTrim(){
  if(!selected||busy())return;if(trimDraft){cancelTrim();return;}
  trimDraft={start:selected.trim?.start||0,end:selected.trim?.end??selected.duration};
  for(const id of ['trim-start','trim-end'])ui[id].max=selected.duration;
  attachAudio(selected,null,true);updateTrim();updateControls();notice('');
}
function cancelTrim(){if(operation)return;trimDraft=null;attachAudio(selected,selectedAudio());updateControls();}
function changeTrim(edge){const min=Math.min(.1,selected.duration);if(edge==='start')trimDraft.start=Math.max(0,Math.min(Number(ui['trim-start'].value),trimDraft.end-min));else trimDraft.end=Math.min(selected.duration,Math.max(Number(ui['trim-end'].value),trimDraft.start+min));updateTrim();}
async function applyTrim(){
  if(!trimDraft||busy())return;const clip=selected,trim=trimDraft.start<.005&&Math.abs(trimDraft.end-clip.duration)<.005?null:{...trimDraft};
  await runOperation(t('Applying trim…'),async op=>{const result=await renderClip(clip,clip.effect||'none',trim,op);commit(op);shareFile=null;clip.trim=trim;trimDraft=null;acceptRendered(result);attachAudio(clip,result);await persist(clip);});
}
async function getEncoder(op){
  if(ffmpeg)return ffmpeg;if(!window.FFmpegWASM)throw new Error('Audio exporter could not load');
  const encoder=new window.FFmpegWASM.FFmpeg();const terminate=()=>{encoder.terminate();if(ffmpeg===encoder)ffmpeg=null;};op.signal.addEventListener('abort',terminate,{once:true});
  let wasmURL;
  try{
    let loaded=0;progress(op,t('Loading MP4 exporter (first use)…'),0);
    const buffers=await Promise.all([0,1,2,3,4].map(async part=>{const response=await fetch(new URL(`vendor/ffmpeg/ffmpeg-core.wasm.${part}`,document.baseURI),{signal:op.signal});if(!response.ok)throw new Error('Audio exporter could not load');const buffer=await response.arrayBuffer();loaded++;progress(op,t('Loading MP4 exporter · {count} of 5 parts',{count:loaded}),loaded/5*100);return buffer;}));
    wasmURL=URL.createObjectURL(new Blob(buffers,{type:'application/wasm'}));progress(op,t('Starting MP4 exporter…'));
    await abortable(encoder.load({coreURL:new URL('vendor/ffmpeg/ffmpeg-core.js',document.baseURI).href,wasmURL}),op);check(op);ffmpeg=encoder;return encoder;
  }catch(error){terminate();throw error;}finally{op.signal.removeEventListener('abort',terminate);if(wasmURL)URL.revokeObjectURL(wasmURL);}
}
function filename(title,extension){return (title.replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').trim()||'Memos')+'.'+extension;}
function download(blob,title,extension='mp4'){const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=filename(title,extension);document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
async function exportMP4(shouldDownload=true){
  if(!selected||busy()||trimDraft)return;const clip=selected;
  await runOperation(t('Preparing MP4…'),async op=>{
    let result=await prepareSelected(op);
    if(!result.type.includes('mp4')){
      const encoder=await getEncoder(op);const terminate=()=>{encoder.terminate();if(ffmpeg===encoder)ffmpeg=null;};op.signal.addEventListener('abort',terminate,{once:true});
      const onProgress=({progress:value})=>{if(!op.signal.aborted)progress(op,t('Exporting MP4 · {percent}%',{percent:Math.min(99,Math.max(0,Math.round(value*100)))}),value*100);};encoder.on('progress',onProgress);
      try{
        progress(op,t('Encoding MP4…'),0);await abortable(encoder.writeFile('input-audio',new Uint8Array(await abortable(result.arrayBuffer(),op))),op);
        const code=await abortable(encoder.exec(['-i','input-audio','-vn','-c:a','aac','-b:a','128k','-movflags','+faststart','-f','mp4','output.mp4'],120000),op);
        if(code!==0)throw new Error('MP4 encoding failed');const output=await abortable(encoder.readFile('output.mp4'),op);result=new Blob([output],{type:'audio/mp4'});
      }catch(error){terminate();throw error;}finally{encoder.off('progress',onProgress);op.signal.removeEventListener('abort',terminate);if(ffmpeg===encoder){await encoder.deleteFile('input-audio').catch(()=>{});await encoder.deleteFile('output.mp4').catch(()=>{});}}
    }
    commit(op);const title=clip.title+(clip.effect&&clip.effect!=='none'?' — '+ui.effect.selectedOptions[0].textContent:'');shareFile=new File([result],filename(title,'mp4'),{type:'audio/mp4'});if(shouldDownload)download(result,title);notice(t(shouldDownload?'MP4 is ready. Your download has started.':'MP4 is ready. Choose Share MP4 to pick a destination.'),true);
  },t('MP4 export could not finish. Your recording is still here. Try again, or use a desktop browser for a long recording.'));
}
ui.record.addEventListener('click',()=>active()?stopRecording():startRecording());ui.pause.addEventListener('click',togglePause);
ui.new.addEventListener('click',newRecording);ui['quick-new'].addEventListener('click',newRecording);ui.play.addEventListener('click',togglePlayback);ui.export.addEventListener('click',()=>exportMP4());ui.refresh.addEventListener('click',enableMicrophones);ui.effect.addEventListener('change',changeEffect);
ui['cancel-process'].addEventListener('click',()=>{if(operation&&!operation.committed)operation.controller.abort(aborted());});
ui.rename.addEventListener('click',()=>{ui.title.focus();ui.title.select();});ui.title.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing)ui.title.blur();});
ui.title.addEventListener('change',async()=>{const title=ui.title.value.trim()||(selected?.title||nextName());ui.title.value=title;if(selected){shareFile=null;selected.title=title;updateControls();renderList();await persist(selected);}});
ui.microphone.addEventListener('change',()=>{if(ui.microphone.value==='__enable'){ui.microphone.value='';enableMicrophones();}else notice('');});
ui.back.addEventListener('click',()=>seekTo(ui.audio.currentTime-(source?.start||0)-10));ui.forward.addEventListener('click',()=>seekTo(ui.audio.currentTime-(source?.start||0)+10));ui.seek.addEventListener('input',()=>seekTo(Number(ui.seek.value)));
ui['trim-toggle'].addEventListener('click',openTrim);ui['trim-cancel'].addEventListener('click',cancelTrim);ui['trim-apply'].addEventListener('click',applyTrim);ui['trim-start'].addEventListener('input',()=>changeTrim('start'));ui['trim-end'].addEventListener('input',()=>changeTrim('end'));ui['trim-reset'].addEventListener('click',()=>{trimDraft={start:0,end:selected.duration};updateTrim();});
ui.audio.addEventListener('play',()=>{cancelAnimationFrame(animation);updateControls();playbackTick();});ui.audio.addEventListener('pause',()=>{if(mode==='playback'){updateControls();playbackTick();}});ui.audio.addEventListener('ended',()=>{updateControls();playbackTick();});ui.audio.addEventListener('timeupdate',playbackTick);
ui.audio.addEventListener('loadedmetadata',()=>{
  if(!selected||!source)return;
  if(!source.processed&&Number.isFinite(ui.audio.duration)&&ui.audio.duration>0){selected.duration=ui.audio.duration;if(!trimDraft&&!selected.trim){source.end=ui.audio.duration;duration=source.end;ui.seek.max=duration;}if(trimDraft){for(const id of ['trim-start','trim-end'])ui[id].max=selected.duration;}}
  if(source.start)ui.audio.currentTime=source.start;drawWave();
});
ui.audio.addEventListener('error',()=>{if(selected&&ui.audio.getAttribute('src'))notice(t('This browser cannot play this recording. You can still try exporting it as MP4.'));});
ui.delete.addEventListener('click',()=>{ui.audio.pause();ui['delete-message'].textContent=t('“{title}” will move to Recently deleted for 30 days.',{title:selected.title});ui['delete-dialog'].showModal();});
ui['delete-dialog'].addEventListener('close',async()=>{
  if(ui['delete-dialog'].returnValue!=='delete'||!selected||busy())return;const clip=selected;
  await runOperation(t('Saving recording…'),async op=>{
    const deletedClip={...clip,deletedAt:Date.now()};commit(op);
    if(store.db)await store.save(deletedClip);
    clips=clips.filter(c=>c.id!==clip.id);deleted.unshift(deletedClip);undoClip=deletedClip;
    clearTimeout(undoTimer);$('undo-bar').hidden=false;undoTimer=setTimeout(()=>{$('undo-bar').hidden=true;undoClip=null;},12000);
  },t('This recording could not be deleted. Try again.'));
  if(!clips.includes(clip))newRecording();renderDeleted();
});
window.addEventListener('beforeunload',event=>{if(active()||acquiring||operation||clips.some(clip=>!clip.persisted)){event.preventDefault();event.returnValue='';}});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')flushRecorder();});
navigator.mediaDevices?.addEventListener('devicechange',()=>enumerateMicrophones().catch(()=>{}));new ResizeObserver(drawWave).observe(canvas);
if(document.modelContext?.registerTool){
  const lifecycle=new AbortController();
  for(const tool of [
    {name:'list_recordings',title:'List recordings',description:'Read recordings saved in this browser, including their IDs, names, and durations.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true,untrustedContentHint:true},execute:async input=>{if(!input||Object.keys(input).length)throw new Error('Expected an empty object');return clips.map(clip=>({id:clip.id,title:clip.title,duration:clipLength(clip)}));}},
    {name:'select_recording',title:'Select a recording',description:'Open an existing recording in the player without starting playback or recording.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:true},execute:async input=>{if(!input||typeof input.id!=='string'||Object.keys(input).some(key=>key!=='id'))throw new Error('A recording ID is required');if(busy())throw new Error('The recorder is busy');const clip=clips.find(clip=>clip.id===input.id);if(!clip)throw new Error('Recording not found');selectClip(clip);return {id:clip.id,title:clip.title,selected:true};}}
  ])try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
function renderDeleted(){
  const list=$('deleted-list');list.replaceChildren();
  if(!deleted.length){const p=document.createElement('p');p.textContent=t('No recently deleted recordings');list.append(p);}
  for(const clip of deleted){
    const row=document.createElement('div');row.className='deleted-item';const name=document.createElement('span');name.textContent=clip.title;
    const button=document.createElement('button');button.className='text-button';button.textContent=t('Restore');button.disabled=busy();button.addEventListener('click',()=>restoreDeleted(clip));row.append(name,button);list.append(row);
  }
}
async function restoreDeleted(clip){
  if(busy())return;$('settings-dialog').close();
  const ok=await runOperation(t('Saving recording…'),async op=>{
    const restored={...clip};delete restored.deletedAt;commit(op);if(store.db)await store.save(restored);
    restored.persisted=!!store.db;deleted=deleted.filter(c=>c.id!==clip.id);clips.unshift(restored);clips.sort((a,b)=>b.created-a.created);
    if(undoClip?.id===clip.id){undoClip=null;clearTimeout(undoTimer);$('undo-bar').hidden=true;}
    renderList();return restored;
  },t('Could not restore this recording. Try again.'));
  if(ok){selectClip(ok);notice(t('Recording restored.'),true);}renderDeleted();
}
function applyAppearance(){
  const appearance=preference('appearance','system');$('appearance').value=['system','light','dark'].includes(appearance)?appearance:'system';
  document.documentElement.dataset.theme=(appearance==='dark'||appearance!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
  document.querySelector('meta[name="theme-color"]').content=document.documentElement.dataset.theme==='dark'?'#17181b':'#f7f7f8';drawWave();
}
function storageUsage(){const size=[...clips,...deleted].reduce((n,c)=>n+c.blob.size,0)/1024/1024;$('storage-usage').textContent=t('{size} MB of recording audio in this browser',{size:new Intl.NumberFormat(language,{maximumFractionDigits:1}).format(size)});}
$('settings-open').addEventListener('click',()=>{renderDeleted();storageUsage();$('settings-dialog').showModal();});
$('settings-close').addEventListener('click',()=>$('settings-dialog').close());
$('appearance').addEventListener('change',()=>{savePreference('appearance',$('appearance').value);applyAppearance();});
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyAppearance);
$('language').addEventListener('change',async()=>{
  if(busy())return;
  const oldDefault=nextName(),wasDefault=!selected&&ui.title.value===oldDefault;
  setLanguage($('language').value);notice('');
  if(wasDefault)ui.title.value=nextName();
  ui.metadata.textContent=selected?new Intl.DateTimeFormat(language,{month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}).format(selected.created):t('Not recorded yet');
  if(selected)saveStatus(selected.persisted?t('Saved in this browser · no cloud backup'):t('Not saved · export before closing this tab'),!selected.persisted);
  renderList();renderDeleted();storageUsage();if(trimDraft)updateTrim();updateControls();offline.refresh();await enumerateMicrophones().catch(()=>{});
});
$('search').addEventListener('input',renderList);
$('undo-delete').addEventListener('click',()=>{if(undoClip)restoreDeleted(undoClip);});
$('speed').value=['0.75','1','1.5','2'].includes(preference('speed','1'))?preference('speed','1'):'1';
$('speed').addEventListener('change',()=>{ui.audio.playbackRate=Number($('speed').value);savePreference('speed',$('speed').value);});
$('enhance').addEventListener('change',async()=>{
  if(!selected||busy()||trimDraft)return;const clip=selected,enhance=$('enhance').checked;
  await runOperation(t('Evening out volume…'),async op=>{const result=await renderClip(clip,clip.effect||'none',clip.trim||null,op,enhance);commit(op);shareFile=null;clip.enhance=enhance;acceptRendered(result);attachAudio(clip,result);await persist(clip);});
});
$('backup').addEventListener('click',async()=>{
  if(busy()||!clips.length)return;$('settings-dialog').close();
  await runOperation(t('Preparing backup…'),async op=>{const backup=createBackup(clips);commit(op);download(backup,'Memos-'+new Date().toISOString().slice(0,10),'memos');notice(t('Backup downloaded. Keep it somewhere safe.'),true);},t('Backup could not finish. The library may exceed the 512 MB limit. Export recordings individually.'));
});
$('restore').addEventListener('click',()=>{if(!busy())$('restore-file').click();});
$('restore-file').addEventListener('change',async()=>{
  const file=$('restore-file').files[0];$('restore-file').value='';if(!file||busy())return;$('settings-dialog').close();
  await runOperation(t('Restoring backup…'),async op=>{
    const imported=await readBackup(file);check(op);
    const known=new Set((await store.list()).map(c=>c.id));check(op);const additions=imported.filter(c=>!known.has(c.id));
    commit(op);await store.restoreMany(additions);
    clips.push(...additions.map(c=>({...c,persisted:true,url:URL.createObjectURL(c.blob)})));clips.sort((a,b)=>b.created-a.created);renderList();
    notice(t('Backup restored · {count} added. Existing recordings were kept.',{count:additions.length}),true);
  },t('Could not restore this backup. Use a valid Memos backup under 512 MB and check available storage.'));
});
$('share').addEventListener('click',async()=>{
  if(busy()||!selected||trimDraft)return;
  if(!shareFile){await exportMP4(false);return;}
  if(!navigator.canShare?.({files:[shareFile]})){notice(t('Share is unavailable here. Use Export MP4 to save the file.'));return;}
  try{await navigator.share({files:[shareFile],title:selected.title});notice(t('Shared successfully.'),true);}catch(error){if(error.name!=='AbortError')notice(t('Could not share the file. Try again or use Export MP4.'));}
});
// Ask for a screen wake lock while capturing; recovery remains the fallback.
let wakeLock=null;
async function keepAwake(){if(!active()||document.visibilityState!=='visible'||wakeLock)return;try{wakeLock=await navigator.wakeLock?.request('screen');wakeLock?.addEventListener('release',()=>{wakeLock=null;});if(!active()){await wakeLock?.release();wakeLock=null;}}catch{}}
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')keepAwake();});
const offline=setupOffline();applyAppearance();

updateControls();await openStorage();await enumerateMicrophones().catch(()=>{});updateControls();drawWave();
