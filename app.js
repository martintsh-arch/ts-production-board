(function(){
'use strict';
const S={pick:null,recentLots:{},mine:new Set(),seen:null,open:[],done:[],products:[],customers:[],history:[],pq:'',pOnlyMissing:false,cfg:null,rev:0,tab:'board',q:'',editOrder:null,pin:''};
const $=s=>document.querySelector(s);
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const ymd=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const today=()=>ymd(new Date());
const addDays=(s,n)=>{const d=new Date(s+'T00:00:00');d.setDate(d.getDate()+n);return ymd(d)};
const cfg=()=>S.cfg||{people:[],cats:{},varieties:{}};
const yearCode=y=>String.fromCharCode(65+(y-2019));
const fmtTime=iso=>{if(!iso)return'';const d=new Date(iso);return (d.getMonth()+1)+'/'+d.getDate()+' '+pad(d.getHours())+':'+pad(d.getMinutes())};
const num=n=>(+n||0).toLocaleString('zh-TW');
const qtyU=t=>num(t.qty)+(t.unit?' '+t.unit:'');
const UNITS=['桶','箱','瓶'];
const guessUnit=p=>!p?'箱':/桶/.test(p.name)?'桶':/瓶/.test(p.name)?'瓶':'箱';
const store={get(k){try{return localStorage.getItem(k)||''}catch(e){return''}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>t.hidden=true,2800)}
function setStatus(m){$('#status').textContent=m}
const WD='日一二三四五六';
function tick(){const d=new Date();$('#clock').innerHTML='<b>'+pad(d.getHours())+':'+pad(d.getMinutes())+'</b><small>'+(d.getMonth()+1)+'/'+d.getDate()+' 週'+WD[d.getDay()]+'</small>'}
tick();setInterval(tick,15000);

/* ---------- sound ---------- */
const Snd={ctx:null,on:store.get('tsb_snd')!=='0',
  unlock(){if(!this.ctx){try{this.ctx=new (window.AudioContext||window.webkitAudioContext)()}catch(e){}}if(this.ctx&&this.ctx.state==='suspended')this.ctx.resume().catch(()=>{})},
  tone(f,t0,d,type,g){const c=this.ctx,o=c.createOscillator(),v=c.createGain(),t=c.currentTime+t0;o.type=type||'sine';o.frequency.value=f;
    v.gain.setValueAtTime(0.0001,t);v.gain.exponentialRampToValueAtTime(g||.15,t+.02);v.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(v);v.connect(c.destination);o.start(t);o.stop(t+d+.05)},
  play(kind){if(!this.on)return;this.unlock();if(!this.ctx)return;try{
    if(kind==='done'){[523.25,659.25,783.99,1046.5].forEach((f,i)=>this.tone(f,i*.085,.55,'triangle',.17));this.tone(1568,.36,.7,'sine',.06)}
    else if(kind==='notify'){this.tone(987.77,0,.3,'sine',.14);this.tone(1318.5,.13,.55,'sine',.12)}
    else if(kind==='tap'){this.tone(740,0,.09,'sine',.06)}
    else if(kind==='add'){this.tone(587.33,0,.12,'triangle',.1);this.tone(880,.08,.18,'triangle',.1)}
  }catch(e){}}};
/* spoken announcements (zh-TW) */
const Voice={ok:'speechSynthesis' in window,unl:false,
  pick(){try{const vs=speechSynthesis.getVoices();return vs.find(v=>/zh[-_]TW/i.test(v.lang))||vs.find(v=>/zh[-_](HK|Hant)/i.test(v.lang))||vs.find(v=>/^zh/i.test(v.lang))||null}catch(e){return null}},
  say(text){if(!Snd.on||!this.ok)return;try{const u=new SpeechSynthesisUtterance(text);u.lang='zh-TW';const v=this.pick();if(v)u.voice=v;u.rate=.95;u.pitch=1.05;u.volume=1;speechSynthesis.speak(u)}catch(e){}},
  unlock(){if(this.unl||!this.ok)return;this.unl=true;try{const u=new SpeechSynthesisUtterance(' ');u.volume=0;speechSynthesis.speak(u)}catch(e){}}};
if(Voice.ok)try{speechSynthesis.getVoices();speechSynthesis.onvoiceschanged=()=>speechSynthesis.getVoices()}catch(e){}
const spokenName=n=>String(n||'').replace(/股份有限公司|有限公司|企業社|工作室/g,'').trim()||String(n||'');
document.addEventListener('pointerdown',()=>{Snd.unlock();Voice.unlock()},{passive:true});
function drawBell(){const b=$('#bell');if(!b)return;b.setAttribute('aria-pressed',String(Snd.on));b.setAttribute('aria-label',Snd.on?'提示音：開':'提示音：關');b.title=b.getAttribute('aria-label');
  b.innerHTML=Snd.on?'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg><span>提示音</span>'
  :'<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8.7 3A6 6 0 0 1 18 8a21.3 21.3 0 0 0 .6 5"/><path d="M17 17H3s3-2 3-9a4.67 4.67 0 0 1 .3-1.7"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/><path d="m2 2 20 20"/></svg><span>靜音</span>'}
document.addEventListener('click',e=>{if(e.target.closest('#bell')){Snd.on=!Snd.on;store.set('tsb_snd',Snd.on?'1':'0');drawBell();if(Snd.on){Snd.play('notify');setTimeout(()=>Voice.say('語音提示已開啟'),600)}}});
drawBell();

/* ---------- urgent-order alarm (fire-engine siren + voice, until someone taps 收到) ---------- */
S.ack=new Set();try{JSON.parse(store.get('tsb_ack')||'[]').forEach(k=>S.ack.add(k))}catch(e){}
function saveAck(){store.set('tsb_ack',JSON.stringify([...S.ack].slice(-300)))}
const Siren={nodes:null,timer:null,
  start(){Snd.unlock();const c=Snd.ctx;if(!c||this.nodes)return;try{
    const o=c.createOscillator(),o2=c.createOscillator(),lfo=c.createOscillator(),lg=c.createGain(),lg2=c.createGain(),f=c.createBiquadFilter(),g=c.createGain();
    o.type='sawtooth';o.frequency.value=900;o2.type='square';o2.frequency.value=902;
    lfo.type='triangle';lfo.frequency.value=0.42;lg.gain.value=430;lg2.gain.value=430;
    lfo.connect(lg);lg.connect(o.frequency);lfo.connect(lg2);lg2.connect(o2.frequency);
    f.type='lowpass';f.frequency.value=3000;g.gain.setValueAtTime(0.0001,c.currentTime);g.gain.exponentialRampToValueAtTime(0.2,c.currentTime+0.25);
    o.connect(f);o2.connect(f);f.connect(g);g.connect(c.destination);o.start();o2.start();lfo.start();this.nodes=[o,o2,lfo,g]}catch(e){}},
  stop(){if(!this.nodes)return;const [o,o2,l,g]=this.nodes,c=Snd.ctx;this.nodes=null;
    try{g.gain.setTargetAtTime(0.0001,c.currentTime,0.06);[o,o2,l].forEach(n=>n.stop(c.currentTime+0.35))}catch(e){}}};
let AL=null;
const urgKey=t=>t.id+':'+(t.urgentAt||'');
function urgentPending(){return S.open.filter(t=>t.urgent&&!S.ack.has(urgKey(t))&&!S.ack.has(t.id+':*'))}
function checkUrgent(){
  const pend=urgentPending();
  if(S.tab!=='board'||!pend.length){alarmOff();return}
  alarmOn(pend);
}
function alarmCycle(){if(!AL)return;Siren.start();
  AL.t1=setTimeout(()=>{if(!AL)return;Siren.stop();if('speechSynthesis' in window){try{const u=new SpeechSynthesisUtterance('緊急訂單！'+[...new Set(AL.pend.map(t=>spokenName(t.customer)))].slice(0,3).join('、')+'，請優先生產！');u.lang='zh-TW';const v=Voice.pick();if(v)u.voice=v;u.rate=1;u.onend=()=>{if(AL)AL.t2=setTimeout(alarmCycle,400)};speechSynthesis.speak(u);AL.t2=setTimeout(alarmCycle,7000)}catch(e){AL.t2=setTimeout(alarmCycle,600)}}else AL.t2=setTimeout(alarmCycle,600)},9000)}
function alarmOn(pend){
  const sig=pend.map(urgKey).join(',');
  if(AL&&AL.sig===sig)return;
  const fresh=!AL;AL=Object.assign(AL||{},{pend,sig});
  let box=$('#alarm');if(!box){box=document.createElement('div');box.id='alarm';box.setAttribute('role','alertdialog');box.setAttribute('aria-label','緊急單');document.body.appendChild(box)}
  const tape='<div>'+Array(14).fill('<span>緊急單</span><span>優先生產</span>').join('')+'</div>';
  if(fresh)AL.since=Date.now();
  box.innerHTML='<div class="al-beams" aria-hidden="true"><i></i><i></i></div><div class="al-strobe" aria-hidden="true"></div>'+
    '<div class="al-tape top" aria-hidden="true">'+tape+'</div><div class="al-tape bot" aria-hidden="true">'+tape+'</div>'+
    '<div class="al-box'+(fresh?' shake':'')+'"><div class="al-top"><div class="al-beacon" aria-hidden="true"><span></span></div>'+
    '<div class="al-timer"><small>警報已響</small><b id="altime">'+alarmClock()+'</b></div><div class="al-beacon" aria-hidden="true"><span></span></div></div>'+
    '<div class="al-k">緊急單</div><div class="al-sub">請先暫停手上的工作，優先生產以下訂單</div><div class="al-list">'+
    pend.map(t=>'<div class="al-row"><b>'+esc(t.customer)+'</b><span>'+esc(t.productName)+'</span><em>'+num(t.qty)+(t.unit?' '+esc(t.unit):'')+'</em></div>').join('')+
    '</div><button type="button" id="alack" class="al-btn">收到，馬上生產</button></div>';
  if(fresh){AL.tick=setInterval(()=>{const e=$('#altime');if(e)e.textContent=alarmClock()},1000);if(navigator.vibrate)try{navigator.vibrate([400,200,400,200,800])}catch(e){}alarmCycle()}
}
function alarmClock(){const sec=AL&&AL.since?Math.floor((Date.now()-AL.since)/1000):0;return Math.floor(sec/60)+':'+pad(sec%60)}
function alarmOff(){if(!AL)return;clearInterval(AL.tick);clearTimeout(AL.t1);clearTimeout(AL.t2);AL=null;Siren.stop();try{speechSynthesis.cancel()}catch(e){}const b=$('#alarm');if(b)b.remove()}
document.addEventListener('click',e=>{if(e.target.closest('#alack')){urgentPending().forEach(t=>S.ack.add(urgKey(t)));saveAck();alarmOff();Snd.play('tap');render(true)}});

/* ---------- completion feedback ---------- */
function celebrate(title,sub,lots){
  const box=document.createElement('div');box.className='celebrate';box.setAttribute('role','status');
  let hex='';for(let i=0;i<16;i++){const ang=(i/16)*Math.PI*2+Math.random()*.3,dist=130+Math.random()*90;hex+='<i style="--x:'+Math.round(Math.cos(ang)*dist)+'px;--y:'+Math.round(Math.sin(ang)*dist)+'px;--d:'+(Math.random()*.15).toFixed(2)+'s;--s:'+(0.6+Math.random()*0.8).toFixed(2)+'"></i>'}
  box.innerHTML='<div class="cel-card"><div class="cel-burst" aria-hidden="true">'+hex+'</div><svg class="cel-check" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="29"/><path d="M19 33l9 9 18-19"/></svg>'+
    '<div class="cel-kicker">完成生產</div><div class="cel-title">'+esc(title)+'</div><div class="cel-sub">'+esc(sub)+'</div>'+(lots&&lots.length?'<div class="cel-lots">'+lots.map(l=>'<span>'+esc(l)+'</span>').join('')+'</div>':'')+'</div>';
  document.body.appendChild(box);Snd.play('done');
  const close=()=>{if(box.classList.contains('out'))return;box.classList.add('out');setTimeout(()=>box.remove(),320)};
  box.addEventListener('click',close);setTimeout(close,2600);
}
function notifyBanner(lines,speech){
  let wrap=$('#notes');if(!wrap){wrap=document.createElement('div');wrap.id='notes';document.body.appendChild(wrap)}
  lines.forEach(l=>{const n=document.createElement('div');n.className='note';n.setAttribute('role','status');
    n.innerHTML='<span class="note-ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></span><div style="min-width:0"><b>已完成生產</b><div class="note-t">'+esc(l)+'</div></div><button type="button" aria-label="關閉通知">×</button>';
    n.querySelector('button').onclick=()=>n.remove();wrap.prepend(n);setTimeout(()=>{n.classList.add('out');setTimeout(()=>n.remove(),400)},12000)});
  Snd.play('notify');
  if(speech&&speech.length)setTimeout(()=>speech.forEach(t=>Voice.say(t)),650);
}
function detectRemoteDone(done){
  if(S.seen===null){S.seen=new Set(done.map(t=>t.id));return}
  const fresh=done.filter(t=>!S.seen.has(t.id));fresh.forEach(t=>S.seen.add(t.id));
  const others=fresh.filter(t=>!S.mine.has(t.id)&&!S.mine.has(t.parentId));
  if(!others.length)return;
  const groups={};others.forEach(t=>{const k=t.parentId&&others.some(o=>o.id===t.parentId)?t.parentId:t.id;(groups[k]=groups[k]||[]).push(t)});
  const gs=Object.values(groups);
  // several items of the same customer → one sentence per customer
  const byCust={};gs.forEach(g=>{const t=g[0],q=g.reduce((s,x)=>s+x.qty,0);(byCust[t.customer]=byCust[t.customer]||[]).push(shortName(t.productName)+' '+q+(t.unit||''))});
  const speech=Object.keys(byCust).slice(0,4).map(c=>spokenName(c)+'，已完成生產');
  notifyBanner(gs.slice(0,4).map(g=>{const t=g[0],q=g.reduce((s,x)=>s+x.qty,0);
    return t.customer+'｜'+t.productName+' ×'+num(q)+(t.unit?' '+t.unit:'')+'｜'+g.map(x=>x.lot).join('、')}),speech);
}

/* ---------- api ---------- */
async function api(method,url,body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-PIN':S.pin},body:body?JSON.stringify(body):undefined});
  if(r.status===401){showPin();throw new Error('需要密碼')}
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||'連線失敗');
  return data;
}
async function act(fn,okMsg){try{const r=await fn();await refresh(true);if(okMsg)toast(typeof okMsg==='function'?okMsg(r):okMsg);return r}catch(e){toast(e.message);return null}}
async function refresh(force){
  try{
    if(!force){const {rev}=await api('GET','/api/rev');if(rev===S.rev)return}
    const s=await api('GET','/api/state');
    detectRemoteDone(s.done);
    S.rev=s.rev;S.open=s.open;setTimeout(checkUrgent,0);S.done=s.done;S.products=s.products;S.recentLots=s.recentLots||{};S.customers=s.customers||[];S.history=s.history||[];S.cfg=s.config;
    setStatus('已連線，資料每 3 秒自動同步');
    if(!F)render();
  }catch(e){if(e.message!=='需要密碼')setStatus('連線中斷，正在重新連線…')}
}
let pollT=null;
function startPolling(){refresh(true);clearInterval(pollT);pollT=setInterval(()=>{if(!document.hidden)refresh(false)},3000)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(false)});

function showPin(){
  if($('#pinbox'))return;
  $('#modal').innerHTML='<div class="scrim"><form class="sheet" id="pinbox" style="border-radius:18px;align-self:center;max-width:420px"><div class="pname">請輸入公司密碼</div><input id="pinin" class="mono" type="password" autocapitalize="off" autocorrect="off" autocomplete="off" style="font-size:24px"><div class="err" id="pinerr"></div><button class="primary" type="submit">進入</button></form></div>';
  $('#pinin').focus();
  $('#pinbox').onsubmit=async e=>{e.preventDefault();S.pin=$('#pinin').value.trim();
    const r=await fetch('/api/rev',{headers:{'X-PIN':S.pin}});
    if(r.ok){store.set('tsb_pin',S.pin);$('#modal').innerHTML='';startPolling()}else $('#pinerr').textContent='密碼不對，請再試一次'};
}

/* ---------- tabs ---------- */
$('#tabs').addEventListener('click',e=>{const b=e.target.closest('button[data-tab]');if(!b)return;S.tab=b.dataset.tab;
  document.querySelectorAll('#tabs button').forEach(x=>x.setAttribute('aria-selected',x===b?'true':'false'));
  ['board','orders','records','settings'].forEach(k=>$('#v-'+k).hidden=k!==S.tab);document.body.classList.toggle('bd',S.tab==='board');render(true);checkUrgent();store.set('tsb_tab',S.tab)});
document.body.classList.add('bd');
{const t=store.get('tsb_tab');if(t){const b=document.querySelector('#tabs button[data-tab="'+t+'"]');if(b)b.click()}}

/* ---------- helpers ---------- */
function shipPill(t){const td=today();
  if(t.shipDate<td)return '<span class="pill p-over">逾期 '+esc(t.shipDate.slice(5).replace('-','/'))+'</span>';
  if(t.shipDate===td)return '<span class="pill p-today">今日出貨</span>';
  if(t.shipDate===addDays(td,1))return '<span class="pill p-tom">明日出貨</span>';
  return '<span class="pill p-later">'+esc(t.shipDate.slice(5).replace('-','/'))+' 出貨</span>'}
function boardTasks(){const lim=addDays(today(),2);return S.open.filter(t=>t.urgent||t.shipDate<=lim).sort((a,b)=>(b.urgent?1:0)-(a.urgent?1:0)||String(a.urgentAt||'').localeCompare(String(b.urgentAt||''))||(a.order||0)-(b.order||0))}
function boxComps(pid){const p=S.products.find(x=>x.id===pid);return p&&(p.components||[]).length?p.components.map(id=>S.products.find(x=>x.id===id)).filter(Boolean):[]}
function shortName(n){return String(n).replace(/^尋蜜趣[-－]/,'')}
function catName(c){return (cfg().cats[c]||{}).name||c}
function varName(c,v){return ((cfg().varieties||{})[c]||{})[v]||''}

/* ---------- render ---------- */
function render(force){
  const a=document.activeElement;
  if(!force&&a&&(a.tagName==='INPUT'||a.tagName==='SELECT')&&a.closest('#v-orders,#v-settings,#v-records'))return;
  if(S.tab==='board')renderBoard();
  if(S.tab==='orders')renderOrders();
  if(S.tab==='records')renderRecords();
  if(S.tab==='settings')renderSettings();
}
let dragging=false;
function unitSum(ts){const m={};ts.forEach(t=>{const u=t.unit||'件';m[u]=(m[u]||0)+(+t.qty||0)});const k=Object.keys(m);return k.length?k.map(u=>num(m[u])+' '+u).join('　'):'—'}
function shipCell(t,td){const md=t.shipDate.slice(5).replace('-','/');
  if(t.shipDate<td)return '<span class="c-ship s-over">逾期 <b>'+md+'</b></span>';
  if(t.shipDate===td)return '<span class="c-ship s-today">今日出貨</span>';
  if(t.shipDate===addDays(td,1))return '<span class="c-ship s-tom">明日出貨</span>';
  return '<span class="c-ship s-later"><b>'+md+'</b> 出貨</span>'}
const IC={
  pick:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M15 17.5l2 2 4-4"/></svg>',
  full:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>'};
function renderBoard(){
  if(dragging)return;
  const v=$('#v-board'),list=boardTasks(),td=today();
  const overL=list.filter(t=>t.shipDate<td),todayL=list.filter(t=>t.shipDate===td);
  const doneToday=S.done.filter(t=>t.completedAt&&ymd(new Date(t.completedAt))===td);
  const dueDone=doneToday.filter(t=>t.shipDate<=td).length,dueOpen=overL.length+todayL.length;
  const rate=dueDone+dueOpen?Math.round(dueDone*100/(dueDone+dueOpen)):null;
  const now=new Date(),dueLeft=overL.length+todayL.length;
  const hex=(cls,v,l,sub)=>'<div class="hex '+cls+'"><div class="hv">'+v+'</div><div class="hl">'+l+'</div>'+(sub?'<div class="hs">'+esc(sub)+'</div>':'')+'</div>';
  let h='<section class="bd-hero"><div class="bd-title"><h1>今日生產</h1><p>'+(now.getMonth()+1)+' 月 '+now.getDate()+' 日 週'+WD[now.getDay()]+'　'+
    (list.length?'排程中 <b>'+list.length+' 筆</b>'+(dueLeft?'，今天要出貨的還有 <b>'+dueLeft+' 筆</b>':'，今天要出貨的都做完了'):'目前沒有待生產項目')+'</p></div>'+
    '<div class="hexes" role="group" aria-label="今日指標">'+
    hex('','<span class="mono-n">'+list.length+'</span>','待生產',unitSum(list))+
    hex(todayL.length?'h-warn':'',todayL.length,'今日出貨',todayL.length?unitSum(todayL):'已清空')+
    hex(overL.length?'h-bad':'',overL.length,'逾期',overL.length?'請優先處理':'無')+
    hex('h-ok',doneToday.length,'今日完成',doneToday.length?unitSum(doneToday):'')+
    '<div class="hex h-rate'+((rate||0)<55?' low':'')+'" style="--fill:'+(rate||0)+'%" role="img" aria-label="今日出貨達成率 '+(rate==null?'無資料':rate+'%')+'"><span class="fill"></span><div class="hv">'+(rate==null?'—':rate+'<i>%</i>')+'</div><div class="hl">出貨達成率</div></div>'+
    '</div></section>';
  h+='<div class="bd-head"><div><b>生產排程</b><span>依序生產，拖曳 ⠿ 可調整順序</span></div><div class="bd-act">'+
    (S.pick?'':'<button type="button" id="pickstart" class="pick-start">'+IC.pick+'多筆一起完成（同一鍋）</button>')+
    '<button type="button" id="fullbtn" class="ghost-btn" aria-label="全螢幕顯示">'+IC.full+'<span>全螢幕</span></button></div></div>';
  if(!list.length)h+='<div class="empty"><b>目前沒有待生產項目</b>三天內（含今日）要出貨的訂單會自動出現在這裡。到「訂單輸入」新增第一筆。</div>';
  else h+=(S.pick?'<div class="pickbar-top"><b>勾選這一鍋要分給哪幾張訂單</b><span>點卡片勾選，同一類別（品種）才能共用批號</span></div>':'')+
    '<div class="list'+(S.pick?' picking':'')+'" id="blist">'+list.map((t,i)=>{
    const bx=boxComps(t.productId),on=S.pick&&S.pick.has(t.id),next=!S.pick&&i===0;
    const code=bx.length?'<span class="pill p-box">禮盒：'+esc(bx.map(p=>shortName(p.name)).join('＋'))+'</span>':t.cat?'<span class="pill p-code">'+esc(t.cat)+esc(t.variety||'')+'</span><span class="pill p-cat">'+esc(catName(t.cat))+((cfg().cats[t.cat]||{}).auto?' 🔒':'')+'</span>':'<span class="pill p-tom">未設類別</span>';
    return '<div class="card'+(t.shipDate<td?' over':t.shipDate===td?' u-today':t.shipDate===addDays(td,1)?' u-tom':'')+(on?' picked':'')+(next?' next':'')+(t.urgent?' urgent':'')+'" data-id="'+t.id+'"'+(S.pick?' role="checkbox" aria-checked="'+on+'" tabindex="0"':'')+'>'+
      '<div class="c-top">'+(S.pick?'<span class="pickbox'+(on?' on':'')+'" aria-hidden="true">'+(on?'✓':'')+'</span>':'<span class="grip" aria-label="拖曳排序" title="拖曳排序">⠿</span><span class="seq">'+pad(i+1)+'</span>')+
        (t.urgent?'<span class="urg-tag">緊急單</span>':'')+(next&&!t.urgent?'<span class="next-tag">現在生產</span>':'')+shipCell(t,td)+'</div>'+
      '<div class="cust">'+esc(t.customer)+'</div><div class="pname">'+esc(t.productName)+'</div>'+
      '<div class="meta">'+code+(t.parentId?'<span class="pill p-later">續做</span>':'')+'</div>'+
      (t.note?'<div class="note-box">備註：'+esc(t.note)+'</div>':'')+
      '<div class="c-bot"><div class="c-qty"><b>'+num(t.qty)+'</b><span>'+esc(t.unit||'')+'</span></div>'+
      (S.pick?'':'<button class="done-btn" data-act="finish" data-id="'+t.id+'">完成生產</button>')+'</div></div>'}).join('')+'</div>'+
    (S.pick?'<div class="pickbar"><span>已選 <b>'+S.pick.size+'</b> 筆</span><button type="button" id="pickcancel">取消</button><button type="button" id="pickgo" class="primary"'+(S.pick.size?'':' aria-disabled="true"')+'>一起完成</button></div>':'');
  if(doneToday.length)h+='<div class="bd-head bd-done"><div><b>今日已完成</b><span>'+doneToday.length+' 筆，批號有誤可直接修改</span></div></div><div class="done-list">'+
    doneToday.map(t=>'<div class="drow"><span class="d-ok" aria-hidden="true">✓</span><span class="d-time">'+fmtTime(t.completedAt).split(' ')[1]+'</span>'+
      '<span class="d-main"><b>'+esc(t.customer)+'</b><span>'+esc(t.productName)+'　'+qtyU(t)+'</span></span>'+
      '<span class="d-lot">'+esc(t.lot)+'</span><span class="d-op">'+esc(t.operator)+'</span>'+
      (t.contents?'<span></span>':'<button type="button" data-blot="'+t.id+'">改批號</button>')+'</div>').join('')+'</div>';
  v.innerHTML=h;
  const el=$('#blist');
  if(el&&window.Sortable&&!S.pick)Sortable.create(el,{handle:'.grip',animation:150,ghostClass:'ghost-sort',
    onStart:()=>{dragging=true},
    onEnd:async()=>{dragging=false;const ids=[...el.querySelectorAll('.card')].map(c=>+c.dataset.id);
      ids.forEach((id,i)=>{const t=S.open.find(x=>x.id===id);if(t)t.order=(i+1)*10});renderBoard();
      await act(()=>api('POST','/api/tasks/reorder',{ids}))}});
}
$('#v-board').addEventListener('click',e=>{
  if(e.target.closest('#pickstart')){S.pick=new Set();Snd.play('tap');return renderBoard()}
  if(e.target.closest('#pickcancel')){S.pick=null;return renderBoard()}
  if(e.target.closest('#fullbtn')){const d=document;try{if(d.fullscreenElement)d.exitFullscreen();else d.documentElement.requestFullscreen()}catch(_){}return}
  if(e.target.closest('#pickgo')){if(!S.pick.size)return toast('請先點選要一起完成的訂單');return openBatch([...S.pick])}
  const bl=e.target.closest('[data-blot]');if(bl){const t=S.done.find(x=>x.id===+bl.dataset.blot);if(t)openLotEdit(t);return}
  if(S.pick){const c=e.target.closest('.card[data-id]');if(c){const id=+c.dataset.id;S.pick.has(id)?S.pick.delete(id):S.pick.add(id);Snd.play('tap');renderBoard()}return}
  const b=e.target.closest('[data-act="finish"]');if(b)openFinish(+b.dataset.id)});
$('#v-board').addEventListener('keydown',e=>{if(S.pick&&(e.key===' '||e.key==='Enter')&&e.target.matches('.card[data-id]')){e.preventDefault();e.target.click()}});

/* ---------- finish sheet ---------- */
let F=null,F_unit='';
const LETTERS='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
function openFinish(id){
  const t=S.open.find(x=>x.id===id);if(!t)return;
  const pr=S.products.find(p=>p.id===t.productId)||{};const dc=t.cat||pr.cat||'',dv=t.variety||pr.variety||'';
  F={t,defCat:dc,cat:dc,variety:dv,matDate:'',matArr:'',arrSet:false,qty:String(t.qty),operator:store.get('tsb_op'),step:'date',err:'',pv:null,seq:'',seqTouched:false,showAll:false,busy:false,lots:[],mlot:''};
  if(!(cfg().people||[]).includes(F.operator))F.operator='';
  const bx=boxComps(t.productId);
  if(bx.length){F.box=bx;F.cont={};bx.forEach(p=>{const r=(S.recentLots[p.id]||[])[0];F.cont[p.id]=r?{lot:r[0],date:r[1],manual:false}:{lot:'',date:today(),manual:true}});drawFinish();return}
  drawFinish();updatePreview();
}
function openBatch(ids){
  const ts=ids.map(id=>S.open.find(x=>x.id===id)).filter(Boolean);if(!ts.length)return;
  if(ts.some(t=>boxComps(t.productId).length))return toast('禮盒要個別完成，請取消勾選禮盒');
  const cv=ts.map(t=>{const pr=S.products.find(p=>p.id===t.productId)||{};return {cat:t.cat||pr.cat||'',variety:t.variety||pr.variety||''}});
  const cats=[...new Set(cv.map(x=>x.cat))];
  if(cats.length>1)return toast('勾選的品項類別不同（'+cats.map(c=>c||'未設').join('、')+'），不能共用同一個批號');
  const rule0=(cfg().cats[cats[0]]||{}).rule;
  const vars=[...new Set(cv.map(x=>x.variety))];
  if(rule0!=='material'&&vars.length>1)return toast('勾選的品項品種不同（'+vars.map(v=>cats[0]+v).join('、')+'），不能共用同一個批號');
  const bq={};ts.forEach(t=>bq[t.id]=String(t.qty));
  F={t:ts[0],batch:ts,bq,defCat:cats[0],cat:cats[0],variety:rule0==='material'?'':vars[0],matDate:'',matArr:'',arrSet:false,qty:String(ts[0].qty),operator:store.get('tsb_op'),step:'date',err:'',pv:null,seq:'',seqTouched:false,showAll:false,busy:false,lots:[],mlot:''};
  if(!(cfg().people||[]).includes(F.operator))F.operator='';
  drawFinish();updatePreview();
}
function dvOf(t){const pr=S.products.find(p=>p.id===t.productId)||{};return t.variety||pr.variety||''}
function rule(){return (cfg().cats[F.cat]||{}).rule||'month'}
function isAuto(){return !!(cfg().cats[F.cat]||{}).auto}
const LOT_RE=/^[A-Z0-9]{2,20}(-[A-Z0-9]{1,4})?$/;
function curLotText(){return isAuto()?lotNow():F.mlot}
function manualPrefix(){const c=F.cat;if(!c||!cfg().cats[c])return '';const y=yearCode(new Date().getFullYear());
  if(rule()==='material')return y+c;return y+c+pad(new Date().getMonth()+1)+(F.variety||'')}
function ready(){if(!F.cat||!cfg().cats[F.cat])return false;return rule()==='material'?(F.matDate.length===4&&F.arrSet):!!F.variety}
function lotNow(){return F.pv&&F.seq?F.pv.prefix+'-'+F.seq:''}
let pvT=null;
function updatePreview(){
  F.pv=null;if(!F.seqTouched)F.seq='';clearTimeout(pvT);if(!isAuto()||!ready()){drawFinish();return}
  const key=[F.cat,F.variety,F.matDate,F.matArr].join('|');
  pvT=setTimeout(async()=>{try{const r=await api('POST','/api/lot-preview',{cat:F.cat,variety:F.variety,matDate:F.matDate,matArr:F.matArr});
    if(F&&[F.cat,F.variety,F.matDate,F.matArr].join('|')===key){F.lots.forEach(l=>{if(l.lot.startsWith(r.prefix+'-')&&r.suggest&&l.seq>=r.suggest)r.suggest=l.seq<'Z'?String.fromCharCode(l.seq.charCodeAt(0)+1):null});F.pv=r;if(!F.seqTouched)F.seq=r.suggest||'';drawFinish()}}
    catch(e){if(F){F.err=e.message;drawFinish()}}},150);
}
function drawFinish(){
  if(!F)return;
  if(F.box)return drawBox();
  const t=F.t,c=cfg(),y=yearCode(new Date().getFullYear()),people=c.people||[],isMat=rule()==='material';
  let h='<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="完成生產">'+
   (F.batch?'<div class="sheet-h"><div class="cust"><span class="cust-tag">同一鍋</span>分給 '+F.batch.length+' 張訂單，共用一個批號</div><div class="hint">批號只要設定一次，會套用到下面全部訂單</div></div>':
   '<div class="sheet-h"><div class="cust"><span class="cust-tag">客戶</span>'+esc(t.customer)+'</div><div class="pname">'+esc(t.productName)+' <span class="mono">× '+qtyU(t)+'</span></div><div class="meta">'+shipPill(t)+'</div>'+(t.note?'<div class="note-box">備註：'+esc(t.note)+'</div>':'')+'</div>');
  h+='<div class="sec"><div class="lbl"><i class="sn">1</i>操作人</div><div class="chips">'+(people.length?people.map(n=>'<button class="chip" data-op="'+esc(n)+'" aria-pressed="'+(F.operator===n)+'">'+esc(n)+'</button>').join(''):'<span class="hint">還沒有人員名單，請到「設定」新增。</span>')+'</div></div>';
  h+='<div class="sec"><div class="lbl"><i class="sn">2</i>產品類別</div><div class="chips">'+Object.keys(c.cats).map(k=>'<button class="chip" data-cat="'+esc(k)+'" aria-pressed="'+(F.cat===k)+'">'+esc(k)+' '+esc(c.cats[k].name)+'</button>').join('')+'</div>'+
   (!F.cat?'<div class="warn">這個品項還沒設定類別，請點選正確的類別（可到「設定」的品項主檔設定一次，以後就會自動帶入）。</div>':'')+
   (F.cat&&F.defCat&&F.cat!==F.defCat?'<div class="warn">這個品項預設是 '+esc(F.defCat)+' '+esc(catName(F.defCat))+'，你改成了 '+esc(F.cat)+' '+esc(catName(F.cat))+'。確認無誤再完成。</div>':'')+'</div>';
  if(!isAuto()&&F.cat){
    const pids=[...new Set((F.batch||[F.t]).map(x=>x.productId))],rec=[];
    pids.forEach(id=>(S.recentLots[id]||[]).forEach(r=>{if(!rec.some(x=>x[0]===r[0]))rec.push(r)}));
    const pre=manualPrefix(),ex=isMat?y+F.cat+'0913B-A':y+F.cat+pad(new Date().getMonth()+1)+(F.variety||'1')+'-A';
    h+='<div class="sec"><div class="lbl"><i class="sn">3</i>批號 <span class="lbl-sub">由作業人員輸入</span></div>'+
      '<input id="flot" class="mono lot-in" value="'+esc(F.mlot)+'" placeholder="例如 '+esc(ex)+'" autocapitalize="characters" autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="done" aria-label="批號">'+
      '<div class="hint">點一下快速帶入，再補上後面的碼</div><div class="chips">'+
      (pre?'<button type="button" class="chip lotchip" data-mlot="'+esc(pre)+'"><b class="mono">'+esc(pre)+'…</b><small>本月開頭</small></button>':'')+
      rec.slice(0,6).map(r=>'<button type="button" class="chip lotchip" data-mlot="'+esc(r[0])+'" aria-pressed="'+(F.mlot===r[0])+'"><b class="mono">'+esc(r[0])+'</b><small>'+esc(String(r[1]||'').slice(5).replace('-','/'))+' 用過</small></button>').join('')+
      '</div></div>';
  }else{
  // lot header (system-locked category)
  h+='<div class="sec"><div class="lbl"><i class="sn">3</i>批號 <span class="lbl-sub lock">🔒 系統自動編號</span></div><div class="lot"><div class="seg"><b>'+y+'</b><small>年份</small></div><div class="seg"><b>'+esc((c.cats[F.cat]||{}).code||F.cat)+'</b><small>'+esc(catName(F.cat))+'</small></div>';
  if(isMat){const mat=(c.cats[F.cat]||{}).mat||'主原料';
    h+='<div class="seg man'+(F.step==='date'?' active':'')+'" data-step="date"><b>'+esc((F.matDate+'____').slice(0,4))+'</b><small>'+esc(mat)+'有效日</small></div>'+
       '<div class="seg man'+(F.step==='arr'?' active':'')+'" data-step="arr"><b>'+(F.arrSet?esc(F.matArr||'—'):'_')+'</b><small>到貨次序</small></div>';
  }else{
    h+='<div class="seg"><b>'+pad(new Date().getMonth()+1)+'</b><small>月份</small></div><div class="seg'+(F.variety?'':' man')+'"><b>'+esc(F.variety||'_')+'</b><small>'+esc(varName(F.cat,F.variety)||'品種')+'</small></div>';
  }
  h+='<span class="dash">-</span><div class="seg"><b>'+(F.seq?esc(F.seq):'…')+'</b><small>批次序號</small></div></div>';
  if(!isMat){const vars=(c.varieties||{})[F.cat]||{};
    if(!F.variety||F.cat!==F.defCat||!vars[F.variety])h+='<div class="hint">選擇品種</div><div class="chips">'+Object.keys(vars).map(k=>'<button class="chip" data-var="'+esc(k)+'" aria-pressed="'+(F.variety===k)+'">'+esc(k)+' '+esc(vars[k])+'</button>').join('')+'</div>'}
  if(isMat&&F.step==='date'){
    h+='<div class="hint">輸入'+esc((c.cats[F.cat]||{}).mat||'主原料')+'有效日期（月日 4 碼，例如 0913）</div>'+
      '<div class="kp">'+['1','2','3','4','5','6','7','8','9','0'].map(k=>'<button data-key="'+k+'">'+k+'</button>').join('')+'</div><div class="row"><button data-key="del" style="flex:1">刪除一碼</button><button data-key="clr" style="flex:1">清除</button></div>'}
  if(isMat&&F.step==='arr'){
    h+='<div class="hint">這批原料是第幾次到貨？第一次到貨沒有字母，選「無」</div>'+
      '<div class="kp"><button data-arr="" style="grid-column:span 2;font-size:18px;font-family:var(--f-body)"'+(F.arrSet&&!F.matArr?' aria-pressed="true"':'')+'>無（第一次）</button>'+['B','C','D','E','F','G','H','A'].map(k=>'<button data-arr="'+k+'">'+k+'</button>').join('')+'</div>'}
  if(ready()&&F.pv&&!F.pv.suggest)h+='<div class="err">這個月的序號已經用到 Z，請聯絡管理者</div>';
  const lot=lotNow();
  if(lot)h+='<div class="row" style="justify-content:space-between"><span class="hint">本批批號（系統鎖定，不能修改）</span><span class="big-lot">'+esc(lot)+'</span></div>';
  else if(ready())h+='<div class="hint">批號產生中…</div>';
  h+='</div>';
  }
  if(F.batch){
    h+='<div class="sec"><div class="lbl"><i class="sn">4</i>各訂單完成數量（少於訂單的部分會留在看板）</div><div style="display:flex;flex-direction:column;gap:8px">'+
      F.batch.map(b=>'<div class="bline"><div style="min-width:0;flex:1"><div class="bcust">'+esc(b.customer)+'</div><div class="hint">'+esc(b.productName)+'　訂單 '+qtyU(b)+(b.note?'　<span style="color:var(--amber)">備註：'+esc(b.note)+'</span>':'')+'</div></div>'+
        '<input class="bqty mono" data-id="'+b.id+'" type="number" inputmode="numeric" min="1" max="'+b.qty+'" value="'+esc(F.bq[b.id])+'" aria-label="'+esc(b.customer)+' 完成數量"><span class="hint">'+esc(b.unit||'')+'</span></div>').join('')+'</div></div>';
    h+='<div class="err">'+esc(F.err)+'</div><div class="row"><button id="fcancel" style="flex:1">取消</button><button id="fok" class="primary" style="flex:2;min-height:60px;font-size:18px"'+(F.busy?' disabled':'')+'>'+(F.busy?'儲存中…':'確認完成 '+F.batch.length+' 筆')+'</button></div></div></div>';
    const sc=$('#scrim')?$('.sheet').scrollTop:0;$('#modal').innerHTML=h;$('.sheet').scrollTop=sc;return;
  }
  const used=F.lots.reduce((s,l)=>s+l.qty,0),left=t.qty-used,cur=parseInt(F.qty,10)||0,tot=used+cur,u=t.unit?' '+t.unit:'';
  h+='<div class="sec"><label class="lbl" for="fqty"><i class="sn">4</i>'+(F.lots.length?'這個批號的數量':'這個批號的數量（一筆用到兩個批號時，先填第一批的數量，再按下面「＋ 再加一個批號」）')+'</label>'+
    '<div class="row" style="flex-wrap:nowrap"><input id="fqty" class="mono" type="number" inputmode="numeric" min="1" max="'+left+'" value="'+esc(F.qty)+'" style="font-size:22px;flex:1"><span class="hint" style="white-space:nowrap">'+esc(t.unit||'')+'</span></div>'+
    '<button type="button" id="faddlot" style="align-self:flex-start">＋ 再加一個批號</button></div>';
  if(F.lots.length){
    h+='<div class="sec"><div class="lbl">這筆訂單的批號</div><div style="display:flex;flex-direction:column;gap:6px">'+
      F.lots.map((l,i)=>'<div class="row" style="justify-content:space-between;flex-wrap:nowrap;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 12px"><span class="mono" style="font-size:20px;font-weight:600">'+esc(l.lot)+'</span><span class="mono">× '+num(l.qty)+esc(u)+'</span><button type="button" data-dellot="'+i+'" aria-label="移除這個批號" style="min-height:40px;padding:4px 12px;color:var(--red)">✕</button></div>').join('')+
      (curLotText()?'<div class="row" style="justify-content:space-between;flex-wrap:nowrap;border:2px dashed var(--gold);border-radius:10px;padding:8px 12px"><span class="mono" style="font-size:20px;font-weight:600">'+esc(curLotText())+'</span><span class="mono">× '+num(cur)+esc(u)+'</span><span class="hint">正在設定</span></div>':'')+
      '</div></div>';
  }
  h+='<div class="hint" style="font-size:15px">合計 <b class="mono">'+num(tot)+'</b>'+esc(u)+' ／ 訂單 '+num(t.qty)+esc(u)+(tot<t.qty&&tot>0?'，剩 <b class="mono">'+num(t.qty-tot)+'</b>'+esc(u)+' 會留在看板':'')+(tot>t.qty?'　<span style="color:var(--red)">超過訂單數量</span>':'')+'</div>';
  h+='<div class="err">'+esc(F.err)+'</div><div class="row"><button id="fcancel" style="flex:1">取消</button><button id="fok" class="primary" style="flex:2;min-height:60px;font-size:18px"'+(F.busy?' disabled':'')+'>'+(F.busy?'儲存中…':'確認完成')+'</button></div></div></div>';
  const sc=$('#scrim')?$('.sheet').scrollTop:0;
  $('#modal').innerHTML=h;$('.sheet').scrollTop=sc;
}
function closeFinish(){F=null;$('#modal').innerHTML='';render(true)}
$('#modal').addEventListener('input',e=>{if(F&&e.target.id==='flot'){const el=e.target,pos=el.selectionStart,v=el.value.toUpperCase().replace(/\s/g,'');if(v!==el.value){el.value=v;try{el.setSelectionRange(pos,pos)}catch(_){}}F.mlot=v;return}
  if(F&&F.batch&&e.target.classList.contains('bqty')){F.bq[e.target.dataset.id]=e.target.value;return}if(F&&e.target.id==='fqty'){F.qty=e.target.value;const pos=e.target.selectionStart;drawFinish();const n=$('#fqty');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}}});
$('#modal').addEventListener('click',e=>{
  if(!F)return;
  if(e.target.id==='scrim'||e.target.id==='fcancel')return closeFinish();
  const b=e.target.closest('button,[data-step]');if(!b)return;
  let changedLot=false;
  if(b.dataset.op!==undefined){F.operator=b.dataset.op;store.set('tsb_op',F.operator);Snd.play('tap')}
  else if(b.dataset.mlot!==undefined){F.mlot=b.dataset.mlot;Snd.play('tap');F.err='';drawFinish();const n=$('#flot');if(n){n.focus();const L=n.value.length;try{n.setSelectionRange(L,L)}catch(_){}}return}
  else if(b.dataset.clot){F.cont[b.dataset.clot]={lot:b.dataset.lot,date:b.dataset.date,manual:false};Snd.play('tap')}
  else if(b.dataset.cman){const c=F.cont[b.dataset.cman];F.cont[b.dataset.cman]={lot:c.manual?c.lot:'',date:c.date||today(),manual:true}}
  else if(b.dataset.cat){F.cat=b.dataset.cat;F.matDate='';F.matArr='';F.arrSet=false;F.step='date';F.seqTouched=false;F.variety=F.cat===F.defCat?dvOf(F.t):'';changedLot=true}
  else if(b.dataset.var){F.variety=b.dataset.var;F.seqTouched=false;changedLot=true}
  else if(b.dataset.step){if(b.dataset.step==='seq'){F.showAll=true}else F.step=b.dataset.step}
  else if(b.dataset.arr!==undefined){F.matArr=b.dataset.arr;F.arrSet=true;F.step='seq';F.seqTouched=false;changedLot=true}
  else if(b.dataset.seq){F.seq=b.dataset.seq;F.seqTouched=true}
  else if(b.dataset.showall){F.showAll=!F.showAll}
  else if(b.dataset.key){const k=b.dataset.key;changedLot=true;F.seqTouched=false;
    if(k==='clr'){F.matDate='';F.matArr='';F.arrSet=false;F.step='date'}
    else if(k==='del'){F.matDate=F.matDate.slice(0,-1);F.arrSet=false;F.matArr='';F.step='date'}
    else if(F.matDate.length<4){F.matDate+=k;if(F.matDate.length===4)F.step='arr'}}
  else if(b.id==='faddlot')return addLot();
  else if(b.dataset.dellot!==undefined){F.lots.splice(+b.dataset.dellot,1)}
  else if(b.id==='fok')return finishConfirm();
  F.err='';if(F.box)return drawBox();if(changedLot)updatePreview();else drawFinish();
});
async function batchConfirm(){
  const fail=m=>{F.err=m;drawFinish()};
  if(!F.operator)return fail('請先點選操作人');
  const savedQty=F.qty;F.qty='1';const ce=curLotErr();F.qty=savedQty;if(ce)return fail(ce);
  const items=F.batch.map(b=>({id:b.id,qty:parseInt(F.bq[b.id],10)}));
  for(const it of items){const b=F.batch.find(x=>x.id===it.id);if(!it.qty||it.qty<1||it.qty>b.qty)return fail(b.customer+'：數量需介於 1 到 '+b.qty)}
  F.busy=true;drawFinish();
  try{
    const r=await api('POST','/api/tasks/finish-batch',{operator:F.operator,cat:F.cat,variety:F.variety,matDate:F.matDate,matArr:F.matArr,lot:F.mlot,items});
    const names=F.batch.map(b=>b.customer);F.batch.forEach(b=>S.mine.add(b.id));F=null;S.pick=null;$('#modal').innerHTML='';
    celebrate('同一批完成 '+r.count+' 筆訂單',names.slice(0,4).join('、')+(names.length>4?' 等':'')+(r.rest?'（'+r.rest+' 筆有剩餘留在看板）':''),[r.lot]);
    await refresh(true);render(true);
  }catch(e){if(F){F.busy=false;fail(e.message)}}
}
function curLotErr(){
  if(!F.cat)return '請先選擇產品類別';
  if(!isAuto()){if(!F.mlot)return '請輸入批號';if(!LOT_RE.test(F.mlot))return '批號格式不對（只能英文與數字，例如 HP101-A）';
    if(F.lots.some(l=>l.lot===F.mlot))return '這個批號已經加過了';const q0=parseInt(F.qty,10);return (!q0||q0<1)?'這個批號的數量要大於 0':''}
  if(rule()==='material'){if(F.matDate.length!==4)return '原料有效日期需要 4 碼';if(!F.arrSet)return '請點選到貨次序（第一次到貨選「無」）'}
  else if(!F.variety)return '請選擇品種';
  if(!F.seq||!F.pv)return '系統批號產生中，請稍候再按一次';
  const q=parseInt(F.qty,10);if(!q||q<1)return '這個批號的數量要大於 0';
  return '';
}
function curLot(){return {cat:F.cat,variety:F.variety,matDate:F.matDate,matArr:F.matArr,seq:F.seq,lot:curLotText(),qty:parseInt(F.qty,10)}}
function addLot(){
  const e=curLotErr();if(e){F.err=e;return drawFinish()}
  Snd.play('add');
  const used=F.lots.reduce((s,l)=>s+l.qty,0)+parseInt(F.qty,10);
  if(used>=F.t.qty){F.err='數量已經等於訂單數量，不用再加批號';return drawFinish()}
  F.lots.push(curLot());
  F.qty=String(F.t.qty-used);F.seqTouched=false;F.showAll=false;F.err='';F.mlot='';
  if(rule()==='material')F.step='seq';
  updatePreview();
}
function drawBox(){
  const t=F.t,people=cfg().people||[];
  let h='<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="完成生產">'+
   '<div class="sheet-h"><div class="cust"><span class="cust-tag">客戶</span>'+esc(t.customer)+'</div><div class="pname">'+esc(t.productName)+' <span class="mono">× '+qtyU(t)+'</span></div><div class="meta">'+shipPill(t)+'<span class="pill p-box">禮盒不需要批號</span></div>'+(t.note?'<div class="note-box">備註：'+esc(t.note)+'</div>':'')+'</div>';
  h+='<div class="sec"><div class="lbl">操作人</div><div class="chips">'+(people.length?people.map(n=>'<button class="chip" data-op="'+esc(n)+'" aria-pressed="'+(F.operator===n)+'">'+esc(n)+'</button>').join(''):'<span class="hint">還沒有人員名單，請到「設定」新增。</span>')+'</div></div>';
  h+='<div class="sec"><div class="lbl">禮盒內容物：點選裝進去的那一批</div>';
  F.box.forEach((p,i)=>{const c=F.cont[p.id],rec=S.recentLots[p.id]||[];
    h+='<div class="comp"><div class="comp-h"><span class="comp-n">'+(i+1)+'</span><b>'+esc(shortName(p.name))+'</b>'+(c.lot?'<span class="mono comp-sel">'+esc(c.lot)+'</span>':'<span class="comp-sel need">尚未選擇</span>')+'</div>'+
      '<div class="chips">'+rec.map(r=>'<button class="chip lotchip" data-clot="'+p.id+'" data-lot="'+esc(r[0])+'" data-date="'+esc(r[1])+'" aria-pressed="'+(!c.manual&&c.lot===r[0])+'"><b class="mono">'+esc(r[0])+'</b><small>'+esc(r[1].slice(5).replace('-','/'))+' 生產</small></button>').join('')+
      '<button class="chip lotchip" data-cman="'+p.id+'" aria-pressed="'+c.manual+'"><b>其他批號</b><small>手動輸入</small></button></div>'+
      (c.manual?'<div class="grid" style="margin-top:8px"><label class="f">批號<input class="mono c-lot" data-pid="'+p.id+'" value="'+esc(c.lot)+'" placeholder="HP103-A" autocapitalize="characters" autocomplete="off" style="font-size:20px;text-transform:uppercase"></label><label class="f">生產日期<input type="date" class="c-date" data-pid="'+p.id+'" value="'+esc(c.date)+'"></label></div>':'')+
      '</div>'});
  h+='</div>';
  h+='<div class="sec"><label class="lbl" for="fqty">完成數量（少於訂單時，剩下的會留在看板）</label><div class="row" style="flex-wrap:nowrap"><input id="fqty" class="mono" type="number" inputmode="numeric" min="1" max="'+t.qty+'" value="'+esc(F.qty)+'" style="font-size:22px;flex:1"><span class="hint">'+esc(t.unit||'')+'</span></div></div>';
  h+='<div class="err">'+esc(F.err)+'</div><div class="row"><button id="fcancel" style="flex:1">取消</button><button id="fok" class="primary" style="flex:2;min-height:60px;font-size:18px"'+(F.busy?' disabled':'')+'>'+(F.busy?'儲存中…':'確認完成')+'</button></div></div></div>';
  const sc=$('#scrim')?$('.sheet').scrollTop:0;$('#modal').innerHTML=h;$('.sheet').scrollTop=sc;
}
$('#modal').addEventListener('input',e=>{if(!F||!F.box)return;const pid=e.target.dataset.pid;if(!pid)return;
  if(e.target.classList.contains('c-lot'))F.cont[pid].lot=e.target.value.toUpperCase().replace(/\s/g,'');
  if(e.target.classList.contains('c-date'))F.cont[pid].date=e.target.value});
async function boxConfirm(){
  const t=F.t,q=parseInt(F.qty,10),fail=m=>{F.err=m;drawBox()};
  if(!F.operator)return fail('請先點選操作人');
  for(const p of F.box){const c=F.cont[p.id];
    if(!/^[A-Z0-9]+-[A-Z]$/.test(c.lot||''))return fail('請選擇「'+shortName(p.name)+'」的批號（格式例如 HP103-A）');
    if(!c.date)return fail('請選擇「'+shortName(p.name)+'」的生產日期')}
  if(!q||q<1||q>t.qty)return fail('數量需介於 1 到 '+t.qty);
  F.busy=true;drawBox();
  try{
    const r=await api('POST','/api/tasks/'+t.id+'/finish',{operator:F.operator,qty:q,contents:F.box.map(p=>({productId:p.id,lot:F.cont[p.id].lot,date:F.cont[p.id].date}))});
    S.mine.add(t.id);F=null;$('#modal').innerHTML='';
    celebrate(t.customer,t.productName+' ×'+num(q)+(t.unit?' '+t.unit:'')+(r.rest>0?'（剩 '+num(r.rest)+' 留在看板）':''),(r.lots||[]).map(shortName));
    await refresh(true);render(true);
  }catch(e){if(F){F.busy=false;fail(e.message)}}
}

async function finishConfirm(){
  if(F.box)return boxConfirm();
  if(F.batch)return batchConfirm();
  const t=F.t,q=parseInt(F.qty,10);
  const fail=m=>{F.err=m;drawFinish()};
  if(!F.operator)return fail('請先點選操作人');
  if(!F.cat)return fail('請先選擇產品類別');
  const ce=curLotErr();if(ce)return fail(ce);
  const lots=F.lots.concat([curLot()]),tot=lots.reduce((s,l)=>s+l.qty,0);
  if(tot>t.qty)return fail('各批號數量合計 '+tot+'，超過訂單的 '+t.qty);
  F.busy=true;drawFinish();
  try{
    F_unit=t.unit||'';
    const r=await api('POST','/api/tasks/'+t.id+'/finish',{operator:F.operator,lots:lots.map(l=>({cat:l.cat,variety:l.variety,matDate:l.matDate,matArr:l.matArr,seq:l.seq,lot:l.lot,qty:l.qty}))});
    S.mine.add(t.id);F=null;$('#modal').innerHTML='';
    celebrate(t.customer,t.productName+(r.rest>0?'（剩 '+num(r.rest)+(F_unit?' '+F_unit:'')+' 留在看板）':''),r.lots||[r.lot]);
    await refresh(true);render(true);
  }catch(e){if(F){F.busy=false;fail(e.message)}}
}

/* ---------- orders ---------- */
const OF={cust:'',date:'',note:'',lines:[{p:'',q:'',u:''}]};
function resetOrderForm(){OF.urgent=false;OF.cust='';OF.date=today();OF.note='';OF.lines=[{p:'',q:'',u:''}]}
resetOrderForm();
function renderOrders(){
  const v=$('#v-orders'),prods=S.products.filter(p=>p.active!==false);
  const ed=S.editOrder?S.open.find(t=>t.id===S.editOrder):null;
  if(ed&&OF.editing!==ed.id){OF.editing=ed.id;OF.cust=ed.customer;OF.date=ed.shipDate;OF.note=ed.note||'';OF.lines=[{p:String(ed.productId||''),q:String(ed.qty),u:ed.unit||''}]}
  if(!ed&&OF.editing){OF.editing=null;resetOrderForm()}
  const names=new Set(S.customers.map(c=>c.name));S.open.concat(S.done).forEach(t=>{if(t.customer)names.add(t.customer)});
  const codeOf={};S.customers.forEach(c=>{if(c.code)codeOf[c.name]=c.code});
  let h='<div class="o-layout"><section class="o-form"><header class="pg-head"><h1>'+(ed?'修改訂單':'新增出貨訂單')+'</h1><p>'+(ed?'改完按「儲存修改」，看板會同步更新':'選客戶會列出他買過的品項，點一下就能加入')+'</p></header><form class="panel" id="oform" novalidate><div class="grid">'+
   '<label class="f" for="o-cust" style="grid-column:1/-1">客戶（輸入名稱或編號）<input id="o-cust" list="custlist" autocomplete="off" placeholder="例：全盛食品行" value="'+esc(OF.cust)+'"></label><datalist id="custlist">'+[...names].sort((a,b)=>a.localeCompare(b,'zh-Hant')).map(c=>'<option value="'+esc(c)+'">'+(codeOf[c]?esc(codeOf[c]):'')+'</option>').join('')+'</datalist>'+
   '<div id="o-hist" style="grid-column:1/-1"></div>'+
   '<div style="grid-column:1/-1;display:flex;flex-direction:column;gap:8px"><div class="lbl" style="font-size:13px;color:var(--muted)">品項、數量與單位</div><div id="o-lines" style="display:flex;flex-direction:column;gap:8px"></div>'+
   (ed?'':'<button type="button" id="o-addline" style="align-self:flex-start">＋ 新增品項</button>')+'</div>'+
   '<label class="f" for="o-date">指定出貨日<input id="o-date" type="date" value="'+esc(OF.date)+'"></label>'+
   '<label class="f" for="o-note" style="grid-column:1/-1">備註（選填，套用到這張訂單的所有品項）<input id="o-note" placeholder="外箱貼客戶標" value="'+esc(OF.note)+'"></label>'+
   (ed?'':'<button type="button" id="o-urg" class="urg-toggle" aria-pressed="'+!!OF.urgent+'" style="grid-column:1/-1"><span class="urg-box" aria-hidden="true"></span><span><b>緊急單</b><small>勾選後生產端會響警報，並排到看板最前面</small></span></button>')+'</div>'+
   '<div class="err" id="oerr"></div><div class="row"><button type="submit" class="primary" id="o-submit"></button>'+(ed?'<button type="button" id="o-cancel">取消修改</button>':'')+'</div>'+
   (prods.length?'':'<p class="hint">還沒有品項，請先到「設定」新增品項或匯入新高手資料。</p>')+'</form>';
  const lim=addDays(today(),2);
  const all=S.open.slice().sort((a,b)=>a.shipDate.localeCompare(b.shipDate)||a.customer.localeCompare(b.customer,'zh-Hant')||(a.order||0)-(b.order||0));
  const td=today(),grp={};all.forEach(t=>{(grp[t.shipDate]=grp[t.shipDate]||[]).push(t)});
  const dlabel=d=>d<td?'逾期 '+d.slice(5).replace('-','/'):d===td?'今日出貨':d===addDays(td,1)?'明日出貨':d.slice(5).replace('-','/')+' 出貨';
  h+='</section><section class="o-list"><header class="pg-head"><h1>未完成訂單</h1><p>'+(all.length?'共 '+all.length+' 筆，三天內出貨的已在看板上':'目前沒有')+'</p></header>';
  if(!all.length)h+='<div class="empty"><b>沒有未完成的訂單</b>新增的訂單會列在這裡；出貨日在三天內的會自動上看板。</div>';
  else h+=Object.keys(grp).map(d=>'<div class="ogrp'+(d<td?' g-over':d===td?' g-today':'')+'"><div class="ogrp-h"><b>'+dlabel(d)+'</b><span>'+grp[d].length+' 筆</span></div>'+
    grp[d].map(t=>'<div class="orow"><div class="orow-m"><b>'+esc(t.customer)+'</b><span>'+esc(t.productName)+'</span>'+(t.note?'<em>'+esc(t.note)+'</em>':'')+'</div>'+
      '<div class="orow-q"><b>'+num(t.qty)+'</b><span>'+esc(t.unit||'')+'</span></div>'+
      (t.urgent?'<span class="pill p-urg">緊急</span>':t.shipDate<=lim?'<span class="pill p-on">看板中</span>':'<span class="pill p-later">排隊中</span>')+
      '<div class="orow-a"><button data-ourg="'+t.id+'" data-on="'+(t.urgent?0:1)+'" class="'+(t.urgent?'':'urg-btn')+'">'+(t.urgent?'取消緊急':'設為緊急')+'</button><button data-oedit="'+t.id+'">修改</button><button class="danger" data-ovoid="'+t.id+'">取消</button></div></div>').join('')+'</div>').join('');
  h+='</section></div>';
  v.innerHTML=h;renderLines();renderHist();
}
function renderLines(focusIdx){
  const box=$('#o-lines');if(!box)return;
  const prods=S.products.filter(p=>p.active!==false),multi=OF.lines.length>1;
  box.innerHTML=OF.lines.map((l,i)=>
    '<div class="oline" data-i="'+i+'" style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px;border:1px solid var(--line);border-radius:10px;background:var(--bg)">'+
    '<span class="mono hint" style="min-width:20px">'+(i+1)+'</span>'+
    '<select class="l-prod" aria-label="品項" style="flex:1 1 260px;min-width:0"><option value="">選擇品項</option>'+prods.map(p=>'<option value="'+p.id+'"'+(String(p.id)===l.p?' selected':'')+'>'+esc(prodLabel(p))+'</option>').join('')+'</select>'+
    '<div class="row" style="flex-wrap:nowrap;gap:6px;flex:0 1 auto"><input class="l-qty mono" type="number" inputmode="numeric" min="1" placeholder="數量" aria-label="數量" value="'+esc(l.q)+'" style="width:96px">'+
    UNITS.map(u=>'<button type="button" class="chip" data-lu="'+u+'" aria-pressed="'+(l.u===u)+'" style="min-height:48px;padding:6px 12px">'+u+'</button>').join('')+
    (multi?'<button type="button" data-ldel="'+i+'" aria-label="刪除這一行" style="padding:6px 12px;color:var(--red)">✕</button>':'')+'</div></div>').join('');
  const n=OF.lines.length,sb=$('#o-submit');
  if(sb)sb.textContent=S.editOrder?'儲存修改':(n>1?'加入排程（'+n+' 個品項）':'加入排程');
  if(focusIdx!=null){const s=box.querySelectorAll('.l-prod')[focusIdx];if(s)s.focus()}
  markHist();
}
function markHist(){const set=new Set(OF.lines.map(l=>l.p));document.querySelectorAll('#o-hist [data-pick]').forEach(x=>x.setAttribute('aria-pressed',String(set.has(x.dataset.pick))))}
function prodLabel(p){return (p.code?p.code+'　':'')+p.name+(p.cat?'':'（未設類別）')}
function resolveCustomer(v){v=(v||'').trim();if(!v)return '';const byCode=S.customers.find(c=>c.code&&c.code.toLowerCase()===v.toLowerCase());return byCode?byCode.name:v}
function renderHist(){
  const box=$('#o-hist');if(!box)return;const inp=$('#o-cust');
  const name=resolveCustomer(inp.value);
  if(name!==inp.value.trim()&&name){inp.value=name;OF.cust=name}
  if(!name){box.innerHTML='';return}
  const items=S.history.filter(h=>h[0]===name).map(h=>({p:S.products.find(p=>p.id===h[1]),times:h[2]})).filter(x=>x.p&&x.p.active!==false);
  if(!items.length){box.innerHTML='<p class="hint">'+(S.customers.some(c=>c.name===name)?'這個客戶還沒有品項紀錄。':'新客戶，第一次下單後系統會記住買過的品項。')+'</p>';return}
  box.innerHTML='<div class="lbl hint" style="margin-bottom:6px">'+esc(name)+' 買過的品項（點一下加入訂單，可點多個）</div><div class="chips">'+items.map(x=>
    '<button type="button" class="chip hist" data-pick="'+x.p.id+'"><span class="mono">'+esc(x.p.code||'')+'</span> '+esc(x.p.name)+' <span class="hint">×'+x.times+'</span></button>').join('')+'</div>';
  markHist();
}
function lineIdx(el){const l=el.closest('.oline');return l?+l.dataset.i:-1}
$('#v-orders').addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='o-cust'){OF.cust=t.value;renderHist()}
  else if(t.id==='o-date')OF.date=t.value;
  else if(t.id==='o-note')OF.note=t.value;
  else if(t.classList.contains('l-qty')){const i=lineIdx(t);if(i>=0)OF.lines[i].q=t.value}
});
$('#v-orders').addEventListener('change',e=>{
  const t=e.target;
  if(t.id==='o-date')OF.date=t.value;
  if(t.classList.contains('l-prod')){const i=lineIdx(t);if(i<0)return;OF.lines[i].p=t.value;
    if(t.value)OF.lines[i].u=guessUnit(S.products.find(p=>String(p.id)===t.value));
    renderLines();const q=$('#o-lines').querySelectorAll('.l-qty')[i];if(q)q.focus()}
});
$('#v-orders').addEventListener('submit',async e=>{
  e.preventDefault();
  const err=m=>{$('#oerr').textContent=m};
  const customer=resolveCustomer(OF.cust),shipDate=OF.date,note=OF.note.trim();
  if(!customer)return err('請輸入客戶名稱');
  if(!shipDate)return err('請選擇出貨日');
  const lines=OF.lines.filter(l=>l.p||l.q);
  if(!lines.length)return err('請至少選一個品項');
  for(let i=0;i<lines.length;i++){const l=lines[i],n='第 '+(OF.lines.indexOf(l)+1)+' 行：';
    if(!l.p)return err(n+'請選擇品項');if(!(+l.q>0))return err(n+'數量需大於 0');if(!l.u)return err(n+'請選擇單位（桶、箱、瓶）')}
  const id=S.editOrder;
  const r=await act(()=>id?api('PUT','/api/tasks/'+id,{customer,productId:lines[0].p,qty:lines[0].q,unit:lines[0].u,shipDate,note})
    :api('POST','/api/tasks/batch',{customer,shipDate,note,urgent:!!OF.urgent,items:lines.map(l=>({productId:l.p,qty:l.q,unit:l.u}))}),
    id?'訂單已更新':(OF.urgent?'緊急單已送出，生產端正在響警報':'已加入排程（'+lines.length+' 個品項）'));
  if(r&&r.ids)r.ids.forEach(i=>S.ack.add(i+':*'));saveAck();
  if(r){S.editOrder=null;OF.editing=null;resetOrderForm();document.activeElement&&document.activeElement.blur();renderOrders()}
});
$('#v-orders').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.lu){const i=lineIdx(b);if(i>=0){OF.lines[i].u=b.dataset.lu;b.parentElement.querySelectorAll('[data-lu]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)))}return}
  if(b.dataset.ldel!==undefined){OF.lines.splice(+b.dataset.ldel,1);if(!OF.lines.length)OF.lines.push({p:'',q:'',u:''});renderLines();return}
  if(b.id==='o-addline'){OF.lines.push({p:'',q:'',u:''});renderLines(OF.lines.length-1);return}
  if(b.dataset.pick){const pid=b.dataset.pick,ex=OF.lines.findIndex(l=>l.p===pid);
    if(ex>=0){const q=$('#o-lines').querySelectorAll('.l-qty')[ex];if(q)q.focus();return}
    if(S.editOrder){OF.lines[0].p=pid;OF.lines[0].u=guessUnit(S.products.find(p=>String(p.id)===pid));renderLines();return}
    let i=OF.lines.findIndex(l=>!l.p);if(i<0){OF.lines.push({p:'',q:'',u:''});i=OF.lines.length-1}
    OF.lines[i].p=pid;OF.lines[i].u=guessUnit(S.products.find(p=>String(p.id)===pid));renderLines();
    const q=$('#o-lines').querySelectorAll('.l-qty')[i];if(q)q.focus();return}
  if(b.id==='o-urg'){OF.urgent=!OF.urgent;b.setAttribute('aria-pressed',String(OF.urgent));if(OF.urgent)Snd.play('tap');return}
  if(b.dataset.ourg){const on=b.dataset.on==='1';if(on)S.ack.add(b.dataset.ourg+':*');saveAck();
    await act(()=>api('POST','/api/tasks/'+b.dataset.ourg+'/urgent',{on}),on?'已設為緊急單，生產端正在響警報':'已取消緊急');return}
  if(b.dataset.oedit){S.editOrder=+b.dataset.oedit;renderOrders();window.scrollTo({top:0,behavior:'smooth'})}
  else if(b.id==='o-cancel'){S.editOrder=null;renderOrders()}
  else if(b.dataset.ovoid){if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='再按一次確認';return}
    await act(()=>api('POST','/api/tasks/'+b.dataset.ovoid+'/void'),'訂單已取消')}
});

/* ---------- records ---------- */
function renderRecords(){
  const v=$('#v-records'),q=S.q.trim().toLowerCase();
  const rows=S.done.filter(t=>!q||[t.lot,t.customer,t.productName,t.operator,(t.matDate||'')+(t.matArr||''),(t.contents||[]).map(c=>c.lot+' '+c.name).join(' ')].join(' ').toLowerCase().includes(q));
  let h='<header class="pg-head"><h1>生產紀錄</h1><p>用批號、客戶或原料批反查，每一筆都有完成時間與操作人</p></header><div class="row rec-bar"><input id="rq" placeholder="搜尋批號、客戶、品項、原料批（例：0913B）" value="'+esc(S.q)+'" style="flex:1;min-width:220px">'+
    '<a class="btnlink" href="/api/export.csv'+(S.pin?'?pin='+encodeURIComponent(S.pin):'')+'">匯出 Excel（CSV）</a></div>';
  if(!S.done.length)h+='<div class="empty"><b>還沒有生產紀錄</b>在看板上按「完成生產」後，紀錄會出現在這裡，可以用批號回查。</div>';
  else h+='<p class="hint">共 '+rows.length+' 筆</p><div class="tbl-wrap"><table><thead><tr><th>完成時間</th><th>批號</th><th>品項</th><th>數量</th><th>客戶</th><th>出貨日</th><th>操作人</th><th></th></tr></thead><tbody>'+rows.map(t=>
   '<tr><td class="mono">'+fmtTime(t.completedAt)+'</td><td class="lotcell">'+(t.contents?t.contents.map(c=>'<div><span class="stamp sm">'+esc(c.lot)+'</span> <span class="hint" style="font-family:var(--f-body);font-weight:400">'+esc(shortName(c.name))+'　'+esc(c.date.slice(5).replace('-','/'))+'</span></div>').join(''):'<span class="stamp">'+esc(t.lot)+'</span>')+(t.lotHistory&&t.lotHistory.length?'<div class="hint">曾修改 '+t.lotHistory.length+' 次</div>':'')+'</td><td>'+esc(t.productName)+'</td><td class="mono">'+qtyU(t)+(t.orderedQty&&t.orderedQty!==t.qty?'<div class="hint">訂單 '+num(t.orderedQty)+'</div>':'')+'</td><td>'+esc(t.customer)+'</td><td class="mono">'+esc(t.shipDate)+'</td><td>'+esc(t.operator)+'</td>'+
   '<td>'+(t.contents?'<span class="pill p-box">禮盒</span>':'<button data-rlot="'+t.id+'">改批號</button>')+'</td></tr>').join('')+'</tbody></table></div>';
  v.innerHTML=h;
}
$('#v-records').addEventListener('input',e=>{if(e.target.id==='rq'){S.q=e.target.value;const pos=e.target.selectionStart;renderRecords();const n=$('#rq');n.focus();n.setSelectionRange(pos,pos)}});
$('#v-records').addEventListener('click',e=>{const b=e.target.closest('button[data-rlot]');if(!b)return;const t=S.done.find(x=>x.id===+b.dataset.rlot);if(t)openLotEdit(t)});
function openLotEdit(t){
  $('#modal').innerHTML='<div class="scrim" id="lscrim"><form class="sheet" id="lform" role="dialog" aria-modal="true" aria-label="修改批號"><div class="pname">修改批號</div><div class="hint">'+esc(t.productName)+' × '+qtyU(t)+'　'+esc(t.customer)+'</div>'+
  '<label class="f" for="lnew">新批號<input id="lnew" class="mono" autocomplete="off" style="font-size:24px;text-transform:uppercase" value="'+esc(t.lot)+'"></label>'+
  '<p class="hint">修改後會留下紀錄：原批號、新批號、修改時間。</p>'+
  (t.lotHistory&&t.lotHistory.length?'<div class="hint">'+t.lotHistory.map(h=>fmtTime(h.at)+'：'+esc(h.from)+' → '+esc(h.to)).join('<br>')+'</div>':'')+
  '<div class="err" id="lerr"></div><div class="row"><button type="button" id="lcancel" style="flex:1">取消</button><button type="submit" class="primary" style="flex:2">儲存</button></div></form></div>';
  const close=()=>{$('#modal').innerHTML='';render(true)};
  $('#lscrim').onclick=e=>{if(e.target.id==='lscrim')close()};$('#lcancel').onclick=close;
  $('#lform').onsubmit=async e=>{e.preventDefault();const nv=$('#lnew').value.trim().toUpperCase();
    if(nv===t.lot)return close();
    try{await api('POST','/api/tasks/'+t.id+'/lot',{lot:nv});close();toast('批號已改為 '+nv);refresh(true)}catch(err){$('#lerr').textContent=err.message}};
}

/* ---------- settings ---------- */
function renderSettings(){
  const v=$('#v-settings'),c=cfg();
  let h='<header class="pg-head"><h1>設定</h1><p>人員、品項主檔、批號規則都在這裡，改了所有裝置立刻同步</p></header><h2>人員名單</h2><div class="panel"><div class="chips" style="margin-bottom:12px">'+((c.people||[]).map((n,i)=>'<button class="chip" data-delp="'+i+'" title="移除">'+esc(n)+'　×</button>').join('')||'<span class="hint">還沒有人員，新增後在看板完成生產時可以點選。</span>')+'</div>'+
   '<div class="row"><input id="s-person" placeholder="輸入姓名" style="flex:1;min-width:160px"><button id="s-addp" class="primary">新增人員</button></div></div>';
  h+='<h2>匯入新高手銷貨紀錄</h2><div class="panel"><p class="hint" style="margin-top:0">從新高手匯出的 CSV 或 Excel 另存的 CSV。欄位順序：客戶名稱、品號、品名（或：客戶編號、客戶名稱、品號、品名）。重複匯入不會產生重複資料。</p>'+
   '<div class="row"><input id="s-imp" type="file" accept=".csv,text/csv" style="flex:1;min-width:200px"><button id="s-impgo" class="primary">匯入</button></div><div class="err" id="imperr"></div><div id="impres" class="hint"></div></div>';
  h+='<h2>品項主檔</h2><div class="panel"><div class="grid">'+
   '<label class="f" for="s-pcode">品號（選填）<input id="s-pcode" class="mono" placeholder="TS-H18"></label>'+
   '<label class="f" for="s-pname">品名／規格<input id="s-pname" placeholder="龍眼蜂蜜 700g"></label>'+
   '<label class="f" for="s-pcat">類別<select id="s-pcat">'+Object.keys(c.cats).map(k=>'<option value="'+esc(k)+'">'+esc(k)+' '+esc(c.cats[k].name)+'</option>').join('')+'</select></label>'+
   '<label class="f" for="s-pvar">品種<select id="s-pvar"></select></label></div><div class="err" id="perr"></div><button id="s-addprod" class="primary">新增品項</button></div>';
  const missing=S.products.filter(p=>!p.cat&&p.active!==false).length,pq=S.pq.trim().toLowerCase();
  const prods=S.products.filter(p=>(!S.pOnlyMissing||!p.cat)&&(!pq||((p.code||'')+' '+p.name).toLowerCase().includes(pq)));
  if(S.products.length){
    h+='<div class="row" style="margin-top:12px"><input id="s-pq" placeholder="搜尋品號或品名" value="'+esc(S.pq)+'" style="flex:1;min-width:180px"><button id="s-pmiss" aria-pressed="'+S.pOnlyMissing+'" class="chip">只看未設類別'+(missing?'（'+missing+'）':'')+'</button></div>';
    if(missing)h+='<p class="warn">有 '+missing+' 個品項還沒設定類別。設定後，看板完成生產時就會自動帶出正確的批號規則。</p>';
    h+='<div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>品號</th><th>品名／規格</th><th>類別</th><th>品種</th><th>禮盒內容物</th><th></th></tr></thead><tbody>'+prods.map(p=>{
      const vv=(c.varieties||{})[p.cat]||{},isMat=(c.cats[p.cat]||{}).rule==='material';
      const comps=boxComps(p.id);
      if(comps.length)return '<tr'+(p.active===false?' class="dim"':'')+'><td class="mono">'+esc(p.code||'')+'</td><td>'+esc(p.name)+'</td><td colspan="2"><span class="pill p-box">禮盒，不需批號</span></td>'+
        '<td>'+esc(comps.map(x=>shortName(x.name)).join('＋'))+' <button data-pbox="'+p.id+'">編輯</button></td><td><button data-ptoggle="'+p.id+'">'+(p.active===false?'恢復':'停用')+'</button></td></tr>';
      return '<tr'+(p.active===false?' class="dim"':'')+' data-pid="'+p.id+'"><td class="mono">'+esc(p.code||'')+'</td><td>'+esc(p.name)+'</td>'+
       '<td><select class="pcat" aria-label="類別"><option value="">未設定</option>'+Object.keys(c.cats).map(k=>'<option value="'+esc(k)+'"'+(p.cat===k?' selected':'')+'>'+esc(k)+' '+esc(c.cats[k].name)+'</option>').join('')+'</select></td>'+
       '<td>'+(!p.cat?'':isMat?'<span class="hint">不需要</span>':'<select class="pvar" aria-label="品種"><option value="">選擇</option>'+Object.keys(vv).map(k=>'<option value="'+esc(k)+'"'+(p.variety===k?' selected':'')+'>'+esc(k)+' '+esc(vv[k])+'</option>').join('')+'</select>')+'</td>'+
       '<td><button data-pbox="'+p.id+'"'+(/禮盒|組/.test(p.name)?'':' class="quiet"')+'>設為禮盒</button></td><td><button data-ptoggle="'+p.id+'">'+(p.active===false?'恢復':'停用')+'</button></td></tr>'}).join('')+'</tbody></table></div>';
  }
  h+='<h2>類別與品種代碼</h2><div class="tbl-wrap"><table><thead><tr><th>類別</th><th>名稱</th><th>批號規則</th><th>批號方式</th><th>品種代碼</th></tr></thead><tbody>'+Object.keys(c.cats).map(k=>{const vv=(c.varieties||{})[k]||{};
   return '<tr><td class="mono" style="font-weight:600">'+esc(k)+'</td><td>'+esc(c.cats[k].name)+'</td><td>'+(c.cats[k].rule==='material'?'原料批型（看'+esc(c.cats[k].mat||'主原料')+'有效日）':'月份型')+'</td><td><select class="cauto" data-cat="'+esc(k)+'" aria-label="'+esc(k)+' 批號方式"><option value="0"'+(c.cats[k].auto?'':' selected')+'>手動輸入</option><option value="1"'+(c.cats[k].auto?' selected':'')+'>系統鎖定</option></select></td><td>'+(Object.keys(vv).map(n=>esc(n)+' '+esc(vv[n])).join('、')||'<span class="hint">無</span>')+'</td></tr>'}).join('')+'</tbody></table></div>'+
   '<div class="panel" style="margin-top:12px"><div class="grid"><label class="f" for="s-vcat">新增品種到類別<select id="s-vcat">'+Object.keys(c.cats).map(k=>'<option value="'+esc(k)+'">'+esc(k)+' '+esc(c.cats[k].name)+'</option>').join('')+'</select></label>'+
   '<label class="f" for="s-vcode">代碼<input id="s-vcode" class="mono" placeholder="5" maxlength="2"></label><label class="f" for="s-vname">名稱<input id="s-vname" placeholder="咖啡蜜"></label></div><div class="err" id="verr"></div><button id="s-addvar" class="primary">新增品種</button></div>'+
   '<div class="panel" style="margin-top:12px"><div class="grid"><label class="f" for="s-ccode">新增類別字母<input id="s-ccode" class="mono" placeholder="K" maxlength="1"></label><label class="f" for="s-cname">名稱<input id="s-cname" placeholder="蜂王乳"></label>'+
   '<label class="f" for="s-crule">批號規則<select id="s-crule"><option value="month">月份型</option><option value="material">原料批型</option></select></label><label class="f" for="s-cmat">主原料（原料批型才需要）<input id="s-cmat" placeholder="果糖"></label></div><div class="err" id="cerr"></div><button id="s-addcat" class="primary">新增類別</button></div>';
  v.innerHTML=h;fillVarSelect();
}
function fillVarSelect(){const s=$('#s-pvar');if(!s)return;const cat=$('#s-pcat').value,vv=(cfg().varieties||{})[cat]||{},r=(cfg().cats[cat]||{}).rule;
  s.innerHTML=r==='material'?'<option value="">不需要（原料批型）</option>':Object.keys(vv).map(k=>'<option value="'+esc(k)+'">'+esc(k)+' '+esc(vv[k])+'</option>').join('')}
$('#v-settings').addEventListener('change',async e=>{
  if(e.target.id==='s-pcat')return fillVarSelect();
  if(e.target.classList.contains('cauto')){const c=JSON.parse(JSON.stringify(cfg())),k=e.target.dataset.cat;if(e.target.value==='1')c.cats[k].auto=true;else delete c.cats[k].auto;
    return act(()=>api('PUT','/api/config',c),k+' '+c.cats[k].name+'：'+(e.target.value==='1'?'系統鎖定批號':'手動輸入批號'))}
  const tr=e.target.closest('tr[data-pid]');if(!tr)return;
  const id=tr.dataset.pid,catSel=tr.querySelector('.pcat'),cat=catSel.value,cc=cfg().cats[cat];
  if(e.target.classList.contains('pcat')){
    if(!cat||(cc&&cc.rule==='material')){e.target.blur();await act(()=>api('PUT','/api/products/'+id,{cat,variety:''}),'已更新');return}
    const vv=(cfg().varieties||{})[cat]||{};const td=catSel.closest('td').nextElementSibling;
    td.innerHTML='<select class="pvar" aria-label="品種"><option value="">選擇品種</option>'+Object.keys(vv).map(k=>'<option value="'+esc(k)+'">'+esc(k)+' '+esc(vv[k])+'</option>').join('')+'</select>';
    td.querySelector('select').focus();return}
  if(e.target.classList.contains('pvar')&&e.target.value){const variety=e.target.value;e.target.blur();await act(()=>api('PUT','/api/products/'+id,{cat,variety}),'已更新')}
});
$('#v-settings').addEventListener('input',e=>{if(e.target.id==='s-pq'){S.pq=e.target.value;const pos=e.target.selectionStart;renderSettings();const n=$('#s-pq');n.focus();n.setSelectionRange(pos,pos)}});
function decodeFile(buf){try{return new TextDecoder('utf-8',{fatal:true}).decode(buf)}catch(e){return new TextDecoder('big5').decode(buf)}}
function parseCSV(text){const rows=[];let row=[],f='',q=false;text=text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){const ch=text[i];
    if(q){if(ch==='"'){if(text[i+1]==='"'){f+='"';i++}else q=false}else f+=ch}
    else if(ch==='"')q=true;else if(ch===','){row.push(f);f=''}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(f);rows.push(row);row=[];f=''}else f+=ch}
  if(f||row.length){row.push(f);rows.push(row)}return rows.filter(r=>r.some(x=>x.trim()))}
async function runImport(){
  const f=$('#s-imp').files[0],err=$('#imperr');err.textContent='';
  if(!f)return err.textContent='請先選擇檔案';
  if(/\.xlsx?$/i.test(f.name))return err.textContent='請在 Excel 用「另存新檔 → CSV」存成 CSV 再匯入';
  const rows=parseCSV(decodeFile(await f.arrayBuffer())).map(r=>r.map(x=>x.trim()));
  const data=rows.map(r=>r.length>=4?{customerCode:r[0],customer:r[1],code:r[2],name:r[3]}:{customer:r[0],code:r[1],name:r[2]})
    .filter(r=>r.customer&&r.code&&r.name&&!/品號|品名/.test(r.code+r.name));
  if(!data.length)return err.textContent='檔案裡找不到可用的資料，請確認欄位是客戶、品號、品名';
  $('#impres').textContent='匯入中…（'+data.length+' 筆）';
  const r=await act(()=>api('POST','/api/import-history',{rows:data}));
  if(r)$('#impres').textContent='完成：'+r.customers+' 位客戶、'+r.products+' 個品項（新增 '+r.newProducts+' 個，其中 '+r.guessed+' 個已依品名自動分類、'+r.hidden+' 個非生產品項已停用）、'+r.pairs+' 組客戶與品項對應。請到品項主檔檢查分類。略過 '+(rows.length-data.length)+' 筆缺少品號的資料。';
  else $('#impres').textContent='';
}
$('#v-settings').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;const c=JSON.parse(JSON.stringify(cfg()));c.people=c.people||[];c.varieties=c.varieties||{};
  const saveCfg=msg=>act(()=>api('PUT','/api/config',c),msg);
  if(b.id==='s-impgo'){b.focus();return runImport()}
  if(b.dataset.pbox){return openBoxEditor(+b.dataset.pbox)}
  if(b.id==='s-pmiss'){S.pOnlyMissing=!S.pOnlyMissing;return renderSettings()}
  if(b.id==='s-addp'){const n=$('#s-person').value.trim();if(!n)return;if(c.people.includes(n))return toast(n+' 已在名單中');c.people.push(n);b.focus();await saveCfg('已新增 '+n)}
  else if(b.dataset.delp!==undefined){if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='再按一次移除';return}c.people.splice(+b.dataset.delp,1);await saveCfg('已移除')}
  else if(b.id==='s-addprod'){const code=$('#s-pcode').value.trim(),name=$('#s-pname').value.trim(),cat=$('#s-pcat').value,variety=$('#s-pvar').value;
    if(!name)return $('#perr').textContent='請輸入品名／規格';
    if(c.cats[cat].rule!=='material'&&!variety)return $('#perr').textContent='這個類別還沒有品種代碼，請先在下方新增';
    b.focus();await act(()=>api('POST','/api/products',{code,name,cat,variety}),'已新增品項 '+name)}
  else if(b.dataset.ptoggle){await act(()=>api('POST','/api/products/'+b.dataset.ptoggle+'/toggle'),'已更新')}
  else if(b.id==='s-addvar'){const cat=$('#s-vcat').value,code=$('#s-vcode').value.trim().toUpperCase(),name=$('#s-vname').value.trim();
    if(!/^[0-9A-Z]{1,2}$/.test(code)||!name)return $('#verr').textContent='請輸入代碼（1～2 碼）與名稱';
    c.varieties[cat]=c.varieties[cat]||{};if(c.varieties[cat][code])return $('#verr').textContent=cat+code+' 已經是 '+c.varieties[cat][code];
    c.varieties[cat][code]=name;b.focus();await saveCfg('已新增 '+cat+code+' '+name)}
  else if(b.id==='s-addcat'){const code=$('#s-ccode').value.trim().toUpperCase(),name=$('#s-cname').value.trim(),r=$('#s-crule').value,mat=$('#s-cmat').value.trim();
    if(!/^[A-Z]$/.test(code)||!name)return $('#cerr').textContent='請輸入一個英文字母與名稱';
    if(c.cats[code])return $('#cerr').textContent=code+' 已經是 '+c.cats[code].name;
    c.cats[code]={name,rule:r};if(r==='material')c.cats[code].mat=mat||'主原料';b.focus();await saveCfg('已新增類別 '+code)}
});

/* ---------- start ---------- */
S.pin=store.get('tsb_pin');
fetch('/api/auth-required').then(r=>r.json()).then(r=>{if(r.required&&!S.pin)showPin();else startPolling()}).catch(()=>startPolling());
render(true);
/* ---------- gift box editor ---------- */
let BX=null;
function openBoxEditor(id){const p=S.products.find(x=>x.id===id);if(!p)return;BX={p,ids:(p.components||[]).slice()};drawBoxEditor()}
function drawBoxEditor(){
  const opts=S.products.filter(x=>x.id!==BX.p.id&&!(x.components||[]).length&&x.active!==false&&!BX.ids.includes(x.id)&&x.cat);
  $('#modal').innerHTML='<div class="scrim" id="bxscrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="禮盒內容物"><div class="pname">'+esc(BX.p.name)+'</div>'+
   '<p class="hint" style="margin:0">設定這個禮盒裝了哪些產品。完成生產時，禮盒本身不給批號，改為每個內容物點選它的批號與生產日期。全部移除就變回一般品項。</p>'+
   '<div style="display:flex;flex-direction:column;gap:6px">'+(BX.ids.length?BX.ids.map((id,i)=>{const x=S.products.find(p=>p.id===id)||{name:'?'};return '<div class="row" style="justify-content:space-between;flex-wrap:nowrap;background:var(--surface);border:1px solid var(--line);border-radius:10px;padding:8px 12px"><span style="min-width:0"><span class="mono hint">'+esc(x.code||'')+'</span> '+esc(x.name)+'</span><button type="button" data-bxdel="'+i+'" aria-label="移除" style="min-height:40px;padding:4px 12px;color:var(--red)">✕</button></div>'}).join(''):'<div class="hint">還沒有內容物</div>')+'</div>'+
   '<div class="row" style="flex-wrap:nowrap"><select id="bxadd" style="flex:1;min-width:0"><option value="">選擇要加入的內容物</option>'+opts.map(x=>'<option value="'+x.id+'">'+esc((x.code?x.code+'　':'')+x.name)+'</option>').join('')+'</select><button type="button" id="bxaddgo">加入</button></div>'+
   '<div class="err" id="bxerr"></div><div class="row"><button type="button" id="bxcancel" style="flex:1">取消</button><button type="button" id="bxsave" class="primary" style="flex:2">儲存</button></div></div></div>';
}
$('#modal').addEventListener('click',async e=>{
  if(!BX)return;const b=e.target.closest('button');
  if(e.target.id==='bxscrim'||(b&&b.id==='bxcancel')){BX=null;$('#modal').innerHTML='';return render(true)}
  if(!b)return;
  if(b.id==='bxaddgo'){const v=+$('#bxadd').value;if(v){BX.ids.push(v);drawBoxEditor()}}
  else if(b.dataset.bxdel!==undefined){BX.ids.splice(+b.dataset.bxdel,1);drawBoxEditor()}
  else if(b.id==='bxsave'){try{await api('PUT','/api/products/'+BX.p.id+'/components',{ids:BX.ids});BX=null;$('#modal').innerHTML='';toast('禮盒內容物已儲存');await refresh(true);render(true)}catch(err){$('#bxerr').textContent=err.message}}
});

})();
