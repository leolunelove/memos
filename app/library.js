// A binary archive avoids base64 expansion. Audio stays on the user's device.
const MAGIC='MEMOS001', MAX_SIZE=512*1024*1024, MAX_HEADER=8*1024*1024;
export function createBackup(clips){
  let offset=0;
  const recordings=clips.map(c=>{const {id,title,created,duration,microphone,effect='none',trim=null,enhance=false,peaks=[]}=c;
    const entry={id,title,created,duration,microphone,effect,trim,enhance,peaks,offset,size:c.blob.size,mime:c.blob.type};offset+=c.blob.size;return entry;});
  const header=new TextEncoder().encode(JSON.stringify({version:1,recordings}));
  if(header.length>MAX_HEADER||offset+header.length+12>MAX_SIZE)throw new Error('Backup too large');
  const length=new Uint8Array(4);new DataView(length.buffer).setUint32(0,header.length);
  return new Blob([MAGIC,length,header,...clips.map(c=>c.blob)],{type:'application/octet-stream'});
}
export async function readBackup(file){
  const fail=()=>{throw new Error('Invalid Memos backup');};
  if(file.size<12||file.size>MAX_SIZE)fail();
  const prefix=await file.slice(0,12).arrayBuffer();
  if(new TextDecoder().decode(prefix.slice(0,8))!==MAGIC)fail();
  const length=new DataView(prefix).getUint32(8);if(length>MAX_HEADER||length+12>file.size)fail();
  const data=JSON.parse(await file.slice(12,12+length).text());
  if(data.version!==1||!Array.isArray(data.recordings)||data.recordings.length>10000)fail();
  let offset=0;const ids=new Set();
  const clips=data.recordings.map(c=>{
    if(!c||typeof c.id!=='string'||!c.id||c.id.length>128||ids.has(c.id)||typeof c.title!=='string'||!c.title.trim()||c.title.length>100||!Number.isFinite(c.created)||Math.abs(c.created)>8.64e15||!Number.isFinite(c.duration)||c.duration<=0||c.duration>86400||!Number.isSafeInteger(c.size)||c.size<=0||c.offset!==offset||!/^audio\/(mp4|webm|ogg|wav)(;[^\r\n]*)?$/.test(c.mime)||!['none','tune','deep','echo'].includes(c.effect)||typeof c.enhance!=='boolean'||(c.microphone!==undefined&&(typeof c.microphone!=='string'||c.microphone.length>512))||!Array.isArray(c.peaks)||c.peaks.length>2000||c.peaks.some(v=>!Number.isFinite(v)||v<0||v>1))fail();
    if(c.trim&&(!Number.isFinite(c.trim.start)||!Number.isFinite(c.trim.end)||c.trim.start<0||c.trim.end>c.duration||c.trim.end<=c.trim.start))fail();
    offset+=c.size;if(12+length+offset>file.size)fail();ids.add(c.id);
    return {id:c.id,title:c.title,created:c.created,duration:c.duration,microphone:c.microphone||'',effect:c.effect,enhance:c.enhance,trim:c.trim?{start:c.trim.start,end:c.trim.end}:null,peaks:c.peaks,blob:file.slice(12+length+c.offset,12+length+offset,c.mime)};
  });
  if(12+length+offset!==file.size)fail();return clips;
}
