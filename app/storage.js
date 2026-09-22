// Existing recordings keep their original database and IDs. Recovery uses a
// companion database so old open tabs cannot block a schema upgrade.
const DB_NAME='memos-voice-recorder';
function openDB(name,upgrade){
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open(name,1);let settled=false;
    const fail=error=>{if(!settled){settled=true;reject(error);}};
    request.onupgradeneeded=()=>upgrade(request.result);
    request.onsuccess=()=>{if(settled){request.result.close();return;}settled=true;request.result.onversionchange=()=>request.result.close();resolve(request.result);};
    request.onerror=()=>fail(request.error);request.onblocked=()=>fail(new Error('Storage is open in another tab.'));
  });
}
function done(tx){return new Promise((resolve,reject)=>{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage was interrupted'));});}
function result(request){return new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
const chunkRange=id=>IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]);
export class RecordingStore{
  async open(){
    this.db=await openDB(DB_NAME,db=>db.createObjectStore('recordings',{keyPath:'id'}));
    try{this.recovery=await openDB(DB_NAME+'-recovery',db=>{db.createObjectStore('drafts',{keyPath:'id'});db.createObjectStore('chunks',{keyPath:['id','sequence']});});}catch{this.recovery=null;}
    return this;
  }
  list(){return result(this.db.transaction('recordings').objectStore('recordings').getAll());}
  get(id){return result(this.db.transaction('recordings').objectStore('recordings').get(id));}
  async save(clip){
    const {url,persisted,...record}=clip;const tx=this.db.transaction('recordings','readwrite');tx.objectStore('recordings').put(record);await done(tx);
  }
  async remove(id){await this.clearDraft(id);const tx=this.db.transaction('recordings','readwrite');tx.objectStore('recordings').delete(id);await done(tx);}
  async appendDraft(draft,blob,sequence){
    if(!this.recovery)throw new Error('Recovery storage is unavailable');
    const tx=this.recovery.transaction(['drafts','chunks'],'readwrite');
    tx.objectStore('drafts').put(draft);tx.objectStore('chunks').put({id:draft.id,sequence,blob});await done(tx);
  }
  async clearDraft(id){
    if(!this.recovery)return;
    const tx=this.recovery.transaction(['drafts','chunks'],'readwrite');tx.objectStore('drafts').delete(id);tx.objectStore('chunks').delete(chunkRange(id));await done(tx);
  }
  async recover(){
    if(!this.recovery||!navigator.locks)return [];
    const drafts=await result(this.recovery.transaction('drafts').objectStore('drafts').getAll()),recovered=[];
    for(const draft of drafts){
      const restore=async()=>{
        // Saving the final clip precedes draft cleanup. If a tab died between
        // those operations, the same ID makes recovery idempotent.
        if(await this.get(draft.id)){await this.clearDraft(draft.id);return;}
        const chunks=await result(this.recovery.transaction('chunks').objectStore('chunks').getAll(chunkRange(draft.id)));
        if(!chunks.length)return;
        const blob=new Blob(chunks.map(chunk=>chunk.blob),{type:draft.mime});
        if(!blob.size)return;
        const {updated,...metadata}=draft;
        const clip={...metadata,title:draft.title+' (recovered)',blob,recovered:true,effect:'none'};
        await this.save(clip);await this.clearDraft(draft.id);recovered.push(clip);
      };
      if(navigator.locks){await navigator.locks.request('memos-take-'+draft.id,{ifAvailable:true},async lock=>{if(lock)await restore();});}
    }
    return recovered;
  }
}
export function holdTake(id){
  if(!navigator.locks)return Promise.resolve(()=>{});
  return new Promise((resolve,reject)=>{
    navigator.locks.request('memos-take-'+id,async()=>{
      await new Promise(release=>resolve(release));
    }).catch(reject);
  });
}
