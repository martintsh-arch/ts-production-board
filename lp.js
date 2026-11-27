/* LINE 叫貨文字解析（和 app.js 裡的 LP 完全相同，給伺服器自動入單用） */
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
module.exports = LP;
