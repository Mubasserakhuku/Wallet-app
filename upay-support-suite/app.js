/* upay Support Suite — one file for customer app + admin console + live chat + AI assistant */
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const bn=n=>String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]);
const money=n=>'৳ '+bn(Number(n).toLocaleString('en-US'));
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fd=ts=>new Date(ts).toLocaleString('bn-BD',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});

/* ---------- AI assistant logic (from the Message Assistant project) ---------- */
const KB={
failed_txn:{label:"Failed or pending transaction",auto:1,team:"Payments Ops",pri:"high",
 kw:["failed","pending","deducted","not received","taka kete","kete nise","টাকা কেটে","কেটে নিয়েছে","পেন্ডিং","ব্যর্থ"],
 en:e=>`Sorry for the trouble. If money was deducted but the transaction failed, it is normally returned to your wallet automatically within 24 hours. ${e.txn?"We have noted transaction "+e.txn+".":"Please reply with your transaction ID so we can check."} Never share your PIN or OTP with anyone.`,
 bn:e=>`অসুবিধার জন্য দুঃখিত। টাকা কেটে গিয়ে লেনদেন ব্যর্থ হলে সাধারণত ২৪ ঘণ্টার মধ্যে স্বয়ংক্রিয়ভাবে ওয়ালেটে ফেরত আসে। ${e.txn?"আপনার লেনদেন "+e.txn+" আমরা নোট করেছি।":"অনুগ্রহ করে আপনার ট্রানজেকশন আইডি পাঠান।"} কারো সাথে আপনার পিন বা ওটিপি শেয়ার করবেন না।`},
wrong_number:{label:"Money sent to wrong number",auto:0,team:"Dispute Desk",pri:"high",
 kw:["wrong number","by mistake","vul number","vul e","ভুল নম্বর","ভুল নাম্বার","ভুলে পাঠ"],
 en:e=>`We are sorry. A completed transfer cannot be reversed automatically, so our dispute team will review your case. Please share the transaction ID and the number you sent to.`,
 bn:e=>`আমরা দুঃখিত। সম্পন্ন হওয়া লেনদেন স্বয়ংক্রিয়ভাবে ফেরত দেওয়া যায় না, তাই আমাদের ডিসপিউট টিম আপনার বিষয়টি দেখবে। অনুগ্রহ করে ট্রানজেকশন আইডি এবং যে নম্বরে পাঠিয়েছেন তা জানান।`},
pin_reset:{label:"Forgot PIN",auto:1,team:"Account Support",pri:"normal",
 kw:["forgot pin","forget pin","reset pin","pin vule","pin bhule","পিন ভুলে","পিন রিসেট","পিন মনে নেই"],
 en:e=>`To reset your PIN, open the upay app, tap "Forgot PIN" and follow the steps. upay will never ask you for your PIN or OTP.`,
 bn:e=>`পিন রিসেট করতে upay অ্যাপ খুলে "পিন ভুলে গেছি" চাপুন এবং ধাপগুলো অনুসরণ করুন। upay কখনো আপনার পিন বা ওটিপি চায় না।`},
scam:{label:"Scam or fraud report",auto:0,team:"Fraud Team",pri:"urgent",esc:1,
 kw:["scam","fraud","hacked","asked for otp","otp chaise","fon korse","ওটিপি চেয়ে","প্রতারণা","ফোন করে","lottery","prize","পুরস্কার"],
 en:e=>`Thank you for reporting this. Please do not share your PIN or OTP and do not send any money. We have passed this to our fraud team and they will contact you through the app.`,
 bn:e=>`জানানোর জন্য ধন্যবাদ। অনুগ্রহ করে পিন বা ওটিপি কাউকে দেবেন না এবং কোনো টাকা পাঠাবেন না। বিষয়টি আমাদের ফ্রড টিমকে জানানো হয়েছে, তারা অ্যাপের মাধ্যমে আপনার সাথে যোগাযোগ করবে।`},
fees:{label:"Fees and charges",auto:1,team:"Customer Care",pri:"normal",
 kw:["fee","charge","charges","চার্জ","koto charge","কত কাটবে"],
 en:e=>`Fees depend on the service and the amount. You can see the exact fee on the confirmation screen before you pay, and in the fee list inside the app.`,
 bn:e=>`ফি নির্ভর করে সেবা ও পরিমাণের উপর। পেমেন্টের আগে কনফার্মেশন স্ক্রিনে এবং অ্যাপের ফি তালিকায় সঠিক ফি দেখতে পাবেন।`},
howto:{label:"How to use a service",auto:1,team:"Customer Care",pri:"normal",
 kw:["how to","how do i","kivabe","কীভাবে","কিভাবে"],
 en:e=>`You can do this from the home screen of the app. Tell us which service you need (send money, cash-out, or add money) and we will guide you step by step.`,
 bn:e=>`অ্যাপের হোম স্ক্রিন থেকেই এটি করা যায়। কোন সেবা দরকার (সেন্ড মানি, ক্যাশ আউট, অ্যাড মানি) জানালে ধাপে ধাপে সাহায্য করব।`},
locked:{label:"Account locked or blocked",auto:0,team:"Account Support",pri:"high",
 kw:["locked","blocked","account lock","লক","ব্লক"],
 en:e=>`We are sorry your account is locked. For your safety, a team member will verify your identity and help you. Please do not share your PIN or OTP.`,
 bn:e=>`আপনার অ্যাকাউন্ট লক হওয়ায় আমরা দুঃখিত। নিরাপত্তার জন্য একজন টিম সদস্য আপনার পরিচয় যাচাই করে সাহায্য করবেন। অনুগ্রহ করে পিন বা ওটিপি কাউকে দেবেন না।`},
unknown:{label:"Unclear request",auto:0,team:"Support Agents",pri:"normal",kw:[],
 en:e=>`Thank you for contacting upay. A support agent will reply to you shortly.`,
 bn:e=>`upay-এর সাথে যোগাযোগ করার জন্য ধন্যবাদ। একজন সাপোর্ট এজেন্ট শীঘ্রই আপনাকে উত্তর দেবেন।`}};
const BN=/[\u0980-\u09FF]/;
function analyze0(raw){
 const t=raw.toLowerCase(),flags=[],ent={};
 const sens=/(pin|otp|পিন|ওটিপি)\D{0,12}(\d{4,6})/i.test(raw);if(sens)flags.push("Customer typed a PIN or OTP");
 let shown=raw.replace(/(pin|otp|পিন|ওটিপি)(\D{0,12})(\d{4,6})/gi,"$1$2••••").replace(/\b(01\d)(\d{5})(\d{3})\b/g,"$1••••• $3".replace(" ",""));
 if(/\b01\d{9}\b/.test(raw))ent.phone="masked";
 const am=raw.match(/(?:৳|tk\.?|taka|টাকা)\s?([\d,]+)|([\d,]+)\s?(?:৳|tk|taka|টাকা)/i);if(am)ent.amount="৳"+(am[1]||am[2]);
 const tx=raw.match(/\b(?=[A-Z0-9]*\d)(?=[A-Z0-9]*[A-Z])[A-Z0-9]{8,12}\b/);if(tx)ent.txn=tx[0];
 const sc=Object.entries(KB).filter(([k])=>k!=="unknown").map(([k,v])=>[k,v.kw.filter(w=>t.includes(w))]).sort((a,b)=>b[1].length-a[1].length);
 const top=sc[0][1].length?sc[0]:["unknown",[]],intent=top[0],kb=KB[intent],hits=top[1];
 const conf=intent==="unknown"?.3:Math.min(.95,.55+.2*hits.length);
 const bn=BN.test(raw)||hits.some(w=>/^[a-z ]+$/.test(w)&&["taka kete","kete nise","vul number","vul e","pin vule","pin bhule","otp chaise","fon korse","kivabe","koto charge"].includes(w));
 const lang=BN.test(raw)?"Bangla":bn?"Bangla (romanized)":"English";
 let reply=(bn?kb.bn:kb.en)(ent);
 if(sens)reply+=bn?" আপনি বার্তায় গোপন কোড লিখেছেন। অনুগ্রহ করে এটি আর কাউকে দেবেন না।":" You typed a secret code in your message. Please never share it with anyone.";
 let dec=kb.esc?"escalated":(kb.auto&&conf>=.7&&!sens)?"auto_sent":"needs_review";
 return{shown,intent,hits,conf,lang,reply,ent,flags,dec,team:kb.team,pri:kb.pri,policy:kb.label};}
const SW=new Set(["the","is","are","an","to","of","do","i","my","can","what","and","in","for","on","it","me","you","your","please","এবং","কি","কী","আমি","আমার"]);
const tok=t=>new Set((t.toLowerCase().match(/[\u0980-\u09FFa-z0-9]+/g)||[]).filter(w=>w.length>1&&!SW.has(w)));
function faqMatch(raw,FAQS){const A=tok(raw);let best=null;FAQS.forEach(f=>[f.q,...f.alt].forEach(p=>{const B=tok(p);if(!B.size)return;const sh=[...B].filter(w=>A.has(w)),d=2*sh.length/(A.size+B.size),c=B.size>=2?sh.length/B.size*.8:0,sc=Math.max(d,c);if(sc>=.5&&(!best||sc>best.s))best={f,s:sc,sh}}));return best}
function analyze(raw,FAQS=[]){const r=analyze0(raw),m=faqMatch(raw,FAQS);if(!m||r.intent==="scam")return r;
 const sens=r.flags.length>0;let reply=m.f.a;if(sens)reply+=BN.test(m.f.a)?" আপনি বার্তায় গোপন কোড লিখেছেন। অনুগ্রহ করে এটি আর কাউকে দেবেন না।":" You typed a secret code in your message. Please never share it with anyone.";
 return{...r,intent:"faq",policy:"FAQ: "+m.f.q,hits:m.sh,conf:Math.min(.97,.45+m.s*.6),reply,dec:m.f.auto&&!sens?"auto_sent":"needs_review",team:"Customer Care",pri:"normal"}}

const ts=()=>new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
function makeMessage(text,id,faqs){const a=analyze(text,faqs),t=ts();return{id,who:'Customer c_'+(88000+id*37),text,a,at:t,status:a.dec,out:a.dec==='auto_sent'?a.reply:null,draft:a.reply,audit:['Received '+t,'Redacted and analyzed','Matched policy: '+a.policy,'Decision: '+a.dec.replace('_',' ')+(a.dec==='auto_sent'?' and reply sent':'')]}}


/* ---------- Shared storage (localStorage + cross-tab sync). Swap with a real API later. ---------- */
function makeDb(){
  const K='upay_db',rd=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')}catch(e){return{}}},wr=o=>{try{localStorage.setItem(K,JSON.stringify(o))}catch(e){}};
  const subs=new Set(),fire=()=>subs.forEach(f=>{try{f()}catch(e){console.error(e)}}),clone=x=>x===undefined?x:JSON.parse(JSON.stringify(x));
  addEventListener('storage',e=>{if(e.key===K)fire()});
  const snap=(p,o)=>({id:p.split('/').pop(),exists:o!==undefined,data:()=>clone(o)});
  const listen=(get,cb)=>{const run=()=>cb(get());subs.add(run);run();return()=>subs.delete(run)};
  const ref=p=>({id:p.split('/').pop(),path:p,
    get:async()=>snap(p,rd()[p]),
    set:async d=>{const o=rd();o[p]=clone(d);wr(o);fire()},
    update:async d=>{const o=rd();if(o[p]===undefined)throw{code:'not_found'};o[p]={...o[p],...clone(d)};wr(o);fire()},
    delete:async()=>{const o=rd();delete o[p];wr(o);fire()},
    onSnapshot:cb=>listen(()=>snap(p,rd()[p]),cb)});
  const col=(c,flt=[])=>{
    const qs=()=>{const o=rd(),docs=Object.keys(o).filter(k=>k.startsWith(c+'/')&&!k.slice(c.length+1).includes('/')).filter(k=>flt.every(([f,v])=>o[k][f]===v)).map(k=>snap(k,o[k]));return{docs,size:docs.length,empty:!docs.length}};
    return{doc:id=>ref(c+'/'+id),where:(f,op,v)=>col(c,[...flt,[f,v]]),get:async()=>qs(),onSnapshot:cb=>listen(qs,cb)}};
  return{collection:n=>col(n),doc:p=>ref(p)};
}
if(!window.claude){
  const ADM=document.body.classList.contains('admin'),P=new URLSearchParams(location.search);
  let id=P.get('u')||localStorage.getItem('upay_uid')||('c'+Math.random().toString(36).slice(2,8));
  try{localStorage.setItem('upay_uid',id)}catch(e){}
  const nm=P.get('n')||('গ্রাহক '+id.slice(-4)),DB=makeDb();
  window.claude={use:async n=>n==='db'?DB:n==='user'?{id:async()=>id,me:async()=>({name:nm}),canEdit:async()=>ADM,isOwner:async()=>ADM}:null};
}

/* ---------- Customer app ---------- */
function initCustomer(){
  let balance=12500,shown=false;
  let tx=[
   {t:'ক্যাশ ইন',d:'আজ, ১০:৩০',a:5000,k:'in'},
   {t:'মোবাইল রিচার্জ',d:'গতকাল, ৮:১৫',a:-249,k:'out'},
   {t:'সেন্ড মানি',d:'২৮ সেপ্টেম্বর',a:-1500,k:'out'},
   {t:'রিসিভ মানি',d:'২৬ সেপ্টেম্বর',a:2000,k:'in'},
   {t:'বিদ্যুৎ বিল',d:'২৪ সেপ্টেম্বর',a:-860,k:'out'}];
  const main=[['সেন্ড মানি','💸','#d9efff'],['মোবাইল রিচার্জ','📱','#d9efff'],['ক্যাশ আউট','🏧','#ffe6d0'],['পে বিল','🧾','#d9efff'],
   ['অ্যাড মানি','➕','#e6e1f7'],['সঞ্চয়','👛','#fff0c2'],['ফান্ড ট্রান্সফার','🏦','#d9efff'],['রিকোয়েস্ট মানি','💬','#d6f5ee'],
   ['মেক পেমেন্ট','▦','#e8f3ff'],['রেফার & আর্ন','🎁','#ffe0ea']];
  const pay=[['ট্রাফিক ফাইন','🚦','#dff5e3'],['টোল পেমেন্ট','🛣️','#e6ecf5'],['সরকারি পেমেন্ট','🏛️','#ffe3e3'],['এডুকেশন','🎓','#e6e1f7'],
   ['এনজিও','🤲','#fff0c2'],['বীমা','🛡️','#d6f5ee'],['ডোনেশন','🙏','#ffe6d0'],['যাকাত পেমেন্ট','🕌','#dff5e3'],
   ['ফ্লাইট','✈️','#d9efff'],['হোটেল','🏨','#d6f5ee'],['মুভি','🎬','#ffe0ea'],['আরো','⋯','#eee']];
  const mk=(a,el)=>{$(el).innerHTML=a.map(([n,i,c])=>`<button class="it" data-s="${n}"><div class="ic" style="background:${c}">${i}</div>${n}</button>`).join('')};
  mk(main,'#g1');mk(pay,'#g2');
  
  // banners
  const bs=[['linear-gradient(120deg,#0b4aa2,#2b7be0)','আনলিমিটেড ক্যাশব্যাক','রিচার্জে ৳১০ পর্যন্ত ক্যাশব্যাক'],['linear-gradient(120deg,#c2185b,#ef5b8f)','বিল পেমেন্টে অফার','প্রথম বিলে ৫% ছাড়'],['linear-gradient(120deg,#0f7a5a,#35b88a)','রেফার করুন, আর্ন করুন','বন্ধুকে ডাকুন, ৳৫০ পান']];
  $('#ban').innerHTML=bs.map((b,i)=>`<div class="slide${i?'':' on'}" style="background:${b[0]}"><h3>${b[1]}</h3><p>${b[2]}</p></div>`).join('');
  $('#dots').innerHTML=bs.map((_,i)=>`<i class="${i?'':'on'}"></i>`).join('');
  let bi=0;const sl=$$('.slide'),dt=$$('#dots i');
  const go=i=>{bi=(i+3)%3;sl.forEach((s,k)=>s.classList.toggle('on',k==bi));dt.forEach((s,k)=>s.classList.toggle('on',k==bi))};
  setInterval(()=>go(bi+1),3500);$('#ban').onclick=()=>go(bi+1);
  
  // tabs
  function tab(n){$$('.view').forEach(v=>v.classList.toggle('on',v.id=='v-'+n));$$('.nav .t').forEach(b=>b.classList.toggle('on',b.dataset.tab==n));$('#v-'+n).scrollTop=0}
  $$('.nav .t').forEach(b=>b.onclick=()=>tab(b.dataset.tab));
  
  // toast
  let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('on'),1800)}
  $$('[data-toast]').forEach(e=>e.onclick=()=>toast(e.dataset.toast));
  $('#chatBtn').onclick=()=>window.openChat&&window.openChat();
  $('#supRow').onclick=()=>window.openChat&&window.openChat();
  $('#bell').onclick=()=>toast('নতুন কোনো নোটিফিকেশন নেই');
  
  // balance
  function paintBal(){$('#balBtn').textContent=shown?money(balance):'ব্যালেন্স';$('#accBal').textContent=money(balance)}
  $('#balBtn').onclick=()=>{shown=!shown;paintBal();if(shown)setTimeout(()=>{shown=false;paintBal()},4000)};
  
  // history
  let flt='all';
  function paintHis(){$('#hlist').innerHTML=tx.filter(x=>flt=='all'||x.k==flt).map(x=>`<div class="row"><span>${x.k=='in'?'⬇️':'⬆️'}</span><div class="g">${x.t}<small>${x.d}</small></div><span class="${x.a>0?'pos':'neg'}">${x.a>0?'+':'−'}${money(Math.abs(x.a))}</span></div>`).join('')}
  $$('[data-f]').forEach(b=>b.onclick=()=>{flt=b.dataset.f;$$('[data-f]').forEach(c=>c.classList.toggle('on',c==b));paintHis()});
  
  // sheet
  const sheet=$('#sheet'),panel=$('#panel');
  const close=()=>sheet.classList.remove('on');
  sheet.onclick=e=>{if(e.target==sheet)close()};
  function open(h){panel.innerHTML=h;sheet.classList.add('on')}
  const moneyForm=(title,sign,label,ph)=>{open(`<h3>${title}</h3><input id="f1" inputmode="numeric" placeholder="${ph}"><input id="f2" inputmode="numeric" placeholder="টাকার পরিমাণ"><button class="btn" id="ok">নিশ্চিত করুন</button><button class="btn alt" id="no">বাতিল</button>`);
   $('#no').onclick=close;
   $('#ok').onclick=()=>{const a=parseInt($('#f2').value);if(!$('#f1').value&&sign<0&&label!='in'){toast('নম্বর দিন');return}
    if(!a||a<=0){toast('সঠিক পরিমাণ দিন');return}
    if(sign<0&&a>balance){toast('ব্যালেন্স পর্যাপ্ত নয়');return}
    commit(title,sign*a).then(ok=>{if(ok){close();toast(title+' সফল হয়েছে ✓')}})}};
  const forms={'সেন্ড মানি':()=>moneyForm('সেন্ড মানি',-1,'out','প্রাপকের মোবাইল নম্বর'),
   'মোবাইল রিচার্জ':()=>moneyForm('মোবাইল রিচার্জ',-1,'out','মোবাইল নম্বর'),
   'ক্যাশ আউট':()=>moneyForm('ক্যাশ আউট',-1,'out','এজেন্ট নম্বর'),
   'অ্যাড মানি':()=>moneyForm('অ্যাড মানি',1,'in','ব্যাংক/কার্ড নম্বর'),
   'পে বিল':()=>moneyForm('পে বিল',-1,'out','বিলার/অ্যাকাউন্ট নম্বর'),
   'মেক পেমেন্ট':()=>moneyForm('মেক পেমেন্ট',-1,'out','মার্চেন্ট নম্বর'),
   'ফান্ড ট্রান্সফার':()=>moneyForm('ফান্ড ট্রান্সফার',-1,'out','ব্যাংক অ্যাকাউন্ট নম্বর'),
   'রিকোয়েস্ট মানি':()=>moneyForm('রিকোয়েস্ট মানি',1,'in','যার কাছে চাইবেন তার নম্বর')};
  $$('.it').forEach(b=>b.onclick=()=>{const n=b.dataset.s;(forms[n]||(()=>toast(n+' শিগগিরই আসছে')))()});
  $$('[data-act]').forEach(b=>b.onclick=()=>forms[b.dataset.act==='Add Money'?'অ্যাড মানি':'ক্যাশ আউট']());
  
  // QR
  $('#qrBtn').onclick=()=>{open(`<h3>QR স্ক্যান করুন</h3><div class="scan"><i></i></div><button class="btn" id="sc">স্ক্যান সিমুলেট করুন</button><button class="btn alt" id="no">বন্ধ করুন</button>`);
   $('#no').onclick=close;$('#sc').onclick=()=>{close();setTimeout(()=>forms['মেক পেমেন্ট'](),150)}};
  
  // theme
  function theme(d){document.documentElement.dataset.theme=d?'dark':'light';$('#themeState').textContent=d?'চালু':'বন্ধ'}
  let dark=matchMedia('(prefers-color-scheme: dark)').matches;theme(dark);
  $('#themeRow').onclick=()=>{dark=!dark;theme(dark)};
  let sync=null,uid=null,frozen=false,isAdm=false,admOn=false,admTab='u',allW=[],allT=[],lastNote=0;
  async function commit(t,a){
    if(frozen){toast('আপনার অ্যাকাউন্ট ফ্রিজ করা আছে');return false}
    if(!sync){balance+=a;tx.unshift({t,d:'এইমাত্র',a,k:a>0?'in':'out'});paintBal();paintHis();return true}
    try{const id='t'+Date.now()+Math.random().toString(36).slice(2,6);
      await sync.wallets.doc(uid).update({balance:balance+a});
      await sync.txs.doc(id).set({id,uid,name:$('#uname').textContent,t,a,ts:Date.now()});return true}
    catch(e){toast('সমস্যা হয়েছে, আবার চেষ্টা করুন');return false}
  }
  
    /* ---------- Customer live chat (AI assistant answers safe questions, rest go to an agent) ---------- */
    function chatInit(){
      let chat=null,FQ=[];const box=$('#chMsgs');
      sync.faqs.onSnapshot(d=>{const x=d.data();FQ=(x&&x.list)||[]});
      sync.chats.doc(uid).onSnapshot(d=>{chat=d.data()||null;paint()});
      function paint(){
        const ms=(chat&&chat.msgs)||[];
        box.innerHTML=(ms.length?'':'<div class="m sy">কিছু জানতে চান? এখানে লিখুন। সাধারণ প্রশ্নের উত্তর সাথে সাথে পাবেন, বাকিগুলো আমাদের টিম দেখবে।</div>')
          +ms.map(m=>m.f==='sys'?`<div class="m sy">${esc(m.t)}</div>`:`<div class="m ${m.f==='cu'?'me':'ot'}">${esc(m.t)}${m.f==='cu'?'':`<small>${m.f==='ai'?'সহকারী':'এজেন্ট'}</small>`}</div>`).join('');
        box.scrollTop=box.scrollHeight;
        const open=$('#chat').classList.contains('on'),u=(chat&&chat.unreadCust)||0;
        $('#chDot').style.display=u&&!open?'block':'none';
        if(open&&u)sync.chats.doc(uid).update({unreadCust:0});
      }
      window.openChat=()=>{$('#chat').classList.add('on');paint();$('#chIn').focus()};
      $('#chBack').onclick=()=>$('#chat').classList.remove('on');
      const send=async()=>{
        const inp=$('#chIn'),text=inp.value.trim();if(!text)return;inp.value='';
        const a=analyze(text,FQ),now=Date.now(),old=chat||{msgs:[],audit:[]};
        const msgs=[...old.msgs,{f:'cu',t:a.shown,ts:now}];
        const audit=[...(old.audit||[]),'Received '+ts(),'Redacted and analyzed','Matched policy: '+a.policy,'Decision: '+a.dec.replace('_',' ')];
        if(a.dec==='auto_sent'){msgs.push({f:'ai',t:a.reply,ts:now+1});audit.push('Reply sent automatically')}
        else msgs.push({f:'sys',t:'আপনার বার্তা আমাদের টিমের কাছে পাঠানো হয়েছে। শীঘ্রই উত্তর পাবেন।',ts:now+1});
        await sync.chats.doc(uid).set({uid,name:$('#uname').textContent,status:a.dec,last:now+1,unreadAdmin:(old.unreadAdmin||0)+1,unreadCust:0,a,draft:a.reply,msgs,audit});
      };
      $('#chSend').onclick=send;$('#chIn').onkeydown=e=>{if(e.key==='Enter')send()};
    }
  
  (async()=>{try{
    if(!window.claude)return;
    const [db,user]=await Promise.all([claude.use('db'),claude.use('user')]);
    if(!db||!user)return;
    uid=await user.id();const me=await user.me();isAdm=await user.canEdit();
    sync={wallets:db.collection('wallets'),txs:db.collection('txs'),cfg:db.doc('config/app'),chats:db.collection('chats'),faqs:db.doc('config/faqs')};
    const ref=sync.wallets.doc(uid);
    if(!(await ref.get()).exists)await ref.set({name:me.name||'গ্রাহক',balance:12500,frozen:false,createdAt:Date.now()});
    ref.onSnapshot(d=>{const w=d.data();if(!w)return;balance=w.balance||0;frozen=!!w.frozen;
      $('#uname').textContent=w.name;$('.av').textContent=(w.name||'গ')[0];paintBal();
      if(frozen)toast('আপনার অ্যাকাউন্ট ফ্রিজ করা হয়েছে')});
    sync.txs.where('uid','==',uid).onSnapshot(q=>{tx=q.docs.map(d=>d.data()).sort((a,b)=>b.ts-a.ts).map(x=>({...x,d:fd(x.ts),k:x.a>0?'in':'out'}));paintHis()});
    sync.cfg.onSnapshot(d=>{const c=d.data();const n=$('#note');
      if(c&&c.text){n.style.display='block';n.textContent='📢 '+c.text;if(c.ts>lastNote&&lastNote)toast('নতুন ঘোষণা');lastNote=c.ts}else n.style.display='none'});
    chatInit();
  }catch(e){console.error(e)}})();
  
  paintBal();paintHis();
  
}

/* ---------- Admin console ---------- */
function initAdmin(){
  const root=$('#root');
  const ST={auto_sent:['Auto-replied','ok'],needs_review:['Needs review','warn'],escalated:['Escalated','bad'],agent_sent:['Sent by agent','info']};
  const TABS=[['chat','Live chat'],['cus','Customers'],['txn','Transactions'],['faq','My FAQ'],['pol','Reply policies'],['ann','Announcement']];
  let tab='chat',sel=null,W=[],T=[],C=[],faqs=[],note='',modal=null,msg='',cols,cfg,fqd;const ui={};
  const chatOf=id=>C.find(c=>c.id===id),st=s=>ST[s]||['Open','info'];

  function vChat(){
    const L=C.slice().sort((a,b)=>b.last-a.last);if(!sel&&L[0])sel=L[0].id;
    const c=chatOf(sel),a=c&&c.a;
    const list=`<div class="card"><h3>Conversations</h3><p class="lead">Safe questions get an instant AI reply. The rest wait here for an agent.</p>${L.length?`<ul class="list">${L.map(x=>`<li tabindex="0" data-a="sel" data-id="${esc(x.id)}" aria-selected="${x.id===sel}"><span class="tag ${st(x.status)[1]}">${st(x.status)[0]}</span>${x.unreadAdmin?`<span class="tag bad">${x.unreadAdmin} new</span>`:''}<b>${esc(x.name)}</b><small>${esc(((x.msgs[x.msgs.length-1]||{}).t||'').slice(0,60))}</small></li>`).join('')}</ul>`:'<p class="lead">No conversations yet. Open the customer app and send a message.</p>'}</div>`;
    const thr=c?`<div class="card"><h3>${esc(c.name)} <small style="color:var(--mute);font-weight:400">${fd(c.last)}</small></h3>
      <div class="thr" style="max-height:340px;overflow:auto">${c.msgs.map(m=>m.f==='sys'?`<div class="note">${esc(m.t)}</div>`:`<div class="bub ${m.f==='cu'?'cu':'ai'}">${esc(m.t)}${m.f==='cu'?'':`<small style="display:block;opacity:.7">${m.f==='ai'?'AI assistant':'Agent'}</small>`}</div>`).join('')}</div>
      <label for="rp">${c.status==='escalated'?'Holding reply (fraud team takes over)':'Reply to customer'}</label>
      <textarea id="rp" data-k="reply" rows="4">${esc(ui.reply||'')}</textarea>
      <button class="btn" data-a="send">Send reply</button>
      ${c.draft&&c.status!=='auto_sent'&&c.status!=='agent_sent'?'<button class="btn alt" data-a="draft">Use AI draft</button>':''}
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
  const vCus=()=>`<div class="card"><h3>Customers</h3><p class="lead">Everyone who opens the customer app appears here live. Freeze, adjust a balance, or delete.</p>${W.length?W.map(w=>`<div class="ar"><div class="g"><b>${esc(w.name)}</b> <span class="tag ${w.frozen?'bad':'ok'}">${w.frozen?'Frozen':'Active'}</span><small>${esc(w.id.slice(0,12))} · ${money(w.balance||0)}</small></div><button class="btn alt" data-a="frz" data-id="${esc(w.id)}">${w.frozen?'Unfreeze':'Freeze'}</button><button class="btn alt" data-a="adj" data-id="${esc(w.id)}">Balance</button><button class="btn alt" data-a="del" data-id="${esc(w.id)}">Delete</button></div>`).join(''):'<p class="lead">No customers yet.</p>'}</div>`;
  const vTxn=()=>{const L=T.slice().sort((a,b)=>b.ts-a.ts);return `<div class="card"><h3>Transactions</h3>${L.length?L.map(x=>`<div class="ar"><div class="g"><b>${esc(x.t)}</b><small>${esc(x.name)} · ${fd(x.ts)}</small></div><b class="${x.a>0?'pos':'neg'}">${x.a>0?'+':'−'}${money(Math.abs(x.a))}</b><button class="btn alt" data-a="rev" data-id="${esc(x.id)}">Reverse and delete</button></div>`).join(''):'<p class="lead">No transactions yet.</p>'}</div>`};
  const vFaq=()=>`<div class="g2"><div class="card"><h3>Add a common question</h3><p class="lead">When a customer asks it in chat, the assistant sends your answer.</p>
    <label for="fq">Question</label><input id="fq" data-k="fq" value="${esc(ui.fq||'')}">
    <label for="fv">Other ways customers ask it (one per line)</label><textarea id="fv" data-k="fv" rows="3">${esc(ui.fv||'')}</textarea>
    <label for="fa">Your answer</label><textarea id="fa" data-k="fa" rows="4">${esc(ui.fa||'')}</textarea>
    <label class="chk"><input type="checkbox" data-k="fauto" ${ui.fauto===false?'':'checked'}> Send automatically</label>
    <button class="btn" data-a="fadd">Save question</button><p class="lead" role="status" style="margin-top:8px">${esc(msg)}</p></div>
    <div class="card"><h3>Saved questions</h3>${faqs.length?faqs.map((f,i)=>`<div style="border:1px solid var(--line);border-radius:10px;padding:10px;margin-bottom:8px"><span class="tag ${f.auto?'ok':'warn'}">${f.auto?'Auto-reply':'Agent review'}</span><b>${esc(f.q)}</b><div style="color:var(--mute);font-size:13.5px;margin-top:4px">${esc(f.a.slice(0,110))}</div><button class="btn alt" style="margin-left:0" data-a="fdel" data-id="${i}">Delete</button></div>`).join(''):'<p class="lead">No saved questions yet.</p>'}</div></div>`;
  const vPol=()=>`<div class="card"><h3>Reply policies</h3><p class="lead">Each topic has an approved reply and a rule for who sends it. Replace the sample texts with upay-approved wording in the KB object of app.js.</p><table><thead><tr><th>Topic</th><th>Who replies</th><th>Route</th><th>Sample reply (English)</th></tr></thead><tbody>${Object.values(KB).map(k=>`<tr><td><b>${esc(k.label)}</b></td><td>${k.esc?'Specialist team':k.auto?'Assistant':'Agent approves'}</td><td>${esc(k.team)}</td><td>${esc(k.en({}))}</td></tr>`).join('')}</tbody></table><div class="note">Safety rules apply to every message: never ask for a PIN or OTP, mask phone numbers and secret codes, send fraud reports to the fraud team, and never promise a refund the system cannot guarantee.</div></div>`;
  const vAnn=()=>`<div class="card"><h3>Announcement</h3><p class="lead">Shown as a banner on every customer's home page.${note?' Current: <b>'+esc(note)+'</b>':''}</p><input data-k="ann" value="${esc(ui.ann||'')}" placeholder="e.g. Service paused tonight at 12:00"><button class="btn" data-a="sn">Publish</button><button class="btn alt" data-a="cn">Clear</button><p class="lead" role="status" style="margin-top:8px">${esc(msg)}</p></div>`;
  function vModal(){const w=W.find(x=>x.id===modal.id);if(!w)return'';const d=modal.type==='del';
    return `<div class="sheet on"><div class="panel"><h3>${esc(w.name)} — ${d?'delete?':'balance'}</h3>${d?'<p style="margin-bottom:12px">This removes the customer, their chat and all their transactions.</p>':`<input data-k="adjv" inputmode="numeric" placeholder="+500 or -200" value="${esc(ui.adjv||'')}">`}<button class="btn" data-a="mok">${d?'Yes, delete':'Update balance'}</button><button class="btn alt" data-a="mno">Cancel</button></div></div>`}

  function render(){
    const ae=document.activeElement,aid=ae&&ae.dataset&&ae.dataset.k,n=s=>C.filter(c=>c.status===s).length,tot=W.reduce((x,w)=>x+(w.balance||0),0);
    let h=`<header><div class="logo">u</div><div><h1 style="font-size:24px;margin:0">upay Admin Console</h1><p>Live chat, AI-assisted replies, customers and transactions in one place.</p></div><span class="tag info" style="margin-left:auto">Demo · local data</span></header>
    <div class="kpis">${[['Chats',C.length],['Auto-replied',n('auto_sent')],['Needs review',n('needs_review')],['Escalated',n('escalated')],['Customers',W.length],['Total balance',money(tot)]].map(([l,v])=>`<div class="kpi"><b>${v}</b><span>${l}</span></div>`).join('')}</div>
    <nav>${TABS.map(([i,l])=>`<button data-a="tab" data-v="${i}" aria-selected="${tab===i}">${l}</button>`).join('')}</nav>`;
    h+=({chat:vChat,cus:vCus,txn:vTxn,faq:vFaq,pol:vPol,ann:vAnn})[tab]();if(modal)h+=vModal();
    root.innerHTML=h;
    if(aid){const e=root.querySelector(`[data-k="${aid}"]`);if(e){e.focus();try{e.setSelectionRange(e.value.length,e.value.length)}catch(_){}}}
    const t=root.querySelector('.thr');if(t)t.scrollTop=t.scrollHeight;
  }
  root.addEventListener('input',e=>{const k=e.target.dataset&&e.target.dataset.k;if(k)ui[k]=e.target.type==='checkbox'?e.target.checked:e.target.value});
  root.addEventListener('click',async e=>{
    const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a,id=b.dataset.id;
    try{
      if(a==='tab'){tab=b.dataset.v;msg='';render()}
      else if(a==='sel'){sel=id;ui.reply='';const c=chatOf(id);if(c&&c.unreadAdmin)await cols.chats.doc(id).update({unreadAdmin:0});render()}
      else if(a==='draft'){ui.reply=chatOf(sel).draft;render()}
      else if(a==='send'){const c=chatOf(sel),t=(ui.reply||'').trim();if(!c||!t)return;ui.reply='';
        await cols.chats.doc(sel).update({msgs:[...c.msgs,{f:'ag',t,ts:Date.now()}],status:'agent_sent',last:Date.now(),unreadCust:(c.unreadCust||0)+1,audit:[...(c.audit||[]),'Agent approved reply '+ts()]})}
      else if(a==='esc'){const c=chatOf(sel);await cols.chats.doc(sel).update({status:'escalated',audit:[...(c.audit||[]),'Escalated to '+c.a.team+' '+ts()]})}
      else if(a==='frz'){const w=W.find(x=>x.id===id);await cols.wallets.doc(id).update({frozen:!w.frozen})}
      else if(a==='adj'||a==='del'){modal={type:a,id};ui.adjv='';render()}
      else if(a==='mno'){modal=null;render()}
      else if(a==='mok'){const w=W.find(x=>x.id===modal.id);
        if(modal.type==='adj'){const v=parseInt(ui.adjv);if(!v)return;const t='t'+Date.now();
          await cols.wallets.doc(w.id).update({balance:(w.balance||0)+v});await cols.txs.doc(t).set({id:t,uid:w.id,name:w.name,t:'Admin adjustment',a:v,ts:Date.now()})}
        else{for(const x of T.filter(x=>x.uid===w.id))await cols.txs.doc(x.id).delete();await cols.chats.doc(w.id).delete();await cols.wallets.doc(w.id).delete()}
        modal=null;render()}
      else if(a==='rev'){const x=T.find(t=>t.id===id),w=x&&W.find(q=>q.id===x.uid);if(w)await cols.wallets.doc(w.id).update({balance:(w.balance||0)-x.a});await cols.txs.doc(id).delete()}
      else if(a==='fadd'){const q=(ui.fq||'').trim(),an=(ui.fa||'').trim();if(!q||!an){msg='Write both the question and the answer.';render();return}
        await fqd.set({list:[...faqs,{q,alt:(ui.fv||'').split('\n').map(x=>x.trim()).filter(Boolean),a:an,auto:ui.fauto!==false}]});ui.fq=ui.fv=ui.fa='';msg='Saved. Customers who ask this now get your answer.';render()}
      else if(a==='fdel'){await fqd.set({list:faqs.filter((_,i)=>i!==+id)})}
      else if(a==='sn'){const v=(ui.ann||'').trim();if(v){await cfg.set({text:v,ts:Date.now()});msg='Published.';render()}}
      else if(a==='cn'){await cfg.set({text:'',ts:Date.now()});ui.ann='';msg='Cleared.';render()}
    }catch(err){console.error(err);msg='Something went wrong. Try again.';render()}
  });
  (async()=>{
    const db=window.claude&&await claude.use('db');if(!db){root.textContent='Storage is not available in this browser.';return}
    cols={wallets:db.collection('wallets'),txs:db.collection('txs'),chats:db.collection('chats')};cfg=db.doc('config/app');fqd=db.doc('config/faqs');
    cols.wallets.onSnapshot(q=>{W=q.docs.map(d=>({id:d.id,...d.data()}));render()});
    cols.txs.onSnapshot(q=>{T=q.docs.map(d=>d.data());render()});
    cols.chats.onSnapshot(q=>{C=q.docs.map(d=>({id:d.id,...d.data()}));render()});
    cfg.onSnapshot(d=>{note=(d.data()||{}).text||'';render()});
    fqd.onSnapshot(d=>{faqs=((d.data()||{}).list)||[];render()});
    render();
  })();
}

/* ---------- Boot ---------- */
(document.body.classList.contains("admin")?initAdmin:initCustomer)();
