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
function clockHTML(){const d=new Date();return '<b>'+pad(d.getHours())+'<i>:</i>'+pad(d.getMinutes())+'</b><s>'+pad(d.getSeconds())+'</s>'}
setInterval(()=>{const c=document.getElementById('bdclock');if(c&&!document.hidden)c.innerHTML=clockHTML()},1000);
/* KPI numbers roll from their previous value */
const PREV={};
function countUp(){document.querySelectorAll('[data-count]').forEach(el=>{const k=el.dataset.count,to=+el.textContent,from=PREV[k];PREV[k]=to;
  if(from==null||from===to||isNaN(to))return;const t0=performance.now(),dur=900;el.classList.add('rolling');
  const step=t=>{const p=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-p,3);el.textContent=Math.round(from+(to-from)*e);if(p<1)requestAnimationFrame(step);else el.classList.remove('rolling')};requestAnimationFrame(step)})}
/* live ticker on the board */
let TK='';
function updateTicker(doneToday){const box=document.getElementById('ticker');if(!box)return;
  const items=[];const urg=S.open.filter(t=>t.urgent);
  urg.forEach(t=>items.push('<span class="tk-i tk-u">緊急單｜'+esc(t.customer)+'　'+esc(shortName(t.productName))+' '+num(t.qty)+esc(t.unit||'')+'</span>'));
  doneToday.slice(0,12).forEach(t=>items.push('<span class="tk-i"><em>'+fmtTime(t.completedAt).split(' ')[1]+'</em>'+esc(t.customer)+'　'+esc(shortName(t.productName))+' '+num(t.qty)+esc(t.unit||'')+'　<b>'+esc(t.lot)+'</b>　完成</span>'));
  const nx=boardTasks()[0];if(nx)items.unshift('<span class="tk-i tk-n">現在生產｜'+esc(nx.customer)+'　'+esc(shortName(nx.productName))+' '+num(nx.qty)+esc(nx.unit||'')+'</span>');
  if(!doneToday.length)items.push('<span class="tk-i">今天還沒有完成紀錄，加油！</span>');
  const html=items.join('');if(html===TK)return;TK=html;
  const dur=Math.max(24,items.length*7);
  box.innerHTML='<span class="tk-live"><i></i>即時</span><div class="tk-track"><div class="tk-move" style="animation-duration:'+dur+'s">'+html+html+'</div></div>'}
/* ambient honeycomb particles */
const FX={run(){const c=document.getElementById('fx');if(!c||!c.getContext||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const g=c.getContext('2d');let W,H,ps=[];const dpr=Math.min(2,window.devicePixelRatio||1);
  const size=()=>{W=c.width=innerWidth*dpr;H=c.height=innerHeight*dpr;c.style.width=innerWidth+'px';c.style.height=innerHeight+'px'};size();addEventListener('resize',size);
  const N=innerWidth<760?16:34;for(let i=0;i<N;i++)ps.push({x:Math.random(),y:Math.random(),r:6+Math.random()*22,v:.00006+Math.random()*.00018,a:Math.random()*6.28,s:(Math.random()-.5)*.002,o:.05+Math.random()*.18,tw:Math.random()*6.28});
  const hexP=(x,y,r,a)=>{g.beginPath();for(let k=0;k<6;k++){const t=a+k*Math.PI/3;g.lineTo(x+r*Math.cos(t),y+r*Math.sin(t))}g.closePath()};
  let last=0;const loop=t=>{requestAnimationFrame(loop);if(document.hidden||t-last<40)return;last=t;g.clearRect(0,0,W,H);
    for(const p of ps){p.y-=p.v*40;p.a+=p.s;p.tw+=.03;if(p.y<-.05){p.y=1.05;p.x=Math.random()}
      const al=p.o*(.6+.4*Math.sin(p.tw)),X=p.x*W,Y=p.y*H,R=p.r*dpr;
      hexP(X,Y,R,p.a);g.strokeStyle='rgba(242,179,61,'+al+')';g.lineWidth=1.4*dpr;g.stroke();
      if(p.r<10){g.fillStyle='rgba(255,212,126,'+(al*.8)+')';g.fill()}}};
  requestAnimationFrame(loop)}};
FX.run();

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
/* cinematic "red alert" klaxon: sub-bass hit + harsh rising whoop, in a big reverberant hall */
const Siren={on:false,iv:null,bus:null,
  build(c){const m=c.createGain();m.gain.value=0.0001;const comp=c.createDynamicsCompressor();comp.threshold.value=-10;comp.ratio.value=6;
    const rev=c.createConvolver(),len=c.sampleRate*2.2,ir=c.createBuffer(2,len,c.sampleRate);
    for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);for(let i=0;i<len;i++)d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6)}
    rev.buffer=ir;const wet=c.createGain();wet.gain.value=0.35;
    const dist=c.createWaveShaper(),k=28,n=1024,cv=new Float32Array(n);for(let i=0;i<n;i++){const x=i*2/n-1;cv[i]=(3+k)*x*20*Math.PI/180/(Math.PI+k*Math.abs(x))}dist.curve=cv;
    dist.connect(m);dist.connect(rev);rev.connect(wet);wet.connect(m);m.connect(comp);comp.connect(c.destination);return {m,dist}},
  whoop(){const c=Snd.ctx;if(!c||!this.bus)return;const t=c.currentTime+0.02,{dist}=this.bus;
    // sub-bass hit
    const sub=c.createOscillator(),sg=c.createGain();sub.type='sine';sub.frequency.setValueAtTime(90,t);sub.frequency.exponentialRampToValueAtTime(38,t+0.5);
    sg.gain.setValueAtTime(0.0001,t);sg.gain.exponentialRampToValueAtTime(0.9,t+0.02);sg.gain.exponentialRampToValueAtTime(0.0001,t+0.6);sub.connect(sg);sg.connect(this.bus.m);sub.start(t);sub.stop(t+0.65);
    // rising klaxon whoop (two detuned harsh voices)
    [['sawtooth',0],['square',7],['sawtooth',-9]].forEach(([type,det])=>{const o=c.createOscillator(),g=c.createGain();o.type=type;o.detune.value=det*10;
      o.frequency.setValueAtTime(260,t);o.frequency.exponentialRampToValueAtTime(980,t+0.78);o.frequency.exponentialRampToValueAtTime(900,t+0.92);
      g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(0.16,t+0.05);g.gain.setValueAtTime(0.16,t+0.8);g.gain.exponentialRampToValueAtTime(0.0001,t+0.98);
      o.connect(g);g.connect(dist);o.start(t);o.stop(t+1.02)})},
  start(){Snd.unlock();const c=Snd.ctx;if(!c||this.on)return;try{if(!this.bus)this.bus=this.build(c);
    this.bus.m.gain.cancelScheduledValues(c.currentTime);this.bus.m.gain.setTargetAtTime(0.75,c.currentTime,0.05);
    this.on=true;this.whoop();this.iv=setInterval(()=>this.whoop(),1250)}catch(e){}},
  stop(){if(!this.on)return;this.on=false;clearInterval(this.iv);const c=Snd.ctx;try{this.bus.m.gain.setTargetAtTime(0.0001,c.currentTime,0.12)}catch(e){}}};
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

/* ---------- order inbox: new / changed / cancelled orders ring on the production side until someone taps 接單 ---------- */
S.mineO=new Set();S.inbox=[];S.flag={};S.known=null;
try{const k=JSON.parse(store.get('tsb_known')||'null');if(k&&k.v===1)S.known=k.m}catch(e){}
try{S.inbox=JSON.parse(store.get('tsb_inbox')||'[]')||[]}catch(e){S.inbox=[]}
try{S.flag=JSON.parse(store.get('tsb_flag')||'{}')||{}}catch(e){S.flag={}}
const saveInbox=()=>{store.set('tsb_inbox',JSON.stringify(S.inbox.slice(-60)));store.set('tsb_flag',JSON.stringify(S.flag))};
const oSnap=t=>({c:t.customer,p:t.productName,q:t.qty,u:t.unit||'',d:t.shipDate,n:t.note||'',m:t.shipMethod||''});
const oLite=t=>({customer:t.customer,productName:t.productName,qty:t.qty,unit:t.unit||'',shipDate:t.shipDate,shipMethod:t.shipMethod||'',note:t.note||'',urgent:!!t.urgent});
const qU=(q,u)=>num(q)+(u?' '+u:'');
function oDiff(o,n){const d=[];
  if(o.c!==n.c)d.push(['客戶',o.c,n.c]);
  if(o.p!==n.p)d.push(['品項',o.p,n.p]);
  if(o.q!==n.q||o.u!==n.u)d.push(['數量',qU(o.q,o.u),qU(n.q,n.u)]);
  if(o.d!==n.d)d.push(['出貨日',o.d,n.d]);
  if(o.m!==n.m)d.push(['出貨方式',o.m||'未選',n.m||'未選']);
  if(o.n!==n.n)d.push(['備註',o.n||'（無）',n.n||'（無）']);
  return d}
function detectOrders(open,done){
  const cur={};open.forEach(t=>cur[t.id]=oSnap(t));
  if(!S.known){S.known=cur;store.set('tsb_known',JSON.stringify({v:1,m:cur}));return}
  const doneIds=new Set(done.map(t=>t.id)),fresh=[];
  const push=(k,id,t,d)=>{const i=S.inbox.findIndex(x=>x.id===id);const ex=i>=0?S.inbox[i]:null;
    if(k==='void'){if(ex&&ex.k==='new'){S.inbox.splice(i,1);return}if(ex)S.inbox.splice(i,1)}
    else if(ex){ex.t=t;if(k==='edit'&&ex.k==='edit'){d.forEach(([l,a,b])=>{const o=ex.d.find(x=>x[0]===l);if(o)o[2]=b;else ex.d.push([l,a,b])});ex.d=ex.d.filter(x=>x[1]!==x[2])}ex.at=Date.now();fresh.push(ex);return}
    const it={k,id,t,d:d||[],at:Date.now()};S.inbox.push(it);fresh.push(it)};
  open.forEach(t=>{const o=S.known[t.id];
    if(!o){if(t.parentId)return;if(S.mineO.has(t.id)){S.mineO.delete(t.id);return}
      if(t.urgent){S.flag[t.id]={k:'new',until:Date.now()+2*3600e3};saveInbox();return} // the siren already covers urgent orders
      push('new',t.id,oLite(t))}
    else{const d=oDiff(o,cur[t.id]);if(!d.length)return;if(S.mineO.has(t.id)){S.mineO.delete(t.id);return}push('edit',t.id,oLite(t),d)}});
  Object.keys(S.known).forEach(id=>{id=+id;if(cur[id]||doneIds.has(id))return;if(S.mineO.has(id)){S.mineO.delete(id);return}const o=S.known[id];
    push('void',id,{customer:o.c,productName:o.p,qty:o.q,unit:o.u,shipDate:o.d,shipMethod:o.m,note:o.n})});
  S.known=cur;store.set('tsb_known',JSON.stringify({v:1,m:cur}));
  if(fresh.length){saveInbox();IB.fresh=(IB.fresh||[]).concat(fresh)}
}
/* bright "order in" bell: two-strike chime with bell partials, like a delivery-app tablet */
function orderBell(){if(!Snd.on)return;Snd.unlock();const c=Snd.ctx;if(!c)return;try{
  const out=c.createGain();out.gain.value=.9;out.connect(c.destination);
  const strike=(f,t0,g)=>{[[1,1],[2.76,.45],[5.4,.22],[.5,.25]].forEach(([r,a])=>{const o=c.createOscillator(),v=c.createGain(),t=c.currentTime+t0;o.type='sine';o.frequency.value=f*r;
    v.gain.setValueAtTime(.0001,t);v.gain.exponentialRampToValueAtTime(g*a,t+.008);v.gain.exponentialRampToValueAtTime(.0001,t+(r>2?.5:1.4));o.connect(v);v.connect(out);o.start(t);o.stop(t+1.5)})};
  strike(1318.5,0,.28);strike(1046.5,.18,.26);strike(1318.5,.62,.28);strike(1046.5,.8,.26)}catch(e){}}
const IB={on:false,iv:null,n:0,since:0,fresh:[]};
const KN={new:'新訂單',edit:'訂單修改',void:'訂單取消'};
function checkInbox(){
  const now=Date.now();let ch=false;Object.keys(S.flag).forEach(k=>{if(S.flag[k].until<now){delete S.flag[k];ch=true}});if(ch)saveInbox();
  if(S.tab!=='board'||!S.inbox.length){inboxOff();return}
  inboxOn();
}
function inboxSpeak(items){const by={};items.forEach(it=>{(by[it.k]=by[it.k]||[]).push(spokenName(it.t.customer))});
  return Object.keys(by).map(k=>KN[k]+'，'+[...new Set(by[k])].slice(0,3).join('、')).join('。')}
function inboxOn(){
  let box=$('#inbox');const first=!box;
  if(!box){box=document.createElement('div');box.id='inbox';box.setAttribute('role','alertdialog');box.setAttribute('aria-label','新訂單通知');document.body.appendChild(box);IB.since=Date.now()}
  const L=S.inbox,cnt=k=>L.filter(x=>x.k===k).length,show=L.slice().sort((a,b)=>b.at-a.at).slice(0,6);
  const head=['new','edit','void'].filter(k=>cnt(k)).map(k=>'<span class="ib-c '+k+'"><b>'+cnt(k)+'</b>'+KN[k]+'</span>').join('');
  const mode=cnt('new')?'new':cnt('edit')?'edit':'void';
  const big=cnt('new')&&!cnt('edit')&&!cnt('void')?'新訂單':!cnt('new')&&cnt('edit')&&!cnt('void')?'訂單有修改':!cnt('new')&&!cnt('edit')?'訂單已取消':'訂單有更新';
  box.innerHTML='<div class="ib-ring" aria-hidden="true"><i></i><i></i><i></i></div><div class="ib-panel m-'+mode+'">'+
    '<div class="ib-head"><div class="ib-bell" aria-hidden="true"><svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg></div>'+
    '<div class="ib-ttl"><div class="ib-k">'+big+'</div><div class="ib-cs">'+head+'</div></div><div class="ib-wait"><small>已等待</small><b id="ibtime">'+ibClock()+'</b></div></div>'+
    '<div class="ib-list">'+show.map(it=>{const t=it.t;
      return '<div class="ib-row '+it.k+'"><div class="ib-main"><div class="ib-tag">'+KN[it.k]+'</div><div class="ib-cust">'+esc(t.customer)+(t.urgent?'<span class="urg-tag">緊急單</span>':'')+'</div>'+
        '<div class="ib-prod">'+esc(t.productName)+'</div>'+
        '<div class="ib-meta">'+(t.shipMethod?'<span class="pill mpill '+MCLS[t.shipMethod]+'">'+esc(t.shipMethod)+'</span>':'')+'<span>出貨 '+esc(String(t.shipDate||'').slice(5).replace('-','/'))+'</span>'+(t.note&&it.k!=='edit'?'<span>備註：'+esc(t.note)+'</span>':'')+'</div>'+
        (it.k==='edit'?'<div class="ib-diff">'+it.d.map(([l,a,b])=>'<div><span>'+esc(l)+'</span><s>'+esc(a)+'</s><i aria-hidden="true">→</i><b>'+esc(b)+'</b></div>').join('')+'</div>':'')+
        (it.k==='void'?'<div class="ib-void">這筆已取消，請不要生產</div>':'')+
        '</div><div class="ib-qty"><b>'+num(t.qty)+'</b><span>'+esc(t.unit||'')+'</span></div></div>'}).join('')+
    (L.length>show.length?'<div class="ib-more">另外還有 '+(L.length-show.length)+' 筆，按下面按鈕後可在看板上查看</div>':'')+'</div>'+
    '<button type="button" id="iback" class="ib-btn">'+(cnt('new')?'接單，知道了':'知道了')+'</button></div>';
  if(first){IB.tick=setInterval(()=>{const e=$('#ibtime');if(e)e.textContent=ibClock()},1000);if(navigator.vibrate)try{navigator.vibrate([200,100,200])}catch(e){}}
  if(!IB.on){IB.on=true;IB.n=0;const cyc=()=>{if(!IB.on)return;if(!AL){orderBell();IB.n++;if(IB.n%5===0)Voice.say('有 '+S.inbox.length+' 筆訂單通知，請按接單')}};cyc();IB.iv=setInterval(cyc,3200)}
  if(IB.fresh.length){const say=inboxSpeak(IB.fresh);IB.fresh=[];if(!AL)setTimeout(()=>Voice.say(say),1300)}
}
function ibClock(){const s=IB.since?Math.floor((Date.now()-IB.since)/1000):0;return Math.floor(s/60)+':'+pad(s%60)}
function inboxOff(){IB.on=false;clearInterval(IB.iv);clearInterval(IB.tick);const b=$('#inbox');if(b)b.remove()}
document.addEventListener('click',e=>{if(!e.target.closest('#iback'))return;const until=Date.now()+2*3600e3;
  S.inbox.forEach(it=>{if(it.k!=='void')S.flag[it.id]={k:it.k,until}});S.inbox=[];IB.fresh=[];saveInbox();inboxOff();try{speechSynthesis.cancel()}catch(e){}Snd.play('tap');render(true)});
const flagTag=t=>{const f=S.flag[t.id]||(S.inbox.find(x=>x.id===t.id));if(!f)return '';return f.k==='new'?'<span class="new-tag">新單</span>':f.k==='edit'?'<span class="chg-tag">已修改</span>':''};

/* ---------- smart scheduling (suggestions computed on the server, shown & applied here) ---------- */
const md=d=>String(d||'').slice(5).replace('-','/');
function planBar(){const p=S.plan;if(!p||S.pick)return '';
  const chips=[];
  if(p.merges.length)chips.push('<span class="ai-chip c-merge"><b>'+p.merges.length+'</b> 組可合併生產</span>');
  chips.push(p.moved?'<span class="ai-chip c-move"><b>'+p.moved+'</b> 筆順序可優化</span>':'<span class="ai-chip c-ok">順序已是最佳</span>');
  const nr=p.routes.reduce((s,r)=>s+r.stops.filter(x=>x.region!=='未填地址').length,0);
  if(nr)chips.push('<span class="ai-chip c-route"><b>'+nr+'</b> 條配送區域</span>');
  const risk=p.routes.filter(r=>(r.warn||[]).some(w=>w.level==='bad')).length;
  if(risk)chips.push('<span class="ai-chip c-warn"><b>'+risk+'</b> 趟配送有風險</span>');
  if(p.noAddr.length)chips.push('<span class="ai-chip c-warn"><b>'+p.noAddr.length+'</b> 家缺地址</span>');
  return '<button type="button" class="ai-bar" id="aiopen"><span class="ai-core" aria-hidden="true"><i></i><i></i><b>AI</b></span><span class="ai-txt"><b>智慧排程</b><small>'+(p.auto?'自動排程中：新訂單進來會自動重排':'系統已分析所有訂單，按這裡看建議')+'</small></span><span class="ai-chips">'+chips.join('')+'</span><span class="ai-go">查看建議 ›</span></button>'}
function openPlan(){S.planOpen=true;renderPlan()}
function closePlan(){S.planOpen=false;const m=$('#aiscrim');if(m)$('#modal').innerHTML=''}
function renderPlan(){
  const p=S.plan;if(!p||!S.planOpen)return;
  const a=document.activeElement;if(a&&a.closest&&a.closest('#aiscrim')&&a.tagName==='INPUT')return;
  const byId={};S.open.forEach(t=>byId[t.id]=t);
  const inMerge={};p.merges.forEach((m,i)=>m.ids.forEach(id=>inMerge[id]=i));
  const lim=addDays(today(),2);
  const show=p.order.filter(id=>byId[id]&&(byId[id].urgent||byId[id].shipDate<=lim||inMerge[id]!=null)).slice(0,40);
  let seq='',last=null,n=0;
  show.forEach(id=>{const t=byId[id],g=inMerge[id];
    if(g!=null&&g!==last){const m=p.merges[g];seq+='<div class="ai-grp"><span>同一鍋</span><b>'+esc(m.label)+'</b><em>'+m.orders+' 張單・共 '+esc(m.total)+'</em></div>'}
    last=g;n++;
    seq+='<div class="ai-row'+(g!=null?' in-g':'')+'"><span class="ai-n">'+pad(n)+'</span><div class="ai-m"><b>'+esc(t.customer)+'</b><span>'+esc(shortName(t.productName))+'</span></div>'+
      (t.urgent?'<span class="urg-tag">緊急</span>':'')+methodPill(t)+'<span class="ai-d'+(t.shipDate<today()?' over':'')+'">'+(t.shipDate<today()?'逾期 ':'')+md(t.shipDate)+'</span><span class="ai-q">'+num(t.qty)+' '+esc(t.unit||'')+'</span></div>'});
  const merges=p.merges.map((m,i)=>{const onBoard=m.ids.every(id=>byId[id]&&(byId[id].urgent||byId[id].shipDate<=lim));
    return '<div class="ai-card"><div class="ai-ct"><b>'+esc(m.label)+'</b><span>'+m.orders+' 張單・'+m.customers+' 家客戶</span></div><div class="ai-big">'+esc(m.total)+'</div>'+
      '<div class="ai-cs">'+m.products.slice(0,4).map(x=>'<span>'+esc(shortName(x))+'</span>').join('')+'</div>'+
      '<p>'+(m.shareLot?'同原料、同批號，可一次備料一起灌裝，省下換線與清洗時間。':'同一個品項，建議連續生產。')+(m.pulled?' 其中 <b>'+m.pulled+' 張</b>原本較晚出貨（'+m.dates.map(md).join('、')+'），建議提前一起做。':'')+'</p>'+
      (m.shareLot&&onBoard?'<button type="button" class="ai-act" data-aipick="'+i+'">這幾張一起完成（同一鍋）</button>':'')+'</div>'}).join('');
  const routes=p.routes.map(r=>'<div class="ai-route"><div class="ai-rd">'+(r.date===p.today?'今天':md(r.date))+'</div><div class="ai-stops">'+r.stops.map((s,i)=>'<div class="ai-stop'+(s.region==='未填地址'?' na':'')+'"><span class="ai-pin">'+(s.region==='未填地址'?'?':i+1)+'</span><div><b>'+esc(s.region)+'</b><small>'+s.customers.map(esc).join('、')+(s.km!=null?'・約 '+s.km+' 公里':'')+'</small></div></div>').join('<i class="ai-arrow" aria-hidden="true"></i>')+'</div>'+(r.km?'<div class="ai-km">全程約 '+r.km+' 公里（來回）</div>':'')+'</div>').join('');
  const tips=[];
  p.combine.forEach(c=>tips.push('<b>'+esc(c.customer)+'</b> 有 '+c.dates.map(md).join('、')+' 多張公司配送單，建議合併成同一趟送。'));
  (p.far||[]).forEach(c=>tips.push('<b>'+esc(c.customer)+'</b> 離工廠直線約 '+c.km+' 公里，自己送很花時間，<b>建議改物流配送</b>。'));
  p.sameArea.forEach(c=>tips.push('<b>'+esc(c.region)+'</b> 在 '+c.dates.map(md).join('、')+' 都要送，若客戶能接受，可排同一趟。'));
  Object.keys(p.logistics).sort().forEach(d=>tips.push((d===p.today?'今天':md(d))+' 有 <b>'+p.logistics[d]+' 筆物流配送</b>，已排在同日最前面，請在物流收件前完成。'));
  if(p.noMethod)tips.push('<b>'+p.noMethod+' 筆</b>三天內的訂單還沒選出貨方式，到「未完成訂單」按修改補上，排程會更準。');
  const custAddr={};S.customers.forEach(c=>custAddr[c.name]=c.address||'');
  const noAddr=p.noAddr.map(c=>'<div class="ai-addr"><b>'+esc(c)+'</b><input data-aiaddr="'+esc(c)+'" placeholder="例：高雄市三民區民族一路 100 號" value="'+esc(custAddr[c]||'')+'"><button type="button" data-aiaddrsave="'+esc(c)+'">儲存</button>'+geoState(c)+'</div>').join('');
  const h='<div class="scrim" id="aiscrim"><div class="sheet ai-sheet" role="dialog" aria-label="智慧排程建議">'+
    '<div class="ai-hd"><span class="ai-core big" aria-hidden="true"><i></i><i></i><b>AI</b></span><div><div class="pname">智慧排程建議</div><p class="hint">依出貨日、同原料同批號合併、出貨方式（物流 → 公司配送 → 自取）自動計算</p></div><button type="button" class="ai-x" id="aiclose" aria-label="關閉">×</button></div>'+
    '<button type="button" class="ai-auto" id="aiauto" aria-pressed="'+!!p.auto+'"><span class="ai-sw" aria-hidden="true"><i></i></span><span><b>自動排程　'+(p.auto?'開啟中':'已關閉')+'</b><small>'+(p.auto?'有新訂單或改單時，系統會自動重排看板順序。想手動拖曳排序，請先關閉。':'打開後，有新訂單或改單時，系統會自動照下面的建議重排看板。')+'</small></span></button>'+
    '<section><h3>建議生產順序<span>'+(p.moved?p.moved+' 筆位置會調整':'目前順序已經是最佳')+'</span></h3><div class="ai-seq">'+(seq||'<p class="hint">三天內沒有待生產的訂單。</p>')+'</div>'+
    (p.moved?'<button type="button" class="primary ai-apply" id="aiapply">套用建議順序</button>':'')+'</section>'+
    (merges?'<section><h3>合併生產<span>同原料一起做，少一次換線</span></h3><div class="ai-cards">'+merges+'</div></section>':'')+
    (routes||tips.length?'<section><h3>出貨建議<span>公司配送依地區排路線（三天內）</span></h3>'+routes+(tips.length?'<ul class="ai-tips">'+tips.map(x=>'<li>'+x+'</li>').join('')+'</ul>':'')+'</section>':'')+
    deliverySection('plan')+addrSuggestPanel(true)+(noAddr?'<section><h3>補上客戶地址<span>有地址才能自動排配送路線</span></h3>'+noAddr+'</section>':'')+
    '</div></div>';
  const sc=$('.ai-sheet')?$('.ai-sheet').scrollTop:0;$('#modal').innerHTML=h;$('.ai-sheet').scrollTop=sc;dmAfter();
}
document.addEventListener('click',async e=>{
  const t=e.target;
  if(t.closest('#aiopen')){Snd.play('tap');return openPlan()}
  if(t.id==='aiscrim'||t.closest('#aiclose'))return closePlan();
  if(t.closest('#aiapply')){const r=await act(()=>api('POST','/api/plan/apply'),r=>'已套用智慧排程（調整 '+r.moved+' 筆）');if(r){Snd.play('add');closePlan()}return}
  if(t.closest('#aiauto')){const on=!(S.plan&&S.plan.auto);await act(()=>api('POST','/api/plan/auto',{on}),on?'自動排程已開啟':'自動排程已關閉');renderPlan();return}
  const pk=t.closest('[data-aipick]');if(pk){const m=S.plan.merges[+pk.dataset.aipick];closePlan();S.pick=new Set(m.ids.filter(id=>S.open.some(x=>x.id===id)));Snd.play('tap');renderBoard();toast('已勾選 '+S.pick.size+' 張，確認後按「一起完成」');return}
  const sv=t.closest('[data-aiaddrsave]');if(sv){const name=sv.dataset.aiaddrsave,inp=[...document.querySelectorAll('[data-aiaddr]')].find(x=>x.dataset.aiaddr===name);
    if(!inp||!inp.value.trim())return toast('請先輸入地址');sv.disabled=true;await act(()=>api('POST','/api/customers/address',{name,address:inp.value.trim()}),r=>r.region?'已儲存，地區：'+r.region:'已儲存（請寫到縣市和區，例：高雄市三民區…）');renderPlan();return}
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.planOpen)closePlan()});

/* ---------- APS view: production calendar (Gantt), daily lists, late/overload, run log, parameters ---------- */
S.apsDay=null;S.apsEdit=null;
const LINE_COLORS=['#F2B33D','#86B6F2','#4FD08E','#C494FF','#FF8A7E','#7FDBFF'];
function apsT(id){return S.open.find(t=>t.id===id)}
function segTime(p,d){if(!p||!p.start)return '—';if(p.startDay===d&&p.day===d)return p.start+'–'+p.end;if(p.startDay===d)return p.start+' 開始';if(p.day===d)return '續～'+p.end;return '續做'}
function etaTag(t){const p=S.aps&&S.aps.tasks&&S.aps.tasks[t.id];if(!p||!p.day||!p.line)return '';return '<span class="eta'+(p.late?' late':'')+'">'+(p.late?'⚠ 可能延誤・':'預計 ')+(p.day===today()?'':md(p.day)+' ')+(p.end||'')+' 完成</span>'}
/* ---------- operator-friendly explanations ---------- */
/* ---------- delivery map: stop order, arrival times, receiving hours, production link (all computed on the server) ---------- */
const DM={maps:{},geom:{},loading:null};
const DMC=()=>Object.assign({depart:'09:00',svc:20,load:20,open:'09:00',close:'17:30',lunchFrom:'',lunchTo:''},(S.cfg&&S.cfg.delivery)||{});
const hm=m=>pad(Math.floor(Math.round(m)/60)%24)+':'+pad(Math.round(m)%60);
const hmd=m=>(m>=1440?'隔天 ':'')+hm(m);
const durTxt=m=>m>=60?Math.floor(m/60)+' 時 '+Math.round(m%60)+' 分':Math.round(m)+' 分';
const dmKey=r=>r.date+'|'+r.points.map(p=>p.lat+','+p.lng).join(';');
function dmWinTxt(w){return w.open+'–'+w.close+(w.lunchFrom?'（午休 '+w.lunchFrom+'–'+w.lunchTo+'）':'')}
function dmEditForm(name,p){const w=p.win,c=(S.customers.find(x=>x.name===name)||{});
  const f=(k,v,lab)=>'<label class="dm-ef">'+lab+'<input type="time" data-dmw="'+k+'" value="'+esc(v||'')+'"></label>';
  return '<div class="dm-edit"><p>這家客戶收貨的時間。留空＝用預設（'+esc(dmWinTxt({open:DMC().open,close:DMC().close,lunchFrom:DMC().lunchFrom,lunchTo:DMC().lunchTo}))+'）。</p><div class="dm-ew">'+
    f('open',c.recv_open,'開門')+f('close',c.recv_close,'下班')+f('lunchFrom',c.recv_lunch_from,'午休開始')+f('lunchTo',c.recv_lunch_to,'午休結束')+'</div>'+
    '<div class="dm-eb"><button type="button" class="primary" data-dmwinsave="'+esc(name)+'">儲存</button><button type="button" data-dmwinclear="'+esc(name)+'">改回預設</button><button type="button" data-dmwincancel>取消</button></div></div>'}
function deliverySection(ctx){
  const all=(S.plan&&S.plan.routes)||[];
  const rs=all.filter(r=>r.points&&r.points.length);
  const any=all.some(r=>r.stops.some(s=>s.region!=='未填地址'));
  if(!rs.length)return '<section class="aps-sec dm"><h2>出貨路線地圖<span>公司配送的客戶地址確認後，這裡會出現地圖、站序和預計到達時間</span></h2><p class="hint">'+(any?'':'目前三天內沒有「公司配送」的訂單，或客戶還沒有已確認的地址。')+'</p></section>';
  if(!S.dmDay||!rs.some(r=>r.date===S.dmDay))S.dmDay=rs[0].date;
  const r=rs.find(x=>x.date===S.dmDay),D=DMC(),td=today(),dur=r.back-r.depart;
  const tabs=rs.map(x=>{const bad=(x.warn||[]).some(w=>w.level==='bad');return '<button type="button" class="dm-day'+(x.date===S.dmDay?' on':'')+(bad?' bad':'')+'" data-dmday="'+x.date+'">'+(x.date===td?'今天':md(x.date))+(bad?' ⚠':'')+'<small>'+x.points.length+' 家</small></button>'}).join('');
  const cf=(k,lab,v,ex)=>'<label class="dm-f">'+lab+'<input '+(ex||'type="time"')+' data-dmcfg="'+k+'" value="'+esc(v)+'"></label>';
  const ctl='<div class="dm-top"><div class="dm-tabs">'+tabs+'</div>'+cf('depart','預設出發',D.depart)+cf('svc','每家停留（分）',D.svc,'type="number" min="0" max="180" step="5"')+cf('load','裝車（分）',D.load,'type="number" min="0" max="180" step="5"')+'</div>'+
    '<details class="dm-def"><summary>預設收貨時間（客戶沒有另外設定時用）</summary><div class="dm-ew">'+cf('open','開門',D.open)+cf('close','下班',D.close)+cf('lunchFrom','午休開始',D.lunchFrom)+cf('lunchTo','午休結束',D.lunchTo)+'</div><p class="hint">午休兩格都留空＝不考慮午休。個別客戶的時間，在下面那家的「收貨時間」按鈕設定。</p></details>';
  const rows=r.points.map(p=>{
    const st=p.status,right=st==='late'?'<small class="dm-bad">超過下班 '+p.lateMin+' 分</small>':st==='lunch'||st==='wait'?'<small class="dm-amb">到了要等 '+p.wait+' 分，'+hm(p.start)+' 開始卸貨</small>':'<small>預計到</small>';
    return '<div class="dm-row s-'+st+'"><span class="dm-n">'+p.seq+'</span><div class="dm-m"><b>'+esc(p.name)+'</b><small>距上一站 '+p.legKm+' 公里・開車約 '+Math.max(1,p.legMin)+' 分</small><small>收貨時間 '+esc(dmWinTxt(p.win))+(p.win.custom?'（個別設定）':'（預設）')+'</small></div>'+
      '<button type="button" class="dm-winbtn" data-dmwin="'+esc(p.name)+'">收貨時間</button><div class="dm-t"><b>'+hmd(p.arrive)+'</b>'+right+'</div></div>'+(S.dmEdit===p.name?dmEditForm(p.name,p):'')}).join('');
  const dep='<div class="dm-row dm-dep"><span class="dm-n">廠</span><div class="dm-m"><b>統香蜂蜜工廠出發</b><small>高雄市三民區重慶街 67 號</small>'+(r.departWhy?'<small class="dm-amb">'+esc(r.departWhy)+'</small>':'')+'</div><div class="dm-t"><b>'+hm(r.depart)+'</b><small>'+(r.departBasis==='完工'?'依完工時間':r.departBasis==='現在'?'從現在起':'預設出發')+'</small></div></div>';
  const miss=[...new Set(r.stops.filter(x=>x.region!=='未填地址').flatMap(x=>x.customers))].filter(n=>!r.points.some(p=>p.name===n));
  const warn=(r.warn||[]).map(w=>'<li class="dm-w '+w.level+'">'+(w.level==='bad'?'⚠ ':w.level==='warn'?'⏱ ':'💡 ')+esc(w.text)+'</li>').join('');
  const long=r.pathKm>150||dur>600;
  return '<section class="aps-sec dm"><h2>出貨路線地圖<span>公司配送：依行車時間與客戶收貨時間，排出最順的送貨順序</span></h2>'+ctl+
    '<div class="dmap" id="dm-'+ctx+'" data-ctx="'+ctx+'"></div>'+
    '<div class="dm-sum"><div><b>'+r.pathKm+'</b><small>公里（來回）</small></div><div><b>'+durTxt(dur)+'</b><small>全程含停留</small></div><div><b>'+hmd(r.back)+'</b><small>預計回到工廠</small></div></div>'+
    (warn||long?'<ul class="dm-ws">'+warn+(long?'<li class="dm-w bad">⚠ 這一趟全程約 '+r.pathKm+' 公里、要 '+durTxt(dur)+'，一天送不完。建議把最遠的客戶改物流配送，或分成兩天。</li>':'')+'</ul>':'')+
    '<div class="dm-list">'+dep+rows+'</div>'+
    (r.departNote?'<p class="dm-note">'+esc(r.departNote)+'</p>':'')+
    (miss.length?'<p class="dm-note">還沒有座標、沒排進路線：'+miss.map(esc).join('、')+'（地址可能不完整，請到訂單補上正確地址）。</p>':'')+
    '<p class="dm-note">'+(r.basis==='road'?'行車時間與距離來自 OpenStreetMap 道路資料（OSRM 免費服務），不含即時塞車。':'道路資料還在載入或暫時查不到，目前用直線距離 ×1.3、時速 30 公里估算。')+'站序是依這些時間算出的最佳順序；到達時間只是參考，請依實際路況調整。</p></section>';
}
function loadLeaflet(){
  if(window.L)return Promise.resolve();
  if(DM.loading)return DM.loading;
  DM.loading=new Promise((ok,no)=>{
    const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';document.head.appendChild(css);
    const js=document.createElement('script');js.src='https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';js.onload=ok;js.onerror=()=>{DM.loading=null;no(new Error('leaflet'))};document.head.appendChild(js);
  });
  return DM.loading;
}
/* the drawn line follows real roads (geometry from OSRM); times and distances come from the server */
async function dmFetchRoad(r){
  const k=dmKey(r);if(DM.geom[k])return;
  DM.geom[k]={pending:true};
  try{
    const co=[r.depot].concat(r.points,[r.depot]).map(p=>p.lng+','+p.lat).join(';');
    const ac=new AbortController(),to=setTimeout(()=>ac.abort(),9000);
    const res=await fetch('https://router.project-osrm.org/route/v1/driving/'+co+'?overview=full&geometries=geojson&steps=false',{signal:ac.signal});clearTimeout(to);
    const j=await res.json();
    if(!res.ok||j.code!=='Ok'||!j.routes||!j.routes[0])throw new Error('osrm');
    DM.geom[k]={line:j.routes[0].geometry.coordinates.map(c=>[c[1],c[0]])};
  }catch(e){DM.geom[k]={fail:true}}
  dmRefresh();
}
function dmRefresh(){if(S.planOpen)renderPlan();else if(document.querySelector('#v-aps .dmap'))renderAps()}
async function dmAfter(){
  document.querySelectorAll('.dmap').forEach(el=>{
    const ctx=el.dataset.ctx;if(DM.maps[ctx]){try{DM.maps[ctx].remove()}catch(e){}delete DM.maps[ctx]}
    const rs=((S.plan&&S.plan.routes)||[]).filter(r=>r.points&&r.points.length),r=rs.find(x=>x.date===S.dmDay);if(!r)return;
    loadLeaflet().then(()=>{
      if(!document.body.contains(el)||DM.maps[ctx])return;
      const L=window.L,map=L.map(el,{scrollWheelZoom:false,zoomControl:true,attributionControl:true});DM.maps[ctx]=map;
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© OpenStreetMap'}).addTo(map);
      const g=DM.geom[dmKey(r)],pts=[[r.depot.lat,r.depot.lng]].concat(r.points.map(p=>[p.lat,p.lng]),[[r.depot.lat,r.depot.lng]]);
      L.polyline(g&&g.line?g.line:pts,{color:'#F2B33D',weight:5,opacity:.9,dashArray:g&&g.line?null:'8 8'}).addTo(map);
      L.marker(pts[0],{icon:L.divIcon({className:'',html:'<div class="dm-pin dep">廠</div>',iconSize:[34,34],iconAnchor:[17,17]})}).addTo(map).bindTooltip('統香蜂蜜工廠（'+hm(r.depart)+' 出發）');
      r.points.forEach(p=>L.marker([p.lat,p.lng],{icon:L.divIcon({className:'',html:'<div class="dm-pin'+(p.status==='late'?' late':p.status==='ok'?'':' wait')+'">'+p.seq+'</div>',iconSize:[34,34],iconAnchor:[17,17]})}).addTo(map).bindTooltip(esc(p.name)+'　預計 '+hmd(p.arrive)+' 到',{direction:'top'}));
      map.fitBounds(L.latLngBounds(pts),{padding:[30,30],animate:false});
      setTimeout(()=>{if(DM.maps[ctx]===map){try{map.invalidateSize(false)}catch(e){}}},50);
    }).catch(()=>{el.innerHTML='<p class="hint" style="padding:16px">地圖圖層載入失敗（網路問題）。下方的站序和預計時間仍可使用。</p>'});
    dmFetchRoad(r);
  });
}
document.addEventListener('click',async e=>{const t=e.target;
  const d=t.closest('[data-dmday]');if(d){S.dmDay=d.dataset.dmday;S.dmEdit=null;return dmRefresh()}
  const w=t.closest('[data-dmwin]');if(w){S.dmEdit=S.dmEdit===w.dataset.dmwin?null:w.dataset.dmwin;return dmRefresh()}
  if(t.closest('[data-dmwincancel]')){S.dmEdit=null;return dmRefresh()}
  const sv=t.closest('[data-dmwinsave]'),cl=t.closest('[data-dmwinclear]');
  if(sv||cl){const name=(sv||cl).dataset.dmwinsave||(sv||cl).dataset.dmwinclear,body={name,open:'',close:'',lunchFrom:'',lunchTo:''};
    if(sv)document.querySelectorAll('[data-dmw]').forEach(i=>{body[i.dataset.dmw]=i.value});
    const ok=await act(()=>api('POST','/api/customers/window',body),cl?'已改回預設時間':'已儲存收貨時間，路線已重新計算');if(ok){S.dmEdit=null;dmRefresh()}}
});
document.addEventListener('change',async e=>{const t=e.target;
  if(t.matches('[data-dmcfg]')){const k=t.dataset.dmcfg,v=(t.type==='number')?+t.value:t.value;t.blur();await act(()=>api('PUT','/api/delivery',{[k]:v}),'已更新，路線已重新計算');dmRefresh()}});
/* ---------- address suggestions found online: a person confirms before they are used ---------- */
function stopIdx(t,D){const r=((S.plan&&S.plan.routes)||[]).find(x=>x.date===D);if(!r)return 99;const i=(r.points||[]).findIndex(p=>p.name===t.customer);return i<0?99:i}
function geoState(name){const c=S.customers.find(x=>x.name===name)||{};
  if(c.address_suggest)return '<small class="geo-st">網路上找到候選地址，見下方「請確認」</small>';
  if(!c.geo_tried_at)return '<small class="geo-st">⏳ 系統正在網路上自動搜尋（免費地圖，每秒查一筆）</small>';
  return '<small class="geo-st">網路上找不到，請手動輸入 <button type="button" class="linkbtn" data-georetry="'+esc(name)+'">再查一次</button></small>'}
function addrSuggestPanel(onlyOpen){
  const openNames=new Set(S.open.map(t=>t.customer));
  const list=S.customers.filter(c=>c.address_suggest&&(!onlyOpen||openNames.has(c.name)));
  if(!list.length)return '';
  return '<section class="aps-sec"><h2>客戶地址：系統在網路上找到了，請確認<span>確認後就會用來排配送路線；不對的話按「不對」自己輸入</span></h2><div class="sg-list">'+list.map(c=>
    '<div class="sg"><div class="sg-m"><b>'+esc(c.name)+'</b><span class="sg-a">📍 '+esc(c.address_suggest)+'</span><small>'+esc(c.suggest_src||'')+'</small></div>'+
    '<span class="sg-c c-'+(c.suggest_conf==='高'?'hi':c.suggest_conf==='中'?'mid':'lo')+'">吻合度 '+esc(c.suggest_conf||'?')+'</span>'+
    '<div class="sg-a2"><button type="button" class="primary" data-sgok="'+esc(c.name)+'">對，採用</button><button type="button" data-sgno="'+esc(c.name)+'">不對</button></div></div>').join('')+'</div></section>';
}
document.addEventListener('click',async e=>{
  const ok=e.target.closest('[data-sgok]'),no=e.target.closest('[data-sgno]');
  const gr=e.target.closest('[data-georetry]');if(gr){await act(()=>api('POST','/api/customers/geo-retry',{name:gr.dataset.georetry}),'已重新排入搜尋');return}
  if(ok){await act(()=>api('POST','/api/customers/accept',{name:ok.dataset.sgok}),'已採用地址，配送路線已更新');if(S.planOpen)renderPlan();return}
  if(no){await act(()=>api('POST','/api/customers/reject',{name:no.dataset.sgno}),'已移除建議，請在訂單裡輸入正確地址');if(S.planOpen)renderPlan();return}
});
function whyOf(t){return (S.plan&&S.plan.why&&S.plan.why[t.id])||[]}
function whyChips(t,max){const w=whyOf(t).slice(0,max||4);return w.length?'<div class="why">'+w.map(x=>'<span class="'+whyCls(x)+'">'+esc(x)+'</span>').join('')+'</div>':''}
function whyCls(x){return /緊急|逾期/.test(x)?'w-red':/今天|物流/.test(x)?'w-amb':/同原料|併做/.test(x)?'w-pur':/鎖定|開工/.test(x)?'w-gold':/待料/.test(x)?'w-red':'w-dim'}
const RULES=[
  ['🚨','緊急單','有緊急單一定排第一個，生產端會響警報。'],
  ['📅','出貨日早的先做','逾期 → 今天 → 明天 → 之後。公司配送若設定要提前一天，就再往前推。'],
  ['🍯','同原料接著做','同一種蜜或同一批原料的訂單排在一起，不用換線清洗；兩天內出貨的會提前併在同一鍋。'],
  ['🚚','同一天：物流 → 配送 → 自取','物流要趕收件時間先做，門市自取最後。'],
  ['🔒','人工決定優先','鎖定、已開工的單不會被系統移動；待料的單排到到料日之後。'],
];
function opsGuide(){
  const A=S.aps,T=(A&&A.tasks)||{},td=today(),now=new Date(),nowS=pad(now.getHours())+':'+pad(now.getMinutes());
  const hasLines=A&&A.lines&&A.lines.length;
  const doing=t=>!!t.startedAt;
  let h='<section class="aps-sec ops"><h2>今天的作業順序<span>照編號由上往下做就對了；每張都寫了「為什麼排在這裡」</span><em class="ops-now">現在 '+nowS+'</em></h2>';
  const step=(t,i,first,p)=>{const st=doing(t)?'進行中':first===0?'現在做':first===1?'下一個':'';
    return '<div class="op-step'+(st==='進行中'?' run':st==='現在做'?' cur':st==='下一個'?' nxt':'')+(p&&p.late?' late':'')+'"><div class="op-n">'+(i+1)+'</div><div class="op-b">'+
      (st?'<span class="op-st">'+st+'</span>':'')+'<div class="op-c"><b>'+(t.urgent?'<span class="urg-tag">緊急</span> ':'')+(t.locked?'🔒 ':'')+esc(t.customer)+'</b><span>'+esc(shortName(t.productName))+'</span></div>'+
      whyChips(t,4)+(p&&p.late?'<div class="op-late">⚠ 照目前產能可能來不及：'+esc(p.why||'')+'</div>':'')+'</div>'+
      '<div class="op-r">'+(p&&p.start?'<span class="op-t">'+segTime(p,td)+'</span>':'')+'<b>'+num(t.qty)+'</b><small>'+esc(t.unit||'')+'</small></div></div>'};
  if(hasLines){
    const cols=A.lines.map((l,li)=>{const col=LINE_COLORS[li%LINE_COLORS.length];const d=l.days.find(x=>x.date===td)||{items:[]};
      const its=d.items.map(apsT).filter(Boolean);let k=0,out='',prevKey=null;
      its.forEach((t,i)=>{const p=T[t.id];if(p&&p.changeover&&p.startDay===td)out+='<div class="op-co">🧽 換線清洗約 '+p.changeover+' 分鐘（換成 '+esc(catName(t.cat))+'）</div>';out+=step(t,i,doing(t)?-1:k++,p)});
      return '<div class="op-col" style="--c:'+col+'"><div class="op-lh"><b>'+esc(l.name)+'</b><span>'+(d.work?'今天用了 '+(d.pct||0)+'% 產能':'今天休息')+'</span></div>'+(out||'<p class="hint">今天這條線沒有排工作。</p>')+'</div>'}).join('');
    const un=S.open.filter(t=>T[t.id]&&!T[t.id].line&&(T[t.id].day===td));
    h+='<div class="op-cols">'+cols+(un.length?'<div class="op-col" style="--c:#FF5A4E"><div class="op-lh"><b>未指定產線</b><span>到排程參數指定後才算得出時間</span></div>'+un.map((t,i)=>step(t,i,i,T[t.id])).join('')+'</div>':'')+'</div>';
  }else{
    const lim=addDays(td,2),ord=(S.plan&&S.plan.order)||[];
    const list=ord.map(apsT).filter(t=>t&&(t.urgent||t.shipDate<=lim)).slice(0,20);
    h+='<div class="op-note">還沒有設定產線與產能，所以先只排「做的順序」、不算幾點做。到右上「⚙ 排程參數」填好後，這裡就會出現每條線的時間表。</div>'+
      (list.length?'<div class="op-col solo">'+list.map((t,i)=>step(t,i,doing(t)?-1:i,null)).join('')+'</div>':'<p class="hint">三天內沒有要做的訂單。</p>')+
      (S.plan&&S.plan.moved?'<div class="op-note warn">看板目前的順序跟上面的建議不一樣（'+S.plan.moved+' 筆）。到看板的「智慧排程」按「套用建議順序」，或打開自動排程。</div>':'');
  }
  h+='</section>';
  h+='<details class="aps-sec rules"'+(store.get('tsb_rules')==='1'?'':' open')+'><summary>系統是怎麼排的？（5 條規則）</summary><div class="rule-row">'+RULES.map((r,i)=>'<div class="rule"><span class="rule-i">'+r[0]+'</span><b>'+(i+1)+'. '+esc(r[1])+'</b><small>'+esc(r[2])+'</small></div>').join('<i class="rule-arr" aria-hidden="true">›</i>')+'</div>'+
    '<p class="hint">排完之後，系統再用每條產線每天的工時、換線時間、每小時產量，算出每張單幾點開始、幾點完成。算出來會超過出貨日的，會標「可能來不及」並告訴你原因和解法。</p></details>';
  return h;
}
document.addEventListener('toggle',e=>{if(e.target.matches&&e.target.matches('details.rules'))store.set('tsb_rules',e.target.open?'0':'1')},true);
function wkName(d){return '週'+WD[new Date(d+'T00:00:00').getDay()]}
function renderAps(){
  const ae=document.activeElement;if(ae&&ae.tagName==='INPUT'&&ae.closest&&ae.closest('#v-aps .dm'))return;
  const v=$('#v-aps');const A=S.aps;if(!v)return;
  if(!A||A.error){v.innerHTML='<header class="pg-head"><h1>排程</h1><p>'+(A&&A.error?'計算失敗：'+esc(A.error):'載入中…')+'</p></header>';return}
  if(S.apsEdit){return renderApsEdit()}
  const td=today();if(!S.apsDay||!A.days.includes(S.apsDay))S.apsDay=td;
  const T=A.tasks,late=A.late.map(apsT).filter(Boolean),locked=S.open.filter(t=>t.locked).length,held=S.open.filter(t=>t.holdUntil).length;
  const mis=A.missing,noLines=!A.lines.length;
  let h='<header class="pg-head aps-head"><div><h1>智慧排程</h1><p>系統依出貨日、原料、產能自動排好每天做什麼、誰先誰後。訂單一有變動就會重新排。</p></div><button type="button" class="ghost-btn" id="apsedit">⚙ 排程參數</button></header>';
  h+='<div class="aps-kpi">'+
    '<div class="ak '+(late.length?'bad':'ok')+'"><b>'+late.length+'</b><span>張可能來不及</span></div>'+
    '<div class="ak '+(A.overload.length?'warn':'ok')+'"><b>'+A.overload.length+'</b><span>天產線排滿</span></div>'+
    '<div class="ak"><b>'+locked+'</b><span>張人工鎖定</span></div>'+
    '<div class="ak"><b>'+held+'</b><span>張等原料</span></div>'+
    '<div class="ak '+(S.plan&&S.plan.auto?'ok':'')+'"><b>'+(S.plan&&S.plan.auto?'開':'關')+'</b><span>自動排程</span></div></div>'+opsGuide()+deliverySection('aps')+addrSuggestPanel(true);
  // missing data — never guessed
  const miss=[];
  if(noLines)miss.push('<b>還沒有設定產線／設備</b>：系統無法計算產能與時間。到「排程參數」新增產線（例：蜂蜜充填線、糖漿線），設定每天可用工時與負責的類別。');
  if(mis.noLine.length)miss.push('<b>類別沒有指定產線</b>：'+mis.noLine.map(c=>esc(c+' '+catName(c))).join('、'));
  if(mis.noRate.length)miss.push('<b>缺少產能速率</b>（每小時可做幾箱／桶／瓶）：'+mis.noRate.map(esc).join('、')+'。這些工作的時間先以 0 計算，標示「工時未知」。');
  if(mis.noMethod)miss.push('<b>'+mis.noMethod+' 筆訂單沒選出貨方式</b>：無法套用各出貨方式的提前天數。');
  if(mis.noAddr.length)miss.push('<b>公司配送客戶缺地址</b>：'+mis.noAddr.map(esc).join('、'));
  miss.push('<b>系統目前沒有的資料</b>（排程不會自己編）：原物料庫存與到貨、成品庫存、人力班別、車輛載重／容積、客戶收貨時段、行車時間。缺料請用「待料」手動標示到料日。');
  h+='<details class="aps-miss"'+(noLines||mis.noRate.length?' open':'')+'><summary>待補資料（'+miss.length+'）</summary><ul>'+miss.map(x=>'<li>'+x+'</li>').join('')+'</ul></details>';
  // late orders with reasons and options
  if(late.length)h+='<section class="aps-sec"><h2>可能來不及<span>照目前產能算，這些單會晚於最晚完成日</span></h2><div class="aps-late">'+late.map(t=>{const p=T[t.id];return '<div class="al-card"><div class="alc-h"><b>'+esc(t.customer)+'</b><span>'+esc(shortName(t.productName))+'　'+qtyU(t)+'</span></div>'+
      '<div class="alc-d">最晚完成 <b>'+md(p.deadline)+'</b>　預計完成 <b class="bad">'+(p.day?md(p.day)+' '+(p.end||''):'排不進')+'</b></div>'+
      '<div class="alc-why">原因：'+esc(p.why||'')+'</div>'+(p.options&&p.options.length?'<ul class="alc-opt">'+p.options.map(o=>'<li>'+esc(o)+'</li>').join('')+'</ul>':'')+apsActs(t)+'</div>'}).join('')+'</div></section>';
  // gantt
  const days=A.days.slice(0,7);
  const rows=A.lines.map((l,li)=>{const col=LINE_COLORS[li%LINE_COLORS.length];
    return '<div class="g-row"><div class="g-lane" style="--c:'+col+'"><b>'+esc(l.name)+'</b>'+(l.staff?'<small>'+l.staff+' 人</small>':'')+'</div>'+l.days.slice(0,7).map(d=>{
      const its=d.items.map(apsT).filter(Boolean);
      return '<div class="g-cell'+(d.work?'':' off')+(d.pct>=98?' full':'')+'" data-gday="'+d.date+'"><div class="g-load"><i style="width:'+Math.min(100,d.pct)+'%"></i><span>'+(d.work?(d.cap?d.pct+'%':d.date===today()&&d.full&&!d.note?'今日已收工':'停機'):'休')+'</span></div>'+(d.note?'<div class="g-note">'+esc(d.note)+'</div>':'')+
        its.slice(0,5).map(t=>{const p=T[t.id];return '<div class="g-blk'+(p.late?' late':'')+(t.locked?' lock':'')+(t.holdUntil?' hold':'')+'" style="--c:'+col+'" title="'+esc(t.customer+'｜'+t.productName)+'"><b>'+(t.locked?'🔒':'')+esc(t.customer)+'</b><span>'+num(t.qty)+esc(t.unit||'')+' · '+segTime(p,d.date)+'</span></div>'}).join('')+(its.length>5?'<div class="g-more">＋'+(its.length-5)+'</div>':'')+'</div>'}).join('')+'</div>'});
  const unl=S.open.filter(t=>T[t.id]&&!T[t.id].line);
  if(unl.length)rows.push('<div class="g-row"><div class="g-lane na"><b>未指定產線</b><small>無法算時間</small></div>'+days.map(d=>{const its=unl.filter(t=>T[t.id].day===d);return '<div class="g-cell na" data-gday="'+d+'">'+its.slice(0,4).map(t=>'<div class="g-blk na'+(T[t.id].late?' late':'')+'"><b>'+esc(t.customer)+'</b><span>'+num(t.qty)+esc(t.unit||'')+'</span></div>').join('')+(its.length>4?'<div class="g-more">＋'+(its.length-4)+'</div>':'')+'</div>'}).join('')+'</div>');
  h+='<section class="aps-sec"><h2>未來 7 天生產日曆<span>每格上方是當天產能用了多少；點日期看那天的清單</span></h2><div class="g-legend"><span><i class="lg ok"></i>準時</span><span><i class="lg late"></i>可能來不及</span><span><i class="lg hold"></i>等原料</span><span>🔒 人工鎖定</span><span><i class="lg full"></i>產線排滿</span></div><div class="gantt" style="--n:'+days.length+'"><div class="g-row g-hd"><div class="g-lane"></div>'+days.map(d=>'<button type="button" class="g-day'+(d===S.apsDay?' on':'')+(d===td?' td':'')+'" data-gday="'+d+'"><b>'+md(d)+'</b><small>'+(d===td?'今天':wkName(d))+'</small></button>').join('')+'</div>'+rows.join('')+'</div></section>';
  // daily lists
  const D=S.apsDay;
  const prod=S.open.filter(t=>T[t.id]&&(T[t.id].day===D||T[t.id].startDay===D)).sort((a,b)=>String(T[a.id].line).localeCompare(String(T[b.id].line))||String(T[a.id].start||'').localeCompare(String(T[b.id].start||'')));
  const ship=S.open.filter(t=>t.shipDate===D);
  const byLine={};prod.forEach(t=>{const k=T[t.id].line||'_';(byLine[k]=byLine[k]||[]).push(t)});
  h+='<section class="aps-sec"><h2>'+md(D)+' '+(D===td?'今天':wkName(D))+'　每日清單</h2><div class="aps-daily"><div class="ad-col"><h3>生產</h3>'+
    (prod.length?Object.keys(byLine).map(k=>{const L=A.lines.find(l=>l.id===k);return '<div class="ad-line"><div class="ad-ln">'+esc(L?L.name:'未指定產線')+'</div>'+byLine[k].map(t=>{const p=T[t.id];
      return '<div class="ad-row'+(p.late?' late':'')+'"><span class="ad-tm">'+segTime(p,D)+'</span><div class="ad-m"><b>'+(t.locked?'🔒 ':'')+esc(t.customer)+'</b><span>'+esc(shortName(t.productName))+'</span>'+whyChips(t,3)+'<small>'+[p.minutes?'約 '+p.minutes+' 分鐘':'工時未知',p.changeover?'含換線 '+p.changeover+' 分':'',p.rateSrc||'',...(p.reasons||[]),...(p.flags||[]).filter(f=>f!=='工時未知')].filter(Boolean).map(esc).join('・')+'</small></div><span class="ad-q">'+qtyU(t)+'</span>'+apsActs(t)+'</div>'}).join('')+'</div>'}).join(''):'<p class="hint">這天沒有排生產。</p>')+
    '</div><div class="ad-col"><h3>出貨／配送</h3>'+(ship.length?METHODS.concat(['']).map(m=>{const ts=ship.filter(t=>(t.shipMethod||'')===m).sort((a,b)=>stopIdx(a,D)-stopIdx(b,D));if(!ts.length)return '';
      return '<div class="ad-line"><div class="ad-ln">'+(m?methodPill({shipMethod:m}):'<span class="pill p-tom">未選出貨方式</span>')+'</div>'+ts.map(t=>{const p=T[t.id];const ok=p&&p.day&&!p.late;return '<div class="ad-row"><div class="ad-m"><b>'+esc(t.customer)+'</b><span>'+esc(shortName(t.productName))+'</span>'+(m==='公司配送'?'<small>'+(stopIdx(t,D)<99?'第 '+(stopIdx(t,D)+1)+' 站・':'')+esc(((S.customers.find(c=>c.name===t.customer)||{}).address)||'地址待確認')+'</small>':'')+'</div><span class="ad-q">'+qtyU(t)+'</span><span class="ad-st '+(ok?'ok':'bad')+'">'+(ok?'預計 '+md(p.day)+' 完成':'可能來不及')+'</span></div>'}).join('')+'</div>'}).join(''):'<p class="hint">這天沒有出貨。</p>')+
    '<p class="hint">車輛載重、收貨時段、行車時間尚未建立，配送順序僅依地區分組，未驗證行車時間。</p></div></div></section>';
  // run log
  h+='<section class="aps-sec"><h2>重排紀錄<span>每次訂單或參數變動，系統重算並記錄前後差異</span></h2><div class="aps-runs">'+(S.runs&&S.runs.length?S.runs.map(r=>{const d=r.diff||{};
    const parts=[];if(d.added&&d.added.length)parts.push('新增 '+d.added.length);if(d.removed&&d.removed.length)parts.push('移除 '+d.removed.length);if(d.moved&&d.moved.length)parts.push('改期 '+d.moved.length);if(d.newlyLate&&d.newlyLate.length)parts.push('<b class="bad">新延誤 '+d.newlyLate.length+'</b>');if(d.recovered&&d.recovered.length)parts.push('<b class="ok">恢復準時 '+d.recovered.length+'</b>');
    return '<details class="run"><summary><span class="run-t">'+fmtTime(r.at)+'</span><b>'+esc(r.reason)+'</b><span class="run-p">'+(parts.join('・')||'無變化')+'</span>'+(r.undo?'<button type="button" class="run-undo" data-undo="'+r.id+'">還原這次之前的順序</button>':'')+'</summary>'+
      ((d.moved||[]).length?'<div class="run-l"><i>改期</i>'+d.moved.slice(0,20).map(x=>'<div>'+esc(x.name)+'：'+esc(md(x.from))+' → '+esc(md(x.to))+'</div>').join('')+'</div>':'')+
      ((d.newlyLate||[]).length?'<div class="run-l bad"><i>新延誤</i>'+d.newlyLate.map(x=>'<div>'+esc(x.name)+'</div>').join('')+'</div>':'')+
      ((d.recovered||[]).length?'<div class="run-l ok"><i>恢復準時</i>'+d.recovered.map(x=>'<div>'+esc(x.name)+'</div>').join('')+'</div>':'')+'</details>'}).join(''):'<p class="hint">還沒有紀錄，下一次訂單變動後會開始記錄。</p>')+'</div></section>';
  // learning
  const L=A.learned||{},lk=Object.keys(L);
  h+='<section class="aps-sec"><h2>實際工時學習<span>按卡片上的「開工」再按「完成生產」，系統就能算出實際速度</span></h2>'+(lk.length?'<div class="aps-learn">'+lk.map(c=>Object.keys(L[c]).map(u=>{const x=L[c][u],set=((A.aps.rates||{})[c]||{})[u];return '<div><b>'+esc(c+' '+catName(c))+'｜'+esc(u||'—')+'</b><span>實際 '+x.rate+' /小時（'+x.n+' 筆，可信度'+x.conf+'）</span><small>設定值 '+(set||'未設')+(A.aps.autoLearn&&x.n>=5?'・已自動採用實際值':x.n<5?'・樣本不足，維持設定值':'・未開啟自動校正')+'</small></div>'}).join('')).join('')+'</div>':'<p class="hint">目前沒有開工紀錄，還無法學習。樣本達 5 筆以上才會採用。</p>')+'</section>';
  v.innerHTML=h;dmAfter();
}
function apsActs(t){return '<span class="aps-acts"><button type="button" data-alock="'+t.id+'" aria-pressed="'+!!t.locked+'">'+(t.locked?'🔒 解鎖':'鎖定')+'</button>'+
  '<button type="button" data-ahold="'+t.id+'"'+(t.holdUntil?' aria-pressed="true"':'')+'>'+(t.holdUntil?'待料 '+md(t.holdUntil):'待料')+'</button>'+
  '<button type="button" data-astart="'+t.id+'"'+(t.startedAt?' aria-pressed="true"':'')+'>'+(t.startedAt?'已開工':'開工')+'</button></span>'}
function renderApsEdit(){
  const v=$('#v-aps'),E=S.apsEdit,c=cfg();
  const catKeys=Object.keys(c.cats);
  let h='<header class="pg-head aps-head"><div><h1>排程參數</h1><p>只填你確定的數字；沒填的地方排程會標示「待補」，不會自己猜。</p></div></header>';
  h+='<section class="aps-sec"><h2>產線／設備</h2><div class="pe-lines">'+E.lines.map((l,i)=>'<div class="pe-line" data-li="'+i+'"><div class="pe-g"><label>名稱<input data-lf="name" value="'+esc(l.name)+'"></label><label>每天可用工時（分鐘）<input data-lf="minutes" type="number" min="0" value="'+esc(l.minutes)+'"></label><label>開工時間<input data-lf="start" type="time" value="'+esc(l.start)+'"></label><label>換線清洗（分鐘）<input data-lf="changeover" type="number" min="0" value="'+esc(l.changeover)+'"></label><label>人力（人）<input data-lf="staff" type="number" min="0" value="'+esc(l.staff||0)+'"></label></div>'+
    '<div class="pe-cats"><span>負責類別</span>'+catKeys.map(k=>'<button type="button" class="chip" data-lcat="'+k+'" aria-pressed="'+l.cats.includes(k)+'">'+esc(k+' '+c.cats[k].name)+'</button>').join('')+'</div><button type="button" class="danger pe-del" data-ldel="'+i+'">刪除產線</button></div>').join('')+
    '<button type="button" id="pe-addline">＋ 新增產線</button></div></section>';
  h+='<section class="aps-sec"><h2>產能速率<span>每小時可以完成多少（依類別與單位）</span></h2><div class="pe-rates"><div class="pr-h"><span>類別</span>'+UNITS.map(u=>'<span>'+u+'／小時</span>').join('')+'</div>'+catKeys.map(k=>'<div class="pr-r"><b>'+esc(k+' '+c.cats[k].name)+'</b>'+UNITS.map(u=>'<input type="number" min="0" step="0.5" data-rate="'+k+'|'+u+'" value="'+esc(((E.rates[k]||{})[u])||'')+'" placeholder="未設">').join('')+'</div>').join('')+'</div>'+
    '<button type="button" class="ai-auto pe-learn" id="pe-learn" aria-pressed="'+!!E.autoLearn+'"><span class="ai-sw" aria-hidden="true"><i></i></span><span><b>自動校正（實際工時學習）</b><small>同類別同單位有 5 筆以上「開工→完成」紀錄時，改用實際速度；不足時維持上面的設定值。</small></span></button></section>';
  h+='<section class="aps-sec"><h2>工作日與假日</h2><div class="chips">'+[1,2,3,4,5,6,0].map(d=>'<button type="button" class="chip" data-wd="'+d+'" aria-pressed="'+E.workdays.includes(d)+'">週'+WD[d]+'</button>').join('')+'</div>'+
    '<label class="f">休假日（多個用逗號分開，例：2026-10-31, 2026-11-01）<input id="pe-hol" value="'+esc(E.holidays.join(', '))+'"></label></section>';
  h+='<section class="aps-sec"><h2>產能異動<span>設備故障、保養、加班、半天班</span></h2><div class="pe-down">'+E.down.map((d,i)=>'<div class="pd-r" data-di="'+i+'"><select data-df="line">'+E.lines.map(l=>'<option value="'+esc(l.id)+'"'+(l.id===d.line?' selected':'')+'>'+esc(l.name)+'</option>').join('')+'</select><input type="date" data-df="date" value="'+esc(d.date)+'"><label>當天可用<input type="number" min="0" data-df="minutes" value="'+esc(d.minutes)+'">分鐘</label><input data-df="reason" placeholder="原因（故障、加班…）" value="'+esc(d.reason||'')+'"><button type="button" class="danger" data-ddel="'+i+'">✕</button></div>').join('')+
    (E.lines.length?'<button type="button" id="pe-adddown">＋ 新增異動</button>':'<p class="hint">先新增產線。</p>')+'</div></section>';
  h+='<section class="aps-sec"><h2>出貨前需完成天數<span>含品管、包裝、出貨準備；0＝出貨當天完成即可</span></h2><div class="pe-lead">'+METHODS.map(m=>'<label>'+esc(m)+'<input type="number" min="0" max="10" data-lead="'+m+'" value="'+esc(E.lead[m]||0)+'">天</label>').join('')+'</div>'+
    '<label class="f" style="max-width:260px">排程顯示天數<input type="number" min="7" max="30" id="pe-hz" value="'+esc(E.horizon)+'"></label></section>';
  h+='<div class="err" id="pe-err"></div><div class="row pe-bar"><button type="button" id="pe-cancel">取消</button><button type="button" class="primary" id="pe-save">儲存並重新排程</button></div>';
  v.innerHTML=h;
}
function apsEditStart(){const a=JSON.parse(JSON.stringify((S.aps&&S.aps.aps)||{}));S.apsEdit={lines:a.lines||[],rates:a.rates||{},workdays:a.workdays||[1,2,3,4,5],holidays:a.holidays||[],down:a.down||[],lead:a.lead||{},horizon:a.horizon||14,autoLearn:!!a.autoLearn};renderAps()}
document.addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b||!b.closest('#v-aps,#v-board'))return;
  if(b.id==='apsedit'){return apsEditStart()}
  if(b.dataset.gday){S.apsDay=b.dataset.gday;return renderAps()}
  if(b.dataset.alock){const id=+b.dataset.alock,t=apsT(id);return act(()=>api('POST','/api/tasks/'+id+'/lock',{on:!(t&&t.locked)}),t&&t.locked?'已解鎖':'已鎖定：自動排程不會移動這張')}
  if(b.dataset.astart){const id=+b.dataset.astart,t=apsT(id);return act(()=>api('POST','/api/tasks/'+id+'/start',{on:!(t&&t.startedAt)}),t&&t.startedAt?'已取消開工':'已開工，開始計時')}
  if(b.dataset.ahold){const id=+b.dataset.ahold,t=apsT(id);if(t&&t.holdUntil)return act(()=>api('POST','/api/tasks/'+id+'/hold',{until:null}),'已解除待料');return openHold(t)}
  if(b.dataset.undo){if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='再按一次確認還原';return}return act(()=>api('POST','/api/plan/undo/'+b.dataset.undo),'已還原順序，自動排程已暫停')}
  const E=S.apsEdit;if(!E)return;
  if(b.id==='pe-cancel'){S.apsEdit=null;return renderAps()}
  if(b.id==='pe-addline'){E.lines.push({id:'L'+Date.now().toString(36),name:'產線 '+(E.lines.length+1),minutes:480,start:'08:00',changeover:30,staff:0,cats:[]});return renderApsEdit()}
  if(b.dataset.ldel){E.lines.splice(+b.dataset.ldel,1);return renderApsEdit()}
  if(b.dataset.lcat){const i=+b.closest('[data-li]').dataset.li,k=b.dataset.lcat;E.lines.forEach((l,j)=>{if(j!==i)l.cats=l.cats.filter(x=>x!==k)});const L=E.lines[i];L.cats=L.cats.includes(k)?L.cats.filter(x=>x!==k):L.cats.concat(k);return renderApsEdit()}
  if(b.dataset.wd){const d=+b.dataset.wd;E.workdays=E.workdays.includes(d)?E.workdays.filter(x=>x!==d):E.workdays.concat(d);return renderApsEdit()}
  if(b.id==='pe-learn'){E.autoLearn=!E.autoLearn;return renderApsEdit()}
  if(b.id==='pe-adddown'){E.down.push({line:E.lines[0].id,date:today(),minutes:0,reason:''});return renderApsEdit()}
  if(b.dataset.ddel){E.down.splice(+b.dataset.ddel,1);return renderApsEdit()}
  if(b.id==='pe-save'){E.holidays=($('#pe-hol').value||'').split(/[,，\s]+/).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x));E.horizon=+$('#pe-hz').value||14;
    const bad=E.lines.find(l=>!l.name.trim()||!(+l.minutes>=0));if(bad)return $('#pe-err').textContent='每條產線都要有名稱與工時';
    const r=await act(()=>api('PUT','/api/aps',E),'排程參數已儲存，已重新計算');if(r){S.apsEdit=null;renderAps()}}
});
document.addEventListener('input',e=>{const E=S.apsEdit,t=e.target;if(!E||!t.closest('#v-aps'))return;
  if(t.dataset.lf){const L=E.lines[+t.closest('[data-li]').dataset.li];L[t.dataset.lf]=t.type==='number'?+t.value:t.value}
  else if(t.dataset.rate){const [c,u]=t.dataset.rate.split('|');(E.rates[c]=E.rates[c]||{})[u]=t.value===''?'':+t.value}
  else if(t.dataset.df){const D=E.down[+t.closest('[data-di]').dataset.di];D[t.dataset.df]=t.dataset.df==='minutes'?+t.value:t.value}
  else if(t.dataset.lead){E.lead[t.dataset.lead]=+t.value}});
document.addEventListener('change',e=>{const E=S.apsEdit,t=e.target;if(!E||!t.closest('#v-aps'))return;if(t.dataset.df==='line'){E.down[+t.closest('[data-di]').dataset.di].line=t.value}});
function openHold(t){if(!t)return;
  $('#modal').innerHTML='<div class="scrim" id="hscrim"><form class="sheet" id="hform" style="max-width:480px"><div class="pname">標示待料／缺料</div><p class="hint">'+esc(t.customer)+'｜'+esc(t.productName)+'。排程會把這張排到到料日之後，若晚於最晚完成日會標示延誤。</p>'+
    '<label class="f">預計到料日<input type="date" id="hdate" value="'+esc(addDays(today(),1))+'" required></label><label class="f">缺什麼（選填）<input id="hreason" placeholder="例：果糖、700g 玻璃瓶"></label><div class="row"><button type="button" id="hcancel" style="flex:1">取消</button><button class="primary" style="flex:2">確定</button></div></form></div>';
  $('#hcancel').onclick=()=>{$('#modal').innerHTML=''};$('#hscrim').onclick=e=>{if(e.target.id==='hscrim')$('#modal').innerHTML=''};
  $('#hform').onsubmit=async e=>{e.preventDefault();const r=await act(()=>api('POST','/api/tasks/'+t.id+'/hold',{until:$('#hdate').value,reason:$('#hreason').value}),'已標示待料，排程已重算');if(r)$('#modal').innerHTML=''}}

/* ---------- completion feedback: Japanese variety-show style (集中線 + 大字砸下 + 字幕條 + 太鼓) ---------- */
function varietySfx(){if(!Snd.on)return;Snd.unlock();const c=Snd.ctx;if(!c)return;try{
  const t0=c.currentTime+.02,out=c.createGain();out.gain.value=.9;out.connect(c.destination);
  const noise=(dur)=>{const b=c.createBuffer(1,c.sampleRate*dur,c.sampleRate),d=b.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;const s=c.createBufferSource();s.buffer=b;return s};
  // "ピューッ" slide whistle up
  {const o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(500,t0);o.frequency.exponentialRampToValueAtTime(2200,t0+.32);
   g.gain.setValueAtTime(.0001,t0);g.gain.exponentialRampToValueAtTime(.22,t0+.04);g.gain.exponentialRampToValueAtTime(.0001,t0+.36);o.connect(g);g.connect(out);o.start(t0);o.stop(t0+.4)}
  // "ドーン" taiko hit ×2
  [[.36,1],[.62,.75]].forEach(([dt,a])=>{const t=t0+dt,o=c.createOscillator(),g=c.createGain();o.type='sine';o.frequency.setValueAtTime(140,t);o.frequency.exponentialRampToValueAtTime(48,t+.45);
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(a,t+.008);g.gain.exponentialRampToValueAtTime(.0001,t+.6);o.connect(g);g.connect(out);o.start(t);o.stop(t+.65);
    const n=noise(.12),f=c.createBiquadFilter(),ng=c.createGain();f.type='lowpass';f.frequency.value=900;ng.gain.setValueAtTime(.5*a,t);ng.gain.exponentialRampToValueAtTime(.0001,t+.12);n.connect(f);f.connect(ng);ng.connect(out);n.start(t)});
  // "ジャーン" crash cymbal
  {const t=t0+.36,n=noise(1.6),f=c.createBiquadFilter(),g=c.createGain();f.type='highpass';f.frequency.value=4200;g.gain.setValueAtTime(.32,t);g.gain.exponentialRampToValueAtTime(.0001,t+1.5);n.connect(f);f.connect(g);g.connect(out);n.start(t)}
  // "パパパパーン" fanfare
  [[784,.0],[988,.09],[1175,.18],[1568,.27]].forEach(([fq,dt],i)=>{const t=t0+.7+dt,d=i===3?.9:.12;['square','sawtooth'].forEach(type=>{const o=c.createOscillator(),g=c.createGain(),lp=c.createBiquadFilter();lp.type='lowpass';lp.frequency.value=3200;o.type=type;o.frequency.value=fq;o.detune.value=type==='square'?-6:6;
    g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.07,t+.012);g.gain.setValueAtTime(.07,t+d*.7);g.gain.exponentialRampToValueAtTime(.0001,t+d);o.connect(lp);lp.connect(g);g.connect(out);o.start(t);o.stop(t+d+.05)})});
  // sparkle on top
  [2637,3136,3520,4186].forEach((fq,i)=>Snd.tone(fq,.95+i*.07,.35,'sine',.05));
}catch(e){}}
function celebrate(title,sub,lots){
  const box=document.createElement('div');box.className='vx';box.setAttribute('role','status');
  const big=/同一批/.test(title)?'整鍋完成':'任務完成';
  let conf='';const cols=['#FFE14D','#FF3B6B','#3BC8FF','#5CFF8A','#FF9A1F','#FFFFFF','#B07CFF'];
  for(let i=0;i<70;i++)conf+='<i style="--x:'+(Math.random()*100).toFixed(1)+'vw;--d:'+(Math.random()*.7).toFixed(2)+'s;--t:'+(1.8+Math.random()*1.6).toFixed(2)+'s;--r:'+Math.round(Math.random()*720-360)+'deg;--dx:'+Math.round(Math.random()*160-80)+'px;background:'+cols[i%cols.length]+';width:'+(6+Math.random()*10).toFixed(0)+'px;height:'+(10+Math.random()*14).toFixed(0)+'px"></i>';
  box.innerHTML='<div class="vx-lines" aria-hidden="true"></div><div class="vx-flash" aria-hidden="true"></div><div class="vx-conf" aria-hidden="true">'+conf+'</div>'+
    '<div class="vx-stage"><div class="vx-star" aria-hidden="true"></div>'+
    '<div class="vx-head"><div class="vx-big" data-t="'+esc(big)+'">'+esc(big)+'</div>'+
    '<div class="vx-stamp" aria-hidden="true"><span>生產</span><b>完了</b></div></div>'+
    '<div class="vx-tel"><span class="vx-tel-k">完成</span><span class="vx-tel-t">'+esc(title)+'</span></div>'+
    '<div class="vx-sub">'+esc(sub)+'</div>'+
    (lots&&lots.length?'<div class="vx-lots">'+lots.map(l=>'<span>'+esc(l)+'</span>').join('')+'</div>':'')+'</div>';
  document.body.appendChild(box);varietySfx();
  const m=document.querySelector('main');if(m){m.classList.remove('vx-shake');void m.offsetWidth;setTimeout(()=>m.classList.add('vx-shake'),380);setTimeout(()=>m.classList.remove('vx-shake'),1000)}
  if(navigator.vibrate)try{navigator.vibrate([30,340,120])}catch(e){}
  const close=()=>{if(box.classList.contains('out'))return;box.classList.add('out');setTimeout(()=>box.remove(),350)};
  box.addEventListener('click',close);setTimeout(close,3400);
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
  if(S.tv){tvFlood(gs.slice(0,4).map(g=>{const t=g[0],q=g.reduce((s,x)=>s+x.qty,0);return {customer:t.customer,product:shortName(t.productName)+'　'+num(q)+(t.unit?' '+t.unit:''),lot:g.map(x=>x.lot).join('、')}}));return}
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
    detectRemoteDone(s.done);detectOrders(s.open,s.done);
    S.rev=s.rev;S.open=s.open;setTimeout(()=>{checkUrgent();checkInbox()},0);S.done=s.done;S.products=s.products;S.recentLots=s.recentLots||{};S.customers=s.customers||[];S.history=s.history||[];S.cfg=s.config;S.plan=s.plan||null;S.aps=s.aps||null;S.runs=s.runs||[];if(S.planOpen)renderPlan();
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
  ['board','orders','records','aps','settings'].forEach(k=>$('#v-'+k).hidden=k!==S.tab);document.body.classList.toggle('bd',S.tab==='board');render(true);checkUrgent();checkInbox();store.set('tsb_tab',S.tab)});
document.body.classList.add('bd');if(S.tv)document.body.classList.add('tv');
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
  if(!force&&a&&(a.tagName==='INPUT'||a.tagName==='SELECT')&&a.closest('#v-orders,#v-settings,#v-records,#v-aps'))return;
  if(S.tab==='board')renderBoard();
  if(S.tab==='orders')renderOrders();
  if(S.tab==='records')renderRecords();
  if(S.tab==='settings')renderSettings();
  if(S.tab==='aps')renderAps();
}
let dragging=false;
function unitSum(ts){const m={};ts.forEach(t=>{const u=t.unit||'件';m[u]=(m[u]||0)+(+t.qty||0)});const k=Object.keys(m);return k.length?k.map(u=>num(m[u])+' '+u).join('　'):'—'}
const METHODS=['門市自取','公司配送','物流配送'];
const MCLS={'門市自取':'m-store','公司配送':'m-own','物流配送':'m-log'};
function methodPill(t,big){return t.shipMethod?'<span class="pill mpill '+MCLS[t.shipMethod]+(big?' big':'')+'">'+esc(t.shipMethod)+'</span>':''}
function shipCell(t,td){const md=t.shipDate.slice(5).replace('-','/');
  if(t.shipDate<td)return '<span class="c-ship s-over">逾期 <b>'+md+'</b></span>';
  if(t.shipDate===td)return '<span class="c-ship s-today">今日出貨</span>';
  if(t.shipDate===addDays(td,1))return '<span class="c-ship s-tom">明日出貨</span>';
  return '<span class="c-ship s-later"><b>'+md+'</b> 出貨</span>'}
const IC={
  pick:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M15 17.5l2 2 4-4"/></svg>',
  full:'<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg>'};
/* ---------- TV showcase mode (big screen, view-only) ---------- */
S.tv=/[?&]tv=1/.test(location.search)||store.get('tsb_tv')==='1';
function tvSet(on){S.tv=on;store.set('tsb_tv',on?'1':'0');document.body.classList.toggle('tv',on);
  const d=document;try{if(on&&!d.fullscreenElement)d.documentElement.requestFullscreen();if(!on&&d.fullscreenElement)d.exitFullscreen()}catch(e){}
  if(on&&S.tab!=='board'){const b=document.querySelector('#tabs button[data-tab="board"]');if(b)b.click()}TK='';render(true)}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&S.tv)tvSet(false)});
function comb(done,total){const cols=total>24?10:total>12?8:6,w=total>24?46:total>12?58:72,h=Math.round(w*1.15),cells=[];
  for(let i=0;i<total;i++){const r=Math.floor(i/cols),c=i%cols;cells.push('<i class="cell'+(i<done?' on':'')+(i===done-1?' last':'')+'" style="width:'+(w-4)+'px;height:'+(h-5)+'px;left:'+(c*w+(r%2?w/2:0))+'px;top:'+(r*h*0.76)+'px;--d:'+(i*0.03).toFixed(2)+'s"></i>')}
  const rows=Math.ceil(total/cols);return '<div class="comb" style="width:'+(cols*w+w/2)+'px;height:'+((rows-1)*h*0.76+h)+'px">'+cells.join('')+'</div>'}
function renderTV(){
  document.body.classList.add('tv');
  const v=$('#v-board'),list=boardTasks(),td=today(),now=new Date();
  const doneToday=S.done.filter(t=>t.completedAt&&ymd(new Date(t.completedAt))===td);
  const dueOpen=list.filter(t=>t.shipDate<=td||t.urgent).length,total=Math.max(1,doneToday.length+dueOpen);
  const n=list[0],nx=list.slice(1,6);
  const tag=t=>t.urgent?'<span class="tv-tag u">緊急單</span>':t.shipDate<td?'<span class="tv-tag o">逾期 '+t.shipDate.slice(5).replace('-','/')+'</span>':t.shipDate===td?'<span class="tv-tag t">今日出貨</span>':t.shipDate===addDays(td,1)?'<span class="tv-tag m">明日出貨</span>':'<span class="tv-tag">'+t.shipDate.slice(5).replace('-','/')+' 出貨</span>';
  let h='<div class="tv-wrap"><header class="tv-top"><div class="tv-brand"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 2l15.6 9v18L20 38 4.4 29V11z" fill="#F2B33D"/><path d="M20 10.5l8.2 4.75v9.5L20 29.5l-8.2-4.75v-9.5z" fill="#0A110E"/><path d="M20 15.5l3.9 2.25v4.5L20 24.5l-3.9-2.25v-4.5z" fill="#FFD47E"/></svg><div><b>統香蜂蜜</b><span>生產中控室</span></div></div>'+
    '<div class="tv-live"><i></i>即時連線</div><div class="tv-time"><div class="bd-clock" id="bdclock">'+clockHTML()+'</div><small>'+(now.getMonth()+1)+' 月 '+now.getDate()+' 日 週'+WD[now.getDay()]+'</small></div>'+
    '<button type="button" id="tvexit" class="tv-exit">離開展示模式</button></header><section class="tv-main">';
  if(n)h+='<div class="tv-now'+(n.urgent?' urgent':'')+'"><div class="tv-k"><span class="tv-dot"></span>現在生產'+tag(n)+(n.shipMethod?'<span class="tv-tag mt '+MCLS[n.shipMethod]+'">'+esc(n.shipMethod)+'</span>':'')+'</div>'+
    '<div class="tv-cust">'+esc(n.customer)+'</div><div class="tv-prod">'+esc(n.productName)+'</div>'+
    '<div class="tv-qty"><b>'+num(n.qty)+'</b><span>'+esc(n.unit||'')+'</span></div>'+(n.note?'<div class="tv-note">備註：'+esc(n.note)+'</div>':'')+'</div>';
  else h+='<div class="tv-now done"><div class="tv-k">今日排程</div><div class="tv-cust">全部完成</div><div class="tv-prod">辛苦了，今天的訂單都已生產完畢</div></div>';
  h+='<aside class="tv-side"><div class="tv-panel"><div class="tv-k">今日進度</div><div class="tv-prog"><b><span data-count="tvdone">'+doneToday.length+'</span></b><span>／ '+total+' 筆</span></div>'+comb(doneToday.length,total)+'</div>'+
    '<div class="tv-panel"><div class="tv-k">接下來</div>'+(nx.length?nx.map((t,i)=>'<div class="tv-row'+(t.urgent?' urgent':'')+'"><span class="tv-seq">'+pad(i+2)+'</span><div class="tv-rm"><b>'+esc(t.customer)+'</b><span>'+(t.shipMethod?esc(t.shipMethod)+'｜':'')+esc(shortName(t.productName))+'</span></div><div class="tv-rq"><b>'+num(t.qty)+'</b><span>'+esc(t.unit||'')+'</span></div></div>').join(''):'<div class="tv-empty">沒有排隊中的訂單</div>')+
    (list.length>6?'<div class="tv-more">還有 '+(list.length-6)+' 筆</div>':'')+'</div></aside></section></div>';
  v.innerHTML=h;countUp();updateTicker(doneToday);
}
/* full-screen honey flood when an order is finished */
const FLQ=[];let flBusy=false;
function tvFlood(items){FLQ.push(...items);if(!flBusy)flNext()}
function flNext(){const it=FLQ.shift();if(!it){flBusy=false;return}flBusy=true;
  const el=document.createElement('div');el.className='flood';el.setAttribute('role','status');
  el.innerHTML='<div class="fl-honey"><svg class="fl-wave" viewBox="0 0 1200 60" preserveAspectRatio="none" aria-hidden="true"><path d="M0 30 Q150 0 300 30 T600 30 T900 30 T1200 30 V60 H0Z"/></svg></div>'+
    '<div class="fl-text"><div class="fl-k">完成生產</div><div class="fl-c">'+esc(it.customer)+'</div><div class="fl-p">'+esc(it.product)+'</div><div class="fl-l">'+esc(it.lot)+'</div></div>';
  document.body.appendChild(el);Snd.play('done');setTimeout(()=>Voice.say(spokenName(it.customer)+'，已完成生產'),700);
  setTimeout(()=>el.classList.add('out'),4200);setTimeout(()=>{el.remove();flNext()},5200)}
function renderBoard(){
  if(dragging)return;
  if(S.tv)return renderTV();
  document.body.classList.remove('tv');
  const v=$('#v-board'),list=boardTasks(),td=today();
  const overL=list.filter(t=>t.shipDate<td),todayL=list.filter(t=>t.shipDate===td);
  const doneToday=S.done.filter(t=>t.completedAt&&ymd(new Date(t.completedAt))===td);
  const dueDone=doneToday.filter(t=>t.shipDate<=td).length,dueOpen=overL.length+todayL.length;
  const rate=dueDone+dueOpen?Math.round(dueDone*100/(dueDone+dueOpen)):null;
  const now=new Date(),dueLeft=overL.length+todayL.length;
  const hex=(cls,v,l,sub)=>'<div class="hex '+cls+'"><div class="hv"><span data-count="'+l+'">'+v+'</span></div><div class="hl">'+l+'</div>'+(sub?'<div class="hs">'+esc(sub)+'</div>':'')+'</div>';
  let h='<section class="bd-hero"><div class="bd-title"><div class="bd-tline"><h1>今日生產</h1><div class="bd-clock" id="bdclock" aria-label="現在時間">'+clockHTML()+'</div></div><p>'+(now.getMonth()+1)+' 月 '+now.getDate()+' 日 週'+WD[now.getDay()]+'　'+
    (list.length?'排程中 <b>'+list.length+' 筆</b>'+(dueLeft?'，今天要出貨的還有 <b>'+dueLeft+' 筆</b>':'，今天要出貨的都做完了'):'目前沒有待生產項目')+'</p></div>'+
    '<div class="hexes" role="group" aria-label="今日指標">'+
    hex('',list.length,'待生產',unitSum(list))+
    hex(todayL.length?'h-warn':'',todayL.length,'今日出貨',todayL.length?unitSum(todayL):'已清空')+
    hex(overL.length?'h-bad':'',overL.length,'逾期',overL.length?'請優先處理':'無')+
    hex('h-ok',doneToday.length,'今日完成',doneToday.length?unitSum(doneToday):'')+
    '<div class="hex h-rate'+((rate||0)<55?' low':'')+'" style="--fill:'+(rate||0)+'%" role="img" aria-label="今日出貨達成率 '+(rate==null?'無資料':rate+'%')+'"><span class="fill"></span><div class="hv">'+(rate==null?'—':'<span data-count="rate">'+rate+'</span><i>%</i>')+'</div><div class="hl">出貨達成率</div></div>'+
    '</div></section>';
  h+='<div class="bd-head"><div><b>生產排程</b><span>依序生產，拖曳 ⠿ 可調整順序</span></div><div class="bd-act">'+
    (S.pick?'':'<button type="button" id="pickstart" class="pick-start">'+IC.pick+'多筆一起完成（同一鍋）</button>')+
    '<button type="button" id="tvbtn" class="ghost-btn tv-btn">'+IC.full+'<span>展示模式（電視）</span></button></div></div>'+planBar();
  if(!list.length)h+='<div class="empty"><b>目前沒有待生產項目</b>三天內（含今日）要出貨的訂單會自動出現在這裡。到「訂單輸入」新增第一筆。</div>';
  else h+=(S.pick?'<div class="pickbar-top"><b>勾選這一鍋要分給哪幾張訂單</b><span>點卡片勾選，同一類別（品種）才能共用批號</span></div>':'')+
    '<div class="list'+(S.pick?' picking':'')+'" id="blist">'+list.map((t,i)=>{
    const bx=boxComps(t.productId),on=S.pick&&S.pick.has(t.id),next=!S.pick&&i===0;
    const code=bx.length?'<span class="pill p-box">禮盒：'+esc(bx.map(p=>shortName(p.name)).join('＋'))+'</span>':t.cat?'<span class="pill p-code">'+esc(t.cat)+esc(t.variety||'')+'</span><span class="pill p-cat">'+esc(catName(t.cat))+((cfg().cats[t.cat]||{}).auto?' 🔒':'')+'</span>':'<span class="pill p-tom">未設類別</span>';
    return '<div class="card'+(t.shipDate<td?' over':t.shipDate===td?' u-today':t.shipDate===addDays(td,1)?' u-tom':'')+(on?' picked':'')+(next?' next':'')+(t.urgent?' urgent':'')+(S.flag[t.id]||S.inbox.some(x=>x.id===t.id)?' fresh':'')+'" data-id="'+t.id+'"'+(S.pick?' role="checkbox" aria-checked="'+on+'" tabindex="0"':'')+'>'+
      '<div class="c-top">'+(S.pick?'<span class="pickbox'+(on?' on':'')+'" aria-hidden="true">'+(on?'✓':'')+'</span>':'<span class="grip" aria-label="拖曳排序" title="拖曳排序">⠿</span><span class="seq">'+pad(i+1)+'</span>')+
        (t.urgent?'<span class="urg-tag">緊急單</span>':'')+(next&&!t.urgent?'<span class="next-tag">現在生產</span>':'')+flagTag(t)+shipCell(t,td)+'</div>'+
      '<div class="cust">'+esc(t.customer)+'</div><div class="pname">'+esc(t.productName)+'</div>'+whyChips(t,3)+
      '<div class="meta">'+methodPill(t)+code+(t.parentId?'<span class="pill p-later">續做</span>':'')+(t.locked?'<span class="lock-tag">🔒 鎖定</span>':'')+(t.holdUntil?'<span class="hold-tag">待料 '+md(t.holdUntil)+'</span>':'')+etaTag(t)+'</div>'+
      (t.note?'<div class="note-box">備註：'+esc(t.note)+'</div>':'')+
      '<div class="c-bot"><div class="c-qty"><b>'+num(t.qty)+'</b><span>'+esc(t.unit||'')+'</span></div>'+
      (S.pick?'':'<button class="done-btn" data-act="finish" data-id="'+t.id+'">完成生產</button>')+'</div></div>'}).join('')+'</div>'+
    (S.pick?'<div class="pickbar"><span>已選 <b>'+S.pick.size+'</b> 筆</span><button type="button" id="pickcancel">取消</button><button type="button" id="pickgo" class="primary"'+(S.pick.size?'':' aria-disabled="true"')+'>一起完成</button></div>':'');
  if(doneToday.length)h+='<div class="bd-head bd-done"><div><b>今日已完成</b><span>'+doneToday.length+' 筆，批號有誤可直接修改</span></div></div><div class="done-list">'+
    doneToday.map(t=>'<div class="drow"><span class="d-ok" aria-hidden="true">✓</span><span class="d-time">'+fmtTime(t.completedAt).split(' ')[1]+'</span>'+
      '<span class="d-main"><b>'+esc(t.customer)+'</b><span>'+esc(t.productName)+'　'+qtyU(t)+'</span></span>'+
      '<span class="d-lot">'+esc(t.lot)+'</span><span class="d-op">'+esc(t.operator)+'</span>'+
      (t.contents?'<span></span>':'<button type="button" data-blot="'+t.id+'">改批號</button>')+'</div>').join('')+'</div>';
  v.innerHTML=h;countUp();updateTicker(doneToday);
  const el=$('#blist');
  if(el&&window.Sortable&&!S.pick)Sortable.create(el,{handle:'.grip',animation:150,ghostClass:'ghost-sort',
    onStart:()=>{dragging=true},
    onEnd:async()=>{dragging=false;const ids=[...el.querySelectorAll('.card')].map(c=>+c.dataset.id);
      ids.forEach((id,i)=>{const t=S.open.find(x=>x.id===id);if(t)t.order=(i+1)*10});renderBoard();
      await act(()=>api('POST','/api/tasks/reorder',{ids}),S.plan&&S.plan.auto?'已調整順序（自動排程開啟中，有新訂單時會重新排）':'')}});
}
$('#v-board').addEventListener('click',e=>{
  if(e.target.closest('#pickstart')){S.pick=new Set();Snd.play('tap');return renderBoard()}
  if(e.target.closest('#pickcancel')){S.pick=null;return renderBoard()}
  if(e.target.closest('#tvbtn')){tvSet(true);return}
  if(e.target.closest('#tvexit')){tvSet(false);return}
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
  F.noLot=!!pr.no_lot;
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
  F={noLot:ts.every(t=>(S.products.find(p=>p.id===t.productId)||{}).no_lot),t:ts[0],batch:ts,bq,defCat:cats[0],cat:cats[0],variety:rule0==='material'?'':vars[0],matDate:'',matArr:'',arrSet:false,qty:String(ts[0].qty),operator:store.get('tsb_op'),step:'date',err:'',pv:null,seq:'',seqTouched:false,showAll:false,busy:false,lots:[],mlot:''};
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
   '<div class="sheet-h"><div class="cust"><span class="cust-tag">客戶</span>'+esc(t.customer)+'</div><div class="pname">'+esc(t.productName)+' <span class="mono">× '+qtyU(t)+'</span></div><div class="meta">'+shipPill(t)+methodPill(t,1)+'</div>'+(t.note?'<div class="note-box">備註：'+esc(t.note)+'</div>':'')+'</div>');
  h+='<div class="sec"><div class="lbl"><i class="sn">1</i>操作人</div><div class="chips">'+(people.length?people.map(n=>'<button class="chip" data-op="'+esc(n)+'" aria-pressed="'+(F.operator===n)+'">'+esc(n)+'</button>').join(''):'<span class="hint">還沒有人員名單，請到「設定」新增。</span>')+'</div></div>';
  h+=F.noLot?'<div class="sec nolot-on"><div class="lbl"><i class="sn">2</i>批號</div><div class="nolot-box"><span class="nolot-ic" aria-hidden="true">∅</span><div><b>無批號</b><small>這個品項不需要批號（包材等），直接填數量完成即可</small></div><button type="button" id="fnolot" class="nolot-undo">改回輸入批號</button></div></div>'
    :'<button type="button" id="fnolot" class="nolot-skip"><span aria-hidden="true">⏭</span><span><b>跳過批號</b><small>包材等沒有批號的品項，按這裡直接下一步</small></span></button>';
  if(!F.noLot){
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
  }
  if(F.batch){
    h+='<div class="sec"><div class="lbl"><i class="sn">4</i>各訂單完成數量（少於訂單的部分會留在看板）</div><div style="display:flex;flex-direction:column;gap:8px">'+
      F.batch.map(b=>'<div class="bline"><div style="min-width:0;flex:1"><div class="bcust">'+esc(b.customer)+'</div><div class="hint">'+esc(b.productName)+'　訂單 '+qtyU(b)+(b.note?'　<span style="color:var(--amber)">備註：'+esc(b.note)+'</span>':'')+'</div></div>'+
        '<input class="bqty mono" data-id="'+b.id+'" type="number" inputmode="numeric" min="1" max="'+b.qty+'" value="'+esc(F.bq[b.id])+'" aria-label="'+esc(b.customer)+' 完成數量"><span class="hint">'+esc(b.unit||'')+'</span></div>').join('')+'</div></div>';
    h+='<div class="err">'+esc(F.err)+'</div><div class="row"><button id="fcancel" style="flex:1">取消</button><button id="fok" class="primary" style="flex:2;min-height:60px;font-size:18px"'+(F.busy?' disabled':'')+'>'+(F.busy?'儲存中…':'確認完成 '+F.batch.length+' 筆')+'</button></div></div></div>';
    const sc=$('#scrim')?$('.sheet').scrollTop:0;$('#modal').innerHTML=h;$('.sheet').scrollTop=sc;return;
  }
  const used=F.lots.reduce((s,l)=>s+l.qty,0),left=t.qty-used,cur=parseInt(F.qty,10)||0,tot=used+cur,u=t.unit?' '+t.unit:'';
  h+='<div class="sec"><label class="lbl" for="fqty"><i class="sn">4</i>'+(F.noLot?'完成數量（少於訂單的部分會留在看板）':F.lots.length?'這個批號的數量':'這個批號的數量（一筆用到兩個批號時，先填第一批的數量，再按下面「＋ 再加一個批號」）')+'</label>'+
    '<div class="row" style="flex-wrap:nowrap"><input id="fqty" class="mono" type="number" inputmode="numeric" min="1" max="'+left+'" value="'+esc(F.qty)+'" style="font-size:22px;flex:1"><span class="hint" style="white-space:nowrap">'+esc(t.unit||'')+'</span></div>'+
    (F.noLot?'':'<button type="button" id="faddlot" style="align-self:flex-start">＋ 再加一個批號</button>')+'</div>';
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
  else if(b.id==='fnolot'){F.noLot=!F.noLot;F.lots=[];F.err='';Snd.play('tap');return drawFinish()}
  else if(b.id==='faddlot')return addLot();
  else if(b.dataset.dellot!==undefined){F.lots.splice(+b.dataset.dellot,1)}
  else if(b.id==='fok')return finishConfirm();
  F.err='';if(F.box)return drawBox();if(changedLot)updatePreview();else drawFinish();
});
async function batchConfirm(){
  const fail=m=>{F.err=m;drawFinish()};
  if(!F.operator)return fail('請先點選操作人');
  if(!F.noLot){const savedQty=F.qty;F.qty='1';const ce=curLotErr();F.qty=savedQty;if(ce)return fail(ce)}
  const items=F.batch.map(b=>({id:b.id,qty:parseInt(F.bq[b.id],10)}));
  for(const it of items){const b=F.batch.find(x=>x.id===it.id);if(!it.qty||it.qty<1||it.qty>b.qty)return fail(b.customer+'：數量需介於 1 到 '+b.qty)}
  F.busy=true;drawFinish();
  try{
    const r=await api('POST','/api/tasks/finish-batch',{noLot:!!F.noLot,operator:F.operator,cat:F.cat,variety:F.variety,matDate:F.matDate,matArr:F.matArr,lot:F.mlot,items});
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
   '<div class="sheet-h"><div class="cust"><span class="cust-tag">客戶</span>'+esc(t.customer)+'</div><div class="pname">'+esc(t.productName)+' <span class="mono">× '+qtyU(t)+'</span></div><div class="meta">'+shipPill(t)+methodPill(t,1)+'<span class="pill p-box">禮盒不需要批號</span></div>'+(t.note?'<div class="note-box">備註：'+esc(t.note)+'</div>':'')+'</div>';
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
  if(F.noLot){if(!q||q<1||q>t.qty)return fail('數量需介於 1 到 '+t.qty);F.busy=true;drawFinish();
    try{const r=await api('POST','/api/tasks/'+t.id+'/finish',{operator:F.operator,noLot:true,qty:q});
      S.mine.add(t.id);F=null;$('#modal').innerHTML='';const p=S.products.find(x=>x.id===t.productId);if(p)p.no_lot=true;
      celebrate(t.customer,t.productName+(r.rest>0?'（剩 '+num(r.rest)+(t.unit?' '+t.unit:'')+' 留在看板）':''),['無批號']);
      await refresh(true);render(true)}catch(e){if(F){F.busy=false;fail(e.message)}}
    return}
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
function resetOrderForm(){OF.addr='';OF.addrFor='';OF.addrTouched=false;OF.method='';OF.urgent=false;OF.cust='';OF.date=today();OF.note='';OF.lines=[{p:'',q:'',u:''}]}
resetOrderForm();
function renderOrders(){
  const v=$('#v-orders'),prods=S.products.filter(p=>p.active!==false);
  const ed=S.editOrder?S.open.find(t=>t.id===S.editOrder):null;
  if(ed&&OF.editing!==ed.id){OF.editing=ed.id;OF.method=ed.shipMethod||'';OF.cust=ed.customer;OF.date=ed.shipDate;OF.note=ed.note||'';OF.lines=[{p:String(ed.productId||''),q:String(ed.qty),u:ed.unit||''}];OF.addrTouched=false;OF.addrFor='';fillAddr()}
  if(!ed&&OF.editing){OF.editing=null;resetOrderForm()}
  const names=new Set(S.customers.map(c=>c.name));S.open.concat(S.done).forEach(t=>{if(t.customer)names.add(t.customer)});
  const codeOf={};S.customers.forEach(c=>{if(c.code)codeOf[c.name]=c.code});
  let h='<div class="o-layout"><section class="o-form"><header class="pg-head"><h1>'+(ed?'修改訂單':'新增出貨訂單')+'</h1><p>'+(ed?'改完按「儲存修改」，看板會同步更新':'選客戶會列出他買過的品項，點一下就能加入')+'</p></header><form class="panel" id="oform" novalidate><div class="grid">'+
   '<label class="f" for="o-cust" style="grid-column:1/-1">客戶（輸入名稱或編號）<input id="o-cust" list="custlist" autocomplete="off" placeholder="例：全盛食品行" value="'+esc(OF.cust)+'"></label><datalist id="custlist">'+[...names].sort((a,b)=>a.localeCompare(b,'zh-Hant')).map(c=>'<option value="'+esc(c)+'">'+(codeOf[c]?esc(codeOf[c]):'')+'</option>').join('')+'</datalist>'+
   '<div id="o-hist" style="grid-column:1/-1"></div>'+
   '<div style="grid-column:1/-1;display:flex;flex-direction:column;gap:8px"><div class="lbl" style="font-size:13px;color:var(--muted)">品項、數量與單位</div><div id="o-lines" style="display:flex;flex-direction:column;gap:8px"></div>'+
   (ed?'':'<button type="button" id="o-addline" style="align-self:flex-start">＋ 新增品項</button>')+'</div>'+
   '<label class="f" for="o-date">指定出貨日<input id="o-date" type="date" value="'+esc(OF.date)+'"></label>'+
   '<div class="f o-method" role="group" aria-label="出貨方式"><span class="lbl">出貨方式</span><div class="chips">'+METHODS.map(m=>'<button type="button" class="chip mchip '+MCLS[m]+'" data-om="'+m+'" aria-pressed="'+(OF.method===m)+'">'+m+'</button>').join('')+'</div></div>'+
   '<label class="f o-addr" for="o-addr" style="grid-column:1/-1"'+(OF.method==='公司配送'?'':' hidden')+'>配送地址（公司配送用，會存到客戶資料，下次自動帶出；系統依地址排配送路線）<input id="o-addr" placeholder="例：高雄市三民區民族一路 100 號" value="'+esc(OF.addr||'')+'"></label>'+
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
    grp[d].map(t=>'<div class="orow"><div class="orow-m"><b>'+esc(t.customer)+methodPill(t)+'</b><span>'+esc(t.productName)+'</span>'+(t.note?'<em>'+esc(t.note)+'</em>':'')+'</div>'+
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
function fillAddr(){const name=resolveCustomer(OF.cust);if(OF.addrFor===name&&OF.addrTouched)return;const c=S.customers.find(x=>x.name===name);OF.addrFor=name;OF.addrTouched=false;OF.addr=c&&c.address||'';const i=$('#o-addr');if(i)i.value=OF.addr}
function lineIdx(el){const l=el.closest('.oline');return l?+l.dataset.i:-1}
$('#v-orders').addEventListener('input',e=>{
  const t=e.target;
  if(t.id==='o-cust'){OF.cust=t.value;renderHist();fillAddr()}
  else if(t.id==='o-date')OF.date=t.value;
  else if(t.id==='o-note')OF.note=t.value;
  else if(t.id==='o-addr'){OF.addr=t.value;OF.addrTouched=true}
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
  const customer=resolveCustomer(OF.cust),shipDate=OF.date,note=OF.note.trim(),shipMethod=OF.method||'';
  if(!customer)return err('請輸入客戶名稱');
  if(!shipDate)return err('請選擇出貨日');
  if(!shipMethod)return err('請選擇出貨方式（門市自取、公司配送、物流配送）');
  const lines=OF.lines.filter(l=>l.p||l.q);
  if(!lines.length)return err('請至少選一個品項');
  for(let i=0;i<lines.length;i++){const l=lines[i],n='第 '+(OF.lines.indexOf(l)+1)+' 行：';
    if(!l.p)return err(n+'請選擇品項');if(!(+l.q>0))return err(n+'數量需大於 0');if(!l.u)return err(n+'請選擇單位（桶、箱、瓶）')}
  const id=S.editOrder;
  if(id)S.mineO.add(+id);
  const r=await act(()=>id?api('PUT','/api/tasks/'+id,{customer,productId:lines[0].p,qty:lines[0].q,unit:lines[0].u,shipDate,note,shipMethod,address:(OF.addr||'').trim()})
    :api('POST','/api/tasks/batch',{customer,shipDate,note,shipMethod,address:(OF.addr||'').trim(),urgent:!!OF.urgent,items:lines.map(l=>({productId:l.p,qty:l.q,unit:l.u}))}).then(r=>{(r.ids||[]).forEach(i=>S.mineO.add(+i));return r}),
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
  if(b.dataset.om){OF.method=b.dataset.om;b.parentElement.querySelectorAll('[data-om]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));const ad=$('.o-addr');if(ad)ad.hidden=OF.method!=='公司配送';fillAddr();Snd.play('tap');return}
  if(b.id==='o-urg'){OF.urgent=!OF.urgent;b.setAttribute('aria-pressed',String(OF.urgent));if(OF.urgent)Snd.play('tap');return}
  if(b.dataset.ourg){const on=b.dataset.on==='1';if(on)S.ack.add(b.dataset.ourg+':*');saveAck();
    await act(()=>api('POST','/api/tasks/'+b.dataset.ourg+'/urgent',{on}),on?'已設為緊急單，生產端正在響警報':'已取消緊急');return}
  if(b.dataset.oedit){S.editOrder=+b.dataset.oedit;renderOrders();window.scrollTo({top:0,behavior:'smooth'})}
  else if(b.id==='o-cancel'){S.editOrder=null;renderOrders()}
  else if(b.dataset.ovoid){if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='再按一次確認';return}
    S.mineO.add(+b.dataset.ovoid);await act(()=>api('POST','/api/tasks/'+b.dataset.ovoid+'/void'),'訂單已取消')}
});

/* ---------- records ---------- */
function renderRecords(){
  const v=$('#v-records'),q=S.q.trim().toLowerCase();
  const rows=S.done.filter(t=>!q||[t.lot,t.customer,t.productName,t.operator,t.shipMethod,(t.matDate||'')+(t.matArr||''),(t.contents||[]).map(c=>c.lot+' '+c.name).join(' ')].join(' ').toLowerCase().includes(q));
  let h='<header class="pg-head"><h1>生產紀錄</h1><p>用批號、客戶或原料批反查，每一筆都有完成時間與操作人</p></header><div class="row rec-bar"><input id="rq" placeholder="搜尋批號、客戶、品項、原料批（例：0913B）" value="'+esc(S.q)+'" style="flex:1;min-width:220px">'+
    '<a class="btnlink" href="/api/export.csv'+(S.pin?'?pin='+encodeURIComponent(S.pin):'')+'">匯出 Excel（CSV）</a></div>';
  if(!S.done.length)h+='<div class="empty"><b>還沒有生產紀錄</b>在看板上按「完成生產」後，紀錄會出現在這裡，可以用批號回查。</div>';
  else h+='<p class="hint">共 '+rows.length+' 筆</p><div class="tbl-wrap"><table><thead><tr><th>完成時間</th><th>批號</th><th>品項</th><th>數量</th><th>客戶</th><th>出貨日</th><th>出貨方式</th><th>操作人</th><th></th></tr></thead><tbody>'+rows.map(t=>
   '<tr><td class="mono">'+fmtTime(t.completedAt)+'</td><td class="lotcell">'+(t.contents?t.contents.map(c=>'<div><span class="stamp sm">'+esc(c.lot)+'</span> <span class="hint" style="font-family:var(--f-body);font-weight:400">'+esc(shortName(c.name))+'　'+esc(c.date.slice(5).replace('-','/'))+'</span></div>').join(''):'<span class="stamp">'+esc(t.lot)+'</span>')+(t.lotHistory&&t.lotHistory.length?'<div class="hint">曾修改 '+t.lotHistory.length+' 次</div>':'')+'</td><td>'+esc(t.productName)+'</td><td class="mono">'+qtyU(t)+(t.orderedQty&&t.orderedQty!==t.qty?'<div class="hint">訂單 '+num(t.orderedQty)+'</div>':'')+'</td><td>'+esc(t.customer)+'</td><td class="mono">'+esc(t.shipDate)+'</td><td>'+(t.shipMethod?methodPill(t):'<span class="hint">—</span>')+'</td><td>'+esc(t.operator)+'</td>'+
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
  const th=store.get('tsb_theme')==='ivory'?'ivory':'forest';
  let h='<header class="pg-head"><h1>設定</h1><p>人員、品項主檔、批號規則都在這裡，改了所有裝置立刻同步</p></header><h2>外觀主題</h2><div class="panel"><div class="themes"><button type="button" class="theme-opt" data-theme-set="forest" aria-pressed="'+(th==='forest')+'"><i style="background:linear-gradient(135deg,#08100C 55%,#F2B21A)"></i><b>森林綠（夜間）</b><small>深色底、蜂蜜金，適合現場與電視</small></button><button type="button" class="theme-opt" data-theme-set="ivory" aria-pressed="'+(th==='ivory')+'"><i style="background:linear-gradient(135deg,#E6DDC8 55%,#15213B)"></i><b>象牙金（明亮）</b><small>象牙白底、海軍藍字，適合辦公室</small></button></div></div><h2>人員名單</h2><div class="panel"><div class="chips" style="margin-bottom:12px">'+((c.people||[]).map((n,i)=>'<button class="chip" data-delp="'+i+'" title="移除">'+esc(n)+'　×</button>').join('')||'<span class="hint">還沒有人員，新增後在看板完成生產時可以點選。</span>')+'</div>'+
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
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.themeSet){const t=b.dataset.themeSet;store.set('tsb_theme',t);if(t==='ivory')document.documentElement.setAttribute('data-theme','ivory');else document.documentElement.removeAttribute('data-theme');const m=document.querySelector('meta[name=theme-color]');if(m)m.content=t==='ivory'?'#E6DDC8':'#0A110E';return renderSettings()}
  const c=JSON.parse(JSON.stringify(cfg()));c.people=c.people||[];c.varieties=c.varieties||{};
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
