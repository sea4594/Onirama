// Local-first UI for online actions. Every speculative state is derived with the
// same rules engine as the Firestore transaction; server commits remain final.
// This module never persists speculative state or exposes the raw room to UI.
export function createOptimisticQueue({latest,predict,submit,present,failed,maxPending=12}){
  let pending=[],shadow=null,draining=false,epoch=0;
  const hasPending=()=>pending.length>0;
  const gameKey=room=>JSON.stringify(room?.game??null);
  function reset(reason){
    epoch++;
    const abandoned=pending;pending=[];shadow=null;
    for(const item of abandoned)item.reject(reason);
    if(reason&&abandoned.length){present(latest(),false);failed(reason);}
  }
  async function drain(){
    if(draining)return;
    draining=true;
    const run=epoch;
    try{
      while(run===epoch&&pending.length){
        const item=pending[0];
        try{
          if(item.beforeCommit)await item.beforeCommit.catch(()=>{});
          if(run!==epoch)break;
          // Compare game state, rather than versions: non-mutating public choice
          // previews can legitimately increase the document version meanwhile.
          const confirmed=await submit(item.command,item.baseGame);
          if(run!==epoch)break;
          pending.shift();item.resolve(confirmed);
          if(gameKey(confirmed)!==gameKey(item.predicted)){
            // Never show speculative downstream actions based on a divergence.
            reset(Error('Multiplayer state changed; actions were resynchronized.'));
            present(confirmed,false);
            break;
          }
          if(!pending.length){shadow=null;const newest=latest();present(newest?.version>confirmed.version?newest:confirmed,false);}
        }catch(error){
          if(run!==epoch)break;
          reset(error);break;
        }
      }
    }finally{
      draining=false;
      if(pending.length&&!draining)void drain();
    }
  }
  function enqueue(command,beforeCommit=null){
    if(pending.length>=maxPending)throw Error('Too many actions awaiting connection. Check the network.');
    const base=shadow||latest();
    if(!base)throw Error('Waiting for multiplayer synchronization.');
    // This is synchronous and validates the move before any loading state.
    const predicted=predict(base,command);
    const baseGame=gameKey(base);
    shadow=predicted;
    let resolve,reject;
    const settled=new Promise((yes,no)=>{resolve=yes;reject=no;});
    pending.push({command,beforeCommit,baseGame,predicted,resolve,reject});
    present(predicted,true);
    void drain();
    return {predicted,settled};
  }
  return {enqueue,hasPending,reset};
}
