/* 統香營運中樞（第二代）前端：接單台、生產台、出貨台、總覽 */
(function(){
'use strict';
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store={get(k){try{return localStorage.getItem(k)||''}catch(e){return''}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
const num=n=>Number(n||0).toLocaleString('zh-TW');
const WK='日一二三四五六';
const ROLES=[['intake','接單台','LINE 叫貨自動變草稿，確認就成單'],['factory','生產台','只看還缺多少，做好直接入庫'],['dispatch','出貨台','批號自動配好，揀貨、印出貨單'],['pulse','總覽','今天的工廠一眼看完']];

const LP={
  cn(t){const D={零:0,〇:0,一:1,二:2,兩:2,两:2,三:3,四:4,五:5,六:6,七:7,八:8,九:9};let n=0,cur=0;
    for(const ch of t){if(ch in D)cur=D[ch];else if(ch==='十'){n+=(cur||1)*10;cur=0}else if(ch==='百'){n+=(cur||1)*100;cur=0}}return n+cur},
  norm(s){return String(s||'').normalize('NFKC').replace(/[\u200b\ufeff]/g,'')
    .replace(/([零〇一二兩两三四五六七八九十百]+)(?=\s*(?:桶|箱|瓶|打|件|罐|支|盒|包|台斤|斤|公斤|公克|克))/g,m=>String(LP.cn(m)))
    .replace(/(\d+(?:\.\d+)?)\s*(?:kg|KG|Kg|kG|公斤)/g,'$1公斤')
    .replace(/(\d+(?:\.\d+)?)\s*台?斤/g,'$1台斤')
    .replace(/(\d+)\s*(?:g|G|克|公克)(?![a-zA-Z])/g,'$1g')
    .replace(/(\d+)\s*(?:罐|支)/g,'$1瓶').replace(/(\d+)\s*件/g,'$1箱')},
  key(s){return LP.norm(s).toLowerCase().replace(/[\s,，、;；:：.。!！?？~～()（）\[\]【】「」『』"'＊*xX×＃#\-－_/]/g,'')},
  wt(s){const m=String(s).match(/(?<![\d.])(\d+(?:\.\d+)?)(公斤|g|台斤)/);return m?m[1]+m[2]:''},
  wtAlts(w){const m=w.match(/^([\d.]+)(公斤|g|台斤)$/);if(!m)return [w];const n=+m[1],r=x=>String(Math.round(x*10)/10),out=[w];
    if(m[2]==='台斤')out.push(r(n*.6)+'公斤');if(m[2]==='公斤'&&Math.abs(n/.6-Math.round(n/.6))<.01)out.push(Math.round(n/.6)+'台斤');return out},
  hasWt(name,w){if(!w)return true;const nn=LP.norm(name);return LP.wtAlts(w).some(x=>new RegExp('(?<![\\d.])'+x.replace('.','\\.')+'(?![\\d])').test(nn))},
  grams(s){const a=new Set(),k=LP.key(s);for(let i=0;i<k.length-1;i++)a.add(k.slice(i,i+2));for(const ch of k)if(/[一-鿿]/.test(ch))a.add(ch);return a},
  /* ---- dates / method / urgent ---- */
  dateOf(text,todayISO){
    const t=LP.norm(text),[Y,M,D]=todayISO.split('-').map(Number),base=new Date(Date.UTC(Y,M-1,D));
    const iso=d=>d.toISOString().slice(0,10),add=n=>{const d=new Date(base);d.setUTCDate(d.getUTCDate()+n);return iso(d)};
    let m;
    if((m=t.match(/(?<![\d.])(\d{1,2})\s*[\/月]\s*(\d{1,2})(?![\d.]*(?:公斤|g))\s*[日號号]?/))){const mo=+m[1],da=+m[2];if(mo>=1&&mo<=12&&da>=1&&da<=31){let y=Y;if(mo<M-2)y++;return {date:y+'-'+String(mo).padStart(2,'0')+'-'+String(da).padStart(2,'0'),hit:m[0]}}}
    if((m=t.match(/大後天/)))return {date:add(3),hit:m[0]};
    if((m=t.match(/後天/)))return {date:add(2),hit:m[0]};
    if((m=t.match(/明天|明日/)))return {date:add(1),hit:m[0]};
    if((m=t.match(/今天|今日/)))return {date:add(0),hit:m[0]};
    if((m=t.match(/(下{1,2})?(?:週|周|星期|禮拜|礼拜)([一二三四五六日天])/))){const want='日一二三四五六'.indexOf(m[2]==='天'?'日':m[2]),cur=base.getUTCDay();let n=(want-cur+7)%7;if(m[1])n+=7*m[1].length;else if(n===0)n=0;return {date:add(n),hit:m[0]}}
    if((m=t.match(/(?<![\d.\/])(\d{1,2})\s*[號号](?!碼)/))){const da=+m[1];if(da>=1&&da<=31){let y=Y,mo=M;if(da<D){mo++;if(mo>12){mo=1;y++}}return {date:y+'-'+String(mo).padStart(2,'0')+'-'+String(da).padStart(2,'0'),hit:m[0]}}}
    return null},
  methodsOf(t){t=LP.norm(t);const o=[];
    if(/物流|宅配|貨運|黑貓|新竹貨運|嘉里|大榮|郵寄|郵局寄|寄送|寄過去|寄出/.test(t))o.push('物流配送');
    if(/自取|來拿|來載|自載|過來拿|門市取|自己拿|自提/.test(t))o.push('門市自取');
    if(/配送|送貨|我們送|幫送|送過去|送到|司機送|載過去/.test(t))o.push('公司配送');
    return o},
  prodLike(text,ctx){const t=LP.norm(text),k=LP.key(t);if(k.length<2)return false;if(LP.wt(t))return true;
    if(/蜜|糖漿|油|醋|果樂|佛祖|瓶裝|桶裝|玻璃|禮盒|紅尖|黃尖|紅壓|黃壓/.test(k))return true;
    return ctx.products.some(p=>LP.key(p.name).includes(k))},
  METH_RE:/物流配送|物流|宅配|貨運|黑貓|新竹貨運|嘉里|大榮|郵寄|郵局寄|寄送|寄過去|寄出|門市自取|自取|來拿|來載|自載|過來拿|門市取|自己拿|自提|公司配送|配送|送貨|我們送|幫送|送過去|送到|司機送|載過去/g,
  urgentOf(t){return /急件|緊急|很急|趕貨|要趕|急單/.test(LP.norm(t))},
  subseq(a,b){let i=0;for(const ch of b){if(ch===a[i])i++;if(i===a.length)return true}return false},
  /* ---- customer ---- */
  custOf(line,ctx){
    const k=LP.key(line);if(k.length<2)return null;
    const al=ctx.aliases&&ctx.aliases.c||{};
    for(const a of Object.keys(al).sort((x,y)=>y.length-x.length))if(a.length>=2&&k.includes(a))return {name:al[a],hit:a,sure:true};
    let best=null;
    for(const c of ctx.customers){const ck=LP.key(c.name);if(ck.length<2)continue;
      if(k.includes(ck)){if(!best||ck.length>best.len)best={name:c.name,len:ck.length,hit:ck,sure:true}}
      else if(c.code&&new RegExp('(^|[^a-z0-9])'+c.code.toLowerCase().replace(/[^a-z0-9]/g,'')+'([^a-z0-9]|$)').test(LP.norm(line).toLowerCase())&&c.code.length>=3){if(!best)best={name:c.name,len:c.code.length,hit:c.code.toLowerCase(),sure:true}}}
    if(best)return best;
    /* short name typed in LINE: the first word is the beginning of exactly one customer name */
    const hm=LP.norm(line).trim().match(/^[^\d\s:：,，、]+/),head=hm?LP.key(hm[0]):'';
    if(/[，,。！!？?]/.test(line))return null;
    if(head.length>=2&&!ctx.products.some(p=>LP.key(p.name).includes(head))){
      let hits=ctx.customers.filter(c=>LP.key(c.name).includes(head));
      if(!hits.length)hits=ctx.customers.filter(c=>{const ck=LP.key(c.name);return ck[0]===head[0]&&LP.subseq(head,ck)});
      if(hits.length>1){const pre=hits.filter(c=>LP.key(c.name).startsWith(head));if(pre.length)hits=pre}
      if(hits.length>1)hits=hits.sort((a,b)=>a.name.length-b.name.length).slice(0,1);
      if(hits.length===1)return {name:hits[0].name,hit:hm[0].trim(),sure:false}}
    return null},
  /* ---- product ---- */
  prodOf(text,ctx,customer){
    const k=LP.key(text);if(!k)return {p:'',sure:false,cands:[]};
    const al=ctx.aliases&&ctx.aliases.p||{};
    for(const ak of [customer+'|'+k,k])if(al[ak]&&ctx.products.some(p=>String(p.id)===String(al[ak])&&p.active!==false))return {p:String(al[ak]),sure:true,cands:[]};
    const w=LP.wt(LP.norm(text)),kk=LP.key(LP.norm(text).replace(w,'')),g=LP.grams(LP.norm(text).replace(w,'')),hist={},fam=[];
    (ctx.history||[]).forEach(h=>{if(h[0]===customer){hist[h[1]]=h[2];const hp=ctx.products.find(p=>p.id===h[1]);if(hp)fam.push(LP.grams(hp.name.replace(LP.wt(LP.norm(hp.name)),'')))}});
    const pool=ctx.products.filter(p=>p.active!==false&&LP.hasWt(p.name,w));
    const sc=pool.map(p=>{const pg=LP.grams(p.name.replace(LP.wt(LP.norm(p.name)),''));let s=0;g.forEach(x=>{if(pg.has(x))s+=x.length===2?2:1});const ov=s+(hist[p.id]?1:0);
      const pk=LP.key(p.name);if(k.length>=2&&pk.includes(k))s+=6;else if(kk.length>=2&&pk.includes(kk))s+=6;
      if(hist[p.id])s+=4+Math.min(4,hist[p.id]);
      else if(fam.length){let best=0;fam.forEach(f=>{let c=0,n=0;pg.forEach(x=>{n++;if(f.has(x))c++});if(n)best=Math.max(best,c/n)});if(best>=.85)s+=3*best}
      s-=.15*pk.length;
      if(p.code&&k.includes(LP.key(p.code)))s+=20;
      return {p,s,ov}}).sort((a,b)=>b.s-a.s||a.p.name.length-b.p.name.length);
    if(!sc.length)return {p:'',sure:false,cands:[]};
    const top=sc[0],sec=sc[1];
    const sure=(sc.length===1&&!!w)||(!!w||top.s>=6)&&(!sec||top.s-sec.s>=3.5);
    return {p:top.ov>0||w?String(top.p.id):'',sure:sure&&(top.ov>0||!!w),cands:sc.slice(0,4).map(x=>String(x.p.id))}},
  /* ---- items in one line: "品名 10箱"、"品名x10"、"10箱 品名"、"品名 10" ---- */
  itemsOf(line){
    const t=LP.norm(line),out=[];const re=/(\d+)\s*(桶|箱|瓶|打)/g;let m,last=0;const ms=[];
    while((m=re.exec(t)))ms.push(m[2]==='打'?{i:m.index,e:re.lastIndex,q:+m[1]*12,u:'瓶',dz:m[1]+'打'}:{i:m.index,e:re.lastIndex,q:+m[1],u:m[2]});
    if(ms.length){ms.forEach((x,j)=>{let name=t.slice(last,x.i);if(!LP.key(name)&&j===ms.length-1)name=t.slice(x.e);last=x.e;out.push({name:name.trim(),q:x.q,u:x.u,dz:x.dz||''})});return out}
    const x=t.match(/^(.*?\D)\s*[x×*＊]\s*(\d+)\s*$/i)||t.match(/^(.*?(?:公斤|g|台斤|[^\d\s.]))\s+(\d+)\s*$/);
    if(x&&LP.key(x[1]).length>=2)return [{name:x[1].trim(),q:+x[2],u:''}];
    return []},
  parse(text,ctx){
    const SKIP=/^(已入單|已下單|已排|已排單|收到|好|好的|ok|okay|謝謝|感謝|了解|沒問題|👌|👍|ㄛ|嗯)$/i;
    const FILL=/急件|緊急|很急|趕貨|要趕|急單|出貨|交貨|送達|日期|客戶|訂單|訂購|叫貨|麻煩|謝謝|感謝|請|幫忙|一下|喔|唷|哦|囉/g;
    const lines=String(text||'').split(/\r?\n/).map(s=>s.replace(/^\s*[\d]+[.)、]\s+/,'').trim());
    const blocks=[];let cur=null,blank=false;
    const fresh=()=>({customer:'',custSure:false,custRaw:'',custNew:false,items:[],date:'',methods:[],urgent:false,notes:[],pending:''});
    const flush=()=>{if(cur){if(cur.pending){cur.items.push({raw:cur.pending,q:'',u:''});cur.pending=''}if(cur.customer||cur.items.length)blocks.push(cur)}cur=null};
    const clean=n=>n.replace(/^[\s:：,，、;；.。\-－]+|[\s:：,，、;；.。\-－x×*]+$/g,'').trim();
    for(const raw of lines){
      if(!raw){blank=true;continue}
      if(/^\[?\d{1,2}:\d{2}\]?$/.test(raw)||/^\d{4}[\/.]\d{1,2}[\/.]\d{1,2}\(?.?\)?$/.test(raw))continue;
      let rest=LP.norm(raw).replace(/^\d{1,2}:\d{2}\s+\S+\s+/,'');
      if(SKIP.test(rest.replace(/[\s!！。.～~,，]/g,'')))continue;
      const d=LP.dateOf(rest,ctx.today),meths=LP.methodsOf(rest),urg=LP.urgentOf(rest);
      let body=rest;if(d)body=body.replace(d.hit,' ');body=body.replace(LP.METH_RE,' ').replace(FILL,' ');
      let c=LP.custOf(body,ctx);const its=LP.itemsOf(body);
      if(!c&&!its.length&&!/[，,。！!？?]/.test(body)){const nk=LP.key(body);
        if(nk.length>=2&&nk.length<=12&&!/\d/.test(nk)&&!LP.prodLike(body,ctx)&&!d&&!meths.length&&(!cur||(!cur.customer&&!cur.items.length&&!cur.pending)||(blank&&(cur.items.length||cur.pending))))
          c={name:body.trim(),hit:body.trim(),sure:false,isNew:true}}
      if(c&&cur&&(cur.items.length||cur.pending||(cur.customer&&cur.customer!==c.name)))flush();
      if(!cur)cur=fresh();
      blank=false;
      if(c&&!cur.customer){cur.customer=c.name;cur.custSure=c.sure;cur.custRaw=c.hit;cur.custNew=!!c.isNew}
      if(d&&!cur.date)cur.date=d.date;meths.forEach(m=>{if(!cur.methods.includes(m))cur.methods.push(m)});if(urg)cur.urgent=true;
      const stripC=n=>{if(!c)return n;const ck=LP.key(c.hit);return LP.key(n).startsWith(ck)?LP.norm(n).replace(new RegExp('^\\s*'+[...ck].map(ch=>ch.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('\\s*'),'i'),''):n};
      if(its.length){its.forEach(it=>{let name=clean(stripC(it.name));if(!LP.key(name)&&cur.pending){name=cur.pending;cur.pending=''}
        else if(cur.pending){cur.items.push({raw:cur.pending,q:'',u:''});cur.pending=''}
        cur.items.push({raw:name,q:it.q,u:it.u,dz:it.dz})});
        if(meths.length>1||(LP.key(body.replace(/\d+\s*(桶|箱|瓶|打)/g,'')).length>=6&&its.every(it=>LP.key(it.name).length<2)))cur.notes.push(raw);
        continue}
      const left=clean(stripC(body));
      if(c&&!LP.key(left))continue;
      if(LP.prodLike(left,ctx)){if(cur.pending)cur.items.push({raw:cur.pending,q:'',u:''});cur.pending=left;continue}
      if(LP.key(left).length>=2||meths.length>1)cur.notes.push(raw)}
    flush();
    return blocks.map(b=>{const hist=(ctx.history||[]).filter(h=>h[0]===b.customer).sort((x,y)=>y[2]-x[2]);
      const items=b.items.map(it=>{
        if(!LP.key(it.raw)){const h=hist[0];return {...it,p:h?String(h[1]):'',sure:false,cands:hist.slice(0,4).map(x=>String(x[1])),fromHist:!!h}}
        const m=LP.prodOf(it.raw,ctx,b.customer);return {...it,p:m.p,sure:m.sure,cands:m.cands}});
      const notes=b.notes.slice();items.forEach(it=>{if(it.dz)notes.push((it.raw||'')+' '+it.dz+'（已換算 '+it.q+' 瓶）')});
      return {customer:b.customer,custSure:b.custSure,custRaw:b.custRaw,custNew:b.custNew,items,date:b.date,method:b.methods.length===1?b.methods[0]:'',methodMixed:b.methods.length>1,urgent:b.urgent,notes}})}
};

const S={pin:store.get('tsb_pin'),op:store.get('tsb_op'),role:'',d:null,rev:-1,busy:false,pending:false,
  I:{blocks:[],idx:0,lineId:null,draft:null,paste:false,text:''},
  F:{sel:'',kp:'',qty:{},lot:{},exp:{},unit:{},pack:{},comps:{},prev:{},other:'',busy:false},
  D:{date:'',meth:'',off:{}}};

/* ---------- helpers ---------- */
function toast(m,ms){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(toast.t);toast.t=setTimeout(()=>{t.hidden=true},ms||5000)}
const today=()=>S.d?S.d.today:new Date().toISOString().slice(0,10);
function addDays(iso,n){const x=new Date(iso+'T00:00:00Z');x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)}
function dayDiff(a,b){return Math.round((new Date(a+'T00:00:00Z')-new Date(b+'T00:00:00Z'))/864e5)}
function md(iso){if(!iso)return '';const x=new Date(iso+'T00:00:00Z');return (x.getUTCMonth()+1)+'/'+x.getUTCDate()+'（'+WK[x.getUTCDay()]+'）'}
function rel(iso){const n=dayDiff(iso,today());if(n<0)return '逾期 '+(-n)+' 天';if(n===0)return '今天';if(n===1)return '明天';if(n===2)return '後天';return md(iso)}
function hm(ts){if(!ts)return '';const x=new Date(ts);return String(x.getHours()).padStart(2,'0')+':'+String(x.getMinutes()).padStart(2,'0')}
const P=id=>(S.d&&S.d.products.find(p=>String(p.id)===String(id)))||null;
const custOf=n=>(S.d&&S.d.customers.find(c=>c.name===n))||null;
const allTasks=()=>S.d?S.d.open.concat(S.d.active):[];
function ledger(p,u){u=u||'';if(u==='箱')return p&&p.packSize&&p.baseUnit?{ku:p.baseUnit,f:p.packSize}:{ku:'箱',f:1};return {ku:u,f:1}}
function qtyTxt(q,u){return num(q)+(u?' '+u:'')}
function shipLotsTxt(t){const l=t.shipLots&&t.shipLots.length?t.shipLots:null;if(l)return l.map(x=>x.lot+(x.expiry?'（效期 '+x.expiry.replace(/-/g,'/')+'）':'')+(l.length>1?' × '+x.qty:'')).join('、');return t.lot||''}
function status(t){
  if(t.status==='open'){const c=S.d.cover[t.id]||{};if(c.state==='stock')return {k:'stock',txt:'庫存已預留',cls:'t-ok'};return {k:'short',txt:c.state==='part'?'部分有庫存，等生產':'等生產',cls:'t-amb'}}
  if(t.deliveryStatus==='delivered')return {k:'delivered',txt:(t.shipMethod==='公司配送'?'已送達 ':'已交貨 ')+hm(t.deliveryAt),cls:'t-ink'};
  if(t.deliveryStatus==='failed')return {k:'failed',txt:'配送異常：'+(t.deliveryIssue||''),cls:'t-red'};
  if(t.shipMethod==='公司配送')return t.tripDriver?{k:'trip',txt:t.tripDriver+' 已出車',cls:'t-ok'}:{k:'ready',txt:'已備貨，等司機',cls:'t-ok'};
  return {k:'ready',txt:'已備貨，'+(t.shipMethod==='物流配送'?'等交物流':'等客戶取貨'),cls:'t-ok'};
}
function needOp(){if(S.op)return true;toast('請先在右上角填你的名字');const i=$('#op');if(i)i.focus();return false}

/* ---------- api ---------- */
async function api(method,url,body){
  const r=await fetch(url,{method,headers:{'Content-Type':'application/json','X-PIN':S.pin},body:body?JSON.stringify(body):undefined});
  if(r.status===401){showPin();throw new Error('需要密碼')}
  if(r.status===502||r.status===503||r.status===504)throw new Error('系統啟動中，請稍候幾秒再試');
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(data.error||'連線失敗');
  return data;
}
async function act(fn,ok){if(S.busy)return null;S.busy=true;try{const r=await fn();await refresh(true);if(ok)toast(typeof ok==='function'?ok(r):ok);return r}catch(e){toast(e.message);return null}finally{S.busy=false;render()}}
let tries=0;
async function refresh(force){
  try{
    if(!force&&S.d){const {rev}=await api('GET','/api/rev');if(rev===S.rev)return setSync(true)}
    const d=await api('GET','/api/v2/state');
    S.d=d;S.rev=d.rev;tries=0;setSync(true);
    if(typing())S.pending=true;else render();
  }catch(e){if(e.message==='需要密碼')return;tries++;setSync(false,e.message);if(!S.d)$('#main').innerHTML='<div class="empty">'+(tries<3?'系統啟動中（免費主機閒置後約 30 秒），會自動重試…':'連線不到系統，會繼續重試。')+'</div>'}
}
function setSync(ok,m){const s=$('#sync');if(!s)return;s.className='sync'+(ok?'':' bad');s.textContent=ok?'已同步':'連線中斷，重試中…'}
function typing(){const a=document.activeElement;return a&&a.closest&&a.closest('#main')&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&a.type!=='checkbox'}
document.addEventListener('focusout',()=>setTimeout(()=>{if(S.pending&&!typing()){S.pending=false;render()}},120));
let pollT=null;
function start(){refresh(true);clearInterval(pollT);pollT=setInterval(()=>{if(!document.hidden)refresh(false)},4000)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(false)});
function showPin(){
  clearInterval(pollT);if($('#pinbox'))return;
  $('#modal').innerHTML='<div class="modal"><form class="box" id="pinbox"><h2 class="ttl">請輸入公司密碼</h2><p class="muted small">和舊看板同一組密碼，輸入一次會記住。</p><input class="inp" id="pinin" type="password" inputmode="numeric" autocomplete="current-password" aria-label="公司密碼"><div id="pinerr" class="small" style="color:var(--red)"></div><button class="btn pri" type="submit">進入</button></form></div>';
  $('#pinin').focus();
  $('#pinbox').addEventListener('submit',async e=>{e.preventDefault();S.pin=$('#pinin').value.trim();
    const r=await fetch('/api/rev',{headers:{'X-PIN':S.pin}});
    if(r.ok){store.set('tsb_pin',S.pin);$('#modal').innerHTML='';start()}else $('#pinerr').textContent=r.status===429?'錯太多次，請 10 分鐘後再試':'密碼不對，請再試一次'});
}

/* ---------- frame ---------- */
function counts(){const d=S.d;if(!d)return {};return {intake:d.lineInbox.length,factory:d.demand.filter(x=>x.make>0).length}}
function drawTop(){
  const c=counts();
  $('#top').innerHTML='<a class="brand" href="#" style="color:inherit;text-decoration:none">統香營運中樞</a><nav class="nav" aria-label="角色">'+
    ROLES.map(r=>'<button type="button" data-role="'+r[0]+'"'+(S.role===r[0]?' aria-current="page"':'')+'>'+r[1]+(c[r[0]]?'<span class="n">'+c[r[0]]+'</span>':'')+'</button>').join('')+
    '<a href="/v2/driver" class="sm">司機</a><a href="/" class="sm">舊看板</a></nav>'+
    '<label class="who">你是<input id="op" list="oplist" value="'+esc(S.op)+'" placeholder="名字" autocomplete="off"></label><datalist id="oplist">'+((S.d&&S.d.cfg.people)||[]).map(p=>'<option value="'+esc(p)+'">').join('')+'</datalist><span id="sync" class="sync"></span>';
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-role]');if(b){go(b.dataset.role)}});
document.addEventListener('change',e=>{if(e.target.id==='op'){S.op=e.target.value.trim().slice(0,20);store.set('tsb_op',S.op)}});
function go(r){S.role=r;if(r)store.set('tsb_v2role',r);if(location.hash!=='#'+r)history.replaceState(null,'','#'+r);render();window.scrollTo(0,0)}
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);S.role=ROLES.some(r=>r[0]===h)?h:'';render()});
function render(){
  document.body.classList.toggle('fx',S.role==='factory');
  drawTop();
  if(!S.d)return;
  const m=$('#main');
  if(!S.role)m.innerHTML=homeV();
  else if(S.role==='intake')m.innerHTML=intakeV();
  else if(S.role==='factory')m.innerHTML=factoryV();
  else if(S.role==='dispatch')m.innerHTML=dispatchV();
  else if(S.role==='pulse')m.innerHTML=pulseV();
  setSync(true);
}
function homeV(){
  return '<div class="home"><div><div class="lbl">統香蜂蜜 · 第二代系統</div><h1 class="ttl" style="font-size:38px;margin-top:6px">你今天負責哪一塊？</h1><p class="muted">選一次會記住，之後打開就直接到你的畫面。上方可以隨時切換。</p></div><div class="roles">'+
    ROLES.map(r=>'<button type="button" class="role" data-role="'+r[0]+'"><b>'+r[1]+'</b><span>'+r[2]+'</span></button>').join('')+
    '<a class="role" href="/v2/driver"><b>司機</b><span>今天的路線、送達拍照簽收（用手機開）</span></a></div></div>';
}

/* =================== 接單台 =================== */
function lpCtx(){const d=S.d,cs=d.customers.slice(),seen=new Set(cs.map(c=>c.name));allTasks().forEach(t=>{if(!seen.has(t.customer)){seen.add(t.customer);cs.push({name:t.customer,code:''})}});
  return {products:d.products,customers:cs,history:d.history,aliases:d.cfg.aliases||{p:{},c:{}},today:today()}}
function unitGuess(pid,cust){if(!pid)return '';const hs=allTasks().filter(t=>String(t.productId)===String(pid)&&t.unit);const mine=hs.filter(t=>t.customer===cust);if(mine.length)return mine[0].unit;if(hs.length)return hs[0].unit;const p=P(pid);return p&&p.packSize?'箱':(p&&p.baseUnit)||''}
function lastMethod(cust){const t=allTasks().filter(x=>x.customer===cust&&x.shipMethod).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)))[0];return t?t.shipMethod:''}
function blankDraft(){return {customer:'',custRaw:'',custSure:true,custNew:false,date:today(),dateGuess:false,method:'',address:'',urgent:false,note:'',lines:[{p:'',q:'',u:'',raw:'',unsure:false,cands:[]}]}}
function fromBlock(b){
  const lines=b.items.length?b.items.map(it=>({p:it.p||'',q:String(it.q||''),u:it.u||unitGuess(it.p,b.customer),raw:it.raw||'（沒寫品項）',unsure:!it.p||!it.sure,cands:it.cands||[],fromHist:!!it.fromHist})):[{p:'',q:'',u:'',raw:'',unsure:false,cands:[]}];
  return {customer:b.customer||'',custRaw:b.custRaw||'',custSure:!!b.custSure,custNew:!!b.custNew,date:b.date||today(),dateGuess:!b.date,method:b.method||lastMethod(b.customer)||'',methodGuess:!b.method,address:'',urgent:!!b.urgent,note:(b.notes||[]).join(' ').slice(0,200),lines};
}
function loadText(text,lineId){const bl=LP.parse(text,lpCtx());if(!bl.length){toast('看不出訂單內容（要有客戶和數量），可以按「不是訂單」或自己輸入');return false}
  S.I.blocks=bl;S.I.idx=0;S.I.lineId=lineId||null;S.I.draft=fromBlock(bl[0]);return true}
function lineStock(dr){
  const used={};
  return dr.lines.map(l=>{
    const p=P(l.p),q=parseInt(l.q,10);if(!p)return {cls:'t-dim',txt:l.p?'':'請選品項'};if(!q)return {cls:'t-dim',txt:'請填數量'};
    const L=ledger(p,l.u),key=p.id+'|'+L.ku;
    if(L.ku==='箱'&&l.u==='箱')return {cls:'t-amb',txt:'要生產（還沒設定一箱幾入）'};
    const spare=((S.d.spare[p.id]||{})[L.ku]||0)-(used[key]||0),need=q*L.f;
    used[key]=(used[key]||0)+Math.min(need,Math.max(0,spare));
    if(spare>=need)return {cls:'t-ok',txt:'庫存可出'};
    const short=Math.ceil((need-Math.max(0,spare))/L.f);
    return {cls:'t-amb',txt:spare>0?'庫存只夠一部分，缺 '+short+(l.u||''):'需生產 '+short+(l.u?' '+l.u:'')};
  });
}
function prodOptions(sel,cands){
  const d=S.d,act=d.products.filter(p=>p.active!==false||String(p.id)===String(sel));
  const first=(cands||[]).map(id=>act.find(p=>String(p.id)===String(id))).filter(Boolean);
  const rest=act.filter(p=>!first.includes(p)).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant'));
  const o=p=>'<option value="'+p.id+'"'+(String(p.id)===String(sel)?' selected':'')+'>'+esc(p.name)+'</option>';
  return '<option value="">— 選品項 —</option>'+(first.length?'<optgroup label="最可能">'+first.map(o).join('')+'</optgroup><optgroup label="全部">':'')+rest.map(o).join('')+(first.length?'</optgroup>':'');
}
function intakeV(){
  const I=S.I,d=S.d;
  const inbox='<section class="inbox" aria-label="LINE 收件匣"><div class="hd"><span class="lbl">LINE 收件匣'+(d.lineInbox.length?'（'+d.lineInbox.length+'）':'')+'</span><button type="button" class="btn sm" data-ik="paste">貼上 LINE 文字</button></div>'+
    (I.paste?'<div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--line)"><label class="small muted" for="ik-text">把 LINE 上的訂單整段複製貼上，可以一次好幾位客戶</label><textarea id="ik-text" class="inp" rows="6">'+esc(I.text)+'</textarea><button type="button" class="btn pri sm" data-ik="parse">自動帶入</button></div>':'')+
    (d.lineInbox.length?d.lineInbox.map(m=>'<button type="button" class="msg" data-lin="'+m.id+'"'+(I.lineId===m.id?' aria-current="true"':'')+'><span class="row" style="justify-content:space-between;width:100%"><b class="small">LINE 群組</b><span class="small muted">'+md(new Date(m.at).toISOString().slice(0,10)).replace(/（.）/,'')+' '+hm(m.at)+'</span></span><pre>'+esc(m.text)+'</pre></button>').join('')
      :'<div class="empty small">'+(d.cfg.lineReady?'目前沒有待處理的 LINE 叫貨訊息。':'LINE 機器人還沒設定好，先用上面「貼上 LINE 文字」。')+'</div>')+
    '</section>';
  const dr=I.draft;
  let mid;
  if(!dr)mid='<section class="draft"><div class="lbl">訂單草稿</div><div class="empty">點左邊一則 LINE 訊息，或貼上 LINE 文字，系統會自動對好客戶、品項和數量。<div style="margin-top:14px"><button type="button" class="btn pri" data-ik="new">手動新增一張訂單</button></div></div></section>';
  else{
    const st=lineStock(dr),c=custOf(dr.customer);
    const custTag=!dr.customer?'<span class="tag t-amb">請填客戶</span>':dr.custNew||!c?'<span class="tag t-amb">新客戶，請確認名稱</span>':dr.custRaw&&!dr.custSure?'<span class="tag t-amb">LINE 寫「'+esc(dr.custRaw)+'」，請確認</span>':'<span class="tag t-ok">客戶已對到</span>';
    const needAddr=dr.method==='公司配送'&&!(c&&(c.address||c.geo));
    mid='<section class="draft" aria-label="訂單草稿">'+
      '<div class="row" style="justify-content:space-between"><div class="lbl">訂單草稿'+(I.blocks.length>1?' · 第 '+(I.idx+1)+' ／ '+I.blocks.length+' 張':'')+'</div>'+(dr.urgent?'<span class="tag t-red">急件</span>':'')+'</div>'+
      '<div class="field"><label for="ik-cust">客戶</label><div class="row"><input id="ik-cust" class="inp" style="flex:1 1 220px;font-size:22px;font-weight:800" list="ik-custs" value="'+esc(dr.customer)+'" autocomplete="off">'+custTag+'</div><datalist id="ik-custs">'+d.customers.map(x=>'<option value="'+esc(x.name)+'">').join('')+'</datalist></div>'+
      '<div class="grid2"><div class="field"><label for="ik-date">出貨日'+(dr.dateGuess?'（LINE 沒寫，先帶今天）':'')+'</label><input id="ik-date" type="date" class="inp" value="'+esc(dr.date)+'"></div>'+
      '<div class="field"><span class="fl">出貨方式'+(dr.methodGuess&&dr.method?'（依上次）':'')+'</span><div class="seg">'+['公司配送','門市自取','物流配送'].map(m=>'<button type="button" data-meth="'+m+'" aria-pressed="'+(dr.method===m)+'">'+m+'</button>').join('')+'</div></div></div>'+
      (needAddr?'<div class="field"><label for="ik-addr">送貨地址（這位客戶還沒有地址；不填也可以，司機送達時會自動記下位置）</label><input id="ik-addr" class="inp" value="'+esc(dr.address)+'"></div>':'')+
      '<div class="lines">'+dr.lines.map((l,i)=>'<div class="ln'+(l.unsure&&l.raw?' unsure':'')+'">'+(l.raw?'<div class="raw">LINE：'+esc(l.raw)+(l.unsure?' — 沒把握，請確認品項':'')+'</div>':'')+
        '<select class="inp" data-lp="'+i+'" aria-label="品項">'+prodOptions(l.p,l.cands)+'</select>'+
        '<input class="inp" data-lq="'+i+'" inputmode="numeric" value="'+esc(l.q)+'" aria-label="數量" style="text-align:right;font-weight:800">'+
        '<select class="inp" data-lu="'+i+'" aria-label="單位">'+['','桶','箱','瓶'].map(u=>'<option value="'+u+'"'+(l.u===u?' selected':'')+'>'+(u||'單位')+'</option>').join('')+'</select>'+
        '<span class="st"><span class="tag '+st[i].cls+'">'+esc(st[i].txt)+'</span></span>'+
        '<button type="button" class="x" data-lx="'+i+'" aria-label="刪除這一行">×</button></div>').join('')+'</div>'+
      '<div class="row"><button type="button" class="btn sm" data-ik="addline">＋ 加一行</button><label class="row small" style="gap:6px"><input type="checkbox" id="ik-urg"'+(dr.urgent?' checked':'')+'> 急件</label></div>'+
      '<div class="field"><label for="ik-note">備註</label><input id="ik-note" class="inp" value="'+esc(dr.note)+'"></div>'+
      '<div class="row" style="margin-top:4px"><button type="button" class="btn pri" style="flex:1 1 220px;min-height:56px;font-size:19px" data-ik="save"'+(S.busy?' disabled':'')+'>確認建單</button>'+
      (I.lineId?'<button type="button" class="btn" data-ik="notorder">不是訂單</button>':'')+
      (I.blocks.length>1&&I.idx<I.blocks.length-1?'<button type="button" class="btn" data-ik="skip">跳過，看下一張</button>':'')+
      '<button type="button" class="btn" data-ik="clear">清除</button></div></section>';
  }
  return '<div class="ik">'+inbox+mid+'<aside class="side">'+custPanel(dr&&dr.customer)+trackPanel()+'</aside></div>';
}
function custPanel(name){
  const d=S.d;if(!name)return '';
  const c=custOf(name);
  const usual=d.history.filter(h=>h[0]===name).slice(0,6).map(h=>({p:P(h[1]),n:h[2]})).filter(x=>x.p);
  const ts=allTasks().filter(t=>t.customer===name&&t.deliveryStatus!=='delivered').sort((a,b)=>a.shipDate.localeCompare(b.shipDate));
  return '<section class="sbox"><div class="lbl">客戶</div><b style="font-size:20px">'+esc(name)+'</b><div class="small">'+(c&&c.address?esc(c.address):c&&c.geo?'沒有地址，已有司機記下的位置':'還沒有地址')+'</div>'+
    (usual.length?'<div class="lbl" style="margin-top:6px">常叫的品項（點一下加進草稿）</div><div class="chips">'+usual.map(u=>'<button type="button" class="chipb" data-addp="'+u.p.id+'">'+esc(u.p.name)+' · '+u.n+' 次</button>').join('')+'</div>':'')+
    (ts.length?'<div class="lbl" style="margin-top:6px">進行中的單</div>'+ts.map(t=>{const s=status(t);return '<div class="trk"><div class="row" style="justify-content:space-between"><span>'+esc(t.productName)+' × '+qtyTxt(t.qty,t.unit)+'</span><span class="tag '+s.cls+'">'+esc(s.txt)+'</span></div><div class="row small muted" style="justify-content:space-between"><span>出貨 '+md(t.shipDate)+' · '+esc(t.shipMethod||'未指定')+'</span>'+(t.status==='open'?'<button type="button" class="lnk" data-void="'+t.id+'">取消這筆</button>':'')+'</div></div>'}).join(''):'')+
    '</section>';
}
function stepIdx(t){const s=status(t).k;return s==='delivered'?3:s==='trip'?2:(s==='ready'||s==='failed')?1:0}
function trackPanel(){
  const td=today();
  const ts=allTasks().filter(t=>t.createdAt&&new Date(t.createdAt).toISOString().slice(0,10)>=addDays(td,-1)).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
  const by={};ts.forEach(t=>{(by[t.customer]=by[t.customer]||[]).push(t)});
  const names=Object.keys(by).slice(0,14);
  const steps=['收單','備齊','出車','送達'];
  return '<section class="sbox"><div class="lbl">最近收的單 · 走到哪了</div>'+(names.length?names.map(n=>{const g=by[n],k=Math.min(...g.map(stepIdx));
    return '<div class="trk"><div class="row" style="justify-content:space-between"><b>'+esc(n)+'</b><span class="small muted">'+g.length+' 項 · 出貨 '+md(g[0].shipDate)+'</span></div><div class="row" style="gap:4px">'+steps.map((s,i)=>'<span class="tag '+(i<=k?'t-ink':'t-dim')+'">'+s+'</span>').join('')+'</div></div>'}).join(''):'<div class="small muted">今天還沒有新訂單。</div>')+'</section>';
}
const ik=$('#main');
ik.addEventListener('input',e=>{
  if(S.role!=='intake')return;const I=S.I,dr=I.draft,t=e.target;
  if(t.id==='ik-text'){I.text=t.value;return}
  if(!dr)return;
  if(t.id==='ik-cust'){dr.customer=t.value.trim();dr.custSure=true;dr.custNew=false;return}
  if(t.id==='ik-note'){dr.note=t.value;return}
  if(t.id==='ik-addr'){dr.address=t.value;return}
  if(t.dataset.lq!=null){dr.lines[+t.dataset.lq].q=t.value.replace(/[^\d]/g,'');return}
});
ik.addEventListener('change',e=>{
  const t=e.target;
  if(S.role==='intake'){const dr=S.I.draft;if(!dr)return;
    if(t.id==='ik-cust'){if(!dr.method)dr.method=lastMethod(dr.customer);render();return}
    if(t.id==='ik-date'){dr.date=t.value;dr.dateGuess=false;return}
    if(t.id==='ik-urg'){dr.urgent=t.checked;render();return}
    if(t.dataset.lp!=null){const l=dr.lines[+t.dataset.lp];l.p=t.value;l.unsure=false;if(!l.u)l.u=unitGuess(l.p,dr.customer);render();return}
    if(t.dataset.lu!=null){dr.lines[+t.dataset.lu].u=t.value;render();return}
    if(t.dataset.lq!=null){render();return}
  }
  if(S.role==='factory')fxChange(e);
  if(S.role==='dispatch')dpChange(e);
});
ik.addEventListener('click',e=>{
  if(S.role==='intake')ikClick(e);else if(S.role==='factory')fxClick(e);else if(S.role==='dispatch')dpClick(e);else if(S.role==='pulse')psClick(e);
});
function ikClick(e){
  const I=S.I,b=e.target.closest('button');if(!b)return;const dr=I.draft;
  if(b.dataset.lin){const m=S.d.lineInbox.find(x=>x.id===+b.dataset.lin);if(m&&loadText(m.text,m.id))render();return}
  const k=b.dataset.ik;
  if(k==='paste'){I.paste=!I.paste;render();if(I.paste)setTimeout(()=>{const x=$('#ik-text');if(x)x.focus()},0);return}
  if(k==='parse'){if(!I.text.trim())return toast('請先把 LINE 訊息貼進來');if(loadText(I.text,null)){I.paste=false;render();toast(I.blocks.length>1?'認出 '+I.blocks.length+' 張訂單，先帶入第 1 張':'已帶入，請確認後按「確認建單」')}return}
  if(k==='new'){I.blocks=[];I.idx=0;I.lineId=null;I.draft=blankDraft();render();return}
  if(k==='clear'){I.blocks=[];I.idx=0;I.lineId=null;I.draft=null;render();return}
  if(k==='skip'){I.idx++;I.draft=fromBlock(I.blocks[I.idx]);render();return}
  if(k==='addline'&&dr){dr.lines.push({p:'',q:'',u:'',raw:'',unsure:false,cands:[]});render();return}
  if(b.dataset.lx!=null&&dr){dr.lines.splice(+b.dataset.lx,1);if(!dr.lines.length)dr.lines.push({p:'',q:'',u:'',raw:'',unsure:false,cands:[]});render();return}
  if(b.dataset.meth&&dr){dr.method=b.dataset.meth;dr.methodGuess=false;render();return}
  if(b.dataset.addp){if(!dr){I.draft=blankDraft()}const d2=I.draft;const empty=d2.lines.find(l=>!l.p&&!l.q);const l={p:b.dataset.addp,q:'',u:unitGuess(b.dataset.addp,d2.customer),raw:'',unsure:false,cands:[]};if(empty)Object.assign(empty,l);else d2.lines.push(l);render();return}
  if(b.dataset.void){if(!confirm('確定取消這筆訂單？'))return;act(()=>api('POST','/api/tasks/'+b.dataset.void+'/void'),'已取消');return}
  if(k==='notorder'&&I.lineId){const id=I.lineId;act(()=>api('POST','/api/line/inbox/'+id,{status:'dismissed',operator:S.op}),'已略過這則訊息').then(()=>{I.blocks=[];I.lineId=null;I.draft=null;render()});return}
  if(k==='save'&&dr)saveDraft();
}
async function saveDraft(){
  const I=S.I,dr=I.draft;if(!needOp())return;
  if(!dr.customer)return toast('請填客戶');
  if(!dr.method)return toast('請選出貨方式');
  const ls=dr.lines.filter(l=>l.p||l.q);
  if(!ls.length)return toast('請至少一個品項');
  for(const l of ls){if(!l.p)return toast('有一行還沒選品項');if(!parseInt(l.q,10))return toast('有一行還沒填數量');if(!l.u)return toast('有一行還沒選單位')}
  const r=await act(()=>api('POST','/api/tasks/batch',{customer:dr.customer,shipDate:dr.date,shipMethod:dr.method,note:dr.note,urgent:dr.urgent,createdBy:S.op,address:dr.address,items:ls.map(l=>({productId:+l.p,qty:+l.q,unit:l.u}))}),r=>'已建單：'+dr.customer+' '+r.created+' 個品項');
  if(!r)return;
  // remember how this LINE message named things
  const Pp=[],C=[];ls.forEach(l=>{if(l.raw&&l.p&&!l.fromHist){const k=LP.key(l.raw);if(k)Pp.push({key:k,productId:+l.p,customer:dr.customer})}});
  if(dr.custRaw){const k=LP.key(dr.custRaw);if(k.length>=2&&k!==LP.key(dr.customer))C.push({key:k,name:dr.customer})}
  if(Pp.length||C.length)api('POST','/api/aliases',{products:Pp,customers:C}).catch(()=>{});
  if(I.lineId){I.taskIds=(I.taskIds||[]).concat(r.ids||[])}
  if(I.idx<I.blocks.length-1){I.idx++;I.draft=fromBlock(I.blocks[I.idx]);render();return}
  if(I.lineId){const id=I.lineId;await api('POST','/api/line/inbox/'+id,{status:'done',taskIds:I.taskIds||[],operator:S.op}).catch(()=>{});I.taskIds=[]}
  I.blocks=[];I.idx=0;I.lineId=null;I.draft=null;I.text='';await refresh(true);
}

/* =================== 生產台 =================== */
function fxRows(){return S.d.demand}
function fxKey(){const F=S.F,rows=fxRows();if(F.other)return 'o|'+F.other;if(!rows.some(r=>r.key===F.sel)){const r=rows.find(x=>x.make>0);F.sel=r?r.key:''}return F.sel}
function fxRow(key){if(key.startsWith('o|')){const p=P(key.slice(2));if(!p)return null;const u=p.packSize?'箱':(p.baseUnit||'');return {key,productId:p.id,name:p.name,unit:u,f:u==='箱'&&p.packSize?p.packSize:1,baseUnit:u==='箱'&&p.packSize?p.baseUnit:u,need:0,stock:0,make:0,makeL:0,tasks:[],other:true}}return fxRows().find(r=>r.key===key)||null}
function dueTag(iso){if(!iso)return '';const n=dayDiff(iso,today());return '<span class="due'+(n<0?' late':n===0?' today':'')+'">'+rel(iso)+'</span>'}
function fxLotMode(p){const c=S.d.cfg.cats[p.cat]||null;if(p.noLot)return 'none';if((p.components||[]).length)return 'box';if(c&&c.auto)return 'auto';return 'manual'}
function fxPrefill(p,key){
  const F=S.F;if(F.lot[key]!=null)return;
  const c=S.d.cfg.cats[p.cat]||{},last=(S.d.lastLots[p.id]||[])[0]||'';
  if(c.rule!=='material'&&(S.d.cfg.varieties[p.cat]||{})[p.variety]){
    if(!F.prev[p.id]){F.prev[p.id]='…';api('POST','/api/lot-preview',{cat:p.cat,variety:p.variety}).then(r=>{F.prev[p.id]=r.lot||'';if(F.lot[key]==null||F.lot[key]===''){F.lot[key]=r.lot||last;if(!typing())render()}}).catch(()=>{F.prev[p.id]=''})}
    else if(F.prev[p.id]!=='…')F.lot[key]=F.prev[p.id]||last;
    return}
  F.lot[key]=last;
}
function fxAlloc(row,qty,unit){
  const p=P(row.productId),L=ledger(p,unit),madeL=qty*L.f;let left=madeL;const out=[];
  row.tasks.filter(t=>t.short>0).forEach(t=>{const needL=t.short*t.f;if(left<=0){out.push({who:t.customer,when:t.shipDate,txt:'還缺 '+qtyTxt(t.short,t.unit),c:'c-bad'});return}
    const give=Math.min(needL,Math.floor(left/t.f)*t.f);left-=give;const g=give/t.f;
    out.push(give>=needL?{who:t.customer,when:t.shipDate,txt:qtyTxt(t.short,t.unit)+' ✓',c:'c-ok'}:{who:t.customer,when:t.shipDate,txt:g+' / '+qtyTxt(t.short,t.unit)+'（還缺 '+(t.short-g)+'）',c:'c-bad'})});
  const rest=unit==='箱'&&L.f>1?(left%L.f===0?(left/L.f)+' 箱':left+' '+L.ku):left+(L.ku?' '+L.ku:'');
  return {out,rest:left>0?rest:'',restL:left};
}
function factoryV(){
  const F=S.F,d=S.d,rows=fxRows(),key=fxKey(),need=rows.filter(r=>r.make>0),ok=rows.filter(r=>r.make<=0);
  const ops=(d.cfg.people||[]);
  const rowH=r=>{const who=r.tasks.filter(t=>t.short>0).map(t=>esc(t.customer)+' '+t.short).join('・')||r.tasks.map(t=>esc(t.customer)+' '+t.qty).join('・');
    return '<button type="button" class="fxrow'+(r.make<=0?' okrow':'')+'" data-fx="'+esc(r.key)+'"'+(key===r.key&&!F.other?' aria-current="true"':'')+'><span><span class="nm">'+esc(r.name)+'</span><span class="who">'+dueTag(r.earliest||(r.tasks[0]||{}).shipDate)+who+'</span></span><span class="v">'+num(r.need)+'</span><span class="v">'+num(r.stock)+'</span><span class="mk'+(r.make<=0?' zero':'')+'">'+(r.make>0?num(r.make)+'<small>'+esc(r.unit||'')+'</small>':'庫存足')+'</span></button>'};
  const left='<section class="fxl"><div class="fxh"><div><h1>今天要做什麼</h1><div class="fxsub">'+md(today())+' · 已扣掉庫存，只列還缺的量</div></div>'+
    '<div class="ops" role="group" aria-label="操作人">'+(ops.length?ops.map(n=>'<button type="button" data-fop="'+esc(n)+'" aria-pressed="'+(S.op===n)+'">'+esc(n)+'</button>').join(''):'<span class="fxsub">右上角填名字</span>')+'</div></div>'+
    (need.length?'<div class="fxhead"><span>品項 · 最早出貨 · 誰在等</span><span style="text-align:right">訂單合計</span><span style="text-align:right">現有庫存</span><span style="text-align:right">還要做</span></div>'+need.map(rowH).join(''):'<div class="fxbox" style="font-size:22px;text-align:center;padding:30px">目前所有訂單庫存都夠，沒有要做的 👍</div>')+
    (ok.length?'<details class="fxok"><summary>庫存已經夠的品項（'+ok.length+'）</summary>'+ok.map(rowH).join('')+'</details>':'')+
    '<div class="fxbox"><label class="k" for="fx-other">做其他品項（先備庫存）</label><select id="fx-other" class="fxsel"><option value="">— 選品項 —</option>'+d.products.filter(p=>p.active!==false).sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')).map(p=>'<option value="'+p.id+'"'+(String(F.other)===String(p.id)?' selected':'')+'>'+esc(p.name)+'</option>').join('')+'</select></div>'+
    makesH()+'</section>';
  const row=key?fxRow(key):null;
  return '<div class="fxw">'+left+'<section class="fxr" aria-label="這一批">'+(row?panelH(row):'<div class="fxsub" style="font-size:22px;padding:40px 0">左邊選一個品項開始。</div>')+'</section></div>';
}
function makesH(){
  const ms=S.d.makes.filter(m=>new Date(m.at).toISOString().slice(0,10)>=addDays(today(),-1));
  if(!ms.length)return '';
  return '<div class="fxbox mklist"><span class="k">最近入庫</span>'+ms.slice(0,6).map(m=>{const young=Date.now()-new Date(m.at).getTime()<30*60000;
    return '<div><span>'+hm(m.at)+' · '+esc(m.name)+' <b>'+esc(m.lot)+'</b> · '+num(m.qty)+' '+esc(m.unit)+' · '+esc(m.operator)+'</span>'+(young?'<button type="button" data-fundo="'+m.id+'">打錯了，撤銷</button>':'')+'</div>'}).join('')+'</div>';
}
function panelH(row){
  const F=S.F,p=P(row.productId);if(!p)return '';
  const key=row.key,mode=fxLotMode(p);
  if(mode==='manual')fxPrefill(p,key);
  const units=[];if(p.packSize||row.unit==='箱')units.push('箱');const base=p.baseUnit||(row.unit!=='箱'?row.unit:'');if(base&&!units.includes(base))units.push(base);if(!units.length)units.push(row.unit||'');
  const unit=F.unit[key]!=null?F.unit[key]:(row.unit||units[0]);
  const def=unit===row.unit?Math.max(1,row.make):Math.max(1,row.makeL||1);
  const qty=F.qty[key]!=null?F.qty[key]:def;
  const needPack=unit==='箱'&&!p.packSize;
  const exp=F.exp[key]||addMonths(today(),S.d.cfg.shelfMonths||24);
  let lotH='';
  if(mode==='none')lotH='<div class="fxbox"><span class="k">批號</span><div class="lotv">無批號</div></div>';
  else if(mode==='auto'){if(!F.prev[p.id]){F.prev[p.id]='…';api('POST','/api/lot-preview',{cat:p.cat,variety:p.variety}).then(r=>{F.prev[p.id]=r.lot||'（入庫時產生）';if(!typing())render()}).catch(()=>{F.prev[p.id]='（入庫時產生）'})}
    lotH='<div class="fxbox"><span class="k">批號（系統自動編號）</span><div class="lotv">'+esc(F.prev[p.id]==='…'?'…':F.prev[p.id])+'</div></div>'}
  else if(mode==='box'){const cs=p.components.map(id=>P(id)).filter(Boolean);F.comps[key]=F.comps[key]||{};
    lotH='<div class="fxbox"><span class="k">禮盒內容物批號</span>'+cs.map(c=>{const opts=[...new Set(S.d.stock.filter(s=>s.productId===c.id).map(s=>s.lot).concat(S.d.lastLots[c.id]||[]))];if(F.comps[key][c.id]==null)F.comps[key][c.id]=opts[0]||'';
      return '<label class="k" for="fc-'+c.id+'">'+esc(c.name)+'</label><input id="fc-'+c.id+'" class="fxinp" data-fcomp="'+c.id+'" list="fcl-'+c.id+'" value="'+esc(F.comps[key][c.id])+'" autocapitalize="characters"><datalist id="fcl-'+c.id+'">'+opts.map(o=>'<option value="'+esc(o)+'">').join('')+'</datalist>'}).join('')+'</div>'}
  else{const v=F.lot[key]||'';const last=(S.d.lastLots[p.id]||[]).filter(x=>x!==v).slice(0,3);const kp=F.kp===key||!v;
    lotH='<div class="fxbox"><span class="k">批號'+(F.prev[p.id]&&F.prev[p.id]!=='…'&&v===F.prev[p.id]?'（系統建議下一號，可改）':'（照原料或規則輸入）')+'</span><div class="row" style="justify-content:space-between"><div class="lotv'+(v?'':' ph')+'" aria-live="polite">'+(v?esc(v):'請輸入批號')+'</div>'+(kp?'':'<div class="ops"><button type="button" data-fkp="1">修改批號</button></div>')+'</div>'+
      (kp&&last.length?'<div class="ops">'+last.map(x=>'<button type="button" data-flot="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div>':'')+
      (kp?'<div class="kp" role="group" aria-label="批號鍵盤">'+'1234567890'.split('').map(c=>'<button type="button" data-k="'+c+'">'+c+'</button>').join('')+
      'HSPJOVRABCDEFGIKLMNQTUWXYZ'.split('').map(c=>'<button type="button" class="acc" data-k="'+c+'">'+c+'</button>').join('')+
      '<button type="button" data-k="-">-</button><button type="button" class="w2" data-k="BS">⌫ 退格</button><button type="button" class="w2" data-k="CLR">清除</button><button type="button" class="w2 acc" data-k="OK">好了</button></div>':'')+'</div>'}
  const al=fxAlloc(row,qty,unit);
  return '<div><div class="fxsub">這一批</div><h2 style="font-size:34px;font-weight:900">'+esc(row.name)+'</h2></div>'+lotH+
    '<div class="fxbox"><label class="k" for="fx-exp">有效日期（預設生產日 + '+(S.d.cfg.shelfMonths||24)+' 個月，可改）</label><input id="fx-exp" type="date" class="fxinp" value="'+esc(exp)+'"></div>'+
    '<div class="fxbox"><span class="k">實際做出多少</span>'+(units.length>1?'<div class="ops">'+units.map(u=>'<button type="button" data-funit="'+u+'" aria-pressed="'+(u===unit)+'">'+u+'</button>').join('')+'</div>':'')+
    '<div class="stp"><button type="button" data-fq="-1" aria-label="減少">−</button><input id="fx-qty" inputmode="numeric" value="'+qty+'" aria-label="數量"><button type="button" data-fq="1" aria-label="增加">+</button></div><div class="fxsub" style="text-align:center">'+esc(unit)+'</div>'+
    (needPack?'<div class="row"><span class="k">一箱幾</span><select id="fx-pb" class="fxsel" style="width:auto">'+['桶','瓶'].map(b=>'<option'+(((F.pack[key]||{}).base||'瓶')===b?' selected':'')+'>'+b+'</option>').join('')+'</select><input id="fx-ps" class="fxinp" style="width:120px" inputmode="numeric" placeholder="入數" value="'+esc((F.pack[key]||{}).size||'')+'"><span class="fxsub">（只要填一次）</span></div>':'')+'</div>'+
    '<div class="fxbox"><span class="k">入庫後系統自動配給</span><div class="alc">'+(al.out.length?al.out.map(a=>'<div><span><b>'+esc(a.who)+'</b> <span class="fxsub">'+rel(a.when)+'</span></span><b class="'+a.c+'">'+esc(a.txt)+'</b></div>').join(''):'')+
    (al.rest?'<div><span><b>留在庫存</b> <span class="fxsub">下次訂單自動用</span></span><b class="c-hon">'+esc(al.rest)+'</b></div>':'')+(!al.out.length&&!al.rest?'<div>—</div>':'')+'</div></div>'+
    '<button type="button" class="go" data-fgo="1"'+(F.busy?' disabled':'')+'>完成・入庫 '+num(qty)+' '+esc(unit)+'</button>';
}
function addMonths(iso,m){const [y,mo,d]=iso.split('-').map(Number);const f=new Date(Date.UTC(y,mo-1+m,1));const last=new Date(Date.UTC(f.getUTCFullYear(),f.getUTCMonth()+1,0)).getUTCDate();f.setUTCDate(Math.min(d,last));return f.toISOString().slice(0,10)}
function fxChange(e){const F=S.F,t=e.target,key=fxKey();
  if(t.id==='fx-other'){F.other=t.value;render();return}
  if(t.id==='fx-exp'){F.exp[key]=t.value;return}
  if(t.id==='fx-qty'){F.qty[key]=Math.max(1,parseInt(t.value.replace(/\D/g,''),10)||1);render();return}
  if(t.id==='fx-pb'||t.id==='fx-ps'){F.pack[key]={base:($('#fx-pb')||{}).value||'瓶',size:($('#fx-ps')||{}).value||''};return}
  if(t.dataset.fcomp){(F.comps[key]=F.comps[key]||{})[t.dataset.fcomp]=t.value.toUpperCase().replace(/\s/g,'');return}
}
function fxClick(e){
  const F=S.F,b=e.target.closest('button');if(!b)return;const key=fxKey();
  if(b.dataset.fx){F.sel=b.dataset.fx;F.other='';render();if(innerWidth<1180){const r=$('.fxr');if(r)r.scrollIntoView({behavior:'smooth'})}return}
  if(b.dataset.fop){S.op=b.dataset.fop;store.set('tsb_op',S.op);render();return}
  if(b.dataset.funit){F.unit[key]=b.dataset.funit;F.qty[key]=undefined;delete F.qty[key];render();return}
  if(b.dataset.fq){const row=fxRow(key);if(!row)return;const cur=F.qty[key]!=null?F.qty[key]:Math.max(1,row.make);F.qty[key]=Math.max(1,cur+(+b.dataset.fq));render();return}
  if(b.dataset.flot){F.lot[key]=b.dataset.flot;F.kp='';render();return}
  if(b.dataset.fkp){F.kp=key;render();return}
  if(b.dataset.k){const k=b.dataset.k;if(k==='OK'){F.kp='';render();return}F.kp=key;let v=F.lot[key]||'';if(k==='BS')v=v.slice(0,-1);else if(k==='CLR')v='';else if(v.length<20)v+=k;F.lot[key]=v;render();return}
  if(b.dataset.fundo){if(!confirm('撤銷這筆入庫？'))return;act(()=>api('POST','/api/v2/produce/'+b.dataset.fundo+'/undo'),'已撤銷');return}
  if(b.dataset.fgo)produce(key);
}
async function produce(key){
  const F=S.F,row=fxRow(key);if(!row||F.busy)return;if(!needOp())return;
  const p=P(row.productId),mode=fxLotMode(p),unit=F.unit[key]!=null?F.unit[key]:row.unit;
  const qty=F.qty[key]!=null?F.qty[key]:Math.max(1,unit===row.unit?row.make:row.makeL);
  const body={productId:p.id,unit,qty,operator:S.op,expiry:F.exp[key]||''};
  if(mode==='manual'){const v=(F.lot[key]||'').toUpperCase();if(!/^[A-Z0-9]{2,20}(-[A-Z0-9]{1,4})?$/.test(v))return toast('批號格式不對，例如 HP111-A 或 HS0913B-F');body.lot=v}
  if(mode==='box'){body.comps=Object.entries(F.comps[key]||{}).map(([id,lot])=>({productId:+id,lot}))}
  if(unit==='箱'&&!p.packSize){const pk=F.pack[key]||{};if(!(+pk.size>=2))return toast('請先填一箱幾桶（瓶）');body.pack={size:+pk.size,base:pk.base||'瓶'}}
  F.busy=true;render();
  const al=fxAlloc(row,qty,unit);
  try{const r=await api('POST','/api/v2/produce',body);
    const got=al.out.filter(a=>a.c==='c-ok').map(a=>a.who);
    toast('已入庫 '+r.lot+' · '+qty+' '+unit+(got.length?'，可出給：'+got.join('、'):'')+(al.rest?'；留庫存 '+al.rest:''),8000);
    delete F.qty[key];delete F.lot[key];delete F.unit[key];delete F.prev[p.id];F.other='';F.kp='';
    await refresh(true);
  }catch(e){toast(e.message)}finally{F.busy=false;render()}
}

/* =================== 出貨台 =================== */
function dpTasks(date,meth){
  const td=today(),d=S.d;
  const isT=date===td;
  return allTasks().filter(t=>{
    if(meth&&t.shipMethod!==meth)return false;
    if((t.note||'').includes('已轉庫存'))return false;
    if(t.status==='open')return isT?t.shipDate<=td:t.shipDate===date;
    if(t.deliveryStatus==='legacy')return false;
    if(!t.deliveryStatus)return isT?t.shipDate<=td:t.shipDate===date;
    return t.shipDate===date||(isT&&t.deliveryAt&&new Date(t.deliveryAt).toISOString().slice(0,10)===td&&t.shipDate<td);
  });
}
function dpDates(){
  const td=today(),set={};
  allTasks().forEach(t=>{if(t.status==='open'||!t.deliveryStatus){const k=t.shipDate<td?td:t.shipDate;set[k]=(set[k]||0)+1}});
  const ds=Object.keys(set).filter(x=>x>td).sort().slice(0,5);
  return {list:[td].concat(ds.includes(addDays(td,1))?[]:[addDays(td,1)]).concat(ds).filter((x,i,a)=>a.indexOf(x)===i).sort(),n:set};
}
function dpLine(t){
  const D=S.D,s=status(t),c=S.d.cover[t.id]||{};
  if(t.status==='open'&&c.state==='stock'){const on=!D.off[t.id];return '<div class="dl"><button type="button" class="ck" role="checkbox" aria-checked="'+on+'" aria-label="選取 '+esc(t.productName)+'" data-dck="'+t.id+'">'+(on?'<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F3EDE2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>':'')+'</button><span class="it"><b>'+esc(t.productName)+' × '+qtyTxt(t.qty,t.unit)+'</b><span class="small">批號 '+esc(c.lots.map(l=>l.lot+(l.expiry?'（'+l.expiry.replace(/-/g,'/')+'）':'')+(c.lots.length>1?' × '+l.qty:'')).join('、'))+'</span></span></div>'}
  if(t.status==='open')return '<div class="dl"><span class="ck no" aria-hidden="true"></span><span class="it"><b>'+esc(t.productName)+' × '+qtyTxt(t.qty,t.unit)+'</b><span class="small" style="color:var(--amber);font-weight:700">等生產：還缺 '+qtyTxt(c.short||t.qty,t.unit)+'</span></span></div>';
  const ph=(S.d.photos||[]).includes(t.id);
  return '<div class="dl"><span class="ck done" aria-hidden="true"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1B3D31" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12l5 5 9-10"/></svg></span><span class="it"><b>'+esc(t.productName)+' × '+qtyTxt(t.qty,t.unit)+'</b><span class="small">'+esc(shipLotsTxt(t))+'</span><span class="row" style="gap:6px"><span class="tag '+s.cls+'">'+esc(s.txt)+(t.deliveredBy&&s.k==='delivered'?' · '+esc(t.deliveredBy):'')+'</span>'+
    (ph?'<button type="button" class="lnk" data-photo="'+t.id+'">看簽收照片</button>':'')+(s.k==='ready'&&t.fromStock&&!t.tripDriver?'<button type="button" class="lnk" data-unship="'+t.id+'">退回庫存</button>':'')+'</span></span></div>';
}
function dispatchV(){
  const D=S.D,td=today();if(!D.date||D.date<td)D.date=td;
  const ds=dpDates(),ts=dpTasks(D.date,D.meth);
  const by={};ts.forEach(t=>{(by[t.customer]=by[t.customer]||[]).push(t)});
  const cards=Object.keys(by).map(n=>{const g=by[n].sort((a,b)=>a.id-b.id);
    const can=g.filter(t=>t.status==='open'&&(S.d.cover[t.id]||{}).state==='stock'&&!D.off[t.id]);
    const wait=g.some(t=>t.status==='open'&&(S.d.cover[t.id]||{}).state!=='stock');
    const openN=g.filter(t=>t.status==='open').length;
    const prepared=g.filter(t=>t.status==='done'&&!t.deliveryStatus);
    const allDone=g.every(t=>t.deliveryStatus==='delivered');
    const late=g.some(t=>t.shipDate<td&&(t.status==='open'||!t.deliveryStatus));
    const meth=[...new Set(g.map(t=>t.shipMethod||'未指定'))].join('、');
    const badge=allDone?'<span class="tag t-ink">已完成</span>':wait?'<span class="tag t-amb">等生產</span>':openN?'<span class="tag t-dim">待備貨</span>':'<span class="tag t-ok">已備齊</span>';
    const ho=prepared.filter(t=>t.shipMethod!=='公司配送');
    const trip=prepared.filter(t=>t.shipMethod==='公司配送');
    const rank=allDone?4:can.length?0:wait?1:prepared.length?2:3;
    return {rank,h:'<article class="dc'+(!openN&&prepared.length?' ready':'')+'"><div class="hd"><div><b class="ttl" style="font-size:22px">'+esc(n)+'</b> <span class="small muted">'+esc(meth)+'</span>'+(late?' <span class="tag t-red">逾期</span>':'')+'</div>'+badge+'</div>'+g.map(dpLine).join('')+
      '<div class="ft">'+(can.length?'<button type="button" class="btn pri" data-ship="'+can.map(t=>t.id).join(',')+'"'+(S.busy?' disabled':'')+'>確認備貨（'+can.length+' 項）</button>':'')+
      (ho.length?'<button type="button" class="btn" data-hand="'+ho.map(t=>t.id).join(',')+'">'+(ho[0].shipMethod==='物流配送'?'已交物流':'客戶已取貨')+'</button>':'')+
      (trip.length?'<span class="small muted">'+(trip.some(t=>t.tripDriver)?esc([...new Set(trip.map(t=>t.tripDriver).filter(Boolean))].join('、'))+' 已帶出':'等司機帶走')+'</span>':'')+'</div></article>'}}).sort((a,b)=>a.rank-b.rank);
  const allCan=ts.filter(t=>t.status==='open'&&(S.d.cover[t.id]||{}).state==='stock'&&!D.off[t.id]);
  const drv={};allTasks().forEach(t=>{if(t.shipMethod==='公司配送'&&t.tripDriver&&!t.deliveryStatus){(drv[t.tripDriver]=drv[t.tripDriver]||new Set()).add(t.customer)}});
  const dlv={};allTasks().forEach(t=>{if(t.deliveryStatus==='delivered'&&t.deliveryAt&&new Date(t.deliveryAt).toISOString().slice(0,10)===td&&t.shipMethod==='公司配送'){(dlv[t.deliveredBy]=dlv[t.deliveredBy]||new Set()).add(t.customer)}});
  const exp=S.d.stock.filter(s=>s.expiry&&dayDiff(s.expiry,td)<=180).sort((a,b)=>a.expiry.localeCompare(b.expiry)).slice(0,8);
  return '<div class="row" style="justify-content:space-between;gap:12px"><div><h1 class="ttl" style="font-size:28px">出貨台</h1><div class="muted small">批號已依「先到期先出」配好；勾選後按「確認備貨」才會從庫存扣掉</div></div>'+
    '<div class="seg">'+[['','全部'],['公司配送','公司配送'],['門市自取','自取'],['物流配送','物流']].map(m=>'<button type="button" data-dmeth="'+m[0]+'" aria-pressed="'+(D.meth===m[0])+'">'+m[1]+'</button>').join('')+'</div></div>'+
    '<div class="dates" style="margin-top:12px">'+ds.list.map(x=>'<button type="button" data-ddate="'+x+'" aria-pressed="'+(x===D.date)+'">'+(x===td?'今天':rel(x))+' '+md(x).replace(/（.）/,'')+(ds.n[x]?'<span class="n">'+ds.n[x]+'</span>':'')+'</button>').join('')+'<input type="date" id="dp-date" class="inp" style="width:auto" value="'+esc(D.date)+'" aria-label="選日期"></div>'+
    '<div class="dp" style="margin-top:4px"><div>'+(cards.length?'<div class="cards">'+cards.map(c=>c.h).join('')+'</div>':'<div class="empty">'+md(D.date)+' 沒有'+(D.meth||'')+'出貨的單。</div>')+'</div>'+
    '<aside class="side" style="margin-top:14px">'+
    '<section class="sbox"><div class="lbl">這一天</div>'+(allCan.length?'<button type="button" class="btn pri" data-ship="'+allCan.map(t=>t.id).join(',')+'">全部可出的都備貨（'+allCan.length+' 項）</button>':'')+'<button type="button" class="btn" data-dprint="1">列印出貨單（每客戶一張）</button></section>'+
    '<section class="sbox"><div class="lbl">出車狀況 · 今天</div>'+(S.d.cfg.drivers||[]).map(n=>'<div class="trk"><b>'+esc(n)+'</b><span class="small">'+(drv[n]?'車上：'+esc([...drv[n]].join('、')):'目前沒有帶貨')+'</span><span class="small muted">今天已送 '+(dlv[n]?dlv[n].size:0)+' 站</span></div>').join('')+'</section>'+
    (exp.length?'<section class="sbox" style="background:var(--amber-bg);border-color:#E0BE85"><div class="lbl" style="color:var(--amber-ink)">半年內到期的庫存（會優先出）</div>'+exp.map(s=>{const p=P(s.productId);return '<div class="small" style="color:#4A2C05">'+esc(p?p.name:'')+' · <b>'+esc(s.lot)+'</b> · '+s.expiry.replace(/-/g,'/')+' · 剩 '+num(s.qty)+' '+esc(s.unit)+'</div>'}).join('')+'</section>':'')+
    '</aside></div>';
}
function dpChange(e){if(e.target.id==='dp-date'&&e.target.value){S.D.date=e.target.value;render()}}
function dpClick(e){
  const D=S.D,b=e.target.closest('button');if(!b)return;
  if(b.dataset.ddate){D.date=b.dataset.ddate;render();return}
  if(b.dataset.dmeth!=null){D.meth=b.dataset.dmeth;render();return}
  if(b.dataset.dck){const id=+b.dataset.dck;D.off[id]=!D.off[id];render();return}
  if(b.dataset.ship){if(!needOp())return;const ids=b.dataset.ship.split(',').map(Number);act(()=>api('POST','/api/v2/ship',{taskIds:ids,operator:S.op}),'已備貨 '+ids.length+' 項，庫存已扣');return}
  if(b.dataset.hand){if(!needOp())return;const ids=b.dataset.hand.split(',').map(Number);act(()=>api('POST','/api/deliveries/handoff',{taskIds:ids,operator:S.op}),'已記錄交貨');return}
  if(b.dataset.unship){if(!confirm('把這筆貨退回庫存？（訂單會回到「待備貨」）'))return;act(()=>api('POST','/api/v2/unship/'+b.dataset.unship,{operator:S.op}),'已退回庫存');return}
  if(b.dataset.photo){showPhoto(+b.dataset.photo);return}
  if(b.dataset.dprint){printNotes(D.date,D.meth);return}
}
async function showPhoto(id){
  try{const r=await fetch('/api/v2/photo/'+id,{headers:{'X-PIN':S.pin}});if(!r.ok)throw new Error('找不到照片');const u=URL.createObjectURL(await r.blob());
    $('#modal').innerHTML='<div class="modal" data-close="1"><div class="box"><b>簽收照片</b><img src="'+u+'" alt="送達簽收照片"><button type="button" class="btn" data-close="1">關閉</button></div></div>'}catch(e){toast(e.message)}
}
document.addEventListener('click',e=>{const c=e.target.closest('[data-close]');if(c&&(e.target===c||c.tagName==='BUTTON'))$('#modal').innerHTML=''});
function printNotes(date,meth){
  const ts=dpTasks(date,meth).filter(t=>t.deliveryStatus!=='failed');
  if(!ts.length){toast('這一天沒有'+(meth||'')+'出貨的訂單');return}
  const by={};ts.forEach(t=>{(by[t.customer]=by[t.customer]||[]).push(t)});
  const d8=date.replace(/-/g,''),fmtD=x=>x?x.replace(/-/g,'/'):'';
  const pages=Object.keys(by).sort((x,y)=>x.localeCompare(y,'zh-Hant')).map((cu,k)=>{
    const c=custOf(cu)||{},rows=by[cu];
    const tr=rows.map((t,i)=>{
      const cv=S.d.cover[t.id]||{},lots=(t.shipLots&&t.shipLots.length)?t.shipLots:(t.status==='open'&&cv.state==='stock'?cv.lots:null);
      const lotTxt=lots?lots.map(l=>esc(l.lot)+(lots.length>1?' × '+num(l.qty):'')).join('<br>'):esc(t.lot||'');
      const expTxt=lots?lots.map(l=>esc(fmtD(l.expiry||''))).join('<br>'):'';
      return '<tr><td class="c">'+(i+1)+'</td><td>'+esc(t.productName)+(t.note?'<div class="nt">備註：'+esc(t.note)+'</div>':'')+'</td><td class="r">'+num(t.qty)+'</td><td class="c">'+esc(t.unit||'')+'</td><td class="m">'+lotTxt+'</td><td class="m">'+expTxt+'</td><td class="c">'+(t.status==='done'?'':cv.state==='stock'?'<b class="w">未備貨</b>':'<b class="w">未完工</b>')+'</td></tr>'}).join('');
    return '<section class="pg"><div class="hd"><div><div class="co">統香蜂蜜有限公司</div><div class="sub">TS Beehoney Co., Ltd.　｜　尋蜜趣</div></div><div class="tt">出 貨 單</div></div>'+
      '<table class="meta"><tr><td><span>客戶</span>'+esc(cu)+'</td><td><span>出貨日</span>'+fmtD(date)+'</td></tr><tr><td><span>地址</span>'+esc(c.address||'')+'</td><td><span>單號</span>'+d8+'-'+String(k+1).padStart(2,'0')+'</td></tr><tr><td><span>出貨方式</span>'+esc(rows[0].shipMethod||'')+'</td><td><span>開單人</span>'+esc(rows[0].createdBy||'')+'</td></tr></table>'+
      '<table class="it"><thead><tr><th style="width:6%">#</th><th>品名</th><th style="width:9%;text-align:right">數量</th><th style="width:7%">單位</th><th style="width:20%">批號</th><th style="width:14%">有效日期</th><th style="width:9%"></th></tr></thead><tbody>'+tr+'</tbody></table>'+
      '<div class="sg"><div>出貨人：</div><div>送貨人：</div><div>客戶簽收：</div></div><div class="ft">www.tsbeehoney.com.tw</div></section>'}).join('');
  const css='@page{size:A4;margin:14mm}*{box-sizing:border-box}body{font-family:"Microsoft JhengHei","微軟正黑體","PingFang TC","Noto Sans TC",sans-serif;color:#1F2A24;margin:0}.pg{page-break-after:always;min-height:260mm;position:relative}.pg:last-child{page-break-after:auto}.hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #1B3D31;padding-bottom:8px}.co{font-size:24px;font-weight:700;color:#1B3D31}.sub{font-size:12px;color:#C99A2E;margin-top:2px}.tt{font-size:26px;font-weight:700;color:#1B3D31;letter-spacing:.2em}.meta{width:100%;margin:12px 0;border-collapse:collapse;font-size:14px}.meta td{padding:5px 4px;width:50%}.meta span{display:inline-block;min-width:68px;color:#6b6b6b}.it{width:100%;border-collapse:collapse;font-size:14px}.it th{background:#1B3D31;color:#fff;padding:7px 6px;font-weight:600;text-align:left}.it td{border-bottom:1px solid #d8d2c4;padding:8px 6px;vertical-align:top}.c{text-align:center}.r{text-align:right}.m{font-family:Consolas,monospace}.nt{font-size:12px;color:#6b6b6b;margin-top:2px}.w{color:#b3261e}.sg{display:flex;gap:24px;margin-top:40px;font-size:14px}.sg div{flex:1;border-bottom:1px solid #1F2A24;padding-bottom:28px}.ft{position:absolute;bottom:0;right:0;font-size:11px;color:#C99A2E}';
  const w=window.open('','_blank');if(!w){toast('瀏覽器擋住了新視窗，請允許彈出視窗後再按一次');return}
  w.document.write('<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>出貨單 '+fmtD(date)+'</title><style>'+css+'</style></head><body>'+pages+'</body></html>');
  w.document.close();w.focus();setTimeout(()=>{try{w.print()}catch(_){}},500);
}

/* =================== 總覽 =================== */
function pulseV(){
  const d=S.d,td=today(),ts=allTasks();
  const todayCust=new Set(ts.filter(t=>t.shipDate<=td&&(t.status==='open'||!t.deliveryStatus)).map(t=>t.customer));
  const delivered=new Set(ts.filter(t=>t.deliveryStatus==='delivered'&&t.deliveryAt&&new Date(t.deliveryAt).toISOString().slice(0,10)===td).map(t=>t.customer));
  const al=[];
  const late={};d.open.filter(t=>t.shipDate<td).forEach(t=>{(late[t.customer]=late[t.customer]||[]).push(t)});
  Object.keys(late).forEach(n=>{const g=late[n],days=Math.max(...g.map(t=>-dayDiff(t.shipDate,td)));al.push({c:'d-red',t:n+' 逾期 '+days+' 天',s:g.map(t=>t.productName+' × '+qtyTxt(t.qty,t.unit)+'（'+status(t).txt+'）').join('、'),r:0})});
  d.demand.filter(r=>r.make>0&&r.earliest&&r.earliest<=addDays(td,1)&&r.earliest>=td).forEach(r=>al.push({c:'d-amb',t:r.name+' 還缺 '+r.make+' '+r.unit,s:rel(r.earliest)+'要出：'+r.tasks.filter(t=>t.short>0).map(t=>t.customer+' '+t.short).join('、'),r:1}));
  ts.filter(t=>t.deliveryStatus==='failed').forEach(t=>al.push({c:'d-red',t:t.customer+' 配送異常',s:(t.deliveryIssue||'')+' · '+t.productName,r:0}));
  const stale={};ts.filter(t=>t.status==='done'&&!t.deliveryStatus&&t.shipDate<td).forEach(t=>{stale[t.customer]=1});
  Object.keys(stale).forEach(n=>al.push({c:'d-amb',t:n+' 已備貨但還沒送出／取貨',s:'出貨日已過，確認一下是不是忘了按「已送達／已取貨」',r:2}));
  d.stock.filter(s=>s.expiry&&dayDiff(s.expiry,td)<=180).sort((a,b)=>a.expiry.localeCompare(b.expiry)).slice(0,5).forEach(s=>{const p=P(s.productId);al.push({c:'d-amb',t:(p?p.name:'')+' '+s.lot+' 快到期',s:s.expiry.replace(/-/g,'/')+' 到期，剩 '+num(s.qty)+' '+s.unit+'，出貨台會優先出',r:3})});
  const noAddr=[...new Set(ts.filter(t=>t.shipMethod==='公司配送'&&t.deliveryStatus!=='delivered').map(t=>t.customer))].filter(n=>{const c=custOf(n);return !(c&&(c.address||c.geo))});
  if(noAddr.length)al.push({c:'d-amb',t:noAddr.length+' 位配送客戶沒有地址',s:noAddr.slice(0,6).join('、')+(noAddr.length>6?'…':'')+'。司機送達時會自動記下位置',r:4});
  al.sort((a,b)=>a.r-b.r);
  const tile=(l,b,s,href)=>'<a class="tile" href="#'+href+'"><span class="lbl">'+l+'</span><span><span class="big">'+b+'</span> <span class="muted small">'+s+'</span></span></a>';
  const dl=ts.filter(t=>t.deliveryStatus==='delivered'&&t.deliveryAt&&new Date(t.deliveryAt).toISOString().slice(0,10)===td).sort((a,b)=>String(b.deliveryAt).localeCompare(String(a.deliveryAt)));
  const seen=new Set();
  return '<div class="ps"><div><div class="muted small">'+md(td)+' '+hm(new Date())+'</div><h1 class="ttl" style="font-size:32px">今天的工廠</h1></div>'+
    '<div class="tiles">'+tile('LINE 待確認',d.lineInbox.length,'則','intake')+tile('工廠還要做',d.demand.filter(r=>r.make>0).length,'個品項','factory')+tile('今天要出貨',todayCust.size,'位客戶','dispatch')+tile('今天已送達',delivered.size,'位客戶','dispatch')+'</div>'+
    '<section style="display:flex;flex-direction:column;gap:8px"><div class="lbl">需要有人處理</div>'+(al.length?al.map(a=>'<div class="al"><span class="dot '+a.c+'"></span><div><b>'+esc(a.t)+'</b><div class="small" style="color:var(--ink2)">'+esc(a.s)+'</div></div></div>').join(''):'<div class="al"><span class="dot d-ok"></span><div><b>一切順利</b><div class="small">沒有逾期、缺貨或異常。</div></div></div>')+'</section>'+
    (dl.length?'<section style="display:flex;flex-direction:column;gap:8px"><div class="lbl">今天送達</div>'+dl.filter(t=>{if(seen.has(t.customer))return false;seen.add(t.customer);return true}).map(t=>'<div class="al"><span class="dot d-ok"></span><div><b>'+hm(t.deliveryAt)+' '+esc(t.customer)+'</b><div class="small">'+esc(t.deliveredBy||'')+((d.photos||[]).includes(t.id)?' · <button type="button" class="lnk" data-photo="'+t.id+'">看簽收照片</button>':'')+'</div></div></div>').join('')+'</section>':'')+
    '</div>';
}
function psClick(e){const b=e.target.closest('button');if(b&&b.dataset.photo)showPhoto(+b.dataset.photo)}

/* ---------- boot ---------- */
{const h=location.hash.slice(1),s=store.get('tsb_v2role');S.role=ROLES.some(r=>r[0]===h)?h:ROLES.some(r=>r[0]===s)?s:'';if(S.role&&location.hash!=='#'+S.role)history.replaceState(null,'','#'+S.role)}
drawTop();
fetch('/api/auth-required').then(r=>r.json()).then(a=>{if(a.required&&!S.pin)showPin();else start()}).catch(()=>start());
})();
