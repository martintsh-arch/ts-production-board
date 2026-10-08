(function(){
'use strict';
const S={open:[],done:[],products:[],customers:[],history:[],pq:'',pOnlyMissing:false,cfg:null,rev:0,tab:'board',q:'',editOrder:null,pin:''};
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
const store={get(k){try{return localStorage.getItem(k)||''}catch(e){return''}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}}};
function toast(m){const t=$('#toast');t.textContent=m;t.hidden=false;clearTimeout(t._h);t._h=setTimeout(()=>t.hidden=true,2800)}
function setStatus(m){$('#status').textContent=m}
function tick(){const d=new Date();$('#clock').textContent=(d.getMonth()+1)+'/'+d.getDate()+' '+pad(d.getHours())+':'+pad(d.getMinutes())}
tick();setInterval(tick,15000);

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
    S.rev=s.rev;S.open=s.open;S.done=s.done;S.products=s.products;S.customers=s.customers||[];S.history=s.history||[];S.cfg=s.config;
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
  ['board','orders','records','settings'].forEach(k=>$('#v-'+k).hidden=k!==S.tab);render(true);store.set('tsb_tab',S.tab)});
{const t=store.get('tsb_tab');if(t){const b=document.querySelector('#tabs button[data-tab="'+t+'"]');if(b)b.click()}}

/* ---------- helpers ---------- */
function shipPill(t){const td=today();
  if(t.shipDate<td)return '<span class="pill p-over">逾期 '+esc(t.shipDate.slice(5).replace('-','/'))+'</span>';
  if(t.shipDate===td)return '<span class="pill p-today">今日出貨</span>';
  if(t.shipDate===addDays(td,1))return '<span class="pill p-tom">明日出貨</span>';
  return '<span class="pill p-later">'+esc(t.shipDate.slice(5).replace('-','/'))+' 出貨</span>'}
function boardTasks(){const lim=addDays(today(),2);return S.open.filter(t=>t.shipDate<=lim).sort((a,b)=>(a.order||0)-(b.order||0))}
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
function renderBoard(){
  if(dragging)return;
  const v=$('#v-board'),list=boardTasks(),td=today();
  const over=list.filter(t=>t.shipDate<td).length,todayN=list.filter(t=>t.shipDate===td).length;
  const doneToday=S.done.filter(t=>t.completedAt&&ymd(new Date(t.completedAt))===td);
  let h='<div class="stats"><div class="stat"><b class="mono">'+list.length+'</b><span>待生產</span></div>'+
    '<div class="stat"><b class="mono">'+todayN+'</b><span>今日出貨</span></div>'+
    (over?'<div class="stat red"><b class="mono">'+over+'</b><span>逾期未完成</span></div>':'')+
    '<div class="stat"><b class="mono">'+doneToday.length+'</b><span>今日已完成</span></div></div>';
  if(!list.length)h+='<div class="empty"><b>目前沒有待生產項目</b>三天內（含今日）要出貨的訂單會自動出現在這裡。到「訂單輸入」新增第一筆。</div>';
  else h+='<div class="list" id="blist">'+list.map((t,i)=>{
    const code=t.cat?'<span class="pill p-code">'+esc(t.cat)+esc(t.variety||'')+' '+esc(catName(t.cat))+'</span>':'<span class="pill p-tom">未設類別</span>';
    return '<div class="card'+(t.shipDate<td?' over':'')+'" data-id="'+t.id+'">'+
      '<span class="grip" aria-label="拖曳排序" title="拖曳排序">⠿</span><span class="seq mono">'+(i+1)+'</span>'+
      '<div style="min-width:0"><div class="pname">'+esc(t.productName)+' <span class="mono">× '+num(t.qty)+'</span></div>'+
      '<div class="meta"><span>'+esc(t.customer)+'</span>'+shipPill(t)+code+(t.parentId?'<span class="pill p-later">續做</span>':'')+(t.note?'<span>備註：'+esc(t.note)+'</span>':'')+'</div></div>'+
      '<button class="done-btn" data-act="finish" data-id="'+t.id+'">完成生產</button></div>'}).join('')+'</div>';
  if(doneToday.length)h+='<h2>今日已完成</h2><div class="tbl-wrap"><table><thead><tr><th>時間</th><th>批號</th><th>品項</th><th>數量</th><th>客戶</th><th>操作人</th></tr></thead><tbody>'+
    doneToday.map(t=>'<tr><td class="mono">'+fmtTime(t.completedAt).split(' ')[1]+'</td><td class="mono" style="font-weight:600">'+esc(t.lot)+'</td><td>'+esc(t.productName)+'</td><td class="mono">'+num(t.qty)+'</td><td>'+esc(t.customer)+'</td><td>'+esc(t.operator)+'</td></tr>').join('')+'</tbody></table></div>';
  v.innerHTML=h;
  const el=$('#blist');
  if(el&&window.Sortable)Sortable.create(el,{handle:'.grip',animation:150,ghostClass:'ghost-sort',
    onStart:()=>{dragging=true},
    onEnd:async()=>{dragging=false;const ids=[...el.querySelectorAll('.card')].map(c=>+c.dataset.id);
      ids.forEach((id,i)=>{const t=S.open.find(x=>x.id===id);if(t)t.order=(i+1)*10});renderBoard();
      await act(()=>api('POST','/api/tasks/reorder',{ids}))}});
}
$('#v-board').addEventListener('click',e=>{const b=e.target.closest('[data-act="finish"]');if(b)openFinish(+b.dataset.id)});

/* ---------- finish sheet ---------- */
let F=null;
function openFinish(id){
  const t=S.open.find(x=>x.id===id);if(!t)return;
  const pr=S.products.find(p=>p.id===t.productId)||{};const dc=t.cat||pr.cat||'',dv=t.variety||pr.variety||'';
  F={t,defCat:dc,cat:dc,variety:dv,matDate:'',matArr:'',qty:String(t.qty),operator:store.get('tsb_op'),step:'date',err:'',preview:'',busy:false};
  if(!(cfg().people||[]).includes(F.operator))F.operator='';
  drawFinish();updatePreview();
}
function dvOf(t){const pr=S.products.find(p=>p.id===t.productId)||{};return t.variety||pr.variety||''}
function rule(){return (cfg().cats[F.cat]||{}).rule||'month'}
function ready(){if(!F.cat||!cfg().cats[F.cat])return false;return rule()==='material'?(F.matDate.length===4&&!!F.matArr):!!F.variety}
let pvT=null;
function updatePreview(){
  F.preview='';clearTimeout(pvT);if(!ready()){drawFinish();return}
  const key=[F.cat,F.variety,F.matDate,F.matArr].join('|');
  pvT=setTimeout(async()=>{try{const r=await api('POST','/api/lot-preview',{cat:F.cat,variety:F.variety,matDate:F.matDate,matArr:F.matArr});
    if(F&&[F.cat,F.variety,F.matDate,F.matArr].join('|')===key){F.preview=r.lot||'';F.err=r.lot?'':'這個批號的序號已用到 Z，請洽管理者';drawFinish()}}
    catch(e){if(F){F.err=e.message;drawFinish()}}},150);
}
function drawFinish(){
  if(!F)return;
  const t=F.t,c=cfg(),y=yearCode(new Date().getFullYear()),people=c.people||[],isMat=rule()==='material';
  let h='<div class="scrim" id="scrim"><div class="sheet" role="dialog" aria-modal="true" aria-label="完成生產">'+
   '<div><div class="pname">'+esc(t.productName)+' <span class="mono">× '+num(t.qty)+'</span></div><div class="meta"><span>'+esc(t.customer)+'</span>'+shipPill(t)+'</div></div>';
  h+='<div class="sec"><div class="lbl">操作人</div><div class="chips">'+(people.length?people.map(n=>'<button class="chip" data-op="'+esc(n)+'" aria-pressed="'+(F.operator===n)+'">'+esc(n)+'</button>').join(''):'<span class="hint">還沒有人員名單，請到「設定」新增。</span>')+'</div></div>';
  h+='<div class="sec"><div class="lbl">產品類別</div><div class="chips">'+Object.keys(c.cats).map(k=>'<button class="chip" data-cat="'+esc(k)+'" aria-pressed="'+(F.cat===k)+'">'+esc(k)+' '+esc(c.cats[k].name)+'</button>').join('')+'</div>'+
   (!F.cat?'<div class="warn">這個品項還沒設定類別，請點選正確的類別（可到「設定」的品項主檔設定一次，以後就會自動帶入）。</div>':'')+
   (F.cat&&F.defCat&&F.cat!==F.defCat?'<div class="warn">這個品項預設是 '+esc(F.defCat)+' '+esc(catName(F.defCat))+'，你改成了 '+esc(F.cat)+' '+esc(catName(F.cat))+'。確認無誤再完成。</div>':'')+'</div>';
  h+='<div class="sec"><div class="lbl">批號</div><div class="lot"><div class="seg"><b>'+y+'</b><small>年份</small></div><div class="seg"><b>'+esc(F.cat)+'</b><small>'+esc(catName(F.cat))+'</small></div>';
  if(isMat){const mat=(c.cats[F.cat]||{}).mat||'主原料';
    h+='<div class="seg man'+(F.step==='date'?' active':'')+'" data-step="date"><b>'+esc((F.matDate+'____').slice(0,4))+'</b><small>'+esc(mat)+'有效日</small></div>'+
       '<div class="seg man'+(F.step==='arr'?' active':'')+'" data-step="arr"><b>'+esc(F.matArr||'_')+'</b><small>到貨次序</small></div>';
  }else{
    h+='<div class="seg"><b>'+pad(new Date().getMonth()+1)+'</b><small>月份</small></div><div class="seg'+(F.variety?'':' man')+'"><b>'+esc(F.variety||'_')+'</b><small>'+esc(varName(F.cat,F.variety)||'品種')+'</small></div>';
  }
  h+='<span class="dash">-</span><div class="seg"><b>'+(F.preview?esc(F.preview.slice(-1)):'?')+'</b><small>序號</small></div></div>';
  if(!isMat){const vars=(c.varieties||{})[F.cat]||{};
    if(!F.variety||F.cat!==F.defCat||!vars[F.variety])h+='<div class="hint">選擇品種</div><div class="chips">'+Object.keys(vars).map(k=>'<button class="chip" data-var="'+esc(k)+'" aria-pressed="'+(F.variety===k)+'">'+esc(k)+' '+esc(vars[k])+'</button>').join('')+'</div>'}
  if(isMat){const keys=F.step==='date'?['1','2','3','4','5','6','7','8','9','0']:['A','B','C','D','E','F','G','H','I','J'];
    h+='<div class="hint">'+(F.step==='date'?'輸入'+esc((c.cats[F.cat]||{}).mat||'主原料')+'有效日期（月日 4 碼，例如 0913）':'點選這批原料是第幾次到貨（A＝第一次）')+'</div>'+
      '<div class="kp">'+keys.map(k=>'<button data-key="'+k+'">'+k+'</button>').join('')+'</div><div class="row"><button data-key="del" style="flex:1">刪除一碼</button><button data-key="clr" style="flex:1">清除</button></div>'}
  if(F.preview)h+='<div class="row" style="justify-content:space-between"><span class="hint">本批批號</span><span class="big-lot">'+esc(F.preview)+'</span></div>';
  h+='</div>';
  h+='<div class="sec"><label class="lbl" for="fqty">實際完成數量（少於訂單數量時，剩下的會留在看板上）</label><input id="fqty" class="mono" type="number" inputmode="numeric" min="1" max="'+t.qty+'" value="'+esc(F.qty)+'" style="font-size:22px"></div>';
  h+='<div class="err">'+esc(F.err)+'</div><div class="row"><button id="fcancel" style="flex:1">取消</button><button id="fok" class="primary" style="flex:2;min-height:60px;font-size:18px"'+(F.busy?' disabled':'')+'>'+(F.busy?'儲存中…':'確認完成')+'</button></div></div></div>';
  const sc=$('#scrim')?$('.sheet').scrollTop:0;
  $('#modal').innerHTML=h;$('.sheet').scrollTop=sc;
}
function closeFinish(){F=null;$('#modal').innerHTML='';render(true)}
$('#modal').addEventListener('input',e=>{if(F&&e.target.id==='fqty')F.qty=e.target.value});
$('#modal').addEventListener('click',e=>{
  if(!F)return;
  if(e.target.id==='scrim'||e.target.id==='fcancel')return closeFinish();
  const b=e.target.closest('button,[data-step]');if(!b)return;
  let changedLot=false;
  if(b.dataset.op!==undefined){F.operator=b.dataset.op;store.set('tsb_op',F.operator)}
  else if(b.dataset.cat){F.cat=b.dataset.cat;F.matDate='';F.matArr='';F.step='date';F.variety=F.cat===F.defCat?dvOf(F.t):'';changedLot=true}
  else if(b.dataset.var){F.variety=b.dataset.var;changedLot=true}
  else if(b.dataset.step){F.step=b.dataset.step}
  else if(b.dataset.key){const k=b.dataset.key;changedLot=true;
    if(k==='clr'){F.matDate='';F.matArr='';F.step='date'}
    else if(k==='del'){if(F.step==='arr'&&F.matArr)F.matArr='';else{F.matDate=F.matDate.slice(0,-1);F.step='date'}}
    else if(F.step==='date'){if(F.matDate.length<4)F.matDate+=k;if(F.matDate.length===4)F.step='arr'}
    else F.matArr=k}
  else if(b.id==='fok')return finishConfirm();
  F.err='';if(changedLot)updatePreview();else drawFinish();
});
async function finishConfirm(){
  const t=F.t,q=parseInt(F.qty,10);
  const fail=m=>{F.err=m;drawFinish()};
  if(!F.operator)return fail('請先點選操作人');
  if(!F.cat)return fail('請先選擇產品類別');
  if(rule()==='material'){if(F.matDate.length!==4)return fail('原料有效日期需要 4 碼');if(!F.matArr)return fail('請點選到貨次序')}
  else if(!F.variety)return fail('請選擇品種');
  if(!q||q<1||q>t.qty)return fail('數量需介於 1 到 '+t.qty);
  F.busy=true;drawFinish();
  try{
    const r=await api('POST','/api/tasks/'+t.id+'/finish',{operator:F.operator,cat:F.cat,variety:F.variety,matDate:F.matDate,matArr:F.matArr,qty:q});
    F=null;$('#modal').innerHTML='';
    toast('已完成，批號 '+r.lot+(r.rest>0?'，剩 '+num(r.rest)+' 留在看板':''));
    await refresh(true);render(true);
  }catch(e){if(F){F.busy=false;fail(e.message)}}
}

/* ---------- orders ---------- */
function renderOrders(){
  const v=$('#v-orders'),prods=S.products.filter(p=>p.active!==false);
  const ed=S.editOrder?S.open.find(t=>t.id===S.editOrder):null;
  const names=new Set(S.customers.map(c=>c.name));S.open.concat(S.done).forEach(t=>{if(t.customer)names.add(t.customer)});
  const codeOf={};S.customers.forEach(c=>{if(c.code)codeOf[c.name]=c.code});
  let h='<h2>'+(ed?'修改訂單':'新增出貨訂單')+'</h2><form class="panel" id="oform" novalidate><div class="grid">'+
   '<label class="f" for="o-cust" style="grid-column:1/-1">客戶（輸入名稱或編號）<input id="o-cust" list="custlist" autocomplete="off" placeholder="例：全盛食品行" value="'+esc(ed?ed.customer:'')+'"></label><datalist id="custlist">'+[...names].sort((a,b)=>a.localeCompare(b,'zh-Hant')).map(c=>'<option value="'+esc(c)+'">'+(codeOf[c]?esc(codeOf[c]):'')+'</option>').join('')+'</datalist>'+
   '<div id="o-hist" style="grid-column:1/-1"></div>'+
   '<label class="f" for="o-prod">品項／規格<select id="o-prod"><option value="">選擇品項</option>'+prods.map(p=>'<option value="'+p.id+'"'+(ed&&ed.productId===p.id?' selected':'')+'>'+esc(prodLabel(p))+'</option>').join('')+'</select></label>'+
   '<label class="f" for="o-qty">數量<input id="o-qty" class="mono" type="number" inputmode="numeric" min="1" placeholder="480" value="'+esc(ed?ed.qty:'')+'"></label>'+
   '<label class="f" for="o-date">指定出貨日<input id="o-date" type="date" value="'+esc(ed?ed.shipDate:today())+'"></label>'+
   '<label class="f" for="o-note" style="grid-column:1/-1">備註（選填）<input id="o-note" placeholder="外箱貼客戶標" value="'+esc(ed?ed.note||'':'')+'"></label></div>'+
   '<div class="err" id="oerr"></div><div class="row"><button type="submit" class="primary">'+(ed?'儲存修改':'加入排程')+'</button>'+(ed?'<button type="button" id="o-cancel">取消修改</button>':'')+'</div>'+
   (prods.length?'':'<p class="hint">還沒有品項，請先到「設定」新增品項。</p>')+'</form>';
  const lim=addDays(today(),2);
  const all=S.open.slice().sort((a,b)=>a.shipDate.localeCompare(b.shipDate)||(a.order||0)-(b.order||0));
  h+='<h2>未完成訂單</h2>';
  if(!all.length)h+='<div class="empty"><b>沒有未完成的訂單</b>新增的訂單會列在這裡；出貨日在三天內的會自動上看板。</div>';
  else h+='<div class="tbl-wrap"><table><thead><tr><th>出貨日</th><th>客戶</th><th>品項</th><th>數量</th><th>狀態</th><th></th></tr></thead><tbody>'+all.map(t=>
    '<tr><td class="mono">'+esc(t.shipDate)+'</td><td>'+esc(t.customer)+'</td><td>'+esc(t.productName)+(t.note?'<div class="hint">'+esc(t.note)+'</div>':'')+'</td><td class="mono">'+num(t.qty)+'</td><td>'+(t.shipDate<=lim?'<span class="pill p-today">已上看板</span>':'<span class="pill p-later">排隊中</span>')+'</td>'+
    '<td><div class="row" style="flex-wrap:nowrap"><button data-oedit="'+t.id+'">修改</button><button class="danger" data-ovoid="'+t.id+'">取消訂單</button></div></td></tr>').join('')+'</tbody></table></div>';
  v.innerHTML=h;renderHist();
}
function prodLabel(p){return (p.code?p.code+'　':'')+p.name+(p.cat?'':'（未設類別）')}
function resolveCustomer(v){v=(v||'').trim();if(!v)return '';const byCode=S.customers.find(c=>c.code&&c.code.toLowerCase()===v.toLowerCase());return byCode?byCode.name:v}
function renderHist(){
  const box=$('#o-hist');if(!box)return;const inp=$('#o-cust');
  const name=resolveCustomer(inp.value);
  if(name!==inp.value.trim()&&name){inp.value=name}
  if(!name){box.innerHTML='';return}
  const sel=$('#o-prod').value;
  const items=S.history.filter(h=>h[0]===name).map(h=>({p:S.products.find(p=>p.id===h[1]),times:h[2]})).filter(x=>x.p&&x.p.active!==false);
  if(!items.length){box.innerHTML='<p class="hint">'+(S.customers.some(c=>c.name===name)?'這個客戶還沒有品項紀錄。':'新客戶，第一次下單後系統會記住買過的品項。')+'</p>';return}
  box.innerHTML='<div class="lbl hint" style="margin-bottom:6px">'+esc(name)+' 買過的品項（點一下帶入）</div><div class="chips">'+items.map(x=>
    '<button type="button" class="chip hist" data-pick="'+x.p.id+'" aria-pressed="'+(String(x.p.id)===sel)+'"><span class="mono">'+esc(x.p.code||'')+'</span> '+esc(x.p.name)+' <span class="hint">×'+x.times+'</span></button>').join('')+'</div>';
}
$('#v-orders').addEventListener('input',e=>{if(e.target.id==='o-cust')renderHist()});
$('#v-orders').addEventListener('change',e=>{if(e.target.id==='o-prod')document.querySelectorAll('#o-hist [data-pick]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.pick===e.target.value)))});
$('#v-orders').addEventListener('submit',async e=>{
  e.preventDefault();
  const body={customer:resolveCustomer($('#o-cust').value),productId:$('#o-prod').value,qty:$('#o-qty').value,shipDate:$('#o-date').value,note:$('#o-note').value.trim()};
  if(!body.customer)return $('#oerr').textContent='請輸入客戶名稱';
  if(!body.productId)return $('#oerr').textContent='請選擇品項';
  if(!(+body.qty>0))return $('#oerr').textContent='數量需大於 0';
  if(!body.shipDate)return $('#oerr').textContent='請選擇出貨日';
  const id=S.editOrder;
  const r=await act(()=>id?api('PUT','/api/tasks/'+id,body):api('POST','/api/tasks',body),id?'訂單已更新':'已加入排程');
  if(r){S.editOrder=null;document.activeElement&&document.activeElement.blur();renderOrders()}
});
$('#v-orders').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.pick){$('#o-prod').value=b.dataset.pick;document.querySelectorAll('#o-hist [data-pick]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));$('#o-qty').focus();return}
  if(b.dataset.oedit){S.editOrder=+b.dataset.oedit;renderOrders();window.scrollTo({top:0,behavior:'smooth'})}
  else if(b.id==='o-cancel'){S.editOrder=null;renderOrders()}
  else if(b.dataset.ovoid){if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='再按一次確認';return}
    await act(()=>api('POST','/api/tasks/'+b.dataset.ovoid+'/void'),'訂單已取消')}
});

/* ---------- records ---------- */
function renderRecords(){
  const v=$('#v-records'),q=S.q.trim().toLowerCase();
  const rows=S.done.filter(t=>!q||[t.lot,t.customer,t.productName,t.operator,(t.matDate||'')+(t.matArr||'')].join(' ').toLowerCase().includes(q));
  let h='<div class="row" style="margin-bottom:12px"><input id="rq" placeholder="搜尋批號、客戶、品項、原料批（例：0913B）" value="'+esc(S.q)+'" style="flex:1;min-width:220px">'+
    '<a class="btnlink" href="/api/export.csv'+(S.pin?'?pin='+encodeURIComponent(S.pin):'')+'">匯出 Excel（CSV）</a></div>';
  if(!S.done.length)h+='<div class="empty"><b>還沒有生產紀錄</b>在看板上按「完成生產」後，紀錄會出現在這裡，可以用批號回查。</div>';
  else h+='<p class="hint">共 '+rows.length+' 筆</p><div class="tbl-wrap"><table><thead><tr><th>完成時間</th><th>批號</th><th>品項</th><th>數量</th><th>客戶</th><th>出貨日</th><th>操作人</th><th></th></tr></thead><tbody>'+rows.map(t=>
   '<tr><td class="mono">'+fmtTime(t.completedAt)+'</td><td class="mono" style="font-weight:600">'+esc(t.lot)+(t.lotHistory&&t.lotHistory.length?'<div class="hint">曾修改 '+t.lotHistory.length+' 次</div>':'')+'</td><td>'+esc(t.productName)+'</td><td class="mono">'+num(t.qty)+(t.orderedQty&&t.orderedQty!==t.qty?'<div class="hint">訂單 '+num(t.orderedQty)+'</div>':'')+'</td><td>'+esc(t.customer)+'</td><td class="mono">'+esc(t.shipDate)+'</td><td>'+esc(t.operator)+'</td>'+
   '<td><button data-rlot="'+t.id+'">改批號</button></td></tr>').join('')+'</tbody></table></div>';
  v.innerHTML=h;
}
$('#v-records').addEventListener('input',e=>{if(e.target.id==='rq'){S.q=e.target.value;const pos=e.target.selectionStart;renderRecords();const n=$('#rq');n.focus();n.setSelectionRange(pos,pos)}});
$('#v-records').addEventListener('click',e=>{const b=e.target.closest('button[data-rlot]');if(!b)return;const t=S.done.find(x=>x.id===+b.dataset.rlot);if(t)openLotEdit(t)});
function openLotEdit(t){
  $('#modal').innerHTML='<div class="scrim" id="lscrim"><form class="sheet" id="lform" role="dialog" aria-modal="true" aria-label="修改批號"><div class="pname">修改批號</div><div class="hint">'+esc(t.productName)+' × '+num(t.qty)+'　'+esc(t.customer)+'</div>'+
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
  let h='<h2>人員名單</h2><div class="panel"><div class="chips" style="margin-bottom:12px">'+((c.people||[]).map((n,i)=>'<button class="chip" data-delp="'+i+'" title="移除">'+esc(n)+'　×</button>').join('')||'<span class="hint">還沒有人員，新增後在看板完成生產時可以點選。</span>')+'</div>'+
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
    h+='<div class="tbl-wrap" style="margin-top:8px"><table><thead><tr><th>品號</th><th>品名／規格</th><th>類別</th><th>品種</th><th></th></tr></thead><tbody>'+prods.map(p=>{
      const vv=(c.varieties||{})[p.cat]||{},isMat=(c.cats[p.cat]||{}).rule==='material';
      return '<tr'+(p.active===false?' class="dim"':'')+' data-pid="'+p.id+'"><td class="mono">'+esc(p.code||'')+'</td><td>'+esc(p.name)+'</td>'+
       '<td><select class="pcat" aria-label="類別"><option value="">未設定</option>'+Object.keys(c.cats).map(k=>'<option value="'+esc(k)+'"'+(p.cat===k?' selected':'')+'>'+esc(k)+' '+esc(c.cats[k].name)+'</option>').join('')+'</select></td>'+
       '<td>'+(!p.cat?'':isMat?'<span class="hint">不需要</span>':'<select class="pvar" aria-label="品種"><option value="">選擇</option>'+Object.keys(vv).map(k=>'<option value="'+esc(k)+'"'+(p.variety===k?' selected':'')+'>'+esc(k)+' '+esc(vv[k])+'</option>').join('')+'</select>')+'</td>'+
       '<td><button data-ptoggle="'+p.id+'">'+(p.active===false?'恢復':'停用')+'</button></td></tr>'}).join('')+'</tbody></table></div>';
  }
  h+='<h2>類別與品種代碼</h2><div class="tbl-wrap"><table><thead><tr><th>類別</th><th>名稱</th><th>批號規則</th><th>品種代碼</th></tr></thead><tbody>'+Object.keys(c.cats).map(k=>{const vv=(c.varieties||{})[k]||{};
   return '<tr><td class="mono" style="font-weight:600">'+esc(k)+'</td><td>'+esc(c.cats[k].name)+'</td><td>'+(c.cats[k].rule==='material'?'原料批型（看'+esc(c.cats[k].mat||'主原料')+'有效日）':'月份型')+'</td><td>'+(Object.keys(vv).map(n=>esc(n)+' '+esc(vv[n])).join('、')||'<span class="hint">無</span>')+'</td></tr>'}).join('')+'</tbody></table></div>'+
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
})();
