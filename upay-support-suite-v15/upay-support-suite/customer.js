/* customer.js - wallet app: payments, PIN, limits, student plan, guardian, split, support chat */
/* ---------- Customer app ---------- */
function initCustomer(){
  let pendRef='',pendX={},balance=12500,shown=false,plan={buckets:[],rules:[],saved:[]},hq='',curAcct='personal',curVerified=false;
  let tx=[
   {t:'ক্যাশ ইন',d:'আজ, ১০:৩০',a:5000,k:'in'},
   {t:'মোবাইল রিচার্জ',d:'গতকাল, ৮:১৫',a:-249,k:'out'},
   {t:'সেন্ড মানি',d:'২৮ সেপ্টেম্বর',a:-1500,k:'out'},
   {t:'রিসিভ মানি',d:'২৬ সেপ্টেম্বর',a:2000,k:'in'},
   {t:'বিদ্যুৎ বিল',d:'২৪ সেপ্টেম্বর',a:-860,k:'out'}];
  const main=[['সেন্ড মানি','💸','#d9efff'],['মোবাইল রিচার্জ','📱','#d9efff'],['ক্যাশ আউট','🏧','#ffe6d0'],['পে বিল','🧾','#d9efff'],
   ['অ্যাড মানি','➕','#e6e1f7'],['সঞ্চয়','👛','#fff0c2'],['ফান্ড ট্রান্সফার','🏦','#d9efff'],['রিকোয়েস্ট মানি','💬','#d6f5ee'],
   ['মেক পেমেন্ট','▦','#e8f3ff'],['বিল স্প্লিট','🧮','#d6f5ee'],['রেফার & আর্ন','🎁','#ffe0ea']];
  const pay=[['ট্রাফিক ফাইন','🚦','#dff5e3'],['টোল পেমেন্ট','🛣️','#e6ecf5'],['সরকারি পেমেন্ট','🏛️','#ffe3e3'],['এডুকেশন','🎓','#e6e1f7'],
   ['এনজিও','🤲','#fff0c2'],['বীমা','🛡️','#d6f5ee'],['ডোনেশন','🙏','#ffe6d0'],['যাকাত পেমেন্ট','🕌','#dff5e3'],
   ['ফ্লাইট','✈️','#d9efff'],['হোটেল','🏨','#d6f5ee'],['মুভি','🎬','#ffe0ea'],['আরো','⋯','#eee']];
  const mk=(a,el)=>{$(el).innerHTML=a.map(([n,i,c])=>`<button class="it" data-s="${n}"><div class="ic" style="background:${c}">${i}</div>${tr(n)}</button>`).join('')};
  mk(main,'#g1');mk(pay,'#g2');
  
  // banners
  const bs=[['linear-gradient(120deg,#0b4aa2,#2b7be0)','আনলিমিটেড ক্যাশব্যাক','রিচার্জে ৳১০ পর্যন্ত ক্যাশব্যাক'],['linear-gradient(120deg,#c2185b,#ef5b8f)','বিল পেমেন্টে অফার','প্রথম বিলে ৫% ছাড়'],['linear-gradient(120deg,#0f7a5a,#35b88a)','রেফার করুন, আর্ন করুন','বন্ধুকে ডাকুন, ৳৫০ পান']];
  $('#ban').innerHTML=bs.map((b,i)=>`<div class="slide${i?'':' on'}" style="background:${b[0]}"><h3>${tr(b[1])}</h3><p>${tr(b[2])}</p></div>`).join('');
  $('#dots').innerHTML=bs.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('');
  let bi=0;const sl=$$('.slide'),dt=$$('#dots i');
  const go=i=>{bi=(i+3)%3;sl.forEach((s,k)=>s.classList.toggle('on',k==bi));dt.forEach((s,k)=>s.classList.toggle('on',k==bi))};
  setInterval(()=>go(bi+1),3500);$('#ban').onclick=()=>go(bi+1);
  
  // tabs
  function tab(n){$$('.view').forEach(v=>v.classList.toggle('on',v.id=='v-'+n));$$('.nav .t').forEach(b=>b.classList.toggle('on',b.dataset.tab==n));$('#v-'+n).scrollTop=0}
  $$('.nav .t').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
  
  // toast
  let tt;function toast(m){const t=$('#toast');t.textContent=tr(m);t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800)}
  $$('[data-toast]').forEach(e=>e.onclick=()=>toast(e.dataset.toast));
  $('#chatBtn').onclick=()=>window.openCS&&window.openCS();
  $('#supRow').onclick=()=>window.openCS&&window.openCS();
  $('#bell').onclick=()=>toast('নতুন কোনো নোটিফিকেশন নেই');
  
  // balance
  function paintBal(){$('#balBtn').textContent=shown?money(balance):tr('ব্যালেন্স');paintWal()}
  $('#balBtn').onclick=()=>{shown=!shown;paintBal();if(shown)setTimeout(()=>{shown=false;paintBal()},4000)};
  
  // history
  let flt='all';
  const hisList=()=>{const q=hq.trim().toLowerCase();return tx.filter(x=>(flt=='all'||x.k==flt)&&(!q||[x.t,x.ph,x.rn,x.trx].some(v=>String(v||'').toLowerCase().includes(q))))};
  function paintHis(){
   $('#hlist').innerHTML=hisList().map(x=>`<div class="row"><span>${x.k=='in'?'⬇️':'⬆️'}</span><div class="g">${tr(x.t)}${x.undone?' ('+L('বাতিল','cancelled')+')':''}${x.rn||x.ph?' · '+esc(x.rn||x.ph):''}<small>${x.ts?fdf(x.ts):tr(x.d)}</small>${x.ph?`<small>${esc(x.ph)}${x.rn&&x.rn!==x.ph?' · '+esc(x.rn):''}${x.trx?' · ID: '+esc(x.trx):''}</small>`:''}${x.ref?`<small>📝 ${esc(x.ref)}</small>`:''}${x.fee?`<small>${L('চার্জ','Fee')}: ${money(x.fee)}</small>`:''}${x.bal!==undefined?`<small>${L('ব্যালেন্স (লেনদেনের পর)','Balance after')}: ${money(x.bal)}</small>`:''}${x.src?`<small>${L('ক্যাটাগরি','Bucket')}: ${esc(x.src)}</small>`:''}</div><span class="${x.a>0?'pos':'neg'}" style="${x.undone?'text-decoration:line-through;opacity:.5':''}">${x.a>0?'+':'−'}${money(Math.abs(x.a))}</span></div>`).join('');paintSum()}
  $('#hq').oninput=e=>{hq=e.target.value;paintHis()};
  /* Statement export: exactly what the filter/search currently shows. BOM makes Excel read Bangla correctly. */
  const csvCell=v=>{if(typeof v!=='number'){v=String(v??'');if(/^[=+\-@\t\r]/.test(v)&&isNaN(Number(v)))v="'"+v}else v=String(v);return'"'+v.replace(/"/g,'""')+'"'};
  function statementCSV(){const rows=[['Date','Day','Time','Type','Phone','Name','Amount (BDT)','Fee (BDT)','Balance after (BDT)','Bucket','Transaction ID','Status']];
   hisList().forEach(x=>{const d=x.ts?new Date(x.ts):null,p2=n=>String(n).padStart(2,'0');
    rows.push([d?d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate()):x.d,d?d.toLocaleDateString('en-GB',{weekday:'long'}):'',d?p2(d.getHours())+':'+p2(d.getMinutes()):'',tr(x.t),x.ph||'',x.rn||'',x.a,x.fee||0,x.bal!==undefined?x.bal:'',x.src||'',x.trx||'',x.undone?'cancelled':'ok'])});
   return rows.map(r=>r.map(csvCell).join(',')).join('\r\n')}
  $('#hcsv').onclick=()=>{const b=new Blob(['\ufeff'+statementCSV()],{type:'text/csv;charset=utf-8'}),a=document.createElement('a');
   a.href=URL.createObjectURL(b);a.download='upay-statement-'+new Date().toISOString().slice(0,10)+'.csv';document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)};
  $('#hprint').onclick=()=>window.print();
  $$('[data-f]').forEach(b=>b.onclick=()=>{flt=b.dataset.f;$$('[data-f]').forEach(c=>c.classList.toggle('on',c==b));paintHis()});
  
  // sheet
  const sheet=$('#sheet'),panel=$('#panel');
  const close=()=>sheet.classList.remove('on');
  sheet.onclick=e=>{if(e.target==sheet)close()};
  function open(h){panel.innerHTML=h;tx8(panel);sheet.classList.add('on');if(panel.querySelector('.pinp'))pinPad()}
  function pinPad(){let cur=panel.querySelector('.pinp');panel.querySelectorAll('.pinp').forEach(i=>i.addEventListener('focus',()=>cur=i));
   const kp=document.createElement('div');kp.className='kp';kp.innerHTML=[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map(k=>`<button type="button" data-k="${k}">${k}</button>`).join('');
   const ok=panel.querySelector('#pok');ok?ok.before(kp):panel.appendChild(kp);
   kp.onclick=e=>{const k=e.target.dataset&&e.target.dataset.k;if(k===undefined)return;if(k==='✓'){const o=panel.querySelector('#pok');o&&o.click();return}
    if(k==='⌫')cur.value=cur.value.slice(0,-1);else if(cur.value.length<4)cur.value+=k;
    if(cur.value.length===4){const n=panel.querySelector('.pinp:not([value=""])');const nx=[...panel.querySelectorAll('.pinp')].find(i=>i.value.length<4);if(nx){cur=nx;nx.focus()}}}}
  const isStu=()=>curAcct==='student'&&curVerified;
  const freeBal=()=>balance-(plan.buckets||[]).reduce((s,b)=>s+b.amt,0);
  const feeOf=(t,a)=>t==='ক্যাশ আউট'?Math.round(a*0.0185*(isStu()?0.8:1)*100)/100:0;
  const trx=()=>'UP'+Date.now().toString(36).toUpperCase()+Math.random().toString(36).slice(2,4).toUpperCase();
  const nameOf=p=>((plan.saved||[]).find(s=>s.phone===p)||{}).name||'';
  const moneyForm=(title,sign,label,ph)=>{const rf0=pendRef,X0=pendX;pendRef='';pendX={};const out=sign<0,bk=isStu()&&out?plan.buckets:[],snd=title==='সেন্ড মানি';let step=0,rw=null;const idem=(window.crypto&&crypto.randomUUID)?crypto.randomUUID():String(Date.now())+Math.random();
   open(`<h3>${title}</h3><input id="f1" inputmode="numeric" placeholder="${ph}"><input id="f2" inputmode="numeric" placeholder="টাকার পরিমাণ">${bk.length?`<select id="f3"><option value="">${L('খালি ব্যালেন্স','Free balance')} (${money(freeBal())})</option>${bk.map((b,i)=>`<option value="${i}">${esc(b.n)} (${money(b.amt)})</option>`).join('')}</select>`:''}${out?'<small id="fee"></small>':''}<button class="btn" id="ok">নিশ্চিত করুন</button><button class="btn alt" id="no">বাতিল</button>`);
   const pf=()=>{const e=$('#fee');if(!e)return;const a=parseInt($('#f2').value)||0,f=feeOf(title,a);
    e.textContent=title==='ক্যাশ আউট'?L('চার্জ: ','Fee: ')+money(f)+(isStu()?L(' (স্টুডেন্ট ২০% ছাড় সহ)',' (incl. 20% student discount)'):''):snd?L('চার্জ: ৳ ০ (ফ্রি)','Fee: ৳ 0 (free)'):''};
   $('#f1').oninput=$('#f2').oninput=()=>{step=0;$('#ok').textContent=tr('নিশ্চিত করুন');pf()};pf();$('#no').onclick=close;
    if(title==='মোবাইল রিচার্জ'){$('#f1').insertAdjacentHTML('afterend','<small id="opRow"></small>');const op=()=>{const o=opOf($('#f1').value);$('#opRow').textContent=o?L('অপারেটর: '+o.bn+' (নম্বরের শুরু দেখে; পোর্ট করা হলে আলাদা হতে পারে)','Operator: '+o.en+' (from the number prefix; may differ if the number was ported)'):''};$('#f1').addEventListener('input',op);op()}
   $('#ok').onclick=async()=>{const p=$('#f1').value.trim(),a=parseInt($('#f2').value);
    if(!p&&out){toast('নম্বর দিন');return}
    if(!a||a<=0){toast('সঠিক পরিমাণ দিন');return}
    if(title==='মোবাইল রিচার্জ'){/* the server checks the same things again; here the customer gets the message before the PIN */
     if(!/^01\d{9}$/.test(p)){toast(L('১১ সংখ্যার মোবাইল নম্বর দিন','Enter an 11-digit mobile number'));return}
     if(a<RECHARGE.min||a>RECHARGE.max){toast(L('রিচার্জ ৳১০ থেকে ৳১০০০ এর মধ্যে হতে হবে','Recharge must be between ৳10 and ৳1,000'));return}
     if(!API.on&&p.endsWith(FAIL_SUFFIX)){toast(L('অপারেটর এখন রিচার্জ নিতে পারছে না, টাকা কাটা হয়নি','The operator could not accept this recharge. You were not charged'));return}}
    if(title==='পে বিল'&&X0.biller&&!API.on&&p.endsWith('0000000')){toast(L('বিলার এখন পেমেন্ট নিতে পারছে না, টাকা কাটা হয়নি','The biller could not accept this payment. You were not charged'));return}
    if(API.on){/* backend mode: the SERVER computes the fee, checks balance, limits, PIN and student status */
     if(!out){if(title==='অ্যাড মানি'){try{await API.post('/api/demo/add-money',{amount:a})}catch(e){toast(apiMsg(e));return}close();await API.kick();toast(L(title+' সফল হয়েছে ✓',tr(title)+' successful ✓'))}
      else toast(L(title+' শিগগিরই আসছে',tr(title)+' is coming soon'));return}
     if(snd&&step===0){let nm=null;try{const r=await API.get('/api/lookup/'+encodeURIComponent(p));if(r.is_self){toast(L('নিজের নম্বরে পাঠানো যাবে না','You cannot send to your own number'));return}nm=r.name}catch(e){if(e.code!=='not_found'){toast(apiMsg(e));return}}
      step=1;$('#fee').innerHTML=nm?L('প্রাপক: ','Recipient: ')+'<b>'+esc(nm)+'</b> ('+esc(p)+')':'⚠️ '+L('এই নম্বর upay 2.0-তে পাওয়া যায়নি। নম্বর ঠিক আছে তো?','Number not found on upay 2.0. Is it correct?');
      $('#ok').textContent=L('হ্যাঁ, পাঠান','Yes, send');return}
     const si0=$('#f3')?$('#f3').value:'',bname=si0!==''&&plan.buckets[si0]?plan.buckets[si0].n:null;
     const r=await askPinDo(tr(title)+' · '+money(a),pin=>API.post('/api/pay',{service:SERVICE_OF[title],amount:a,to_phone:p,bucket:bname,pin,operator:X0.op||'',biller:X0.biller||''},{'Idempotency-Key':idem}));
     if(!r)return;close();await API.kick();toast(L(title+' সফল হয়েছে ✓',tr(title)+' successful ✓'));
     if(snd){undo={id:r.tx_id,until:Date.now()+12e4};showUndo()}return}
    if(snd&&step===0){rw=await findW(p);if(rw&&rw.id===uid){toast(L('নিজের নম্বরে পাঠানো যাবে না','You cannot send to your own number'));return}
     step=1;$('#fee').innerHTML=rw?L('প্রাপক: ','Recipient: ')+'<b>'+esc(rw.name)+'</b> ('+esc(p)+')':'⚠️ '+L('এই নম্বর upay 2.0-তে পাওয়া যায়নি। নম্বর ঠিক আছে তো?','Number not found on upay 2.0. Is it correct?');
     $('#ok').textContent=L('হ্যাঁ, পাঠান','Yes, send');return}
    const fee=out?feeOf(title,a):0,tot=a+fee,si=$('#f3')?$('#f3').value:'',pl=JSON.parse(JSON.stringify(plan)),m={amt:a,fee,ph:p,rn:out?(X0.name||(rw?rw.name:nameOf(p))):'',trx:trx(),ref:rf0};
    if(out){if(si!==''){if(tot>pl.buckets[si].amt){toast('ব্যালেন্স পর্যাপ্ত নয়');return}pl.buckets[si].amt-=tot;m.src=pl.buckets[si].n;m.plan=pl}
     else if(tot>freeBal()){toast('ব্যালেন্স পর্যাপ্ত নয়');return}}
    if(out){const le=limitErr(tot);if(le){toast(le);return}if(!(await askPin(tr(title)+' · '+money(tot))))return}
    if(!(await commit(title,sign*tot,m)))return;close();toast(L(title+' সফল হয়েছে ✓',tr(title)+' successful ✓'));
    if(snd){const u={id:lastId,a,fee,src:m.src||'',until:Date.now()+12e4};if(rw){u.rwId=rw.id;u.rid=await creditSend(rw.id,rw.name,a,m.trx)}undo=u;showUndo()}}};
  const forms={'সেন্ড মানি':()=>moneyForm('সেন্ড মানি',-1,'out','প্রাপকের মোবাইল নম্বর'),
   'মোবাইল রিচার্জ':()=>moneyForm('মোবাইল রিচার্জ',-1,'out','মোবাইল নম্বর'),
   'ক্যাশ আউট':()=>moneyForm('ক্যাশ আউট',-1,'out','এজেন্ট নম্বর'),
   'অ্যাড মানি':()=>moneyForm('অ্যাড মানি',1,'in','ব্যাংক/কার্ড নম্বর'),
   'পে বিল':()=>moneyForm('পে বিল',-1,'out','বিলার/অ্যাকাউন্ট নম্বর'),
   'মেক পেমেন্ট':()=>moneyForm('মেক পেমেন্ট',-1,'out','মার্চেন্ট নম্বর'),
   'ফান্ড ট্রান্সফার':()=>moneyForm('ফান্ড ট্রান্সফার',-1,'out','ব্যাংক অ্যাকাউন্ট নম্বর'),
   'রিকোয়েস্ট মানি':()=>moneyForm('রিকোয়েস্ট মানি',1,'in','যার কাছে চাইবেন তার নম্বর'),'বিল স্প্লিট':()=>window.splitForm&&window.splitForm()};
  $$('.it').forEach(b=>b.onclick=()=>{const n=b.dataset.s;(forms[n]||(()=>toast(L(n+' শিগগিরই আসছে',tr(n)+' is coming soon'))))()});
  $$('[data-act]').forEach(b=>b.onclick=()=>forms[b.dataset.act==='Add Money'?'অ্যাড মানি':'ক্যাশ আউট']());
  /* ---------- screens that follow the real upay 2.0 app: Send Money, Cash Out, Pay Bill, Account + profile photo ---------- */
  const pgx=$('#pgx'),pgT=$('#pgT'),pgB=$('#pgB');
  const pgOpen=(t,h)=>{pgT.textContent=t;pgB.innerHTML=h;pgx.classList.add('on');pgB.scrollTop=0};
  const pgClose=()=>pgx.classList.remove('on');$('#pgBack').onclick=pgClose;
  const PB=()=>L('বর্তমান ব্যালেন্স: ','Current balance: ')+money(balance);
  /* hand over to the existing payment flow (fee, limits, PIN, backend) with the values already filled */
  const runForm=(title,ph,amt,ref,x)=>{pgClose();pendRef=ref||'';pendX=x||{};moneyForm(title,-1,'out','');$('#f1').value=ph;$('#f2').value=amt;$('#ok').click()};
  /* settings that follow the customer to a new phone: favourites, photo, reminders, saved billers.
     Demo mode: browser storage only. Backend mode: the server copy wins; this phone keeps a mirror so the app also opens offline. */
  const PREF={favs:{k:()=>'upay_fav_'+uid},photo:{k:()=>'upay_photo_'+uid,raw:1},reminders:{k:()=>'upay_reminders_'+uid},billers:{k:()=>'upay_billers_'+uid}};
  const prefGet=n=>{try{const v=localStorage.getItem(PREF[n].k())||'';return PREF[n].raw?v:JSON.parse(v||'[]')}catch(e){return PREF[n].raw?'':[]}};
  const prefLocal=(n,v)=>{try{if(PREF[n].raw){if(v)localStorage.setItem(PREF[n].k(),v);else localStorage.removeItem(PREF[n].k())}else localStorage.setItem(PREF[n].k(),JSON.stringify(v));return true}catch(e){return false}};
  let prefQ=Promise.resolve(true);
  const prefSet=(n,v)=>{prefLocal(n,v);if(!API.on)return Promise.resolve(true);prefQ=prefQ.then(()=>API.req('PUT','/api/prefs/'+n,{value:v})).then(()=>true,e=>{toast(apiMsg(e));return false});return prefQ};
  async function prefPull(){if(!API.on)return;try{const all=await API.get('/api/prefs'),srv={...all,photo:(await API.get('/api/prefs/photo')).value||''},mk='upay_pm_'+uid,migrated=localStorage.getItem(mk);
    for(const n of Object.keys(PREF)){const s0=srv[n],l=prefGet(n),has=v=>PREF[n].raw?!!v:(v||[]).length>0;
      if(has(s0))prefLocal(n,s0);else if(!migrated&&has(l))await prefSet(n,l);else if(migrated)prefLocal(n,PREF[n].raw?'':[])}
    try{localStorage.setItem(mk,'1')}catch(e){}paintPhoto();remPaint()}catch(e){/* offline: keep what this phone has */}}
  const favs=()=>prefGet('favs'),favSet=a=>prefSet('favs',a),isFav=p=>favs().some(f=>f.phone===p);
  const avl=(n,c)=>`<div class="av sm">${esc((n||c||'?')[0])}</div>`;

  /* profile photo (resized to 192px, kept in this browser per wallet) */
    const getPh=()=>prefGet('photo');
  function paintPhoto(){const p=getPh();$$('.av:not(.sm),#pav,#apav').forEach(e=>{e.style.backgroundImage=p?`url(${p})`:'';e.classList.toggle('ph',!!p);e.textContent=p?'':((myName()||'গ')[0])})}
  function photoSheet(){open(`<h3>${L('প্রোফাইল ছবি','Profile photo')}</h3><button class="btn" id="phA">${L('ছবি বাছুন / তুলুন','Choose / take a photo')}</button>${getPh()?`<button class="btn alt" id="phR">${L('ছবি সরান','Remove photo')}</button>`:''}<button class="btn alt" id="no">${L('বাতিল','Cancel')}</button><input type="file" id="phF" accept="image/*" hidden>`);
   $('#no').onclick=close;const f=$('#phF');$('#phA').onclick=()=>f.click();
   const r=$('#phR');if(r)r.onclick=()=>{prefSet('photo','');close();paintPhoto()};
   f.onchange=()=>{const file=f.files[0];if(!file)return;if(!/^image\//.test(file.type)){toast(L('একটি ছবি বাছুন','Please choose an image'));return}
    const img=new Image(),u=URL.createObjectURL(file);
    img.onload=()=>{const S=192,c=document.createElement('canvas'),m=Math.min(img.width,img.height);c.width=c.height=S;c.getContext('2d').drawImage(img,(img.width-m)/2,(img.height-m)/2,m,m,0,0,S,S);URL.revokeObjectURL(u);
     const du=c.toDataURL('image/jpeg',.82);if(!prefLocal('photo',du)){toast(L('ছবি সেভ করা যায়নি','Could not save the photo'));return}close();paintPhoto();prefSet('photo',du).then(ok=>{if(ok)toast(L('ছবি সেভ হয়েছে ✓','Photo saved ✓'))})};
    img.onerror=()=>toast(L('ছবি পড়া যায়নি','Could not read the image'));img.src=u}}
  $('#penBtn').onclick=photoSheet;

  /* Account page: photo, name, phone, balance, 4 wallets, cash reward, prepaid + linked card */
  function paintWal(){const w=[['প্রাইমারি','Primary',balance,'#e3f5f7'],['ডিসবার্সমেন্ট','Disbursement',0,'#fdeee3'],['সেকেন্ডারি','Secondary',0,'#ece8f1'],['রেমিট্যান্স','Remittance',0,'#f1f4cf']];
   $('#aTop').innerHTML=`<div class="aprof"><div class="av" id="apav" role="button" aria-label="${L('প্রোফাইল ছবি','Profile photo')}"></div><div class="g"><b>${esc(myName())}</b><span>${esc(myPh||'')}</span><small class="chg">📷 ${L('ছবি পরিবর্তন','Change photo')}</small></div><div class="ab"><small>${L('ব্যালেন্স','Balance')}</small><b id="accBal">${money(balance)}</b></div></div>
    <h3 class="wh">${L('ওয়ালেট','Wallet')}</h3><div class="wg">${w.map(x=>`<div style="background:${x[3]}"><small>${L(x[0],x[1])}</small><b>${money(x[2])}</b></div>`).join('')}</div>
    <div class="rew"><div><b>${L('ক্যাশ রিওয়ার্ড','Cash Reward')}</b><b>${money(0)}</b></div><p>${L('মোবাইল রিচার্জসহ সব ধরনের পেমেন্ট ও বিল পরিশোধে এই ব্যালেন্স ব্যবহার করতে পারবেন।','Use this balance for mobile recharge, all payments and bills.')}</p></div>
    <div class="lrow"><span>💳</span><b>${L('প্রিপেইড কার্ড','Prepaid card')}</b><button class="lnk" data-toast="${L('শিগগিরই আসছে','Coming soon')}">＋ ${L('রিকোয়েস্ট','Request')}</button></div>
    <div class="lrow"><span>🏦</span><b>${L('লিংকড ক্রেডিট কার্ড','Linked credit card')}</b><button class="lnk" data-toast="${L('শিগগিরই আসছে','Coming soon')}">＋ ${L('লিংক','Link')}</button></div>`;
   $$('#aTop [data-toast]').forEach(b=>b.onclick=()=>toast(b.dataset.toast));$('#apav').onclick=$('#aTop .chg').onclick=photoSheet;paintPhoto()}
  $('#profRow').onclick=photoSheet;

  /* Send Money: recipient (search / QR / phonebook) -> amount + cash-out charge + reference -> PIN */
  function sendPage(){
   const book=()=>{const m=new Map();(plan.saved||[]).forEach(s=>m.set(s.phone,{phone:s.phone,name:s.name}));hisList().forEach(x=>{if(x.ph&&x.k==='out'&&!m.has(x.ph))m.set(x.ph,{phone:x.ph,name:x.rn||''})});return[...m.values()]};
   const draw=q=>{const sv=book().filter(s=>!q||(s.name||'').toLowerCase().includes(q.toLowerCase())||s.phone.includes(q)),num=/^01\d{9}$/.test(q)&&!sv.some(s=>s.phone===q);
    $('#sl').innerHTML=(num?`<div class="crow" data-p="${q}">${avl('','#')}<div class="g"><b>${q}</b><small>${L('এই নম্বরে পাঠান','Send to this number')}</small></div></div>`:'')+sv.map(s=>`<div class="crow" data-p="${esc(s.phone)}" data-n="${esc(s.name||'')}">${avl(s.name,'#')}<div class="g"><b>${esc(s.name||s.phone)}</b><small>${esc(s.phone)}</small></div></div>`).join('')||`<p class="mute">${L('১১ সংখ্যার নম্বর টাইপ করুন','Type an 11-digit number')}</p>`;
    $$('#sl .crow').forEach(r=>r.onclick=()=>amt(r.dataset.p,r.dataset.n))};
   const amt=(p,n)=>{pgB.innerHTML=`<div class="rrow">${avl(n,'?')}<div class="g"><b>${esc(n||L('অপরিচিত','Unknown'))}</b><small>${esc(p)}</small></div><button class="ed" id="sfav" aria-label="favourite">${isFav(p)?'★':'☆'}</button><button class="ed" id="sed" aria-label="edit">✎</button></div>
     <h4 class="pl">${L('অ্যামাউন্ট','Amount')}</h4><div class="amt"><input id="sa" inputmode="numeric" placeholder="${L('এখানে অ্যামাউন্ট টাইপ করুন','Type the amount here')}"><button class="go" id="sgo">→</button></div>
     <div class="trow"><span>${L('ক্যাশ আউট চার্জ অ্যাড করুন: ','Add cash-out charge: ')}<b id="sfee">${money(0)}</b></span><label class="sw"><input type="checkbox" id="sch"><i></i></label></div>
     <div class="trow"><span>${PB()}</span><button class="lnk" id="sadd">＋ ${L('অ্যাড মানি','Add money')}</button></div>
     <h4 class="pl">${L('রেফারেন্স','Reference')}</h4><textarea id="sr" placeholder="${L('এখানে টাইপ করুন','Type here')}"></textarea>`;
    const a=()=>parseInt($('#sa').value)||0,fee=()=>feeOf('ক্যাশ আউট',a()),tot=()=>a()+($('#sch').checked?Math.ceil(fee()):0);
    $('#sa').oninput=$('#sch').onchange=()=>{$('#sfee').textContent=money(fee().toFixed(2)).replace(/\.0+$/,'')+($('#sch').checked?' ✓':'')};
    $('#sfav').onclick=()=>{let a=favs();if(isFav(p)){a=a.filter(f=>f.phone!==p)}else{a.push({phone:p,name:n||''})}favSet(a);$('#sfav').textContent=isFav(p)?'★':'☆';toast(isFav(p)?L('প্রিয় নম্বরে রাখা হয়েছে ★','Added to favourites ★'):L('প্রিয় থেকে সরানো হয়েছে','Removed from favourites'))};$('#sed').onclick=sendPage;$('#sadd').onclick=()=>forms['অ্যাড মানি']();
    $('#sgo').onclick=()=>{if(!a()){toast(L('সঠিক পরিমাণ দিন','Enter a valid amount'));return}runForm('সেন্ড মানি',p,tot(),$('#sr').value.trim().slice(0,140))}};
   pgOpen(L('সেন্ড মানি','Send Money'),`<div class="favs" id="sfs"></div><h4 class="pl">${L('প্রাপক','Recipient')}</h4><input id="sq" class="sin" inputmode="search" placeholder="${L('নাম অথবা মোবাইল নম্বর টাইপ করুন','Type a name or mobile number')}"><button class="qrb" id="sqr">▦ ${L('স্ক্যান QR কোড','Scan QR code')}</button><div class="sec">${L('ফোনবুক','Phonebook')}</div><div id="sl"></div>`);
   $('#sq').oninput=e=>draw(e.target.value.trim());draw('');
   $('#sfs').innerHTML=favs().map(f=>`<button class="fav" data-p="${esc(f.phone)}" data-n="${esc(f.name||'')}">★ ${esc(f.name||f.phone)}</button>`).join('');$$('#sfs .fav').forEach(b=>b.onclick=()=>amt(b.dataset.p,b.dataset.n));$('#sqr').onclick=()=>$('#qrBtn').click()}

  /* Cash Out: agent number, ATM / QR, amount + quick amounts, balance */
  function cashPage(){
   pgOpen(L('ক্যাশ আউট','Cash Out'),`<h4 class="pl">${L('এজেন্ট মোবাইল নম্বর','Agent mobile number')}</h4><input id="cq" class="sin" inputmode="numeric" placeholder="${L('নাম অথবা মোবাইল নম্বর টাইপ করুন','Type a name or mobile number')}"><div class="two"><button class="atm" id="catm">${L('এটিএম','ATM')}</button><button class="qrb" id="cqr">▦ ${L('স্ক্যান QR কোড','Scan QR code')}</button></div>
    <h4 class="pl">${L('অ্যামাউন্ট','Amount')}</h4><div class="amt"><input id="ca" inputmode="numeric" placeholder="${L('এখানে অ্যামাউন্ট টাইপ করুন','Type the amount here')}"><button class="go" id="cgo">→</button></div>
    <div class="chips">${[500,1000,2000,5000,20000,30000].map(v=>`<button class="chip q" data-v="${v}">${bn(v)}</button>`).join('')}</div><div class="bline">${PB()}</div>`);
   $$('.chip.q').forEach(b=>b.onclick=()=>{$('#ca').value=b.dataset.v});
   $('#catm').onclick=()=>toast(L('এটিএম ক্যাশ আউট শিগগিরই আসছে','ATM cash out is coming soon'));$('#cqr').onclick=()=>$('#qrBtn').click();
   $('#cgo').onclick=()=>{const p=$('#cq').value.trim(),a=parseInt($('#ca').value)||0;if(!/^01\d{9}$/.test(p)){toast(L('এজেন্টের ১১ সংখ্যার নম্বর দিন','Enter the 11-digit agent number'));return}if(!a){toast(L('সঠিক পরিমাণ দিন','Enter a valid amount'));return}runForm('ক্যাশ আউট',p,a)}}

  /* Mobile recharge: number -> operator (guessed from the prefix, the customer can change it for ported numbers) -> amount.
     The operator is SIMULATED in this demo (the server, or the browser demo, pretends to top up). */
  function rechargePage(){
   pgOpen(L('মোবাইল রিচার্জ','Mobile recharge'),`<p class="mute">${PB()}</p>${DEMO?`<div class="dnote">🧪 ${L('ডেমো: অপারেটর সিমুলেটেড, আসল রিচার্জ হবে না। ০০০০০ দিয়ে শেষ হওয়া নম্বরে ব্যর্থতা দেখানো হয়।','Demo: the operator is simulated, no real top-up is sent. A number ending in 00000 shows a failed top-up.')}</div>`:''}
    <h4 class="pl">${L('মোবাইল নম্বর','Mobile number')}</h4><input id="rcP" class="sin" inputmode="numeric" maxlength="11" placeholder="01XXXXXXXXX">
    <div class="opch" id="rcOps">${OPS.map(o=>`<button class="chip" data-op="${o.k}">${L(o.bn,o.en)}</button>`).join('')}</div><small id="rcHint" class="mute"></small>
    <h4 class="pl">${L('পরিমাণ','Amount')}</h4><div class="opch" id="rcQ">${RECHARGE.quick.map(a=>`<button class="chip" data-a="${a}">${money(a)}</button>`).join('')}</div>
    <input id="rcA" class="sin" inputmode="numeric" maxlength="4" placeholder="${L('টাকা','Amount')} (${RECHARGE.min}–${RECHARGE.max})">
    <button class="btn" id="rcGo">${L('রিচার্জ করুন','Recharge')}</button>`);
   let op='',manual=false;
   const paint=()=>{$$('#rcOps .chip').forEach(b=>b.classList.toggle('on',b.dataset.op===op));
    const g=opOf($('#rcP').value);$('#rcHint').textContent=op?(g&&!manual?L('অপারেটর নম্বরের শুরু দেখে ঠিক করা হয়েছে। পোর্ট করা হলে অন্যটি বেছে নিন।','Operator guessed from the number prefix. Tap another one if the number was ported.'):L('আপনার বেছে নেওয়া অপারেটর ব্যবহার হবে।','Your chosen operator will be used.')):''};
   $('#rcP').oninput=e=>{e.target.value=e.target.value.replace(/\D/g,'');if(!manual){const g=opOf(e.target.value);op=g?g.k:''}paint()};
   $('#rcOps').onclick=e=>{const b=e.target.closest('[data-op]');if(!b)return;op=b.dataset.op;manual=true;paint()};
   $('#rcQ').onclick=e=>{const b=e.target.closest('[data-a]');if(b)$('#rcA').value=b.dataset.a};
   $('#rcA').oninput=e=>{e.target.value=e.target.value.replace(/\D/g,'')};
   $('#rcGo').onclick=()=>{const p=$('#rcP').value.trim(),a=parseInt($('#rcA').value)||0;
    if(!/^01\d{9}$/.test(p)){toast(L('১১ সংখ্যার মোবাইল নম্বর দিন','Enter an 11-digit mobile number'));return}
    if(!op){toast(L('অপারেটর বেছে নিন','Choose the operator'));return}
    if(a<RECHARGE.min||a>RECHARGE.max){toast(L('রিচার্জ ৳১০ থেকে ৳১০০০ এর মধ্যে হতে হবে','Recharge must be between ৳10 and ৳1,000'));return}
    const o=OPS.find(x=>x.k===op);runForm('মোবাইল রিচার্জ',p,a,'',{op,name:o.en})}}

  /* Pay Bill: category -> biller (SAMPLE directory, billers.js) -> account / meter number -> optional "check bill" -> pay.
     Types that have no directory (credit card, bank, EMI, vehicle) keep the old free-text form. */
  function billPage(){
   const T=[['ক্রেডিট কার্ড','Credit card','💳'],['ব্যাংক/আর্থিক প্রতিষ্ঠান','Bank / financial institution','🏦'],['EMI পেমেন্ট','EMI payment','📅'],['গাড়ি','Vehicle','🚗']];
   const SV=[...BILLER_CATS.map(c=>[c.bn,c.en,c.i]),...T];
   pgOpen(L('পে বিল','Pay Bill'),`<button class="saved" id="bsv">${L('সংরক্ষিত অ্যাকাউন্ট','Saved accounts')}</button><button class="saved" id="bsb">${L('সংরক্ষিত বিলার','Saved billers')}</button>
    ${DEMO?`<div class="dnote">🧪 ${L('ডেমো: বিলার তালিকা নমুনা, বিল সিমুলেটেড।','Demo: the biller list is a sample and bills are simulated.')}</div>`:''}
    <h4 class="pl">${L('বিলের প্রকার নির্বাচন করুন','Select bill type')}</h4><div class="card">${BILLER_CATS.map(t=>`<div class="row" data-c="${t.k}"><span class="mi">${t.i}</span><div class="g">${L(t.bn,t.en)}<small>${BILLERS.filter(b=>b.c===t.k).length} ${L('বিলার','billers')}</small></div></div>`).join('')}
    ${T.map((t,i)=>`<div class="row" data-i="${i}"><span class="mi">${t[2]}</span><div class="g">${L(t[0],t[1])}</div></div>`).join('')}</div>`);
   const go=(ph,nm,sv)=>{if(sv&&sv.biller&&billerOf(sv.biller)){billerForm(billerOf(sv.biller),sv.account);return}pgClose();moneyForm('পে বিল',-1,'out','');if(nm)$('#f1').placeholder=nm;if(ph)$('#f1').value=ph};
   $$('#pgB .row[data-c]').forEach(r=>r.onclick=()=>billerList(r.dataset.c));
   $$('#pgB .row[data-i]').forEach(r=>r.onclick=()=>{const t=T[r.dataset.i];go('',L(t[0],t[1])+' · '+L('বিলার/অ্যাকাউন্ট নম্বর','biller / account number'))});
   $('#bsb').onclick=()=>billerSheet(SV,go);
   $('#bsv').onclick=()=>{const sv=plan.saved||[];if(!sv.length){toast(L('কোনো সংরক্ষিত অ্যাকাউন্ট নেই','No saved accounts yet'));return}
    open(`<h3>${L('সংরক্ষিত অ্যাকাউন্ট','Saved accounts')}</h3>${sv.map((s,i)=>`<div class="row" data-i="${i}"><div class="g">${esc(s.name||s.phone)}<small>${esc(s.phone)}</small></div></div>`).join('')}`);
    $$('#panel .row').forEach(r=>r.onclick=()=>{close();go(sv[r.dataset.i].phone)})}}
  function billerList(cat){const c=BILLER_CATS.find(x=>x.k===cat);
   pgOpen(L(c.bn,c.en),`<input id="bq" class="sin" placeholder="${L('বিলার খুঁজুন','Search billers')}"><div class="card" id="bl"></div>`);
   const paint=()=>{const q=$('#bq').value.trim().toLowerCase(),L2=BILLERS.filter(b=>b.c===cat&&(!q||(b.en+' '+b.bn).toLowerCase().includes(q)));
    $('#bl').innerHTML=L2.length?L2.map(b=>`<div class="row" data-b="${b.id}"><div class="g">${L(b.bn,b.en)}</div><i class="chev">›</i></div>`).join(''):`<p class="mute" style="padding:12px">${L('পাওয়া যায়নি','Nothing found')}</p>`;
    $$('#bl .row').forEach(r=>r.onclick=()=>billerForm(billerOf(r.dataset.b)))};
   $('#bq').oninput=paint;paint()}
  function billerForm(b,acct){
   pgOpen(L(b.bn,b.en),`<p class="mute">${PB()}</p>${DEMO?`<div class="dnote">🧪 ${L('ডেমো: বিল সিমুলেটেড। ০০০০০০০ দিয়ে শেষ হওয়া অ্যাকাউন্টে ব্যর্থতা দেখানো হয়।','Demo: bills are simulated. An account ending in 0000000 shows a failed payment.')}</div>`:''}
    <h4 class="pl">${L('অ্যাকাউন্ট / মিটার নম্বর','Account / meter number')}</h4><input id="bfA" class="sin" maxlength="20" autocomplete="off" placeholder="${L('৬ থেকে ২০ অক্ষর বা সংখ্যা','6 to 20 letters or digits')}" value="${esc(acct||'')}">
    <button class="btn alt" id="bfC">${L('বিল দেখুন','Check bill')}</button><div id="bfR"></div>
    <h4 class="pl">${L('পরিমাণ','Amount')}</h4><input id="bfM" class="sin" inputmode="numeric" maxlength="7" placeholder="${L('টাকা','Amount')}">
    <label class="chk" style="display:block;margin:10px 0"><input type="checkbox" id="bfS"> ${L('এই বিলার সংরক্ষণ করুন','Save this biller')}</label>
    <button class="btn" id="bfG">${L('বিল পরিশোধ করুন','Pay bill')}</button>`);
   $('#bfM').oninput=e=>{e.target.value=e.target.value.replace(/\D/g,'')};
   $('#bfC').onclick=async()=>{const a=$('#bfA').value.trim();if(!acctOk(a)){toast(L('৬ থেকে ২০ অক্ষর বা সংখ্যার নম্বর দিন','Enter 6 to 20 letters or digits'));return}
    try{const r=API.on?await API.get('/api/billers/'+b.id+'/lookup/'+encodeURIComponent(a)):billLookupLocal(b.id,a);if(!r)throw 0;const due=Math.round(Number(r.due));
     $('#bfR').innerHTML=`<div class="bdue">${esc(r.customer)}<br>${L('বকেয়া','Amount due')}: <b>${money(due)}</b> <small>(${L('নমুনা বিল','sample bill')})</small></div>`;$('#bfM').value=due}
    catch(e){toast(e&&e.code?apiMsg(e):L('বিল পাওয়া যায়নি','Bill not found'))}};
   $('#bfG').onclick=async()=>{const a=$('#bfA').value.trim(),m=parseInt($('#bfM').value)||0;
    if(!acctOk(a)){toast(L('৬ থেকে ২০ অক্ষর বা সংখ্যার নম্বর দিন','Enter 6 to 20 letters or digits'));return}
    if(m<=0){toast(L('সঠিক পরিমাণ দিন','Enter a valid amount'));return}
    if($('#bfS').checked){const bl=prefGet('billers');if(!bl.some(x=>x.biller===b.id&&x.account===a))await prefSet('billers',[...bl,{id:'b'+Date.now().toString(36),type:L(b.bn,b.en),account:a,label:L(b.bn,b.en),biller:b.id}])}
    runForm('পে বিল',a,m,'',{biller:b.id,name:b.en})}}
  $('#signRow').onclick=()=>window.authLogout&&authLogout();

  /* receipt: tap a transaction in History -> picture you can share */
  function receipt(x){const c=document.createElement('canvas');c.width=600;c.height=790;const g=c.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,600,790);g.fillStyle='#ffd600';g.fillRect(0,0,600,150);g.fillStyle='#111';g.font='bold 54px sans-serif';g.fillText('upay 2.0',40,88);g.font='24px sans-serif';g.fillText(L('লেনদেনের রসিদ','Transaction receipt'),40,126);
   g.fillStyle=x.undone?'#d23a3a':'#0f7a5a';g.font='bold 30px sans-serif';g.fillText(x.undone?L('বাতিল','Cancelled'):'✓ '+L('সফল','Successful'),40,215);g.fillStyle='#111';g.font='bold 56px sans-serif';g.fillText(money(Math.abs(x.a)),40,285);
   [[L('ধরন','Type'),tr(x.t)],[x.k==='in'?L('প্রেরক','From'):L('প্রাপক','To'),((x.rn||'')+' '+(x.ph||'')).trim()||'-'],[L('তারিখ','Date'),x.ts?fdf(x.ts):tr(x.d)],[L('চার্জ','Fee'),money(x.fee||0)],[L('ট্রানজেকশন আইডি','Transaction ID'),x.trx||'-'],[L('রেফারেন্স','Reference'),x.ref||'-']].forEach((r,i)=>{const y=350+i*66;g.fillStyle='#777';g.font='22px sans-serif';g.fillText(r[0],40,y);g.fillStyle='#111';g.font='bold 26px sans-serif';g.fillText(String(r[1]).slice(0,34),40,y+32)});
   c.toBlob(b=>{const f=new File([b],'upay-receipt.png',{type:'image/png'}),u=URL.createObjectURL(b);open(`<h3>${L('রসিদ','Receipt')}</h3><img src="${u}" alt="receipt" style="width:100%;border-radius:12px;border:1px solid #ddd"><button class="btn" id="rsh">${L('শেয়ার করুন','Share')}</button><button class="btn alt" id="no">${L('বন্ধ করুন','Close')}</button>`);$('#no').onclick=close;
    $('#rsh').onclick=async()=>{try{if(navigator.canShare&&navigator.canShare({files:[f]}))await navigator.share({files:[f],title:'upay 2.0'});else{const a=document.createElement('a');a.href=u;a.download='upay-receipt.png';document.body.appendChild(a);a.click();a.remove()}}catch(e){}}},'image/png')}
  $('#hlist').addEventListener('click',e=>{const r=e.target.closest('.row');if(!r)return;const x=hisList()[[...$('#hlist').children].indexOf(r)];if(x)receipt(x)});

  /* refer & earn: code = UP + your number; in browser demo mode both get 50 */
  function referSheet(){const code='UP'+(myPh||'').slice(2),link=location.origin+location.pathname+'?ref='+code,bonus=true,
    txt=bonus?L('upay 2.0-তে আমার কোড '+code+' দিয়ে অ্যাকাউন্ট খুলুন, দুজনেই ৳৫০ পাব! ','Open a upay 2.0 account with my code '+code+' and we both get ৳50! '):L('upay 2.0-তে অ্যাকাউন্ট খুলুন, আমার কোড '+code+' ','Open a upay 2.0 account, my code '+code+' ');
   open(`<h3>${L('রেফার করুন','Refer a friend')}</h3>${bonus?`<small>${L('বন্ধু আপনার কোড দিয়ে অ্যাকাউন্ট খুললে দুজনেই ৳৫০ পাবেন।','You and your friend each get ৳50 when they sign up with your code.')}</small>`:''}<div class="rcode">${code}</div><p class="rcode2" id="rstat"></p><button class="btn" id="rsh">${L('শেয়ার করুন','Share')}</button><button class="btn alt" id="rcp">${L('কোড কপি করুন','Copy code')}</button><button class="btn alt" id="no">${L('বন্ধ করুন','Close')}</button>`);
   if(API.on)API.get('/api/referral').then(r=>{const e=$('#rstat');if(e)e.textContent=L('বন্ধু যোগ দিয়েছে: '+bn(r.friends_paid)+'/'+bn(r.max)+' · আয়: ৳'+bn(Math.round(Number(r.earned))),'Friends joined: '+r.friends_paid+' of '+r.max+' · Earned: ৳'+Math.round(Number(r.earned)))}).catch(()=>{});
   $('#no').onclick=close;$('#rcp').onclick=()=>{try{navigator.clipboard.writeText(code);toast(L('কপি হয়েছে ✓','Copied ✓'))}catch(e){toast(code)}};
   $('#rsh').onclick=async()=>{try{if(navigator.share)await navigator.share({title:'upay 2.0',text:txt,url:link});else{await navigator.clipboard.writeText(txt+link);toast(L('লিংক কপি হয়েছে ✓','Link copied ✓'))}}catch(e){}}}
  $('#supRow').insertAdjacentHTML('beforebegin',`<div class="row" id="refRow"><span class="mi">🎁</span><div class="g">${L('রেফার করুন','Refer a friend')}<small>${L('কোড শেয়ার করুন','Share your code')}</small></div><i class="chev">›</i></div>`);$('#refRow').onclick=referSheet;
  forms['রেফার & আর্ন']=referSheet;window.upayTour&&upayTour();
  if(DEMO){const d=document.createElement('div');d.className='demoBar';d.textContent='🧪 DEMO · '+L('নমুনা ডেটা, আসল টাকা নয়','sample data, no real money');$('#app').insertAdjacentElement('afterbegin',d)}
  setTimeout(()=>{if(window.UPAY_BONUS>0){toast(L('🎁 রেফার বোনাস ৳'+bn(window.UPAY_BONUS)+' যোগ হয়েছে','🎁 ৳'+window.UPAY_BONUS+' referral bonus added'));window.UPAY_BONUS=0}},1800);
  forms['সেন্ড মানি']=sendPage;forms['ক্যাশ আউট']=cashPage;forms['পে বিল']=billPage;forms['মোবাইল রিচার্জ']=rechargePage;

  
  // QR
  $('#qrBtn').onclick=()=>{open(`<h3>QR স্ক্যান করুন</h3><div class="scan"><i></i></div><button class="btn" id="sc">স্ক্যান সিমুলেট করুন</button><button class="btn alt" id="no">বন্ধ করুন</button>`);
   $('#no').onclick=close;$('#sc').onclick=()=>{close();setTimeout(()=>forms['মেক পেমেন্ট'](),150)}};
  
  // theme
  function theme(d){document.documentElement.dataset.theme=d?'dark':'light';$('#themeState').textContent=tr(d?'চালু':'বন্ধ')}
  let dark=matchMedia('(prefers-color-scheme: dark)').matches;theme(dark);
  $('#themeRow').onclick=()=>{dark=!dark;theme(dark)};
  let sync=null,uid=null,frozen=false,isAdm=false,admOn=false,admTab='u',allW=[],allT=[],lastNote=0;
  let busyF=false,lastId='',undo=null,ut=0,meW={},myPh='',ready=false;
  const genPh=u=>{let h=7;for(const c of u)h=(h*31+c.charCodeAt(0))>>>0;return'01'+String(h%1e9).padStart(9,'0')};
  const dtl=d=>new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,16);
  const myName=()=>$('#uname').textContent;
  const findW=async p=>{const q=await sync.wallets.get(),d=q.docs.find(x=>(x.data()||{}).phone===p);return d?{id:d.id,...d.data()}:null};
  /* incW: atomic balance change (never read-then-write). Throws {code:'insufficient'|'frozen'|'not_found'}. */
  const incW=async(id,a,min,extra)=>{const r=sync.wallets.doc(id);if(r.inc)return r.inc('balance',a,min,extra);
    const d=(await r.get()).data();if(!d)throw{code:'not_found'};if(a<0&&d.frozen)throw{code:'frozen'};if(min!==undefined&&(d.balance||0)+a<min)throw{code:'insufficient'};
    await r.update({...(extra||{}),balance:(d.balance||0)+a});return (d.balance||0)+a};
  const creditW=async(id,a)=>{await incW(id,a);return (await sync.wallets.doc(id).get()).data()};
  /* Limits (demo values): enforced on every outgoing payment, including auto transfers */
  const LIM={d:50000,m:200000},DAY=864e5;
  const outSince=(from)=>tx.filter(x=>x.ts&&x.ts>=from&&x.a<0&&!x.undone).reduce((s,x)=>s+Math.abs(x.a),0);
  const dayStart=()=>{const d=new Date();d.setHours(0,0,0,0);return d.getTime()},monStart=()=>{const d=new Date();d.setDate(1);d.setHours(0,0,0,0);return d.getTime()};
  const limitErr=amt=>{const d=outSince(dayStart()),m=outSince(monStart());
    if(d+amt>LIM.d)return L('দৈনিক লিমিট '+money(LIM.d)+' পার হয়ে যাবে (আজ খরচ '+money(d)+')','Daily limit '+money(LIM.d)+' would be exceeded (spent today '+money(d)+')');
    if(m+amt>LIM.m)return L('মাসিক লিমিট '+money(LIM.m)+' পার হয়ে যাবে','Monthly limit '+money(LIM.m)+' would be exceeded');return''};
  const addTx=async(u,n,t,a,m)=>{const id='t'+Date.now()+Math.random().toString(36).slice(2,6);await sync.txs.doc(id).set({id,uid:u,name:n,t,a,ts:Date.now(),...m});return id};
  const creditSend=async(id,n,a,tn)=>{const d=await creditW(id,a);return addTx(id,n,'রিসিভ মানি',a,{ph:myPh,rn:myName(),trx:tn,bal:d.balance})};
  function showUndo(){const el=$('#undo');clearInterval(ut);const tick=()=>{if(!undo||Date.now()>undo.until){el.style.display='none';clearInterval(ut);undo=null;return}const s=Math.ceil((undo.until-Date.now())/1000);$('#undoT').textContent=L('ভুল নম্বরে গেলে বাতিল করুন','Wrong number? Cancel')+' · '+bn(Math.floor(s/60))+':'+bn(String(s%60).padStart(2,'0'))};el.style.display='flex';tick();ut=setInterval(tick,1000)}
  async function doUndo(){const u=undo;if(!u||Date.now()>u.until)return;
   if(API.on){try{await API.post('/api/undo/'+u.id);undo=null;$('#undo').style.display='none';clearInterval(ut);await API.kick();toast(L('বাতিল হয়েছে, টাকা ফেরত এসেছে ✓','Cancelled, money returned ✓'))}catch(e){toast(apiMsg(e))}return}
   try{
    /* anti-abuse: at most 3 cancellations per 24 hours (a scammer could otherwise take goods, then cancel) */
    const recent=(meW.undos||[]).filter(t=>Date.now()-t<DAY);
    if(recent.length>=3){toast(L('আজ আর বাতিল করা যাবে না। সমস্যা হলে সাপোর্টে জানান','Cancel limit reached for today. Please contact support'));return}
    if(u.rwId){/* take the money back from the recipient only if it is still there (atomic check) */
     try{await incW(u.rwId,-u.a,0)}catch(e){if(e&&e.code==='insufficient'){toast(L('প্রাপক টাকা খরচ করে ফেলেছেন, বাতিল সম্ভব নয়','Recipient already spent it, cannot cancel'));return}throw e}
     await sync.txs.doc(u.rid).update({undone:1})}
    const pl=JSON.parse(JSON.stringify(plan));if(u.src){const b=pl.buckets.find(x=>x.n===u.src);b?b.amt+=u.a+u.fee:pl.buckets.push({n:u.src,amt:u.a+u.fee})}
    await incW(uid,u.a+u.fee,undefined,{plan:pl,undos:[...recent,Date.now()]});await sync.txs.doc(u.id).update({undone:1});
    undo=null;$('#undo').style.display='none';clearInterval(ut);toast(L('বাতিল হয়েছে, টাকা ফেরত এসেছে ✓','Cancelled, money returned ✓'))}
   catch(e){toast('সমস্যা হয়েছে, আবার চেষ্টা করুন')}}
  function paintSum(){const n=new Date(),ms=tx.filter(x=>x.ts&&!x.undone&&new Date(x.ts).getMonth()===n.getMonth()&&new Date(x.ts).getFullYear()===n.getFullYear()),o=ms.filter(x=>x.a<0),g={};
   o.forEach(x=>{const k=x.src||tr(x.t);g[k]=(g[k]||0)+Math.abs(x.a)});
   const to=o.reduce((s,x)=>s+Math.abs(x.a),0),ti=ms.filter(x=>x.a>0).reduce((s,x)=>s+x.a,0);
   $('#msum').innerHTML=`<h4>${L('এই মাসের সারাংশ','This month')}</h4><div class="row"><div class="g">${L('আয়','In')}</div><span class="pos">${money(ti)}</span></div><div class="row"><div class="g">${L('খরচ','Out')}</div><span class="neg">${money(to)}</span></div>`+(Object.entries(g).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{const p=Math.round(v/to*100);return`<div style="margin:8px 0"><small>${esc(k)} · ${money(v)} (${bn(p)}%)</small><div style="height:8px;border-radius:4px;background:#e4e9f2"><div style="height:8px;border-radius:4px;background:#2b7be0;width:${p}%"></div></div></div>`}).join('')||`<small>${L('এই মাসে কোনো খরচ নেই','No spending this month')}</small>`)}
  async function fireRules(arm){if(API.on||busyF||!sync||!uid||!isStu())return;busyF=true;try{
   const pl=JSON.parse(JSON.stringify(plan)),now=Date.now();let bal=freeBal(),ch=false;
   for(const r of pl.rules){if(r.done)continue;if(arm&&!r.armed){r.armed=1;ch=true}
    if(!r.armed||(r.at&&new Date(r.at).getTime()>now)||r.amt>bal)continue;
    const tn=trx(),rw=await findW(r.phone);if(!(await commit(L('অটো সেন্ড মানি','Auto Send Money'),-r.amt,{amt:r.amt,fee:0,ph:r.phone,rn:rw?rw.name:r.name,trx:tn,auto:1})))continue;if(rw)await creditSend(rw.id,rw.name,r.amt,tn);
    bal-=r.amt;if(r.rep){const b=r.at?new Date(r.at):new Date();b.setMonth(b.getMonth()+1);r.at=dtl(b);r.last=now}else r.done=now;ch=true}
   if(ch)await sync.wallets.doc(uid).update({plan:pl})}finally{busyF=false}}
  function socialInit(){let kids=[],inSp=[],outSp=[],payBusy=false;
 const seenN=()=>meW.gSeen&&meW.gSeen>(meW.gSeenAck||0)?1:0;
 const bell=()=>{const n=inSp.filter(s=>s.status==='open').length+kids.filter(k=>k.gStatus==='pending').length+seenN();$('#bell').textContent='🔔'+(n?' '+bn(n):'')};
 if(API.on){window.setSocial=(g,sp)=>{kids=g.map(r=>({id:r.uid,name:r.name,phone:r.phone,gStatus:r.guardian_status,plan:{buckets:(r.buckets||[]).map(n=>({n}))}}));
   inSp=sp.incoming.map(s=>({id:s.id,from:s.from_uid,fromName:s.from_name,fromPhone:s.from_phone,amt:Number(s.amount),note:s.note,status:s.status,ts:s.ts}));
   outSp=sp.outgoing.map(s=>({id:s.id,toName:s.to_name,amt:Number(s.amount),status:s.status,ts:s.ts}));bell()}}
 else{
 sync.wallets.where('gUid','==',uid).onSnapshot(q=>{kids=q.docs.map(d=>({id:d.id,...d.data()}));bell()});
 sync.splits.where('to','==',uid).onSnapshot(q=>{inSp=q.docs.map(d=>d.data()).sort((a,b)=>b.ts-a.ts);bell()});
 sync.splits.where('from','==',uid).onSnapshot(q=>{outSp=q.docs.map(d=>d.data()).sort((a,b)=>b.ts-a.ts)});}
 $('#undoB').onclick=doUndo;
 const stt=s=>s==='paid'?L('পরিশোধিত ✓','Paid ✓'):s==='declined'?L('বাতিল','Declined'):L('অপেক্ষমাণ','Pending');
 const again=f=>setTimeout(f,200);
 function inbox(){const o=inSp.filter(s=>s.status==='open'),pk=kids.filter(k=>k.gStatus==='pending'),gs=seenN();
  open(`<h3>🔔 ${L('নোটিফিকেশন','Notifications')}</h3>`+(gs?`<div class="row"><div class="g">👁 ${esc(meW.gSeenBy||L('অভিভাবক','Guardian'))} ${L('আপনার স্টেটমেন্ট দেখেছেন','viewed your statement')}<small>${fdf(meW.gSeen)} · ${L('চাইলে অভিভাবক লিংক থেকে ✕ দিয়ে সংযোগ বন্ধ করুন','you can remove the link under Guardian Link')}</small></div><button class="mini" data-gk="1">${L('ঠিক আছে','OK')}</button></div>`:'')+pk.map(k=>`<div class="row"><div class="g">${esc(k.name)}<small>${L('আপনাকে অভিভাবক হিসেবে যুক্ত করতে চায়','wants you as guardian')}</small></div><button class="mini" data-ga="${k.id}">${L('অনুমোদন','Approve')}</button><button class="mini" data-gr="${k.id}">✕</button></div>`).join('')
  +o.map(s=>`<div class="row"><div class="g">${esc(s.fromName)} · ${money(s.amt)}<small>${L('বিল স্প্লিট','Bill split')}${s.note?' · '+esc(s.note):''}</small></div><button class="mini" data-sp="${s.id}">${L('পে করুন','Pay')}</button><button class="mini" data-sd="${s.id}">✕</button></div>`).join('')
  +(!o.length&&!pk.length&&!gs?`<small>${tr('নতুন কোনো নোটিফিকেশন নেই')}</small>`:'')
  +(outSp.length?`<h4>${L('আমার স্প্লিট রিকোয়েস্ট','My split requests')}</h4>`+outSp.slice(0,8).map(s=>`<div class="row"><div class="g">${esc(s.toName)} · ${money(s.amt)}<small>${stt(s.status)}</small></div></div>`).join(''):'')
  +`<button class="btn alt" id="no">${L('বন্ধ করুন','Close')}</button>`);
  $('#no').onclick=close;
  panel.querySelectorAll('[data-gk]').forEach(e=>e.onclick=async()=>{if(API.on){await API.post('/api/guardian/seen-ack');await API.kick();again(inbox);return}await sync.wallets.doc(uid).update({gSeenAck:Date.now()});again(inbox)});
  panel.querySelectorAll('[data-ga]').forEach(e=>e.onclick=async()=>{if(API.on){try{await API.post('/api/guardian/approve/'+encodeURIComponent(e.dataset.ga));await API.kick()}catch(x){toast(apiMsg(x))}again(inbox);return}await sync.wallets.doc(e.dataset.ga).update({gStatus:'ok'});again(inbox)});
  panel.querySelectorAll('[data-gr]').forEach(e=>e.onclick=async()=>{if(API.on){try{await API.del('/api/guardian/'+encodeURIComponent(e.dataset.gr));await API.kick()}catch(x){toast(apiMsg(x))}again(inbox);return}await sync.wallets.doc(e.dataset.gr).update({gUid:'',gStatus:'',gPhone:'',gName:''});again(inbox)});
  panel.querySelectorAll('[data-sd]').forEach(e=>e.onclick=async()=>{if(API.on){try{await API.post('/api/splits/'+encodeURIComponent(e.dataset.sd)+'/decline');await API.kick()}catch(x){toast(apiMsg(x))}again(inbox);return}await sync.splits.doc(e.dataset.sd).update({status:'declined'});again(inbox)});
  panel.querySelectorAll('[data-sp]').forEach(e=>e.onclick=async()=>{const s=inSp.find(x=>x.id===e.dataset.sp);if(!s)return;
   if(API.on){if(payBusy)return;payBusy=true;try{const r=await askPinDo(L('বিল স্প্লিট','Bill split')+' · '+money(s.amt),pin=>API.post('/api/splits/'+encodeURIComponent(s.id)+'/pay',{pin}));if(r){await API.kick();toast(L('পেমেন্ট সফল ✓','Payment successful ✓'));again(inbox)}}finally{payBusy=false}return}
   if(s.amt>freeBal()){toast('ব্যালেন্স পর্যাপ্ত নয়');return}
   if(payBusy)return;payBusy=true;try{
   const cur=(await sync.splits.doc(s.id).get()).data();if(!cur||cur.status!=='open'){again(inbox);return}
   if(!(await askPin(L('বিল স্প্লিট','Bill split')+' · '+money(s.amt))))return;
   const tn=trx();if(!(await commit('বিল স্প্লিট',-s.amt,{amt:s.amt,fee:0,ph:s.fromPhone,rn:s.fromName,trx:tn})))return;
   const d=await creditW(s.from,s.amt);await addTx(s.from,d.name,'বিল স্প্লিট',s.amt,{ph:myPh,rn:myName(),trx:tn,bal:d.balance});await sync.splits.doc(s.id).update({status:'paid'});toast(L('পেমেন্ট সফল ✓','Payment successful ✓'));again(inbox)}finally{payBusy=false}})}
 $('#bell').onclick=inbox;window.bellRef=bell;
 window.splitForm=()=>{open(`<h3>🧮 ${L('বিল স্প্লিট','Bill Split')}</h3><input id="st" inputmode="numeric" placeholder="${L('মোট বিল','Total bill')}"><input id="sn" placeholder="${L('বন্ধুদের নম্বর (কমা দিয়ে)','Friends numbers (comma separated)')}"><input id="so" placeholder="${L('কিসের জন্য (ঐচ্ছিক)','For (optional)')}"><small id="sh"></small><button class="btn" id="ok">${L('রিকোয়েস্ট পাঠান','Send requests')}</button><button class="btn alt" id="no">${L('বাতিল','Cancel')}</button>`);
  const nums=()=>[...new Set($('#sn').value.split(/[\s,]+/).filter(Boolean))];
  const sh=()=>{const t=parseInt($('#st').value)||0,n=nums().length;$('#sh').textContent=n&&t?L('প্রত্যেকের ভাগ: ','Each share: ')+money(Math.floor(t/(n+1)))+L(' (বাকি পয়সা আপনার ভাগে)',' (any remainder stays with you)'):''};
  $('#st').oninput=$('#sn').oninput=sh;$('#no').onclick=close;
  $('#ok').onclick=async()=>{const t=parseInt($('#st').value),ns=nums();if(!t||t<=0||!ns.length){toast('সঠিক পরিমাণ দিন');return}
   if(API.on){try{await API.post('/api/splits',{total:t,phones:ns,note:$('#so').value.trim()});close();await API.kick();toast(L('রিকোয়েস্ট পাঠানো হয়েছে ✓','Requests sent ✓'))}catch(e){toast(apiMsg(e))}return}
   const ws=[];for(const p of ns){const w=await findW(p);if(!w||w.id===uid){toast(L('নম্বর পাওয়া যায়নি: ','Number not found: ')+p);return}ws.push(w)}
   const sh2=Math.floor(t/(ns.length+1)),note=$('#so').value.trim();
   for(const w of ws){const id='s'+Date.now()+Math.random().toString(36).slice(2,6);await sync.splits.doc(id).set({id,from:uid,fromName:myName(),fromPhone:myPh,to:w.id,toName:w.name,amt:sh2,total:t,note,status:'open',ts:Date.now()})}
   close();toast(L('রিকোয়েস্ট পাঠানো হয়েছে ✓','Requests sent ✓'))}};
 function gui(){const ok=kids.filter(k=>k.gStatus==='ok');
  open(`<h3>👨‍👩‍👧 ${L('অভিভাবক লিংক','Guardian Link')}</h3><small>${L('আপনার নম্বর','Your number')}: <b>${esc(myPh)}</b></small><h4>${L('আমার অভিভাবক','My guardian')}</h4>`
  +(isStu()?(meW.gUid?`<div class="row"><div class="g">${esc(meW.gName)}<small>${esc(meW.gPhone)} · ${meW.gStatus==='ok'?L('যুক্ত','Linked'):L('অনুমোদনের অপেক্ষায়','Waiting for approval')}</small></div><button class="mini" id="gu">✕</button></div>`:`<input id="gp" inputmode="numeric" placeholder="${L('অভিভাবকের নম্বর','Guardian number')}"><button class="btn" id="gl">${L('অভিভাবক যুক্ত করুন','Add guardian')}</button>`):`<small>${L('অভিভাবক যুক্ত করতে ভেরিফাইড স্টুডেন্ট অ্যাকাউন্ট লাগবে','A verified student account is needed')}</small>`)
  +`<h4>${L('আমার লিংক করা স্টুডেন্ট','Students linked to me')}</h4>`
  +(ok.map(k=>`<div class="row"><div class="g">${esc(k.name)}<small>${esc(k.phone)}</small></div><button class="mini" data-ks="${k.id}">${L('পাঠান','Send')}</button><button class="mini" data-kv="${k.id}">${L('স্টেটমেন্ট','Statement')}</button></div>`).join('')||`<small>${L('কেউ নেই','None')}</small>`)
  +`<button class="btn alt" id="no">${L('বন্ধ করুন','Close')}</button>`);
  $('#no').onclick=close;
  if($('#gu'))$('#gu').onclick=async()=>{if(API.on){try{await API.del('/api/guardian/'+encodeURIComponent(uid));await API.kick()}catch(x){toast(apiMsg(x))}again(gui);return}await sync.wallets.doc(uid).update({gUid:'',gStatus:'',gPhone:'',gName:''});again(gui)};
  if($('#gl'))$('#gl').onclick=async()=>{if(API.on){try{await API.post('/api/guardian/request',{phone:$('#gp').value.trim()});await API.kick();toast(L('অনুরোধ পাঠানো হয়েছে ✓','Request sent ✓'));again(gui)}catch(x){toast(apiMsg(x))}return}const w=await findW($('#gp').value.trim());if(!w||w.id===uid){toast(L('নম্বর পাওয়া যায়নি','Number not found'));return}
   await sync.wallets.doc(uid).update({gUid:w.id,gPhone:w.phone,gName:w.name,gStatus:'pending'});toast(L('অনুরোধ পাঠানো হয়েছে ✓','Request sent ✓'));again(gui)};
  panel.querySelectorAll('[data-ks]').forEach(e=>e.onclick=()=>sendKid(kids.find(k=>k.id===e.dataset.ks)));
  panel.querySelectorAll('[data-kv]').forEach(e=>e.onclick=()=>kidStmt(kids.find(k=>k.id===e.dataset.kv)))}
 function sendKid(k){const bs=((k.plan||{}).buckets)||[];
  open(`<h3>${L('পাঠান: ','Send to ')}${esc(k.name)}</h3><input id="ka" inputmode="numeric" placeholder="${L('টাকার পরিমাণ','Amount')}"><select id="kb"><option value="">${L('খালি ব্যালেন্সে','Free balance')}</option>${bs.map(b=>`<option value="${esc(b.n)}">${esc(b.n)}</option>`).join('')}</select><button class="btn" id="ok">${L('পাঠান','Send')}</button><button class="btn alt" id="no">${L('বাতিল','Cancel')}</button>`);
  $('#no').onclick=gui;
  $('#ok').onclick=async()=>{const a=parseInt($('#ka').value),bn2=$('#kb').value;if(!a||a<=0){toast('সঠিক পরিমাণ দিন');return}
   if(API.on){const r=await askPinDo(L('অভিভাবক থেকে পাঠান','Send to student')+' · '+money(a),pin=>API.post('/api/guardian/send',{student_uid:k.id,amount:a,bucket:bn2||null,pin}));if(r){close();await API.kick();toast(L('পাঠানো হয়েছে ✓','Sent ✓'))}return}if(a>freeBal()){toast('ব্যালেন্স পর্যাপ্ত নয়');return}
   if(!(await askPin(L('অভিভাবক থেকে পাঠান','Send to student')+' · '+money(a))))return;
   const tn=trx();if(!(await commit('সেন্ড মানি',-a,{amt:a,fee:0,ph:k.phone,rn:k.name,trx:tn})))return;
   const d=(await sync.wallets.doc(k.id).get()).data(),pl={buckets:[],rules:[],saved:[],...(d.plan||{})};
   if(bn2){const b=pl.buckets.find(x=>x.n===bn2);if(b)b.amt+=a}
   const kb=await incW(k.id,a,undefined,{plan:pl});await addTx(k.id,d.name,'রিসিভ মানি',a,{ph:myPh,rn:myName(),trx:tn,src:bn2,bal:kb});
   close();toast(L('পাঠানো হয়েছে ✓','Sent ✓'))}}
 async function kidStmt(k){let r;
  if(API.on){try{r=(await API.get('/api/guardian/statement/'+encodeURIComponent(k.id))).map(mapTx)}catch(e){toast(apiMsg(e));return}}
  else{try{await sync.wallets.doc(k.id).update({gSeen:Date.now(),gSeenBy:myName()})}catch(e){}
  const q=await sync.txs.where('uid','==',k.id).get();r=q.docs.map(d=>d.data()).sort((a,b)=>b.ts-a.ts).slice(0,15)}
  open(`<h3>${esc(k.name)} · ${L('স্টেটমেন্ট','Statement')}</h3>`+(r.map(x=>`<div class="row"><div class="g">${tr(x.t)}${x.rn||x.ph?' · '+esc(x.rn||x.ph):''}<small>${fdf(x.ts)}${x.src?' · '+esc(x.src):''}</small></div><span class="${x.a>0?'pos':'neg'}">${x.a>0?'+':'−'}${money(Math.abs(x.a))}</span></div>`).join('')||`<small>${L('কোনো লেনদেন নেই','No transactions')}</small>`)+`<button class="btn alt" id="no">${L('ফিরে যান','Back')}</button>`);
  $('#no').onclick=gui}
 $('#gRow').onclick=gui}
  function planInit(){
   const cp=()=>JSON.parse(JSON.stringify(plan));
   const save=async p=>{try{await sync.wallets.doc(uid).update({plan:p});return true}catch(e){toast('সমস্যা হয়েছে, আবার চেষ্টা করুন');return false}};
   function ui(){const bs=plan.buckets,rs=plan.rules;
    open(`<h3>🎓 ${L('স্টুডেন্ট প্ল্যান','Student Plan')}</h3><small>${L('খালি ব্যালেন্স','Free balance')}: <b>${money(freeBal())}</b></small>
    <h4>${L('ক্যাটাগরি অনুযায়ী টাকা জমা','Money buckets')}</h4>
    ${bs.map((b,i)=>`<div class="row"><div class="g">${esc(b.n)}<small>${money(b.amt)}</small></div><button class="mini" data-bd="${i}">✕</button></div>`).join('')}
    <input id="bn" placeholder="${L('যেমন: ভার্সিটি, খাওয়া, রিচার্জ','e.g. University, Food, Recharge')}"><input id="ba" inputmode="numeric" placeholder="${L('টাকা','Amount')}"><button class="btn" id="bad">${L('জমা রাখুন','Set aside')}</button>
    <h4>${L('অটো ট্রান্সফার (টাকা আসার পর নিজে থেকে যাবে)','Auto transfer (sends when money arrives)')}</h4>
    ${rs.map((r,i)=>`<div class="row"><div class="g">${esc(r.name||r.phone)} · ${money(r.amt)}<small>${esc(r.phone)} · ${r.at?fdf(new Date(r.at).getTime()):L('যেকোনো সময়','Any time')} ${r.rep?' · 🔁 '+L('প্রতি মাস','Monthly'):''} · ${r.done?L('সম্পন্ন','Done'):L('অপেক্ষমাণ','Waiting')}</small></div><button class="mini" data-rd="${i}">✕</button></div>`).join('')}
    <input id="rn" placeholder="${L('নাম (যেমন: মা)','Name (e.g. Mom)')}"><input id="rp" inputmode="numeric" placeholder="${L('মোবাইল নম্বর','Mobile number')}"><input id="ra" inputmode="numeric" placeholder="${L('টাকার পরিমাণ','Amount')}"><input id="rt" type="datetime-local"><label style="display:block;margin:6px 0"><input type="checkbox" id="rr"> ${L('প্রতি মাসে রিপিট','Repeat monthly')}</label><button class="btn" id="rad">${L('অ্যাকাউন্ট সেভ করুন','Save account')}</button><button class="btn alt" id="no">${L('বন্ধ করুন','Close')}</button>`);
    $('#no').onclick=close;
    panel.querySelectorAll('[data-bd]').forEach(e=>e.onclick=async()=>{if(API.on){try{await API.del('/api/buckets/'+encodeURIComponent(plan.buckets[+e.dataset.bd].n));await API.kick();ui()}catch(x){toast(apiMsg(x))}return}const p=cp();p.buckets.splice(+e.dataset.bd,1);await save(p)&&ui()});
    panel.querySelectorAll('[data-rd]').forEach(e=>e.onclick=async()=>{if(API.on){try{await API.del('/api/rules/'+plan.rules[+e.dataset.rd].id);await API.kick();ui()}catch(x){toast(apiMsg(x))}return}const p=cp();p.rules.splice(+e.dataset.rd,1);await save(p)&&ui()});
    $('#bad').onclick=async()=>{const n=$('#bn').value.trim(),a=parseInt($('#ba').value);
     if(!n||!a||a<=0){toast('সঠিক পরিমাণ দিন');return}
     if(API.on){try{await API.post('/api/buckets',{name:n,amount:a});await API.kick();ui()}catch(x){toast(apiMsg(x))}return}if(a>freeBal()){toast('ব্যালেন্স পর্যাপ্ত নয়');return}
     const p=cp(),b=p.buckets.find(x=>x.n===n);b?b.amt+=a:p.buckets.push({n,amt:a});await save(p)&&ui()};
    $('#rad').onclick=async()=>{const ph=$('#rp').value.trim(),a=parseInt($('#ra').value),n=$('#rn').value.trim();
     if(!/^01\d{9}$/.test(ph)){toast('নম্বর দিন');return}if(!a||a<=0){toast('সঠিক পরিমাণ দিন');return}
     if(API.on){const at=$('#rt').value?new Date($('#rt').value).getTime():0,rp0=$('#rr').checked;
      const r=await askPinDo(L('অটো ট্রান্সফার চালু','Enable auto transfer')+' · '+money(a),pin=>API.post('/api/rules',{phone:ph,amount:a,name:n,run_at:at,repeat:rp0,pin}));if(r){await API.kick();ui()}return}
     if(!(await askPin(L('অটো ট্রান্সফার চালু','Enable auto transfer')+' · '+money(a))))return;
     const p=cp(),nm=n||(p.saved.find(s=>s.phone===ph)||{}).name||'';
     const rp=$('#rr').checked;p.rules.push({phone:ph,name:nm,amt:a,at:$('#rt').value||'',rep:rp,armed:rp?1:0});
     const s=p.saved.find(x=>x.phone===ph);s?s.name=nm||s.name:p.saved.push({phone:ph,name:nm});await save(p)&&ui()}}
   $('#planRow').onclick=ui}
  async function commit(t,a,m={}){
    const say=x=>{if(!m.auto)toast(x)};
    if(frozen){say('আপনার অ্যাকাউন্ট ফ্রিজ করা আছে');return false}
    if(a<0){const le=limitErr(-a);if(le){say(le);return false}}
    if(!sync){balance+=a;tx.unshift({...m,t,d:'এইমাত্র',a,k:a>0?'in':'out'});paintBal();paintHis();return true}
    try{const id='t'+Date.now()+Math.random().toString(36).slice(2,6);
      lastId=id;const {plan:np,...mt}=m;
      /* balance changes atomically on the latest stored value, so two tabs/devices can never overwrite each other */
      const nb=await incW(uid,a,a<0?0:undefined,np?{plan:np}:undefined);
      await sync.txs.doc(id).set({id,uid,name:$('#uname').textContent,t,a,ts:Date.now(),bal:nb,...mt});return true}
    catch(e){say(e&&e.code==='insufficient'?'ব্যালেন্স পর্যাপ্ত নয়':e&&e.code==='frozen'?'আপনার অ্যাকাউন্ট ফ্রিজ করা আছে':'সমস্যা হয়েছে, আবার চেষ্টা করুন');return false}
  }
  
    /* ---------- PIN (demo grade: stored as a salted hash in the wallet; production must verify on the server) ---------- */
    const pinHash=s=>{let x=5381;for(const c of 'upay|'+uid+'|'+s)x=((x<<5)+x+c.charCodeAt(0))>>>0;return x.toString(36)};
    const PLK='upay_pinlock_',lockLeft=()=>{try{return Math.max(0,(+localStorage.getItem(PLK+uid)||0)-Date.now())}catch(e){return 0}};
    let pinFails=0;
    const pinFail=()=>{pinFails++;if(pinFails>=3){pinFails=0;try{localStorage.setItem(PLK+uid,String(Date.now()+6e4))}catch(e){}}};
    const pinInput=(id,ph)=>`<input class="pinp" id="${id}" type="password" inputmode="none" maxlength="4" autocomplete="off" placeholder="${ph}">`;
    /* Resolves true when the PIN is right (or newly set), false when cancelled. */
    function askPin(why){return new Promise(res=>{
      const first=!meW.pinH,ll=lockLeft();
      if(ll){toast(L('অনেকবার ভুল PIN। '+bn(Math.ceil(ll/1000))+' সেকেন্ড পরে চেষ্টা করুন','Too many wrong PINs. Try again in '+Math.ceil(ll/1000)+' s'));res(false);return}
      open(`<h3>🔒 ${first?L('PIN সেট করুন','Set a PIN'):L('আপনার ৪ ডিজিটের পিন প্রদান করুন','Enter your 4-digit PIN')}</h3><small>${esc(why||'')}</small>${pinInput('pn1',L('৪ সংখ্যার PIN','4-digit PIN'))}${first?pinInput('pn2',L('PIN আবার দিন','Repeat PIN')):''}<button class="btn" id="pok">${L('নিশ্চিত করুন','Confirm')}</button><button class="btn alt" id="pno">${L('বাতিল','Cancel')}</button>`);
      $('#pn1').focus();
      $('#pno').onclick=()=>{close();res(false)};
      $('#pok').onclick=async()=>{const v=$('#pn1').value.trim();
        if(!/^\d{4}$/.test(v)){toast(L('৪ সংখ্যার PIN দিন','Enter a 4-digit PIN'));return}
        if(first){if(v!==$('#pn2').value.trim()){toast(L('PIN মেলেনি','PINs do not match'));return}
          try{await sync.wallets.doc(uid).update({pinH:pinHash(v)});meW={...meW,pinH:pinHash(v)};res(true)}catch(e){toast('সমস্যা হয়েছে, আবার চেষ্টা করুন')}return}
        if(pinHash(v)!==meW.pinH){pinFail();toast(L('PIN ভুল','Wrong PIN'));if(lockLeft()){close();res(false)}return}
        pinFails=0;res(true)}})}
    /* backend mode: ask for the PIN, then let the server check it (and count wrong tries). The sheet stays open on a wrong PIN. */
    function askPinDo(why,fn){return new Promise(res=>{const first=!meW.pinH;
      open(`<h3>🔒 ${first?L('PIN সেট করুন','Set a PIN'):L('আপনার ৪ ডিজিটের পিন প্রদান করুন','Enter your 4-digit PIN')}</h3><small>${esc(why||'')}</small>${pinInput('pn1',L('৪ সংখ্যার PIN','4-digit PIN'))}${first?pinInput('pn2',L('PIN আবার দিন','Repeat PIN')):''}<button class="btn" id="pok">${L('নিশ্চিত করুন','Confirm')}</button><button class="btn alt" id="pno">${L('বাতিল','Cancel')}</button>`);
      $('#pn1').focus();$('#pno').onclick=()=>{close();res(null)};
      $('#pok').onclick=async()=>{const v=$('#pn1').value.trim();if(!/^\d{4}$/.test(v)){toast(L('৪ সংখ্যার PIN দিন','Enter a 4-digit PIN'));return}
        if(first){if(v!==$('#pn2').value.trim()){toast(L('PIN মেলেনি','PINs do not match'));return}
          try{await API.post('/api/pin',{new_pin:v});meW={...meW,pinH:'1'}}catch(e){toast(apiMsg(e));return}}
        try{res(await fn(v))}catch(e){toast(apiMsg(e));if(e.code==='pin_wrong'){$('#pn1').value='';return}close();res(null)}}})}
    function apiPinChange(){const first=!meW.pinH;
      open(`<h3>🔒 ${L('পিন পরিবর্তন','Change PIN')}</h3>${first?'':pinInput('po',L('বর্তমান PIN','Current PIN'))}${pinInput('pa',L('নতুন PIN (৪ সংখ্যা)','New PIN (4 digits)'))}${pinInput('pb',L('নতুন PIN আবার','Repeat new PIN'))}<button class="btn" id="pok">${L('সেভ করুন','Save')}</button><button class="btn alt" id="pno">${L('বাতিল','Cancel')}</button>`);
      $('#pno').onclick=close;
      $('#pok').onclick=async()=>{const a=$('#pa').value.trim(),b=$('#pb').value.trim();
        if(!/^\d{4}$/.test(a)){toast(L('৪ সংখ্যার PIN দিন','Enter a 4-digit PIN'));return}if(a!==b){toast(L('PIN মেলেনি','PINs do not match'));return}
        try{await API.post('/api/pin',{new_pin:a,old_pin:first?null:$('#po').value.trim()});meW={...meW,pinH:'1'};close();toast(L('PIN পরিবর্তন হয়েছে ✓','PIN changed ✓'))}catch(e){toast(apiMsg(e))}}}
    function pinChange(){if(API.on)return apiPinChange();
      const first=!meW.pinH,ll=lockLeft();if(ll){toast(L('কিছুক্ষণ পরে চেষ্টা করুন','Try again in a moment'));return}
      open(`<h3>🔒 ${L('পিন পরিবর্তন','Change PIN')}</h3>${first?'':pinInput('po',L('বর্তমান PIN','Current PIN'))}${pinInput('pa',L('নতুন PIN (৪ সংখ্যা)','New PIN (4 digits)'))}${pinInput('pb',L('নতুন PIN আবার','Repeat new PIN'))}<button class="btn" id="pok">${L('সেভ করুন','Save')}</button><button class="btn alt" id="pno">${L('বাতিল','Cancel')}</button>`);
      $('#pno').onclick=close;
      $('#pok').onclick=async()=>{const a=$('#pa').value.trim(),b=$('#pb').value.trim();
        if(!first&&pinHash($('#po').value.trim())!==meW.pinH){pinFail();toast(L('বর্তমান PIN ভুল','Current PIN is wrong'));return}
        if(!/^\d{4}$/.test(a)){toast(L('৪ সংখ্যার PIN দিন','Enter a 4-digit PIN'));return}
        if(a!==b){toast(L('PIN মেলেনি','PINs do not match'));return}
        try{await sync.wallets.doc(uid).update({pinH:pinHash(a)});meW={...meW,pinH:pinHash(a)};close();toast(L('PIN পরিবর্তন হয়েছে ✓','PIN changed ✓'))}catch(e){toast('সমস্যা হয়েছে, আবার চেষ্টা করুন')}}}
    $('#pinRow').onclick=pinChange;
    $('#secRow').onclick=()=>toast(meW.pinH?L('সিকিউরিটি: PIN সক্রিয়','Security: PIN is active'):L('PIN এখনো সেট করা হয়নি। প্রথম লেনদেনে সেট করতে বলা হবে','PIN not set yet. You will be asked at your first payment'));
    /* Limits screen: shows what is used today and this month */
    $('#limRow').onclick=()=>{const d=outSince(dayStart()),m=outSince(monStart()),bar=(v,mx)=>`<div style="height:8px;border-radius:4px;background:#e4e9f2;margin:4px 0 12px"><div style="height:8px;border-radius:4px;background:${v/mx>.8?'#d23a3a':'#2b7be0'};width:${Math.min(100,Math.round(v/mx*100))}%"></div></div>`;
      open(`<h3>📈 ${L('লেনদেন সীমা','Transaction Limit')}</h3><small>${L('আজ','Today')}: ${money(d)} / ${money(LIM.d)}</small>${bar(d,LIM.d)}<small>${L('এই মাস','This month')}: ${money(m)} / ${money(LIM.m)}</small>${bar(m,LIM.m)}<button class="btn alt" id="no">${L('বন্ধ করুন','Close')}</button>`);$('#no').onclick=close};

    /* ---------- Customer live chat (AI assistant answers safe questions, rest go to an agent) ---------- */
    let dots={chat:0,req:0};
    const paintDot=()=>{$('#chDot').style.display=dots.chat||dots.req?'block':'none'};
    function chatInit(){
      let chat=null,FQ=[];const box=$('#chMsgs');
      sync.faqs.onSnapshot(d=>{const x=d.data();FQ=(x&&x.list)||[]});
      sync.chats.doc(uid).onSnapshot(d=>{chat=d.data()||null;paint()});
      function paint(){
        const ms=(chat&&chat.msgs)||[];
        box.innerHTML=(ms.length?'':'<div class="m sy">'+tr('কিছু জানতে চান? এখানে লিখুন। সাধারণ প্রশ্নের উত্তর সাথে সাথে পাবেন, বাকিগুলো আমাদের টিম দেখবে।')+'</div>')
          +ms.map(m=>m.f==='sys'?`<div class="m sy">${esc(tr(m.t))}</div>`:`<div class="m ${m.f==='cu'?'me':'ot'}">${esc(m.t)}${m.f==='cu'?'':`<small>${tr(m.f==='ai'?'সহকারী':'এজেন্ট')}</small>`}</div>`).join('');
        box.scrollTop=box.scrollHeight;
        const open=$('#chat').classList.contains('on'),u=(chat&&chat.unreadCust)||0;
        dots.chat=u&&!open?1:0;paintDot();
        if(open&&u)sync.chats.doc(uid).update({unreadCust:0});
      }
      window.openChat=()=>{$('#chat').classList.add('on');paint();$('#chIn').focus()};
      $('#chBack').onclick=()=>$('#chat').classList.remove('on');
      const send=async()=>{
        const inp=$('#chIn'),text=inp.value.trim();if(!text)return;inp.value='';
        const a=analyze(text,FQ),now=Date.now(),old=chat||{msgs:[],audit:[]};
        const msgs=[...old.msgs,{f:'cu',t:a.shown,ts:now}];
        const audit=[...(old.audit||[]),'Received '+ts(),'Redacted and analyzed','Matched policy: '+a.policy,'Decision: '+a.dec.replace('_',' ')];
        const gemOn=!!old.gem&&a.dec!=='escalated'; /* agent switched Gemini on: the server answers, so no canned reply and no "sent to team" note */
        if(gemOn){audit.push('Waiting for Gemini reply')}
        else if(a.dec==='auto_sent'){msgs.push({f:'ai',t:a.reply,ts:now+1});audit.push('Reply sent automatically')}
        else msgs.push({f:'sys',t:'আপনার বার্তা আমাদের টিমের কাছে পাঠানো হয়েছে। শীঘ্রই উত্তর পাবেন।',ts:now+1});
        await sync.chats.doc(uid).set({uid,name:$('#uname').textContent,status:gemOn?'gem':a.dec,...(old.gem?{gem:true,gemAt:old.gemAt||0}:{}),last:now+1,unreadAdmin:(old.unreadAdmin||0)+1,unreadCust:0,a,draft:a.reply,msgs,audit});
      };
      $('#chSend').onclick=send;$('#chIn').onkeydown=e=>{if(e.key==='Enter')send()};
    }
  
    /* ---------- Customer Service hub: live chat, email, complaint (photo / voice) ---------- */
    function csInit(){
      let view='menu',EM=[],CP=[],photo=null,voice=null,rec=null,recT=null,recSec=0;
      const body=$('#csBody'),TT={menu:'কাস্টমার সার্ভিস',email:'ইমেইল করুন',comp:'অভিযোগ জানান',mine:'আমার অনুরোধ'};
      const CATS=['ট্রানজেকশন সমস্যা','ভুল নম্বরে টাকা পাঠানো','প্রতারণা / স্ক্যাম','অ্যাকাউন্ট লক বা পিন সমস্যা','অ্যাপ বা সার্ভিস সমস্যা','অন্যান্য'];
      const SS={new:['নতুন','n'],open:['প্রক্রিয়াধীন','o'],resolved:['সমাধান হয়েছে','r']};
      const mine=()=>[...EM.map(x=>({...x,k:'e'})),...CP.map(x=>({...x,k:'c'}))].sort((a,b)=>b.ts-a.ts);
      const isOpen=()=>$('#cs').classList.contains('on');
      const newId=p=>p+Date.now()+Math.random().toString(36).slice(2,6);
      let busy=false;
      function markRead(){if(busy)return;busy=true;try{EM.filter(x=>x.unreadCust).forEach(x=>sync.emails.doc(x.id).update({unreadCust:0}));CP.filter(x=>x.unreadCust).forEach(x=>sync.complaints.doc(x.id).update({unreadCust:0}))}finally{busy=false}}
      function upd(){dots.req=[...EM,...CP].some(x=>x.unreadCust)&&!(isOpen()&&view==='mine')?1:0;paintDot();if(isOpen()&&view==='mine')markRead();if(isOpen()&&(view==='menu'||view==='mine'))paint()}
      sync.emails.where('uid','==',uid).onSnapshot(q=>{EM=q.docs.map(d=>({id:d.id,...d.data()}));upd()});
      sync.complaints.where('uid','==',uid).onSnapshot(q=>{CP=q.docs.map(d=>({id:d.id,...d.data()}));upd()});
      function go(v){if(rec)rec.stop();view=v;if(v==='mine')markRead();paint();upd()}
      window.openCS=()=>{view='menu';$('#cs').classList.add('on');paint();upd()};
      $('#csBack').onclick=()=>{if(view==='menu'){if(rec)rec.stop();$('#cs').classList.remove('on')}else go('menu')};
  
      function paint(){
        $('#csTitle').textContent=tr(TT[view]);const q=mine().length;
        if(view==='menu')body.innerHTML=`<div class="opt" data-go="chat"><span>💬</span><div><b>লাইভ চ্যাট</b><small>এখনই আমাদের সাথে কথা বলুন</small></div></div>
          <div class="opt" data-go="email"><span>✉️</span><div><b>ইমেইল করুন</b><small>চ্যাট না করে ইমেইলে জানান</small></div></div>
          <div class="opt" data-go="comp"><span>📝</span><div><b>অভিযোগ জানান</b><small>ছবি বা ভয়েসসহ সমস্যা জমা দিন</small></div></div>
          <div class="opt" data-go="mine"><span>📂</span><div><b>আমার অনুরোধ</b><small>${q?L(bn(q)+'টি জমা দেওয়া আছে',q+' submitted'):'ইমেইল ও অভিযোগের অবস্থা দেখুন'}</small></div>${dots.req?'<i class="rdot"></i>':''}</div>
          <p class="hint">জরুরি অবস্থায় (প্রতারণা, ভুল লেনদেন) অভিযোগ বা লাইভ চ্যাট ব্যবহার করুন। পিন বা ওটিপি কাউকে দেবেন না।</p>`;
        if(view==='email')body.innerHTML=`<label for="eEm">আপনার ইমেইল (উত্তর পেতে, ঐচ্ছিক)</label><input id="eEm" type="email" placeholder="name@example.com">
          <label for="eSu">বিষয়</label><input id="eSu" maxlength="120"><label for="eBd">বিস্তারিত</label><textarea id="eBd" rows="7"></textarea>
          <button class="btn" id="eGo">ইমেইল পাঠান</button><p class="hint">আপনার উত্তর এই অ্যাপের "আমার অনুরোধ"-এ দেখতে পাবেন।</p>`;
        if(view==='comp')body.innerHTML=`<label for="cCt">অভিযোগের ধরন</label><select id="cCt">${CATS.map(c=>`<option value="${c}">${c}</option>`).join('')}</select>
          <label for="cTx">ট্রানজেকশন আইডি (থাকলে)</label><input id="cTx" maxlength="20">
          <label for="cDs">সমস্যাটি বলুন</label><textarea id="cDs" rows="5" placeholder="কী হয়েছে, কখন হয়েছে…"></textarea>
          <div class="att"><button class="mini" id="cPh" type="button">📷 ছবি যোগ করুন</button> <button class="mini" id="cVo" type="button">🎤 ভয়েস রেকর্ড</button><input type="file" id="cPf" accept="image/*" hidden></div>
          <div id="cPv"></div><button class="btn" id="cGo">অভিযোগ জমা দিন</button><p class="hint">ছবি বা ভয়েস ঐচ্ছিক। ভয়েস সর্বোচ্চ ৪৫ সেকেন্ড।</p>`;
        if(view==='mine')body.innerHTML=q?mine().map(x=>`<div class="rq"><div><span class="tg ${SS[x.status][1]}">${SS[x.status][0]}</span> <span class="tg">${x.k==='e'?'ইমেইল':'অভিযোগ'}</span></div><b>${esc(x.k==='e'?x.subject:x.cat)}</b><small>${fd(x.ts)} · ${L('রেফারেন্স','Reference')} ${x.k==='e'?'E':'C'}-${esc(x.id.slice(-5).toUpperCase())}</small><p>${esc((x.body||'').slice(0,140))} ${x.photo?'📷':''} ${x.voice?'🎤':''}</p>${(x.replies||[]).map(r=>`<div class="rp"><small>${L('সাপোর্ট','Support')} · ${fd(r.ts)}</small>${esc(r.t)}</div>`).join('')}</div>`).join(''):'<p class="hint">এখনো কিছু জমা দেননি।</p>';
        if(view==='comp')pv();tx8(body);
      }
      function pv(){const el=$('#cPv');if(!el)return;
        el.innerHTML=(photo?`<div class="pvb"><img src="${photo}" alt="সংযুক্ত ছবি"><button class="mini" data-x="ph" type="button">মুছুন</button></div>`:'')
         +(rec?`<div class="pvb"><i class="recd"></i> ${L('রেকর্ড হচ্ছে… '+bn(recSec)+' সে.','Recording… '+recSec+' s')} <button class="mini" data-x="stop" type="button">থামুন</button></div>`:'')
         +(voice&&!rec?`<div class="pvb"><audio controls src="${voice}"></audio><button class="mini" data-x="vo" type="button">মুছুন</button></div>`:'');
        tx8(el);const b=$('#cVo');if(b)b.textContent=tr(rec?'⏹ থামুন':'🎤 ভয়েস রেকর্ড')}
      const shrink=(f,mx=900)=>new Promise((ok,no)=>{const r=new FileReader();r.onerror=no;r.onload=()=>{const im=new Image();im.onerror=no;im.onload=()=>{const k=Math.min(1,mx/Math.max(im.width,im.height)),c=document.createElement('canvas');c.width=Math.round(im.width*k);c.height=Math.round(im.height*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);ok(c.toDataURL('image/jpeg',.65))};im.src=r.result};r.readAsDataURL(f)});
      async function recToggle(){
        if(rec){rec.stop();return}
        if(!navigator.mediaDevices||!window.MediaRecorder){toast('এই ব্রাউজারে ভয়েস রেকর্ড চলবে না');return}
        try{const s=await navigator.mediaDevices.getUserMedia({audio:true}),ch=[];rec=new MediaRecorder(s);
          rec.ondataavailable=e=>{if(e.data.size)ch.push(e.data)};
          rec.onstop=()=>{clearInterval(recT);s.getTracks().forEach(t=>t.stop());const blob=new Blob(ch,{type:(rec&&rec.mimeType)||'audio/webm'});rec=null;
            const r=new FileReader();r.onload=()=>{if(r.result.length>900000){toast('রেকর্ডিং বড় হয়ে গেছে, ছোট করে আবার দিন');voice=null}else voice=r.result;pv()};r.readAsDataURL(blob);pv()};
          rec.start();recSec=0;recT=setInterval(()=>{recSec++;pv();if(recSec>=45&&rec)rec.stop()},1000);pv();
        }catch(e){rec=null;toast('মাইক্রোফোনের অনুমতি পাওয়া যায়নি')}}
      async function submitEmail(){
        const em=$('#eEm').value.trim(),su=$('#eSu').value.trim(),bd=$('#eBd').value.trim();
        if(!su||!bd){toast('বিষয় ও বিস্তারিত লিখুন');return}
        if(em&&!/^\S+@\S+\.\S+$/.test(em)){toast('ইমেইল ঠিকানা ঠিক নয়');return}
        const id=newId('e');
        try{await sync.emails.doc(id).set({id,uid,name:$('#uname').textContent,ts:Date.now(),status:'new',email:em,subject:analyze(su).shown,body:analyze(bd).shown,replies:[],unreadCust:0});toast('ইমেইল পাঠানো হয়েছে ✓');go('mine')}
        catch(e){toast('পাঠানো যায়নি, আবার চেষ্টা করুন')}}
      async function submitComp(){
        if(rec){toast('আগে রেকর্ডিং থামান');return}
        const d=$('#cDs').value.trim(),cat=$('#cCt').value;
        if(!d&&!photo&&!voice){toast('সমস্যা লিখুন, অথবা ছবি/ভয়েস দিন');return}
        const a=analyze(d||cat),scam=cat===CATS[2]||a.intent==='scam',known=a.intent!=='unknown';
        const id=newId('c');
        try{await sync.complaints.doc(id).set({id,uid,name:$('#uname').textContent,ts:Date.now(),status:'new',cat,txn:$('#cTx').value.trim(),body:a.shown,pri:scam?'urgent':known?a.pri:'normal',team:scam?'Fraud Team':known?a.team:'Support Agents',photo:photo||'',voice:voice||'',replies:[],unreadCust:0});
          photo=voice=null;toast(L('অভিযোগ জমা হয়েছে। রেফারেন্স C-','Complaint submitted. Reference C-')+id.slice(-5).toUpperCase());go('mine')}
        catch(e){toast('ফাইল বড় হওয়ায় জমা হয়নি। ছোট ছবি/ভয়েস দিন')}}
      body.addEventListener('click',async e=>{
        const g=e.target.closest('[data-go]');if(g){g.dataset.go==='chat'?window.openChat():go(g.dataset.go);return}
        const x=e.target.closest('[data-x]');if(x){const k=x.dataset.x;if(k==='ph')photo=null;if(k==='vo')voice=null;if(k==='stop'&&rec)rec.stop();pv();return}
        const b=e.target.closest('button');if(!b)return;
        if(b.id==='eGo')submitEmail();if(b.id==='cGo')submitComp();if(b.id==='cVo')recToggle();if(b.id==='cPh')$('#cPf').click()});
      body.addEventListener('change',async e=>{if(e.target.id!=='cPf'||!e.target.files[0])return;
        try{photo=await shrink(e.target.files[0]);pv()}catch(_){toast('ছবিটি পড়া যায়নি')}e.target.value=''});
    }
  

  /* ---------- saved billers: the customer's own bill accounts (type + account number + a name). No biller directory is built in. ---------- */
  function billerSheet(T,go){const bl=prefGet('billers'),tn=t=>L(t[0],t[1]);
    open(`<h3>${L('সংরক্ষিত বিলার','Saved billers')}</h3>${bl.length?bl.map(b=>`<div class="row" data-p="${esc(b.id)}"><div class="g">${esc(b.label||b.account)}<small>${esc(b.type)} · ${esc(b.account)}</small></div><button class="mini" data-x="${esc(b.id)}">${L('মুছুন','Remove')}</button></div>`).join(''):`<p class="mute">${L('এখনো কিছু সংরক্ষণ করা হয়নি','Nothing saved yet')}</p>`}<h4 class="pl">${L('নতুন সংরক্ষণ','Save a new one')}</h4><select id="bvT">${T.map((t,i)=>`<option value="${i}">${tn(t)}</option>`).join('')}</select><input id="bvA" class="sin" placeholder="${L('অ্যাকাউন্ট / মিটার নম্বর','Account / meter number')}" maxlength="40"><input id="bvL" class="sin" placeholder="${L('নাম (যেমন: বাসার বিদ্যুৎ)','Name (e.g. Home electricity)')}" maxlength="60"><button class="btn" id="bvS">${L('সংরক্ষণ করুন','Save')}</button><button class="btn alt" id="no">${L('বন্ধ করুন','Close')}</button>`);
    $('#no').onclick=close;
    $('#bvS').onclick=async()=>{const a=$('#bvA').value.trim(),t=T[$('#bvT').value];if(a.length<3){toast(L('অ্যাকাউন্ট নম্বর দিন','Enter the account number'));return}
      const n=[...bl,{id:'b'+Date.now().toString(36),type:L(t[0],t[1]),account:a,label:$('#bvL').value.trim()}];if(await prefSet('billers',n)){toast(L('সংরক্ষিত হয়েছে ✓','Saved ✓'));billerSheet(T,go)}};
    $$('#panel .row[data-p]').forEach(r=>r.onclick=e=>{const b=bl.find(x=>x.id===r.dataset.p);if(!b)return;
      if(e.target.dataset.x){prefSet('billers',bl.filter(x=>x.id!==b.id));billerSheet(T,go);return}
      close();go(b.account,(b.label||b.type)+' · '+b.account,b)})}
  /* ---------- monthly reminders: shown on Home from 2 days before the day until the customer taps Done. Only visible while the app is open (no push). ---------- */
  const remList=()=>prefGet('reminders');
  function remPaint(){const box=$('#remBox');if(!box||!uid)return;const lbl={late:L('সময় পার হয়েছে','Overdue'),today:L('আজ','Today'),soon:L('শিগগিরই','Soon')};
    box.innerHTML=remList().filter(r=>remDue(r)!=='done'&&remDue(r)!=='ok').map(r=>{const s=remDue(r);return`<div class="remc ${s}"><div class="g"><b>⏰ ${esc(r.label)}</b><small>${lbl[s]} · ${L(bn(r.day)+' তারিখ','day '+r.day)}${r.amount?' · '+money(r.amount):''}</small></div><button class="mini" data-pay="${esc(r.id)}">${L('পরিশোধ','Pay')}</button><button class="mini" data-done="${esc(r.id)}">${L('হয়ে গেছে','Done')}</button></div>`}).join('')}
  $('#note').insertAdjacentHTML('afterend','<div id="remBox"></div>');
  $('#remBox').onclick=e=>{const id=e.target.dataset.pay||e.target.dataset.done;if(!id)return;const rs=remList(),r=rs.find(x=>x.id===id);if(!r)return;
    if(e.target.dataset.done){r.done=remYM(new Date());prefSet('reminders',rs);remPaint();return}
    if(r.account){moneyForm('পে বিল',-1,'out','');$('#f1').value=r.account;if(r.amount)$('#f2').value=r.amount}else billPage()};
  setInterval(remPaint,60*60*1000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)remPaint()});
  function remSheet(){const rs=remList(),bl=prefGet('billers');
    open(`<h3>⏰ ${L('মাসিক রিমাইন্ডার','Monthly reminders')}</h3><small>${L('তারিখের ২ দিন আগে থেকে হোমে দেখাবে। অ্যাপ খুললে দেখা যায়, আলাদা নোটিফিকেশন আসে না।','Shown on Home from 2 days before the date. You see it when you open the app; there is no push notification.')}</small>${rs.map(r=>`<div class="row"><div class="g">${esc(r.label)}<small>${L(bn(r.day)+' তারিখ','day '+r.day)}${r.amount?' · '+money(r.amount):''}${r.account?' · '+esc(r.account):''}</small></div><button class="mini" data-x="${esc(r.id)}">${L('মুছুন','Remove')}</button></div>`).join('')}<h4 class="pl">${L('নতুন রিমাইন্ডার','New reminder')}</h4><input id="rmL" class="sin" placeholder="${L('কী জন্য (যেমন: বিদ্যুৎ বিল)','What for (e.g. Electricity bill)')}" maxlength="60"><input id="rmD" class="sin" inputmode="numeric" placeholder="${L('মাসের কত তারিখ (১-২৮)','Day of the month (1-28)')}" maxlength="2"><input id="rmA" class="sin" inputmode="numeric" placeholder="${L('টাকা (ঐচ্ছিক)','Amount (optional)')}"><select id="rmB"><option value="">${L('সংরক্ষিত বিলার (ঐচ্ছিক)','Saved biller (optional)')}</option>${bl.map((b,i)=>`<option value="${i}">${esc(b.label||b.account)}</option>`).join('')}</select><button class="btn" id="rmS">${L('যোগ করুন','Add')}</button><button class="btn alt" id="no">${L('বন্ধ করুন','Close')}</button>`);
    $('#no').onclick=close;
    $$('#panel .row [data-x]').forEach(b=>b.onclick=()=>{prefSet('reminders',rs.filter(x=>x.id!==b.dataset.x));remPaint();remSheet()});
    $('#rmS').onclick=async()=>{const label=$('#rmL').value.trim(),day=parseInt($('#rmD').value),amount=parseInt($('#rmA').value)||0,bi=$('#rmB').value,b=bi!==''?bl[bi]:null;
      if(!label){toast(L('কী জন্য লিখুন','Enter what it is for'));return}if(!(day>=1&&day<=28)){toast(L('তারিখ ১ থেকে ২৮-এর মধ্যে দিন','Day must be 1 to 28'));return}
      /* if this month's day has already passed, start from next month instead of showing it as overdue today */
      const r={id:'r'+Date.now().toString(36),label,day,amount,type:b?b.type:'',account:b?b.account:'',done:day<new Date().getDate()?remYM(new Date()):''};
      if(await prefSet('reminders',[...rs,r])){remPaint();toast(L('রিমাইন্ডার যোগ হয়েছে ✓','Reminder added ✓'));remSheet()}}}
  /* ---------- lost phone: the customer freezes their own wallet with the PIN (also works from another phone after login). Only an admin can unfreeze. ---------- */
  function freezeSheet(){
    if(frozen){open(`<h3>🚨 ${L('অ্যাকাউন্ট ফ্রিজ করা আছে','Your account is frozen')}</h3><p>${L('আবার চালু করতে সাপোর্টে জানান। আমরা আপনার পরিচয় যাচাই করে চালু করব।','Contact support to unfreeze it. We will check your identity first.')}</p><button class="btn" id="fzS">${L('সাপোর্টে যোগাযোগ','Contact support')}</button><button class="btn alt" id="no">${L('বন্ধ করুন','Close')}</button>`);
      $('#no').onclick=close;$('#fzS').onclick=()=>{close();window.openCS&&window.openCS()};return}
    open(`<h3>🚨 ${L('ফোন হারিয়েছে? ফ্রিজ করুন','Lost your phone? Freeze')}</h3><p>${L('ফ্রিজ করলে এই ওয়ালেট থেকে টাকা পাঠানো, বিল দেওয়া বা ক্যাশ আউট করা যাবে না। আবার চালু করতে সাপোর্টে পরিচয় যাচাই করতে হবে।','While frozen, nothing can be sent, paid or cashed out from this wallet. To unfreeze, support must verify your identity.')}</p><small>${L('অন্য ফোনে নম্বর ও PIN দিয়ে লগইন করেও এটা করা যায়।','You can also do this from another phone by logging in with your number and PIN.')}</small><button class="btn" id="fzOk" style="background:#d23a3a;color:#fff">${L('এখনই ফ্রিজ করুন','Freeze now')}</button><button class="btn alt" id="no">${L('বাতিল','Cancel')}</button>`);
    $('#no').onclick=close;
    $('#fzOk').onclick=async()=>{const why=L('অ্যাকাউন্ট ফ্রিজ','Freeze account');
      if(API.on){const r=await askPinDo(why,pin=>API.post('/api/freeze',{pin}));if(!r)return;close();await API.kick();toast(L('অ্যাকাউন্ট ফ্রিজ করা হয়েছে','Account frozen'));return}
      if(!(await askPin(why)))return;
      try{await sync.wallets.doc(uid).update({frozen:true,frozenBy:'self'});close()}catch(e){toast(L('সমস্যা হয়েছে, আবার চেষ্টা করুন','Something went wrong. Please try again'))}}}
  $('#supRow').insertAdjacentHTML('afterend',`<div class="row" id="remRow"><span class="mi">⏰</span><div class="g">${L('মাসিক রিমাইন্ডার','Monthly reminders')}<small>${L('বিলের তারিখ মনে করিয়ে দেবে','Remind me before a bill is due')}</small></div><i class="chev">›</i></div><div class="row" id="frzRow"><span class="mi">🚨</span><div class="g">${L('ফোন হারিয়েছে? ফ্রিজ করুন','Lost your phone? Freeze')}<small>${L('PIN দিয়ে টাকা পাঠানো বন্ধ করুন','Stop all payments with your PIN')}</small></div><i class="chev">›</i></div>`);
  $('#remRow').onclick=remSheet;$('#frzRow').onclick=freezeSheet;

  /* ---------- Demo tools: switch between test users and verify as student (demo only, remove for production) ---------- */
  function demoInit(){
    if(!DEMO){const r=$('#demoRow');if(r)r.remove();return}
    const US=[['rahim','Rahim (student)'],['karim','Karim (friend)'],['abbu','Abbu (guardian)'],['nusrat','Nusrat (friend)']];
    $('#demoRow').onclick=()=>{
      open(`<h3>🧪 ${L('ডেমো টুলস','Demo tools')}</h3><small>${L('শুধু পরীক্ষার জন্য। আলাদা ট্যাবে খুলুন, একই ব্রাউজারের সব ট্যাব একই ডেটা দেখে।','For testing only. Open in a separate tab; all tabs of this browser share the data.')}</small>`
       +US.map(([u,n])=>`<a class="row" href="?u=${u}&n=${encodeURIComponent(n.split(' ')[0])}" target="_blank" rel="noopener"><span>👤</span><div class="g">${esc(n)}<small>?u=${u}</small></div>›</a>`).join('')
       +`<button class="btn" id="dvs">${L('আমাকে ভেরিফাইড স্টুডেন্ট বানান (ডেমো)','Make me a verified student (demo)')}</button><button class="btn alt" id="dpr">${L('আমার PIN মুছুন (ডেমো)','Reset my PIN (demo)')}</button><button class="btn alt" id="no">${L('বন্ধ করুন','Close')}</button>`);
      $('#no').onclick=close;
      $('#dvs').onclick=async()=>{if(API.on){await API.post('/api/demo/make-student');await API.kick()}else await sync.wallets.doc(uid).update({acct:'student',studentOK:true});close();toast(L('স্টুডেন্ট অ্যাকাউন্ট চালু ✓','Student account on ✓'))};
      $('#dpr').onclick=async()=>{if(API.on){await API.post('/api/demo/reset-pin');await API.kick()}else await sync.wallets.doc(uid).update({pinH:''});meW={...meW,pinH:''};close();toast(L('PIN মোছা হয়েছে','PIN cleared'))}}}

  /* ---------- Language ---------- */
  function langInit(){
    $('#langVal').textContent=LANG==='en'?'English':'বাংলা';
    $('#langRow').onclick=()=>{
      open(`<h3>ভাষা</h3>
        <div class="opt" data-l="bn"><span>🇧🇩</span><div><b translate="no">বাংলা</b><small translate="no">Bangla</small></div>${LANG==='bn'?'<i class="ck">✓</i>':''}</div>
        <div class="opt" data-l="en"><span>🇬🇧</span><div><b translate="no">English</b><small translate="no">English</small></div>${LANG==='en'?'<i class="ck">✓</i>':''}</div>
        <button class="btn alt" id="no">বাতিল</button>`);
      $('#no').onclick=close;
      panel.querySelectorAll('[data-l]').forEach(o=>o.onclick=()=>{if(o.dataset.l===LANG){close();return}try{localStorage.setItem('upay_lang',o.dataset.l)}catch(e){}location.reload()})}}

  /* ---------- Account type: personal / student (admin approval) / islamic ---------- */
  const ALAB={personal:'ব্যক্তিগত',student:'শিক্ষার্থী',islamic:'ইসলামিক'},AICO={personal:'👤',student:'🎓',islamic:'🕌'};
  function acctInit(){
    let R=null,SCF=STU_DEF,photo={card:'',selfie:''},which='card';
    const rq=()=>({...STU_DEF.req,...((SCF&&SCF.req)||{})});
    const guide=()=>(LANG==='en'?(SCF.guide_en||SCF.guide_bn):(SCF.guide_bn||SCF.guide_en))||'';
    const paintAcct=()=>{
      const pend=!!R&&R.status==='pending'&&curAcct!=='student';
      $('#acctVal').textContent=tr(ALAB[curAcct]||ALAB.personal)+(pend?' · '+tr('অপেক্ষমাণ'):'');
      const b=$('#abadge');b.style.display=curAcct==='personal'?'none':'inline-block';b.textContent=(AICO[curAcct]||'')+' '+tr(ALAB[curAcct]||'')};
    window.paintAcct=paintAcct;
    function types(){
      const st=R&&R.status,
        sub={personal:'সাধারণ ব্যবহারের জন্য',islamic:'ইসলামিক অ্যাকাউন্টে স্যুইচ করুন',
          student:curVerified?'যাচাই করা হয়েছে':st==='pending'?'অনুমোদনের অপেক্ষায়':st==='rejected'?'আবেদন প্রত্যাখ্যাত, আবার আবেদন করুন':'ইডু মেইল ও ভার্সিটি আইডি কার্ড লাগবে'};
      open(`<h3>অ্যাকাউন্টের ধরন</h3>${['personal','student','islamic'].map(k=>`<div class="opt" data-t="${k}"><span>${AICO[k]}</span><div><b>${ALAB[k]}</b><small>${sub[k]}</small></div>${curAcct===k?'<i class="ck">✓</i>':''}</div>`).join('')}<button class="btn alt" id="no">বন্ধ করুন</button>`);
      $('#no').onclick=close;
      panel.querySelectorAll('[data-t]').forEach(o=>o.onclick=()=>pick(o.dataset.t))}
    async function pick(k){
      if(!sync||!uid){toast('এখন সম্ভব নয়');return}
      if(k==='student'&&!curVerified){if(R&&R.status==='pending')return pending();return form()}
      if(k===curAcct){close();return}
      try{if(API.on){await API.post('/api/account-type',{acct:k});await API.kick()}else await sync.wallets.doc(uid).update({acct:k});close();toast(L(ALAB[k]+' অ্যাকাউন্টে পরিবর্তন হয়েছে ✓','Switched to '+tr(ALAB[k])+' account ✓'))}
      catch(e){toast('সমস্যা হয়েছে, আবার চেষ্টা করুন')}}
    function pending(){
      if(!R)return types();
      open(`<h3>শিক্ষার্থী অ্যাকাউন্ট</h3><div class="gbox"><span class="tg n">অনুমোদনের অপেক্ষায়</span><p style="margin:8px 0">আপনার আবেদন অ্যাডমিনের কাছে পাঠানো হয়েছে। অনুমোদন হলে অ্যাকাউন্ট চালু হবে।</p><small>${esc(R.email||'')} ${R.uni?'· '+esc(R.uni):''}</small></div><button class="btn alt" id="canc">আবেদন বাতিল করুন</button><button class="btn alt" id="no">বন্ধ করুন</button>`);
      $('#no').onclick=close;
      $('#canc').onclick=async()=>{try{await sync.acctreqs.doc(uid).delete();close();toast('আবেদন বাতিল হয়েছে')}catch(e){toast('সমস্যা হয়েছে, আবার চেষ্টা করুন')}}}
    function form(){
      const r=rq(),rejected=R&&R.status==='rejected',p=rejected?R:{};
      photo={card:p.card||'',selfie:p.selfie||''};
      const fld=(id,label,val,ph,type)=>`<label for="${id}">${label}</label><input id="${id}" type="${type||'text'}" value="${esc(val||'')}" placeholder="${ph||''}" autocomplete="off">`;
      const pic=(k,label)=>`<label>${label}</label><div id="sPv_${k}"></div><button class="mini" type="button" data-pk="${k}">📷 ছবি যোগ করুন</button>`;
      open(`<h3>শিক্ষার্থী অ্যাকাউন্ট</h3>
        ${guide()?`<div class="gbox">${esc(guide())}</div>`:''}
        ${rejected?`<div class="rej"><b>আগের আবেদন প্রত্যাখ্যান করা হয়েছে</b>${p.note?`<div><b>কারণ:</b> ${esc(p.note)}</div>`:''}</div>`:''}
        ${r.email?fld('sEm','শিক্ষা প্রতিষ্ঠানের ইমেইল (edu mail)',p.email,'name@university.edu.bd','email'):''}
        ${r.uni?fld('sUn','বিশ্ববিদ্যালয়ের নাম',p.uni,''):''}
        ${r.sid?fld('sId','স্টুডেন্ট আইডি নম্বর',p.sid,''):''}
        ${r.card?pic('card','ভার্সিটি আইডি কার্ডের ছবি'):''}
        ${r.selfie?pic('selfie','আইডি কার্ড হাতে সেলফি'):''}
        <input type="file" id="sFile" accept="image/*" hidden>
        <label class="chk"><input type="checkbox" id="sOk"> <span>আমি নিশ্চিত করছি যে সব তথ্য সঠিক</span></label>
        <button class="btn" id="sGo">আবেদন পাঠান</button><button class="btn alt" id="no">বাতিল</button>`);
      const pv=()=>['card','selfie'].forEach(k=>{const e=$('#sPv_'+k);if(e)e.innerHTML=photo[k]?`<img class="idimg" src="${photo[k]}" alt="ID">`:''});pv();
      panel.querySelectorAll('[data-pk]').forEach(b=>b.onclick=()=>{which=b.dataset.pk;$('#sFile').click()});
      $('#sFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{photo[which]=await shrinkImg(f,1000);pv()}catch(_){toast('ছবিটি পড়া যায়নি')}e.target.value=''};
      $('#no').onclick=close;
      $('#sGo').onclick=async()=>{
        const v=id=>{const e=$('#'+id);return e?e.value.trim():''},em=v('sEm'),un=v('sUn'),sid=v('sId');
        if(r.email){if(!/^\S+@\S+\.\S+$/.test(em)){toast('ইমেইল ঠিকানা ঠিক নয়');return}if(!eduOk(SCF.domains,em)){toast('শিক্ষা প্রতিষ্ঠানের (edu) ইমেইল দিন');return}}
        if(r.uni&&un.length<3){toast('বিশ্ববিদ্যালয়ের নাম লিখুন');return}
        if(r.sid&&!sid){toast('স্টুডেন্ট আইডি নম্বর দিন');return}
        if(r.card&&!photo.card){toast('আইডি কার্ডের ছবি দিন');return}
        if(r.selfie&&!photo.selfie){toast('আইডি কার্ড হাতে সেলফি দিন');return}
        if(!$('#sOk').checked){toast('তথ্য সঠিক বলে নিশ্চিত করুন');return}
        try{await sync.acctreqs.doc(uid).set({uid,name:$('#uname').textContent,type:'student',email:em,uni:un,sid,card:r.card?photo.card:'',selfie:r.selfie?photo.selfie:'',ts:Date.now(),status:'pending',note:'',unreadCust:0});
          toast('আবেদন পাঠানো হয়েছে ✓');pending()}
        catch(e){toast('ফাইল বড় হওয়ায় জমা হয়নি। ছোট ছবি দিন')}}}
    $('#acctRow').onclick=types;
    sync.acctreqs.doc(uid).onSnapshot(d=>{R=d.data()||null;
      if(R&&R.unreadCust){toast(R.status==='approved'?'🎓 আপনার শিক্ষার্থী অ্যাকাউন্ট অনুমোদিত হয়েছে':'আপনার শিক্ষার্থী অ্যাকাউন্টের আবেদন গৃহীত হয়নি');sync.acctreqs.doc(uid).update({unreadCust:0})}
      paintAcct()});
    sync.stu.onSnapshot(d=>{SCF={...STU_DEF,...(d.data()||{})}});
    paintAcct();
  }
  
  const mapTx=t=>({id:t.id,uid:t.uid,t:t.kind==='auto_send'?L('অটো সেন্ড মানি','Auto Send Money'):t.kind==='referral'?L('রেফার বোনাস','Referral bonus'):t.kind==='referral_new'?L('স্বাগত বোনাস','Welcome bonus'):(KINDS[t.kind]||t.kind),a:Number(t.amount),fee:Number(t.fee),ts:t.ts,ph:t.counterparty_phone,rn:t.counterparty_name,trx:t.trx_id,src:t.bucket,undone:t.undone,bal:Number(t.balance_after),d:fdf(t.ts),k:Number(t.amount)>0?'in':'out'});
  /* Backend mode: the page only DISPLAYS server state. Everything is refreshed from the API every few seconds and right after each action. */
  function applyApi(x){const w=x.w,first=!ready;
    meW={name:w.name,balance:Number(w.balance),frozen:w.frozen,acct:w.acct,studentOK:w.student_ok,phone:w.phone,pinH:w.has_pin?'1':'',gUid:w.guardian_uid||'',gStatus:w.guardian_status,gPhone:w.guardian_phone,gName:w.guardian_name,gSeen:w.guardian_seen_at,gSeenBy:w.guardian_seen_by,gSeenAck:w.guardian_seen_ack};
    myPh=w.phone;balance=Number(w.balance);frozen=!!w.frozen;curAcct=w.acct||'personal';curVerified=!!w.student_ok;
    plan={buckets:w.buckets.map(b=>({n:b.name,amt:Number(b.amount)})),rules:w.rules.map(r=>({id:r.id,phone:r.phone,name:r.name,amt:Number(r.amount),at:r.run_at?dtl(new Date(r.run_at)):'',rep:r.repeat,armed:r.armed,done:r.done_at||0})),saved:w.saved.map(s=>({phone:s.phone,name:s.name}))};
    $$('.who span,.pinfo>span').forEach(e=>e.textContent=w.phone);
    $('#uname').textContent=w.name;$('.av').textContent=(w.name||'গ')[0];$('#uname2').textContent=w.name;$('#pav').textContent=(w.name||'গ')[0];paintPhoto();
    $('#planRow').style.display=isStu()?'':'none';
    tx=x.h.map(mapTx);window.setSocial&&window.setSocial(x.g,x.sp);window.bellRef&&window.bellRef();
    window.paintAcct&&window.paintAcct();paintBal();paintHis();ready=true;if(frozen&&first)toast('আপনার অ্যাকাউন্ট ফ্রিজ করা হয়েছে')}
  async function apiBoot(){
    const P=new URLSearchParams(location.search);
    uid=window.UPAY_UID||P.get('u')||localStorage.getItem('upay_uid')||('c'+Math.random().toString(36).slice(2,8));if(!window.UPAY_UID)try{localStorage.setItem('upay_uid',uid)}catch(e){}
    const nm=P.get('n')||(L('গ্রাহক ','Customer ')+uid.slice(-4));
    const login=async()=>{if(window.UPAY_TOKEN){if(API.token){authLogout();throw{code:'unauthorized'}}API.token=window.UPAY_TOKEN;return}API.token=(await API.post('/api/auth/demo',{uid,name:nm})).token};
    try{await login()}catch(e){toast(apiMsg(e));return}
    const D=makeDocs(false);
    sync={chats:D.col('chats'),emails:D.col('emails'),complaints:D.col('complaints'),acctreqs:D.col('acctreqs'),cfg:D.cfg('app'),faqs:D.cfg('faqs'),stu:D.cfg('student')};
    sync.cfg.onSnapshot(d=>{const c=d.data();const n=$('#note');
      if(c&&c.text){n.style.display='block';n.textContent='📢 '+c.text;if(c.ts>lastNote&&lastNote)toast('নতুন ঘোষণা');lastNote=c.ts}else n.style.display='none'});
    chatInit();csInit();acctInit();planInit();socialInit();demoInit();prefPull();
    const grab=async()=>({w:await API.get('/api/me'),h:await API.get('/api/history?limit=300'),sp:await API.get('/api/splits'),g:await API.get('/api/guardian/students')});
    API.poll(async()=>{try{return await grab()}catch(e){if(e.code==='unauthorized'){await login();return await grab()}throw e}},applyApi,2500)}
  (async()=>{try{
    if(API.on){await apiBoot();return}
    if(!window.claude)return;
    const [db,user]=await Promise.all([claude.use('db'),claude.use('user')]);
    if(!db||!user)return;
    uid=await user.id();const me=await user.me();isAdm=await user.canEdit();
    sync={wallets:db.collection('wallets'),txs:db.collection('txs'),cfg:db.doc('config/app'),chats:db.collection('chats'),faqs:db.doc('config/faqs'),emails:db.collection('emails'),complaints:db.collection('complaints'),acctreqs:db.collection('acctreqs'),splits:db.collection('splits'),stu:db.doc('config/student')};
    const ref=sync.wallets.doc(uid);
    if(!(await ref.get()).exists){const R0=window.UPAY_REG;let rwb=null;if(R0&&R0.ref){const w2=await findW('01'+R0.ref.slice(2));if(w2&&w2.id!==uid)rwb=w2}
     await ref.set(R0?{name:R0.name,balance:rwb?50:0,frozen:false,acct:'personal',phone:R0.phone,pinH:R0.pinH,nid4:R0.nid4,dob:R0.dob,createdAt:Date.now()}:{name:me.name||L('গ্রাহক','Customer'),balance:12500,frozen:false,acct:'personal',phone:genPh(uid),createdAt:Date.now()});
     if(rwb){const d=await creditW(rwb.id,50);await addTx(rwb.id,d.name,'রেফার বোনাস',50,{trx:trx(),bal:d.balance});await addTx(uid,R0.name,'রেফার বোনাস',50,{trx:trx(),bal:50})}};
    ref.onSnapshot(d=>{const w=d.data();if(!w)return;if(!w.phone){ref.update({phone:genPh(uid)});return}const up=ready&&(w.balance||0)>balance;meW=w;myPh=w.phone;window.bellRef&&window.bellRef();$$('.who span,.pinfo>span').forEach(e=>e.textContent=w.phone);balance=w.balance||0;frozen=!!w.frozen;
      $('#uname').textContent=w.name;$('.av').textContent=(w.name||'গ')[0];$('#uname2').textContent=w.name;$('#pav').textContent=(w.name||'গ')[0];paintPhoto();curAcct=w.acct||'personal';curVerified=!!w.studentOK;plan={buckets:[],rules:[],saved:[],...(w.plan||{})};$('#planRow').style.display=isStu()?'':'none';window.paintAcct&&window.paintAcct();paintBal();paintHis();
      if(up)setTimeout(()=>fireRules(true),0);ready=true;
      if(frozen)toast('আপনার অ্যাকাউন্ট ফ্রিজ করা হয়েছে')});
    sync.txs.where('uid','==',uid).onSnapshot(q=>{tx=q.docs.map(d=>d.data()).sort((a,b)=>b.ts-a.ts).map(x=>({...x,d:fdf(x.ts),k:x.a>0?'in':'out'}));paintHis()});
    sync.cfg.onSnapshot(d=>{const c=d.data();const n=$('#note');
      if(c&&c.text){n.style.display='block';n.textContent='📢 '+c.text;if(c.ts>lastNote&&lastNote)toast('নতুন ঘোষণা');lastNote=c.ts}else n.style.display='none'});
    chatInit();csInit();acctInit();planInit();socialInit();demoInit();remPaint();setInterval(()=>fireRules(false),30000);
    setTimeout(()=>fireRules(false),1500);document.addEventListener('visibilitychange',()=>{if(!document.hidden)fireRules(false)});
  }catch(e){console.error(e)}})();
  
  paintBal();paintHis();
  langInit();tx8($('#app'));document.documentElement.lang=LANG;
  
}

