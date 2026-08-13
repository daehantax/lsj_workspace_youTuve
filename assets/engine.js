'use strict';
/* ══════════════ 종부세·재산세 계산 엔진 ══════════════
   단위: 공시가·과표 = 억원 / 세액 = 만원 (1억 = 10,000만) */

const RATES = {
  2026: [[3,.005],[6,.007],[12,.010],[25,.013],[50,.015],[94,.020],[Infinity,.027]], // 1·2주택
  2027: [[3,.005],[6,.007],[12,.013],[25,.015],[50,.020],[94,.027],[Infinity,.035]], // 1·2주택(중간)
  2028: [[3,.005],[6,.007],[12,.013],[25,.020],[50,.030],[94,.040],[Infinity,.050]]  // 가액 일원화
};
function prog(base, brk){ // base 억원 → 만원
  let tax=0, prev=0;
  for(const [lim,r] of brk){
    if(base<=prev) break;
    tax += (Math.min(base,lim)-prev)*r*10000;
    prev=lim;
  }
  return tax;
}

/* ── 재산세 (calcPropertyTax) ──
   1주택: 공정시장가액비율 45%, 공시가 9억 이하 특례세율 / 그 외: 60%, 표준세율 */
const PROP_STD = [[0.6,.001],[1.5,.0015],[3,.0025],[Infinity,.004]];
const PROP_SPC = [[0.6,.0005],[1.5,.001],[3,.002],[Infinity,.0035]]; // 9억 이하 1주택 특례세율
function calcPropertyTax(gong, onehome=true){ // 억원 → {만원}
  const fmv = onehome ? 0.45 : 0.60;
  const base = gong*fmv;
  const useSpc = onehome && gong<=9;
  const main = prog(base, useSpc?PROP_SPC:PROP_STD);
  const urban = base*0.0014*10000;   // 도시지역분 0.14%
  const edu = main*0.2;              // 지방교육세 20%
  return {gong, fmv, base, useSpc, main, urban, edu, total: main+urban+edu};
}
// 종부세 연계용(재산세 본세, 1주택 기준) — 세부담상한 체인·재산세액공제 한도에 사용
function propertyTax(gong){ return calcPropertyTax(gong, true).main; }

// 과세표준을 구간별로 쪼개 세액 내역 반환(재산세 계산기 상세표용)
function bracketRows(base, brk){
  const rows=[]; let prev=0;
  for(const [lim,r] of brk){
    if(base<=prev) break;
    rows.push({from:prev, to:Math.min(base,lim), rate:r, tax:(Math.min(base,lim)-prev)*r*10000});
    prev=lim;
  }
  return rows;
}

const ageCredit = a => a>=70?.4 : a>=65?.3 : a>=60?.2 : 0;
const holdC26 = y => y>=15?.5 : y>=10?.4 : y>=5?.2 : 0;
const holdC27 = y => y>=15?.25: y>=10?.2 : y>=5?.1 : 0;   // 보유공제 ½
const resC    = y => y>=15?.5 : y>=10?.4 : y>=5?.2 : 0;   // 거주공제

/* 1인분 계산. special=1세대1주택자 지위(단독명의 or 특례신청) */
function person(year, gong, special, living, age, holdY, resY, adjArea){
  let thr, ded;
  if(year===2026){ thr = special?12:9; ded = special?12:9; }
  else{
    if(special){ thr=14; ded = living?14:9; }
    else{ thr=9; ded = living?9:4; }
  }
  const r = {year, gong, thr, ded, taxable:gong>thr, fmv:0, base:0, gross:0,
             propCr:0, credRate:0, credit:0, credCapped:false, net:0};
  if(!r.taxable) return r;
  r.fmv = year===2026?0.6 : (special?0.7 : (year===2028 && adjArea?0.8:0.7));
  r.base = Math.max(0,(gong-ded))*r.fmv;
  r.gross = prog(r.base, RATES[year]);
  r.propCr = Math.min(r.base*0.45*0.004*10000, propertyTax(gong)); // 공제할 재산세액
  const afterProp = Math.max(0, r.gross-r.propCr);
  if(special){
    const pc = year===2026?holdC26(holdY) : year===2027?Math.max(holdC27(holdY),resC(resY)) : resC(resY);
    r.credRate = Math.min(.8, ageCredit(age)+pc);
    let cr = afterProp*r.credRate;
    const cap = year===2027?800 : year===2028?600 : Infinity;
    if(cr>cap){ cr=cap; r.credCapped=true; }
    r.credit = cr;
  }
  r.net = Math.max(0, afterProp-r.credit);
  return r;
}

/* 방식별 3개년 세트(세부담상한 연쇄 적용) */
function series(kind, inp){ // kind: 'sole'(단독) | 'indiv'(공동 개별) | 'spec'(공동 특례)
  const out=[]; let prevBurden=null;
  for(const y of [2026,2027,2028]){
    let persons, propShare;
    if(kind==='indiv'){
      const s=inp.share, g1=inp.price*s, g2=inp.price*(1-s);
      persons=[person(y,g1,false,inp.living,inp.age,inp.hold,inp.res,inp.adj),
               person(y,g2,false,inp.living,inp.age,inp.hold,inp.res,inp.adj)];
      propShare=[s,1-s];
    }else{
      persons=[person(y,inp.price,true,inp.living,inp.age,inp.hold,inp.res,inp.adj)];
      propShare=[1];
    }
    const pTax=propertyTax(inp.price);
    const netBefore = persons.reduce((a,p)=>a+p.net,0); // 상한 적용 전 종부세
    // 세부담상한: (재산세+종부세) ≤ 직전연도 × 상한율
    let capped=false, ratio=null, prevTotal=null;
    if(prevBurden!==null){
      ratio = y===2026?1.5:2.0;
      prevTotal = prevBurden.reduce((a,b)=>a+b,0);
      persons.forEach((p,i)=>{
        const myProp=pTax*propShare[i];
        const allow=Math.max(0, prevBurden[i]*ratio - myProp);
        if(p.net>allow){ p.net=allow; p.capApplied=true; capped=true; }
      });
    }
    prevBurden = persons.map((p,i)=>pTax*propShare[i]+p.net);
    const net = persons.reduce((a,p)=>a+p.net,0);
    out.push({year:y, persons, net, netBefore, pTax, prevTotal, ratio,
              farm:net*0.2, total:net*1.2, capped,
              taxable:persons.some(p=>p.taxable)});
  }
  return out;
}

/* ── 표기 도우미 ── */
const fmt = n => Math.round(n).toLocaleString('ko-KR');
/* 압축 표기: 10,000만 이상은 억 단위 */
const cmpct = n => n>=10000 ? ((n/10000).toFixed(n%10000<50?0:1).replace(/\.0$/,''))+'억' : fmt(n)+'만';
const bigAmtHtml = n => {
  n=Math.round(n);
  if(n>=10000) return fmt(Math.floor(n/10000))+'<small>억</small> '+fmt(n%10000)+'<small>만원</small>';
  return fmt(n)+'<small>만원</small>';
};
const abil = v => v.toLocaleString('ko-KR',{maximumFractionDigits:2})+'억';
function niceStep(raw){
  const p=Math.pow(10,Math.floor(Math.log10(Math.max(1,raw))));
  for(const m of [1,2,2.5,5,10]) if(raw<=m*p) return m*p;
  return 10*p;
}
