(function(){
'use strict';
const S={open:[],done:[],products:[],cfg:null,rev:0,tab:'board',q:'',editOrder:null,pin:''};
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
    S.rev=s.rev;S.open=s.open;S.done=s.done;S.products=s.products;S.cfg=s.config;
    setStatus('已連線，資料每 3 秒自動同步');
    if(!F)render();
  }catch(e){if(e.message!=='需要密碼')setStatus('連線中斷，正在重新連線…')}
}
let pollT=null;
function startPolling(){refresh(true);clearInterval(pollT);pollT=setInterval(()=>{if(!document.hidden)refresh(false)},3000)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh(false)});

function showPin(){
  if($('#pinbox'))return;
  $('#modal').innerHTML='<div class="scrim"><form class="sheet" id="pinbox" style="border-radius:18px;align-self:center;max-width:420px"><div class="pname">請輸入公司密碼</div><input id="pinin" class="mono" type="password" inputmode="numeric" autocomplete="off" style="font-size:24px"><div class="err" id="pinerr"></div><button class="primary" type="submit">進入</button></form></div>';
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
    const code='<span class="pill p-code">'+esc(t.cat)+esc(t.variety||'')+' '+esc(catName(t.cat))+'</span>';
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
  F={t,defCat:t.cat,cat:t.cat,variety:t.variety||'',matDate:'',matArr:'',qty:String(t.qty),operator:store.get('tsb_op'),step:'date',err:'',preview:'',busy:false};
  if(!(cfg().people||[]).includes(F.operator))F.operator='';
  drawFinish();updatePreview();
}
function rule(){return (cfg().cats[F.cat]||{}).rule||'month'}
function ready(){return rule()==='material'?(F.matDate.length===4&&!!F.matArr):!!F.variety}
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
   (F.cat!==F.defCat?'<div class="warn">這個品項預設是 '+esc(F.defCat)+' '+esc(catName(F.defCat))+'，你改成了 '+esc(F.cat)+' '+esc(catName(F.cat))+'。確認無誤再完成。</div>':'')+'</div>';
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
  else if(b.dataset.cat){F.cat=b.dataset.cat;F.matDate='';F.matArr='';F.step='date';F.variety=F.cat===F.defCat?(F.t.variety||''):'';changedLot=true}
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
  const customers=[...new Set(S.open.concat(S.done).map(t=>t.customer).filter(Boolean))];
  let h='<h2>'+(ed?'修改訂單':'新增出貨訂單')+'</h2><form class="panel" id="oform" novalidate><div class="grid">'+
   '<label class="f" for="o-cust">客戶<input id="o-cust" list="custlist" autocomplete="off" placeholder="新加坡經銷" value="'+esc(ed?ed.customer:'')+'"></label><datalist id="custlist">'+customers.map(c=>'<option value="'+esc(c)+'">').join('')+'</datalist>'+
   '<label class="f" for="o-prod">品項／規格<select id="o-prod"><option value="">選擇品項</option>'+prods.map(p=>'<option value="'+p.id+'"'+(ed&&ed.productId===p.id?' selected':'')+'>'+esc(p.cat)+esc(p.variety||'')+'　'+esc(p.name)+'</option>').join('')+'</select></label>'+
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
  v.innerHTML=h;
}
$('#v-orders').addEventListener('submit',async e=>{
  e.preventDefault();
  const body={customer:$('#o-cust').value.trim(),productId:$('#o-prod').value,qty:$('#o-qty').value,shipDate:$('#o-date').value,note:$('#o-note').value.trim()};
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
  h+='<h2>品項主檔</h2><div class="panel"><div class="grid">'+
   '<label class="f" for="s-pname">品名／規格<input id="s-pname" placeholder="龍眼蜂蜜 700g"></label>'+
   '<label class="f" for="s-pcat">類別<select id="s-pcat">'+Object.keys(c.cats).map(k=>'<option value="'+esc(k)+'">'+esc(k)+' '+esc(c.cats[k].name)+'</option>').join('')+'</select></label>'+
   '<label class="f" for="s-pvar">品種<select id="s-pvar"></select></label></div><div class="err" id="perr"></div><button id="s-addprod" class="primary">新增品項</button></div>';
  const prods=S.products;
  if(prods.length)h+='<div class="tbl-wrap" style="margin-top:12px"><table><thead><tr><th>代碼</th><th>品名／規格</th><th>類別</th><th>品種</th><th>批號規則</th><th></th></tr></thead><tbody>'+prods.map(p=>
   '<tr'+(p.active===false?' class="dim"':'')+'><td class="mono">'+esc(p.cat)+esc(p.variety||'')+'</td><td>'+esc(p.name)+'</td><td>'+esc(catName(p.cat))+'</td><td>'+esc(varName(p.cat,p.variety))+'</td><td>'+(((c.cats[p.cat]||{}).rule==='material')?'原料批型':'月份型')+'</td>'+
   '<td><button data-ptoggle="'+p.id+'">'+(p.active===false?'恢復使用':'停用')+'</button></td></tr>').join('')+'</tbody></table></div>';
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
$('#v-settings').addEventListener('change',e=>{if(e.target.id==='s-pcat')fillVarSelect()});
$('#v-settings').addEventListener('click',async e=>{
  const b=e.target.closest('button');if(!b)return;const c=JSON.parse(JSON.stringify(cfg()));c.people=c.people||[];c.varieties=c.varieties||{};
  const saveCfg=msg=>act(()=>api('PUT','/api/config',c),msg);
  if(b.id==='s-addp'){const n=$('#s-person').value.trim();if(!n)return;if(c.people.includes(n))return toast(n+' 已在名單中');c.people.push(n);b.focus();await saveCfg('已新增 '+n)}
  else if(b.dataset.delp!==undefined){if(b.dataset.armed!=='1'){b.dataset.armed='1';b.textContent='再按一次移除';return}c.people.splice(+b.dataset.delp,1);await saveCfg('已移除')}
  else if(b.id==='s-addprod'){const name=$('#s-pname').value.trim(),cat=$('#s-pcat').value,variety=$('#s-pvar').value;
    if(!name)return $('#perr').textContent='請輸入品名／規格';
    if(c.cats[cat].rule!=='material'&&!variety)return $('#perr').textContent='這個類別還沒有品種代碼，請先在下方新增';
    b.focus();await act(()=>api('POST','/api/products',{name,cat,variety}),'已新增品項 '+name)}
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
