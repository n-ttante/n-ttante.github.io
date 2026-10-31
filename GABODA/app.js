/* ===== GABODA 앱 (기능 · 애니메이션) =====
 * 지도 도형과 지역 데이터는 map.js(window.KMAP)에서 읽어옵니다. */
const KMAP=window.KMAP;
if(!KMAP)throw new Error('map.js 가 먼저 로드되어야 합니다');
const D=KMAP.data;
{const m=document.getElementById('map');m.setAttribute('viewBox',KMAP.viewBox);m.insertAdjacentHTML('beforeend',KMAP.markup)}
const svg=document.getElementById('map'),titleEl=document.getElementById('title'),subEl=document.getElementById('sub'),back=document.getElementById('back');
const provEls=[...svg.querySelectorAll('#pVis .prov')],groups=[...svg.querySelectorAll('#cLayer .pg')],chGroups=[...svg.querySelectorAll('#cHit .chg')];
const sheet=document.getElementById('sheet'),sheetTitle=document.getElementById('sheetTitle'),sheetSub=document.getElementById('sheetSub'),tripList=document.getElementById('tripList'),sbody=document.getElementById('sbody'),cityData={};
D.prov.forEach(p=>p.c.forEach(c=>cityData[c[3]]=c));
const WK=document.documentElement.classList.contains('wk');   // Safari / iOS (WebKit)
const NS='http://www.w3.org/2000/svg';
function mkShadow(f){const u=document.createElementNS(NS,'use');u.setAttribute('class','shd');u.setAttribute('filter',`url(#${f})`);return u}
const shL=WK?mkShadow('shL'):null,shP=WK?mkShadow('shP'):null;   // WebKit은 SVG 도형에 CSS filter가 안 먹어서, 그림자를 별도 도형 + SVG filter로 그림
function wkOn(sh,el){   // 떠오르는 지역 바로 아래에 그림자 도형을 놓고 서서히 나타나게 함
  sh.style.transition='none';sh.style.opacity=0;el.parentNode.insertBefore(sh,el);sh.setAttribute('href',el.getAttribute('href'));
  sh.getBoundingClientRect();sh.style.transition='';sh.style.opacity=1;
}
function wkOff(sh){sh.style.opacity=''}
function wkParams(L){   // 화면 배율에 맞춰 그림자 크기 갱신
  const set=(id,std,dy)=>{const f=document.getElementById(id);f.querySelector('feGaussianBlur').setAttribute('stdDeviation',std);f.querySelector('feOffset').setAttribute('dy',dy)};
  set('shL',L*.45,L*1.4);set('shP',L*.3,L*.5);
}
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
let level=0,sel=-1,selC=null,cur=null,hoverName=null,cam={cx:0,cy:0,w:1},raf=0;

/* ---------- 카메라 (viewBox 애니메이션) ---------- */
const aspect=()=>svg.clientWidth/Math.max(svg.clientHeight,1);
function fit(bb,pad){const bw=bb[2]-bb[0],bh=bb[3]-bb[1];return{cx:(bb[0]+bb[2])/2,cy:(bb[1]+bb[3])/2,w:Math.max(bw*pad,bh*pad*aspect())}}
const bandPx=()=>Math.round(Math.min(Math.max(svg.clientHeight*.2,90),150)/3);   // 상단에 도시 모양이 놓이는 높이
const wideMQ=matchMedia('(min-width: 900px)'),wide=()=>wideMQ.matches;   // 넓은 화면(PC·태블릿 가로)
function sideFit(bb){   // 넓은 화면: 선택한 시를 왼쪽 영역 가운데에, 크기를 맞춰서 배치
  const W=svg.clientWidth,H=svg.clientHeight,sw=sheet.offsetWidth;
  const bw=bb[2]-bb[0],bh=bb[3]-bb[1],regW=W-sw-48,regH=H-24;
  const s=Math.min(regW*.78/bw,regH*.78/bh)*2/3;   // 시의 크기와 상관없이 같은 크기의 상자에 맞춤(지금의 2/3) → 작은 시는 키우고 큰 시는 줄여서 비슷하게 보임
  const cxb=(bb[0]+bb[2])/2,cyb=(bb[1]+bb[3])/2,sx=(W-sw-16)/2;
  return{cx:cxb+(W/2-sx)/s,cy:cyb,w:W/s};
}
function topFit(bb){ if(wide())return sideFit(bb);   // 선택한 시를 상단 띠 안에 작게 배치 (더 커지지는 않고 줄어들기만 함)
  const W=svg.clientWidth,H=svg.clientHeight,band=bandPx(),bw=bb[2]-bb[0],bh=bb[3]-bb[1];
  const s=Math.min(W/6/bw,band/bh,W/fit(D.prov[sel].bb,1.35).w/3);   // 시 모양 크기: 기존의 1/3 (띠 높이도 같이 줄임)
  const sy=band/2+2;
  return{cx:(bb[0]+bb[2])/2,cy:(bb[1]+bb[3])/2+(H/2-sy)/s,w:W/s};
}
let mapScale=1;try{const v=+localStorage.getItem('mapScale');if(v>=.5&&v<=1)mapScale=v}catch(e){}   // 대한민국 전체 지도 크기 (0.5~1)
const allFit=()=>fit(D.all,1.06/mapScale);
const target=()=>level===2?topFit(selC[4]):level?fit(D.prov[sel].bb,1.35):allFit();
function layout(){sheet.style.setProperty('--sheet-top',(svg.getBoundingClientRect().top+(wide()?8:bandPx()+10))+'px')}
const setBack=()=>{back.classList.toggle('lock',level===2&&view==='form');back.textContent=level===2?'‹ '+(view==='form'?'취소':view==='gallery'?selC[0]:D.prov[sel].s?'대한민국':D.prov[sel].n):'‹ 대한민국'};
function apply(c,fin=true,asp){cam=c;const h=c.w/(asp||aspect());svg.setAttribute('viewBox',`${c.cx-c.w/2} ${c.cy-h/2} ${c.w} ${h}`);if(fin&&level!==2){const L=9*c.w/Math.max(svg.clientWidth,1);svg.style.setProperty('--lift',L+'px');wkParams(L)}}  // 매 프레임 갱신하면 전체 요소 스타일 재계산 → 끝날 때만
function flyTo(t,dur,keepLift){
  cancelAnimationFrame(raf);const s={...cam};let t0=-1;if(reduce)dur=0;const asp=aspect();   // 화면 비율은 이동 시작할 때 한 번만 읽음
  if(!keepLift){const L=9*t.w/Math.max(svg.clientWidth,1);svg.style.setProperty('--lift',L+'px');wkParams(L)}   // 선택하는 즉시 새 화면 배율에 맞는 '떠오르는 높이'로 변경
  const step=now=>{
    if(t0<0)t0=now;   // 첫 프레임 시각부터 시간 계산 → 시작할 때 스타일 계산이 몰려도 애니메이션이 앞으로 튀지 않음
    const p=dur?Math.min(1,(now-t0)/dur):1,e=p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
    const w=s.w*Math.pow(t.w/s.w,e);                       // 줌은 지수 보간 → 일정한 속도감
    const u=Math.abs(s.w-t.w)<1e-6?e:(s.w-w)/(s.w-t.w);     // 이동은 줌에 맞춰 보간 → 자연스러운 궤적
    apply({cx:s.cx+(t.cx-s.cx)*u,cy:s.cy+(t.cy-s.cy)*u,w},p>=1,asp);
    if(p<1)raf=requestAnimationFrame(step);
  };
  raf=requestAnimationFrame(step);
}

/* ---------- 상단 제목 ---------- */
let pend=false;
const crumbEl=document.getElementById('crumb');
function swap(el,txt,cb){   // 글자가 바뀔 때 살짝 사라졌다가 나타남
  if(el._s===undefined)el._s=el.textContent;
  if(el._s===txt)return;el._s=txt;el.classList.add('out');clearTimeout(el._t);
  el._t=setTimeout(()=>{el.textContent=txt;el.classList.remove('out');cb&&cb()},130);
}
function header(){   // 작은 글씨(위) + 큰 글씨(아래)
  const pn=level?D.prov[sel].n:'';
  if(level===2)return[D.prov[sel].s?'대한민국':'대한민국 '+pn,selC[0]];
  if(hoverName)return level?['대한민국 '+pn,hoverName]:['대한민국',hoverName];
  return level?['대한민국',pn]:['','대한민국'];
}
let lastType=matchMedia('(hover: none)').matches?'touch':'mouse';   // 마지막으로 사용한 입력 방식 (터치 / 마우스)
const touchy=()=>lastType==='touch';
function subText(){
  if(level===2)return '';
  if(level)return touchy()&&cur?'한 번 더 터치하면 자세히 보기':`시·군·구 ${D.prov[sel].c.length}곳`;
  if(touchy())return cur?'한 번 더 터치하면 자세히 보기':'시·도를 터치해 보세요';
  return '시·도를 눌러 자세히 보기';
}
function refresh(){if(pend)return;pend=true;requestAnimationFrame(()=>{pend=false;const[c,h]=header();swap(crumbEl,c);swap(titleEl,h);subEl.textContent=subText()})}

/* ---------- hover (떠오르기) ---------- */
function lift(el){
  if(cur===el)return;drop();
  el.parentNode.appendChild(el);el.getBoundingClientRect();   // 맨 위로 올린 뒤 애니메이션 시작
  if(WK)wkOn(shL,el);el.classList.add('lift');cur=el;hoverName=el.dataset.n;refresh();
}
function drop(){if(cur){cur.classList.remove('lift');cur=null;if(WK)wkOff(shL)}hoverName=null;refresh()}

/* ---------- 시·도 선택 / 복귀 ---------- */
function enter(i){
  if(level)return;drop();level=1;sel=i;const P=D.prov[i];
  const cx=(P.bb[0]+P.bb[2])/2,cy=(P.bb[1]+P.bb[3])/2,mx=Math.max(...P.c.map(c=>Math.hypot(c[1]-cx,c[2]-cy)),1);
  P.c.forEach(c=>document.getElementById('cv'+c[3]).style.setProperty('--d',(380+Math.hypot(c[1]-cx,c[2]-cy)/mx*420)+'ms')); // 가운데서부터 퍼지듯 등장
  svg.classList.add('zoomed');provEls[i].classList.add('sel');groups[i].classList.add('on');chGroups[i].classList.add('on');
  back.classList.add('show');
  if(P.s){pick(P.c[0],true);return}   // 광역시 등: 구 선택 없이 바로 여행 리스트로
  setBack();flyTo(fit(P.bb,1.35),1000);refresh();
}
function leave(){
  if(!level)return;drop();const i=sel;level=0;sel=-1;
  svg.classList.remove('zoomed');provEls[i].classList.remove('sel');groups[i].classList.remove('on');chGroups[i].classList.remove('on');
  back.classList.remove('show');
  flyTo(allFit(),900);refresh();
}

/* ---------- 다크 모드 ---------- */
const root=document.documentElement,mq=matchMedia('(prefers-color-scheme: dark)');
let saved=null;try{saved=localStorage.getItem('theme')}catch(e){}
const curTheme=()=>root.dataset.theme||(mq.matches?'dark':'light');
function setTheme(t,keep){root.dataset.theme=t;if(keep){saved=t;try{localStorage.setItem('theme',t)}catch(e){}}}
document.getElementById('theme').addEventListener('click',e=>{e.stopPropagation();setTheme(curTheme()==='dark'?'light':'dark',true)});
mq.addEventListener('change',e=>{if(!saved)setTheme(e.matches?'dark':'light')});

/* ---------- 저장소: IndexedDB (사용할 수 없는 환경에서는 임시 메모리) ---------- */
const idb={
  db:null,
  open(){return this.db||(this.db=new Promise((res,rej)=>{
    const r=indexedDB.open('korea-scratch',1);
    r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('trips',{keyPath:'id'}).createIndex('region','region');d.createObjectStore('photos',{keyPath:'id'}).createIndex('trip','trip')};
    r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);
  }))},
  async all(s){const d=await this.open();return new Promise((res,rej)=>{const q=d.transaction(s).objectStore(s).getAll();q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})},
  async putMany(s,arr){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(s,'readwrite'),o=t.objectStore(s);arr.forEach(x=>o.put(x));t.oncomplete=()=>res();t.onerror=t.onabort=()=>rej(t.error)})},
  async put(s,o){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(s,'readwrite');t.objectStore(s).put(o);t.oncomplete=()=>res();t.onerror=t.onabort=()=>rej(t.error)})},
  async get(s,id){const d=await this.open();return new Promise((res,rej)=>{const q=d.transaction(s).objectStore(s).get(id);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})},
  async delMany(s,ids){const d=await this.open();return new Promise((res,rej)=>{const t=d.transaction(s,'readwrite'),o=t.objectStore(s);ids.forEach(i=>o.delete(i));t.oncomplete=()=>res();t.onerror=t.onabort=()=>rej(t.error)})},
  async byIndex(s,i,v){const d=await this.open();return new Promise((res,rej)=>{const q=d.transaction(s).objectStore(s).index(i).getAll(v);q.onsuccess=()=>res(q.result);q.onerror=()=>rej(q.error)})}
};
const mem={m:{trips:new Map(),photos:new Map()},
  async put(s,o){this.m[s].set(o.id,o)},async all(s){return[...this.m[s].values()]},async putMany(s,arr){arr.forEach(x=>this.m[s].set(x.id,x))},async delMany(s,ids){ids.forEach(i=>this.m[s].delete(i))},async get(s,id){return this.m[s].get(id)},
  async byIndex(s,i,v){return[...this.m[s].values()].filter(o=>o[i]===v).sort((a,b)=>a.id<b.id?-1:1)}};
let memMode=false;
const ready=(async()=>{
  try{
    if(!window.indexedDB)throw 0;
    await Promise.race([idb.open(),new Promise((_,rej)=>setTimeout(rej,3000))]);
    try{navigator.storage&&navigator.storage.persist&&navigator.storage.persist()}catch(e){}   // 브라우저가 임의로 지우지 않도록 요청
    return idb;
  }catch(e){memMode=true;return mem}
})();
ready.then(()=>{if(memMode)toast('이 환경에서는 저장이 유지되지 않아요 (임시 저장)',4500)});
function hideToast(){const el=document.getElementById('toast');clearTimeout(el._t);el.classList.remove('show')}
/* ---------- 여행 기록이 있는 지역은 연한 색으로 표시 ---------- */
const visited=new Set(),cityEls={};
D.prov.forEach(p=>p.c.forEach(c=>{cityEls[c[5]]=document.getElementById('cv'+c[3])}));
function paintRegion(i){   // i번째 도와 그 안의 시·군·구 색칠 갱신
  let all=true;
  D.prov[i].c.forEach(c=>{const v=visited.has(c[5]);if(!v)all=false;cityEls[c[5]].classList.toggle('visited',v)});
  provEls[i].classList.toggle('visited',all);   // 도는 안의 모든 시·군·구에 기록이 있을 때만 칠함
}
const SINGLE_NAMES=D.prov.filter(p=>p.s).map(p=>p.n);
const normRegion=r=>{const i=r.indexOf('/'),p=i<0?'':r.slice(0,i);return SINGLE_NAMES.includes(p)?p+'/'+p:r};   // 구 단위 기록은 광역시 전체로 합침
ready.then(async st=>{try{
  const rows=await st.all('trips'),fix=rows.filter(r=>normRegion(r.region)!==r.region);
  if(fix.length){fix.forEach(r=>{r.region=normRegion(r.region)});await st.putMany('trips',fix)}
  rows.forEach(r=>visited.add(r.region));D.prov.forEach((_,i)=>paintRegion(i));
}catch(e){}});
function toast(msg,ms=2600,act){
  const el=document.getElementById('toast');el.textContent=msg;el.classList.toggle('act',!!act);
  if(act){const b=document.createElement('button');b.type='button';b.textContent=act.label;b.onclick=()=>{hideToast();act.fn()};el.append(b)}
  el.classList.add('show');clearTimeout(el._t);el._t=setTimeout(()=>el.classList.remove('show'),ms);
}
const genId=p=>p+String(Date.now()).padStart(14,'0')+Math.random().toString(36).slice(2,6);   // 시간순 정렬되는 id

/* ---------- 날짜 / 문자열 ---------- */
const pad2=n=>String(n).padStart(2,'0');
const parseD=s=>{const[y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)};
const ymd=d=>`${d.getFullYear()}.${pad2(d.getMonth()+1)}.${pad2(d.getDate())}`;
function fmtRange(tr){const s=parseD(tr.start),e=parseD(tr.end);if(+s===+e)return ymd(s);return `${ymd(s)} ~ ${s.getFullYear()===e.getFullYear()?'':e.getFullYear()+'.'}${pad2(e.getMonth()+1)}.${pad2(e.getDate())}`}
const fmtDur=tr=>{const n=Math.round((parseD(tr.end)-parseD(tr.start))/864e5);return n?`${n}박 ${n+1}일`:'당일'};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ICON_IMG='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>';
const ICON_NEXT='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>';
document.querySelectorAll('.dh').forEach(e=>e.insertAdjacentHTML('afterbegin',ICON_IMG));
function fitTitle(){sheetTitle.style.fontSize='';let f=18;while(sheetTitle.scrollWidth>sheetTitle.clientWidth&&f>11){f-=.5;sheetTitle.style.fontSize=f+'px'}}   // 제목이 한 줄에 안 들어가면 글자를 줄임
function fitDates(){tripList.querySelectorAll('.dt').forEach(e=>{let f=15;e.style.fontSize='';while(e.scrollWidth>e.clientWidth&&f>12.5){f-=.5;e.style.fontSize=f+'px'}})}   // 한 줄에 안 들어가면 글자를 살짝 줄임

/* ---------- 상태 / 이미지 주소 관리 ---------- */
let view='list',cols=3,curTrips=[],curTrip=null,curPhotos=[],listTitle='',listSub='',formFrom='list',fKind='trip';
let listUrls=[],galUrls=[],loadTok=0,galTok=0;
const mkUrl=(b,arr)=>{const u=URL.createObjectURL(b);arr.push(u);return u};
const dropUrls=a=>setTimeout(()=>a.forEach(u=>URL.revokeObjectURL(u)),800);   // 화면에서 사라진 뒤 메모리 해제
const sortTrips=()=>curTrips.sort((a,b)=>b.start.localeCompare(a.start)||b.id.localeCompare(a.id));

/* ---------- 여행 리스트 ---------- */
const subOf=()=>curTrips.length?`${curTrips.length}번의 여행`:'';
const ICON_MORE='<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>';
const itemHTML=(t,i)=>`<div class="item" data-id="${t.id}" style="--i:${i}"><button class="ib" type="button"><span class="thumb"${t.cover?` style="background:url('${t.cover}') center/cover no-repeat"`:''}>${t.cover?'':ICON_IMG}</span><span class="txt"><span class="dt">${fmtRange(t)}</span><span class="dur">${fmtDur(t)}</span><span class="sm">${esc(t.sm)}</span></span></button><div class="rc"><button class="more" type="button" aria-label="더보기">${ICON_MORE}</button><span class="sc">${t.n}장</span></div></div>`;
function renderList(newId){
  tripList.innerHTML=curTrips.length?'<button class="allbtn" type="button" style="--i:0">전체 보기</button>'+curTrips.map((x,i)=>itemHTML(x,i+1)).join(''):'<div class="empty"><b>아직 기록이 없어요</b>＋ 기록 추가로 첫 여행을 남겨보세요</div>';
  if(newId){const n=tripList.querySelector(`[data-id="${newId}"]`);n&&n.classList.add('new')}
  fitDates();
}
function updateItem(tr){   // 사진을 추가했을 때 리스트의 장수·썸네일만 갱신
  const b=tripList.querySelector(`[data-id="${tr.id}"]`);if(!b)return;
  b.querySelector('.sc').textContent=tr.n+'장';
  const th=b.querySelector('.thumb');if(tr.cover){th.style.background=`url('${tr.cover}') center/cover no-repeat`;th.innerHTML=''}else{th.style.background='';th.innerHTML=ICON_IMG}
}
async function loadTrips(key){   // 저장된 여행 + 사진 장수 + 대표 이미지
  const st=await ready,rows=await st.byIndex('trips','region',key);
  const out=await Promise.all(rows.map(async r=>{
    const ps=await st.byIndex('photos','trip',r.id);
    const cover=r.coverBlob?mkUrl(r.coverBlob,listUrls):(ps.length?mkUrl(ps[0].thumb,listUrls):null);
    return{id:r.id,start:r.start,end:r.end,sm:r.sm,cover,own:!!r.coverBlob,n:ps.length};
  }));
  return out;
}
async function renderTrips(c,el){   // 시를 선택했을 때
  const tok=++loadTok;galTok++;
  dropUrls(listUrls.splice(0));dropUrls(galUrls.splice(0));
  curTrips=[];curTrip=null;curPhotos=[];listTitle=c[0]+' 여행 기록';listSub='';
  view='list';sheet.classList.remove('gal','frm');addBtn.textContent='＋ 기록 추가';addBtn.hidden=false;
  setNow(sheetTitle,listTitle);setNow(sheetSub,'');fitTitle();
  sheet.style.setProperty('--pc',el.style.getPropertyValue('--pc'));      // 도 색상을 시트에도 적용
  tripList.classList.remove('re');tripList.innerHTML='';sbody.scrollTop=0;
  try{
    const trips=await loadTrips(c[5]);if(tok!==loadTok)return;
    curTrips=trips;sortTrips();listSub=subOf();
    if(view==='list')setNow(sheetSub,listSub);
    renderList();
  }catch(e){if(tok===loadTok)toast('기록을 불러오지 못했어요')}
}

/* ---------- 갤러리 (여행 선택 → 사진 그리드) ---------- */
const ggrid=document.getElementById('ggrid'),gbody=document.getElementById('gbody'),seg=document.getElementById('seg'),addBtn=document.getElementById('addBtn');
const setNow=(el,txt)=>{clearTimeout(el._t);el.classList.remove('out');el.textContent=txt;el._s=txt};
const gridIcon=n=>{const c=(16-(n-1))/n;let r='';for(let y=0;y<n;y++)for(let x=0;x<n;x++)r+=`<rect x="${(x*(c+1)).toFixed(2)}" y="${(y*(c+1)).toFixed(2)}" width="${c.toFixed(2)}" height="${c.toFixed(2)}" rx=".7"/>`;return`<svg viewBox="0 0 16 16" fill="currentColor">${r}</svg>`};
seg.querySelector('[data-c="3"]').innerHTML=gridIcon(3);seg.querySelector('[data-c="5"]').innerHTML=gridIcon(5);
function applyCols(){ggrid.style.setProperty('--cols',cols);ggrid.classList.toggle('c5',cols===5);seg.classList.toggle('five',cols===5);seg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',+b.dataset.c===cols))}
function flipTiles(els,first){   // 각 사진이 이전 자리에서 새 자리로 부드럽게 이동 (FLIP)
  if(reduce)return;
  els.forEach((e,i)=>{
    const l=e.getBoundingClientRect(),f=first[i];if(!l.width)return;
    const dx=f.left-l.left,dy=f.top-l.top,s=f.width/l.width;if(!dx&&!dy&&s===1)return;
    e.animate([{transformOrigin:'0 0',transform:`translate(${dx}px,${dy}px) scale(${s})`},{transformOrigin:'0 0',transform:'none'}],{duration:520,easing:'cubic-bezier(.22,1,.36,1)'});
  });
}
function setCols(n){   // 열 수 변경
  if(n===cols)return;
  const tiles=[...ggrid.querySelectorAll('.ph')],first=tiles.map(e=>e.getBoundingClientRect());
  cols=n;applyCols();flipTiles(tiles,first);
}
const tileHTML=(p,k,extra='')=>`<div class="ph${extra}" data-id="${p.id}" data-cap="${esc(p.cap)}" style="--i:${k};background:url('${p.url}') center/cover no-repeat"></div>`;
const GEMPTY_ALL='<div class="empty gempty"><b>아직 사진이 없어요</b>여행을 열어서 사진을 추가해 보세요</div>';
const GEMPTY='<div class="empty gempty"><b>아직 사진이 없어요</b>＋ 사진 추가로 첫 사진을 남겨보세요</div>';
function restoreHeader(){
  if(view==='gallery'){swap(sheetTitle,curTrip.all?'전체 보기':fmtRange(curTrip),fitTitle);swap(sheetSub,`사진 ${curTrip.n}장`);addBtn.textContent='＋ 사진 추가';addBtn.hidden=!!curTrip.all}   // 전체 보기에서는 사진을 추가할 여행이 없으므로 버튼을 숨김
  else{swap(sheetTitle,listTitle,fitTitle);swap(sheetSub,listSub);addBtn.textContent='＋ 기록 추가';addBtn.hidden=false}
}
async function openTrip(id){
  const tr=curTrips.find(t=>t.id===id);if(!tr||view!=='list')return;
  const tok=++galTok;dropUrls(galUrls.splice(0));
  curTrip=tr;curPhotos=[];ggrid.innerHTML='';applyCols();gbody.scrollTop=0;view='gallery';restoreHeader();
  sheet.classList.add('gal');setBack();
  try{
    const st=await ready,rows=await st.byIndex('photos','trip',tr.id);if(tok!==galTok)return;
    curPhotos=rows.map(r=>({id:r.id,cap:r.cap,trip:r.trip,thumb:r.thumb,url:mkUrl(r.thumb,galUrls)}));
    tr.n=curPhotos.length;
    ggrid.innerHTML=curPhotos.length?curPhotos.map((p,k)=>tileHTML(p,k)).join(''):GEMPTY;
    if(view==='gallery')setNow(sheetSub,`사진 ${tr.n}장`);
  }catch(e){if(tok===galTok)toast('사진을 불러오지 못했어요')}
}
async function openAll(){   // 이 시의 모든 여행의 모든 사진
  if(view!=='list'||!curTrips.length)return;
  const tok=++galTok;dropUrls(galUrls.splice(0));
  curTrip={id:'__all',all:true,n:0};curPhotos=[];ggrid.innerHTML='';applyCols();gbody.scrollTop=0;view='gallery';restoreHeader();
  sheet.classList.add('gal');setBack();
  try{
    const st=await ready,lists=await Promise.all(curTrips.map(t=>st.byIndex('photos','trip',t.id)));if(tok!==galTok)return;
    curPhotos=lists.flat().map(r=>({id:r.id,cap:r.cap,trip:r.trip,thumb:r.thumb,url:mkUrl(r.thumb,galUrls)}));   // 여행 목록 순서(최근 여행부터)
    curTrip.n=curPhotos.length;
    ggrid.innerHTML=curPhotos.length?curPhotos.map((p,k)=>tileHTML(p,k)).join(''):GEMPTY_ALL;
    if(view==='gallery')setNow(sheetSub,`사진 ${curTrip.n}장`);
  }catch(e){if(tok===galTok)toast('사진을 불러오지 못했어요')}
}
function closeGallery(){
  if(view!=='gallery')return;view='list';galTok++;sheet.classList.remove('gal');restoreHeader();setBack();
  dropUrls(galUrls.splice(0));
}
tripList.addEventListener('click',e=>{
  const m=e.target.closest('.more');if(m){e.stopPropagation();(menuOpen&&menuBtn===m)?closeMenu():openMenu(m);return}   // 같은 ⋯를 다시 누르면 닫힘
  if(e.target.closest('.allbtn')){openAll();return}
  const b=e.target.closest('.ib,.sc');if(b)openTrip(b.closest('.item').dataset.id);
});
seg.addEventListener('click',e=>{const b=e.target.closest('button');if(b)setCols(+b.dataset.c)});

/* ---------- 추가 폼 (기록 추가 / 사진 추가) ---------- */
const $=id=>document.getElementById(id);
const fTrip=$('fTrip'),fPhoto=$('fPhoto'),fbody=$('fbody'),saveBtn=$('saveBtn'),dStart=$('dStart'),dEnd=$('dEnd'),tSum=$('tSum'),tCount=$('tCount'),pCap=$('pCap'),pCount=$('pCount'),dropCover=$('dropCover'),dropPhoto=$('dropPhoto'),fileCover=$('fileCover'),filePhoto=$('filePhoto');
let pending=null,saving=false,editId=null;   // editId: 수정 중인 여행 id (없으면 새 기록)                          // pending: 방금 고른 사진 {url, blob}
async function resize(file,max,q){   // 긴 변을 max px로 줄여 JPEG로 변환
  const bmp=await createImageBitmap(file),k=Math.min(1,max/Math.max(bmp.width,bmp.height)),c=document.createElement('canvas');
  c.width=Math.round(bmp.width*k);c.height=Math.round(bmp.height*k);c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
  return new Promise(r=>c.toBlob(r,'image/jpeg',q));
}
async function shrink(file){   // 원본(수 MB) → 긴 변 1600px 본 사진
  try{const blob=await resize(file,1600,.82);return{url:URL.createObjectURL(blob),blob}}
  catch(e){return{url:URL.createObjectURL(file),blob:file}}
}
const makeThumb=async blob=>{try{return await resize(blob,480,.8)}catch(e){return blob}};   // 그리드용 작은 사진
const dropReset=d=>{d.style.backgroundImage='';d.classList.remove('has')};
const dropSet=(d,p)=>{d.style.backgroundImage=`url('${p.url}')`;d.classList.add('has')};
const freePending=()=>{if(pending){URL.revokeObjectURL(pending.url);pending=null}};
function validate(){
  const ok=fKind==='trip'?(dStart.value&&dEnd.value&&dEnd.value>=dStart.value&&tSum.value.trim()):(pending&&pCap.value.trim());
  saveBtn.disabled=!ok;
}
async function pickFile(inp,drop){
  const f=inp.files[0];inp.value='';if(!f)return;
  drop.classList.add('busy');const r=await shrink(f);drop.classList.remove('busy');
  freePending();pending=r;dropSet(drop,r);validate();
}
function openForm(editTr){
  if(view!=='list'&&view!=='gallery')return;
  if(view==='gallery'&&curTrip.all)return;
  fKind=view==='list'?'trip':'photo';formFrom=view;view='form';freePending();
  [dStart,dEnd,tSum,pCap].forEach(i=>i.value='');dEnd.min='';tCount.textContent='0/60';pCount.textContent='0/40';dropReset(dropCover);dropReset(dropPhoto);
  editId=editTr&&fKind==='trip'?editTr.id:null;
  if(editId){   // 수정: 기존 내용을 채워서 열기
    dStart.value=editTr.start;dEnd.value=editTr.end;dEnd.min=editTr.start;tSum.value=editTr.sm;tCount.textContent=editTr.sm.length+'/60';
    if(editTr.own&&editTr.cover)dropSet(dropCover,{url:editTr.cover});   // 직접 고른 대표 이미지만 미리 보여 줌
  }
  fTrip.hidden=fKind!=='trip';fPhoto.hidden=fKind!=='photo';fbody.scrollTop=0;
  swap(sheetTitle,fKind==='trip'?(editId?'기록 수정':'기록 추가'):'사진 추가',fitTitle);swap(sheetSub,fKind==='trip'?selC[0]:fmtRange(curTrip));
  validate();sheet.classList.add('frm');setBack();
}
function closeForm(){
  if(view!=='form')return;view=formFrom;freePending();sheet.classList.remove('frm');restoreHeader();setBack();
}
async function saveTrip(){
  const st=await ready,blob=pending?pending.blob:null;
  const rec={id:genId('t'),region:selC[5],start:dStart.value,end:dEnd.value,sm:tSum.value.trim(),coverBlob:blob,created:Date.now()};
  await st.put('trips',rec);visited.add(selC[5]);paintRegion(sel);                            // ← 저장
  const cover=pending?pending.url:null;if(cover)listUrls.push(cover);pending=null;
  curTrips.push({id:rec.id,start:rec.start,end:rec.end,sm:rec.sm,cover,own:!!blob,n:0});sortTrips();
  listSub=subOf();view='list';sheet.classList.remove('frm');
  tripList.classList.add('re');renderList(rec.id);restoreHeader();setBack();
  setTimeout(()=>{const n=tripList.querySelector('.new');if(n)sbody.scrollBy({top:n.getBoundingClientRect().top-sbody.getBoundingClientRect().top-12,behavior:'smooth'})},450);
}
async function saveTripEdit(){
  const st=await ready,tr=curTrips.find(x=>x.id===editId),rec=await st.get('trips',editId);
  if(!tr||!rec)throw new Error('missing');
  rec.start=dStart.value;rec.end=dEnd.value;rec.sm=tSum.value.trim();
  if(pending)rec.coverBlob=pending.blob;                          // 새 사진을 고른 경우에만 대표 이미지 교체
  await st.put('trips',rec);                                       // ← 저장
  tr.start=rec.start;tr.end=rec.end;tr.sm=rec.sm;
  if(pending){tr.cover=pending.url;tr.own=true;listUrls.push(pending.url);pending=null}
  sortTrips();listSub=subOf();view='list';sheet.classList.remove('frm');editId=null;
  tripList.classList.add('re');renderList(rec.id);restoreHeader();setBack();toast('수정했어요');
  setTimeout(()=>{const n=tripList.querySelector('.new');if(n)sbody.scrollBy({top:n.getBoundingClientRect().top-sbody.getBoundingClientRect().top-12,behavior:'smooth'})},450);
}
async function savePhoto(){
  const st=await ready,tr=curTrip,cap=pCap.value.trim(),thumb=await makeThumb(pending.blob);
  const rec={id:genId('p'),trip:tr.id,cap,blob:pending.blob,thumb,created:Date.now()};
  await st.put('photos',rec);                           // ← 저장 (본 사진 + 작은 사진)
  freePending();
  const p={id:rec.id,cap,trip:tr.id,thumb,url:mkUrl(thumb,galUrls)};curPhotos.push(p);tr.n++;
  if(!tr.own&&!tr.cover)tr.cover=mkUrl(thumb,listUrls);
  const g=ggrid.querySelector('.gempty');if(g)g.remove();
  ggrid.insertAdjacentHTML('beforeend',tileHTML(p,curPhotos.length-1,' add'));
  view='gallery';sheet.classList.remove('frm');restoreHeader();updateItem(tr);setBack();
  setTimeout(()=>gbody.scrollTo({top:gbody.scrollHeight,behavior:'smooth'}),400);
}
async function save(){
  if(saveBtn.disabled||view!=='form'||saving)return;
  saving=true;saveBtn.disabled=true;saveBtn.textContent='저장 중…';
  try{await(fKind==='trip'?(editId?saveTripEdit():saveTrip()):savePhoto())}
  catch(e){toast('저장하지 못했어요. 저장 공간을 확인해 주세요.');saveBtn.disabled=false}
  saving=false;saveBtn.textContent='저장';
}
addBtn.addEventListener('click',()=>openForm());
saveBtn.addEventListener('click',save);
dropCover.addEventListener('click',()=>fileCover.click());dropPhoto.addEventListener('click',()=>filePhoto.click());
fileCover.addEventListener('change',()=>pickFile(fileCover,dropCover));filePhoto.addEventListener('change',()=>pickFile(filePhoto,dropPhoto));
dStart.addEventListener('change',()=>{dEnd.min=dStart.value;if(dStart.value&&(!dEnd.value||dEnd.value<dStart.value))dEnd.value=dStart.value;validate()});
dEnd.addEventListener('change',validate);
tSum.addEventListener('input',()=>{tCount.textContent=tSum.value.length+'/60';validate()});
pCap.addEventListener('input',()=>{pCount.textContent=pCap.value.length+'/40';validate()});
[tSum,pCap].forEach(i=>i.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();save()}}));
$('sback').addEventListener('click',()=>view==='form'?closeForm():closeGallery());

/* ---------- 사진 크게 보기 (확대 + 배경 블러) ---------- */
const viewer=document.getElementById('viewer'),vcap=document.getElementById('vcap');
const SH0='0 0 0 rgba(0,0,0,0)',SH1='0 24px 60px rgba(0,0,0,.5)',EASE='cubic-bezier(.22,1,.36,1)';
let vState='idle',vTile=null,vPh=null,vFull=null,vReady=0;
async function loadFull(tile,ph){   // 확대되는 동안 본 사진을 불러와서 교체 (처음엔 작은 사진)
  const id=tile.dataset.id;if(!id)return;
  try{
    const st=await ready,rec=await st.get('photos',id);if(!rec||vPh!==ph)return;
    const u=URL.createObjectURL(rec.blob),im=new Image();im.src=u;try{await im.decode()}catch(e){}
    if(vPh!==ph){URL.revokeObjectURL(u);return}
    ph.style.background=`url('${u}') center/cover no-repeat`;vFull=u;
  }catch(e){}
}
const frame=(r,rad,sh)=>({left:r.left+'px',top:r.top+'px',width:r.width+'px',height:r.height+'px',borderRadius:rad,boxShadow:sh});
function openViewer(tile){
  if(vState!=='idle')return;vState='open';vTile=tile;
  const r=tile.getBoundingClientRect(),W=innerWidth,H=innerHeight,rad0=getComputedStyle(tile).borderRadius;
  const size=Math.round(Math.min(W-32,560,H*.6)),left=(W-size)/2,top=Math.max(16,(H-size-64)/2);   // 사진+문구를 화면 가운데에
  vPh=document.createElement('div');vPh.className='ph vph';vPh.style.background=tile.style.background;vPh.innerHTML=tile.innerHTML;
  Object.assign(vPh.style,{left:left+'px',top:top+'px',width:size+'px',height:size+'px',borderRadius:'0px',boxShadow:SH1});   // 큰 사진은 모서리 각지게
  viewer.appendChild(vPh);
  vcap.textContent=tile.dataset.cap;Object.assign(vcap.style,{left:left+'px',top:(top+size+16)+'px',width:size+'px'});
  tile.style.visibility='hidden';viewer.classList.add('show');vReady=performance.now()+(reduce?0:450);
  vPh.animate([frame(r,rad0,SH0),frame({left,top,width:size,height:size},'0px',SH1)],{duration:reduce?0:560,easing:EASE});
  loadFull(tile,vPh);
}
function closeViewer(instant){
  if(instant&&vState==='nav'&&vFinish)vFinish();
  if(vState!=='open')return;vState='closing';
  const tile=vTile,ph=vPh,from=ph.getBoundingClientRect();
  viewer.classList.remove('show');
  const done=()=>{ph.remove();tile.style.visibility='';vPh=vTile=null;vState='idle';if(vFull){URL.revokeObjectURL(vFull);vFull=null}};
  if(instant||reduce){done();return}
  const r=tile.getBoundingClientRect(),rad=getComputedStyle(tile).borderRadius;
  ph.animate([frame(from,'0px',SH1),frame(r,rad,SH0)],{duration:460,easing:EASE,fill:'forwards'}).onfinish=done;
}
ggrid.addEventListener('click',e=>{const p=e.target.closest('.ph');if(p)openViewer(p)});
viewer.addEventListener('click',()=>{if(vDragged){vDragged=false;return}closeViewer()});

/* ---------- 사진 좌우로 넘기기 (스와이프 / 마우스 드래그 / 가로 스크롤 / 방향키) ---------- */
let vDrag=null,vNbr=null,vNbrDir=0,vDragged=false,vFinish=null,vD=0,wheelLock=0;
const tilesNow=()=>[...ggrid.querySelectorAll('.ph[data-id]')];
function mkNbr(dir){   // dir: +1 다음 사진, -1 이전 사진
  vNbrDir=dir;
  const ts=tilesNow(),t=ts[ts.indexOf(vTile)+dir];if(!t)return false;
  const ph=document.createElement('div');ph.className='ph vph';ph.style.background=t.style.background;ph.innerHTML=t.innerHTML;
  Object.assign(ph.style,{left:vPh.style.left,top:vPh.style.top,width:vPh.style.width,height:vPh.style.height,borderRadius:'0px',boxShadow:SH1,opacity:0});
  viewer.appendChild(ph);
  const cap=document.createElement('p');cap.className='vcap2';cap.textContent=t.dataset.cap;
  Object.assign(cap.style,{left:vcap.style.left,top:vcap.style.top,width:vcap.style.width});
  viewer.appendChild(cap);
  t.style.visibility='hidden';vNbr={ph,cap,tile:t};return true;
}
function dropNbr(){if(vNbr){vNbr.ph.remove();vNbr.cap.remove();vNbr.tile.style.visibility='';vNbr=null}vNbrDir=0}
function setPos(dx){
  const dir=dx<0?1:-1;
  if(vNbrDir!==dir){dropNbr();mkNbr(dir)}
  const has=!!vNbr,x=has?dx:dx*.3,t=has?Math.min(1,Math.abs(dx)/vD):0;
  vPh.style.transform=`translateX(${x}px)`;vPh.style.opacity=1-t;
  vcap.style.transform=`translateX(${x}px)`;vcap.style.opacity=1-t;
  if(has){const nx=x+dir*vD;
    vNbr.ph.style.transform=`translateX(${nx}px)`;vNbr.ph.style.opacity=t;
    vNbr.cap.style.transform=`translateX(${nx}px)`;vNbr.cap.style.opacity=t}
}
const slide=(el,x0,o0,x1,o1,d)=>{
  el.style.transform=`translateX(${x1}px)`;el.style.opacity=o1;
  return el.animate([{transform:`translateX(${x0}px)`,opacity:o0},{transform:`translateX(${x1}px)`,opacity:o1}],{duration:d,easing:EASE});
};
function keepVisible(tile){   // 넘긴 사진이 갤러리에서 화면 밖이면, 닫을 때 자리를 찾아갈 수 있도록 스크롤
  const g=gbody.getBoundingClientRect(),r=tile.getBoundingClientRect();
  if(r.top<g.top+8||r.bottom>g.bottom-8)gbody.scrollTop+=(r.top+r.height/2)-(g.top+g.height/2);
}
function settle(commit,dx){
  const dir=vNbrDir,has=!!vNbr,x0=has?dx:dx*.3,t0=has?Math.min(1,Math.abs(dx)/vD):0,d=reduce?0:360;
  const xc=commit?-dir*vD:0,oc=commit?0:1;
  vState='nav';vcap.style.transition='none';
  const anims=[slide(vPh,x0,1-t0,xc,oc,d),slide(vcap,x0,1-t0,xc,oc,d)];
  if(has){anims.push(slide(vNbr.ph,x0+dir*vD,t0,commit?0:dir*vD,commit?1:0,d),slide(vNbr.cap,x0+dir*vD,t0,commit?0:dir*vD,commit?1:0,d))}
  const fin=()=>{
    if(vFinish!==fin)return;vFinish=null;
    if(commit&&has){
      vPh.remove();vTile.style.visibility='';
      vPh=vNbr.ph;vTile=vNbr.tile;vNbr.cap.remove();vNbr=null;vNbrDir=0;
      vcap.textContent=vTile.dataset.cap;
      if(vFull){URL.revokeObjectURL(vFull);vFull=null}
      loadFull(vTile,vPh);keepVisible(vTile);
    }else dropNbr();
    vPh.style.transform='';vPh.style.opacity='';
    vcap.style.transform='';vcap.style.opacity='';void vcap.offsetWidth;vcap.style.transition='';
    vState='open';
  };
  vFinish=fin;
  Promise.allSettled(anims.map(a=>a.finished)).then(fin);
}
function goPhoto(dir){   // 방향키 / 가로 스크롤로 넘기기
  if(vState!=='open'||vDrag)return;
  vD=parseFloat(vPh.style.width)+32;
  if(!mkNbr(dir)){vNbrDir=0;return}
  settle(true,0);
}
viewer.addEventListener('pointerdown',e=>{
  if(vState!=='open'||vDrag||e.button>0||e.target.closest('#vdel')||performance.now()<vReady)return;
  vDragged=false;vD=parseFloat(vPh.style.width)+32;
  vDrag={id:e.pointerId,x:e.clientX,lx:e.clientX,lt:performance.now(),vx:0,dx:0,on:false};
});
viewer.addEventListener('pointermove',e=>{
  if(!vDrag||e.pointerId!==vDrag.id||vState!=='open')return;
  const dx=e.clientX-vDrag.x;
  if(!vDrag.on){
    if(Math.abs(dx)<8)return;
    vDrag.on=true;vDragged=true;vcap.style.transition='none';
    try{viewer.setPointerCapture(e.pointerId)}catch(_){}
  }
  const now=performance.now();if(now>vDrag.lt){vDrag.vx=(e.clientX-vDrag.lx)/(now-vDrag.lt);vDrag.lx=e.clientX;vDrag.lt=now}
  vDrag.dx=dx;setPos(dx);
});
const endDrag=(e,cancel)=>{
  if(!vDrag||e.pointerId!==vDrag.id)return;
  const d=vDrag;vDrag=null;if(!d.on)return;
  const flick=Math.abs(d.vx)>.4&&Math.sign(d.vx)===Math.sign(d.dx)&&Math.abs(d.dx)>16;
  settle(!cancel&&!!vNbr&&(Math.abs(d.dx)>(vD-32)*.22||flick),d.dx);
};
viewer.addEventListener('pointerup',e=>endDrag(e,false));
viewer.addEventListener('pointercancel',e=>endDrag(e,true));
viewer.addEventListener('wheel',e=>{
  if(Math.abs(e.deltaX)<=Math.abs(e.deltaY)||Math.abs(e.deltaX)<12)return;
  e.preventDefault();
  const now=performance.now(),locked=now<wheelLock;wheelLock=now+160;   // 관성 스크롤은 한 번만 반응
  if(!locked)goPhoto(e.deltaX>0?1:-1);
},{passive:false});
addEventListener('keydown',e=>{
  if((e.key==='ArrowLeft'||e.key==='ArrowRight')&&vState==='open'&&!dlgCancel){e.preventDefault();goPhoto(e.key==='ArrowRight'?1:-1)}
});

/* ---------- 삭제 (모두 확인 창을 거친 뒤 바로 삭제) ---------- */
let dlgCancel=null,menuOpen=false,menuId=null,menuBtn=null;
const menuEl=$('menu'),dlg=$('dlg');
// 확인 창
function confirmDialog(title,msg,ok='삭제',danger=true){
  return new Promise(res=>{
    $('dTitle').textContent=title;$('dMsg').textContent=msg;$('dYes').textContent=ok;$('dYes').classList.toggle('danger',danger);$('dYes').classList.toggle('ok',!danger);dlg.classList.add('show');
    const done=v=>{dlg.classList.remove('show');dlgCancel=null;$('dYes').onclick=$('dNo').onclick=null;res(v)};
    dlgCancel=()=>done(false);$('dYes').onclick=()=>done(true);$('dNo').onclick=()=>done(false);   // 바깥 영역을 눌러도 닫히지 않음
  });
}
// 여행 ⋯ 메뉴
function openMenu(btn){
  const r=btn.getBoundingClientRect();menuId=btn.closest('.item').dataset.id;menuBtn=btn;
  menuEl.style.left='auto';menuEl.style.right=Math.max(8,innerWidth-r.right)+'px';
  if(r.bottom+130>innerHeight){menuEl.style.top='auto';menuEl.style.bottom=(innerHeight-r.top+6)+'px';menuEl.style.transformOrigin='bottom right'}
  else{menuEl.style.bottom='auto';menuEl.style.top=(r.bottom+6)+'px';menuEl.style.transformOrigin='top right'}
  menuEl.classList.add('show');menuOpen=true;
}
function closeMenu(){menuEl.classList.remove('show');menuOpen=false;menuBtn=null}
menuEl.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(!b)return;const id=menuId;closeMenu();b.dataset.act==='del'?deleteTrip(id):editTrip(id)});
function editTrip(id){const tr=curTrips.find(x=>x.id===id);if(tr)openForm(tr)}   // 기록 추가 창을 '수정' 모드로 열기
document.addEventListener('click',e=>{if(menuOpen&&!e.target.closest('#menu'))closeMenu()});
sbody.addEventListener('scroll',()=>{if(menuOpen)closeMenu()});
async function deleteTrip(id){
  const tr=curTrips.find(x=>x.id===id);if(!tr)return;
  const ok=await confirmDialog('이 여행 기록을 삭제할까요?',tr.n?`사진 ${tr.n}장도 함께 삭제되며 되돌릴 수 없어요.`:'삭제하면 되돌릴 수 없어요.');
  if(!ok)return;
  try{const st=await ready,ps=await st.byIndex('photos','trip',id);await st.delMany('photos',ps.map(p=>p.id));await st.delMany('trips',[id])}
  catch(e){toast('삭제하지 못했어요');return}
  curTrips=curTrips.filter(x=>x.id!==id);listSub=subOf();swap(sheetSub,listSub);
  if(!curTrips.length){visited.delete(selC[5]);paintRegion(sel)}
  const el=tripList.querySelector(`[data-id="${id}"]`);
  if(!el||reduce){renderList();return}
  const cs=getComputedStyle(el),h=cs.height,pt=cs.paddingTop,pb=cs.paddingBottom;el.style.overflow='hidden';
  el.animate([{height:h,opacity:1,marginBottom:'0px',paddingTop:pt,paddingBottom:pb},{height:'0px',opacity:0,marginBottom:'-10px',paddingTop:'0px',paddingBottom:'0px'}],{duration:400,easing:'cubic-bezier(.22,1,.36,1)',fill:'forwards'})
    .onfinish=()=>{el.remove();if(!curTrips.length)renderList()};
}
// 사진 삭제: 확대 보기의 휴지통 → 확인 창 → 삭제
const refreshCover=tr=>{if(!tr.own)tr.cover=curPhotos.length?mkUrl(curPhotos[0].thumb,listUrls):null};
function removePhotosUI(ids){   // 화면 정리: 사진이 사라지고 나머지가 빈자리를 메움
  const gone=curPhotos.filter(p=>ids.includes(p.id));if(!curTrip||!gone.length)return;
  curPhotos=curPhotos.filter(p=>!ids.includes(p.id));
  const affected=curTrip.all?[...new Set(gone.map(p=>p.trip))].map(id=>curTrips.find(x=>x.id===id)).filter(Boolean):[curTrip];
  affected.forEach(tr=>{   // 여행별 사진 수·대표 이미지 갱신
    const mine=curPhotos.filter(p=>p.trip===tr.id);tr.n=mine.length;
    if(!tr.own)tr.cover=mine.length?mkUrl(mine[0].thumb,listUrls):null;
    updateItem(tr);
  });
  if(curTrip.all)curTrip.n=curPhotos.length;
  const els=gone.map(p=>ggrid.querySelector(`[data-id="${p.id}"]`)).filter(Boolean);
  els.forEach(e=>e.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.7)'}],{duration:240,easing:'ease',fill:'forwards'}));
  setTimeout(()=>{
    const keep=[...ggrid.querySelectorAll('.ph')].filter(e=>!els.includes(e)),first=keep.map(e=>e.getBoundingClientRect());
    els.forEach(e=>e.remove());
    if(!curPhotos.length)ggrid.innerHTML=curTrip.all?GEMPTY_ALL:GEMPTY;else flipTiles(keep,first);
  },250);
  swap(sheetSub,`사진 ${curTrip.n}장`);
}
$('vdel').addEventListener('click',e=>{e.stopPropagation();viewerDelete()});
async function viewerDelete(){
  if(vState!=='open'||dlgCancel)return;
  const ok=await confirmDialog('이 사진을 삭제할까요?','삭제하면 되돌릴 수 없어요.');
  if(!ok||vState!=='open')return;
  const tile=vTile,ph=vPh,id=tile.dataset.id;
  try{const st=await ready;await st.delMany('photos',[id])}catch(e){toast('삭제하지 못했어요');return}
  vState='closing';viewer.classList.remove('show');
  const fin=()=>{ph.remove();tile.style.visibility='';vPh=vTile=null;vState='idle';if(vFull){URL.revokeObjectURL(vFull);vFull=null}removePhotosUI([id])};
  if(reduce){fin();return}
  ph.animate([{opacity:1,transform:'scale(1)'},{opacity:0,transform:'scale(.85)'}],{duration:260,easing:'ease',fill:'forwards'}).onfinish=fin;
}

/* ---------- 설정 / 백업 ---------- */
const settings=$('settings'),gear=$('gear'),prog=$('prog'),fileImp=$('fileImp');
let settingsOpen=false,jobCancel=false,busy=false;
const LAST='ks_last_backup';
const lastBackup=()=>{try{return+localStorage.getItem(LAST)||0}catch(e){return 0}};
const ago=t=>{if(!t)return'백업한 적이 없어요';const d=Math.floor((Date.now()-t)/864e5);return d<1?'오늘':d===1?'어제':`${d}일 전`};
const fmtSize=b=>b<1048576?Math.max(1,Math.round(b/1024))+'KB':(b/1048576).toFixed(b<1e8?1:0)+'MB';
async function stats(){
  const st=await ready,tr=await st.all('trips'),ph=await st.all('photos');let b=0;
  ph.forEach(p=>{b+=(p.blob?p.blob.size:0)+(p.thumb?p.thumb.size:0)});tr.forEach(x=>{b+=x.coverBlob?x.coverBlob.size:0});
  return{t:tr.length,p:ph.length,b};
}
async function refreshGear(){try{const s=await stats();gear.classList.toggle('dot',s.t>0&&Date.now()-lastBackup()>30*864e5)}catch(e){}}   // 30일 넘게 백업 안 했으면 점 표시
ready.then(refreshGear);
const markBackup=()=>{try{localStorage.setItem(LAST,String(Date.now()))}catch(e){}refreshGear()};
async function openSettings(){
  settings.classList.add('show');settingsOpen=true;
  try{const s=await stats();$('setInfo').textContent=`저장된 기록 · 여행 ${s.t}개 · 사진 ${s.p}장 (${fmtSize(s.b)})\n마지막 백업 · ${ago(lastBackup())}`}catch(e){}
}
function closeSettings(){settings.classList.remove('show');settingsOpen=false}
gear.addEventListener('click',openSettings);$('setClose').addEventListener('click',closeSettings);
settings.addEventListener('click',e=>{if(e.target===settings)closeSettings()});

// 진행 / 결과 창
function progUI({title,msg='',pct=null,btns}){
  $('pgTitle').textContent=title;$('pgMsg').textContent=msg;
  const bar=$('pgBar');bar.parentNode.hidden=pct===null;bar.style.width=Math.round((pct||0)*100)+'%';
  if(btns){const box=$('pgBtns');box.innerHTML='';btns.forEach(b=>{const x=document.createElement('button');x.type='button';x.textContent=b.label;if(b.cls)x.className=b.cls;x.onclick=b.fn;box.append(x)})}
  prog.classList.add('show');
}
const progClose=()=>prog.classList.remove('show');
const cancelBtns=()=>[{label:'취소',fn:()=>{jobCancel=true}}];
const fail=e=>progUI({title:'작업에 실패했어요',msg:(e&&e.message)||'알 수 없는 오류예요',pct:null,btns:[{label:'닫기',cls:'ok',fn:progClose}]});

// zip 만들기 (압축 없이 묶기 — 사진은 이미 JPEG라 줄어들지 않음)
const CRCT=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(u8){let c=0xFFFFFFFF;for(let i=0;i<u8.length;i++)c=CRCT[(c^u8[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0}
async function makeZip(list,onProgress){
  if(list.length>65000)throw new Error('파일이 너무 많아서 한 번에 묶을 수 없어요');
  const enc=new TextEncoder(),parts=[],cen=[];let off=0;
  const d=new Date(),dosT=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),dosD=((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();
  for(let i=0;i<list.length;i++){
    const e=list[i],u8=e.bytes||new Uint8Array(await e.blob.arrayBuffer()),nb=enc.encode(e.name),crc=crc32(u8),h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,dosT,true);h.setUint16(12,dosD,true);
    h.setUint32(14,crc,true);h.setUint32(18,u8.length,true);h.setUint32(22,u8.length,true);h.setUint16(26,nb.length,true);h.setUint16(28,0,true);
    parts.push(h.buffer,nb,e.blob||u8);cen.push({nb,crc,size:u8.length,off});off+=30+nb.length+u8.length;
    if(off>3.8e9)throw new Error('백업 용량이 너무 커서 한 파일로 만들 수 없어요');
    if(i%3===0||i===list.length-1){onProgress(i+1,list.length);await new Promise(r=>setTimeout(r))}
  }
  let cdSize=0;const cdStart=off;
  for(const c of cen){
    const h=new DataView(new ArrayBuffer(46));
    h.setUint32(0,0x02014b50,true);h.setUint16(4,20,true);h.setUint16(6,20,true);h.setUint16(8,0x0800,true);h.setUint16(10,0,true);h.setUint16(12,dosT,true);h.setUint16(14,dosD,true);
    h.setUint32(16,c.crc,true);h.setUint32(20,c.size,true);h.setUint32(24,c.size,true);h.setUint16(28,c.nb.length,true);h.setUint32(42,c.off,true);
    parts.push(h.buffer,c.nb);cdSize+=46+c.nb.length;
  }
  const z=new DataView(new ArrayBuffer(22));
  z.setUint32(0,0x06054b50,true);z.setUint16(8,cen.length,true);z.setUint16(10,cen.length,true);z.setUint32(12,cdSize,true);z.setUint32(16,cdStart,true);parts.push(z.buffer);
  return new Blob(parts,{type:'application/zip'});
}
// zip 읽기 (압축 없는 파일 + 일반 압축 파일 모두)
async function readZip(file){
  const size=file.size;if(size<22)throw new Error('압축 파일이 아니에요');
  const n=Math.min(size,65557),tail=new DataView(await file.slice(size-n).arrayBuffer());let p=-1;
  for(let i=n-22;i>=0;i--)if(tail.getUint32(i,true)===0x06054b50){p=i;break}
  if(p<0)throw new Error('압축 파일이 아니에요');
  const count=tail.getUint16(p+10,true),cdSize=tail.getUint32(p+12,true),cdOff=tail.getUint32(p+16,true);
  if(cdOff===0xFFFFFFFF||count===0xFFFF)throw new Error('지원하지 않는 압축 형식이에요');
  if(count>70000||cdOff+cdSize>size)throw new Error('압축 파일이 손상되었어요');
  const cd=new DataView(await file.slice(cdOff,cdOff+cdSize).arrayBuffer()),dec=new TextDecoder(),map=new Map();let o=0;
  for(let i=0;i<count;i++){
    if(o+46>cd.byteLength||cd.getUint32(o,true)!==0x02014b50)throw new Error('압축 파일이 손상되었어요');
    const method=cd.getUint16(o+10,true),csize=cd.getUint32(o+20,true),nl=cd.getUint16(o+28,true),el=cd.getUint16(o+30,true),cl=cd.getUint16(o+32,true),off=cd.getUint32(o+42,true);
    map.set(dec.decode(new Uint8Array(cd.buffer,cd.byteOffset+o+46,nl)),{method,csize,off});o+=46+nl+el+cl;
  }
  return map;
}
async function zipEntry(file,e,type){   // 파일 하나를 Blob으로 꺼냄
  const lh=new DataView(await file.slice(e.off,e.off+30).arrayBuffer());
  if(lh.getUint32(0,true)!==0x04034b50)throw new Error('압축 파일이 손상되었어요');
  const start=e.off+30+lh.getUint16(26,true)+lh.getUint16(28,true),raw=file.slice(start,start+e.csize);
  if(e.method===0)return new Blob([raw],{type});
  if(e.method===8){
    if(typeof DecompressionStream==='undefined')throw new Error('이 브라우저에서는 압축된 백업 파일을 읽을 수 없어요');
    return new Blob([await new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob()],{type});
  }
  throw new Error('지원하지 않는 압축 방식이에요');
}
async function saveBlob(blob,name){   // 폰: 공유 창(파일에 저장 등) / PC: 바로 내려받기
  const file=new File([blob],name,{type:'application/zip'});
  if(matchMedia('(pointer:coarse)').matches&&navigator.canShare&&navigator.canShare({files:[file]})){
    try{await navigator.share({files:[file],title:name});return'shared'}catch(e){if(e&&e.name==='AbortError')return'cancel'}
  }
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),60000);return'download';
}

// ---- 내보내기 ----
async function doExport(){
  busy=true;jobCancel=false;
  try{
    progUI({title:'백업 파일 만드는 중…',msg:'기록을 모으는 중',pct:0,btns:cancelBtns()});
    const st=await ready,trips=await st.all('trips'),photos=await st.all('photos'),known=new Set(trips.map(t=>t.id)),ph=photos.filter(p=>known.has(p.trip));
    if(!trips.length)throw new Error('백업할 기록이 아직 없어요');
    const meta={app:'korea-scratch',version:1,exportedAt:new Date().toISOString(),
      trips:trips.map(t=>({id:t.id,region:t.region,start:t.start,end:t.end,sm:t.sm,created:t.created||0,cover:t.coverBlob?`covers/${t.id}.jpg`:null})),
      photos:ph.map(p=>({id:p.id,trip:p.trip,cap:p.cap,created:p.created||0,file:`photos/${p.id}.jpg`,thumb:`photos/${p.id}.thumb.jpg`}))};
    const list=[{name:'data.json',bytes:new TextEncoder().encode(JSON.stringify(meta))}];
    trips.forEach(t=>{if(t.coverBlob)list.push({name:`covers/${t.id}.jpg`,blob:t.coverBlob})});
    ph.forEach(p=>list.push({name:`photos/${p.id}.jpg`,blob:p.blob},{name:`photos/${p.id}.thumb.jpg`,blob:p.thumb||p.blob}));
    const blob=await makeZip(list,(i,n)=>{progUI({title:'백업 파일 만드는 중…',msg:`파일 묶는 중 ${i} / ${n}`,pct:i/n});if(jobCancel)throw{cancel:true}});
    const now=new Date(),name=`gaboda-${now.getFullYear()}-${pad2(now.getMonth()+1)}-${pad2(now.getDate())}.zip`;
    progUI({title:'백업 파일이 준비됐어요',msg:`${fmtSize(blob.size)} · 여행 ${trips.length}개 · 사진 ${ph.length}장`,pct:null,btns:[
      {label:'닫기',fn:progClose},
      {label:'저장하기',cls:'ok',fn:async()=>{
        const r=await saveBlob(blob,name);if(r==='cancel')return;markBackup();
        progUI({title:r==='shared'?'저장했어요':'내려받았어요',msg:name,pct:null,btns:[{label:'확인',cls:'ok',fn:progClose}]});
      }}]});
  }catch(e){if(e&&e.cancel)progClose();else fail(e)}
  busy=false;
}

// ---- 불러오기 (중복은 건너뛰고, 없는 것만 추가) ----
async function doImport(file){
  busy=true;jobCancel=false;
  try{
    progUI({title:'백업 파일 읽는 중…',msg:file.name,pct:null,btns:cancelBtns()});
    const entries=await readZip(file),jb=entries.get('data.json');
    if(!jb)throw new Error('이 앱의 백업 파일이 아니에요');
    let data;try{data=JSON.parse(await(await zipEntry(file,jb,'application/json')).text())}catch(e){throw new Error('백업 파일을 읽을 수 없어요')}
    if(!data||data.app!=='korea-scratch'||!Array.isArray(data.trips)||!Array.isArray(data.photos))throw new Error('이 앱의 백업 파일이 아니에요');
    if((data.version|0)>1)throw new Error('더 새로운 버전의 백업 파일이에요. 앱을 먼저 업데이트해 주세요.');
    const st=await ready,exT=await st.all('trips'),exP=await st.all('photos');
    const tripIds=new Set(exT.map(t=>t.id)),photoIds=new Set(exP.map(p=>p.id)),tk=t=>`${t.region}|${t.start}|${t.end}|${t.sm}`;
    const tripByKey=new Map(exT.map(t=>[tk(t),t.id])),photoKeys=new Set(exP.map(p=>`${p.trip}|${p.cap}|${p.blob?p.blob.size:0}`));
    const ID=/^[A-Za-z0-9]{1,64}$/,DATE=/^\d{4}-\d{2}-\d{2}$/,R={ta:0,ts:0,pa:0,ps:0,bad:0,unk:0},total=data.trips.length+data.photos.length;
    let done=0;const tick=()=>{progUI({title:'불러오는 중…',msg:`${done} / ${total}`,pct:total?done/total:1});if(jobCancel)throw{cancel:true}};
    const tmap=new Map(),newTrips=[];
    for(const t of data.trips){
      done++;
      if(!t||!ID.test(t.id||'')||typeof t.region!=='string'||!DATE.test(t.start||'')||!DATE.test(t.end||'')||typeof t.sm!=='string'){R.bad++;continue}
      const rec={id:t.id,region:normRegion(t.region.slice(0,100)),start:t.start,end:t.end,sm:t.sm.slice(0,200),created:+t.created||Date.now(),coverBlob:null};
      if(tripIds.has(rec.id)){tmap.set(rec.id,rec.id);R.ts++;continue}                       // 같은 id → 이미 있음
      const same=tripByKey.get(tk(rec));if(same){tmap.set(rec.id,same);R.ts++;continue}      // 같은 지역·날짜·한줄기록 → 이미 있음 (사진만 합침)
      if(t.cover&&entries.has(t.cover))rec.coverBlob=await zipEntry(file,entries.get(t.cover),'image/jpeg');
      newTrips.push(rec);tmap.set(rec.id,rec.id);tripIds.add(rec.id);tripByKey.set(tk(rec),rec.id);R.ta++;
      if(!Object.prototype.hasOwnProperty.call(cityEls,rec.region))R.unk++;
    }
    if(newTrips.length)await st.putMany('trips',newTrips);
    tick();
    let batch=[];
    for(const p of data.photos){
      done++;const tid=p&&tmap.get(p.trip);
      if(!p||!ID.test(p.id||'')||!tid||typeof p.cap!=='string'||!entries.has(p.file)){R.bad++;continue}
      if(photoIds.has(p.id)){R.ps++;continue}
      const full=await zipEntry(file,entries.get(p.file),'image/jpeg'),key=`${tid}|${p.cap}|${full.size}`;
      if(photoKeys.has(key)){R.ps++;continue}                                                // 같은 여행·한줄기록·크기 → 이미 있음
      const thumb=p.thumb&&entries.has(p.thumb)?await zipEntry(file,entries.get(p.thumb),'image/jpeg'):await makeThumb(full);
      batch.push({id:p.id,trip:tid,cap:p.cap.slice(0,200),blob:full,thumb,created:+p.created||Date.now()});photoIds.add(p.id);photoKeys.add(key);R.pa++;
      if(batch.length>=10){await st.putMany('photos',batch);batch=[];tick()}else if(done%5===0)tick();
    }
    if(batch.length)await st.putMany('photos',batch);
    newTrips.forEach(t=>visited.add(t.region));D.prov.forEach((_,i)=>paintRegion(i));refreshGear();     // 지도 색칠 갱신
    if(level===2)renderTrips(selC,document.getElementById('cv'+selC[3]));                              // 열려 있는 목록 새로고침
    const skipped=R.ts+R.ps;
    progUI({title:'불러오기를 마쳤어요',pct:null,msg:`여행 ${R.ta}개, 사진 ${R.pa}장을 추가했어요.`+(skipped?`\n이미 있어서 건너뛴 항목 ${skipped}건`:'')+(R.bad?`\n읽을 수 없어서 건너뛴 항목 ${R.bad}건`:'')+(R.unk?`\n지도에 없는 지역의 기록 ${R.unk}건 (지도에는 표시되지 않아요)`:''),btns:[{label:'확인',cls:'ok',fn:progClose}]});
  }catch(e){if(e&&e.cancel)progClose();else fail(e)}
  busy=false;
}
$('setExport').addEventListener('click',async()=>{
  if(busy)return;
  if(await confirmDialog('백업 파일을 내보낼까요?','사진과 여행 기록이 하나의 압축 파일(.zip)로 만들어져요.','내보내기',false)){closeSettings();doExport()}
});
$('setImport').addEventListener('click',async()=>{
  if(busy)return;
  if(await confirmDialog('백업 파일을 불러올까요?','백업 파일(.zip)을 고르면 지금 기록은 그대로 두고, 없는 기록만 추가해요.','불러오기',false))fileImp.click();
});
fileImp.addEventListener('change',()=>{const f=fileImp.files[0];fileImp.value='';if(f){closeSettings();doImport(f)}});

/* ---------- 시 선택 / 복귀 ---------- */
function pick(c,single){
  if(level!==1)return;drop();level=2;selC=c;
  const el=document.getElementById('cv'+c[3]);
  groups[sel].querySelectorAll('.city').forEach(e=>e!==el&&e.classList.add('gone'));   // 다른 지역은 사라짐
  el.classList.add('picked');if(WK)wkOn(shP,el);svg.classList.add('focus');chGroups[sel].classList.remove('on');
  renderTrips(c,el);layout();setBack();
  flyTo(topFit(c[4]),1000,!single);   // 작아지면서 이동 (바로 들어온 경우는 도착 배율에 맞춰 그림자도 맞춤)
  sheet.classList.add('open');refresh();           // 하단에서 시트가 올라옴
}
function unpick(){
  if(level!==2)return;level=1;const c=selC;selC=null;
  sheet.classList.remove('open');svg.classList.remove('focus');loadTok++;galTok++;dropUrls(listUrls.splice(0));dropUrls(galUrls.splice(0));chGroups[sel].classList.add('on');
  document.getElementById('cv'+c[3]).classList.remove('picked');if(WK)wkOff(shP);
  groups[sel].querySelectorAll('.city.gone').forEach(e=>e.classList.remove('gone'));
  if(D.prov[sel].s){leave();return}   // 광역시 등은 전체 지도로 바로 돌아감
  setBack();flyTo(fit(D.prov[sel].bb,1.35),900);refresh();
}
const goBack=()=>level===2?(view==='form'?0:view==='gallery'?closeGallery():unpick()):leave();   // 입력 화면에서는 시트의 ‹ 버튼으로만 뒤로 감

/* ---------- 이벤트 ---------- */
svg.querySelectorAll('#pHit .hit').forEach(h=>{
  const i=+h.dataset.i;
  h.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch'&&!level)lift(provEls[i])});
  h.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')drop()});
  h.addEventListener('click',()=>{if(touchy()&&cur!==provEls[i])lift(provEls[i]);else enter(i)});  // 터치: 첫 번째=미리보기, 두 번째=들어가기
});
svg.querySelectorAll('#cHit .hit').forEach(h=>{
  const el=document.getElementById('cv'+h.dataset.j);
  h.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')lift(el)});
  h.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')drop()});
  h.addEventListener('click',()=>{if(touchy()&&cur!==el)lift(el);else pick(cityData[h.dataset.j])});
});
svg.addEventListener('pointerdown',e=>{const t=e.pointerType==='touch'?'touch':'mouse';if(t!==lastType){lastType=t;refresh()}},true);
svg.addEventListener('click',e=>{if(!e.target.classList.contains('hit')){if(cur){drop();return}goBack()}});  // 빈 곳: 선택 해제 → 한 번 더 누르면 뒤로
back.addEventListener('click',goBack);
addEventListener('keydown',e=>{if(e.key==='Escape'){if(dlgCancel)dlgCancel();else if($('prog').classList.contains('show'))return;else if(settingsOpen)closeSettings();else if(menuOpen)closeMenu();else if(vState==='open')closeViewer();else goBack()}});
new ResizeObserver(()=>{cancelAnimationFrame(raf);apply(target());layout();fitDates();fitTitle();closeViewer(true)}).observe(svg);
apply(target());refresh();
(function(){   // 설정 > 지도 크기 슬라이더
  const r=$('msRange'),v=$('msVal');r.value=Math.round(mapScale*100);v.textContent=r.value+'%';
  r.addEventListener('input',()=>{
    mapScale=r.value/100;v.textContent=r.value+'%';
    try{localStorage.setItem('mapScale',mapScale)}catch(e){}
    if(level===0){cancelAnimationFrame(raf);apply(allFit())}   // 전체 지도를 보고 있으면 바로 반영
  });
})();

/* ---------- 시작 화면: GABODA / 가보다가 써지는 애니메이션 → 지도 ---------- */
(function(){
  const el=$('intro');if(!el)return;
  if(document.documentElement.classList.contains('skip-intro')){el.remove();return}   // 같은 실행 중 새로고침이면 건너뜀
  try{sessionStorage.setItem('gb_intro','1')}catch(e){}
  let ended=false;
  const end=()=>{if(ended)return;ended=true;document.body.classList.add('reveal');el.classList.add('out');setTimeout(()=>el.remove(),1000)};
  el.addEventListener('click',end);   // 화면을 누르면 바로 넘어감
  requestAnimationFrame(()=>setTimeout(()=>el.classList.add('run'),150));
  setTimeout(end,matchMedia('(prefers-reduced-motion: reduce)').matches?1500:2700);
})();
/* ---------- PWA: 서비스 워커 등록 / 상태 표시줄 색 / 앱 설치 ---------- */
if('serviceWorker' in navigator)addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
const tcMeta=document.querySelector('meta[name="theme-color"]');
const syncTC=()=>{if(tcMeta)tcMeta.content=(document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'))==='dark'?'#1d2127':'#f4f1ea'};
new MutationObserver(syncTC).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});syncTC();
let installEv=null;addEventListener('beforeinstallprompt',e=>{e.preventDefault();installEv=e});
if(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true)$('setInstall').hidden=true;   // 이미 설치해서 실행 중이면 숨김
$('setInstall').addEventListener('click',async()=>{
  closeSettings();
  if(installEv){const ev=installEv;installEv=null;ev.prompt();try{await ev.userChoice}catch(e){}return}
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  progUI({title:'홈 화면에 설치',pct:null,msg:ios?'Safari 아래쪽의 공유 버튼(□↑)을 누르고\n"홈 화면에 추가"를 선택하세요.\n※ 반드시 Safari로 열어야 해요.':'브라우저 오른쪽 위 메뉴(⋮)에서\n"앱 설치" 또는 "홈 화면에 추가"를 선택하세요.',btns:[{label:'확인',cls:'ok',fn:progClose}]});
});
