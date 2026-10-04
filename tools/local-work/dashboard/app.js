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
