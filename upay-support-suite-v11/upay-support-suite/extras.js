/* extras.js - friendliness extras that need no backend: first-time tour, safety tips, text size, install-as-app (PWA) */
(function(){
const $=s=>document.querySelector(s),LS={g:k=>{try{return localStorage.getItem(k)||''}catch(e){return ''}},s:(k,v)=>{try{localStorage.setItem(k,v)}catch(e){}}};
if(!document.body.classList.contains('admin')){
 /* text size: normal / large / extra large */
 const sizes=[1,1.12,1.25],names=[['সাধারণ','Normal'],['বড়','Large'],['অনেক বড়','Extra large']];let fi=+LS.g('upay_fs')||0;
 const app=$('#app'),fsApply=()=>{app.style.zoom=sizes[fi]};fsApply();
 /* install as an app */
 let dip=null;window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();dip=e});
 const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone;
 const rows=`<div class="row" id="fsRow"><span class="mi">🔠</span><div class="g">${L('লেখার সাইজ','Text size')}<small id="fsVal"></small></div><i class="chev">›</i></div>${standalone?'':`<div class="row" id="insRow"><span class="mi">📲</span><div class="g">${L('অ্যাপ হিসেবে ইনস্টল করুন','Install as an app')}<small>${L('হোম স্ক্রিনে আইকন, ব্রাউজার ছাড়াই খোলে','Home-screen icon, opens without the browser')}</small></div><i class="chev">›</i></div>`}`;
 $('#langRow').insertAdjacentHTML('afterend',rows);
 const fsPaint=()=>{$('#fsVal').textContent=L(names[fi][0],names[fi][1])};fsPaint();
 $('#fsRow').onclick=()=>{fi=(fi+1)%3;LS.s('upay_fs',fi);fsApply();fsPaint()};
 const ins=$('#insRow');if(ins)ins.onclick=async()=>{if(dip){dip.prompt();dip=null}else alert(L('ব্রাউজারের মেনু থেকে "Add to Home screen" বা "Install app" চাপুন','Use your browser menu: "Add to Home screen" / "Install app"'))};
 /* rotating safety tips on the home page */
 const tips=[['🔒 কেউ আপনার পিন বা OTP চাইলে কখনো দেবেন না, upay কখনো চায় না।','🔒 Never share your PIN or OTP. upay will never ask for it.'],['📞 "টাকা পাঠিয়েছি, ফেরত দিন" বলে ফোন এলে আগে ব্যালেন্স দেখুন।','📞 If someone says "I sent money by mistake", check your balance first.'],['⭐ প্রিয় নম্বর ⭐ দিয়ে রাখলে এক ট্যাপে টাকা পাঠানো যায়।','⭐ Star a number to send money in one tap.'],['🧾 হিস্টরিতে যেকোনো লেনদেন চাপলে রসিদ শেয়ার করা যায়।','🧾 Tap any transaction in History to share a receipt.']];
 $('#g1').insertAdjacentHTML('beforebegin','<div class="tip" id="tip"></div>');let ti=0;const tp=()=>{$('#tip').textContent=L(tips[ti][0],tips[ti][1]);ti=(ti+1)%tips.length};tp();setInterval(tp,7000);
 /* first-time tour (not shown for ?u= demo users) */
 window.upayTour=function(){if(LS.g('upay_tour')==='1'||new URLSearchParams(location.search).get('u'))return;
  const S=[['👋','স্বাগতম!','Welcome!','টাকা পাঠান, ক্যাশ আউট করুন, বিল দিন, সব এক জায়গায়।','Send money, cash out and pay bills, all in one place.'],['🔒','আপনার টাকা নিরাপদ','Your money is safe','প্রতিটি পেমেন্টে আপনার ৪ ডিজিটের পিন লাগে। পিন কাউকে বলবেন না।','Every payment needs your 4-digit PIN. Never tell it to anyone.'],['⭐','এক ট্যাপে পাঠান','Send in one tap','প্রিয় নম্বরে ⭐ দিন, আর হিস্টরি থেকে রসিদ শেয়ার করুন।','Star a number, and share receipts from History.']];let i=0;
  const o=document.createElement('div');o.id='tour';document.body.appendChild(o);
  const draw=()=>{const s=S[i];o.innerHTML=`<div class="tc"><div class="te">${s[0]}</div><h2>${L(s[1],s[2])}</h2><p>${L(s[3],s[4])}</p><div class="td">${S.map((_,k)=>`<i class="${k==i?'on':''}"></i>`).join('')}</div><button class="btn" id="tn">${i==S.length-1?L('শুরু করুন','Get started'):L('পরবর্তী','Next')}</button>${i<S.length-1?`<button class="lnk" id="ts">${L('এড়িয়ে যান','Skip')}</button>`:''}</div>`;
   const end=()=>{LS.s('upay_tour','1');o.remove()};$('#tn').onclick=()=>{if(i==S.length-1)end();else{i++;draw()}};const sk=$('#ts');if(sk)sk.onclick=end};draw()};
 if('serviceWorker' in navigator&&location.protocol!=='file:')navigator.serviceWorker.register('sw.js').catch(()=>{});
}})();
