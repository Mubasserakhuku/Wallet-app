/* api.js - talks to the FastAPI + PostgreSQL backend.
   Backend mode is ON when config.js sets window.UPAY_API to a string ("" = same origin). With window.UPAY_API=null the app
   keeps using browser storage (offline demo). In backend mode the server decides fees, limits, PIN, student status and balances. */
const DEMO=window.UPAY_DEMO!==false; /* false only when the server runs with UPAY_DEMO_MODE=0 */
const API={on:typeof window.UPAY_API==='string',base:typeof window.UPAY_API==='string'?window.UPAY_API:'',token:null,adminKey:null};
const KINDS={send:'সেন্ড মানি',receive:'রিসিভ মানি',cashout:'ক্যাশ আউট',recharge:'মোবাইল রিচার্জ',bill:'পে বিল',payment:'মেক পেমেন্ট',fund:'ফান্ড ট্রান্সফার',add:'অ্যাড মানি',split:'বিল স্প্লিট',auto_send:'অটো সেন্ড মানি',admin:'Admin adjustment'};
const SERVICE_OF={'সেন্ড মানি':'send','মোবাইল রিচার্জ':'recharge','ক্যাশ আউট':'cashout','পে বিল':'bill','মেক পেমেন্ট':'payment','ফান্ড ট্রান্সফার':'fund'};

API.req=async(method,path,body,extra)=>{
  const h={'Content-Type':'application/json',...(extra||{})};
  if(API.token)h.Authorization='Bearer '+API.token;
  if(API.adminKey)h['X-Admin-Key']=API.adminKey;
  let r;try{r=await fetch(API.base+path,{method,headers:h,body:body===undefined?undefined:JSON.stringify(body)})}
  catch(e){const x=new Error('network');x.code='network';throw x}
  let d={};try{d=await r.json()}catch(e){}
  if(!r.ok){const x=new Error(d.message||d.error||('HTTP '+r.status));x.code=d.error||('http_'+r.status);x.data=d;x.status=r.status;throw x}
  return d};
API.get=p=>API.req('GET',p);
API.post=(p,b,h)=>API.req('POST',p,b===undefined?{}:b,h);
API.del=p=>API.req('DELETE',p);

/* readable, bilingual message for any server error */
function apiMsg(e){
  const d=(e&&e.data)||{},c=e&&e.code;
  const m={insufficient:['ব্যালেন্স পর্যাপ্ত নয়','Insufficient balance'],frozen:['আপনার অ্যাকাউন্ট ফ্রিজ করা আছে','Your account is frozen'],
   limit_daily:['দৈনিক লিমিট পার হয়ে যাবে','Daily limit would be exceeded'],limit_monthly:['মাসিক লিমিট পার হয়ে যাবে','Monthly limit would be exceeded'],
   pin_required:['আগে PIN সেট করুন','Set a PIN first'],pin_wrong:['PIN ভুল'+(d.attempts_left!==undefined?' (বাকি '+bn(d.attempts_left)+' বার)':''),'Wrong PIN'+(d.attempts_left!==undefined?' ('+d.attempts_left+' tries left)':'')],
   pin_locked:['অনেকবার ভুল PIN। '+bn(Math.ceil((d.retry_after_ms||6e4)/1000))+' সেকেন্ড পরে চেষ্টা করুন','Too many wrong PINs. Try again in '+Math.ceil((d.retry_after_ms||6e4)/1000)+' s'],
   bad_pin_format:['৪ সংখ্যার PIN দিন','Enter a 4-digit PIN'],recipient_not_found:['এই নম্বর upay 2.0-তে পাওয়া যায়নি','This number is not on upay'],
   self_send:['নিজের নম্বরে পাঠানো যাবে না','You cannot send to your own number'],not_student:['ভেরিফাইড স্টুডেন্ট অ্যাকাউন্ট লাগবে','A verified student account is needed'],
   bucket_not_found:['এই ক্যাটাগরি পাওয়া যায়নি','Bucket not found'],undo_expired:['বাতিল করার সময় শেষ','The cancel window has closed'],
   undo_limit:['আজ আর বাতিল করা যাবে না। সমস্যা হলে সাপোর্টে জানান','Cancel limit reached for today. Please contact support'],
   recipient_spent:['প্রাপক টাকা খরচ করে ফেলেছেন, বাতিল সম্ভব নয়','Recipient already spent it, cannot cancel'],already_undone:['আগেই বাতিল হয়েছে','Already cancelled'],
   bad_amount:['সঠিক পরিমাণ দিন','Enter a valid amount'],bad_phone:['সঠিক মোবাইল নম্বর দিন','Enter a valid mobile number'],rate_limited:['একটু পরে চেষ্টা করুন','Too many requests, slow down'],
   unauthorized:['আবার সাইন ইন করুন','Please sign in again'],network:['সার্ভারের সাথে যোগাযোগ হচ্ছে না','Cannot reach the server'],conflict:['এখন সম্ভব নয়, আবার চেষ্টা করুন','Not possible right now, try again'],
   provider_failed:['এখন সম্পন্ন করা যাচ্ছে না, আপনার টাকা কাটা হয়নি','Could not complete this right now. You were not charged'],
   bad_account:['অ্যাকাউন্ট / মিটার নম্বর ৬ থেকে ২০ অক্ষর বা সংখ্যার হতে হবে','Account / meter number must be 6 to 20 letters or digits'],
   bad_referral:['রেফার কোড ঠিক নেই','Referral code is not valid'],
   otp_invalid:['কোড ভুল বা মেয়াদ শেষ'+(d.attempts_left!==undefined?' (বাকি '+bn(d.attempts_left)+' বার)':''),'Wrong or expired code'+(d.attempts_left!==undefined?' ('+d.attempts_left+' tries left)':'')],
   otp_locked:['অনেকবার ভুল কোড। নতুন কোড নিন','Too many wrong codes. Ask for a new one'],
   otp_required:['ফোনে পাঠানো কোড দিন','Enter the code sent to your phone']}[c];
  if(c==='recipient_not_found'&&d.message&&/:\s*\d/.test(d.message))return L('নম্বর পাওয়া যায়নি: ','Number not found: ')+d.message.split(':').pop().trim();
  return m?L(m[0],m[1]):(e&&e.message)||L('সমস্যা হয়েছে, আবার চেষ্টা করুন','Something went wrong. Please try again')}

/* ---- polling "snapshots": call cb(value) only when the value changed; API.kick() refreshes everything right now ---- */
const _pollers=new Set();
API.poll=(fetcher,cb,ms=2500)=>{
  let last,stopped=false,busy=null,again=false;
  const once=async()=>{try{const v=await fetcher(),j=JSON.stringify(v);if(j!==last){last=j;cb(v)}}catch(e){if(e&&e.code==='unauthorized')stopped=true}};
  /* run(): if a fetch is already in flight it may be older than the write that triggered this call, so fetch once more afterwards */
  const run=()=>{if(stopped||(document.hidden&&last!==undefined))return Promise.resolve();
    if(busy){again=true;return busy}
    busy=(async()=>{do{again=false;await once()}while(again&&!stopped)})().finally(()=>{busy=null});return busy};
  const p={run},t=setInterval(run,ms);_pollers.add(p);run();
  return()=>{stopped=true;clearInterval(t);_pollers.delete(p)}};
API.kick=()=>Promise.all([..._pollers].map(p=>p.run()));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)API.kick()});

/* ---- Firestore-like document access used by the support side (chat, email, complaints, student applications, config).
        The server only lets a customer touch their own documents; staff documents go through /api/admin/docs. ---- */
function makeDocs(admin){
  const base=admin?'/api/admin/docs/':'/api/docs/';
  const jc=x=>x===undefined?x:JSON.parse(JSON.stringify(x));
  const strip=d=>{if(!d)return d;const {_id,_u,...r}=d;return r};
  const snapOf=(id,v)=>({id,exists:v!==undefined&&v!==null,data:()=>jc(v)});
  function docRef(c,id){
    const url=base+c+'/'+encodeURIComponent(id);
    const get=async()=>{try{return snapOf(id,strip(await API.get(url)))}catch(e){if(e.status===404)return snapOf(id,undefined);throw e}};
    const set=async d=>{await API.req('PUT',url,d);API.kick()};
    return{id,path:c+'/'+id,get,set,
      update:async d=>{const cur=(await get()).data();if(admin&&c!=='config'&&cur===undefined)throw {code:'not_found'};await set({...(cur||{}),...d})},
      delete:async()=>{if(admin)await API.del(url);else await API.del('/api/docs/'+c+'/'+encodeURIComponent(id));API.kick()},
      onSnapshot:cb=>API.poll(async()=>{const s=await get();return s.exists?s.data():null},v=>cb(snapOf(id,v===null?undefined:v)))}}
  function colRef(c){
    let cache=new Map(),since=0;
    const pull=async()=>{const rows=await API.get(base+c+'?since='+since);rows.forEach(r=>{cache.set(r._id,r);since=Math.max(since,r._u||0)});return[...cache.values()]};
    const qs=rows=>{const docs=rows.map(r=>snapOf(r._id,strip(r)));return{docs,size:docs.length,empty:!docs.length}};
    return{doc:id=>docRef(c,id),where:()=>colRef(c),get:async()=>qs(await pull()),
      onSnapshot:cb=>API.poll(async()=>{await pull();return[...cache.values()].map(r=>r._id+':'+r._u)},()=>cb(qs([...cache.values()])))}}
  /* config documents: customers read /api/config/<name>, staff read/write /api/admin/docs/config/<name> */
  function cfgRef(name){
    if(admin)return docRef('config',name);
    const get=async()=>{const d=await API.get('/api/config/'+name);return snapOf(name,Object.keys(d).length?d:undefined)};
    return{id:name,get,onSnapshot:cb=>API.poll(async()=>{const s=await get();return s.exists?s.data():null},v=>cb(snapOf(name,v===null?undefined:v)))}}
  return{col:colRef,cfg:cfgRef}}

/* ---- admin console: same shape as the browser-storage db, but every action goes through the admin API.
        Wallet money can only change through /api/admin/adjust, and the ledger is append-only (a "reverse" is a new adjustment). ---- */
function makeAdminApi(){
  const D=makeDocs(true),wal=new Map();
  const wmap=w=>({id:w.uid,name:w.name,balance:Number(w.balance),frozen:!!w.frozen,frozenBy:w.frozen_by||'',acct:w.acct,studentOK:!!w.student_ok,phone:w.phone,createdAt:w.created_at});
  const tmap=t=>({id:t.id,uid:t.uid,name:(wal.get(t.uid)||{}).name||'',t:KINDS[t.kind]||t.kind,a:Number(t.amount),ts:t.ts,fee:Number(t.fee),ph:t.counterparty_phone,rn:t.counterparty_name,trx:t.trx_id,src:t.bucket,undone:t.undone,bal:Number(t.balance_after)});
  const snap=(id,o)=>({id,exists:true,data:()=>JSON.parse(JSON.stringify(o))});
  const wallets={doc:id=>({id,
      update:async d=>{
        if('frozen' in d)await API.post('/api/admin/freeze',{uid:id,frozen:!!d.frozen});
        if('studentOK' in d)await API.post('/api/admin/student',{uid:id,ok:!!d.studentOK});
        API.kick()},
      inc:async(f,v)=>{if(f!=='balance')throw {code:'forbidden'};await API.post('/api/admin/adjust',{uid:id,delta:v});API.kick()},
      delete:async()=>{await API.del('/api/admin/wallets/'+encodeURIComponent(id));API.kick()}}),
    onSnapshot:cb=>API.poll(()=>API.get('/api/admin/wallets'),rows=>{wal.clear();rows.forEach(w=>wal.set(w.uid,w));const docs=rows.map(w=>snap(w.uid,wmap(w)));cb({docs})})};
  const txs={doc:id=>({id,set:async()=>{/* server writes the ledger entry itself */},delete:async()=>{/* append-only ledger */}}),
    onSnapshot:cb=>API.poll(()=>API.get('/api/admin/txs?limit=500'),rows=>{cb({docs:rows.map(t=>snap(t.id,tmap(t)))})})};
  const cols={wallets,txs};
  return{collection:n=>cols[n]||D.col(n),doc:path=>{const[c,id]=path.split('/');return D.cfg(id)}}}
