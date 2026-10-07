/* admin.js - admin console */
/* ---------- Admin console ---------- */
function initAdmin(){
  const root=$('#root');
  const ST={auto_sent:['Auto-replied','ok'],needs_review:['Needs review','warn'],escalated:['Escalated','bad'],agent_sent:['Sent by agent','info']};
  const TABS=[['ana','Analytics'],['chat','Live chat'],['mail','Emails'],['comp','Complaints'],['cus','Customers'],['txn','Transactions'],['faq','My FAQ'],['pol','Reply policies'],['stu','Student accounts'],['ann','Announcement']];
  let tab='ana',sel=null,W=[],T=[],C=[],M=[],X=[],selM=null,selX=null,faqs=[],note='',modal=null,msg='',amsg='',cols,cfg,fqd,stuDoc,AR=[],selA=null,stu=null;const ui={};
  const uv=(k,d)=>ui[k]===undefined?d:ui[k];
  const stuCfg=()=>({...STU_DEF,...(stu||{}),req:{...STU_DEF.req,...((stu&&stu.req)||{})}});
  const pn=()=>AR.filter(x=>x.status==='pending').length;
  const nw=a=>a.filter(x=>x.status==='new').length;
  const chatOf=id=>C.find(c=>c.id===id),st=s=>ST[s]||['Open','info'];

  function vChat(){
    const L=C.slice().sort((a,b)=>b.last-a.last);if(!sel&&L[0])sel=L[0].id;
    const c=chatOf(sel),a=c&&c.a;
    const list=`<div class="card"><h3>Conversations</h3><p class="lead">Safe questions get an instant AI reply. The rest wait here for an agent.</p>${L.length?`<ul class="list">${L.map(x=>`<li tabindex="0" data-a="sel" data-id="${esc(x.id)}" aria-selected="${x.id===sel}"><span class="tag ${st(x.status)[1]}">${st(x.status)[0]}</span>${x.unreadAdmin?`<span class="tag bad">${x.unreadAdmin} new</span>`:''}<b>${esc(x.name)}</b><small>${esc(en((x.msgs[x.msgs.length-1]||{}).t||'').slice(0,60))}</small></li>`).join('')}</ul>`:'<p class="lead">No conversations yet. Open the customer app and send a message.</p>'}</div>`;
    const thr=c?`<div class="card"><h3>${esc(c.name)} <small style="color:var(--mute);font-weight:400">${fd(c.last)}</small></h3>
      <div class="thr" style="max-height:340px;overflow:auto">${c.msgs.map(m=>m.f==='sys'?`<div class="note">${esc(en(m.t))}</div>`:`<div class="bub ${m.f==='cu'?'cu':'ai'}">${esc(m.t)}${m.f==='cu'?'':`<small style="display:block;opacity:.7">${m.f==='ai'?'AI assistant':'Agent'}</small>`}</div>`).join('')}</div>
      <label for="rp">${c.status==='escalated'?'Holding reply (fraud team takes over)':'Reply to customer'}</label>
      <textarea id="rp" data-k="reply" rows="4">${esc(ui.reply||'')}</textarea>
      <button class="btn" data-a="send">Send reply</button>
      ${c.draft&&c.status!=='auto_sent'&&c.status!=='agent_sent'?'<button class="btn alt" data-a="draft">Use AI draft</button>':''}
      <button class="btn alt" data-a="gem" ${API.on?'':'disabled title="Needs the backend (UPAY_API)"'}>${ui.gemBusy?'Asking Gemini…':'✨ Ask Gemini for a draft'}</button><p class="lead" role="status" style="margin:6px 0 0">${esc(ui.gemMsg||'')}</p>
      ${c.status==='needs_review'&&a?`<button class="btn alt" data-a="esc">Escalate to ${esc(a.team)}</button>`:''}</div>`
      :'<div class="card"><p class="lead">Select a conversation.</p></div>';
    const an=c&&a?`<div class="card"><h3>AI analysis</h3><p><span class="tag ${a.pri==='urgent'?'bad':a.pri==='high'?'warn':'info'}">${esc(a.pri)} priority</span><span class="tag ${st(c.status)[1]}">${st(c.status)[0]}</span></p>
      <ul class="why"><li><span>Topic</span><b>${esc(a.policy)}</b></li><li><span>Language</span><b>${esc(a.lang)}</b></li><li><span>Route to</span><b>${esc(a.team)}</b></li><li><span>Matched words</span><b>${esc((a.hits||[]).join(', ')||'none')}</b></li>${Object.entries(a.ent||{}).map(([k,v])=>`<li><span>Found ${esc(k)}</span><b>${esc(v)}</b></li>`).join('')}</ul>
      <p style="margin:10px 0 0;font-size:14px">Confidence ${Math.round(a.conf*100)}%</p><div class="bar"><i style="width:${a.conf*100}%"></i></div>
      ${(a.flags||[]).map(f=>`<p><span class="tag bad">Flag</span>${esc(f)}</p>`).join('')}
      <p class="lead" style="margin:8px 0 4px">Why this decision</p><p style="font-size:14px;margin:0">${a.dec==='auto_sent'?'Policy allows automation, confidence is high, and no safety flags.':a.dec==='escalated'?'Fraud reports always go to a specialist team.':'Policy needs a person, or confidence is low, or a safety flag was raised.'}</p>
      <p class="lead" style="margin:12px 0 4px">Audit trail</p><ul class="why">${(c.audit||[]).map(x=>`<li><span>${esc(x)}</span></li>`).join('')}</ul></div>`:'<div class="card"></div>';
    return `<div class="cols">${list}${thr}${an}</div>`;
  }
  /* ---------- Analytics: volumes, response / resolution times, AI intent breakdown. "Sample data" shows the dashboard with fake numbers. ---------- */
  function anaData(){const sample=uv('anaSample',false),days=uv('anaDays',30),now=Date.now();
    return{sample,days,r:anaCompute(sample?anaSample(now):{C,M,X},{now,days,en})}}
  function vAna(){
    const {sample,days,r}=anaData(),tk=(l,v,s)=>`<div class="kpi"><b>${v}</b><span>${l}</span>${s?`<small class="ks">${s}</small>`:''}</div>`;
    const rows=(L,key,max,extra)=>L.length?L.map(o=>`<div class="ar2"><div class="l"><b>${esc(o.label)}</b><span>${o.n} · ${anaPct(o.n,key)}%</span></div><div class="bar"><i style="width:${max?o.n/max*100:0}%"></i></div>${extra?`<small>${extra(o)}</small>`:''}</div>`).join(''):'<p class="lead">Nothing in this period.</p>';
    const mx=Math.max(1,...r.daily.map(d=>d.chat+d.email+d.complaint)),n=r.daily.length;
    const bars=r.daily.map((d,i)=>`<div title="${esc(d.label)}: ${d.chat} chats, ${d.email} emails, ${d.complaint} complaints"><i class="c3" style="height:${d.complaint/mx*100}%"></i><i class="c2" style="height:${d.email/mx*100}%"></i><i class="c1" style="height:${d.chat/mx*100}%"></i></div>`).join('');
    const lab=r.daily.map((d,i)=>`<span>${i===0||i===n-1||i%Math.ceil(n/6)===0?esc(d.label):''}</span>`).join('');
    const tm=(k,name)=>{const f=r.firstResp[k],s=r.resolve[k];return `<tr><td><b>${name}</b></td><td>${f.n}</td><td>${anaDur(f.avg)}</td><td>${anaDur(f.med)}</td><td>${s?s.n:'–'}</td><td>${s?anaDur(s.avg):'–'}</td><td>${s?anaDur(s.med):'–'}</td></tr>`};
    const tot=r.total,chatN=r.byChannel.chat,tickN=r.byChannel.email+r.byChannel.complaint;
    return `<div class="card"><div class="ctl"><h3 style="margin:0">Support analytics</h3>
      <span class="seg">${[7,30].map(d=>`<button data-a="anarange" data-v="${d}" aria-selected="${days===d}">Last ${d} days</button>`).join('')}</span>
      <button class="btn alt" data-a="anasample">${sample?'Show my real data':'Show sample data'}</button><button class="btn alt" data-a="anacsv">Download CSV</button></div>
      ${sample?'<div class="note">SAMPLE DATA. These numbers are generated in your browser to show what the dashboard looks like. They are not real customers and nothing is saved.</div>':''}
      <p class="lead" style="margin:8px 0 0">${tot?`${tot} requests in the last ${days} days.`:'No requests in this period yet. Use the customer app (chat, email, complaint), or press “Show sample data”.'}</p></div>
    <div class="kpis">${[tk('Requests',tot,`${chatN} chats · ${r.byChannel.email} emails · ${r.byChannel.complaint} complaints`),tk('Waiting for a person',r.waitingChats+r.openTickets,`${r.waitingChats} chats · ${r.openTickets} emails/complaints`),
      tk('AI auto-reply rate',r.autoRate+'%',`${r.autoChats} of ${chatN} chats`),tk('Resolved (email + complaint)',r.resolvedRate+'%',`${r.resolvedTickets} of ${tickN}`),
      tk('Median first response',anaDur(r.firstResp.all.med),`${r.firstResp.all.n} answered`),tk('Median time to resolve',anaDur(r.resolve.all.med),r.resolve.all.n?`${r.resolve.all.n} resolved`:'needs resolved items')].join('')}</div>
    <div class="card"><h3>Requests per day</h3><div class="dv">${bars}</div><div class="dvl">${lab}</div><p class="lead" style="margin:6px 0 0"><span class="lg c1"></span>Chats <span class="lg c2"></span>Emails <span class="lg c3"></span>Complaints</p></div>
    <div class="cols2"><div class="card"><h3>What customers ask about (AI topics)</h3><p class="lead">Share of chats by detected topic, and how many the assistant answered by itself.</p>${rows(r.intents,chatN,Math.max(1,...r.intents.map(o=>o.n)),o=>`Auto-replied ${anaPct(o.auto,o.n)}% · average confidence ${Math.round(o.conf*100)}%`)}</div>
      <div class="card"><h3>Complaint categories</h3>${rows(r.cats,r.byChannel.complaint,Math.max(1,...r.cats.map(o=>o.n)))}<p style="margin:10px 0 0"><span class="tag bad">${r.pri.urgent} urgent</span><span class="tag warn">${r.pri.high} high</span><span class="tag info">${r.pri.normal} normal</span></p></div></div>
    <div class="card"><h3>Response and resolution time</h3><div style="overflow:auto"><table><thead><tr><th>Channel</th><th>Answered</th><th>First reply (avg)</th><th>First reply (median)</th><th>Resolved</th><th>Resolve (avg)</th><th>Resolve (median)</th></tr></thead><tbody>${tm('chat','Live chat').replace(/<td>–<\/td><td>–<\/td><td>–<\/td><\/tr>$/,'<td colspan="3" style="color:var(--mute)">chats are answered, not resolved</td></tr>')}${tm('email','Emails')}${tm('complaint','Complaints')}</tbody></table></div><p class="lead" style="margin:8px 0 0">Resolve time starts counting when you press “Mark resolved”. Items resolved before this update have no time recorded.</p></div>
    <div class="cols2"><div class="card"><h3>Team workload</h3>${rows(r.teams,r.teams.reduce((a,o)=>a+o.n,0),Math.max(1,...r.teams.map(o=>o.n)))}</div>
      <div class="card"><h3>Chat language and safety</h3>${rows(r.langs,chatN,Math.max(1,...r.langs.map(o=>o.n)))}<p style="margin:10px 0 0"><span class="tag ${r.flags?'bad':'ok'}">${r.flags} chats</span> where the customer typed a PIN or OTP (masked before storing)</p></div></div>`;
  }
  function anaCsv(){const {r,days,sample}=anaData(),q=v=>'"'+String(v).replace(/"/g,'""')+'"',L=[['section','item','value']];
    L.push(['summary','period_days',days],['summary','sample_data',sample],['summary','requests',r.total],['summary','chats',r.byChannel.chat],['summary','emails',r.byChannel.email],['summary','complaints',r.byChannel.complaint],
     ['summary','ai_auto_reply_rate_pct',r.autoRate],['summary','resolved_rate_pct',r.resolvedRate],['summary','median_first_response',anaDur(r.firstResp.all.med)],['summary','median_time_to_resolve',anaDur(r.resolve.all.med)]);
    r.intents.forEach(o=>L.push(['topic',o.label,o.n]));r.cats.forEach(o=>L.push(['complaint_category',o.label,o.n]));r.teams.forEach(o=>L.push(['team',o.label,o.n]));r.daily.forEach(d=>L.push(['day '+d.k,'chat/email/complaint',d.chat+'/'+d.email+'/'+d.complaint]));
    const b=new Blob(['\ufeff'+L.map(x=>x.map(q).join(',')).join('\n')],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='upay-support-analytics-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
  function vReq(k){
    const isC=k==='comp',L=(isC?X:M).slice().sort((a,b)=>b.ts-a.ts),cur=isC?selX:selM,r=L.find(x=>x.id===cur)||L[0];
    const SS={new:['New','warn'],open:['In progress','info'],resolved:['Resolved','ok']};
    const list=`<div class="card"><h3>${isC?'Complaints':'Emails'}</h3><p class="lead">${isC?'Submitted from the app, with an optional photo or voice note.':'Customers who prefer email over live chat.'}</p>${L.length?`<ul class="list">${L.map(x=>`<li tabindex="0" data-a="rsel" data-v="${k}" data-id="${esc(x.id)}" aria-selected="${!!r&&x.id===r.id}"><span class="tag ${SS[x.status][1]}">${SS[x.status][0]}</span>${isC?`<span class="tag ${x.pri==='urgent'?'bad':x.pri==='high'?'warn':'info'}">${esc(x.pri)}</span>`:''}${x.photo?'📷 ':''}${x.voice?'🎤 ':''}<b>${esc(isC?en(x.cat):x.subject)}</b><small>${esc(x.name)} · ${fd(x.ts)}</small></li>`).join('')}</ul>`:'<p class="lead">Nothing here yet. Submit one from the customer app.</p>'}</div>`;
    if(!r)return `<div class="cols2">${list}<div class="card"><p class="lead">Select an item.</p></div></div>`;
    const at=`data-v="${k}" data-id="${esc(r.id)}"`;
    return `<div class="cols2">${list}<div class="card"><h3>${esc(isC?en(r.cat):r.subject)} <span class="tag ${SS[r.status][1]}">${SS[r.status][0]}</span></h3>
      <p class="lead">${esc(r.name)} · ${fd(r.ts)} · Ref ${isC?'C':'E'}-${esc(r.id.slice(-5).toUpperCase())}${r.email?' · '+esc(r.email):''}${r.txn?' · Txn '+esc(r.txn):''}</p>
      ${isC?`<p><span class="tag info">Route: ${esc(r.team)}</span></p>`:''}
      <div class="bub cu">${esc(r.body||'(no text)')}</div>
      ${r.photo?`<div class="att"><img src="${r.photo}" alt="Attached photo"></div>`:''}${r.voice?`<div class="att"><audio controls src="${r.voice}"></audio></div>`:''}
      ${(r.replies||[]).map(p=>`<div class="bub ai">${esc(p.t)}<small style="display:block;opacity:.7">Agent · ${fd(p.ts)}</small></div>`).join('')}
      <label for="rr">Reply</label><textarea id="rr" data-k="rreply" rows="4">${esc(ui.rreply||'')}</textarea>
      <button class="btn" data-a="rsend" ${at}>Send reply</button><button class="btn alt" data-a="rst" data-s="open" ${at}>Mark in progress</button><button class="btn alt" data-a="rst" data-s="resolved" ${at}>Mark resolved</button>
      ${r.email?`<a class="btn alt" style="display:inline-block;text-decoration:none" href="mailto:${esc(r.email)}?subject=${encodeURIComponent('Re: '+(r.subject||en(r.cat)))}">Open in email app</a>`:''}</div></div>`}
  const vCus=()=>`<div class="card"><h3>Customers</h3><p class="lead">Everyone who opens the customer app appears here live. Freeze, adjust a balance, or delete.</p>${W.length?W.map(w=>`<div class="ar"><div class="g"><b>${esc(w.name)}</b> <span class="tag ${w.frozen?'bad':'ok'}">${w.frozen?'Frozen'+(w.frozenBy==='self'?' (by customer)':''):'Active'}</span> <span class="tag info">${({student:'Student',islamic:'Islamic'})[w.acct]||'Personal'}</span><small>${esc(w.id.slice(0,12))} · ${money(w.balance||0)}</small></div><button class="btn alt" data-a="frz" data-id="${esc(w.id)}">${w.frozen?'Unfreeze':'Freeze'}</button><button class="btn alt" data-a="adj" data-id="${esc(w.id)}">Balance</button><button class="btn alt" data-a="del" data-id="${esc(w.id)}">Delete</button></div>`).join(''):'<p class="lead">No customers yet.</p>'}</div>`;
  const vTxn=()=>{const L=T.slice().sort((a,b)=>b.ts-a.ts);return `<div class="card"><h3>Transactions</h3>${L.length?L.map(x=>`<div class="ar"><div class="g"><b>${esc(en(x.t))}</b><small>${esc(x.name)} · ${fd(x.ts)}</small></div><b class="${x.a>0?'pos':'neg'}">${x.a>0?'+':'−'}${money(Math.abs(x.a))}</b><button class="btn alt" data-a="rev" data-id="${esc(x.id)}">Reverse and delete</button></div>`).join(''):'<p class="lead">No transactions yet.</p>'}</div>`};
  const vFaq=()=>`<div class="g2"><div class="card"><h3>Add a common question</h3><p class="lead">When a customer asks it in chat, the assistant sends your answer.</p>
    <label for="fq">Question</label><input id="fq" data-k="fq" value="${esc(ui.fq||'')}">
    <label for="fv">Other ways customers ask it (one per line)</label><textarea id="fv" data-k="fv" rows="3">${esc(ui.fv||'')}</textarea>
    <label for="fa">Your answer</label><textarea id="fa" data-k="fa" rows="4">${esc(ui.fa||'')}</textarea>
    <label class="chk"><input type="checkbox" data-k="fauto" ${ui.fauto===false?'':'checked'}> Send automatically</label>
    <button class="btn" data-a="fadd">Save question</button><p class="lead" role="status" style="margin-top:8px">${esc(msg)}</p></div>
    <div class="card"><h3>Saved questions</h3>${faqs.length?faqs.map((f,i)=>`<div style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px"><span class="tag ${f.auto?'ok':'warn'}">${f.auto?'Auto-reply':'Agent review'}</span><b>${esc(f.q)}</b><div style="color:var(--mute);font-size:13.5px;margin-top:4px">${esc(f.a.slice(0,110))}</div><button class="btn alt" style="margin-left:0" data-a="fdel" data-id="${i}">Delete</button></div>`).join(''):'<p class="lead">No saved questions yet.</p>'}</div></div>`;
  const vPol=()=>`<div class="card"><h3>Reply policies</h3><p class="lead">Each topic has an approved reply and a rule for who sends it. Replace the sample texts with upay 2.0-approved wording in the KB object of app.js.</p><table><thead><tr><th>Topic</th><th>Who replies</th><th>Route</th><th>Sample reply (English)</th></tr></thead><tbody>${Object.values(KB).map(k=>`<tr><td><b>${esc(k.label)}</b></td><td>${k.esc?'Specialist team':k.auto?'Assistant':'Agent approves'}</td><td>${esc(k.team)}</td><td>${esc(k.en({}))}</td></tr>`).join('')}</tbody></table><div class="note">Safety rules apply to every message: never ask for a PIN or OTP, mask phone numbers and secret codes, send fraud reports to the fraud team, and never promise a refund the system cannot guarantee.</div></div>`;
  const vAnn=()=>`<div class="card"><h3>Announcement</h3><p class="lead">Shown as a banner on every customer's home page.${note?' Current: <b>'+esc(note)+'</b>':''}</p><input data-k="ann" value="${esc(ui.ann||'')}" placeholder="e.g. Service paused tonight at 12:00"><button class="btn" data-a="sn">Publish</button><button class="btn alt" data-a="cn">Clear</button><p class="lead" role="status" style="margin-top:8px">${esc(msg)}</p></div>`;

  function vStu(){
    const SS={pending:['Pending','warn'],approved:['Approved','ok'],rejected:['Rejected','bad']},S=s=>SS[s]||['Unknown','info'],
      Ls=AR.slice().sort((a,b)=>b.ts-a.ts),r=Ls.find(x=>x.id===selA)||Ls[0],C0=stuCfg(),R0=C0.req;
    const list=`<div class="card"><h3>Student account requests</h3><p class="lead">Customers who asked for a student account. Check the documents, then approve or reject.</p>${Ls.length?`<ul class="list">${Ls.map(x=>`<li tabindex="0" data-a="asel" data-id="${esc(x.id)}" aria-selected="${!!r&&x.id===r.id}"><span class="tag ${S(x.status)[1]}">${S(x.status)[0]}</span><b>${esc(x.name)}</b><small>${esc(x.uni||'')} · ${fd(x.ts)}</small></li>`).join('')}</ul>`:'<p class="lead">No requests yet. A customer can apply from More › Account Type › Student.</p>'}</div>`;
    const chk=(on,ok,label,val)=>on?`<li><span>${label}</span><b>${ok?'✓ ':'✗ '}${esc(val||'missing')}</b></li>`:'';
    const det=r?`<div class="card"><h3>${esc(r.name)} <span class="tag ${S(r.status)[1]}">${S(r.status)[0]}</span></h3>
      <p class="lead">Ref S-${esc(r.id.slice(-5).toUpperCase())} · ${fd(r.ts)}</p>
      <ul class="why">${chk(R0.email,!!r.email&&eduOk(C0.domains,r.email),'University email',r.email)}${chk(R0.uni,!!r.uni,'University',r.uni)}${chk(R0.sid,!!r.sid,'Student ID',r.sid)}${chk(R0.card,!!r.card,'ID card photo',r.card?'attached':'')}${chk(R0.selfie,!!r.selfie,'Selfie with ID',r.selfie?'attached':'')}</ul>
      ${r.card?`<p class="lead" style="margin:12px 0 0">ID card</p><div class="att"><img src="${r.card}" alt="ID card photo"></div>`:''}
      ${r.selfie?`<p class="lead" style="margin:12px 0 0">Selfie with ID card</p><div class="att"><img src="${r.selfie}" alt="Selfie with ID card"></div>`:''}
      ${r.note?`<div class="note">Last note to customer: ${esc(r.note)}</div>`:''}
      <label for="ar">Note to customer${r.status==='approved'?' (required to revoke)':r.status==='pending'?' (required to reject)':''}</label>
      <textarea id="ar" data-k="areason" rows="3">${esc(ui.areason||'')}</textarea>
      ${r.status!=='approved'?`<button class="btn" data-a="aok" data-id="${esc(r.id)}">Approve student account</button>`:''}
      ${r.status!=='rejected'?`<button class="btn alt" data-a="ano" data-id="${esc(r.id)}">${r.status==='approved'?'Revoke approval':'Reject'}</button>`:''}
      <p class="lead" role="status" style="margin-top:8px">${esc(amsg)}</p></div>`
      :'<div class="card"><p class="lead">Select a request.</p></div>';
    const rules=`<div class="card" style="margin-top:14px"><h3>Application rules</h3><p class="lead">Customers see these guidelines on the student account form and must provide every item you tick before they can apply.</p>
      <label for="gen">Guidelines (English)</label><textarea id="gen" data-k="g_en" rows="5">${esc(uv('g_en',C0.guide_en))}</textarea>
      <label for="gbn">Guidelines (Bangla)</label><textarea id="gbn" data-k="g_bn" rows="5">${esc(uv('g_bn',C0.guide_bn))}</textarea>
      <label for="gdm">Accepted email domains (comma separated, empty = any email)</label><input id="gdm" data-k="g_dom" value="${esc(uv('g_dom',C0.domains))}">
      <p class="lead" style="margin:12px 0 4px">Required from the customer</p>
      ${[['email','University (edu) email'],['uni','University name'],['sid','Student ID number'],['card','ID card photo'],['selfie','Selfie holding the ID card']].map(([k,l])=>`<label class="chk"><input type="checkbox" data-k="rq_${k}" ${uv('rq_'+k,R0[k])?'checked':''}> ${l}</label>`).join('')}
      <button class="btn" data-a="sg">Save rules</button><p class="lead" role="status" style="margin-top:8px">${esc(msg)}</p></div>`;
    return `<div class="cols2">${list}${det}</div>${rules}`;
  }
  function vModal(){const w=W.find(x=>x.id===modal.id);if(!w)return'';const d=modal.type==='del';
    return `<div class="sheet on"><div class="panel"><h3>${esc(w.name)} — ${d?'delete?':'balance'}</h3>${d?'<p style="margin-bottom:12px">This removes the customer, their chat and all their transactions.</p>':`<input data-k="adjv" inputmode="numeric" placeholder="+500 or -200" value="${esc(ui.adjv||'')}">`}<button class="btn" data-a="mok">${d?'Yes, delete':'Update balance'}</button><button class="btn alt" data-a="mno">Cancel</button></div></div>`}

  function render(){
    const ae=document.activeElement,aid=ae&&ae.dataset&&ae.dataset.k,n=s=>C.filter(c=>c.status===s).length,tot=W.reduce((x,w)=>x+(w.balance||0),0);
    let h=`<header><div class="logo">u</div><div><h1 style="font-size:24px;margin:0">upay 2.0 Admin Console</h1><p>Live chat, AI-assisted replies, customers and transactions in one place.</p></div><span class="tag info" style="margin-left:auto">Demo · local data</span></header>
    <div class="kpis">${[['Chats',C.length],['Auto-replied',n('auto_sent')],['Needs review',n('needs_review')],['Escalated',n('escalated')],['New emails',nw(M)],['New complaints',nw(X)],['Student requests',pn()],['Customers',W.length],['Total balance',money(tot)]].map(([l,v])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    <nav>${TABS.map(([i,l])=>`<button data-a="tab" data-v="${i}" aria-selected="${tab===i}">${l}${i==='mail'&&nw(M)?' ('+nw(M)+')':i==='comp'&&nw(X)?' ('+nw(X)+')':i==='stu'&&pn()?' ('+pn()+')':''}</button>`).join('')}</nav>`;
    h+=({ana:vAna,chat:vChat,mail:()=>vReq('mail'),comp:()=>vReq('comp'),cus:vCus,txn:vTxn,faq:vFaq,pol:vPol,stu:vStu,ann:vAnn})[tab]();if(modal)h+=vModal();
    root.innerHTML=h;
    if(aid){const e=root.querySelector(`[data-k="${aid}"]`);if(e){e.focus();try{e.setSelectionRange(e.value.length,e.value.length)}catch(_){}}}
    const t=root.querySelector('.thr');if(t)t.scrollTop=t.scrollHeight;
  }
  root.addEventListener('input',e=>{const k=e.target.dataset&&e.target.dataset.k;if(k)ui[k]=e.target.type==='checkbox'?e.target.checked:e.target.value});
  root.addEventListener('click',async e=>{
    const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a,id=b.dataset.id;
    try{
      if(a==='tab'){tab=b.dataset.v;msg='';amsg='';render()}
      else if(a==='sel'){sel=id;ui.reply='';const c=chatOf(id);if(c&&c.unreadAdmin)await cols.chats.doc(id).update({unreadAdmin:0});render()}
      else if(a==='draft'){ui.reply=chatOf(sel).draft;render()}
      else if(a==='gem'){const c=chatOf(sel),last=c&&[...c.msgs].reverse().find(m=>m.f==='cu');if(!last||ui.gemBusy)return;ui.gemBusy=true;ui.gemMsg='';render();
        try{const r=await API.post('/api/admin/ai/draft',{text:last.t,topic:(c.a&&c.a.policy)||''});ui.reply=r.draft;ui.gemMsg='Draft from '+r.model+'. Read it, edit it, then send. It was not sent to the customer.'}
        catch(e){ui.gemMsg=e.code==='ai_off'?'Gemini is not set up on the server (GEMINI_API_KEY).':e.message||'Gemini failed.'}
        ui.gemBusy=false;render()}
      else if(a==='send'){const c=chatOf(sel),t=(ui.reply||'').trim();if(!c||!t)return;ui.reply='';
        await cols.chats.doc(sel).update({msgs:[...c.msgs,{f:'ag',t,ts:Date.now()}],status:'agent_sent',last:Date.now(),unreadCust:(c.unreadCust||0)+1,audit:[...(c.audit||[]),'Agent approved reply '+ts()]})}
      else if(a==='esc'){const c=chatOf(sel);await cols.chats.doc(sel).update({status:'escalated',audit:[...(c.audit||[]),'Escalated to '+c.a.team+' '+ts()]})}
      else if(a==='rsel'){if(b.dataset.v==='comp')selX=id;else selM=id;ui.rreply='';render()}
      else if(a==='rsend'){const t=(ui.rreply||'').trim();if(!t)return;const c=b.dataset.v==='comp',r=(c?X:M).find(x=>x.id===id);if(!r)return;ui.rreply='';
        await (c?cols.complaints:cols.emails).doc(id).update({replies:[...(r.replies||[]),{t,ts:Date.now()}],status:r.status==='resolved'?'resolved':'open',unreadCust:(r.unreadCust||0)+1})}
      else if(a==='rst'){await (b.dataset.v==='comp'?cols.complaints:cols.emails).doc(id).update({status:b.dataset.s,...(b.dataset.s==='resolved'?{resolvedAt:Date.now()}:{})})}
      else if(a==='anarange'){ui.anaDays=+b.dataset.v;render()}
      else if(a==='anasample'){ui.anaSample=!uv('anaSample',false);render()}
      else if(a==='anacsv'){anaCsv()}
      else if(a==='frz'){const w=W.find(x=>x.id===id);await cols.wallets.doc(id).update({frozen:!w.frozen,frozenBy:w.frozen?'':'admin'})}
      else if(a==='adj'||a==='del'){modal={type:a,id};ui.adjv='';render()}
      else if(a==='mno'){modal=null;render()}
      else if(a==='mok'){const w=W.find(x=>x.id===modal.id);
        if(modal.type==='adj'){const v=parseInt(ui.adjv);if(!v)return;const t='t'+Date.now();
          const wr=cols.wallets.doc(w.id);if(wr.inc)await wr.inc('balance',v);else await wr.update({balance:(w.balance||0)+v});await cols.txs.doc(t).set({id:t,uid:w.id,name:w.name,t:'Admin adjustment',a:v,ts:Date.now()})}
        else{for(const x of T.filter(x=>x.uid===w.id))await cols.txs.doc(x.id).delete();for(const x of M.filter(x=>x.uid===w.id))await cols.emails.doc(x.id).delete();for(const x of X.filter(x=>x.uid===w.id))await cols.complaints.doc(x.id).delete();await cols.chats.doc(w.id).delete();await cols.acctreqs.doc(w.id).delete();await cols.wallets.doc(w.id).delete()}
        modal=null;render()}
      else if(a==='rev'){const x=T.find(t=>t.id===id),w=x&&W.find(q=>q.id===x.uid);if(w){const wr=cols.wallets.doc(w.id);if(wr.inc)await wr.inc('balance',-x.a);else await wr.update({balance:(w.balance||0)-x.a})}await cols.txs.doc(id).delete()}
      else if(a==='fadd'){const q=(ui.fq||'').trim(),an=(ui.fa||'').trim();if(!q||!an){msg='Write both the question and the answer.';render();return}
        await fqd.set({list:[...faqs,{q,alt:(ui.fv||'').split('\n').map(x=>x.trim()).filter(Boolean),a:an,auto:ui.fauto!==false}]});ui.fq=ui.fv=ui.fa='';msg='Saved. Customers who ask this now get your answer.';render()}
      else if(a==='fdel'){await fqd.set({list:faqs.filter((_,i)=>i!==+id)})}
      else if(a==='asel'){selA=id;ui.areason='';amsg='';render()}
      else if(a==='aok'){const w=W.find(x=>x.id===id);
        await cols.acctreqs.doc(id).update({status:'approved',note:(ui.areason||'').trim(),decidedAt:Date.now(),unreadCust:1});
        if(w)await cols.wallets.doc(id).update({acct:'student',studentOK:true});
        ui.areason='';amsg='Approved. The customer now has a student account.';render()}
      else if(a==='ano'){const reason=(ui.areason||'').trim(),w=W.find(x=>x.id===id);
        if(!reason){amsg='Write a short note so the customer knows why.';render();return}
        await cols.acctreqs.doc(id).update({status:'rejected',note:reason,decidedAt:Date.now(),unreadCust:1});
        if(w&&(w.studentOK||w.acct==='student'))await cols.wallets.doc(id).update({acct:w.acct==='student'?'personal':w.acct,studentOK:false});
        ui.areason='';amsg='Done. The customer can see your note and apply again.';render()}
      else if(a==='sg'){const C0=stuCfg();
        await stuDoc.set({guide_en:String(uv('g_en',C0.guide_en)).trim(),guide_bn:String(uv('g_bn',C0.guide_bn)).trim(),domains:String(uv('g_dom',C0.domains)).trim(),req:Object.fromEntries(['email','uni','sid','card','selfie'].map(k=>[k,!!uv('rq_'+k,C0.req[k])]))});
        ['g_en','g_bn','g_dom','rq_email','rq_uni','rq_sid','rq_card','rq_selfie'].forEach(k=>delete ui[k]);msg='Saved. New applications follow these rules.';render()}
      else if(a==='sn'){const v=(ui.ann||'').trim();if(v){await cfg.set({text:v,ts:Date.now()});msg='Published.';render()}}
      else if(a==='cn'){await cfg.set({text:'',ts:Date.now()});ui.ann='';msg='Cleared.';render()}
    }catch(err){console.error(err);msg='Something went wrong. Try again.';render()}
  });
  (async()=>{
    let db;
    if(API.on){/* backend mode: staff sign in with the admin key (set UPAY_ADMIN_KEY on the server) */
      for(let i=0;i<3&&!db;i++){
        API.adminKey=sessionStorage.getItem('upay_admin_key')||prompt('Admin key');
        if(!API.adminKey){root.textContent='Admin key required. Reload the page to try again.';return}
        try{await API.get('/api/admin/wallets');sessionStorage.setItem('upay_admin_key',API.adminKey);db=makeAdminApi()}
        catch(e){sessionStorage.removeItem('upay_admin_key');API.adminKey=null;if(e.code==='network'){root.textContent='Cannot reach the server.';return}}}
      if(!db){root.textContent='Wrong admin key. Reload the page to try again.';return}
    }else db=window.claude&&await claude.use('db');
    if(!db){root.textContent='Storage is not available in this browser.';return}
    cols={wallets:db.collection('wallets'),txs:db.collection('txs'),chats:db.collection('chats'),emails:db.collection('emails'),complaints:db.collection('complaints'),acctreqs:db.collection('acctreqs')};cfg=db.doc('config/app');fqd=db.doc('config/faqs');stuDoc=db.doc('config/student');
    cols.wallets.onSnapshot(q=>{W=q.docs.map(d=>({id:d.id,...d.data()}));render()});
    cols.txs.onSnapshot(q=>{T=q.docs.map(d=>d.data());render()});
    cols.chats.onSnapshot(q=>{C=q.docs.map(d=>({id:d.id,...d.data()}));render()});
    cols.emails.onSnapshot(q=>{M=q.docs.map(d=>({id:d.id,...d.data()}));render()});
    cols.complaints.onSnapshot(q=>{X=q.docs.map(d=>({id:d.id,...d.data()}));render()});
    cols.acctreqs.onSnapshot(q=>{AR=q.docs.map(d=>({id:d.id,...d.data()}));render()});
    stuDoc.onSnapshot(d=>{stu=d.data()||null;render()});
    cfg.onSnapshot(d=>{note=(d.data()||{}).text||'';render()});
    fqd.onSnapshot(d=>{faqs=((d.data()||{}).list)||[];render()});
    render();
  })();
}

