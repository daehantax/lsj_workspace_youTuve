'use strict';
/* ══════════════ 재산세 계산기 UI ══════════════ */

const P = {price:9, onehome:true, urban:true};

function segInit(id, handler){
  const el=document.getElementById(id);
  el.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
    el.querySelectorAll('button').forEach(x=>x.setAttribute('aria-pressed','false'));
    b.setAttribute('aria-pressed','true'); handler(b.dataset.v); render();
  }));
}
segInit('segHome', v=>P.onehome=(v==='one'));
segInit('segUrban', v=>P.urban=(v==='y'));

const inPrice=document.getElementById('inPrice');
function priceLabel(){
  const market=Math.round(P.price/0.7*10)/10;
  document.getElementById('priceVal').innerHTML=P.price+'억<small style="display:block;font-size:.62em;color:var(--ink-3);font-weight:600">시가 약 '+market+'억</small>';
}
inPrice.addEventListener('input',()=>{P.price=+inPrice.value; priceLabel();
  document.querySelectorAll('#pricePresets .chip').forEach(c=>c.classList.toggle('on',+c.dataset.v===P.price)); render();});
document.querySelectorAll('#pricePresets .chip').forEach(c=>c.addEventListener('click',()=>{
  P.price=+c.dataset.v; inPrice.value=P.price; priceLabel();
  document.querySelectorAll('#pricePresets .chip').forEach(x=>x.classList.toggle('on',x===c)); render();}));
priceLabel();

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
function countUp(el, target, renderFn){
  if(reduceMotion){ el.innerHTML=renderFn(target); return; }
  const dur=700, t0=performance.now();
  (function tick(t){
    const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3);
    el.innerHTML=renderFn(target*e);
    if(p<1) requestAnimationFrame(tick);
  })(t0);
}

function render(){
  const r=calcPropertyTax(P.price, P.onehome);
  const urban=P.urban?r.urban:0;
  const total=r.main+urban+r.edu;

  /* 적용 세율 캡션 + 티커 */
  document.getElementById('rateCap').textContent =
    `공정시장가액비율 ${Math.round(r.fmv*100)}% · ${r.useSpc?'1주택 특례세율(0.05~0.35%)':'표준세율(0.1~0.4%)'} 적용`;
  const tk=document.getElementById('ticker');
  if(P.onehome && !r.useSpc){
    tk.innerHTML='ℹ️ 공시가격 <b>9억 초과</b> — 1세대 1주택이라도 특례세율(−0.05%p) 없이 <b>표준세율</b>이 적용됩니다(공정시장가액비율 45%는 유지).';
    tk.classList.add('show');
  }else tk.classList.remove('show');

  /* 결과 카드 */
  const cards=[
    ['재산세 본세', r.main, ''],
    ['도시지역분', urban, P.urban?'':'제외됨'],
    ['지방교육세', r.edu, '본세의 20%'],
    ['합계', total, '연간 · 7월/9월 분납'],
  ];
  const rc=document.getElementById('resultCards'); rc.innerHTML='';
  cards.forEach(([nm,amt,cap],i)=>{
    const card=document.createElement('div');
    card.className='ycard'+(i===3?' gold':'');
    card.innerHTML=`<div class="yr"><b>${nm}</b>${cap?`<span>${cap}</span>`:''}</div>
      <div class="bigamt">0<small>만원</small></div>`;
    rc.appendChild(card);
    countUp(card.querySelector('.bigamt'), amt, bigAmtHtml);
  });

  /* 상세 테이블 */
  const brk = r.useSpc?PROP_SPC:PROP_STD;
  const brows = bracketRows(r.base, brk);
  const wonFmt = n => fmt(n)+'만';
  let html=`<table>
    <tr><th>단계</th><th>계산</th><th>금액</th></tr>
    <tr><td>공시가격</td><td class="dim">입력값</td><td>${abil(P.price)}</td></tr>
    <tr><td>과세표준</td><td class="dim">${abil(P.price)} × ${Math.round(r.fmv*100)}%</td><td>${abil(r.base)}</td></tr>`;
  brows.forEach((b,i)=>{
    html+=`<tr><td>${i===0?'본세 구간별 산출':''}</td>
      <td class="dim">${abil(b.from)} ~ ${abil(b.to)} 구간 × ${(b.rate*100).toFixed(2)}%</td>
      <td>${wonFmt(b.tax)}</td></tr>`;
  });
  html+=`<tr><td>재산세 본세</td><td class="dim">구간 합계 (${r.useSpc?'특례세율':'표준세율'})</td><td>${wonFmt(r.main)}</td></tr>
    <tr><td>도시지역분</td><td class="dim">${P.urban?`${abil(r.base)} × 0.14%`:'제외'}</td><td>${P.urban?wonFmt(urban):'—'}</td></tr>
    <tr><td>지방교육세</td><td class="dim">${wonFmt(r.main)} × 20%</td><td>${wonFmt(r.edu)}</td></tr>
    <tr class="total"><td>합계</td><td></td><td>${fmt(total)}만원</td></tr>
  </table>`;
  document.getElementById('detailTbl').innerHTML=html;
}

render();
