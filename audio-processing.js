import { applyVoiceEffect } from './effects.js';

// Work on copies. The original recording is never rewritten.
export function renderAudio(channels, sampleRate, effect='none', trim=null, progress=()=>{}) {
  const length=channels[0]?.length||0;
  if(!length)throw new Error('This recording contains no audio');
  const start=Math.min(length-1,Math.max(0,Math.round((trim?.start||0)*sampleRate)));
  const end=Math.min(length,Math.max(start+1,Math.round((trim?.end??length/sampleRate)*sampleRate)));
  let output=channels.map(channel=>channel.slice(start,end));
  if(effect!=='none') {
    progress('Applying voice effect…');
    const mono=new Float32Array(end-start);
    for(const channel of output)for(let i=0;i<mono.length;i++)mono[i]+=channel[i]/output.length;
    output=[applyVoiceEffect(mono,sampleRate,effect)];
  }
  progress('Preparing edited audio…');
  const frames=output[0].length,count=output.length,bytes=frames*count*2;
  const buffer=new ArrayBuffer(44+bytes),view=new DataView(buffer);
  const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+bytes,true);write(8,'WAVE');write(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,count,true);
  view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*count*2,true);
  view.setUint16(32,count*2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,bytes,true);
  for(let i=0;i<frames;i++)for(let ch=0;ch<count;ch++){
    const value=Math.max(-1,Math.min(1,output[ch][i]));
    view.setInt16(44+(i*count+ch)*2,value<0?value*32768:value*32767,true);
  }
  const peaks=[],step=Math.max(1,Math.ceil(frames/2000));
  for(let i=0;i<frames;i+=step){let sum=0,n=0;for(let j=i;j<Math.min(frames,i+step);j++)for(const channel of output){sum+=channel[j]*channel[j];n++;}peaks.push(Math.min(1,Math.sqrt(sum/n)*4));}
  return {buffer,peaks,duration:frames/sampleRate};
}
if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope){
  self.onmessage=({data})=>{
    try{const result=renderAudio(data.channels,data.sampleRate,data.effect,data.trim,label=>self.postMessage({progress:label}));self.postMessage(result,[result.buffer]);}
    catch(error){self.postMessage({error:error.message});}
  };
}
