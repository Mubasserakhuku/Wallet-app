/* db.js - storage (localStorage + cross-tab sync + atomic inc). Replace makeDb() with a real API. */
/* ---------- Shared storage (localStorage + cross-tab sync). Swap with a real API later. ---------- */
function makeDb(){
  const K='upay_db',rd=()=>{try{return JSON.parse(localStorage.getItem(K)||'{}')}catch(e){return{}}},wr=o=>{try{localStorage.setItem(K,JSON.stringify(o));return true}catch(e){return false}};
  const lock=fn=>new Promise((ok,no)=>{const run=()=>{try{ok(fn())}catch(e){no(e)}};navigator.locks&&navigator.locks.request?navigator.locks.request('upay_db_lock',()=>{run()}):run()});
  const subs=new Set(),fire=()=>subs.forEach(f=>{try{f()}catch(e){console.error(e)}}),clone=x=>x===undefined?x:JSON.parse(JSON.stringify(x));
  addEventListener('storage',e=>{if(e.key===K)fire()});
  const snap=(p,o)=>({id:p.split('/').pop(),exists:o!==undefined,data:()=>clone(o)});
  const listen=(get,cb)=>{const run=()=>cb(get());subs.add(run);run();return()=>subs.delete(run)};
  const ref=p=>({id:p.split('/').pop(),path:p,
    get:async()=>snap(p,rd()[p]),
    set:async d=>{const o=rd();o[p]=clone(d);if(!wr(o))throw{code:'quota'};fire()},
    update:async d=>{const o=rd();if(o[p]===undefined)throw{code:'not_found'};o[p]={...o[p],...clone(d)};if(!wr(o))throw{code:'quota'};fire()},
    delete:async()=>{const o=rd();delete o[p];wr(o);fire()},
    /* Atomic add: reads the LATEST stored value, checks the rules, writes, all in one locked step (also across tabs).
       min: lowest allowed result (e.g. 0 = no overdraft). extra: other fields saved in the same write.
       Frozen wallets cannot be debited. Swap with a real DB transaction on the backend. */
    inc:(field,delta,min,extra)=>lock(()=>{const o=rd(),cur=o[p];if(cur===undefined)throw{code:'not_found'};
      const v=(cur[field]||0)+delta;if(delta<0&&cur.frozen)throw{code:'frozen'};if(min!==undefined&&v<min)throw{code:'insufficient'};
      o[p]={...cur,...clone(extra||{}),[field]:v};if(!wr(o))throw{code:'quota'};fire();return v}),
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
  const nm=P.get('n')||(L('গ্রাহক ','Customer ')+id.slice(-4)),DB=makeDb();
  window.claude={use:async n=>n==='db'?DB:n==='user'?{id:async()=>P.get('u')||localStorage.getItem('upay_uid')||id,me:async()=>({name:nm}),canEdit:async()=>ADM,isOwner:async()=>ADM}:null};
}

