/* billers.js - SAMPLE biller directory and recharge helpers (no real operator or biller is connected).
   The ids must match backend/app/providers.py (a test checks it). Replace with a real directory from your biller aggregator. */
const BILLER_CATS=[
 {k:'electricity',bn:'বিদ্যুৎ',en:'Electricity',i:'🔌'},{k:'gas',bn:'গ্যাস',en:'Gas',i:'🔥'},{k:'water',bn:'পানি',en:'Water',i:'🚰'},
 {k:'internet',bn:'ইন্টারনেট',en:'Internet',i:'🌐'},{k:'tv',bn:'ক্যাবল টিভি',en:'Cable TV',i:'📡'},{k:'education',bn:'শিক্ষা',en:'Education',i:'🎓'}];
const BILLERS=[
 {id:'desco',c:'electricity',bn:'ডেসকো (ঢাকা উত্তর)',en:'DESCO (Dhaka North)'},
 {id:'dpdc',c:'electricity',bn:'ডিপিডিসি (ঢাকা দক্ষিণ)',en:'DPDC (Dhaka South)'},
 {id:'nesco',c:'electricity',bn:'নেসকো',en:'NESCO'},
 {id:'wzpdcl',c:'electricity',bn:'ডব্লিউজেডপিডিসিএল',en:'WZPDCL'},
 {id:'reb',c:'electricity',bn:'পল্লী বিদ্যুৎ (আরইবি)',en:'Palli Bidyut (REB)'},
 {id:'titas',c:'gas',bn:'তিতাস গ্যাস',en:'Titas Gas'},
 {id:'bakhrabad',c:'gas',bn:'বাখরাবাদ গ্যাস',en:'Bakhrabad Gas'},
 {id:'karnaphuli',c:'gas',bn:'কর্ণফুলী গ্যাস',en:'Karnaphuli Gas'},
 {id:'jalalabad',c:'gas',bn:'জালালাবাদ গ্যাস',en:'Jalalabad Gas'},
 {id:'dwasa',c:'water',bn:'ঢাকা ওয়াসা',en:'Dhaka WASA'},
 {id:'cwasa',c:'water',bn:'চট্টগ্রাম ওয়াসা',en:'Chattogram WASA'},
 {id:'link3',c:'internet',bn:'লিংক থ্রি',en:'Link3'},
 {id:'carnival',c:'internet',bn:'কার্নিভাল ইন্টারনেট',en:'Carnival Internet'},
 {id:'amberit',c:'internet',bn:'অ্যাম্বার আইটি',en:'Amber IT'},
 {id:'btcl',c:'internet',bn:'বিটিসিএল ব্রডব্যান্ড',en:'BTCL Broadband'},
 {id:'akash',c:'tv',bn:'আকাশ ডিটিএইচ',en:'Akash DTH'},
 {id:'cabletv',c:'tv',bn:'স্থানীয় ক্যাবল টিভি',en:'Local cable TV'},
 {id:'brac',c:'education',bn:'নমুনা বিশ্ববিদ্যালয় টিউশন',en:'Sample University tuition'},
 {id:'school',c:'education',bn:'নমুনা স্কুল ফি',en:'Sample school fees'}];
const billerOf=id=>BILLERS.find(b=>b.id===id)||null;
const acctOk=a=>/^[A-Za-z0-9]{6,20}$/.test(String(a||'').trim());
/* SAMPLE bill lookup for the browser-only demo: a stable fake amount due from the account number (the backend does the same on the server) */
const billLookupLocal=(id,acct)=>{const b=billerOf(id);if(!b||!acctOk(acct))return null;let h=7;for(const c of id+'|'+acct)h=(h*31+c.charCodeAt(0))>>>0;
 return{biller:id,name:b.en,account:String(acct).trim(),due:300+h%4700,customer:'Sample customer '+String(acct).trim().slice(-4),simulated:true}};
/* recharge: quick amounts and limits (same limits as the server) */
const RECHARGE={min:10,max:1000,quick:[20,50,100,200,500]};
const FAIL_SUFFIX='00000';/* demo: a number ending in 00000 makes the simulated operator fail */
if(typeof module!=='undefined')module.exports={BILLERS,BILLER_CATS,billerOf,acctOk,billLookupLocal,RECHARGE};
