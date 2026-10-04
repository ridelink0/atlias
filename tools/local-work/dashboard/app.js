const $=id=>document.getElementById(id);
const date=value=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'medium'}).format(new Date(value))+' Chicago':'unknown';
let pending=false;
async function refresh(){
 if(pending)return;pending=true;$('refresh').disabled=true;
 try{const response=await fetch('/api/progress',{cache:'no-store'});if(!response.ok)throw Error('Local progress service unavailable');const data=await response.json();
  $('status').textContent=data.status;$('status').dataset.live=String(data.live);
  $('goal-percent').textContent=data.goalPercent+'%';$('goal-bar').value=data.goalPercent;$('goal-count').textContent=`${data.verifiedGoals} of ${data.totalGoals} requirements verified`;
  document.querySelector('.goal-meter p').textContent=data.verifiedGoals===data.totalGoals?'All required audits verified.':'Targets remain unproved.';
  $('round-number').textContent=data.round;$('round-percent').textContent=data.roundPercent+'%';$('round-bar').value=data.roundPercent;$('stage').textContent=data.stage.replaceAll('-',' ');
  $('steps').replaceChildren(...data.steps.map(step=>{const li=document.createElement('li');li.dataset.state=step.completed?'complete':step.active?'active':'pending';const title=document.createElement('strong');title.textContent=step.id.replaceAll('-',' ');const state=document.createElement('span');state.textContent=step.completed?'Complete':step.active?'In progress':'Incomplete';li.append(title,state);return li;}));
  $('goals').replaceChildren(...data.goals.map(goal=>{const row=document.createElement('article'),h=document.createElement('h3'),p=document.createElement('p'),status=document.createElement('span');h.textContent=goal.title;p.textContent=goal.requirement;status.textContent=goal.verified?'Verified':'Unverified';row.append(h,p,status);return row;}));
  $('job').textContent=data.job?.title||'No concrete task receipt yet';$('completed-jobs').textContent=`${data.completedJobs} independently accepted engineering tasks; ${data.failures} consecutive incomplete rounds.`;
  $('warnings').textContent=data.warnings.join('; ');$('refreshed').textContent='Last refreshed: '+date(data.refreshedAt);$('refresh-summary').textContent=$('refreshed').textContent;$('source-updated').textContent='Worker update: '+date(data.sourceUpdatedAt);
 }catch(e){$('status').textContent='Connection interrupted';$('warnings').textContent=e.message+'. Displayed values are from the last successful refresh.';}finally{pending=false;$('refresh').disabled=false;}
}
$('refresh').addEventListener('click',refresh);refresh();setInterval(refresh,5000);

const comparison=(counts,target)=>{
 if(!Array.isArray(counts)||counts.length!==2||!counts.every(n=>Number.isSafeInteger(n)&&n>0))return 'Unmeasured';
 const [plain,atlias]=counts,factor=plain/atlias;
 return (factor>=1?factor.toFixed(2)+'x lower':((atlias/plain-1)*100).toFixed(2)+'% more')+(target?(factor>=target?' · numeric threshold only':' · below '+target+'x target'):'');
};
async function loadBenchmarks(){
 try{const r=await fetch('/api/benchmarks',{cache:'no-store'});if(!r.ok)throw Error('Published results unavailable');const data=await r.json();if(data.schema!==1||!Array.isArray(data.rows)||!Array.isArray(data.unmeasured))throw Error('Invalid benchmark catalog');
  const cards=data.rows.map(row=>{
   const article=document.createElement('article'),h=document.createElement('h3'),scope=document.createElement('p'),dl=document.createElement('dl'),quality=document.createElement('p'),limits=document.createElement('p'),link=document.createElement('a');
   h.textContent=row.title;scope.textContent=row.host+' · '+row.status;scope.className='benchmark-scope';
   for(const [key,title,target] of [['total','All input + output',20],['uncached','Uncached input + output',null],['peak','Maximum recorded request',20]]){const box=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd'),counts=document.createElement('small');dt.textContent=title;dd.textContent=comparison(row.counts?.[key],target);counts.textContent=Array.isArray(row.counts?.[key])?row.counts[key].map(n=>Number.isSafeInteger(n)?n.toLocaleString('en-US'):'unknown').join(' → ')+' tokens (plain → Atlias)':'Unknown costs';box.append(dt,dd,counts);dl.append(box);}
   quality.textContent='Original quality, plain vs Atlias: '+row.quality;limits.textContent=row.limitations;limits.className='benchmark-limits';
   const url=new URL(row.url);if(url.origin!=='https://github.com'||!url.pathname.startsWith('/ridelink0/atlias/blob/'))throw Error('Invalid report link');link.href=url.href;link.textContent='Read the audited report';link.target='_blank';link.rel='noopener noreferrer';article.append(h,scope,dl,quality,limits,link);return article;
  });
  $('benchmarks').replaceChildren(...cards);$('unmeasured').replaceChildren(...data.unmeasured.map(item=>{const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=item.title+': ';p.append(strong,document.createTextNode(item.detail));return p;}));$('benchmark-status').textContent='Five published comparisons. No BOTH-host goal is established.';
 }catch(e){$('benchmark-status').textContent=e.message+'. No result is assumed.';}
}
loadBenchmarks();
