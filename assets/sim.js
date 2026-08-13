'use strict';
/* ══════════════ 시뮬레이터 UI ══════════════
   window.PAGE_MODE: 'single'(단독명의 페이지) | 'joint'(부부 공동명의 페이지) */

const MODE = window.PAGE_MODE || 'joint';
const IS_JOINT = MODE==='joint';

const S = {price:20, living:true, adj:true, age:65, hold:12, res:12, share:0.5};

function segInit(id, handler){
  const el=document.getElementById(id);
  if(!el) return;
  el.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    el.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));
    b.setAttribute('aria-pressed','true'); handler(b.dataset.v); update();
  }));
}
segInit('segLive', v=>{S.living=(v==='live'); if(S.living && S.res===0){S.res=S.hold; syncSteppers();}});
segInit('segAdj', v=>S.adj=(v==='y'));

const inPrice=document.getElementById('inPrice');
function priceLabel(){
  const market=Math.round(S.price/0.7);
  document.getElementById('priceVal').innerHTML=S.price+'억<small style="display:block;font-size:.62em;color:var(--ink-3);font-weight:600">시가 약 '+market+'억</small>';
}
inPrice.addEventListener('input',()=>{S.price=+inPrice.value; priceLabel();
  document.querySelectorAll('#pricePresets .chip').forEach(c=>c.classList.toggle('on',+c.dataset.v===S.price)); update();});
document.querySelectorAll('#pricePresets .chip').forEach(c=>c.addEventListener('click',()=>{
  S.price=+c.dataset.v; inPrice.value=S.price; priceLabel();
  document.querySelectorAll('#pricePresets .chip').forEach(x=>x.classList.toggle('on',x===c)); update();}));
priceLabel();

/* 부부 지분율 (공동명의 페이지 전용) — 기본 50:50, 수정 가능 */
const inShare=document.getElementById('inShare');
if(inShare){
  const shareLabel=()=>{
    const a=Math.round(S.share*100);
    document.getElementById('shareVal').textContent=a+' : '+(100-a);
    document.querySelectorAll('#sharePresets .chip').forEach(c=>c.classList.toggle('on',+c.dataset.v===a));
  };
  inShare.addEventListener('input',()=>{S.share=+inShare.value/100; shareLabel(); update();});
  document.querySelectorAll('#sharePresets .chip').forEach(c=>c.addEventListener('click',()=>{
    S.share=+c.dataset.v/100; inShare.value=+c.dataset.v; shareLabel(); update();}));
  shareLabel();
}

function stepper(dn,up,get,set,min,max){
  document.getElementById(dn).addEventListener('click',()=>{set(Math.max(min,get()-1)); syncSteppers(); update();});
  document.getElementById(up).addEventListener('click',()=>{set(Math.min(max,get()+1)); syncSteppers(); update();});
}
function syncSteppers(){
  document.getElementById('ageVal').textContent=S.age+'세';
  document.getElementById('holdVal').textContent=S.hold+'년';
  document.getElementById('resVal').textContent=S.res+'년';
}
stepper('ageDn','ageUp',()=>S.age,v=>S.age=v,30,95);
stepper('holdDn','holdUp',()=>S.hold,v=>S.hold=v,0,50);
stepper('resDn','resUp',()=>S.res,v=>S.res=v,0,50);

/* 카운트업 */
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el, target, render){
  if(reduceMotion){ el.innerHTML=render(target); return; }
  const dur=900, t0=performance.now();
  (function tick(t){
    const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
    el.innerHTML=render(target*e);
    if(p<1) requestAnimationFrame(tick);
  })(t0);
}

function methodLabel(k){return k==='indiv'?'개별과세 (부부 각자)':k==='spec'?'1주택 특례 (단독 간주)':'단독명의';}

let lastSets=[]; // 산식 팝업에서 참조

function update(animate=true){
  const inp={price:S.price, living:S.living, adj:S.adj, age:S.age, hold:S.hold, res:S.res, share:S.share};
  const sets = IS_JOINT
    ? [{k:'indiv',cls:'b1',col:'var(--s1)',data:series('indiv',inp)},
       {k:'spec', cls:'b2',col:'var(--s2)',data:series('spec',inp)}]
    : [{k:'sole', cls:'b1',col:'var(--s1)',data:series('sole',inp)}];
  lastSets=sets;

  /* 경고 티커 */
  const tk=document.getElementById('ticker');
  if(IS_JOINT && !S.living){
    tk.innerHTML='⚠ <b>비거주 공동명의</b> — 2027년부터 부부 합산 기본공제 <b>18억 → 8억</b>으로 축소되는 최대 악화 케이스입니다. 특례(비거주 9억 공제)와 매년 비교 선택하세요.';
    tk.classList.add('show');
  }else if(!IS_JOINT && !S.living){
    tk.innerHTML='⚠ <b>비거주 1주택</b> — 기본공제 12억 → <b>9억</b> 축소, 세액공제도 거주기간 중심으로 재편됩니다.';
    tk.classList.add('show');
  }else tk.classList.remove('show');

  /* 연도 카드 */
  const yc=document.getElementById('yearCards'); yc.innerHTML='';
  const years=[2026,2027,2028];
  years.forEach((y,i)=>{
    // 표시 기준: 공동명의는 '유리한 방식', 단독은 그대로
    const vals = sets.map(s=>s.data[i]);
    const best = IS_JOINT ? (vals[0].total<=vals[1].total?0:1) : 0;
    const shown = vals[best];
    const base = IS_JOINT ? Math.min(sets[0].data[0].total,sets[1].data[0].total) : sets[0].data[0].total;
    const d = shown.total-base;
    const card=document.createElement('div');
    card.className='ycard'+(d>0.5&&i>0?' hot':'');
    let mrows='';
    if(IS_JOINT){
      vals.forEach((v,mi)=>{
        mrows+=`<div class="mrow"><span class="sw" style="background:${sets[mi].col}"></span>
          <span class="nm">${methodLabel(sets[mi].k)}</span>
          <span class="amt">${v.taxable?cmpct(v.total):'0원'}</span>
          ${mi===best&&vals[0].total!==vals[1].total?'<span class="win">유리</span>':''}</div>`;
      });
    }
    const deltaHtml = i===0
      ? `<span class="delta flat">기준연도</span>`
      : d>0.5 ? `<span class="delta up">▲ ${cmpct(d)} 증가</span>`
      : d<-0.5? `<span class="delta down">▼ ${cmpct(-d)} 감소</span>`
      : `<span class="delta flat">± 0</span>`;
    card.innerHTML=`
      <div class="yr"><b>${y}</b><span>${i===0?'현행':i===1?'개편 1년차':'개편 완성'}</span></div>
      <div class="bigamt" id="amt${i}">0<small>만원</small></div>
      ${deltaHtml}
      ${shown.taxable?'':'<div class="notax">과세 대상 아님 (기준액 이하)</div>'}
      ${shown.capped?'<div class="capflag">◈ 세부담 상한('+(y===2026?'150':'200')+'%) 적용됨</div>':''}
      ${IS_JOINT?`<div class="methods">${mrows}</div>`:''}`;
    yc.appendChild(card);
    countUp(card.querySelector('.bigamt'), shown.total, bigAmtHtml);
  });

  /* 범례 */
  const lg=document.getElementById('legend');
  lg.innerHTML = sets.map(s=>`<span class="li"><span class="sw" style="background:${s.col}"></span>${methodLabel(s.k)}</span>`).join('');

  /* 차트 */
  const chart=document.getElementById('chart');
  chart.querySelectorAll('.ygroup').forEach(g=>g.remove());
  const maxV=Math.max(1,...sets.flatMap(s=>s.data.map(d=>d.total)));
  // 그리드(눈금 4개, nice step)
  const step=niceStep(maxV/4);
  const gmax=Math.ceil(maxV/step)*step;
  const grid=document.getElementById('grid'); grid.innerHTML='';
  for(let v=step;v<=gmax;v+=step){
    const pct=100-(v/gmax*100);
    grid.insertAdjacentHTML('beforeend',
      `<div class="gl" style="top:${pct}%"></div><div class="gt" style="top:${pct}%">${cmpct(v)}</div>`);
  }
  years.forEach((y,i)=>{
    const g=document.createElement('div'); g.className='ygroup';
    sets.forEach(s=>{
      const d=s.data[i];
      const h=Math.max(0.6, d.total/gmax*100);
      const bar=document.createElement('div');
      bar.className='bar '+s.cls;
      bar.dataset.tip=`${y} · ${methodLabel(s.k)}\n종부세 ${cmpct(d.net)} + 농특세 ${cmpct(d.farm)}\n합계 ${cmpct(d.total)}원`;
      bar.innerHTML=`<span class="bl">${d.total>0?cmpct(d.total):'0'}</span>`;
      bar.style.height= animate&&!reduceMotion ? '0%' : h+'%';
      g.appendChild(bar);
      if(animate&&!reduceMotion) requestAnimationFrame(()=>requestAnimationFrame(()=>bar.style.height=h+'%'));
    });
    chart.appendChild(g);
  });

  renderDetails(sets);
}

/* ── 계산 상세 ── */
function fxBtn(key,label,si){
  return `<button class="fx" data-key="${key}" data-si="${si}" type="button">${label} <span class="fxi">ⓘ 산식</span></button>`;
}
function renderDetails(sets){
  const el=document.getElementById('calcBody');
  const totalLabel = IS_JOINT ? '부부합계 (농특세 포함)' : '합계 (농특세 포함)';
  let html='';
  sets.forEach((s,si)=>{
    html+=`<h4 style="margin:18px 0 2px;color:var(--ink);font-size:.95rem">
      <span style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${s.col};margin-right:7px"></span>
      ${methodLabel(s.k)}${s.k==='indiv'?` <small style="color:var(--ink-3);font-weight:600">— 부부 지분 ${Math.round(S.share*100)}% : ${Math.round((1-S.share)*100)}%, 아래는 부부 합산</small>`:''}</h4>
      <div class="tblwrap"><table>
      <tr><th>항목</th><th>2026 (현행)</th><th>2027</th><th>2028~</th></tr>`;
    const rows=[
      ['기본공제', d=>d.persons.map(p=>p.ded+'억').filter((v,i,a)=>a.indexOf(v)===i).join(' / ')+(s.k==='indiv'?' (인별)':'')],
      ['공정시장가액비율', d=>d.taxable?Math.round(d.persons[0].fmv*100)+'%':'—'],
      ['과세표준 (합산)', d=>d.taxable?abil(d.persons.reduce((a,p)=>a+p.base,0)):'—'],
      [fxBtn('gross','산출세액',si), d=>d.taxable?fmt(d.persons.reduce((a,p)=>a+p.gross,0))+'만':'—'],
      [fxBtn('prop','(−) 공제할 재산세액',si), d=>d.taxable?fmt(d.persons.reduce((a,p)=>a+p.propCr,0))+'만':'—'],
      [fxBtn('credit','(−) 세액공제',si), d=>{
        if(!d.taxable) return '—';
        const c=d.persons.reduce((a,p)=>a+p.credit,0);
        if(s.k==='indiv') return '<span class="dim">배제 (특례 미신청)</span>';
        const r=Math.round(d.persons[0].credRate*100);
        return fmt(c)+'만 <span class="dim">('+r+'%'+(d.persons[0].credCapped?'·한도적용':'')+')</span>';
      }],
      [fxBtn('cap','세부담 상한',si), d=>d.capped?'<b style="color:var(--gold)">적용됨</b>':'미적용'],
      ['종부세 본세', d=>fmt(d.net)+'만'],
      ['(+) 농어촌특별세 20%', d=>fmt(d.farm)+'만'],
    ];
    rows.forEach(([nm,fn])=>{
      html+=`<tr><td>${nm}</td>`+s.data.map(d=>`<td>${fn(d)}</td>`).join('')+`</tr>`;
    });
    html+=`<tr class="total"><td>${totalLabel}</td>`+s.data.map(d=>`<td>${fmt(d.total)}만원</td>`).join('')+`</tr></table></div>`;
    if(s.data.some(d=>!d.taxable))
      html+=`<p style="font-size:.78rem;color:var(--ink-3);margin-top:6px">— : 과세기준(1세대1주택자 14억 / 그 외 인별 9억, 현행 12억/9억) 이하로 과세 대상 아님</p>`;
  });
  if(IS_JOINT){
    const diff=sets[0].data.map((d,i)=>d.total-sets[1].data[i].total);
    html+=`<p style="margin-top:16px;font-size:.88rem;color:var(--ink)"><b style="color:var(--gold)">개별과세 vs 특례</b> — `
      + [2026,2027,2028].map((y,i)=>{
          const a=Math.abs(diff[i]);
          if(a<0.5) return `${y}년 동일`;
          return `${y}년은 <b>${diff[i]<0?'개별과세':'특례'}</b>가 ${cmpct(a)}원 유리`;
        }).join(' · ')
      +`. 특례는 매년 9.16~9.30 신청(미신청 시 자동 개별과세).</p>`;
  }
  html+=`<p style="font-size:.78rem;color:var(--ink-3);margin-top:10px">💡 <u>산출세액 · 공제할 재산세액 · 세액공제 · 세부담 상한</u> 항목을 누르면 산식과 대입 값을 팝업으로 보여줍니다.</p>`;
  el.innerHTML=html;
}

/* ── 산식 팝업 ── */
const modal=document.createElement('div');
modal.className='modal';
modal.innerHTML='<div class="mcard" role="dialog" aria-modal="true" aria-label="산식 안내"><button class="mclose" type="button" aria-label="닫기">✕</button><div class="mbody"></div></div>';
document.body.appendChild(modal);
modal.addEventListener('click',e=>{ if(e.target===modal||e.target.closest('.mclose')) modal.classList.remove('show'); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape') modal.classList.remove('show'); });
function openModal(html){
  modal.querySelector('.mbody').innerHTML=html;
  modal.classList.add('show');
  modal.querySelector('.mcard').scrollTop=0;
}
document.getElementById('calcBody').addEventListener('click',e=>{
  const b=e.target.closest('.fx'); if(!b) return;
  const s=lastSets[+b.dataset.si]; if(!s) return;
  openModal(fxContent(b.dataset.key, s));
});

function fxTable(rows){
  return `<div class="tblwrap"><table>
    <tr><th>대입</th><th>2026 (현행)</th><th>2027</th><th>2028~</th></tr>
    ${rows.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}
  </table></div>`;
}
function fxContent(key, s){
  const D=s.data, name=methodLabel(s.k);
  const sum=(d,f)=>d.persons.reduce((a,p)=>a+f(p),0);
  const head=t=>`<h3>${t} <span style="color:var(--ink-2);font-weight:600;font-size:.8em">— ${name}</span></h3>`;

  if(key==='gross'){
    const labels=['3억 이하','3~6억','6~12억','12~25억','25~50억','50~94억','94억 초과'];
    let rt='<div class="tblwrap"><table><tr><th>과세표준 구간</th><th>2026</th><th>2027</th><th>2028~</th></tr>';
    labels.forEach((lb,i)=>{
      rt+=`<tr><td>${lb}</td>`+[2026,2027,2028].map(y=>`<td>${(RATES[y][i][1]*100).toFixed(1)}%</td>`).join('')+'</tr>';
    });
    rt+='</table></div>';
    const rows=[
      ['과세표준 (합산)', ...D.map(d=>d.taxable?abil(sum(d,p=>p.base)):'—')],
    ];
    if(s.k==='indiv'){
      rows.push(
        ['· 본인 과표 → 세액', ...D.map(d=>d.taxable ? (d.persons[0].taxable?`${abil(d.persons[0].base)} → ${fmt(d.persons[0].gross)}만`:'<span class="dim">과세 제외</span>') : '—')],
        ['· 배우자 과표 → 세액', ...D.map(d=>d.taxable ? (d.persons[1].taxable?`${abil(d.persons[1].base)} → ${fmt(d.persons[1].gross)}만`:'<span class="dim">과세 제외</span>') : '—')]);
    }
    rows.push(['<b>산출세액</b>', ...D.map(d=>d.taxable?`<b>${fmt(sum(d,p=>p.gross))}만</b>`:'—')]);
    return head('산출세액 산식')
      + `<div class="fxbox"><b>산출세액</b> = 과세표준 × 세율(초과누진)<br>
         <b>과세표준</b> = (공시가격 − 기본공제) × 공정시장가액비율</div>` + rt + fxTable(rows)
      + `<p class="mnote">각 구간을 초과하는 금액에만 해당 구간 세율을 적용해 누적 합산하는 초과누진 방식입니다.${s.k==='indiv'?' 개별과세는 부부 각자의 지분 공시가격으로 따로 계산한 뒤 합산합니다.':''}</p>`;
  }

  if(key==='prop'){
    const rows=[
      ['종부세 과세표준 (합산)', ...D.map(d=>d.taxable?abil(sum(d,p=>p.base)):'—')],
      ['× 45% × 0.4%', ...D.map(d=>d.taxable?`<b>${fmt(sum(d,p=>p.propCr))}만</b>`:'—')],
    ];
    return head('공제할 재산세액 산식')
      + `<div class="fxbox"><b>공제할 재산세액</b> = 종부세 과세표준 × 재산세 공정시장가액비율(1주택 45%) × 재산세 표준세율 0.4%<br>
         <span style="color:var(--ink-2)">(해당 주택에 실제 부과된 재산세액을 한도로 함)</span></div>`
      + fxTable(rows)
      + `<p class="mnote">같은 과세표준 구간에 재산세와 종부세가 이중으로 부과되지 않도록, 종부세 과세표준분에 대한 재산세 상당액을 종부세에서 빼 주는 항목입니다.</p>`;
  }

  if(key==='credit'){
    if(s.k==='indiv'){
      return head('세액공제 산식')
        + `<div class="fxbox">개별과세(특례 미신청)는 1세대 1주택자 지위가 아니므로 <b>연령·기간 세액공제가 배제</b>됩니다.</div>`
        + `<p class="mnote">세액공제는 단독명의 또는 부부 공동명의 특례(1세대 1주택자 간주, 매년 9.16~9.30 신청) 선택 시에만 적용됩니다.</p>`;
    }
    const rows=[
      ['산출세액 − 재산세액공제', ...D.map(d=>d.taxable?fmt(Math.max(0,sum(d,p=>p.gross)-sum(d,p=>p.propCr)))+'만':'—')],
      ['공제율 (연령+기간)', ...D.map(d=>d.taxable?Math.round(d.persons[0].credRate*100)+'%':'—')],
      ['<b>세액공제액</b>', ...D.map(d=>d.taxable?`<b>${fmt(sum(d,p=>p.credit))}만</b>`+(d.persons[0].credCapped?' <span class="dim">(한도 적용)</span>':''):'—')],
    ];
    return head('세액공제 산식')
      + `<div class="fxbox"><b>세액공제</b> = (산출세액 − 공제할 재산세액) × 공제율<br>
         <b>공제율</b> = 연령공제 + 기간공제 <span style="color:var(--ink-2)">(합산 한도 80%)</span><br>
         · 연령공제 — 60세↑ 20% · 65세↑ 30% · 70세↑ 40%<br>
         · 기간공제 — <b>2026</b> 보유기간(5년 20 · 10년 40 · 15년 50%) / <b>2027</b> 보유공제×½ vs 거주공제 중 큰 쪽 / <b>2028~</b> 거주기간만<br>
         · 금액한도 — <b>2027</b> 800만원 · <b>2028~</b> 600만원 (2026 한도 없음)</div>`
      + fxTable(rows);
  }

  if(key==='cap'){
    const rows=[
      ['전년 보유세 (재산세+종부세)', ...D.map(d=>d.ratio?fmt(d.prevTotal)+'만':'<span class="dim">기준연도</span>')],
      ['× 상한율', ...D.map(d=>d.ratio?Math.round(d.ratio*100)+'%':'—')],
      ['= 상한액', ...D.map(d=>d.ratio?fmt(d.prevTotal*d.ratio)+'만':'—')],
      ['금년 재산세 + 종부세(상한 전)', ...D.map(d=>fmt(d.pTax+d.netBefore)+'만')],
      ['<b>상한 적용</b>', ...D.map(d=>d.ratio?(d.capped?`<b style="color:var(--gold)">적용 — 종부세 ${fmt(d.netBefore)}만 → ${fmt(d.net)}만</b>`:'미적용'):'—')],
    ];
    return head('세부담 상한 산식')
      + `<div class="fxbox"><b>세부담 상한</b> — 금년 (재산세 + 종부세)가<br>
         전년 (재산세 + 종부세) × 상한율(<b>2026</b> 150% · <b>2027~</b> 200%)을 넘지 않도록<br>
         초과분을 <b>종부세에서 차감</b>합니다.</div>`
      + fxTable(rows)
      + `<p class="mnote">본 시뮬레이터는 공시가격 3개년 동일 가정 하에 연도 연쇄로 근사 적용합니다. 개별과세는 부부 각자(지분별) 기준으로 상한을 적용한 뒤 합산합니다.</p>`;
  }
  return '';
}

document.getElementById('btnReplay').addEventListener('click',()=>update(true));
syncSteppers();
update(true);
