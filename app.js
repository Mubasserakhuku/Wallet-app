const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const bn=n=>String(n).replace(/\d/g,d=>'০১২৩৪৫৬৭৮৯'[d]);
const money=n=>'৳ '+bn(n.toLocaleString('en-US'));
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
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fd=ts=>new Date(ts).toLocaleString('bn-BD',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});
let sync=null,uid=null,frozen=false,isAdm=false,admOn=false,admTab='u',allW=[],allT=[],lastNote=0;
async function commit(t,a){
  if(frozen){toast('আপনার অ্যাকাউন্ট ফ্রিজ করা আছে');return false}
  if(!sync){balance+=a;tx.unshift({t,d:'এইমাত্র',a,k:a>0?'in':'out'});paintBal();paintHis();return true}
  try{const id='t'+Date.now()+Math.random().toString(36).slice(2,6);
    await sync.wallets.doc(uid).update({balance:balance+a});
    await sync.txs.doc(id).set({id,uid,name:$('#uname').textContent,t,a,ts:Date.now()});return true}
  catch(e){toast('সমস্যা হয়েছে, আবার চেষ্টা করুন');return false}
}
(async()=>{try{
  if(!window.claude)return;
  const [db,user]=await Promise.all([claude.use('db'),claude.use('user')]);
  if(!db||!user)return;
  uid=await user.id();const me=await user.me();isAdm=await user.canEdit();
  sync={wallets:db.collection('wallets'),txs:db.collection('txs'),cfg:db.doc('config/app')};
  const ref=sync.wallets.doc(uid);
  if(!(await ref.get()).exists)await ref.set({name:me.name||'গ্রাহক',balance:12500,frozen:false,createdAt:Date.now()});
  ref.onSnapshot(d=>{const w=d.data();if(!w)return;balance=w.balance||0;frozen=!!w.frozen;
    $('#uname').textContent=w.name;$('.av').textContent=(w.name||'গ')[0];paintBal();
    if(frozen)toast('আপনার অ্যাকাউন্ট ফ্রিজ করা হয়েছে')});
  sync.txs.where('uid','==',uid).onSnapshot(q=>{tx=q.docs.map(d=>d.data()).sort((a,b)=>b.ts-a.ts).map(x=>({...x,d:fd(x.ts),k:x.a>0?'in':'out'}));paintHis()});
  sync.cfg.onSnapshot(d=>{const c=d.data();const n=$('#note');
    if(c&&c.text){n.style.display='block';n.textContent='📢 '+c.text;if(c.ts>lastNote&&lastNote)toast('নতুন ঘোষণা');lastNote=c.ts}else n.style.display='none'});
  if(isAdm)$('#admRow').style.display='flex';
}catch(e){console.error(e)}})();

function admOpen(){$('#adm').style.display='block';
  if(!admOn){admOn=true;
    sync.wallets.onSnapshot(q=>{allW=q.docs.map(d=>({id:d.id,...d.data()}));admRender()});
    sync.txs.onSnapshot(q=>{allT=q.docs.map(d=>d.data());admRender()})}
  admRender()}
function admRender(){
  const T=allT.slice().sort((a,b)=>b.ts-a.ts);
  const tot=allW.reduce((n,w)=>n+(w.balance||0),0),vol=T.reduce((n,x)=>n+Math.abs(x.a),0),fz=allW.filter(w=>w.frozen).length;
  $('#admSt').innerHTML=[['গ্রাহক',bn(allW.length)],['মোট ব্যালেন্স',money(tot)],['লেনদেন',bn(T.length)],['মোট ভলিউম',money(vol)],['ফ্রিজড',bn(fz)]].map(([a,b])=>`<div><small>${a}</small><b>${b}</b></div>`).join('');
  $$('#adm [data-a=tab]').forEach(c=>c.classList.toggle('on',c.dataset.v==admTab));
  let h='';
  if(admTab=='u')h=allW.length?allW.map(w=>`<div class="ar"><div class="g"><b>${esc(w.name)}</b><span class="bd ${w.frozen?'fz':''}">${w.frozen?'ফ্রিজড':'সক্রিয়'}</span><small>${esc(w.id.slice(0,10))} · ${money(w.balance||0)}</small></div>
    <button class="mini" data-a="frz" data-id="${esc(w.id)}">${w.frozen?'আনফ্রিজ':'ফ্রিজ'}</button><button class="mini" data-a="adj" data-id="${esc(w.id)}">ব্যালেন্স</button><button class="mini rd" data-a="del" data-id="${esc(w.id)}">মুছুন</button></div>`).join(''):'<div class="pad">এখনো কোনো গ্রাহক নেই</div>';
  if(admTab=='t')h=T.length?T.map(x=>`<div class="ar"><div class="g"><b>${esc(x.t)}</b><small>${esc(x.name)} · ${fd(x.ts)}</small></div><span class="${x.a>0?'pos':'neg'}">${x.a>0?'+':'−'}${money(Math.abs(x.a))}</span><button class="mini rd" data-a="rev" data-id="${esc(x.id)}">রিভার্স ও মুছুন</button></div>`).join(''):'<div class="pad">কোনো লেনদেন নেই</div>';
  if(admTab=='n')h=`<div class="pad"><p style="margin-bottom:8px">সব গ্রাহকের হোম পেজে দেখাবে:</p><input id="nt" style="width:100%;padding:12px;border:1px solid var(--line);border-radius:10px;font:inherit;background:var(--bg);color:var(--ink);margin-bottom:10px" placeholder="যেমন: আজ রাত ১২টায় সার্ভিস বন্ধ থাকবে"><button class="mini" data-a="sn" style="background:var(--blue);color:#fff">প্রকাশ করুন</button> <button class="mini" data-a="cn">মুছে দিন</button></div>`;
  const keep=$('#nt')&&$('#nt').value;$('#admBody').innerHTML=h;if(keep&&$('#nt'))$('#nt').value=keep;
}
$('#admRow').onclick=admOpen;
$('#adm').onclick=async e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a,id=b.dataset.id,w=allW.find(x=>x.id==id);
  try{
  if(a=='x')$('#adm').style.display='none';
  if(a=='tab'){admTab=b.dataset.v;admRender()}
  if(a=='frz'&&w){await sync.wallets.doc(id).update({frozen:!w.frozen});toast(w.frozen?'আনফ্রিজ করা হয়েছে':'ফ্রিজ করা হয়েছে')}
  if(a=='adj'&&w){open(`<h3>${esc(w.name)} — ব্যালেন্স</h3><input id="f1" inputmode="numeric" placeholder="+৫০০ বা -২০০ (ইংরেজি সংখ্যা)"><button class="btn" id="ok">আপডেট করুন</button><button class="btn alt" id="no">বাতিল</button>`);
    $('#no').onclick=close;$('#ok').onclick=async()=>{const v=parseInt($('#f1').value);if(!v){toast('সঠিক সংখ্যা দিন');return}
      const t='t'+Date.now();await sync.wallets.doc(id).update({balance:(w.balance||0)+v});await sync.txs.doc(t).set({id:t,uid:id,name:w.name,t:'অ্যাডমিন অ্যাডজাস্ট',a:v,ts:Date.now()});close();toast('ব্যালেন্স আপডেট হয়েছে')}}
  if(a=='del'&&w){open(`<h3>${esc(w.name)} মুছবেন?</h3><p style="margin-bottom:12px">গ্রাহক ও তার সব লেনদেন মুছে যাবে।</p><button class="btn" id="ok" style="background:#d23a3a">হ্যাঁ, মুছুন</button><button class="btn alt" id="no">বাতিল</button>`);
    $('#no').onclick=close;$('#ok').onclick=async()=>{for(const x of allT.filter(x=>x.uid==id))await sync.txs.doc(x.id).delete();await sync.wallets.doc(id).delete();close();toast('মুছে ফেলা হয়েছে')}}
  if(a=='rev'){const x=allT.find(t=>t.id==id),ow=x&&allW.find(q=>q.id==x.uid);if(ow)await sync.wallets.doc(ow.id).update({balance:(ow.balance||0)-x.a});await sync.txs.doc(id).delete();toast('রিভার্স হয়েছে')}
  if(a=='sn'){const v=$('#nt').value.trim();if(v){await sync.cfg.set({text:v,ts:Date.now()});toast('ঘোষণা প্রকাশিত')}}
  if(a=='cn'){await sync.cfg.set({text:'',ts:Date.now()});toast('ঘোষণা মুছেছে')}
  }catch(err){toast('অনুমতি নেই বা সমস্যা হয়েছে')}};
paintBal();paintHis();
