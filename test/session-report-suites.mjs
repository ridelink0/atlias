import { nativeSessionReport, accountPace } from '../lib/session-report.mjs';

export default async function({asyncSuite,check,TMP,fs,path}) {
  await asyncSuite('native timing expert','session accounting does not manufacture spend or account attribution',async()=>{
    const file=path.join(TMP,'native timing café.jsonl'),at=new Date().toISOString();
    fs.writeFileSync(file,JSON.stringify({type:'session_meta',timestamp:at,payload:{id:'gev-timing'}})+'\n');
    const r=await nativeSessionReport(file),detail={happened:JSON.stringify(r),why:'An empty native session establishes neither model spend nor completed work.',fix:'Keep absent counters null and unknown activity explicit.'};
    check('nativeSessionReport distinguishes absent spend and completed work',r.reportedLifetimeTokens===null&&r.nativePeakRecordedInputTokens===null&&r.completedTurnWallMs===0&&r.completedTurns===0,detail);
    let rejected=false;try{accountPace([],Date.now());}catch{rejected=true;}
    check('accountPace requires actual meter observations',rejected,{happened:'empty account observations accepted',why:'An exhaustion estimate without live observations is invented.',fix:'Reject missing observations; preserve unknown forecasts.'});
  });
}
