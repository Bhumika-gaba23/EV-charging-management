// Reporting periods use completion dates in India, independent of browser timezone.
const indiaDate = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'});
function dateKey(value) {
 const parts=Object.fromEntries(indiaDate.formatToParts(new Date(value)).map(p=>[p.type,p.value]));
 return `${parts.year}-${parts.month}-${parts.day}`;
}
export function summarizeSessions(sessions,{period='month',now=Date.now(),cost=s=>s.cost}={}) {
 const today=dateKey(now),month=today.slice(0,7);
 const date=new Date(today+'T12:00:00Z');date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
 const monday=date.toISOString().slice(0,10);
 const result={cost:0,energy:0,minutes:0,completed:0,collected:0};
 for(const s of sessions) {
  const ended=Number(s.ended);
  if(!Number.isFinite(ended)||ended<=0||ended>now)continue;
  const day=dateKey(ended);
  if(period==='month'&&day.slice(0,7)!==month)continue;
  if(period==='week'&&(day<monday||day>today))continue;
  const positive=n=>Number.isFinite(Number(n))?Math.max(0,Number(n)):0;
  const energy=positive(s.energy),power=positive(s.power);
  result.cost+=positive(cost(s));result.energy+=energy;
  result.minutes+=power>0?energy/power*60:0;
  result.completed++;
  if(s.settled)result.collected+=positive(s.receipt?.amountCollected);
 }
 return result;
}
export function chargingDuration(minutes) {
 if(minutes>0&&minutes<1)return '<1 min';
 const total=Math.round(minutes);
 return total>=60?`${Math.floor(total/60)} h ${total%60} min`:`${total} min`;
}
