/* analytics.js - support analytics for the admin console. Pure functions (no DOM), so they can be tested in node.
   anaCompute(data, opts): volumes, resolution times, AI intent breakdown. anaSample(now): clearly-fake data for showing the dashboard.
   Data shapes are the ones the app already stores:
     chats      {msgs:[{f:'cu'|'ai'|'ag'|'sys',ts}], status, last, a:{policy,pri,team,dec,conf,lang,flags}}
     emails     {subject, status:'new'|'open'|'resolved', ts, replies:[{ts}], resolvedAt?}
     complaints {cat, pri, team, status, ts, replies:[{ts}], resolvedAt?} */
const DAY_MS=864e5;
const anaMed=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2};
const anaAvg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
const anaStat=a=>({n:a.length,avg:anaAvg(a),med:anaMed(a)});
const anaDur=ms=>{if(ms===null||ms===undefined||isNaN(ms))return '–';if(ms<1000)return '<1 s';const s=Math.round(ms/1000);if(s<60)return s+' s';const m=Math.round(s/60);if(m<60)return m+' min';
 const h=Math.floor(m/60),mm=m%60;if(h<24)return h+' h'+(mm?' '+mm+' min':'');const d=Math.floor(h/24),hh=h%24;return d+' d'+(hh?' '+hh+' h':'')};
const anaDay=ts=>{const d=new Date(ts),p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())};
const anaFmtDay=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('en',{month:'short',day:'numeric'})};
const anaPct=(a,b)=>b?Math.round(a/b*100):0;

function anaChatTs(c){const f=(c.msgs||[]).find(m=>m.f==='cu');return f?f.ts:(c.last||0)}
function anaChatFirstResp(c){const ms=c.msgs||[],i=ms.findIndex(m=>m.f==='cu');if(i<0)return null;const r=ms.slice(i+1).find(m=>m.f==='ai'||m.f==='ag');return r?Math.max(0,r.ts-ms[i].ts):null}
function anaIntent(c){const p=(c.a&&c.a.policy)||'Unclear request';return /^FAQ:/.test(p)?'Your saved FAQ answers':p}

function anaCompute(data,opts={}){
 const now=opts.now||Date.now(),days=opts.days||30,en=opts.en||(x=>x),from=now-days*DAY_MS,inR=ts=>ts>=from&&ts<=now+DAY_MS;
 const C=(data.C||[]).filter(c=>inR(anaChatTs(c))),M=(data.M||[]).filter(x=>inR(x.ts)),X=(data.X||[]).filter(x=>inR(x.ts));
 const total=C.length+M.length+X.length;
 // per-day volume (every day in the range is present, even when empty)
 const daily=[];for(let i=days-1;i>=0;i--){const k=anaDay(now-i*DAY_MS);daily.push({k,label:anaFmtDay(k),chat:0,email:0,complaint:0})}
 const dIdx=Object.fromEntries(daily.map((d,i)=>[d.k,i]));
 const bump=(ts,ch)=>{const i=dIdx[anaDay(ts)];if(i!==undefined)daily[i][ch]++};
 C.forEach(c=>bump(anaChatTs(c),'chat'));M.forEach(x=>bump(x.ts,'email'));X.forEach(x=>bump(x.ts,'complaint'));
 // times
 const fr={chat:[],email:[],complaint:[]},rs={email:[],complaint:[]};
 C.forEach(c=>{const v=anaChatFirstResp(c);if(v!==null)fr.chat.push(v)});
 [['email',M],['complaint',X]].forEach(([k,L])=>L.forEach(x=>{const r=(x.replies||[])[0];if(r&&r.ts>=x.ts)fr[k].push(r.ts-x.ts);if(x.status==='resolved'&&x.resolvedAt&&x.resolvedAt>=x.ts)rs[k].push(x.resolvedAt-x.ts)}));
 const firstResp={chat:anaStat(fr.chat),email:anaStat(fr.email),complaint:anaStat(fr.complaint),all:anaStat([...fr.chat,...fr.email,...fr.complaint])};
 const resolve={email:anaStat(rs.email),complaint:anaStat(rs.complaint),all:anaStat([...rs.email,...rs.complaint])};
 // status
 const waitingChats=C.filter(c=>c.status==='needs_review'||c.status==='escalated').length,
   openTickets=[...M,...X].filter(x=>x.status!=='resolved').length,
   resolvedTickets=[...M,...X].filter(x=>x.status==='resolved').length,
   autoChats=C.filter(c=>c.status==='auto_sent').length;
 // intents
 const im={};C.forEach(c=>{const k=anaIntent(c),o=im[k]||(im[k]={label:k,n:0,auto:0,conf:0});o.n++;if(c.status==='auto_sent')o.auto++;o.conf+=(c.a&&c.a.conf)||0});
 const intents=Object.values(im).map(o=>({...o,conf:o.n?o.conf/o.n:0})).sort((a,b)=>b.n-a.n);
 const tally=(list,f)=>{const m={};list.forEach(x=>{const k=f(x);if(k)m[k]=(m[k]||0)+1});return Object.entries(m).map(([label,n])=>({label,n})).sort((a,b)=>b.n-a.n)};
 const cats=tally(X,x=>en(x.cat)),
   teams=tally([...C.map(c=>({t:c.a&&c.a.team})),...X.map(x=>({t:x.team}))],x=>x.t),
   langs=tally(C,c=>c.a&&c.a.lang),
   pri={urgent:0,high:0,normal:0};[...C.map(c=>c.a&&c.a.pri),...X.map(x=>x.pri)].forEach(p=>{if(p in pri)pri[p]++});
 const flags=C.filter(c=>c.a&&(c.a.flags||[]).length).length;
 return{days,total,byChannel:{chat:C.length,email:M.length,complaint:X.length},daily,firstResp,resolve,waitingChats,openTickets,resolvedTickets,autoChats,
  autoRate:anaPct(autoChats,C.length),resolvedRate:anaPct(resolvedTickets,M.length+X.length),intents,cats,teams,langs,pri,flags}}

/* ---- sample data: seeded, so it looks the same every time. NOT customer data. ---- */
function anaSample(now=Date.now()){
 let s=20261007;const r=()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296};
 const pick=w=>{let x=r()*w.reduce((a,b)=>a+b[1],0);for(const [v,p] of w){x-=p;if(x<=0)return v}return w[0][0]};
 const exp=m=>-Math.log(1-r())*m;
 // same topics, teams and priorities as the KB in ai.js
 const IN=[['failed_txn','Failed or pending transaction',.28,1,'Payments Ops','high'],['fees','Fees and charges',.16,1,'Customer Care','normal'],['howto','How to use a service',.14,1,'Customer Care','normal'],
  ['pin_reset','Forgot PIN',.12,1,'Account Support','normal'],['wrong_number','Money sent to wrong number',.10,0,'Dispute Desk','high'],['locked','Account locked or blocked',.06,0,'Account Support','high'],
  ['scam','Scam or fraud report',.05,0,'Fraud Team','urgent'],['unknown','Unclear request',.05,0,'Support Agents','normal'],['faq','FAQ: How do I get a student account?',.04,1,'Customer Care','normal']];
 const when=()=>{const d=Math.floor(r()*r()*30*100)/100*0+r()*30;const t=now-d*DAY_MS-r()*3e6;return Math.min(t,now-6e4)};
 const C=[],M=[],X=[];
 for(let i=0;i<110;i++){const [id,label,,auto,team,pri]=pick(IN.map(x=>[x,x[2]])),t=when(),lang=pick([['Bangla',.5],['English',.32],['Bangla (romanized)',.18]]),conf=Math.min(.95,.55+.2*Math.floor(r()*3)),
   esc=id==='scam',recent=now-t<9e5;
  const msgs=[{f:'cu',t:'sample',ts:t}];let status;
  if(esc)status='escalated';else if(auto&&conf>=.7)status='auto_sent';else status='needs_review';
  if(status==='auto_sent')msgs.push({f:'ai',t:'sample',ts:t+1});
  else if(!recent&&r()<(esc?.5:.8)){msgs.push({f:'ag',t:'sample',ts:t+exp(esc?25:11)*6e4+3e4});if(!esc)status='agent_sent'}
  C.push({id:'s'+i,name:'Sample customer',msgs,status,last:msgs[msgs.length-1].ts,a:{policy:label,pri,team,dec:status,conf,lang,flags:r()<.05?['Customer typed a PIN or OTP']:[]}})}
 const SUB=['Statement request','Refund query','Update my phone number','Agent cash-out charge','Biller payment not shown'];
 for(let i=0;i<26;i++){const t=when(),st=pick([['resolved',.55],['open',.25],['new',.2]]),q=exp(7)*36e5+36e5;
  const e={id:'e'+i,name:'Sample customer',subject:pick(SUB.map(x=>[x,1])),status:st,ts:t,replies:[]};
  if(st!=='new'&&t+q<now){e.replies.push({t:'sample',ts:t+q});if(st==='resolved')e.resolvedAt=t+q*2.4}else if(st!=='new'){e.status='new'}
  if(e.status==='resolved'&&!e.resolvedAt)e.status='new';M.push(e)}
 const CAT=[['Wrong number transfer',.26,'Dispute Desk'],['Failed transaction',.24,'Payments Ops'],['Agent cash-out issue',.16,'Agent Network'],['App problem',.14,'Technical Support'],['Unauthorized transaction',.1,'Fraud Team'],['Account locked',.1,'Account Support']];
 for(let i=0;i<38;i++){const t=when(),c=pick(CAT.map(x=>[x,x[1]])),st=pick([['resolved',.55],['open',.25],['new',.2]]),q=exp(5)*36e5+18e5;
  const x={id:'x'+i,name:'Sample customer',cat:c[0],team:c[2],pri:c[0].startsWith('Unauth')?'urgent':c[0].startsWith('Wrong')||c[0].startsWith('Failed')?'high':'normal',status:st,ts:t,replies:[]};
  if(st!=='new'&&t+q<now){x.replies.push({t:'sample',ts:t+q});if(st==='resolved')x.resolvedAt=t+q*(2+r()*3)}else if(st!=='new'){x.status='new'}
  if(x.status==='resolved'&&!x.resolvedAt)x.status='new';X.push(x)}
 return{C,M,X}}
if(typeof module!=='undefined')module.exports={anaCompute,anaSample,anaDur,anaMed,anaChatFirstResp};
