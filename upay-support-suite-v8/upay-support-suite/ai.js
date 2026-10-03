/* ai.js - support assistant: intent detection, redaction, FAQ matching */
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


