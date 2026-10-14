import { bitable } from '@lark-base-open/js-sdk';
import './index.scss';

type Row = Record<string, any>;
type Leave = {person:string; company:string; type:string; year:number; month:number; days:number; source:string; start:string; end:string; valid:boolean};
type State = {year:string;company:string;person:string;type:string;mode:'real'|'demo';view:'all'|'month'};
const app=document.querySelector<HTMLDivElement>('#app')!;
let state:State={year:'2026',company:'全部公司',person:'全部人员',type:'全部假种',mode:'real',view:'all'};
let leaves:Leave[]=[];
let orders:Row[]=[];
let status='正在连接飞书数据…';
let loading=true;
let detailDay='';
const icons:Record<string,string>={
 calendar:'<path d="M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z"/><path d="M8 14h3v3H8z"/>',
 users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
 chart:'<path d="M3 3v18h18M8 16v-5M13 16V7M18 16V4"/>',
 stack:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 9h10M7 13h10M7 17h6"/>',
 filter:'<path d="M4 7h16M7 12h10M10 17h4"/>',
 refresh:'<path d="M20 11a8 8 0 0 0-14-5L4 8m0-5v5h5M4 13a8 8 0 0 0 14 5l2-2m0 5v-5h-5"/>',
 crown:'<path d="m2 8 5 4 5-7 5 7 5-4-2 11H4Z"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5m0-8h.01"/>'
};
const svg=(name:string)=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(icons[name]||icons.chart)+'</svg>';
const esc=(v:any)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'} as any)[c]);
const num=(n:number)=>Number.isInteger(n)?String(n):n.toFixed(1);
const sum=(xs:Leave[])=>xs.reduce((s,x)=>s+x.days,0);
const uniq=(xs:string[])=>Array.from(new Set(xs.filter(Boolean)));
const raw=(v:any):string=>{
 if(v==null)return '';
 if(typeof v==='string'||typeof v==='number'||typeof v==='boolean')return String(v);
 if(Array.isArray(v))return v.map(raw).filter(Boolean).join(', ');
 if(typeof v==='object')return raw(v.text??v.name??v.value??v.displayValue??v.title??v.result??'');
 return '';
};
const cell=(r:Row,k:string)=>raw(r[k]);
const dateStr=(v:string)=>{const m=v.match(/(20\d{2})[-/年](\d{1,2})[-/月](\d{1,2})/);return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:'';};
const tsDate=(v:any):string=>typeof v==='number'?new Date(v).toLocaleDateString('en-CA',{timeZone:'Asia/Shanghai'}):dateStr(raw(v));
function demo(){
 const people=[['张三','A公司'],['李四','B公司'],['王敏','C公司'],['陈晨','B公司'],['赵秋月','A公司'],['刘婷','C公司']];
 const kinds=['事假','病假','年假','调休'];
 const result:Leave[]=[];
 for(let p=0;p<people.length;p++)for(let m=1;m<=12;m++){
 const days=((p*7+m*3)%7===0?0:((p*7+m*3)%7)/2);
 if(days)result.push({person:people[p][0],company:people[p][1],type:kinds[(p+m)%4],year:2026,month:m,days,source:`demo-${p}-${m}`,start:`2026-${String(m).padStart(2,'0')}-${String(3+p).padStart(2,'0')}`,end:`2026-${String(m).padStart(2,'0')}-${String(4+p).padStart(2,'0')}`,valid:true});
 }
 return result;
}
async function load(){
 loading=true;status='正在连接飞书多维表格…';render();
 try{
  const base:any=bitable.base;
  const metas=await base.getTableMetaList();
  const detail=metas.find((t:any)=>t.name==='月度请假明细表');
  const registration=metas.find((t:any)=>t.name==='请假登记表');
  if(!detail)throw Error('没有找到「月度请假明细表」；请确认插件添加在正确的多维表格中。');
  async function tableRows(meta:any):Promise<Row[]>{
   if(!meta)return [];
   const table=await base.getTableById(meta.id);
   const fields=await table.getFieldMetaList();
   let ids:string[]=[];
   if(typeof table.getRecordIdList==='function')ids=await table.getRecordIdList();
   else if(typeof table.getRecords==='function'){
     let pageToken: string|undefined;
     do{const page=await table.getRecords({pageSize:100,pageToken});ids.push(...(page.records||[]).map((r:any)=>r.recordId||r.id));pageToken=page.hasMore?page.pageToken:undefined;}while(pageToken&&ids.length<10000);
   }else throw Error('当前飞书 SDK 不支持读取记录 ID，请检查插件运行环境。');
   if(ids.length>10000)throw Error('记录超过10000条，当前版本需要分页优化。');
   const results:Row[]=[];
   for(const id of ids){
    const entry:Row={_id:id};
    await Promise.all(fields.map(async(f:any)=>{
      try{const value=await table.getCellValue(f.id,id);entry[f.name]=value;}catch{entry[f.name]='';}
    }));
    results.push(entry);
   }
   return results;
  }
  const [details,records]=await Promise.all([tableRows(detail),tableRows(registration)]);
  leaves=details.filter(r=>cell(r,'统计有效性').includes('有效')).map(r=>{
   const ym=cell(r,'统计年月');
   const date=dateStr(ym+'-01');
   const year=Number(cell(r,'统计年份'))||Number(date.slice(0,4));
   const month=Number(cell(r,'统计月份'))||Number(date.slice(5,7));
   return {person:cell(r,'请假人员'),company:cell(r,'所属公司'),type:cell(r,'假种'),year,month,days:Number(cell(r,'本月请假天数'))||0,source:cell(r,'来源记录ID')||cell(r,'请假单编号'),start:tsDate(r['开始日期']),end:tsDate(r['结束日期']),valid:true};
  }).filter(r=>r.year>2000&&r.month>=1&&r.month<=12);
  orders=records;
  status=`已连接飞书 · ${leaves.length} 条有效月度明细`;
 }catch(e){leaves=[];orders=[];status='连接提示：'+(e instanceof Error?e.message:String(e));}
 loading=false;render();
}
function selected(){
 const src=state.mode==='demo'?demo():leaves;
 return src.filter(x=>(state.year==='全部年份'||String(x.year)===state.year)&&(state.company==='全部公司'||x.company===state.company)&&(state.person==='全部人员'||x.person===state.person)&&(state.type==='全部假种'||x.type===state.type));
}
function selectControl(id:string,label:string,items:string[],value:string){
 return `<label class="filter"><span>${label}</span><select id="${id}">${items.map(x=>`<option value="${esc(x)}" ${value===x?'selected':''}>${esc(x)}</option>`).join('')}</select></label>`;
}
function card(title:string,value:string,unit:string,icon:string,colour:string,hint:string){
 return `<section class="card kpi"><div class="kpi-icon ${colour}">${svg(icon)}</div><div class="kpi-info"><div class="kpi-label">${title}</div><div class="kpi-value">${esc(value)}<small> ${unit}</small></div><div class="kpi-hint">${hint}</div></div></section>`;
}
const types=['事假','病假','年假','调休','其他'];
const colors=['#317ff5','#24b7ad','#ff9d47','#986bee','#93a4bc'];
function pill(k:string){const n=types.indexOf(k);return colors[n<0?4:n];}
function calendarHtml(xs:Leave[],year:number){
 const counter=new Map<string,number>();
 xs.forEach(x=>{let a=x.start,b=x.end;if(!a||!b)return;let d=new Date(a+'T12:00:00'),last=new Date(b+'T12:00:00'),safe=0;while(d<=last&&safe++<370){const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;counter.set(key,(counter.get(key)||0)+1);d.setDate(d.getDate()+1);}});
 return `<div class="cal-grid">${Array.from({length:12},(_,i)=>{let m=i+1,start=new Date(year,i,1),days=new Date(year,i+1,0).getDate(),week=(start.getDay()+6)%7;return `<div class="cal-month"><strong>${m}月</strong><div class="cal-days">${Array.from({length:week},()=>'<span></span>').join('')}${Array.from({length:days},(_,d)=>{const key=`${year}-${String(m).padStart(2,'0')}-${String(d+1).padStart(2,'0')}`,v=counter.get(key)||0;return `<button class="cal-day ${v>0?(v>2?'high':'on'):''}" data-day="${key}" title="${key} · ${v}条涉及该日期的明细">${d+1}</button>`;}).join('')}</div></div>`;}).join('')}</div>`;
}
function render(){
 const all=state.mode==='demo'?demo():leaves;
 const years=uniq(all.map(x=>String(x.year))).sort();
 const source=selected();
 const people=uniq(source.map(x=>x.person));
 const nDays=sum(source);
 const visits=uniq(source.map(x=>x.source)).length;
 const totals=people.map(p=>({person:p,days:sum(source.filter(x=>x.person===p))})).sort((a,b)=>b.days-a.days);
 const availablePeople=uniq(all.filter(x=>state.company==='全部公司'||x.company===state.company).map(x=>x.person)).sort();
 const months=Array.from({length:12},(_,i)=>i+1);
 const max=Math.max(1,...totals.map(x=>x.days));
 const year=Number(state.year==='全部年份'?years[0]||2026:state.year);
 const yearly=source.filter(x=>x.year===year);
 const yearLabel=state.year==='全部年份'?'全部年份':state.year+'年';
 const counts=uniq(yearly.map(x=>x.person)).length;
 const noRecords=!loading&&all.length===0;
 app.innerHTML=`
 <div class="board">
  <header class="hero"><div class="identity"><div class="logo">${svg('chart')}</div><div><h1>外协人员年度请假统计大屏</h1><p>PERSONNEL LEAVE ANALYTICS · ${state.mode==='demo'?'演示数据':'飞书实时数据'}</p></div></div><div class="hero-actions"><span class="live"><span class="dot"></span>${esc(status)}</span><button id="reload" class="secondary">${svg('refresh')}刷新</button><button id="mode" class="secondary">${state.mode==='demo'?'退出演示':'查看演示'}</button></div></header>
  <div class="toolbar">${selectControl('year','统计年份',['全部年份',...years.length?years:['2026']],state.year)}${selectControl('company','所属公司',['全部公司',...uniq(all.map(x=>x.company)).sort()],state.company)}${selectControl('person','请假人员',['全部人员',...availablePeople],state.person)}${selectControl('type','假种',['全部假种',...uniq(all.map(x=>x.type)).sort()],state.type)}<button id="reset" class="primary">${svg('filter')}重置筛选</button></div>
  ${noRecords?`<div class="empty-banner">${svg('info')}当前尚无有效月度明细，统计值为0。想预览完整页面，可点右上角「查看演示」，演示数据不会写入飞书。${status.startsWith('连接提示')?`<span class="error">${esc(status)}</span>`:''}</div>`:''}
  <div class="kpi-grid">${card('年度请假总天数',num(nDays),'天','calendar','blue',yearLabel+' · 有效明细合计')}${card('年度请假人数',String(people.length),'人','users','teal','按姓名去重')}${card('请假总人次',String(visits),'次','stack','orange','按来源请假单去重')}${card('人均请假天数',num(people.length?nDays/people.length:0),'天','chart','purple','按实际请假人数平均')}</div>
  <div class="main-grid">
   <section class="card matrix-panel"><div class="panel-title"><div><h2>每个人每月请假天数</h2><p>点击人员姓名，查看个人详细数据</p></div><span class="caption-tag">月度矩阵 · 天</span></div><div class="matrix-scroll"><table class="matrix"><thead><tr><th class="sticky">请假人员</th>${months.map(m=>`<th>${m}月</th>`).join('')}<th>合计</th></tr></thead><tbody>${totals.length?totals.map(t=>`<tr><th class="sticky"><button class="person-link" data-person="${esc(t.person)}">${esc(t.person)}</button></th>${months.map(m=>{let n=sum(source.filter(x=>x.person===t.person&&x.month===m&&x.year===year));const level=n?Math.min(0.12+n/15,.9):0;return `<td><span class="heatcell" style="--heat:${level.toFixed(2)}">${n?num(n):'—'}</span></td>`;}).join('')}<td><b>${num(t.days)}</b></td></tr>`).join(''):`<tr><td colspan="14" class="no-data">暂无有效请假数据</td></tr>`}</tbody></table></div></section>
   <section class="card"><div class="panel-title"><div><h2>每人年度请假天数</h2><p>按请假总天数降序</p></div></div><div class="bars">${totals.length?totals.slice(0,12).map(t=>`<button class="bar-row" data-person="${esc(t.person)}"><span class="bar-name">${esc(t.person)}</span><span class="bar-track"><span class="bar-fill" style="width:${(t.days/max*100).toFixed(1)}%"></span></span><strong>${num(t.days)}</strong></button>`).join(''):'<p class="no-data">暂无人员统计</p>'}</div></section>
   <section class="card"><div class="panel-title"><div><h2>每人假种及假种天数</h2><p>颜色表示假种，长度表示天数</p></div></div><div class="legend">${types.map((t,i)=>`<span><i style="background:${colors[i]}"></i>${t}</span>`).join('')}</div><div class="bars">${totals.length?totals.slice(0,12).map(t=>`<div class="bar-row"><span class="bar-name">${esc(t.person)}</span><span class="stack-track">${uniq(source.filter(x=>x.person===t.person).map(x=>x.type)).map(k=>{const n=sum(source.filter(x=>x.person===t.person&&x.type===k));return `<span class="stack-segment" title="${esc(k)}：${num(n)}天" style="width:${(n/max*100).toFixed(1)}%;background:${pill(k)}"></span>`;}).join('')}</span><strong>${num(t.days)}</strong></div>`).join(''):'<p class="no-data">暂无假种统计</p>'}</div></section>
   <section class="card rank-panel"><div class="panel-title"><div><h2>${svg('crown')} 请假排行榜 TOP 10</h2><p>按当前筛选条件统计</p></div></div><div class="rank-list">${totals.length?totals.slice(0,10).map((t,i)=>`<button class="rank-item" data-person="${esc(t.person)}"><span class="rank-index rank-${i+1}">${i+1}</span><span class="rank-person">${esc(t.person)}</span><span class="rank-days">${num(t.days)} 天</span></button>`).join(''):'<p class="no-data">暂无排名</p>'}</div></section>
   <section class="card calendar-panel"><div class="panel-title"><div><h2>年度请假日历</h2><p>点选日期查看涉及该日的请假人员（按自然日区间展示）</p></div><span class="caption-tag">${year}年</span></div>${calendarHtml(yearly,year)}<div class="cal-footer"><span><i class="legend-dot"></i>无请假</span><span><i class="legend-dot on"></i>有请假</span><span><i class="legend-dot high"></i>较多人</span></div>${detailDay?`<div class="date-detail"><b>${esc(detailDay)}</b><button id="close-detail">关闭</button><p>${yearly.filter(x=>x.start<=detailDay&&x.end>=detailDay).map(x=>`${esc(x.person)} · ${esc(x.type)}`).join('；')||'当前筛选范围没有明细'}</p></div>`:''}</section>
  </div>
  <footer>仅统计「统计有效性 = 有效」的月度请假明细 · 当前按自然日和半天时段计算，尚未排除法定节假日 · 数据源：飞书多维表格</footer>
 </div>`;
 (document.getElementById('reload') as HTMLButtonElement).onclick=()=>{if(state.mode==='demo'){state.mode='real';}load();};
 (document.getElementById('mode') as HTMLButtonElement).onclick=()=>{state.mode=state.mode==='demo'?'real':'demo';state.year='2026';state.person='全部人员';state.company='全部公司';state.type='全部假种';render();};
 (document.getElementById('reset') as HTMLButtonElement).onclick=()=>{state.year='2026';state.company='全部公司';state.person='全部人员';state.type='全部假种';detailDay='';render();};
 for(const key of ['year','company','person','type'] as const)(document.getElementById(key) as HTMLSelectElement).onchange=e=>{(state as any)[key]=(e.target as HTMLSelectElement).value;if(key==='company')state.person='全部人员';detailDay='';render();};
 document.querySelectorAll<HTMLButtonElement>('[data-person]').forEach(b=>b.onclick=()=>{state.person=b.dataset.person||'全部人员';render();});
 document.querySelectorAll<HTMLButtonElement>('[data-day]').forEach(b=>b.onclick=()=>{detailDay=b.dataset.day||'';render();});
 document.getElementById('close-detail')?.addEventListener('click',()=>{detailDay='';render();});
}
render();load();
