// Small, local, non-destructive voice treatments. No audio leaves the browser.
export function detectPitch(samples, rate, center){
  const step=Math.max(1,Math.round(rate/12000)), analysisRate=rate/step;
  const minLag=Math.floor(analysisRate/600), maxLag=Math.ceil(analysisRate/70), windowSize=288;
  const frame=new Float32Array(windowSize+maxLag+2);
  let energy=0,mean=0;
  for(let i=0;i<frame.length;i++){const at=Math.round(center+(i-frame.length/2)*step);frame[i]=samples[at]||0;mean+=frame[i];}
  mean/=frame.length;
  for(let i=0;i<frame.length;i++){frame[i]-=mean;energy+=frame[i]*frame[i];}
  if(energy/frame.length<.00004)return null;
  // YIN's cumulative normalized difference rejects noise and octave errors.
  const difference=new Float32Array(maxLag+1);let running=0;
  difference[0]=1;
  for(let lag=1;lag<=maxLag;lag++){
    let sum=0;for(let i=0;i<windowSize;i++){const delta=frame[i]-frame[i+lag];sum+=delta*delta;}
    running+=sum;difference[lag]=running?sum*lag/running:1;
  }
  for(let lag=minLag;lag<maxLag;lag++){
    if(difference[lag]>.16)continue;
    while(lag<maxLag-1&&difference[lag+1]<difference[lag])lag++;
    const left=difference[lag-1],middle=difference[lag],right=difference[lag+1];
    const denominator=left-2*middle+right;
    const refined=lag+(denominator?(left-right)/(2*denominator):0);
    return {frequency:analysisRate/refined,confidence:1-middle};
  }
  return null;
}
function pitchVoice(samples,rate,effect){
  const hop=Math.round(rate*.01),frames=[];
  for(let center=0;center<samples.length+hop;center+=hop){
    const pitch=detectPitch(samples,rate,center);
    const note=pitch?69+12*Math.log2(pitch.frequency/440):0;
    const ratio=effect==='deep'?.79:pitch?Math.pow(2,(Math.round(note)-note)*.75/12):1;
    frames.push({period:pitch?rate/pitch.frequency:rate/150,ratio,voiced:pitch?Math.min(1,(pitch.confidence-.8)*5):0});
  }
  // Track pitch-synchronous peaks, then overlap Hann-windowed grains at the
  // corrected spacing. The original time axis and consonants are preserved.
  const marks=[];let position=0;
  while(position<samples.length){
    const frame=frames[Math.min(frames.length-1,Math.round(position/hop))];
    const radius=Math.round(frame.period*.2),expected=Math.round(position);let mark=expected,best=-Infinity;
    for(let i=Math.max(0,expected-radius);i<Math.min(samples.length,expected+radius+1);i++){
      if(samples[i]>best){best=samples[i];mark=i;}
    }
    if(!marks.length||mark>marks[marks.length-1].at)marks.push({at:mark,period:frame.period});
    position=Math.max(position+frame.period*.6,mark+frame.period);
  }
  const output=new Float32Array(samples.length),weights=new Float32Array(samples.length);
  let sourceIndex=0,target=marks[0]?.at||0,smoothedRatio=1;
  while(target<samples.length&&marks.length){
    while(sourceIndex<marks.length-1&&Math.abs(marks[sourceIndex+1].at-target)<Math.abs(marks[sourceIndex].at-target))sourceIndex++;
    const mark=marks[sourceIndex],frame=frames[Math.min(frames.length-1,Math.round(target/hop))];
    smoothedRatio+=(frame.ratio-smoothedRatio)*.35;
    const period=mark.period,radius=Math.ceil(period);
    for(let delta=-radius;delta<=radius;delta++){
      const destination=Math.round(target)+delta,source=mark.at+delta;
      if(destination<0||destination>=output.length||source<0||source>=samples.length||Math.abs(delta)>period)continue;
      const weight=.5+.5*Math.cos(Math.PI*delta/period);
      output[destination]+=samples[source]*weight;weights[destination]+=weight;
    }
    target+=frame.period/smoothedRatio;
  }
  for(let i=0;i<output.length;i++){
    const frameIndex=i/hop,index=Math.floor(frameIndex),mix=frameIndex-index;
    const voiced=frames[index].voiced*(1-mix)+(frames[index+1]?.voiced||0)*mix;
    output[i]=weights[i]>.05?output[i]/weights[i]*voiced+samples[i]*(1-voiced):samples[i];
  }
  return output;
}
export function applyVoiceEffect(samples,rate,effect){
  if(!['none','tune','deep','echo'].includes(effect))throw new Error('Unknown voice effect');
  if(effect==='none')return samples;
  let output;
  if(effect==='echo'){
    const delay=Math.round(rate*.13);output=new Float32Array(samples.length+delay*3);
    for(let i=0;i<samples.length;i++){
      output[i]+=samples[i]*.82;output[i+delay]+=samples[i]*.22;
      output[i+delay*2]+=samples[i]*.09;output[i+delay*3]+=samples[i]*.035;
    }
  }else output=pitchVoice(samples,rate,effect);
  // Only attenuate if needed: silence stays silent, and peaks cannot clip.
  let peak=0;for(const value of output)peak=Math.max(peak,Math.abs(value));
  if(peak>.97){const gain=.97/peak;for(let i=0;i<output.length;i++)output[i]*=gain;}
  return output;
}
export function encodeWav(samples,rate){
  const buffer=new ArrayBuffer(44+samples.length*2),view=new DataView(buffer);
  const write=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  write(0,'RIFF');view.setUint32(4,36+samples.length*2,true);write(8,'WAVE');write(12,'fmt ');
  view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,rate,true);
  view.setUint32(28,rate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);write(36,'data');view.setUint32(40,samples.length*2,true);
  for(let i=0;i<samples.length;i++){const value=Math.max(-1,Math.min(1,samples[i]));view.setInt16(44+i*2,value<0?value*32768:value*32767,true);}
  return new Blob([buffer],{type:'audio/wav'});
}
if(typeof WorkerGlobalScope!=='undefined'&&self instanceof WorkerGlobalScope){
  self.onmessage=({data})=>{try{const samples=applyVoiceEffect(data.samples,data.sampleRate,data.effect);self.postMessage({samples},[samples.buffer]);}catch(error){self.postMessage({error:error.message});}};
}
