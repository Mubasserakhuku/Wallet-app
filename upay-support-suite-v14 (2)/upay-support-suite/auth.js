/* auth.js - login / sign-up in front of the customer app.
   Existing customer: mobile number + 4-digit PIN. New customer: name, number, NID, birth date, then a 4-digit PIN.
   Backend mode (UPAY_API="") calls /api/auth/login and /api/auth/register. Browser demo mode keeps accounts in localStorage (demo grade).
   Sign-up and (new device / server-required) login also ask for an SMS one-time code. There is no SMS gateway in the demo, so the code is shown
   on screen inside a simulated SMS bubble. With a real gateway (backend UPAY_SMS_WEBHOOK) the bubble is not shown.
   ?u=rahim in the URL skips the login (used by the demo tools and tests) but only while DEMO is true. */
(function(){
const $=s=>document.querySelector(s),LS={g:k=>{try{return localStorage.getItem(k)||''}catch(e){return ''}},s:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}},d:k=>{try{localStorage.removeItem(k)}catch(e){}}};
const ph11=v=>/^01\d{9}$/.test(v),pinH=(uid,s)=>{let x=5381;for(const c of 'upay|'+uid+'|'+s)x=((x<<5)+x+c.charCodeAt(0))>>>0;return x.toString(36)};
const accts=()=>{try{return JSON.parse(LS.g('upay_accts')||'{}')}catch(e){return{}}};
window.authLogout=()=>{LS.d('upay_sess');LS.d('upay_tok');location.href=location.pathname};
window.authGate=function(start){
 if(DEMO&&new URLSearchParams(location.search).get('u')){start();return}
 const sess=LS.g('upay_sess'),tok=LS.g('upay_tok');
 if(sess&&(!API.on||tok)){if(API.on){window.UPAY_TOKEN=tok;window.UPAY_UID=sess}else LS.s('upay_uid',sess);start();return}
 const A=$('#auth');A.classList.add('on');
 const head=`<div class="ah"><b>upay 2.0</b><small>${L('আপনার ডিজিটাল ওয়ালেট','Your digital wallet')}</small>${DEMO?`<span class="demoTag">DEMO · ${L('নমুনা ডেটা, আসল টাকা নয়','sample data, no real money')}</span>`:''}</div>`;
 const err=m=>{$('#aerr').textContent=m};
 const emsg=e=>e&&e.code==='pin_locked'?L('অনেকবার ভুল হয়েছে, কিছুক্ষণ পরে চেষ্টা করুন','Too many wrong tries, try again later'):e&&e.code==='pin_wrong'?L('নম্বর বা পিন ভুল','Wrong number or PIN'):e&&e.code==='conflict'?L('এই নম্বর বা NID দিয়ে অ্যাকাউন্ট আছে','An account with this number or NID already exists'):e&&(e.code==='otp_invalid'||e.code==='otp_locked'||e.code==='bad_referral'||e.code==='rate_limited')?apiMsg(e):(e&&e.message)||L('সমস্যা হয়েছে, আবার চেষ্টা করুন','Something went wrong, try again');
 const pad=(ins,ok)=>{const mx=i=>i.maxLength>0?i.maxLength:4;let cur=ins[0];const mark=()=>ins.forEach(i=>i.classList.toggle('kpa',i===cur));
  ins.forEach(i=>{const set=()=>{cur=i;mark()};i.onfocus=set;i.onclick=set;i.oninput=()=>{i.value=i.value.replace(/\D/g,'')}});mark();
  const d=document.createElement('div');d.className='kp';d.innerHTML=[1,2,3,4,5,6,7,8,9,'⌫',0,'✓'].map(k=>`<button type="button" data-k="${k}">${k}</button>`).join('');
  d.onclick=e=>{const bt=e.target.closest('button'),k=bt&&bt.dataset.k;if(k===undefined)return;if(k==='✓')return ok();
   if(k==='⌫')cur.value=cur.value.slice(0,-1);
   else{if(cur.value.length>=mx(cur)){const n=ins.find(i=>i.value.length<mx(i));if(n){cur=n;mark()}else return}cur.value+=k;if(cur.value.length>=mx(cur)){const n=ins.find(i=>i.value.length<mx(i));if(n){cur=n;mark()}}}};
  return d};
 const enter=(uid,tok,phone)=>{LS.s('upay_sess',uid);LS.s('upay_lastph',phone);if(API.on){LS.s('upay_tok',tok);window.UPAY_TOKEN=tok;window.UPAY_UID=uid}else LS.s('upay_uid',uid);A.classList.remove('on');A.innerHTML='';start()};
 /* SMS one-time code screen. done(token) is called when the code is right. Back goes to the previous screen. */
 function otp(phone,purpose,done,back){
  let code='',exp=0,tries=0,sentAt=0,timer=null;
  const sms=c=>{$('#asms').innerHTML=c?`<div class="sms"><small>📩 SMS · upay</small>${L('আপনার upay 2.0 কোড','Your upay 2.0 code is')} <b>${c}</b>. ${L('এটি কাউকে দেবেন না।','Never share it with anyone.')}<small class="sdemo">${L('ডেমো: আসল SMS পাঠানো হয় না, তাই কোড এখানে দেখানো হলো','Demo: no real SMS is sent, so the code is shown here')}</small></div>`:`<p class="ahint">${L('কোড পাঠানো হয়েছে। SMS দেখুন।','The code was sent. Check your SMS.')}</p>`};
  const tick=()=>{const b=$('#ars');if(!b){clearInterval(timer);return}const w=Math.max(0,Math.ceil((sentAt+3e4-Date.now())/1e3));b.disabled=w>0;b.textContent=w>0?L('আবার পাঠান ('+w+' সেকেন্ড)','Resend code ('+w+' s)'):L('আবার কোড পাঠান','Resend code')};
  const send=async()=>{err('');
   if(API.on){try{const r=await API.post('/api/auth/otp/send',{phone,purpose});sentAt=Date.now();sms(r.demo_code||'');}catch(e){err(emsg(e));sentAt=Date.now()-2e4;return}}
   else{code=String(Math.floor(Math.random()*1e6)).padStart(6,'0');exp=Date.now()+3e5;tries=0;sentAt=Date.now();sms(code)}
   clearInterval(timer);timer=setInterval(tick,500);tick()};
  A.innerHTML=head+`<div class="abody"><h2>${L('নম্বর যাচাই করুন','Verify your number')}</h2><p class="lead2">${L('৬ ডিজিটের কোড পাঠানো হয়েছে ','We sent a 6-digit code to ')}<b>${phone}</b></p><div id="asms"></div><label>${L('৬ ডিজিটের কোড','6-digit code')}</label><input id="aot" class="sin otpin" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="••••••"><div id="aerr" class="aerr"></div><button class="btn" id="aov">${L('যাচাই করুন','Verify')}</button><button class="btn alt" id="ars" disabled></button><button class="btn alt" id="abk">${L('ফিরে যান','Back')}</button></div>`;
  const go=()=>once(async()=>{const c=$('#aot').value.trim();if(!/^\d{6}$/.test(c))return err(L('৬ সংখ্যার কোড দিন','Enter the 6-digit code'));
   if(API.on){try{const r=await API.post('/api/auth/otp/verify',{phone,purpose,code:c});clearInterval(timer);done(r.otp_token)}catch(e){$('#aot').value='';err(emsg(e))}return}
   if(Date.now()>exp){return err(L('কোডের মেয়াদ শেষ, নতুন কোড নিন','The code has expired, ask for a new one'))}
   if(tries>=5)return err(L('অনেকবার ভুল কোড। নতুন কোড নিন','Too many wrong codes. Ask for a new one'));
   if(c!==code){tries++;$('#aot').value='';return err(L('কোড ভুল (বাকি '+(5-tries)+' বার)','Wrong code ('+(5-tries)+' tries left)'))}
   clearInterval(timer);done('local')});
  $('#aov').onclick=go;$('#ars').onclick=send;$('#abk').onclick=()=>{clearInterval(timer);back()};
  $('#aot').closest('.abody').insertBefore(pad([$('#aot')],go),$('#aerr'));send()}
 let busy=false;const once=async f=>{if(busy)return;busy=true;try{await f()}finally{busy=false}};
 function login(){A.innerHTML=head+`<div class="abody"><h2>${L('লগইন','Log in')}</h2><label>${L('মোবাইল নম্বর','Mobile number')}</label><input id="aph" class="sin" inputmode="numeric" maxlength="11" value="${LS.g('upay_lastph')}" placeholder="01XXXXXXXXX"><label>${L('৪ ডিজিটের পিন','4-digit PIN')}</label><input id="apn" class="pinp" type="password" inputmode="none" maxlength="4" autocomplete="off"><div id="aerr" class="aerr"></div><button class="btn" id="aok">${L('লগইন','Log in')}</button><button class="btn alt" id="anew">${L('নতুন অ্যাকাউন্ট খুলুন','Create a new account')}</button><p class="ahint">${L('ফোন হারিয়েছে? অন্য ফোনে নম্বর ও পিন দিয়ে লগইন করে আরো > "ফোন হারিয়েছে? ফ্রিজ করুন" চাপুন।','Lost your phone? Log in on another phone with your number and PIN, then tap More > "Lost your phone? Freeze".')}</p></div>`;
  const go=()=>once(async()=>{const p=$('#aph').value.trim(),n=$('#apn').value;if(!ph11(p))return err(L('১১ সংখ্যার মোবাইল নম্বর দিন','Enter an 11-digit mobile number'));if(!/^\d{4}$/.test(n))return err(L('৪ সংখ্যার পিন দিন','Enter your 4-digit PIN'));
   if(API.on){const tryLogin=async tok=>{try{const r=await API.post('/api/auth/login',{phone:p,pin:n,otp_token:tok||''});enter(r.wallet.uid,r.token,p)}catch(e){if(e&&e.code==='otp_required'&&!tok)otp(p,'login',t=>once(()=>tryLogin(t)),login);else err(emsg(e))}};await tryLogin();return}
   const lk=JSON.parse(LS.g('upay_lk_'+p)||'{"n":0,"u":0}');if(lk.u>Date.now())return err(L('অনেকবার ভুল হয়েছে, ১ মিনিট পরে চেষ্টা করুন','Too many wrong tries, wait 1 minute'));
   const a=accts()[p];if(!a||a.h!==pinH(a.uid,n)){lk.n++;if(lk.n>=3){lk.n=0;lk.u=Date.now()+6e4}LS.s('upay_lk_'+p,JSON.stringify(lk));$('#apn').value='';return err(L('নম্বর বা পিন ভুল','Wrong number or PIN'))}
   LS.d('upay_lk_'+p);const fin=()=>{LS.s('upay_td_'+p,'1');enter(a.uid,'',p)};if(LS.g('upay_td_'+p))fin();else otp(p,'login',fin,login)});
  $('#aok').onclick=go;$('#anew').onclick=reg1;$('#apn').closest('.abody').insertBefore(pad([$('#aph'),$('#apn')],go),$('#aerr'))}
 function reg1(v={}){A.innerHTML=head+`<div class="abody"><h2>${L('নতুন অ্যাকাউন্ট','New account')}</h2><label>${L('পুরো নাম','Full name')}</label><input id="rn" class="sin" value="${v.n||''}" maxlength="80"><label>${L('মোবাইল নম্বর','Mobile number')}</label><input id="rp" class="sin" inputmode="numeric" maxlength="11" value="${v.p||''}" placeholder="01XXXXXXXXX"><label>${L('NID কার্ড নম্বর','NID card number')}</label><input id="ri" class="sin" inputmode="numeric" maxlength="17" value="${v.i||''}" placeholder="${L('১০, ১৩ বা ১৭ সংখ্যা','10, 13 or 17 digits')}"><label>${L('জন্ম তারিখ','Date of birth')}</label><input id="rd" class="sin" type="date" max="${new Date().toISOString().slice(0,10)}" value="${v.d||''}"><label>${L('রেফার কোড (ঐচ্ছিক) · দুজনেই ৳৫০ পাবেন','Referral code (optional) · you both get ৳50')}</label><input id="rr" class="sin" maxlength="11" value="${v.r||new URLSearchParams(location.search).get('ref')||''}" placeholder="UP…"><div id="aerr" class="aerr"></div><button class="btn" id="rnx">${L('পরবর্তী','Next')}</button><button class="btn alt" id="rbk">${L('আগে থেকেই অ্যাকাউন্ট আছে? লগইন','Already have an account? Log in')}</button></div>`;
  $('#rbk').onclick=login;$('#rnx').onclick=()=>{const n=$('#rn').value.trim(),p=$('#rp').value.trim(),i=$('#ri').value.trim(),d=$('#rd').value,dt=new Date(d),r=(($('#rr')||{}).value||'').trim().toUpperCase();
   if(n.length<2)return err(L('নাম লিখুন','Enter your name'));if(!ph11(p))return err(L('১১ সংখ্যার মোবাইল নম্বর দিন','Enter an 11-digit mobile number'));if(!/^(\d{10}|\d{13}|\d{17})$/.test(i))return err(L('NID নম্বর ১০, ১৩ বা ১৭ সংখ্যার হতে হবে','NID must be 10, 13 or 17 digits'));
   if(!d||isNaN(dt)||dt>new Date()||dt.getFullYear()<1900)return err(L('সঠিক জন্ম তারিখ দিন','Enter a valid birth date'));if(!API.on&&accts()[p])return err(L('এই নম্বরে অ্যাকাউন্ট আছে','An account with this number already exists'));if(r&&!/^UP\d{9}$/.test(r))return err(L('রেফার কোড ঠিক নেই (UP দিয়ে শুরু, ১১ অক্ষর)','Referral code looks wrong (UP + 9 digits)'));if(r&&r==='UP'+p.slice(2))return err(L('নিজের কোড ব্যবহার করা যাবে না','You cannot use your own code'));const v2={n,p,i,d,r};otp(p,'register',tok=>reg2({...v2,tok}),()=>reg1(v2))}}
 function reg2(v){A.innerHTML=head+`<div class="abody"><h2>${L('৪ ডিজিটের পিন সেট করুন','Set a 4-digit PIN')}</h2><label>${L('পিন','PIN')}</label><input id="q1" class="pinp" type="password" inputmode="none" maxlength="4" autocomplete="off"><label>${L('পিন আবার দিন','Repeat PIN')}</label><input id="q2" class="pinp" type="password" inputmode="none" maxlength="4" autocomplete="off"><div id="aerr" class="aerr"></div><button class="btn" id="rok">${L('অ্যাকাউন্ট খুলুন','Create account')}</button><button class="btn alt" id="rbk">${L('ফিরে যান','Back')}</button></div>`;
  const go=()=>once(async()=>{const a=$('#q1').value,b=$('#q2').value;if(!/^\d{4}$/.test(a))return err(L('৪ সংখ্যার পিন দিন','Enter a 4-digit PIN'));if(a!==b){$('#q2').value='';return err(L('পিন মেলেনি','PINs do not match'))}
   if(API.on){try{const r=await API.post('/api/auth/register',{name:v.n,phone:v.p,nid:v.i,dob:v.d,pin:a,ref:v.r||'',otp_token:v.tok||''});window.UPAY_BONUS=Number(r.wallet.referral_bonus)||0;enter(r.wallet.uid,r.token,v.p)}catch(e){if(e&&e.code==='bad_referral'){reg1(v);err(emsg(e))}else if(e&&(e.code==='otp_required')){reg1(v);err(emsg(e))}else err(emsg(e))}return}
   const uid='c'+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-3),h=pinH(uid,a),all=accts();all[v.p]={uid,h,n:v.n,nid4:v.i.slice(-4),dob:v.d};LS.s('upay_accts',JSON.stringify(all));
   window.UPAY_REG={name:v.n,phone:v.p,pinH:h,nid4:v.i.slice(-4),dob:v.d,ref:v.r||''};LS.s('upay_td_'+v.p,'1');enter(uid,'',v.p)});
  $('#rok').onclick=go;$('#rbk').onclick=()=>reg1(v);$('#q1').closest('.abody').insertBefore(pad([$('#q1'),$('#q2')],go),$('#aerr'))}
 login()};
})();
