// node tests/test_analytics.js  - unit tests for upay-support-suite/analytics.js
const assert=require('assert'),{anaCompute,anaSample,anaDur,anaMed}=require('../upay-support-suite/analytics.js');
const now=Date.UTC(2026,9,7,12),H=36e5,D=864e5;
assert.strictEqual(anaMed([3,1,2]),2);assert.strictEqual(anaMed([1,2,3,4]),2.5);assert.strictEqual(anaMed([]),null);
assert.deepStrictEqual([anaDur(null),anaDur(500),anaDur(45e3),anaDur(5*6e4),anaDur(90*6e4),anaDur(26*H)],['–','<1 s','45 s','5 min','1 h 30 min','1 d 2 h']);
const chat=(ts,status,policy,reply)=>({msgs:[{f:'cu',ts},...(reply?[{f:reply[0],ts:ts+reply[1]}]:[])],status,last:ts,a:{policy,team:'T',pri:'normal',lang:'English',conf:.8,flags:[]}});
const data={C:[chat(now-H,'auto_sent','Fees and charges',['ai',1]),chat(now-2*H,'agent_sent','Fees and charges',['ag',10*6e4]),chat(now-3*H,'needs_review','Forgot PIN'),chat(now-3*H,'auto_sent','FAQ: x',['ai',1]),chat(now-40*D,'auto_sent','Old',['ai',1])],
 M:[{ts:now-5*H,status:'resolved',replies:[{ts:now-4*H}],resolvedAt:now-3*H,subject:'s'}],
 X:[{ts:now-9*H,status:'resolved',cat:'A',team:'Dispute Desk',pri:'high',replies:[{ts:now-8*H}],resolvedAt:now-5*H},{ts:now-D,status:'new',cat:'A',team:'Dispute Desk',pri:'urgent',replies:[]}]};
const r=anaCompute(data,{now,days:30});
assert.strictEqual(r.byChannel.chat,4);                      // the 40-day-old chat is outside the range
assert.strictEqual(r.total,7);assert.strictEqual(r.autoChats,2);assert.strictEqual(r.autoRate,50);
assert.strictEqual(r.waitingChats,1);assert.strictEqual(r.openTickets,1);assert.strictEqual(r.resolvedRate,67);
assert.strictEqual(r.firstResp.chat.n,3);assert.strictEqual(r.firstResp.email.med,H);assert.strictEqual(r.firstResp.complaint.med,H);
assert.strictEqual(r.resolve.email.med,2*H);assert.strictEqual(r.resolve.complaint.med,4*H);assert.strictEqual(r.resolve.all.n,2);
assert.strictEqual(r.intents[0].label,'Fees and charges');assert.strictEqual(r.intents[0].n,2);assert.ok(r.intents.some(o=>o.label==='Your saved FAQ answers'));   // FAQ topics are grouped
assert.strictEqual(r.cats[0].n,2);assert.deepStrictEqual(r.pri,{urgent:1,high:1,normal:4});
assert.strictEqual(r.daily.length,30);assert.strictEqual(r.daily.reduce((a,d)=>a+d.chat+d.email+d.complaint,0),7);
assert.strictEqual(anaCompute(data,{now,days:7}).daily.length,7);
const e=anaCompute({C:[],M:[],X:[]},{now,days:7});assert.strictEqual(e.total,0);assert.strictEqual(e.firstResp.all.med,null);assert.strictEqual(e.autoRate,0);
const s=anaCompute(anaSample(now),{now,days:30});assert.ok(s.total>100&&s.intents.length>=5&&s.resolve.all.n>5);
assert.deepStrictEqual(anaSample(now),anaSample(now));       // sample data is deterministic
console.log('analytics: all passed');
