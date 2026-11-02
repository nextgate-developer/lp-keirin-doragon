export const DAY_MS=24*60*60*1000;

export function validateHealth(state){
  if(state?.version!==1)throw new Error('Invalid RSS health state version');
  for(const key of ['firstObservedAt','lastAttemptAt','lastSuccessAt','lastNotifiedAt']){
    if(state[key]!==null && (typeof state[key]!=='string'||!Number.isFinite(Date.parse(state[key]))))throw new Error(`Invalid RSS health ${key}`);
  }
  if(!state.firstObservedAt||!state.lastAttemptAt)throw new Error('Missing RSS health observation time');
  const first=Date.parse(state.firstObservedAt),last=Date.parse(state.lastAttemptAt);
  if(first>last||['lastSuccessAt','lastNotifiedAt'].some(key=>state[key]&&(Date.parse(state[key])<first||Date.parse(state[key])>last))){
    throw new Error('Invalid RSS health timestamp order');
  }
  if(!['available','unavailable'].includes(state.outcome))throw new Error('Invalid RSS health outcome');
  return state;
}

export function recordFetchResult(previous,{available,now=new Date(),error=null}){
  if(previous)validateHealth(previous);
  const time=now.getTime();
  if(!Number.isFinite(time))throw new Error('Invalid RSS health clock');
  if(previous&&time<Date.parse(previous.lastAttemptAt))throw new Error('RSS health clock moved backwards');
  const iso=now.toISOString();
  const state={version:1,firstObservedAt:previous?.firstObservedAt??iso,lastAttemptAt:iso,
    lastSuccessAt:available?iso:previous?.lastSuccessAt??null,
    lastNotifiedAt:previous?.lastNotifiedAt??null,
    outcome:available?'available':'unavailable',lastError:available?null:String(error??'RSS unavailable').slice(0,500)};
  const unavailableMs=available?0:time-Date.parse(state.lastSuccessAt??state.firstObservedAt);
  const notify=!available&&unavailableMs>=DAY_MS&&(!state.lastNotifiedAt||time-Date.parse(state.lastNotifiedAt)>=DAY_MS);
  if(notify)state.lastNotifiedAt=iso;
  return {state,notify,unavailableMs};
}

export async function runManagedSync({store,sync,isUnavailable,now=()=>new Date()}){
  const previous=await store.load();
  let result,error;
  try{result=await sync();}
  catch(caught){if(!isUnavailable(caught))throw caught;error=caught;}
  const health=recordFetchResult(previous,{available:!error,now:now(),error:error?.message});
  // Persist the notification marker BEFORE asking Actions to fail; subsequent runs
  // must not send another outage notification within the next 24 hours.
  await store.save(health.state);
  return {...health,available:!error,changed:result?.changed??false,count:result?.count??0};
}
