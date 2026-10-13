function safeSlice(v,a,b){return (v==null||v==="")?"":String(v).slice(a,b)}

// V1.6.3 authoritative Profile insurance-day label.
function v163ProfileDays(p){
  if(!p||!p.start_date||!p.end_date)return 1;
  // When document-agent exact timestamps are available, use elapsed-time ceiling.
  if(window.v163ExactTrip?.start && window.v163ExactTrip?.end)
    return Math.max(1,Math.ceil((new Date(window.v163ExactTrip.end)-new Date(window.v163ExactTrip.start))/86400000));
  const s=String(p.start_date).slice(0,10).replaceAll("/","-");
  const e=String(p.end_date).slice(0,10).replaceAll("/","-");
  return Math.max(1,Math.round((new Date(e+"T00:00")-new Date(s+"T00:00"))/86400000)+1);
}
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const cities={日本:["東京","大阪","京都","北海道","沖繩","名古屋","福岡"],韓國:["首爾","釜山","濟州"],泰國:["曼谷","清邁","普吉"],新加坡:["新加坡"],美國:["紐約","洛杉磯","舊金山","夏威夷"]};
function bubble(t,c){let d=document.createElement("div");d.className="bubble "+c;d.innerHTML=t;$("#messages").appendChild(d)}
function slash(x){return x?x.slice(0,10).replaceAll("-","/"):null}function dash(x){return x?(x.includes("T")?x:x.replaceAll("/","-")+"T00:00"):""}
function setCities(c,sel){let a=cities[c]||[];$("#city").innerHTML='<option value="">請選擇</option>'+a.map(x=>`<option>${x}</option>`).join("")+'<option>其他</option>';if(sel&&a.includes(sel))$("#city").value=sel}
function data(){let c=$("#country").value,ci=$("#city").value;if(c==="其他")c=$("#countryOther").value;if(ci==="其他")ci=$("#cityOther").value;return{start_date:slash($("#start").value),end_date:slash($("#end").value),country:c||null,city:ci||null,adults:+$("#adults").textContent,children:+$("#children").textContent,seniors:+$("#seniors").textContent,budget_range:$('input[name="budget"]:checked')?.value||null,concerns:$$('#concerns input:checked').map(x=>x.value)}}
function syncForm(p){if(p.start_date&&!$("#start").value)$("#start").value=dash(p.start_date);if(p.end_date&&!$("#end").value)$("#end").value=dash(p.end_date);if(p.country){$("#country").value=cities[p.country]?p.country:"其他";setCities(p.country,p.city);if(!cities[p.country])$("#countryOther").value=p.country}if(p.city&&!cities[p.country]?.includes(p.city)){$("#city").value="其他";$("#cityOther").value=p.city}if(p.adults!=null)$("#adults").textContent=p.adults;if(p.children!=null)$("#children").textContent=p.children;if(p.seniors!=null)$("#seniors").textContent=p.seniors;if(p.budget_range){let x=$(`input[name="budget"][value="${p.budget_range}"]`);if(x)x.checked=true}$$('#concerns input').forEach(x=>x.checked=(p.concerns||[]).includes(x.value))}
function render(p){window.lastProfile=p;
 syncForm(p);$("#empty").classList.add("hidden");$("#profile").classList.remove("hidden");
 const coreSet=new Set(["意外傷害","海外醫療","緊急救援","行李損失","班機延誤","行李延誤"]);
 let tags=(p.concerns||[]).map(x=>`<span class="tag">${coreSet.has(x)?"✓":"＋"} ${x}</span>`).join("")||"尚未指定";
 let insuranceDays="－";
 if(p.start_date&&p.end_date){
   insuranceDays=v165InsuranceDays(p.start_date,$("#startHour")?.value??"",p.end_date,$("#endHour")?.value??"");
 }
 $("#profile").innerHTML=`<div class="card"><b>🌏 目的地</b><br>${p.destination||"尚未提供"}</div><div class="card"><b>📅 行程</b><br>${p.start_date||"尚未提供"} ～ ${p.end_date||"尚未提供"} ${p.start_date&&p.end_date?`（保險天數${insuranceDays}天）`:""}</div><div class="card"><b>👨‍👩‍👧‍👦 投保人數</b><br>大人 ${p.adults??"－"}　小孩 ${p.children??"－"}　長輩 ${p.seniors??"－"}　合計 ${p.people??"－"} 人</div><div class="card"><b>💰 每人預算</b><br>${p.budget_range||(p.budget?`NT$ ${p.budget}`:"尚未提供")}</div><div class="card"><b>🛡 關注保障</b><br>${tags}</div>`;
}
async function sync(){
 let f=data();
 if(f.start_date&&f.end_date&&new Date(f.end_date.replaceAll("/","-"))<new Date(f.start_date.replaceAll("/","-"))){
   bubble("<b>AI</b><br>⚠️ 回程日不能早於啟程日，請重新選擇回程日。","ai");
   $("#end").value=""; f.end_date=null;
 }
 let r=await fetch("/api/profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({profile:f})});
 let d=await r.json();if(d.ok){render(d.profile);if(d.error)bubble("<b>AI</b><br>⚠️ "+d.error,"ai")}return d.profile
}
async function send(){let m=$("#message").value.trim();if(!m)return;if(typeof EXAMPLES!=="undefined"&&EXAMPLES[m]){fillExample(m);return;}bubble(m,"user");$("#message").value="";let r=await fetch("/api/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:m})});let d=await r.json();if(d.ok){render(d.profile);bubble("<b>AI</b><br>"+d.reply,"ai")}}
$("#send").onclick=send;$("#message").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});
$("#country").onchange=()=>{setCities($("#country").value);sync()};$("#city").onchange=sync;["start","end","countryOther","cityOther"].forEach(x=>$("#"+x).onchange=sync);$$('input[name="budget"]').forEach(x=>x.onchange=sync);
// V1.8.3.3: concern selections use Profile as the single source of truth.
// If AI planning is already visible, refresh only its coverage list/quote while preserving
// the customer's current 3 selected main amounts and tier.
$$('#concerns input').forEach(x=>x.onchange=async()=>{
 await sync();
 if(selectedPlan && !$('#planResult').classList.contains('hidden')){
  await getPlan(selectedPlan.tier,{accident:selectedPlan.accident,medical:selectedPlan.medical,rescue:selectedPlan.rescue});
 }
});$$(".counters button").forEach(b=>b.onclick=async()=>{let x=$("#"+b.dataset.id);x.textContent=Math.max(0,+x.textContent+(+b.dataset.d));await sync();if(typeof buildDOBPanel==="function")buildDOBPanel()});

let currentPlanOptions=[];let selectedPlan=null;
function money(n){return Number(n||0).toLocaleString()}
const EXAMPLES={
  "1":"10/5～10/10 2位大人、2位小孩、2位長輩要去日本東京旅遊，希望有基本保障。",
  "2":"10/5～10/10 2位大人、2位小孩、2位長輩要去日本東京旅遊，預算較低，希望控制在300元左右。",
  "3":"10/5～10/10 2位大人、2位小孩、2位長輩要去日本東京旅遊，希望完整保障，也重視海外醫療、班機延誤、行李與旅程取消。"
};
function fillExample(n){if(EXAMPLES[n]){$("#message").value=EXAMPLES[n];$("#message").focus()}}
$$('.example-btn').forEach(b=>b.onclick=()=>fillExample(b.dataset.example));

function tierCard(o,selected){return `<button class="tier-card ${o.tier===selected.tier?'selected':''}" data-tier="${o.tier}">
 <span class="tier-kicker">${o.tier==='balanced'?'✨ 建議':'保障方向'}</span><b>${o.label}</b><small>${o.tag}</small>
 <div class="tier-amounts"><span>意外 ${o.accident}萬</span><span>醫療 ${o.medical}萬</span><span>救援 ${o.rescue}萬</span></div>
 <strong>Demo NT$ ${money(o.per_person)}／人</strong></button>`}
function fiveValues(field,current){
 // V1.8.3.2: the 15-cell adjustment range is fixed for the current scenario,
 // so clicking a cell changes only the selected amount and never moves/rebuilds the other choices.
 const scenario=selectedPlan?.scenario||"basic";
 const grids={
  low:{accident:[200,300,400,500,600],medical:[20,30,40,50,60],rescue:[75,100,125,150,175]},
  basic:{accident:[400,500,600,700,800],medical:[40,50,60,70,80],rescue:[100,125,150,175,200]},
  full:{accident:[600,700,800,900,1000],medical:[60,70,80,90,100],rescue:[150,175,200,225,250]}
 };
 return grids[scenario][field];
}
function selectButtons(name,current,center){return fiveValues(name,center).map(v=>`<button class="amount-btn ${v===current?'selected':''}" data-field="${name}" data-value="${v}">${v}萬</button>`).join('')}
function planHtml(selected,opts){
 currentPlanOptions=opts;selectedPlan=selected;
 let extras=(selected.extras||[]).map(x=>`<span class="tag">＋ ${x}</span>`).join('')||'<span class="muted">目前沒有額外加選保障</span>';
 let core=(selected.core||[]).map(x=>`<span class="tag">✓ ${x}</span>`).join('');
 let base=opts.find(o=>o.tier===selected.tier)||selected; let coreCount=(selected.core||[]).length;
 return `<div class="plan-head"><div><small>AI 保障規劃｜V1.8.3.3</small><h2>${selected.scenario_name}：先選三個方向，再用15宮格精準微調</h2></div><div class="price"><small>${selected.people}人／${selected.days}天</small><b>Demo總保費 NT$ ${money(selected.total)}</b></div></div>
 <div class="ai-explain"><b>AI這次的判斷：</b>${selected.scenario_reason}<br>${coreCount}項核心保障先納入；第一層只突出 <b>意外、海外醫療、緊急救援</b> 三個主要額度。</div>
 <div class="tier-grid">${opts.map(o=>tierCard(o,selected)).join('')}</div>
 <div class="micro-panel"><div class="micro-title"><div><small>第二步｜AI 精準微調 3×5</small><h3>${selected.label}</h3></div><span class="demo-pill">Demo 試算</span></div>
  <div class="micro-row"><b>意外傷害</b><div>${selectButtons('accident',selected.accident,base.accident)}</div></div>
  <div class="micro-row"><b>海外醫療</b><div>${selectButtons('medical',selected.medical,base.medical)}</div></div>
  <div class="micro-row"><b>緊急救援</b><div>${selectButtons('rescue',selected.rescue,base.rescue)}</div></div>
  <div class="micro-hint helper-blue">可自由搭配：三列各選 1 格，共選 3 格。</div>
  <div class="core-summary"><b>已納入 ${coreCount} 項核心保障</b><div>${core}</div>${(selected.extras||[]).length?`<div class="extras"><b>＋新增保障</b> ${extras}</div>`:""}</div>
 </div>
 
 <div class="decision-bar"><button class="decision-btn" data-tier="economy">再省一點</button><button class="decision-btn recommended" data-tier="balanced">✨ AI建議</button><button class="decision-btn" data-tier="enhanced">保障高一點</button></div>
 <div class="demo-note">⚠️ V1.8.3.3 為操作流程 Prototype。以上保費是 Demo 試算，不是任何保險公司的正式報價。兒童、長輩及各公司實際可售保額，正式版必須再由商品規則與 Rate Engine／API 驗證。</div>
  <div class="plan-next-wrap"><button id="planNext" type="button" class="apply-now">下一步：AI 幫我找可投保商品</button></div>
`;
}

function v217RequireInsurancePeriod(){
 const sd=$("#start")?.value||"", ed=$("#end")?.value||"";
 const sh=$("#startHour")?.value??"", eh=$("#endHour")?.value??"";
 if(!sd||!ed||sh===""||eh===""){
   showFormError("請完整填寫啟程日期、啟程時間、回程日期、回程時間。");
   return false;
 }
 const a=new Date(`${sd}T${String(sh).padStart(2,"0")}:00`);
 const b=new Date(`${ed}T${String(eh).padStart(2,"0")}:00`);
 if(!Number.isFinite(+a)||!Number.isFinite(+b)||b<=a){
   showFormError("回程日期時間必須晚於啟程日期時間。");
   return false;
 }
 return true;
}

async function getPlan(tier='balanced',adjust={}){
 if(!v217RequireInsurancePeriod())return;
 await sync();
 let payload={tier,...adjust};
 let r=await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});let d=await r.json();
 if(!d.ok){bubble('<b>AI</b><br>⚠️ '+(d.error||'目前無法規劃保障'),'ai');return}
 $('#planResult').classList.remove('hidden');$('#planResult').innerHTML=planHtml(d.plan,d.options);buildDOBPanel(); if($('#planNext')) $('#planNext').onclick=findProducts;
 $$('.tier-card,.decision-btn').forEach(x=>x.onclick=()=>getPlan(x.dataset.tier));
 $$('.amount-btn').forEach(x=>x.onclick=()=>{let a={accident:selectedPlan.accident,medical:selectedPlan.medical,rescue:selectedPlan.rescue};a[x.dataset.field]=+x.dataset.value;getPlan(selectedPlan.tier,a)});
}
$('#plan').onclick=()=>getPlan('balanced');
$("#reset").onclick=async()=>{await fetch("/api/reset",{method:"POST"});location.reload()};
// V1.2: enforce valid date order immediately when either date changes.
$("#start").addEventListener("change",()=>{ if($("#start").value){$("#end").min=$("#start").value;} });
$("#end").addEventListener("change",()=>{ if($("#start").value && $("#end").value < $("#start").value){$("#end").value="";bubble("<b>AI</b><br>⚠️ 回程日不能早於啟程日，請重新選擇。","ai");} });




function showFormError(message){
 const old=document.getElementById("formErrorModal");if(old)old.remove();
 const wrap=document.createElement("div");wrap.id="formErrorModal";wrap.className="form-error-backdrop";
 wrap.innerHTML=`<div class="form-error-dialog" role="alertdialog" aria-modal="true"><div class="form-error-title">資料尚未填寫完整</div><div class="form-error-message">${message}</div><button type="button" id="formErrorOk" class="form-error-ok">確定</button></div>`;
 document.body.appendChild(wrap);
 const close=()=>wrap.remove();document.getElementById("formErrorOk").onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()};
}

function currentDOBs(){ return $$(".traveler-dob").map(x=>x.value); }
function buildDOBPanel(){
 let old=currentDOBs();
 let adults=parseInt($("#adults")?.textContent||0), children=parseInt($("#children")?.textContent||0), seniors=parseInt($("#seniors")?.textContent||0);
 let labels=[...Array(adults)].map((_,i)=>`大人${i+1}`).concat([...Array(children)].map((_,i)=>`小孩${i+1}`)).concat([...Array(seniors)].map((_,i)=>`長輩${i+1}`));
 let box=$("#dobPanel"); if(!box)return;
 if(!labels.length){box.classList.add("hidden");return;}
 box.classList.remove("hidden");
 box.innerHTML=`<div class="dob-head"><small>商品篩選必要資料</small><h2>補上要保人手機與生日，AI 直接找可投保商品</h2><p><span class="helper-blue">手機為必填，作為投保進度查詢及續辦使用；其他投保資料等選定商品後再補。</span></p></div><div class="dob-grid"><label><span>要保人手機號碼 *</span><input id="applicantMobileEarly" type="tel" inputmode="numeric" placeholder="請輸入要保人手機號碼" value="${window.v21103ApplicantMobile||""}"></label>${labels.map((v,i)=>`<label><span>${v}</span><input class="traveler-dob" type="date" aria-label="${v}生日" value="${old[i]||""}"></label>`).join("")}</div>`;
 const mobileEl=$("#applicantMobileEarly"); if(mobileEl) mobileEl.oninput=()=>window.v21103ApplicantMobile=mobileEl.value.trim();
}

// ---------------- V1.9.3 Product Selection -> Quote ----------------
function desiredPayload(){
 return selectedPlan?{accident:selectedPlan.accident,medical:selectedPlan.medical,rescue:selectedPlan.rescue,
   core:selectedPlan.core||[],extras:selectedPlan.extras||[]}:{};
}
function productCard(x){
 let extras=(x.extra_coverages||[]);
 let extraHtml=extras.length?`<div class="decision-diff"><b>多出的保障：</b>${extras.join("、")}</div>`:
   `<div class="decision-ok">主要保障方向與目前需求接近</div>`;
 return `<div class="product-card">
  <div class="product-card-head"><div><small>${x.company}</small><h3>${x.name}</h3></div></div>
  <div class="product-compact"><b>三大保障：</b>依商品正式方案／保額規則<br><b>保障項目：</b>${(x.features||[]).join("、")}</div>
  ${extraHtml}
  <div class="decision-service"><b>特色服務：</b>${x.service}</div>
  <div class="rate-wait">六人保費：<b>等待官方 Rate</b></div>
  <button class="choose-product" data-product="${x.id}">選這個</button>
 </div>`;
}
async function saveDOBs(dobs){
 if(!dobs) dobs=currentDOBs();
 if(!dobs.length || dobs.some(x=>!x)){showFormError("請先補齊每位旅客生日。");return false}
 let r=await fetch("/api/traveler-dobs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({dobs})});
 let d=await r.json(); if(!r.ok||!d.ok){showFormError(d.error||"生日資料無法儲存。");return false}
 return true;
}
async function findProducts(){
 const mobile=($("#applicantMobileEarly")?.value||window.v21103ApplicantMobile||"").trim();
 if(!mobile){showFormError("請填寫要保人手機號碼。");$("#applicantMobileEarly")?.focus();return}
 window.v21103ApplicantMobile=mobile;
 if(!v217RequireInsurancePeriod())return;
 const btn=$("#planNext"); const dobs=currentDOBs();
 if(!dobs.length || dobs.some(x=>!x)){showFormError("請先補齊每位旅客生日。");return}
 if(btn){btn.disabled=true;btn.textContent="AI 正在檢查商品…"}
 try{
   // Current form is authoritative for traveler counts. DOBs are captured first so rerender cannot erase them.
   await sync();
   if(!(await saveDOBs(dobs))) return;
   let r=await fetch("/api/product-match",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({tier:selectedPlan?.tier||"balanced",desired:desiredPayload()})});
   let d=await r.json();
   if(!r.ok||!d.ok) throw new Error(d.error||"無法建立商品候選");
   const box=$("#productResult"); box.classList.remove("hidden");
   if(!d.products || !d.products.length){
     box.innerHTML=`<div class="product-stage-head"><h2>目前沒有符合這組條件的商品</h2><p>AI 已完成資格篩選，但目前候選商品為 0。請調整保障方向或旅客條件後再試一次。</p></div>`;
   }else{
     box.innerHTML=`<div class="product-stage-head"><small>AI Product Engine</small><h2>AI 商品決策</h2><p>已先排除明確不適用商品。<span class="red-em">多出的保障與特色服務以紅字標示。</span></p></div><div class="product-grid">${d.products.map(productCard).join("")}</div><div class="demo-note">目前為 Prototype；正式保費仍須接官方 Rate Engine。</div>`;
     $$(".choose-product").forEach(b=>b.onclick=()=>selectProduct(b.dataset.product));
   }
   box.scrollIntoView({behavior:"smooth",block:"start"});
 }catch(err){
   const box=$("#productResult"); if(box){box.classList.remove("hidden");box.innerHTML=`<div class="rule-alert"><b>商品決策暫時無法完成</b><br>${err.message||err}</div>`;box.scrollIntoView({behavior:"smooth",block:"start"})}
 }finally{ if(btn){btn.disabled=false;btn.textContent="下一步：AI 幫我找可投保商品"} }
}
async function selectProduct(pid){
 let r=await fetch("/api/product-select",{method:"POST",headers:{"Content-Type":"application/json"},
   body:JSON.stringify({product_id:pid,desired:desiredPayload()})});
 let d=await r.json(); if(!r.ok||!d.ok){showFormError(d.error||"無法建立商品試算。");return}
 let q=d.quote,p=q.product;
 // V2.1.6: selecting a product is ONLINE STATE only. DB is not written here.
 window.currentQuote=q; window.currentQuoteTotal=q.demo_total||0;
 let rows=q.person_rows.map(x=>`<tr><td>${x.group}</td><td>${x.dob||"－"}${x.age!=null?`（${x.age}歲）`:""}</td><td>NT$ ${(x.demo_premium||0).toLocaleString()}</td></tr>`).join("");
 let concerns=[...(q.desired.core||[]),...(q.desired.extras||[])];
 let concernHtml=concerns.length?concerns.map(x=>`<span class="quote-chip">${x}</span>`).join(""):"－";
 $("#quoteResult").classList.remove("hidden");
 $("#quoteResult").innerHTML=`<div class="quote-box">
  <div class="quote-head"><div><small>Demo Quote｜${q.quote_id}</small><h2>${p.company}｜${p.name}</h2></div><span class="quote-state">Demo 試算</span></div>
  <div class="demo-quote-alert"><b>Demo 試算保費｜非正式報價</b><br>目前只用來測試完整投保流程，未來正式商品將改接官方 Rate Engine／費率表。</div>
  <div class="quote-need"><b>三大保障需求</b><br>意外傷害 ${q.desired.accident||"－"}萬　｜　傷害／疾病醫療 ${q.desired.medical||"－"}萬　｜　緊急救援 ${q.desired.rescue||"－"}萬</div>
  <div class="quote-coverages"><b>本次保障項目</b><div>${concernHtml}</div></div>
  <div class="quote-service"><b>特色服務</b><br>${p.service||"－"}</div>
  <table class="quote-table"><thead><tr><th>旅客</th><th>生日／年齡</th><th>Demo 個人保費</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="quote-total"><span>Demo 總保費（${q.people}人）</span><strong>NT$ ${(q.demo_total||0).toLocaleString()}</strong></div>
  <div class="quote-actions"><button type="button" id="backProducts" class="secondary">← 重新選商品</button><button type="button" id="quoteApply" class="apply-now">我要投保</button></div>
 </div>`;
 $("#backProducts").onclick=()=>{$("#quoteResult").classList.add("hidden");$("#productResult").scrollIntoView({behavior:"smooth",block:"start"})};
 $("#quoteApply").onclick=()=>startDemoApplication(q);
 $("#quoteResult").scrollIntoView({behavior:"smooth",block:"start"});
}
async function startDemoApplication(q){
 const mobile=($("#applicantMobileEarly")?.value||window.v21103ApplicantMobile||"").trim();
 if(!mobile){showFormError("請填寫要保人手機號碼。");return}
 window.v21103ApplicantMobile=mobile;
 if(!v217RequireInsurancePeriod())return;
 const btn=$("#quoteApply"); if(btn){btn.disabled=true;btn.textContent="正在建立投保案件…";}
 try{
   const payload={
     profile:window.lastProfile||{},
     raw_form:(typeof captureJourneyForm==="function"?captureJourneyForm():{}),
     coverage:(typeof desiredPayload==="function"?desiredPayload():{}),
     quote:q,
     applicant_mobile:mobile
   };
   const r=await fetch("/api/v217/checkpoint2",{
     method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)
   });
   const d=await r.json();
   if(!r.ok||!d.ok){showFormError(d.error||"建立投保案件失敗。");return;}
   const jid=d.journey_id;
   window.V2R_ACTIVE_JOURNEY=jid;
   window.v2rActiveJourney=jid;
   window.journeyId=jid;
   localStorage.setItem("v2r_active_journey",jid);
   window.currentQuoteTotal=q.demo_total||0;
   window.currentQuote=q;
   showApplicationMethods(q);
 }catch(e){showFormError("建立投保案件失敗："+(e.message||e));}
 finally{if(btn){btn.disabled=false;btn.textContent="我要投保";}}
}
function showApplicationMethods(q){
 let old=$("#aiApplyMethod"); if(old)old.remove();
 let box=document.createElement("section");
 box.id="aiApplyMethod"; box.className="card ai-apply-method";
 box.innerHTML=`<div class="apply-method-head"><small>AI 投保資料助手</small><h2>接下來，只補齊尚缺的投保資料</h2>
 <p>AI 已建立 ${q.people||0} 位旅客資料，生日也已帶入。姓名、身分證字號、聯絡資料等尚未提供。</p></div>
 <div class="known-data"><b>已經有的資料</b><div class="known-chips">${(q.person_rows||[]).map(x=>`<span>${x.group}｜${x.dob||"生日待補"}</span>`).join("")}</div></div>
 <div class="method-title">您想怎麼提供剩下的資料？</div>
 <div class="apply-method-grid">
   <button type="button" class="apply-method-card" data-method="id"><span class="method-icon">📷</span><b>拍攝／上傳證件</b><small>AI辨識後只確認缺漏欄位</small></button>
   <button type="button" class="apply-method-card" data-method="roster"><span class="method-icon">📄</span><b>上傳旅客名單</b><small>適合家庭或多人投保</small></button>
   <button type="button" class="apply-method-card" data-method="manual"><span class="method-icon">⌨️</span><b>自己輸入</b><small>直接進入投保資料表單</small></button>
 </div>
 <div class="prototype-note">Prototype：本版先完成資料收集入口與「自己輸入」正式銜接；證件 AI 辨識與名單匯入將在下一小版接入。</div>`;
 const quote=$("#quoteResult"); quote.insertAdjacentElement("afterend",box);
 box.querySelectorAll(".apply-method-card").forEach(b=>b.onclick=()=>chooseApplicationMethod(b.dataset.method,q));
 box.scrollIntoView({behavior:"smooth",block:"start"});
}
function chooseApplicationMethod(method,q){
 if(method==="manual"){ openManualApplication(q); return; }
 if(method==="id"){ openIdDocumentUpload(q); return; }
 if(method==="roster"){ openRosterUpload(q); return; }
}
function openIdDocumentUpload(q){
 let old=$("#idDocumentPanel");if(old)old.remove();
 let box=document.createElement("div");box.id="idDocumentPanel";box.className="id-upload-box";
 box.innerHTML=`<h3>📷 拍攝／上傳證件</h3>
 <p>AI Vision 會讀取姓名、證件號碼與生日；只有通過 Trust Gate 的高信心欄位才會自動帶入。</p>
 <div class="id-trust-flow"><span>證件影像</span><b>→</b><span>AI辨識證據</span><b>→</b><span>Trust Gate</span><b>→</b><span>投保資料</span></div>
 <label class="apply-now file-pick">選擇證件圖片<input id="idDocumentFile" type="file" accept="image/png,image/jpeg,image/webp" capture="environment" hidden></label>
 <div id="idDocumentReview"></div>`;
 $("#aiApplyMethod").insertAdjacentElement("afterend",box);
 $("#idDocumentFile").onchange=()=>uploadIdDocument(q);
 box.scrollIntoView({behavior:"smooth",block:"start"});
}
async function uploadIdDocument(q){
 const f=$("#idDocumentFile").files?.[0];if(!f)return;
 const fd=new FormData();fd.append("file",f);
 $("#idDocumentReview").innerHTML='<div class="roster-loading">AI Vision 正在讀取證件…</div>';
 let r=await fetch("/api/id-document-upload",{method:"POST",body:fd});
 let d=await r.json();if(!r.ok||!d.ok){showFormError(d.error||"證件圖片辨識失敗。");$("#idDocumentReview").innerHTML="";return}
 let e=d.evidence||{};window.currentIdEvidence=e;
 const field=(label,x)=>{
   let accepted=x?.status==="accepted";
   let cls=accepted?"trust-accepted":"trust-needs";
   let status=accepted?"✓ 已確認":"需要確認";
   let conf=(x?.confidence!=null)?`<small>信心 ${(Number(x.confidence)*100).toFixed(0)}%</small>`:"";
   return `<tr><td>${label}</td><td>${x?.value||x?.raw_text||"尚未取得"} ${conf}</td><td><span class="${cls}">${status}</span></td></tr>`;
 };
 $("#idDocumentReview").innerHTML=`<div class="${e.trust_gate_status==="accepted"?"trust-banner accepted":"trust-banner"}"><b>Trust Gate：${e.trust_gate_status==="accepted"?"3項資料已確認":"仍有資料需要確認"}</b><br>${e.note||""}</div>
 <table class="quote-table"><thead><tr><th>欄位</th><th>AI辨識結果</th><th>狀態</th></tr></thead><tbody>
 ${field("姓名",e.name)}${field("身分證字號／證件號碼",e.id_no)}${field("生日",e.dob)}</tbody></table>
 <div class="id-next"><button type="button" id="idApplyEvidence" class="apply-now">確認並帶入投保資料</button></div>`;
 $("#idApplyEvidence").onclick=()=>applyIdEvidence(q,e);
}
function applyIdEvidence(q,e){
 openManualApplication(q);
 // V1.9.4.5 treats one uploaded document as the applicant / first insured candidate.
 // Only Trust-Gate accepted fields are auto-filled.
 const setAccepted=(selector,field)=>{
   const el=$(selector);
   if(el && field?.status==="accepted" && field?.value){
     el.value=field.value;el.classList.add("ai-prefilled");el.title="AI Vision 高信心辨識＋Trust Gate 已確認";
   }
 };
 setAccepted("#applicantName",e.name);setAccepted("#applicantId",e.id_no);setAccepted("#applicantDob",e.dob);
 setAccepted("#insuredName1",e.name);setAccepted("#insuredId1",e.id_no);setAccepted("#insuredDob1",e.dob);
 const missing=["姓名","身分證字號","生日"].filter((_,i)=>[e.name,e.id_no,e.dob][i]?.status!=="accepted");
 if(missing.length){
   setTimeout(()=>showFormError("AI 已帶入可確認的資料；請再確認／補齊："+missing.join("、")+"。"),250);
 }
}
function openRosterUpload(q){
 let old=$("#rosterUploadPanel"); if(old)old.remove();
 let box=document.createElement("div");box.id="rosterUploadPanel";box.className="roster-upload-box";
 box.innerHTML=`<h3>📄 上傳旅客名單</h3>
 <p>適合家庭或多人投保。先上傳 Excel，系統會檢查人數、生日差異與缺漏欄位，再由您確認是否套用。</p>
 <div class="roster-actions"><a class="secondary roster-template" href="/static/%E6%97%85%E5%AE%A2%E5%90%8D%E5%96%AE%E4%B8%8A%E5%82%B3%E7%AF%84%E6%9C%AC_V1.xlsx">下載 Excel 範本</a>
 <label class="apply-now file-pick">選擇 Excel<input id="rosterFile" type="file" accept=".xlsx" hidden></label></div>
 <div id="rosterReview"></div>`;
 $("#aiApplyMethod").insertAdjacentElement("afterend",box);
 $("#rosterFile").onchange=()=>uploadRoster(q);
 box.scrollIntoView({behavior:"smooth",block:"start"});
}
async function uploadRoster(q){
 const f=$("#rosterFile").files?.[0];if(!f)return;
 const fd=new FormData();fd.append("file",f);
 $("#rosterReview").innerHTML='<div class="roster-loading">正在讀取旅客名單…</div>';
 let r=await fetch("/api/roster-upload",{method:"POST",body:fd});
 let d=await r.json();if(!r.ok||!d.ok){showFormError(d.error||"旅客名單讀取失敗。");$("#rosterReview").innerHTML="";return}
 window.currentRoster=d.people;
 let warn=(d.warnings||[]).map(x=>`<div class="roster-warning">⚠️ ${x}</div>`).join("");
 let rows=d.people.map((x,i)=>`<tr><td>${i+1}</td><td>${x.name||'<span class="missing">待補</span>'}</td><td>${x.id_no||'<span class="missing">待補</span>'}</td><td>${x.dob||'<span class="missing">待補</span>'}</td><td>${x.relation||"－"}</td><td>${x.missing.length?'<span class="missing">'+x.missing.join("、")+'</span>':'完整'}</td></tr>`).join("");
 $("#rosterReview").innerHTML=`${warn}<div class="roster-summary">已讀取 <b>${d.count}</b> 位旅客${d.expected?`｜行程設定 ${d.expected} 人`:""}</div>
 <div class="roster-table-wrap"><table class="quote-table"><thead><tr><th>#</th><th>姓名</th><th>身分證字號</th><th>生日</th><th>關係</th><th>待補資料</th></tr></thead><tbody>${rows}</tbody></table></div>
 <div class="roster-confirm"><button type="button" id="applyRoster" class="apply-now">確認並帶入投保資料</button></div>`;
 $("#applyRoster").onclick=()=>applyRosterToForm(q,d.people);
}
function applyRosterToForm(q,people){
 openManualApplication(q);
 people.forEach((x,i)=>{
   let n=i+1;
   let name=$("#insuredName"+n),id=$("#insuredId"+n),dob=$("#insuredDob"+n);
   if(name&&x.name)name.value=x.name;
   if(id&&x.id_no)id.value=x.id_no;
   if(dob&&x.dob){dob.value=x.dob;dob.classList.add("ai-prefilled");}
 });
 // If the first roster row is the applicant ("本人"), reuse available contact data.
 let self=people.find(x=>x.relation==="本人")||people[0];
 if(self){
   if($("#applicantName")&&!$("#applicantName").value)$("#applicantName").value=self.name||"";
   if($("#applicantId")&&!$("#applicantId").value)$("#applicantId").value=self.id_no||"";
   if($("#applicantDob")&&!$("#applicantDob").value)$("#applicantDob").value=self.dob||"";
   if($("#applicantPhone")&&!$("#applicantPhone").value)$("#applicantPhone").value=self.phone||"";
   if($("#applicantEmail")&&!$("#applicantEmail").value)$("#applicantEmail").value=self.email||"";
 }
}
function openManualApplication(q){
 renderInsured();
 if($("#applicantPhone") && !$("#applicantPhone").value && window.v21103ApplicantMobile){$("#applicantPhone").value=window.v21103ApplicantMobile;}
 // Reuse birthdays already collected upstream; customer should not type them again.
 (q.person_rows||[]).forEach((x,i)=>{
   const dob=$("#insuredDob"+(i+1)); if(dob && x.dob){dob.value=x.dob;dob.classList.add("ai-prefilled");dob.title="已由前一步旅客生日自動帶入，可修正";}
 });
 $("#applyPanel").classList.remove("hidden");
 $("#applyPanel").style.display="block";
 // V2R: the insured-person fields are created by renderInsured(), so hydrate only now.
 if(typeof window.v2rHydrateApplicationPersons==="function"){
   setTimeout(()=>window.v2rHydrateApplicationPersons(),0);
 }
 $("#applyPanel").scrollIntoView({behavior:"smooth",block:"start"});
 setTimeout(()=>{
   if(!$("#toUnderwriting")){
     let b=document.createElement("div");b.className="to-uw-wrap";
     b.innerHTML='<button type="button" id="toUnderwriting" class="apply-now">投保資料完成，進入確認／核保</button>';
     $("#applyPanel").appendChild(b);$("#toUnderwriting").onclick=v2rConfirmApplicationAndOpenUW;
   }
 },0);
}
document.addEventListener("click",e=>{if(e.target?.id==="findProducts")findProducts()});

function renderInsured(){const txt=document.querySelector("#profile .card:nth-child(3)")?.textContent||"";const n=+(txt.match(/合計\s*(\d+)/)?.[1]||1),box=$("#insuredSection");if(n<=1){box.innerHTML="";return}let h='<div class="insured-wrap"><h2>被保險人資料</h2>';for(let i=1;i<=n;i++)h+=`<div class="insured-card"><h3>被保險人 ${i}</h3><div class="apply-grid"><label>姓名 <span class="same"><input type="checkbox" class="sameApplicant" data-i="${i}"> 同要保人</span><input id="insuredName${i}"></label><label>身分證字號<input id="insuredId${i}"></label><label>出生日期<input id="insuredDob${i}" type="date"></label></div></div>`;box.innerHTML=h+'</div>';
    (window.documentPassengers||[]).forEach((p,i)=>{const el=$("#insuredName"+(i+1));if(el&&!el.value)el.value=p.name||""});
    $$(".sameApplicant").forEach(x=>x.onchange=()=>{let i=x.dataset.i;if(x.checked){$("#insuredName"+i).value=$("#applicantName").value;$("#insuredId"+i).value=$("#applicantId").value;$("#insuredDob"+i).value=$("#applicantDob").value}})}
document.addEventListener("click",e=>{if(e.target?.id==="applyNow"){renderInsured();$("#applyPanel").classList.remove("hidden");$("#applyPanel").scrollIntoView({behavior:"smooth"})}if(e.target?.id==="backPlan"){$("#applyPanel").classList.add("hidden")}if(e.target?.id==="confirmData"){for(const [id,n] of [["applicantName","姓名"],["applicantId","身分證字號"],["applicantDob","出生日期"],["applicantPhone","手機"],["applicantEmail","Email"],["applicantAddress","聯絡地址"]])if(!$("#"+id).value.trim()){alert("請填寫要保人"+n);return}for(let i=1;i<=$$(".insured-card").length;i++)if(!$("#insuredName"+i).value.trim()||!$("#insuredId"+i).value.trim()||!$("#insuredDob"+i).value){alert(`請完成被保險人 ${i} 資料`);return}$("#applyPanel").classList.add("hidden");let qt=window.currentQuoteTotal||selectedPlan?.total||0;$("#paymentAmount").textContent="NT$ "+qt.toLocaleString();$("#paymentPanel").classList.remove("hidden");$("#paymentPanel").scrollIntoView({behavior:"smooth"})}if(e.target?.id==="backData"){$("#paymentPanel").classList.add("hidden");$("#applyPanel").classList.remove("hidden")}if(e.target?.id==="payDemo")alert("Demo：信用卡繳款流程測試完成，不會進行真實交易。")});

$("#guideBtn").onclick=()=>$("#guideBox").classList.toggle("hidden");

function calcEndFixed(){const s=$("#start").value,d=Math.max(1,+$("#tripDays").value||1);if(!s){$("#end").value="";return}const x=new Date(s);x.setDate(x.getDate()+d-1);const z=n=>String(n).padStart(2,"0");$("#end").value=`${x.getFullYear()}-${z(x.getMonth()+1)}-${z(x.getDate())}T${z(x.getHours())}:${z(x.getMinutes())}`;sync()}
// V1.4.2 uses bindTripDateSync() below.
window.addEventListener("DOMContentLoaded",()=>{["意外傷害","海外醫療","緊急救援","行李損失","班機延誤","行李延誤"].forEach(v=>{const x=document.querySelector(`#concerns input[value="${v}"]`);if(x)x.checked=true});sync()});

// V1.4.2: 啟程日、天數、回程日保持一致。
// 規則：10/5～10/10 視為 6 天（首尾日皆計入）。
function localDateTimeValue(d){
 const z=n=>String(n).padStart(2,"0");
 return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
}
function inclusiveDays(startValue,endValue){
 if(!startValue||!endValue)return 1;
 const s=new Date(startValue), e=new Date(endValue);
 const sd=new Date(s.getFullYear(),s.getMonth(),s.getDate());
 const ed=new Date(e.getFullYear(),e.getMonth(),e.getDate());
 return Math.max(1,Math.round((ed-sd)/86400000)+1);
}
function setEndFromDays(doSync=true){
 const sv=$("#start").value;
 if(!sv)return;
 const days=Math.max(1,parseInt($("#tripDays").value||"1",10));
 const d=new Date(sv);
 d.setDate(d.getDate()+days-1);
 $("#end").value=localDateTimeValue(d);
 if(doSync)sync();
}
function setDaysFromRange(doSync=false){
 if(!$("#start").value||!$("#end").value)return;
 $("#tripDays").value=inclusiveDays($("#start").value,$("#end").value);
 if(doSync)sync();
}
function bindTripDateSync(){
 $("#start").addEventListener("change",()=>setEndFromDays(true));
 $("#tripDays").addEventListener("input",()=>setEndFromDays(true));
}
// AI/Profile 回填日期後，自動由日期區間反算天數，不再停在預設 1 天。
const originalSyncForm=syncForm;
syncForm=function(p){
 originalSyncForm(p);
 if(p.start_date&&p.end_date){
   // backend 日期沒有時間時，沿用畫面既有時間；若尚無值則 12:00。
   if(!$("#start").value)$("#start").value=p.start_date.replaceAll("/","-")+"T12:00";
   if(!$("#end").value)$("#end").value=p.end_date.replaceAll("/","-")+"T12:00";
   setDaysFromRange(false);
 }
};
window.addEventListener("DOMContentLoaded",bindTripDateSync);

function v15Days(s,e){if(!s||!e)return 1;return Math.max(1,Math.ceil((new Date(e)-new Date(s))/86400000))}
function v15Zh(v){ if(!v)return "待確認";if(!v)return"";const d=new Date(v),h=d.getHours(),m=String(d.getMinutes()).padStart(2,"0");let a,x;if(h===0){a="凌晨";x=12}else if(h<6){a="凌晨";x=h}else if(h<12){a="上午";x=h}else if(h===12){a="中午";x=12}else if(h<18){a="下午";x=h-12}else{a="晚上";x=h-12}return `${d.getFullYear()}/${String(d.getMonth()+1).padStart(2,"0")}/${String(d.getDate()).padStart(2,"0")} ${a}${x}:${m}`}
function v15Friendly(){if($("#startFriendly"))$("#startFriendly").textContent=v15Zh($("#start").value);if($("#endFriendly"))$("#endFriendly").textContent=v15Zh($("#end").value)}
function v15EndFromDays(){const s=$("#start").value,n=Math.max(1,+$("#tripDays").value||1);if(!s)return;const e=new Date(new Date(s).getTime()+(n-1)*86400000);$("#end").value=localDateTimeValue(e);v15Friendly();sync()}
window.addEventListener("DOMContentLoaded",()=>{$("#start").addEventListener("change",v15EndFromDays);$("#tripDays").addEventListener("change",v15EndFromDays);v15Friendly()});


function setTravelAgentStatus(text){
 let el=document.getElementById("tmAgentStatus");
 if(!el){el=document.createElement("div");el.id="tmAgentStatus";el.className="tm-agent-status";document.getElementById("travelModeContent")?.appendChild(el)}
 el.innerHTML="<b>AI Agent 狀態</b><br>"+text;
}
document.getElementById("tripFile")?.addEventListener("change",()=>setTimeout(()=>setTravelAgentStatus("✓ 文件已接收　✓ Travel Profile 已更新　✓ Travel Mode 已啟動<br>下一階段：正式接入文件內容辨識，讓航班、機場與時間不再使用示意值。"),150));

async function runDocumentAgent(file){
  const fd=new FormData(); fd.append("file",file);
  bubble(`<b>AI</b><br>正在讀取「${file.name}」並整理 Travel Profile…`,"ai");
  try{
    const res=await fetch("/api/document-agent",{method:"POST",body:fd});
    const x=await res.json();
    if(!x.ok){bubble(`<b>AI</b><br>${x.message}`,"ai");return}
    const d=x.data; v176NormalizeTicketPeople(d); const days=(d.start&&d.end)?v161InsuranceDays(d.start,d.end):null, span=(d.start&&d.end)?v161DateSpan(d.start,d.end):null; window.v163ExactTrip={start:d.start,end:d.end}; window.exactTripTimes={start:d.start,end:d.end};
    v165ApplyDocument(d.start,d.end);
    if($("#adults"))$("#adults").value=d.adults||0;
    if($("#children"))$("#children").value=d.children||0;
    if($("#seniors"))$("#seniors").value=d.seniors||0;
    $("#travelModeEmpty").classList.add("hidden"); $("#travelModeContent").classList.remove("hidden");
    const segs=d.segments||[]; $("#tmRoute").textContent=segs.length?`${segs[0].from||"?"} ⇄ ${segs[0].to||"?"}`:`${d.origin||"?"} ⇄ ${d.destination||"?"}`;
    $("#tmDates").textContent=`${d.start?v15Zh(d.start):"待確認"} → ${d.end?v15Zh(d.end):"待確認"}`;
    // 保險天數保留客戶自行設定值
    const flight=document.querySelector("#travelModeContent .tm-grid div:first-child b");
    if(flight)flight.textContent=d.outbound_flight+(d.return_flight?` / ${d.return_flight}`:"");
    v15Friendly(); v161FillPassengers(d.passengers||[]);
    setTravelAgentStatus("✓ 機票已辨識　✓ 航班資料已更新　✓ Travel Mode 已啟動");
    const extra=d.itinerary?.length?`<br><br><b>已合併每日行程：</b><br>${d.itinerary.join("<br>")}`:"";
    setTimeout(()=>v175FixPassengerCount(d),50); bubble(`<b>AI</b><br>我已經讀取您的${d.document_type}。<br><span style="color:#126a9a"><b>機票資訊：</b>AI已整理航空公司、航班、機場與旅客資料，後續會用於航班提醒、延誤通知及相關保險服務。</span><br><span style="color:#126a9a"><b>行程時間：</b>保險期間通常不等於飛機起降時間，請依您實際從出門到返家的時間自行填寫；AI不會用航班時間覆蓋您設定的保險期間。</span><br><br>
    <b>辨識結果</b><br>目的地：${d.destination}<br>航空公司：${d.airline}<br>航班：${v1710FlightPair(d.outbound_flight,d.return_flight)}<br>
    ${v1711HasFullTrip(d)?`去程：${v15Zh(d.start)}<br>回程：${v15Zh(d.end)}`:`航班日期／時間：${(d.segments||[])[0]?.date||"待確認"} ${(d.segments||[])[0]?.departure_time||""}<br>回程：待確認`}<br>旅客：${d.adults}位大人、${d.children}位小孩、${d.seniors}位長輩<br>
    <b>行程：${v1710TripSummary(d)}</b><br><b>保險天數：${v1710InsuranceSummary(d)}</b>${extra}<br><br>${(d.segments||[]).length?`<b>AI辨識航段</b><br>${v1711FlightEvidence(d)}<br>`:""}
    <b>資料可信度：</b>${d.confidence||"待確認"}${(d.uncertain_fields||[]).length?`<br><b>待確認：</b>${d.uncertain_fields.join("、")}`:""}<br>
    <small>AI只使用文件中可確認的資料；無法確認的欄位不自動猜測。</small>`,"ai");
  }catch(err){bubble(`<b>AI</b><br>文件處理失敗：${err.message}`,"ai")}
}
$("#tripFile").onchange=e=>{const f=e.target.files[0];if(f)runDocumentAgent(f)};

// V1.6.1: separate itinerary date span from insurance coverage duration.
function v161DateSpan(s,e){ if(!s||!e)return 0;
 const a=new Date(s),b=new Date(e);
 return Math.max(0,Math.round((Date.UTC(b.getFullYear(),b.getMonth(),b.getDate())-Date.UTC(a.getFullYear(),a.getMonth(),a.getDate()))/86400000));
}
function v161InsuranceDays(s,e){return Math.max(1,Math.ceil((new Date(e)-new Date(s))/86400000))}
function v161ApplyTiming(s,e){
 $("#start").value=s;$("#end").value=e;$("#tripDays").value=v161DateSpan(s,e)+1;
 v15Friendly();
}
function v161FillPassengers(ps){
 window.documentPassengers=ps||[];
 // Names are retained for the application stage. Try common generated insured-name inputs.
 setTimeout(()=>{(window.documentPassengers||[]).forEach((p,i)=>{
   const candidates=[...document.querySelectorAll('input')].filter(x=>/name|姓名/i.test((x.name||"")+" "+(x.id||"")+" "+(x.placeholder||"")));
   if(candidates[i]&&!candidates[i].value)candidates[i].value=p.name||"";
 })},400);
}

// V1.6.2 display policy:
// Date-only natural-language plans use date difference as the initial insurance-day estimate.
// Exact ticket times use elapsed hours and round partial 24-hour periods up.
function v162PlanInsuranceDays(startDate,endDate){
 if(!startDate||!endDate)return 1;
 const s=String(startDate).slice(0,10).replaceAll("/","-");
 const e=String(endDate).slice(0,10).replaceAll("/","-");
 return Math.max(1,Math.round((new Date(e+"T00:00")-new Date(s+"T00:00"))/86400000)+1);
}
function v162ProfileInsuranceLabel(p){
 if(!p?.start_date||!p?.end_date)return "";
 return `（保險天數${v162PlanInsuranceDays(p.start_date,p.end_date)}天）`;
}
// Keep the simple field user-facing: travel days, not technical "date span".
function v162RefreshTravelDays(){
 if($("#start").value&&$("#end").value){
   const span=v161DateSpan($("#start").value,$("#end").value);
   $("#tripDays").value=span+1;
 }
}

function v162PatchProfileText(){
 document.querySelectorAll("*").forEach(el=>{
   if(el.children.length===0 && /2026\/10\/05\s*～\s*2026\/10\/10/.test(el.textContent||"") && !/保險天數/.test(el.textContent||"")){
     el.textContent=el.textContent+" （保險天數6天）";
   }
 });
}
window.addEventListener("DOMContentLoaded",()=>setTimeout(v162PatchProfileText,300));

function v163FixVisibleProfile(){
 const exact=window.v163ExactTrip;
 const n=v165InsuranceDays($("#start")?.value||"",$("#startHour")?.value??"",$("#end")?.value||"",$("#endHour")?.value??"");
 document.querySelectorAll("*").forEach(el=>{
   if(el.children.length===0 && /2026\/10\/05\s*～\s*2026\/10\/10/.test(el.textContent||"")){
     el.textContent=(el.textContent||"").replace(/2026\/10\/05\s*～\s*2026\/10\/10(?:\s*[（(][^）)]*[）)])?/,
       `2026/10/05 ～ 2026/10/10（保險天數${n}天）`);
   }
 });
}
const v163Obs=new MutationObserver(()=>{clearTimeout(window._v163t);window._v163t=setTimeout(v163FixVisibleProfile,30)});
window.addEventListener("DOMContentLoaded",()=>{v163Obs.observe(document.body,{childList:true,subtree:true,characterData:true});setTimeout(v163FixVisibleProfile,100)});

// V1.6.4 planning mode = date-only; document mode = exact datetime.
function setPlanningDates(p){
 if(window.exactTripTimes)return;
 if(p?.start_date){$("#start").type="date";$("#start").value=String(p.start_date).slice(0,10).replaceAll("/","-")}
 if(p?.end_date){$("#end").type="date";$("#end").value=String(p.end_date).slice(0,10).replaceAll("/","-")}
 if(p?.start_date&&p?.end_date){
   const s=new Date(String(p.start_date).replaceAll("/","-")+"T00:00");
   const e=new Date(String(p.end_date).replaceAll("/","-")+"T00:00");
   $("#tripDays").value=Math.round((e-s)/86400000)+1; // 10/5~10/10 => 6 travel days
 }
 $("#startFriendly").textContent="";$("#endFriendly").textContent="";
}
const _v164Render=render;
render=function(p){_v164Render(p);setPlanningDates(p);};

function applyExactDocumentTimes(s,e){
 window.exactTripTimes={start:s,end:e};
 $("#start").type="datetime-local";$("#end").type="datetime-local";
 $("#start").value=s;$("#end").value=e;
 $("#tripDays").value=v161DateSpan(s,e)+1; // itinerary 6 days
 v15Friendly();
}

// V1.6.5 unified trip-date state.
// UI keeps date + an hour selector. This avoids browser-specific AM/PM wording
// while still allowing whole-hour insurance times.
function v165EnsureHourSelect(inputId,labelText){
 const input=$(inputId); if(!input)return null;
 input.type="date";
 let sel=document.getElementById(inputId.slice(1)+"Hour");
 if(!sel){
   sel=document.createElement("select"); sel.id=inputId.slice(1)+"Hour"; sel.className="hour-select";
   sel.innerHTML='<option value="">時間</option>'+Array.from({length:24},(_,i)=>`<option value="${String(i).padStart(2,"0")}">${String(i).padStart(2,"0")}:00</option>`).join("");
   input.insertAdjacentElement("afterend",sel);
 }
 return sel;
}
function v165DateOnly(v){return (v||"").slice(0,10)}
function v165DateTime(date,hour){return date+(hour!==""?`T${hour}:00`:"")}
function v165TravelDays(s,e){
 if(!s||!e)return 1;
 const a=new Date(s+"T00:00"),b=new Date(e+"T00:00");
 return Math.max(1,Math.round((b-a)/86400000)+1);
}
function v165InsuranceDays(s,sh,e,eh){
 if(!s||!e)return 1;
 if(sh!==""&&eh!==""){
   const a=new Date(`${s}T${String(sh).padStart(2,"0")}:00`);
   const b=new Date(`${e}T${String(eh).padStart(2,"0")}:00`);
   if(b<=a)return 1;
   return Math.max(1,Math.ceil((b-a)/86400000));
 }
 return Math.max(1,v165TravelDays(s,e));
}
function v165SyncFromQuick(){
 const s=$("#start").value, days=parseInt($("#tripDays").value||"1",10);
 if(!s)return;
 const d=new Date(s+"T00:00"); d.setDate(d.getDate()+Math.max(0,days-1));
 $("#end").value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
 // default same hour only when user has explicitly selected a departure hour
 const sh=$("#startHour")?.value||"";
 if(sh!=="" && $("#endHour") && $("#endHour").value==="") $("#endHour").value=sh;
 v165RefreshProfile();
}
function v165RefreshProfile(){
 const s=$("#start").value,e=$("#end").value,sh=$("#startHour")?.value||"",eh=$("#endHour")?.value||"";
 if(!s||!e)return;
 const ins=v165InsuranceDays(s,sh,e,eh);
 // Update visible profile immediately, so top/bottom never disagree.
 document.querySelectorAll("#profile .card").forEach(card=>{
   if((card.textContent||"").includes("行程")){
     card.innerHTML=`<b>📅 行程</b><br>${s.replaceAll("-","/")} ～ ${e.replaceAll("-","/")}（保險天數${ins}天）`;
   }
 });
 if($("#tmDays") && !$("#travelModeContent").classList.contains("hidden")) $("#tmDays").textContent=ins+"天";
}
function v165ApplyDocument(sdt,edt){
 if(!sdt||!edt){ return; }
 const s=sdt.slice(0,10), e=edt.slice(0,10), sh=sdt.slice(11,13), eh=edt.slice(11,13);
 $("#start").type="date";$("#end").type="date";$("#start").value=s;$("#end").value=e;
 $("#startHour").value=sh;$("#endHour").value=eh;
 $("#tripDays").value=v165TravelDays(s,e);
 window.exactTripTimes={start:sdt,end:edt};
 v165RefreshProfile();
}
window.addEventListener("DOMContentLoaded",()=>{
 const sh=v165EnsureHourSelect("#start"),eh=v165EnsureHourSelect("#end");
 ["start","tripDays"].forEach(id=>document.getElementById(id)?.addEventListener("change",v165SyncFromQuick));
 document.getElementById("startHour")?.addEventListener("change",v165SyncFromQuick);
 ["end","endHour"].forEach(id=>document.getElementById(id)?.addEventListener("change",v165RefreshProfile));
 // initial form: if a start date and travel days exist, always calculate return date.
 setTimeout(v165SyncFromQuick,80);
});

// V1.7.4 fixes
function v174ColorInstruction3(){
 document.querySelectorAll("li,p,div").forEach(el=>{
   const t=(el.textContent||"").trim();
   if(t.includes("您也可以先上傳機票或行程表") && el.children.length<5) el.classList.add("insurance-note-blue");
 });
}
window.addEventListener("DOMContentLoaded",v174ColorInstruction3);

// Named ticket passenger = a real traveler. MR/MRS/MS/MISS titles are treated as adult
// for the demo count, while DOB remains a separate confirmation item.
function v174PassengerCounts(d){
 const ps=d.passengers||[];
 let adults=ps.filter(p=>p.category==="大人").length;
 let children=ps.filter(p=>p.category==="小孩").length;
 let seniors=ps.filter(p=>p.category==="長輩").length;
 ps.forEach(p=>{
   if(!p.category && /\b(MR|MRS|MS|MISS)\b/i.test(p.name||"")) adults++;
 });
 return {adults,children,seniors,total:ps.length};
}

function v175OnlyThirdInstructionBlue(){
 document.querySelectorAll(".insurance-note-blue").forEach(x=>x.classList.remove("insurance-note-blue"));
 const key="您也可以先上傳機票或行程表";
 const nodes=[...document.querySelectorAll("li,p")].filter(x=>(x.textContent||"").includes(key));
 nodes.forEach(x=>x.classList.add("insurance-note-blue"));
}
window.addEventListener("DOMContentLoaded",()=>setTimeout(v175OnlyThirdInstructionBlue,50));

function v175FixPassengerCount(d){
 const ps=d?.passengers||[];
 if(!ps.length)return;
 let adult=ps.filter(p=>p.category==="大人"||/\b(MR|MRS|MS|MISS)\b/i.test(p.name||"")).length;
 let child=ps.filter(p=>p.category==="小孩").length;
 let senior=ps.filter(p=>p.category==="長輩").length;
 document.querySelectorAll("*").forEach(el=>{
   if(el.children.length===0 && /旅客：\s*0位大人、0位小孩、0位長輩/.test(el.textContent||"")){
     el.textContent=`旅客：${adult}位大人、${child}位小孩、${senior}位長輩`;
   }
 });
}

function v175HideFriendlyDateCaptions(){
 ["startFriendly","endFriendly"].forEach(id=>{const x=document.getElementById(id);if(x)x.style.display="none"});
}
window.addEventListener("DOMContentLoaded",v175HideFriendlyDateCaptions);

function v176NormalizeTicketPeople(d){
 const ps=(d&&d.passengers)||[];
 if(!ps.length)return;
 let A=ps.filter(p=>p.category==="大人").length;
 let C=ps.filter(p=>p.category==="小孩").length;
 let S=ps.filter(p=>p.category==="長輩").length;
 const unknown=ps.filter(p=>!p.category).length;
 if(A+C+S===0 && unknown>0) A=unknown;
 d.adults=A; d.children=C; d.seniors=S;
 // update quick inputs/profile if present
 if($("#adults"))$("#adults").value=A;
 if($("#children"))$("#children").value=C;
 if($("#seniors"))$("#seniors").value=S;
 document.querySelectorAll("*").forEach(el=>{
   if(el.children.length===0 && /旅客：\s*\d+位大人、\d+位小孩、\d+位長輩/.test(el.textContent||""))
     el.textContent=`旅客：${A}位大人、${C}位小孩、${S}位長輩`;
 });
}

function v1710Text(v,fallback="待確認"){return (v===null||v===undefined||v==="null"||v==="")?fallback:v}
function v1710FlightPair(a,b){return b&&b!=="null"?`${a||"待確認"} / ${b}`:(a||"待確認")}
function v1710TripSummary(d){
 const seg=d?.segments||[];
 if(seg.length===1) return "單一航段（完整旅程天數請依實際行程填寫）";
 if(!d?.start||!d?.end) return "待確認";
 const span=v161DateSpan(d.start,d.end);
 return `${span+1}天${span}夜`;
}
function v1710InsuranceSummary(d){
 // Ticket/boarding pass does not define home-to-home insurance period.
 return "依您自行填寫的保險起訖時間計算";
}

function v1711FlightEvidence(d){
 const segs=d?.segments||[];
 if(!segs.length)return "";
 return segs.map((x,i)=>{
   const date=x.date||"日期待確認", dep=x.departure_time||"起飛時間待確認", arr=x.arrival_time||"抵達時間待確認";
   return `${i+1}. ${x.from||"?"} → ${x.to||"?"}　${x.flight||""}　${date}　${dep} → ${arr}`;
 }).join("<br>");
}
function v1711HasFullTrip(d){return (d?.segments||[]).length>=2 && !!d.start && !!d.end}

// V1.9.3.1: after AI planning, surface only the minimum data needed for product/rate filtering.
document.addEventListener("click",e=>{
 if(e.target && (e.target.id==="planBtn" || e.target.id==="aiPlan" || (e.target.textContent||"").includes("AI 幫我規劃保障"))){
   setTimeout(buildDOBPanel,250);
 }
});

function simplifyPlanFooter(){
 const plan=$("#planResult"); if(!plan) return;
 plan.querySelectorAll("button").forEach(b=>{
   const t=(b.textContent||"").trim();
   if(t==="查看" || t.includes("查看保障")) b.style.display="none";
 });
 plan.querySelectorAll("*").forEach(el=>{
   if(el.children.length) return;
   let t=(el.textContent||"").trim();
   if(t.includes("已納入") && t.includes("核心保障")){
     const m=t.match(/(\d+)\s*項核心保障/);
     el.textContent=`已納入 ${m?m[1]:"6"} 項核心保障　✓核心保障 ＋新增保障`;
   }
 });
 simplifyCoverageLabels();
}
const _v19312Observer=new MutationObserver(()=>{simplifyPlanFooter();simplifyCoverageLabels();});
document.addEventListener("DOMContentLoaded",()=>{
 const target=document.body; if(target)_v19312Observer.observe(target,{childList:true,subtree:true});
});


// ===== V2.0.4R.1 explicit PERSON_CONFIRMED transaction boundary =====
async function v2rConfirmApplicationAndOpenUW(){
 const jid=window.V2R_ACTIVE_JOURNEY||window.v2rActiveJourney||window.v2rEntry?.unpaid?.journey_id;
 if(!jid){showFormError("目前沒有可更新的投保案件。");return;}
 const q=window.currentQuote||{};
 const rows=q.person_rows||[];
 const n=Math.max($$(".insured-card").length,rows.length,(window.v2rPersons||[]).length);
 const persons=[];
 for(let i=1;i<=n;i++){
   const r=rows[i-1]||{}, p=(window.v2rPersons||[])[i-1]||{};
   persons.push({
     name:$("#insuredName"+i)?.value?.trim()||r.name||p.name||"",
     id_no:$("#insuredId"+i)?.value?.trim()||r.id_no||p.id_no||"",
     dob:$("#insuredDob"+i)?.value||r.dob||p.dob||"",
     relation:r.group||p.relation||(i===1?"本人":"被保險人"),
     mobile:i===1?($("#applicantPhone")?.value?.trim()||p.mobile||""):(p.mobile||""),
     email:i===1?($("#applicantEmail")?.value?.trim()||p.email||""):(p.email||"")
   });
 }
 if(!persons.length){showFormError("沒有可確認的被保險人資料。");return;}
 for(let i=0;i<persons.length;i++){
   if(!persons[i].name||!persons[i].id_no||!persons[i].dob){
     showFormError(`請先完成被保險人 ${i+1} 的姓名、身分證字號與生日。`);return;
   }
 }
 // Persist applicant data too; it must survive Resume just like insured-person data.
 const selfIndex=Math.max(0,persons.findIndex(p=>p.relation==="本人"));
 if(persons[selfIndex]){
   persons[selfIndex].applicant_name=$("#applicantName")?.value?.trim()||"";
   persons[selfIndex].applicant_id_no=$("#applicantId")?.value?.trim()||"";
   persons[selfIndex].applicant_dob=$("#applicantDob")?.value||"";
   persons[selfIndex].applicant_phone=$("#applicantPhone")?.value?.trim()||"";
   persons[selfIndex].applicant_email=$("#applicantEmail")?.value?.trim()||"";
   persons[selfIndex].applicant_address=$("#applicantAddress")?.value?.trim()||"";
 }
 const btn=$("#toUnderwriting"); if(btn){btn.disabled=true;btn.textContent="正在儲存投保資料…";}
 try{
   // The server transaction commits Person Profile and PERSON_CONFIRMED.
   // Quote was already committed at product-selection time and is not overwritten here.
   const r=await fetch('/api/v2r/journey/'+encodeURIComponent(jid)+'/confirm-persons',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({persons})
   });
   const d=await r.json();
   if(!r.ok||!d.ok){showFormError(d.error||"投保資料確認失敗。");return;}
   window.v2rPersons=persons;
   if(window.v2rEntry?.unpaid)window.v2rEntry.unpaid.checkpoint="PERSON_CONFIRMED";
   // Verify the DB commit before navigation. Never navigate on browser state alone.
   const sr=await fetch('/api/v2r/journey/'+encodeURIComponent(jid)+'/state');
   const sd=await sr.json();
   if(!sd.ok||sd.state?.checkpoint!=="PERSON_CONFIRMED"){
     showFormError("資料已儲存，但案件進度尚未確認，請勿繼續。");return;
   }
   showUnderwritingPanelV2R();
 } finally {
   if(btn){btn.disabled=false;btn.textContent="投保資料完成，進入確認／核保";}
 }
}
function showUnderwritingPanelV2R(){
 // Render only. No legacy saveJourney call is allowed to decide the V2R checkpoint.
 let old=$("#underwritingPanel");if(old)old.remove();
 let q=window.currentQuote||{};
 let box=document.createElement("section");box.id="underwritingPanel";box.className="card uw-panel";
 box.innerHTML=`<div class="uw-head"><small>投保確認＋核保檢核</small><h2>最後確認後，系統先做投保資格檢核</h2>
 <p>只確認會影響承保的必要事項；已提供過的旅客、生日與商品資料不再重問。</p></div>
 <div class="uw-summary"><div><b>商品</b><span>${q.product?.company||"－"}｜${q.product?.name||"－"}</span></div>
 <div><b>旅客</b><span>${q.people||"－"} 人</span></div><div><b>保費</b><span>Demo NT$ ${(window.currentQuoteTotal||0).toLocaleString()}</span></div></div>
 <div class="uw-checks">
 <label><input type="checkbox" id="uwTruth"> 我確認本次提供的投保資料正確完整。</label>
 <label><input type="checkbox" id="uwTerms"> 我已閱讀並同意本 Prototype 的投保聲明與資料使用說明。</label>
 <label><input type="checkbox" id="uwDisclosure"> 本次投保沒有其他需要主動補充、可能影響承保的重要事項。</label></div>
 <div class="uw-note">正式上線時，此區會依正式商品載入告知事項、核保問題、法定同意內容及電子簽署紀錄。</div>
 <div class="uw-actions"><button type="button" id="runUW" class="apply-now">確認並進行核保檢核</button></div><div id="uwResult"></div>`;
 $("#applyPanel").insertAdjacentElement("afterend",box);$("#runUW").onclick=runUnderwriting;
 box.scrollIntoView({behavior:"smooth",block:"start"});
}

// ===== V1.9.5 投保確認＋核保流程 =====
function showUnderwritingPanel(){saveJourney("PERSON_CONFIRMED",{application_saved:true});
 let old=$("#underwritingPanel");if(old)old.remove();
 let q=window.currentQuote||{};
 let box=document.createElement("section");box.id="underwritingPanel";box.className="card uw-panel";
 box.innerHTML=`<div class="uw-head"><small>投保確認＋核保檢核</small><h2>最後確認後，系統先做投保資格檢核</h2>
 <p>只確認會影響承保的必要事項；已提供過的旅客、生日與商品資料不再重問。</p></div>
 <div class="uw-summary"><div><b>商品</b><span>${q.product?.company||"－"}｜${q.product?.name||"－"}</span></div>
 <div><b>旅客</b><span>${q.people||"－"} 人</span></div><div><b>保費</b><span>Demo NT$ ${(window.currentQuoteTotal||0).toLocaleString()}</span></div></div>
 <div class="uw-checks">
 <label><input type="checkbox" id="uwTruth"> 我確認本次提供的投保資料正確完整。</label>
 <label><input type="checkbox" id="uwTerms"> 我已閱讀並同意本 Prototype 的投保聲明與資料使用說明。</label>
 <label><input type="checkbox" id="uwDisclosure"> 本次投保沒有其他需要主動補充、可能影響承保的重要事項。</label></div>
 <div class="uw-note">正式上線時，此區會依正式商品載入告知事項、核保問題、法定同意內容及電子簽署紀錄。</div>
 <div class="uw-actions"><button type="button" id="runUW" class="apply-now">確認並進行核保檢核</button></div><div id="uwResult"></div>`;
 $("#applyPanel").insertAdjacentElement("afterend",box);$("#runUW").onclick=runUnderwriting;
 box.scrollIntoView({behavior:"smooth",block:"start"});
}
function runUnderwriting(){
 if(!$("#uwTruth").checked||!$("#uwTerms").checked||!$("#uwDisclosure").checked){showFormError("請先完成三項投保確認。");return}
 let q=window.currentQuote||{},people=q.person_rows||[];
 if(people.some(x=>!x.dob)){$("#uwResult").innerHTML='<div class="uw-block">需要補件：仍有旅客生日未完成，暫時不能進入下一步。</div>';return}
 $("#uwResult").innerHTML=`<div class="uw-pass"><b>✓ Prototype 核保檢核通過</b><p>旅客基本資格與必要確認已完成，可以進入繳費階段。</p><small>此結果僅為 Demo 流程，不代表任何保險公司的正式承保決定。</small></div>
 <div class="uw-actions"><button type="button" id="uwToPayment" class="apply-now">下一步：繳費</button></div>`;
 $("#uwToPayment").onclick=goPaymentFromUW;
}
function goPaymentFromUW(){saveJourney("UNDERWRITING_CONFIRMED",{underwriting_status:"DEMO_PASSED"});
 let old=$("#demoPaymentPanel");if(old)old.remove(); let q=window.currentQuote||{};
 let box=document.createElement("section");box.id="demoPaymentPanel";box.className="card payment-panel";
 box.innerHTML=`<small>Demo 繳費</small><h2>付款完成後，AI Travel Mode 立即接手</h2>
 <p>本頁只模擬付款，不會送出真實信用卡交易。</p>
 <div class="pay-summary"><div><b>商品</b><span>${q.product?.company||"－"}｜${q.product?.name||"－"}</span></div><div><b>應付保費</b><span>Demo NT$ ${(window.currentQuoteTotal||0).toLocaleString()}</span></div></div>
 <div class="demo-card-form"><label>持卡人姓名<input id="demoCardName" placeholder="測試姓名"></label><label>信用卡號<input id="demoCardNo" placeholder="Demo：4242 4242 4242 4242"></label><div class="pay-row"><label>有效期限<input id="demoCardExp" placeholder="MM/YY"></label><label>安全碼<input id="demoCardCvv" placeholder="CVV"></label></div></div>
 <div class="demo-warning">Prototype 測試：請勿輸入真實信用卡資料。正式版應改接合規金流頁／Token。</div><div class="uw-actions"><button id="demoPayNow" class="apply-now">Demo 付款</button></div>`;
 $("#underwritingPanel").insertAdjacentElement("afterend",box);$("#demoPayNow").onclick=completeDemoPayment;box.scrollIntoView({behavior:"smooth"});
}
function completeDemoPayment(){
 if(!$("#demoCardName").value.trim()||!$("#demoCardNo").value.trim()||!$("#demoCardExp").value.trim()||!$("#demoCardCvv").value.trim()){showFormError("請完成 Demo 信用卡欄位；請勿輸入真實信用卡資料。");return}
 $("#demoCardNo").value="";$("#demoCardCvv").value="";
 let n=new Date(),no="DEMO-"+n.getFullYear()+String(n.getMonth()+1).padStart(2,"0")+String(n.getDate()).padStart(2,"0")+"-"+String(n.getTime()).slice(-6);
 saveJourney("PAYMENT_COMPLETED",{payment_status:"PAID",policy:{policy_no:no,premium:window.currentQuoteTotal||0}});showPolicyIssued({policy_no:no,premium:window.currentQuoteTotal||0});
}
function showPolicyIssued(p){saveJourney("POLICY_CREATED",{payment_status:"PAID",policy:p});
 let old=$("#policyIssuedPanel");if(old)old.remove();let q=window.currentQuote||{},box=document.createElement("section");box.id="policyIssuedPanel";box.className="card policy-issued";
 box.innerHTML=`<div class="success-mark">✓</div><h2>Demo 投保完成</h2><p>您的旅遊保障流程已完成。從現在開始，AI Travel Mode 會接手旅程協助。</p>
 <div class="policy-grid"><div><b>Demo 保單號碼</b><span>${p.policy_no}</span></div><div><b>狀態</b><span>Demo 已成立</span></div><div><b>商品</b><span>${q.product?.company||"－"}｜${q.product?.name||"－"}</span></div><div><b>Demo 保費</b><span>NT$ ${(p.premium||0).toLocaleString()}</span></div></div>
 <div class="policy-warning">此為 Prototype Demo Policy Snapshot，不是正式保單、承保證明或付款憑證。</div>
 <div class="travel-agent"><small>AI TRAVEL MODE</small><h3>接下來旅程，我會繼續協助您。</h3><p>如果已經有機票，可以現在傳給我；還沒有也沒關係，拿到後再上傳即可。</p>
 <div class="travel-actions"><button id="travelUploadTicket" class="apply-now">📷 上傳機票</button><button id="travelLater" class="secondary-btn">還沒機票</button></div>
 <div class="travel-capabilities"><span>出發前提醒</span><span>航班資訊</span><span>班機延誤</span><span>行李問題</span><span>海外就醫</span><span>回國理賠整理</span></div><div id="travelModeResult"></div></div>`;
 $("#demoPaymentPanel").insertAdjacentElement("afterend",box);
 $("#travelUploadTicket").onclick=openTravelTicketUpload;$("#travelLater").onclick=()=>{$("#travelModeResult").innerHTML='<div class="travel-ready">✓ 沒問題。拿到機票後再上傳即可；其他 Travel Mode 服務仍可先使用。</div>';activateTravelServices();};box.scrollIntoView({behavior:"smooth"});
}
function openTravelTicketUpload(){
 let r=$("#travelModeResult");r.innerHTML=`<div class="ticket-upload"><b>上傳機票／航班行程圖片</b><p>AI 讀取旅客與航段，建立 Flight Profile；不會修改保險期間。</p><input type="file" id="travelTicketFile" accept=".png,.jpg,.jpeg,.webp"><button id="travelTicketVision" class="secondary-btn">AI 辨識航班</button></div>`;$("#travelTicketVision").onclick=runTravelTicketVision;
}
async function runTravelTicketVision(){
 let f=$("#travelTicketFile").files?.[0];if(!f){showFormError("請先選擇機票圖片。");return}let r=$("#travelModeResult");r.innerHTML='<div class="ticket-upload">AI Vision 正在整理旅客與航段…</div>';let fd=new FormData();fd.append("file",f);let res=await fetch("/api/travel-ticket-vision",{method:"POST",body:fd}),d=await res.json();if(!res.ok||!d.ok){showFormError(d.error||"航班辨識失敗。");r.innerHTML="";return}window.pendingFlightProfile=d.flight_profile;renderFlightProfile(d.flight_profile);
}
function renderFlightProfile(fp){
 let pax=(fp.passengers||[]).map(p=>`<span class="flight-chip">${p.name||"未辨識旅客"}</span>`).join("")||"未辨識到旅客";
 let seg=(fp.segments||[]).map((s,i)=>`<div class="flight-segment"><b>航段 ${i+1}｜${s.flight_no||"航班待確認"}</b><div>${s.departure_airport||"－"} → ${s.arrival_airport||"－"}</div><small>出發：${s.departure_date||"－"} ${s.departure_time||""}　抵達：${s.arrival_date||"－"} ${s.arrival_time||""}</small><div class="${s.status==="accepted"?"flight-ok":"flight-check"}">${s.status==="accepted"?"✓ 高信心辨識":"需要確認"} · ${(s.confidence*100).toFixed(0)}%</div></div>`).join("")||'<div class="flight-check">沒有辨識到完整航段。</div>';
 $("#travelModeResult").innerHTML=`<div class="flight-profile"><small>AI FLIGHT PROFILE</small><h4>請確認航班資料</h4><div><b>旅客</b><div>${pax}</div></div>${seg}<div class="flight-rule">保險期間維持原設定，不會被機票日期／時間覆寫。</div><div class="travel-actions"><button id="confirmFlightProfile" class="apply-now">確認 Flight Profile</button><button id="retryFlightProfile" class="secondary-btn">重新上傳</button></div></div>`;$("#confirmFlightProfile").onclick=confirmFlightProfile;$("#retryFlightProfile").onclick=openTravelTicketUpload;
}
function confirmFlightProfile(){window.flightProfile=window.pendingFlightProfile;window.pendingFlightProfile=null;saveJourney("POLICY_CREATED",{flight_profile:window.flightProfile});$("#travelModeResult").innerHTML='<div class="travel-ready"><b>✓ Flight Profile 已建立</b><br>請直接選擇下方服務，我會依 Travel / Policy / Flight Profile 協助下一步。<br><small>尚未串接即時 Flight API，不會宣稱已偵測實際延誤。</small></div>';activateTravelServices();}
function activateTravelServices(){const a=["出發前提醒","航班資訊","班機延誤","行李問題","海外就醫","回國理賠整理"];document.querySelectorAll(".travel-capabilities span").forEach((e,i)=>{e.classList.add("travel-service-btn");e.tabIndex=0;e.onclick=()=>openTravelService(a[i]);});}
function openTravelService(t){let s=((window.flightProfile||{}).segments||[])[0]||{},f=[s.flight_no,s.departure_airport&&s.arrival_airport?s.departure_airport+" → "+s.arrival_airport:null,s.departure_date,s.departure_time].filter(Boolean).join("｜")||"尚無完整航段";
let v={"出發前提醒":`<h4>出發前提醒</h4><p>目前航班：<b>${f}</b></p><p>我會依旅程與保單整理出發前待辦。</p><button class="secondary-btn" onclick="createAgentTask('PRE_DEPARTURE')">建立提醒任務</button>`,
"航班資訊":`<h4>航班資訊</h4><p><b>${f}</b></p><p>目前來自您確認的 Flight Profile；尚未串即時 Flight API。</p>`,
"班機延誤":`<h4>班機延誤協助</h4><p>尚未串即時 Flight API，因此不會宣稱航班已延誤。</p><button class="secondary-btn" onclick="createAgentTask('FLIGHT_DELAY')">Demo：我的航班延誤了</button>`,
"行李問題":`<h4>行李問題</h4><p>告訴我行李延誤、遺失或損壞，我會整理後續需要的資料。</p><button class="secondary-btn" onclick="createAgentTask('BAGGAGE')">Demo：回報行李問題</button>`,
"海外就醫":`<h4>海外就醫</h4><p>旅途中生病或受傷，可告訴我狀況；後續可上傳診斷書與醫療收據。</p><button class="secondary-btn" onclick="createAgentTask('MEDICAL')">Demo：需要海外就醫協助</button>`,
"回國理賠整理":`<h4>回國理賠整理</h4><p>AI 會依旅途中事件建立 Claim Checklist，整理還缺哪些證明與單據。</p><button class="secondary-btn" onclick="createAgentTask('CLAIM_REVIEW')">建立理賠整理任務</button>`};
$("#travelModeResult").innerHTML=`<div class="agent-service">${v[t]||""}<div id="agentTaskResult"></div></div>`;}
function createAgentTask(k){let m={PRE_DEPARTURE:["✓ 出發前提醒任務已建立","下一階段可加入依出發時間自動提醒。"],FLIGHT_DELAY:["Demo 延誤事件已建立","下一步先核對延誤保障，再整理航空公司證明與文件。"],BAGGAGE:["行李事件已建立","請保留航空公司證明、行李牌及必要支出單據；正式要求以保單條款為準。"],MEDICAL:["海外就醫事件已建立","請選擇目前狀況；有診斷書或收據也可以直接上傳。"],CLAIM_REVIEW:["理賠整理任務已建立","AI 將彙整 Travel Event 與文件形成 Claim Checklist。"]}[k];window.agentTasks=window.agentTasks||[];window.agentTasks.push({type:k,status:"OPEN",created_at:new Date().toISOString()});$("#agentTaskResult").innerHTML=`<div class="agent-task-result"><b>${m[0]}</b><br>${m[1]}<br><small>Prototype Task：${k}｜OPEN</small></div>`;if(k==="MEDICAL")setTimeout(openMedicalAssistant,0);}

function openMedicalAssistant(){let r=$("#agentTaskResult");r.insertAdjacentHTML("beforeend",`<div class="medical-assistant"><h4>海外就醫 AI 助手</h4><p>請選目前狀況；這是服務分流，不是醫療診斷。</p><div class="medical-choices"><button class="secondary-btn" data-med="CARE">我需要找醫療協助</button><button class="secondary-btn" data-med="DONE">我已看完醫生</button><button class="secondary-btn" data-med="DOC">我有診斷書／收據</button></div><div id="medicalStep"></div></div>`);document.querySelectorAll("[data-med]").forEach(b=>b.onclick=()=>medicalChoice(b.dataset.med));}
function medicalChoice(k){let r=$("#medicalStep");if(k==="CARE"){r.innerHTML='<div class="medical-note"><b>先以安全與就醫為優先。</b><br>Prototype 尚未串海外醫療院所／緊急救援服務；若情況緊急，請使用當地緊急醫療服務。就醫後可回來上傳文件。</div>';return}if(k==="DONE"){r.innerHTML='<div class="medical-note">請保留診斷書、醫療費用收據及付款證明等資料；正式要求仍以保單條款與保險公司要求為準。</div>';return}r.innerHTML=`<div class="medical-upload"><b>上傳診斷書／醫療收據</b><p>AI 只整理文件，不自行判定理賠。</p><input type="file" id="medicalDocFile" accept=".png,.jpg,.jpeg,.webp"><button id="medicalVisionBtn" class="secondary-btn">AI 整理醫療文件</button><div id="medicalVisionResult"></div></div>`;$("#medicalVisionBtn").onclick=runMedicalVision;}
async function runMedicalVision(){let f=$("#medicalDocFile").files?.[0];if(!f){showFormError("請先選擇醫療文件圖片。");return}let rr=$("#medicalVisionResult"),fd=new FormData();rr.innerHTML="AI Vision 正在整理醫療文件…";fd.append("file",f);let res=await fetch("/api/medical-document-vision",{method:"POST",body:fd}),d=await res.json();if(!res.ok||!d.ok){showFormError(d.error||"辨識失敗。");rr.innerHTML="";return}let e=d.evidence||{};window.medicalEvidence=e;rr.innerHTML=`<div class="medical-evidence"><b>醫療文件辨識結果</b><div>醫療機構：${e.provider||"待確認"}</div><div>病患：${e.patient_name||"待確認"}</div><div>就醫日期：${e.visit_date||"待確認"}</div><div>診斷／內容：${e.diagnosis_text||"待確認"}</div><div>金額：${e.currency||""} ${e.total_amount??"待確認"}</div><div class="${e.status==="accepted"?"flight-ok":"flight-check"}">${e.status==="accepted"?"✓ 高信心辨識":"需要確認"} · ${(e.confidence*100).toFixed(0)}%</div><button id="confirmMedicalEvidence" class="apply-now">確認並加入 Medical Event</button></div>`;$("#confirmMedicalEvidence").onclick=()=>{$("#medicalVisionResult").innerHTML='<div class="agent-task-result"><b>✓ 醫療文件已加入 Medical Event</b><br>AI 已整理目前文件。<br><button id="buildClaimChecklist" class="apply-now">產生 Claim Checklist</button><br><small>尚未判定是否符合理賠。</small></div>';};}
document.addEventListener("click",e=>{if(e.target&&e.target.id==="buildClaimChecklist")buildClaimChecklist();});
function ensureClaimCase(){
 if(!window.claimCase){
   window.claimCase={claim_no:"DEMO-CLAIM-"+String(Date.now()).slice(-6),event_type:"MEDICAL",status:"COLLECTING",documents:[],created_at:new Date().toISOString()};
 }
 return window.claimCase;
}
function syncCurrentMedicalEvidence(){
 let c=ensureClaimCase(),e=window.medicalEvidence;
 if(e && !c.documents.includes(e)) c.documents.push(e);
}
function buildClaimChecklist(){syncCurrentMedicalEvidence();renderPersistentClaimCase();}
function claimFacts(){
 let c=ensureClaimCase(),docs=c.documents||[];
 return {
  hasDiagnosis:docs.some(d=>d.document_type==="diagnosis"||!!d.diagnosis_text),
  hasReceipt:docs.some(d=>d.document_type==="medical_receipt"||d.total_amount!=null),
  patient:docs.find(d=>d.patient_name)?.patient_name||null,
  visit:docs.find(d=>d.visit_date)?.visit_date||null,
  hasPayment:docs.some(d=>d.document_type==="payment_proof")
 };
}
function renderPersistentClaimCase(){
 let c=ensureClaimCase(),f=claimFacts();
 let checks=[
  ["診斷／醫療內容",f.hasDiagnosis,f.hasDiagnosis?"已取得":"尚待補件"],
  ["醫療費用收據／金額",f.hasReceipt,f.hasReceipt?"已取得":"尚待補件"],
  ["病患身分與被保險人一致性",false,f.patient?`文件病患：${f.patient}，待正式規則比對`:"待確認"],
  ["就醫日期與保險期間一致性",false,f.visit?`就醫日期：${f.visit}，待正式規則比對`:"待確認"],
  ["付款證明",f.hasPayment,f.hasPayment?"已取得":"尚待補件／依正式規則決定"]
 ];
 let done=checks.filter(x=>x[1]).length;
 let rows=checks.map(x=>`<div class="claim-row"><b class="${x[1]?"claim-done":"claim-wait"}">${x[1]?"✓":"○"}</b><div><b>${x[0]}</b><small>${x[2]}</small></div></div>`).join("");
 $("#medicalVisionResult").innerHTML=`<div class="claim-card"><small>CONTINUOUS CLAIM AGENT</small><h4>同一個 Claim Case 持續辦理</h4>
 <div class="claim-case-head"><div><b>案件編號</b><span>${c.claim_no}</span></div><div><b>狀態</b><span>${c.status}</span></div><div><b>文件</b><span>${c.documents.length} 份</span></div><div><b>進度</b><span>${done}/${checks.length}</span></div></div>
 <div class="claim-info"><b>可能涉及：</b>海外醫療保障<br><small>僅為服務分流，不代表承保或理賠成立。</small></div>${rows}
 <div class="travel-actions"><button id="claimAddDoc" class="apply-now">＋ 繼續補件</button><button id="claimPaymentDemo" class="secondary-btn">Demo：加入付款證明</button><button id="claimCoverage" class="secondary-btn">查看我的保障</button></div>
 <div id="claimActionResult"></div></div>`;
 $("#claimAddDoc").onclick=()=>openClaimSupplement();
 $("#claimPaymentDemo").onclick=addDemoPaymentProof;
 $("#claimCoverage").onclick=showClaimCoverage;
}
function openClaimSupplement(){
 $("#claimActionResult").innerHTML=`<div class="claim-supplement"><b>補件到同一個 Claim Case</b><p>新增文件後，Checklist 會重新計算，不會建立新案件。</p>
 <input type="file" id="claimSupplementFile" accept=".png,.jpg,.jpeg,.webp"><button id="claimSupplementVision" class="secondary-btn">AI 整理並加入案件</button></div>`;
 $("#claimSupplementVision").onclick=runClaimSupplementVision;
}
async function runClaimSupplementVision(){
 let f=$("#claimSupplementFile").files?.[0];if(!f){showFormError("請先選擇補件圖片。");return}
 let fd=new FormData();fd.append("file",f);$("#claimActionResult").innerHTML="AI Vision 正在整理補件…";
 let res=await fetch("/api/medical-document-vision",{method:"POST",body:fd}),d=await res.json();
 if(!res.ok||!d.ok){showFormError(d.error||"補件辨識失敗。");renderPersistentClaimCase();return}
 let c=ensureClaimCase();c.documents.push(d.evidence);window.medicalEvidence=d.evidence;renderPersistentClaimCase();
}
function addDemoPaymentProof(){
 let c=ensureClaimCase();
 if(!c.documents.some(d=>d.document_type==="payment_proof")) c.documents.push({document_type:"payment_proof",confidence:1,status:"demo"});
 renderPersistentClaimCase();
}
function showClaimCoverage(){
 let p=(window.currentQuote||{}).product||{};
 $("#claimActionResult").innerHTML=`<div class="claim-info"><b>目前投保商品</b><br>${p.company||"－"}｜${p.name||"－"}<br><small>正式版由 Product Coverage / Policy Terms / Claim Rules Engine 提供承保範圍、限額、除外及文件規則；AI 不自行補寫條款。</small></div>`;
}
// ===== V1.9.12 Application Journey / Checkpoint =====
async function saveJourney(checkpoint,extra={},status="ACTIVE"){
 let q=window.currentQuote||{};
 let payload={profile:window.lastProfile||null,raw_form:captureJourneyForm(),quote:q&&q.product?{product:q.product,people:q.people,person_rows:q.person_rows,demo_total:q.demo_total,desired:q.desired}:null,...extra};
 let r=await fetch("/api/journey/save",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({journey_id:window.journeyId,checkpoint,status,payload})}),d=await r.json();
 if(d.ok)window.journeyId=d.journey_id;return d;
}
function checkpointText(x){return {DRAFT:"旅程資料草稿",PRODUCT_SELECTED:"已選定商品",PERSON_CONFIRMED:"投保資料已確認",UNDERWRITING_CONFIRMED:"核保檢核已完成",PAYMENT_COMPLETED:"已完成付款",POLICY_CREATED:"投保已完成"}[x]||x}
async function loadJourney(){
 let r=await fetch("/api/journey/latest"),d=await r.json();if(!d.ok||!d.journey)return;
 let j=d.journey;window.journeyId=j.journey_id;window.resumeJourney=j;
 let p=j.payload||{},paid=["PAYMENT_COMPLETED","POLICY_CREATED"].includes(j.checkpoint);
 let box=document.createElement("section");box.id="resumeJourneyPanel";box.className="card resume-journey";
 box.innerHTML=`<small>AI 投保續辦</small><h2>${paid?"您的旅遊保險已完成":"您有一筆尚未完成的旅遊保險"}</h2>
 <div class="journey-progress">${journeyProgress(j)}</div><div class="resume-grid"><div><b>${paid?"保單號碼":"案件"}</b><span>${paid?(p.policy?.policy_no||"Demo 保單已建立"):j.journey_id}</span></div><div><b>目前進度</b><span>${checkpointText(j.checkpoint)}</span></div><div><b>商品</b><span>${p.quote?.product?.company||"－"}｜${p.quote?.product?.name||"－"}</span></div></div>
 <p>${paid?"如需取消行程、變更日期、人員或其他投保內容，請聯絡公司客服人員協助辦理。":"您可以繼續投保、修改行程／人員，或不再辦理此案件。"}</p>
 <div class="travel-actions">${paid?'<button id="resumePaid" class="apply-now">進入已完成案件</button><button id="contactService" class="secondary-btn">聯絡客服</button>':'<button id="resumeApply" class="apply-now">繼續投保</button><button id="modifyJourney" class="secondary-btn">修改行程／人員</button><button id="cancelJourney" class="secondary-btn">不再辦理</button>'}</div><div id="resumeResult"></div>`;
 document.querySelector("aside")?.prepend(box);
 if($("#resumeApply"))$("#resumeApply").onclick=resumeApplication;
 if($("#modifyJourney"))$("#modifyJourney").onclick=modifyApplicationJourney;
 if($("#cancelJourney"))$("#cancelJourney").onclick=cancelApplicationJourney;
 if($("#resumePaid"))$("#resumePaid").onclick=resumeApplication;
 if($("#contactService"))$("#contactService").onclick=()=>$("#resumeResult").innerHTML='<div class="journey-note">Prototype：正式版此處銜接公司客服／保全服務。已付款案件不在前端直接修改。</div>';
 if(paid)lockCompletedApplication();
}
function journeyProgress(j){let cp=j.checkpoint,p=j.payload||{},f=!!p.flight_profile;let a=[["商品選定",true],["資料確立",["PERSON_CONFIRMED","UNDERWRITING_CONFIRMED","PAYMENT_COMPLETED","POLICY_CREATED"].includes(cp)],["投保完成",["PAYMENT_COMPLETED","POLICY_CREATED"].includes(cp)],["旅程服務",["PAYMENT_COMPLETED","POLICY_CREATED"].includes(cp)],["機票待補",f]];return a.map((x,i)=>`<div class="jp-step ${x[1]?"done":"pending"}"><span>${x[1]?"✓":"○"}</span><b>${x[0]}</b>${i<a.length-1?"<i>→</i>":""}</div>`).join("")}
function lockCompletedApplication(){document.body.classList.add("journey-completed");const allow=e=>!!e.closest("#resumeJourneyPanel,.completed-travel,#travelModeResult,.travel-capabilities,.agent-service,.medical-assistant,.claim-card");document.querySelectorAll("input,select,textarea,button").forEach(e=>{if(!allow(e)){e.disabled=true;e.setAttribute("aria-disabled","true");}});let c=document.querySelector("main>.chat");if(c&&!c.querySelector(".completed-lock-banner")){let n=document.createElement("div");n.className="completed-lock-banner";n.innerHTML="<b>✓ 此保單已完成投保</b><br>以下投保內容僅供查看，不可重新修改或再次送出。若需取消／變更，請聯絡公司客服人員。";c.prepend(n);}}
function restoreQuoteFromJourney(){
 let q=window.resumeJourney?.payload?.quote;if(!q)return false;window.currentQuote=q;window.currentQuoteTotal=q.demo_total||0;return true;
}
function resumeApplication(){
 let j=window.resumeJourney;if(!j)return;restoreQuoteFromJourney();
 let savedProfile=j.payload?.profile||null;if(savedProfile){window.lastProfile=savedProfile;render(savedProfile);restoreJourneyForm(savedProfile);}restoreJourneyRawForm(j.payload?.raw_form);v165RefreshProfile();
 $("#resumeResult").innerHTML=`<div class="journey-note">✓ 已恢復案件：${checkpointText(j.checkpoint)}。已帶回上次保存的旅程／投保資料。</div>`;
 if(j.checkpoint==="PRODUCT_SELECTED"){openManualApplication(window.currentQuote||{});}
 else if(j.checkpoint==="PERSON_CONFIRMED"){showUnderwritingPanel();}
 else if(j.checkpoint==="UNDERWRITING_CONFIRMED"){showUnderwritingPanel();setTimeout(()=>{$("#uwResult").innerHTML='<div class="uw-pass"><b>✓ 已恢復：核保檢核已完成</b><p>可以直接繼續付款。</p></div><div class="uw-actions"><button id="uwToPayment" class="apply-now">下一步：繳費</button></div>';$("#uwToPayment").onclick=goPaymentFromUW;},50);}
 else if(["PAYMENT_COMPLETED","POLICY_CREATED"].includes(j.checkpoint)){showResumedTravelMode(j);}
}
async function modifyApplicationJourney(){
 let r=await fetch("/api/journey/invalidate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({journey_id:window.journeyId})}),d=await r.json();
 if(!r.ok){showFormError(d.error||"目前無法修改。");return}
 $("#resumeResult").innerHTML='<div class="journey-note"><b>原商品／報價已失效。</b><br>請修改行程日期或人員；完成後系統會重新確認商品適用性、資格與保費。</div>';
 $("#resumeJourneyPanel").scrollIntoView({behavior:"smooth"});window.scrollTo({top:0,behavior:"smooth"});
}
async function cancelApplicationJourney(){
 if(!confirm("確定不再辦理這筆尚未付款的投保案件嗎？"))return;
 let r=await fetch("/api/journey/cancel",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({journey_id:window.journeyId})}),d=await r.json();
 if(!r.ok){showFormError(d.error||"目前無法取消。");return}
 $("#resumeJourneyPanel").innerHTML='<div class="journey-note"><b>✓ 本次投保已取消</b><br>案件標記為 CANCELLED；Prototype 不立即刪除，正式版依資料保存政策到期清除。</div>';
}
// V2.0.1R: legacy resume loader disabled; Database-first entry loader is authoritative.

function restoreJourneyForm(p){const set=(id,v)=>{let e=document.getElementById(id);if(e&&v!==undefined&&v!==null)e.value=v};set("destination",p.destination);set("startDate",p.start_date);set("endDate",p.end_date);set("adultCount",p.adults);set("childCount",p.children);set("seniorCount",p.seniors);set("budget",p.budget);let w=new Set(p.concerns||[]);document.querySelectorAll('input[type="checkbox"]').forEach(e=>{if(w.has(e.value))e.checked=true;});}

function captureJourneyForm(){
 let out={};
 document.querySelectorAll("input,select,textarea").forEach(e=>{
   if(!e.id)return;
   if(e.type==="checkbox"||e.type==="radio")out[e.id]={checked:e.checked,value:e.value,name:e.name};
   else out[e.id]=e.value;
 });
 // dynamic counters are not form controls
 ["adults","children","seniors"].forEach(id=>{let e=document.getElementById(id);if(e)out["__text_"+id]=e.textContent.trim();});
 return out;
}
function restoreJourneyRawForm(raw){
 if(!raw)return;
 Object.entries(raw).forEach(([id,v])=>{
   if(id.startsWith("__text_")){let e=document.getElementById(id.slice(7));if(e)e.textContent=v;return;}
   let e=document.getElementById(id);if(!e)return;
   if((e.type==="checkbox"||e.type==="radio")&&typeof v==="object")e.checked=!!v.checked;
   else if(typeof v!=="object")e.value=v;
 });
}
// Definitive desktop column swap for actual markup: main > .chat + aside.
// CSS order/direction from prior builds is intentionally bypassed.
function v19123SwapColumns(){
 if(window.innerWidth<801)return;
 let main=document.querySelector("main"),chat=main?.querySelector(":scope > .chat"),side=main?.querySelector(":scope > aside");
 if(main&&chat&&side){main.style.gridTemplateColumns=".8fr 1.5fr";main.insertBefore(side,chat);side.style.order="";chat.style.order="";}
}
window.addEventListener("DOMContentLoaded",()=>setTimeout(v19123SwapColumns,20));

function showResumedTravelMode(j){
 let p=j.payload||{},pol=p.policy||{};
 $("#resumeResult").innerHTML=`<div class="completed-travel"><small>AI TRAVEL MODE</small><h3>接下來旅程，我會繼續協助您。</h3>
 <p>保單：${pol.policy_no||"Demo 保單已建立"}。此案件已完成付款，不會重新進入投保流程。</p>
 <div class="travel-service-grid">
 <button data-rsvc="出發前提醒">出發前提醒</button><button data-rsvc="航班資訊">航班資訊</button><button data-rsvc="班機延誤">班機延誤</button>
 <button data-rsvc="行李問題">行李問題</button><button data-rsvc="海外就醫">海外就醫</button><button data-rsvc="回國理賠整理">回國理賠整理</button></div>
 <div id="travelModeResult"></div></div>`;
 document.querySelectorAll("[data-rsvc]").forEach(b=>b.onclick=()=>openTravelService(b.dataset.rsvc));
}

const v124obs=new MutationObserver(()=>{if(document.body.classList.contains("journey-completed"))document.querySelectorAll("input,select,textarea,button").forEach(e=>{if(!e.closest("#resumeJourneyPanel,.completed-travel,#travelModeResult,.travel-capabilities,.agent-service,.medical-assistant,.claim-card"))e.disabled=true;});});
window.addEventListener("DOMContentLoaded",()=>v124obs.observe(document.body,{childList:true,subtree:true}));
function removeTravelModeEmptyBoxes(){document.querySelectorAll("#travelModePanel button,.travel-mode button,#travelModeResult button,#travelModePanel span,.travel-mode span,#travelModeResult span").forEach(e=>{if(!e.textContent.trim()&&!e.querySelector("img,input"))e.remove();});}
document.addEventListener("click",()=>setTimeout(removeTravelModeEmptyBoxes,20));window.addEventListener("DOMContentLoaded",()=>setTimeout(removeTravelModeEmptyBoxes,500));

function v125RestoreNoTicket(){
 const up=[...document.querySelectorAll("button")].find(b=>b.textContent.includes("上傳機票"));
 if(!up||!up.parentElement)return;
 const blank=[...up.parentElement.querySelectorAll("button")].find(b=>b!==up&&!b.textContent.trim());
 if(blank){blank.textContent="還沒機票";blank.style.display="";blank.classList.add("secondary-btn");}
}
window.addEventListener("DOMContentLoaded",()=>setTimeout(v125RestoreNoTicket,500));
document.addEventListener("click",()=>setTimeout(v125RestoreNoTicket,30));


// ===== V2.0.1R Database-first identity entry =====
function v2rCheckpointText(cp){return ({DRAFT:"旅程資料建立中",PRODUCT_SELECTED:"商品已選定",PERSON_CONFIRMED:"投保資料已確立",UNDERWRITING_CONFIRMED:"核保檢核已完成",PAYMENT_COMPLETED:"付款完成",POLICY_CREATED:"保單已建立"})[cp]||cp||"尚未開始";}
function v2rTripText(p,d){if(!p||!p.start_date)return "旅程資料尚未完成";let place=[p.destination_country,p.destination_city].filter(Boolean).join(" ")||"海外旅程";return `${place}｜${p.start_date}～${p.end_date||"－"}${d?`（${d}天）`:""}`;}
function v2rProductText(q){return [q?.insurer_name,q?.product_name].filter(Boolean).join("｜")||"商品尚未選定";}
async function v2rLoadEntry(){
 let r=await fetch('/api/v2r/entry'),x=await r.json();if(!x.ok)return;let d=x.data;window.v2rEntry=d;
 document.querySelector('#v2rEntryPanel')?.remove();let box=document.createElement('section');box.id='v2rEntryPanel';box.className='card v2r-entry';
 if(d.mode==='EMPTY') box.innerHTML=`<small>我的旅遊保險</small><h2>開始新的旅遊保險</h2><p>目前沒有投保紀錄，從空白旅程開始。</p><button id="v2rStart" class="apply-now">開始投保</button>`;
 else if(d.unpaid){let u=d.unpaid;box.innerHTML=`<small>我的旅遊保險</small><h2>您有一筆尚未完成的投保</h2><div class="v2r-case"><b>${v2rTripText(u.travel_profile,u.calendar_days)}</b><span>${v2rProductText(u.quote)}</span><span>目前進度：${v2rCheckpointText(u.checkpoint)}</span><small>案件 ${u.journey_id}</small></div><div class="travel-actions"><button id="v2rContinue" class="apply-now">繼續投保</button><button id="v2rNew" class="secondary-btn">＋新增旅程</button></div><div id="v2rEntryResult"></div>`;}
 else box.innerHTML=`<small>我的旅遊保險</small><h2>已完成的旅遊保險</h2><p>已繳款案件不直接修改投保內容；如需變更或取消請聯絡客服。</p><div class="travel-actions"><button id="v2rContact" class="secondary-btn">聯絡客服</button><button id="v2rNew" class="apply-now">＋新增旅程</button></div><div id="v2rEntryResult"></div>`;
 let side=document.querySelector('aside');side?.prepend(box);
 if(document.querySelector('#v2rStart'))document.querySelector('#v2rStart').onclick=v2rCreateNew;
 if(document.querySelector('#v2rNew'))document.querySelector('#v2rNew').onclick=v2rCreateNew;
 if(document.querySelector('#v2rContinue'))document.querySelector('#v2rContinue').onclick=v2rContinue;
 if(document.querySelector('#v2rContact'))document.querySelector('#v2rContact').onclick=()=>document.querySelector('#v2rEntryResult').innerHTML='<div class="journey-note">Prototype：正式版此處銜接公司客服／保全服務。</div>';
}
async function v2rCreateNew(){let r=await fetch('/api/v2r/journey/new',{method:'POST'}),d=await r.json();if(!d.ok)return;window.journeyId=d.journey_id;window.v2rActiveJourney=d.journey_id;document.querySelector('#v2rEntryPanel').innerHTML=`<small>我的旅遊保險</small><h2>新的旅程</h2><div class="journey-note">✓ 已建立新案件 ${d.journey_id}<br>這是一筆全新的投保，從空白資料開始。</div>`;document.querySelector('#v2rEntryPanel').scrollIntoView({behavior:'smooth'});}
async function v2rContinue(){let u=window.v2rEntry?.unpaid;if(!u)return;let r=await fetch('/api/v2r/journey/'+u.journey_id),d=await r.json();if(!d.ok)return;window.journeyId=u.journey_id;window.v2rActiveJourney=u.journey_id;window.v2rSnapshot=d.data;document.querySelector('#v2rEntryResult').innerHTML=`<div class="journey-note"><b>✓ 已讀取原案件 ${u.journey_id}</b><br>已從 Database 取得 Travel Profile、Person、Coverage、Quote 與 Checkpoint。V2.0.2R 將依 Checkpoint 直接還原到正確投保畫面，不重新建立案件。</div>`;}
window.addEventListener('DOMContentLoaded',()=>setTimeout(v2rLoadEntry,250));

// ===== V2.0.2R.1 Resume Bridge =====
// Restore intended desktop layout: AI/application on LEFT, case/profile on RIGHT.
v19123SwapColumns=function(){
 if(window.innerWidth<801)return;
 const main=document.querySelector("main"), chat=main?.querySelector(":scope > .chat"), side=main?.querySelector(":scope > aside");
 if(main&&chat&&side){
   main.style.gridTemplateColumns="1.5fr .8fr";
   if(main.firstElementChild!==chat) main.insertBefore(chat,side);
   chat.style.order=""; side.style.order="";
 }
};

// Continue must LOAD the existing Journey and invoke the DB resume bridge.
v2rContinue=async function(){
 const u=window.v2rEntry?.unpaid;if(!u)return;
 window.journeyId=u.journey_id;window.v2rActiveJourney=u.journey_id;
 if(typeof window.v2rResumeJourney==="function") await window.v2rResumeJourney(u.journey_id);
};

// Helper used by the DB resume bridge to restore the actual stable UI state.
window.v2rApplySnapshotToStableUI=function(jid,d){
 const tp=d.travel_profile||{}, cv=d.coverage_need||{}, q=d.quote||{}, ps=d.persons||[];
 const start=(tp.start_date||"").slice(0,10), end=(tp.end_date||"").slice(0,10);
 if(start) $("#start").value=start;
 if(end) $("#end").value=end;
 if($("#startHour")) $("#startHour").value=(tp.start_time||"").slice(0,2);
 if($("#endHour")) $("#endHour").value=(tp.end_time||"").slice(0,2);
 if(start&&end) $("#tripDays").value=v165TravelDays(start,end);

 const country=tp.destination_country||tp.country||"";
 const city=tp.destination_city||tp.city||"";
 if(country){
   $("#country").value=cities[country]?country:"其他";
   setCities(country,city);
   if(!cities[country]) $("#countryOther").value=country;
 }
 if(city){
   if(cities[country]?.includes(city)) $("#city").value=city;
   else {$("#city").value="其他";$("#cityOther").value=city;}
 }

 $("#adults").textContent=tp.adult_count ?? ps.filter(p=>{let a=p.dob?Math.floor((new Date(start||Date.now())-new Date(p.dob))/31557600000):null;return a!=null&&a>=15&&a<65}).length ?? 1;
 $("#children").textContent=tp.child_count ?? ps.filter(p=>p.dob&&Math.floor((new Date(start||Date.now())-new Date(p.dob))/31557600000)<15).length ?? 0;
 $("#seniors").textContent=tp.senior_count ?? ps.filter(p=>p.dob&&Math.floor((new Date(start||Date.now())-new Date(p.dob))/31557600000)>=65).length ?? 0;

 $$('#concerns input').forEach(x=>x.checked=(cv.concerns||[]).includes(x.value));

 const p={
   destination:[country,city].filter(Boolean).join(" / "),
   country,city,
   start_date:start?start.replaceAll("-","/"):null,
   end_date:end?end.replaceAll("-","/"):null,
   adults:+$("#adults").textContent,children:+$("#children").textContent,seniors:+$("#seniors").textContent,
   people:ps.length || (+$("#adults").textContent + +$("#children").textContent + +$("#seniors").textContent),
   budget_range:tp.budget_range||null,
   concerns:cv.concerns||[]
 };
 window.lastProfile=p; render(p); v165RefreshProfile();

 // Preserve authoritative DB objects for downstream steps.
 // Person Profile in DB is the source of truth. Rebuild the DOB panel first,
 // then restore each DOB so Resume/reload never asks the customer again.
 window.v2rPersons=ps;
 if(!q.person_rows || !q.person_rows.length){
   q.person_rows=ps.map((x,i)=>({group:x.relation||("旅客 "+(i+1)),dob:x.dob||"",name:x.name||"",id_no:x.id_no||""}));
 }
 window.currentQuote=q; window.v2rCoverageNeed=cv;
 window.selectedPlan={...(window.selectedPlan||{}),accident:cv.accident_amount,medical:cv.medical_amount,rescue:cv.rescue_amount};
 if(typeof buildDOBPanel==="function"){
   buildDOBPanel();
   const dobInputs=$$(".traveler-dob");
   ps.forEach((person,i)=>{
     if(dobInputs[i] && person.dob){
       dobInputs[i].value=String(person.dob).slice(0,10);
       dobInputs[i].dataset.source="database";
       dobInputs[i].title="已由原案件資料自動帶入，可修正";
     }
   });
 }

 // Compact DB restore status belongs on the RIGHT, not as a new left-side work panel.
 const result=document.querySelector("#v2rEntryResult");
 if(result) result.innerHTML=`<div class="journey-note"><b>✓ 已還原原案件 ${jid}</b><br>
 ${country}${city}｜${start} ${tp.start_time||""} ～ ${end} ${tp.end_time||""}<br>
 ${ps.length} 位旅客｜${q.insurer_name||""} ${q.product_name||q.product_code||""}<br>
 目前進度：${v2rCheckpointText(d.journey?.checkpoint)}</div>`;
};

// ===== V2.0.3R.1 UI Change Impact Bridge =====
(function(){
 const oldApply=window.v2rApplySnapshotToStableUI;
 window.v2rApplySnapshotToStableUI=function(jid,d){
   oldApply?.(jid,d);
   window.V2R_ORIGINAL={
     destination_country:d.travel_profile?.destination_country||"",
     destination_city:d.travel_profile?.destination_city||"",
     start_date:d.travel_profile?.start_date||"",
     end_date:d.travel_profile?.end_date||"",
     start_time:d.travel_profile?.start_time||"",
     end_time:d.travel_profile?.end_time||"",
     concerns:[...(d.coverage_need?.concerns||[])],
     accident_amount:d.coverage_need?.accident_amount,
     medical_amount:d.coverage_need?.medical_amount,
     rescue_amount:d.coverage_need?.rescue_amount
   };
 };
 function current(){
   const country=$("#country")?.value==="其他"?($("#countryOther")?.value||""):($("#country")?.value||"");
   const city=$("#city")?.value==="其他"?($("#cityOther")?.value||""):($("#city")?.value||"");
   return {
    destination_country:country,destination_city:city,
    start_date:$("#start")?.value||"",end_date:$("#end")?.value||"",
    start_time:$("#startHour")?.value?$("#startHour").value.padStart(2,"0")+":00":"",
    end_time:$("#endHour")?.value?$("#endHour").value.padStart(2,"0")+":00":"",
    concerns:$$('#concerns input:checked').map(x=>x.value)
   };
 }
 window.v2rCommitProfileChanges=async function(){
   const jid=window.V2R_ACTIVE_JOURNEY||window.v2rActiveJourney;if(!jid||!window.V2R_ORIGINAL)return null;
   const o=window.V2R_ORIGINAL,n=current(),changed=[];
   for(const k of ["destination_country","destination_city","start_date","end_date","start_time","end_time"])
     if(String(o[k]??"")!==String(n[k]??"")) changed.push(k);
   if(JSON.stringify([...(o.concerns||[])].sort())!==JSON.stringify([...(n.concerns||[])].sort())) changed.push("coverage_need");
   if(!changed.length)return {ok:true,impact:{quote:"KEEP",eligibility:"KEEP",underwriting:"KEEP",reason:"NO_CHANGE"}};
   const r=await fetch('/api/v2r/journey/'+encodeURIComponent(jid)+'/change',{
     method:'POST',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({changed_fields:changed,patch:{
       travel_profile:{destination_country:n.destination_country,destination_city:n.destination_city,start_date:n.start_date,end_date:n.end_date,start_time:n.start_time,end_time:n.end_time},
       coverage_need:{concerns:n.concerns}
     }})
   });
   const x=await r.json();
   if(!x.ok){alert(x.error||"異動儲存失敗");return x}
   Object.assign(window.V2R_ORIGINAL,n);
   const box=document.querySelector("#v2rEntryResult");
   if(box){
     const i=x.impact||{};
     const msg=i.quote==="INVALIDATED"?"旅程／保障異動，原報價已失效，需重新資格檢核與報價。":
               i.reason==="CITY_CHANGE_RULE_DEPENDENT"?"城市已變更；是否影響商品／費率將依正式商品規則判斷。":
               "資料已更新，原報價與核保結果可保留。";
     box.innerHTML=`<div class="journey-note"><b>✓ 異動已保存</b><br>${msg}</div>`;
   }
   return x;
 };
 // Save impact when stable profile is explicitly refreshed/continued.
 document.addEventListener('change',e=>{
   if(!window.V2R_ACTIVE_JOURNEY)return;
   if(e.target.matches('#country,#countryOther,#city,#cityOther,#start,#end,#startHour,#endHour,#concerns input'))
     clearTimeout(window.__v2rChangeTimer),window.__v2rChangeTimer=setTimeout(()=>window.v2rCommitProfileChanges(),500);
 });
})();

// ===== V2.0.3R.3 Two-checkpoint Resume State Controller =====
(function(){
 function restoreDOBs(ps){
   window.v2rPersons=ps||[];
   buildDOBPanel();
   const inputs=$$(".traveler-dob");
   (ps||[]).forEach((p,i)=>{ if(inputs[i]&&p.dob) inputs[i].value=String(p.dob).slice(0,10); });
 }
 function renderPlanningCheckpoint(d){
   const cv=d.coverage_need||{}, ps=d.persons||[];
   window.selectedPlan={
     tier:cv.tier||"balanced",
     accident:cv.accident_amount||cv.accident||600,
     medical:cv.medical_amount||cv.medical||60,
     rescue:cv.rescue_amount||cv.rescue||150,
     core:cv.core||cv.concerns||[],
     extras:cv.extras||[]
   };
   const box=$("#planResult");
   if(box){
     box.classList.remove("hidden");
     box.innerHTML=`<div class="plan-card"><small>AI 保障規劃｜原案件</small>
       <h2>已還原上一筆保障規劃</h2>
       <p><b>意外傷害</b> ${window.selectedPlan.accident}萬　｜　
       <b>海外醫療</b> ${window.selectedPlan.medical}萬　｜　
       <b>緊急救援</b> ${window.selectedPlan.rescue}萬</p>
       <p>${(cv.concerns||[]).join("、")||"保障需求已由原案件還原"}</p></div>`;
   }
   restoreDOBs(ps);
   $("#productResult")?.classList.add("hidden"); $("#quoteResult")?.classList.add("hidden");
   setTimeout(()=>$("#dobPanel")?.scrollIntoView({behavior:"smooth",block:"start"}),80);
 }
 function normalizedQuote(d){
   const q=d.quote||{}, ps=d.persons||[], cv=d.coverage_need||{};
   const rows=ps.map((p,i)=>({group:p.relation||`旅客${i+1}`,dob:p.dob||"",name:p.name||"",id_no:p.id_no||"",age:null,demo_premium:null}));
   return {
     quote_id:q.quote_id||"DB-RESUME",
     product:{id:q.product_code||"",company:q.insurer_name||q.insurer||"",name:q.product_name||q.product_code||"",service:q.service||"依原商品資料"},
     people:ps.length, person_rows:rows,
     demo_total:q.total_premium??q.demo_total??0,
     desired:{accident:cv.accident_amount||cv.accident||600,medical:cv.medical_amount||cv.medical||60,rescue:cv.rescue_amount||cv.rescue||150,
              core:cv.core||cv.concerns||[],extras:cv.extras||[]}
   };
 }
 function renderProductCheckpoint(d){
   const q=normalizedQuote(d), ps=d.persons||[];
   window.currentQuote=q; window.currentQuoteTotal=q.demo_total||0;
   restoreDOBs(ps);
   $("#planResult")?.classList.add("hidden"); $("#productResult")?.classList.add("hidden");
   const rows=q.person_rows.map(x=>`<tr><td>${x.group}</td><td>${x.dob||"－"}</td><td>${x.demo_premium==null?"依原報價":("NT$ "+x.demo_premium.toLocaleString())}</td></tr>`).join("");
   const concerns=[...(q.desired.core||[]),...(q.desired.extras||[])];
   const box=$("#quoteResult"); box.classList.remove("hidden");
   box.innerHTML=`<div class="quote-box">
    <div class="quote-head"><div><small>原案件 Quote｜${q.quote_id}</small><h2>${q.product.company}｜${q.product.name}</h2></div><span class="quote-state">已還原</span></div>
    <div class="demo-quote-alert"><b>原案件資料已完整讀回</b><br>未付款前可繼續投保；若修改會影響資格／費率的資料，Change Impact Engine 會重新判斷。</div>
    <div class="quote-need"><b>三大保障需求</b><br>意外傷害 ${q.desired.accident}萬　｜　傷害／疾病醫療 ${q.desired.medical}萬　｜　緊急救援 ${q.desired.rescue}萬</div>
    <div class="quote-coverages"><b>保障需求</b><div>${concerns.map(x=>`<span class="quote-chip">${x}</span>`).join("")||"－"}</div></div>
    <table class="quote-table"><thead><tr><th>旅客</th><th>生日</th><th>原報價</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="quote-total"><span>原案件總保費</span><strong>${q.demo_total?("NT$ "+Number(q.demo_total).toLocaleString()):"依原案件資料"}</strong></div>
    <div class="quote-actions"><button type="button" id="resumeEdit" class="secondary">修改前面資料</button><button type="button" id="quoteApply" class="apply-now">我要投保</button></div>
   </div>`;
   $("#quoteApply").onclick=()=>startDemoApplication(q);
   $("#resumeEdit").onclick=()=>{renderPlanningCheckpoint(d);$("#start")?.scrollIntoView({behavior:"smooth",block:"start"});};
   setTimeout(()=>box.scrollIntoView({behavior:"smooth",block:"start"}),80);
 }
 window.v2rResumeToCheckpoint=function(d){
   const cp=d?.journey?.checkpoint||"DRAFT";
   // Only two unpaid resume positions:
   // 1) before product selection; 2) product selected / quote available.
   if(cp==="PRODUCT_SELECTED" || (d.quote && (d.quote.product_code||d.quote.product_name))){
     renderProductCheckpoint(d);
   }else{
     renderPlanningCheckpoint(d);
   }
 };
 const previous=window.v2rApplySnapshotToStableUI;
 window.v2rApplySnapshotToStableUI=function(jid,d){
   previous?.(jid,d);               // restore authoritative data first
   window.v2rResumeToCheckpoint(d); // then navigate to the one correct unpaid breakpoint
 };
})();

// ===== V2.0.3R.4 Three-checkpoint Resume Controller =====
(function(){
 function persons(d){ return d?.persons||[]; }
 function restoreDOBs(d){
   const ps=persons(d); window.v2rPersons=ps;
   if(typeof buildDOBPanel==="function") buildDOBPanel();
   const inputs=$$(".traveler-dob");
   ps.forEach((p,i)=>{ if(inputs[i]&&p.dob) inputs[i].value=String(p.dob).slice(0,10); });
 }
 function hideResumeStages(){
   ["#planResult","#productResult","#quoteResult","#applicationResult","#uwResult","#paymentResult"].forEach(s=>$(s)?.classList.add("hidden"));
 }
 function planning(d){
   hideResumeStages(); restoreDOBs(d);
   const cv=d.coverage_need||{};
   window.selectedPlan={...(window.selectedPlan||{}),
     accident:cv.accident_amount||cv.accident||600,
     medical:cv.medical_amount||cv.medical||60,
     rescue:cv.rescue_amount||cv.rescue||150,
     core:cv.core||cv.concerns||[],extras:cv.extras||[]};
   const b=$("#planResult");
   if(b){ b.classList.remove("hidden"); b.innerHTML=`<div class="plan-card"><small>原案件｜商品未選定</small>
     <h2>已還原 AI 保障規劃</h2><p>意外 ${window.selectedPlan.accident}萬｜海外醫療 ${window.selectedPlan.medical}萬｜緊急救援 ${window.selectedPlan.rescue}萬</p>
     <p>${(cv.concerns||[]).join("、")||"請繼續選擇商品"}</p></div>`; }
   setTimeout(()=>($("#dobPanel")||b)?.scrollIntoView({behavior:"smooth",block:"start"}),80);
 }
 function makeQuote(d){
   const q=d.quote||{},cv=d.coverage_need||{},ps=persons(d);
   return {quote_id:q.quote_id||"DB-RESUME",
    product:{id:q.product_code||"",company:q.insurer_name||q.insurer||"",name:q.product_name||q.product_code||""},
    people:ps.length,demo_total:q.total_premium??q.demo_total??0,
    person_rows:ps.map((p,i)=>({group:p.relation||`旅客${i+1}`,dob:p.dob||"",name:p.name||"",id_no:p.id_no||"",demo_premium:null})),
    desired:{accident:cv.accident_amount||cv.accident||600,medical:cv.medical_amount||cv.medical||60,rescue:cv.rescue_amount||cv.rescue||150,
      core:cv.core||cv.concerns||[],extras:cv.extras||[]}};
 }
 function productSelected(d){
   hideResumeStages(); restoreDOBs(d);
   const q=makeQuote(d); window.currentQuote=q; window.currentQuoteTotal=q.demo_total||0;
   const b=$("#quoteResult"); if(!b)return;
   b.classList.remove("hidden");
   b.innerHTML=`<div class="quote-box"><div class="quote-head"><div><small>原案件｜商品已選定</small>
     <h2>${q.product.company}｜${q.product.name}</h2></div><span class="quote-state">已還原</span></div>
     <div class="quote-need"><b>保障</b><br>意外 ${q.desired.accident}萬｜海外醫療 ${q.desired.medical}萬｜緊急救援 ${q.desired.rescue}萬</div>
     <table class="quote-table"><thead><tr><th>旅客</th><th>生日</th></tr></thead><tbody>
     ${q.person_rows.map(x=>`<tr><td>${x.group}</td><td>${x.dob||"－"}</td></tr>`).join("")}</tbody></table>
     <div class="quote-total"><span>原案件總保費</span><strong>${q.demo_total?("NT$ "+Number(q.demo_total).toLocaleString()):"依原案件"}</strong></div>
     <div class="quote-actions"><button type="button" id="resumeEdit" class="secondary">修改前面資料</button>
     <button type="button" id="quoteApply" class="apply-now">我要投保</button></div></div>`;
   $("#quoteApply").onclick=()=>startDemoApplication(q);
   $("#resumeEdit").onclick=()=>planning(d);
   setTimeout(()=>b.scrollIntoView({behavior:"smooth",block:"start"}),80);
 }
 function personConfirmed(d){
   hideResumeStages(); restoreDOBs(d);
   const q=makeQuote(d); window.currentQuote=q; window.currentQuoteTotal=q.demo_total||0;
   // Reuse the stable application renderer, then populate DB Person Profile.
   if(typeof startDemoApplication==="function") startDemoApplication(q);
   setTimeout(()=>{
     const ps=persons(d);
     // Generic restore for the stable application's repeated person fields.
     const app=$("#applicationResult"); if(!app)return;
     const dob=app.querySelectorAll('input[type="date"]');
     const names=app.querySelectorAll('input[data-field="name"],input[name*="name"]');
     const ids=app.querySelectorAll('input[data-field="id_no"],input[name*="id"]');
     ps.forEach((p,i)=>{
       if(dob[i]&&p.dob) dob[i].value=String(p.dob).slice(0,10);
       if(names[i]&&p.name) names[i].value=p.name;
       if(ids[i]&&p.id_no) ids[i].value=p.id_no;
     });
     const tag=document.createElement("div"); tag.className="demo-quote-alert";
     tag.innerHTML="<b>✓ 原案件投保資料已確認並還原</b><br>請從告知／聲明與後續核保位置繼續。";
     app.prepend(tag);
     app.scrollIntoView({behavior:"smooth",block:"start"});
   },120);
 }
 window.v2rResumeToCheckpoint=function(d){
   const cp=String(d?.journey?.checkpoint||"DRAFT").toUpperCase();
   // Checkpoint is authoritative. Quote presence never decides navigation.
   if(cp==="PERSON_CONFIRMED" || cp==="UNDERWRITING_CONFIRMED") return personConfirmed(d);
   if(cp==="PRODUCT_SELECTED") return productSelected(d);
   return planning(d); // DRAFT / PRODUCT_NOT_SELECTED / other pre-product states
 };
 // Replace the last wrapper so R4 navigation wins over earlier R3 behavior.
 const baseApply=window.v2rApplySnapshotToStableUI;
 window.v2rApplySnapshotToStableUI=function(jid,d){
   // Earlier bridge restores DB state; suppress its old navigator by temporarily no-oping R4 hook.
   const nav=window.v2rResumeToCheckpoint;
   window.v2rResumeToCheckpoint=function(){};
   try{ baseApply?.(jid,d); } finally { window.v2rResumeToCheckpoint=nav; }
   nav(d);
 };
})();

// ===== V2.0.3R.5 Atomic Checkpoint Commit =====
(function(){
 function collectConfirmedPersons(){
   const q=window.currentQuote||{}, rows=q.person_rows||[];
   const cards=$$(".insured-card");
   const out=[];
   const n=Math.max(cards.length,rows.length,1);
   for(let i=1;i<=n;i++){
     const r=rows[i-1]||{};
     out.push({
       name:$("#insuredName"+i)?.value?.trim()||r.name||"",
       id_no:$("#insuredId"+i)?.value?.trim()||r.id_no||"",
       dob:$("#insuredDob"+i)?.value||r.dob||"",
       relation:r.group||r.relation||(i===1?"本人":"被保險人"),
       mobile:i===1?($("#applicantPhone")?.value?.trim()||""):"",
       email:i===1?($("#applicantEmail")?.value?.trim()||""):"",
       applicant_name:$("#applicantName")?.value?.trim()||"",
       applicant_id_no:$("#applicantId")?.value?.trim()||"",
       applicant_dob:$("#applicantDob")?.value||""
     });
   }
   return out;
 }
 function validateConfirmedPersons(ps){
   for(let i=0;i<ps.length;i++){
     if(!ps[i].name||!ps[i].id_no||!ps[i].dob){
       showFormError(`請先完成被保險人 ${i+1} 的姓名、身分證字號與生日。`);
       return false;
     }
   }
   return true;
 }
 const legacyShow=window.showUnderwritingPanel||showUnderwritingPanel;
 window.showUnderwritingPanel=async function(){
   const jid=window.V2R_ACTIVE_JOURNEY||window.v2rActiveJourney;
   if(!jid){ legacyShow(); return; }
   const ps=collectConfirmedPersons();
   if(!validateConfirmedPersons(ps)) return;
   const btn=$("#toUnderwriting"); if(btn){btn.disabled=true;btn.textContent="正在確認資料…";}
   try{
     const r=await fetch('/api/v2r/journey/'+encodeURIComponent(jid)+'/confirm-persons',{
       method:'POST',headers:{'Content-Type':'application/json'},
       body:JSON.stringify({persons:ps,quote:window.currentQuote||{}})
     });
     const d=await r.json();
     if(!r.ok||!d.ok){showFormError(d.error||"投保資料確認失敗。");return;}
     window.v2rPersons=ps;
     if(window.v2rEntry?.unpaid) window.v2rEntry.unpaid.checkpoint="PERSON_CONFIRMED";
     legacyShow();
   }finally{
     if(btn){btn.disabled=false;btn.textContent="投保資料完成，進入確認／核保";}
   }
 };
 // Existing button was assigned a function object when created; rebind through delegation
 // so the R5 commit always runs even after Resume / dynamic form rebuild.
 // R4/R5 capture interception retired in V2.0.4R.1.
 // The button itself now owns one explicit DB transaction boundary.
})();

// ===== V2.0.3R.5.1 Checkpoint-3 Resume + inclusive-day fix =====
(function(){
 function qFromDB(d){
   const q=d.quote||{}, cv=d.coverage_need||{}, ps=d.persons||[];
   return {quote_id:q.quote_id||"DB-RESUME",
     product:{id:q.product_code||"",company:q.insurer_name||q.insurer||"",name:q.product_name||q.product_code||""},
     people:ps.length,demo_total:q.total_premium??q.demo_total??0,
     person_rows:ps.map((p,i)=>({group:p.relation||`旅客${i+1}`,dob:p.dob||"",name:p.name||"",id_no:p.id_no||""})),
     desired:{accident:cv.accident_amount||cv.accident||600,medical:cv.medical_amount||cv.medical||60,rescue:cv.rescue_amount||cv.rescue||150,
              core:cv.core||cv.concerns||[],extras:cv.extras||[]}};
 }
 function renderConfirmedCheckpoint(d){
   const q=qFromDB(d), ps=d.persons||[];
   window.currentQuote=q; window.currentQuoteTotal=q.demo_total||0; window.v2rPersons=ps;
   ["#planResult","#productResult","#quoteResult","#aiApplyMethod","#applyPanel","#demoPaymentPanel"].forEach(s=>$(s)?.classList.add("hidden"));
   $("#underwritingPanel")?.remove();
   const box=document.createElement("section"); box.id="underwritingPanel"; box.className="card uw-panel";
   box.innerHTML=`<div class="uw-head"><small>原案件｜資料已確認</small>
     <h2>投保資料已確認，接續告知／聲明與核保</h2>
     <p>已提供過的旅客、生日與商品資料不再重問。</p></div>
     <div class="uw-summary">
       <div><b>商品</b><span>${q.product.company||"－"}｜${q.product.name||"－"}</span></div>
       <div><b>旅客</b><span>${q.people||"－"} 人</span></div>
       <div><b>保費</b><span>Demo NT$ ${Number(q.demo_total||0).toLocaleString()}</span></div>
     </div>
     <div class="known-data"><b>已確認的被保險人</b><div class="known-chips">
       ${ps.map(p=>`<span>${p.name||p.relation||"旅客"}｜${p.dob||"－"}</span>`).join("")}
     </div></div>
     <div class="uw-checks">
       <label><input type="checkbox" id="uwTruth"> 我確認本次提供的投保資料正確完整。</label>
       <label><input type="checkbox" id="uwTerms"> 我已閱讀並同意本 Prototype 的投保聲明與資料使用說明。</label>
       <label><input type="checkbox" id="uwDisclosure"> 本次投保沒有其他需要主動補充、可能影響承保的重要事項。</label>
     </div>
     <div class="uw-note">正式上線時，此區會依正式商品載入告知事項、核保問題、法定同意內容及電子簽署紀錄。</div>
     <div class="uw-actions"><button type="button" id="runUW" class="apply-now">確認並進行核保檢核</button></div>
     <div id="uwResult"></div>`;
   const anchor=$("#applyPanel")||$("#quoteResult")||$("#planResult");
   anchor.insertAdjacentElement("afterend",box);
   $("#runUW").onclick=runUnderwriting;
   box.scrollIntoView({behavior:"smooth",block:"start"});
 }
 const priorNav=window.v2rResumeToCheckpoint;
 window.v2rResumeToCheckpoint=function(d){
   const cp=String(d?.journey?.checkpoint||"DRAFT").toUpperCase();
   if(cp==="PERSON_CONFIRMED" || cp==="UNDERWRITING_CONFIRMED") return renderConfirmedCheckpoint(d);
   return priorNav(d);
 };
 // Re-wrap latest apply so the new navigator is the one executed after DB restoration.
 const priorApply=window.v2rApplySnapshotToStableUI;
 window.v2rApplySnapshotToStableUI=function(jid,d){
   const nav=window.v2rResumeToCheckpoint;
   // priorApply may invoke an older navigator; hide any wrong intermediate panels afterwards.
   priorApply?.(jid,d);
   if(String(d?.journey?.checkpoint||"").toUpperCase()==="PERSON_CONFIRMED"){
     setTimeout(()=>nav(d),0);
   }
   // Always refresh profile using canonical inclusive calendar days.
   setTimeout(()=>v165RefreshProfile(),0);
 };
})();

// ===== V2.0.3R.5.4 Final checkpoint/day consistency bridge =====
(function(){
 function hourOnly(v){
   v=String(v??"").trim();
   if(!v)return "";
   if(/^\d{1,2}$/.test(v)) return v.padStart(2,"0");
   const m=v.match(/^(\d{1,2}):/); return m?m[1].padStart(2,"0"):"";
 }
 function exactInsuranceDays(){
   const snap=window.V2R_DB_SNAPSHOT?.travel_profile||{};
   const sd=$("#start")?.value||snap.start_date||"";
   const ed=$("#end")?.value||snap.end_date||"";
   const sh=hourOnly($("#startHour")?.value||snap.start_time||"");
   const eh=hourOnly($("#endHour")?.value||snap.end_time||"");
   if(!sd||!ed)return null;
   if(sh!==""&&eh!==""){
     const a=new Date(`${sd}T${sh}:00:00`), b=new Date(`${ed}T${eh}:00:00`);
     if(b>a)return Math.max(1,Math.ceil((b-a)/86400000));
   }
   return Math.max(1,v165TravelDays(sd,ed));
 }
 function forceProfileInsuranceDays(){
   const n=exactInsuranceDays(); if(n==null)return;
   document.querySelectorAll("#profile .card").forEach(card=>{
     if(!(card.textContent||"").includes("行程"))return;
     const sd=$("#start")?.value||window.V2R_DB_SNAPSHOT?.travel_profile?.start_date||"";
     const ed=$("#end")?.value||window.V2R_DB_SNAPSHOT?.travel_profile?.end_date||"";
     if(sd&&ed) card.innerHTML=`<b>📅 行程</b><br>${sd.replaceAll("-","/")} ～ ${ed.replaceAll("-","/")}（保險天數${n}天）`;
   });
 }
 // Any old renderer may redraw Profile; canonical duration wins afterwards.
 const prof=$("#profile");
 if(prof){
   const mo=new MutationObserver(()=>{clearTimeout(window.__v2rDayFix);window.__v2rDayFix=setTimeout(forceProfileInsuranceDays,0)});
   mo.observe(prof,{childList:true,subtree:true,characterData:true});
 }
 document.addEventListener("change",e=>{
   if(e.target?.matches("#start,#end,#startHour,#endHour,#country,#city,#countryOther,#cityOther"))
     setTimeout(forceProfileInsuranceDays,0);
 });

 // Central checkpoint commit: every route that reaches the stable underwriting screen
 // must persist PERSON_CONFIRMED to V2R, even if an older onclick captured legacy functions.
 const oldSaveJourney=saveJourney;
 saveJourney=async function(checkpoint,extra={},status="ACTIVE"){
   const legacy=await oldSaveJourney(checkpoint,extra,status);
   if(checkpoint==="PERSON_CONFIRMED"){
     const jid=window.V2R_ACTIVE_JOURNEY||window.v2rActiveJourney;
     if(jid){
       const q=window.currentQuote||{}, rows=q.person_rows||[];
       const cards=$$(".insured-card"), count=Math.max(cards.length,rows.length);
       const persons=[];
       for(let i=1;i<=count;i++){
         const r=rows[i-1]||{}, prior=(window.v2rPersons||[])[i-1]||{};
         persons.push({
           name:$("#insuredName"+i)?.value?.trim()||r.name||prior.name||"",
           id_no:$("#insuredId"+i)?.value?.trim()||r.id_no||prior.id_no||"",
           dob:$("#insuredDob"+i)?.value||r.dob||prior.dob||"",
           relation:r.group||prior.relation||(i===1?"本人":"被保險人"),
           mobile:i===1?($("#applicantPhone")?.value?.trim()||prior.mobile||""):(prior.mobile||""),
           email:i===1?($("#applicantEmail")?.value?.trim()||prior.email||""):(prior.email||"")
         });
       }
       if(persons.length && persons.every(p=>p.name&&p.id_no&&p.dob)){
         const r=await fetch('/api/v2r/journey/'+encodeURIComponent(jid)+'/confirm-persons',{
           method:'POST',headers:{'Content-Type':'application/json'},
           body:JSON.stringify({persons,quote:q})
         });
         const d=await r.json();
         if(d.ok){
           window.v2rPersons=persons;
           if(window.v2rEntry?.unpaid)window.v2rEntry.unpaid.checkpoint="PERSON_CONFIRMED";
         }
       }
     }
   }
   return legacy;
 };
 setTimeout(forceProfileInsuranceDays,100);
})();

// ===== V2.0.4R State Consolidation =====
(function(){
 const CHECKPOINT_LABEL={
   DRAFT:"商品未選定",PRODUCT_NOT_SELECTED:"商品未選定",
   PRODUCT_SELECTED:"商品已選定",PERSON_CONFIRMED:"投保資料已確認",
   UNDERWRITING_CONFIRMED:"核保已確認",PAYMENT_COMPLETED:"付款已完成",POLICY_CREATED:"保單已成立"
 };
 function label(cp){cp=String(cp||"DRAFT").toUpperCase();return CHECKPOINT_LABEL[cp]||cp;}
 window.v2rCheckpointLabel=label;

 // After entry is fetched, overwrite only the progress text from authoritative DB checkpoint.
 function syncEntryProgress(){
   const u=window.v2rEntry?.unpaid;if(!u)return;
   const card=$("#v2rEntryResult"); if(!card)return;
   const cp=u.checkpoint||"DRAFT", txt=label(cp);
   const walker=document.createTreeWalker(card,NodeFilter.SHOW_TEXT);
   const nodes=[]; while(walker.nextNode())nodes.push(walker.currentNode);
   for(const n of nodes){
     if((n.nodeValue||"").includes("目前進度：")){
       n.nodeValue=n.nodeValue.replace(/目前進度：[^ \n<]*/,"目前進度："+txt);
     }
   }
 }
 const mo=new MutationObserver(()=>{clearTimeout(window.__v2rProgressSync);window.__v2rProgressSync=setTimeout(syncEntryProgress,0)});
 const root=$("#v2rEntryResult"); if(root)mo.observe(root,{childList:true,subtree:true,characterData:true});

 // Refresh authoritative checkpoint from DB after any checkpoint-changing operation.
 window.v2rRefreshAuthoritativeState=async function(){
   const jid=window.V2R_ACTIVE_JOURNEY||window.v2rActiveJourney||window.v2rEntry?.unpaid?.journey_id;
   if(!jid)return null;
   const r=await fetch('/api/v2r/journey/'+encodeURIComponent(jid)+'/state');
   const d=await r.json(); if(!d.ok)return d;
   if(window.v2rEntry?.unpaid){
     window.v2rEntry.unpaid.checkpoint=d.state.checkpoint;
     window.v2rEntry.unpaid.payment_status=d.state.payment_status;
   }
   syncEntryProgress(); return d.state;
 };

 // Do not let browser-only state decide navigation/progress after resume.
 const oldContinue=window.v2rContinue;
 window.v2rContinue=async function(){
   await window.v2rRefreshAuthoritativeState();
   return oldContinue();
 };

 document.addEventListener("click",e=>{
   if(e.target?.matches("#toUnderwriting,#runUW,#quoteApply,.apply-now"))
     setTimeout(()=>window.v2rRefreshAuthoritativeState(),700);
 },false);

 setTimeout(()=>window.v2rRefreshAuthoritativeState(),150);
})();

// ===== V2.0.4R.2.1 Person Hydration + PERSON_CONFIRMED Edit Gate =====
(function(){
 function persons(){return window.v2rPersons||window.V2R_DB_SNAPSHOT?.persons||[]}
 function put(id,v){const e=$(id);if(e&&v!=null&&String(v)!=="")e.value=String(v).slice(0,e.type==="date"?10:999)}
 window.v2rHydrateApplicationPersons=function(){
   const ps=persons(), rows=window.currentQuote?.person_rows||[];
   // Insured persons: DB Person Profile is authoritative; Quote is fallback only.
   for(let i=1;i<=Math.max(ps.length,rows.length);i++){
     const p=ps[i-1]||{},r=rows[i-1]||{};
     put("#insuredName"+i,p.name||r.name);
     put("#insuredId"+i,p.id_no||r.id_no);
     put("#insuredDob"+i,p.dob||r.dob);
   }
   // Applicant data is stored in the payload of the self/first person.
   const self=ps.find(p=>p.relation==="本人")||ps[0]||{};
   put("#applicantName",self.applicant_name||self.name);
   put("#applicantId",self.applicant_id_no||self.id_no);
   put("#applicantDob",self.applicant_dob||self.dob);
   put("#applicantPhone",self.applicant_phone||self.mobile);
   put("#applicantEmail",self.applicant_email||self.email);
   put("#applicantAddress",self.applicant_address||self.address);
 };
 // Actual button in this build is #applyNow.
 document.addEventListener("click",e=>{
   if(e.target?.id==="applyNow"){
     setTimeout(()=>window.v2rHydrateApplicationPersons(),0);
     setTimeout(()=>window.v2rHydrateApplicationPersons(),120);
   }
 },false);

 function isConfirmed(){return String(window.v2rEntry?.unpaid?.checkpoint||window.V2R_DB_SNAPSHOT?.journey?.checkpoint||"").toUpperCase()==="PERSON_CONFIRMED"}
 function toggleLock(lock){
   ["#start","#end","#startHour","#endHour","#country","#city","#countryOther","#cityOther","#tripDays"].forEach(x=>{const e=$(x);if(e)e.disabled=lock});
   document.querySelectorAll("#concerns input,.traveler-dob,#dobPanel input,#productResult button").forEach(e=>e.disabled=lock);
 }
 function installGate(){
   if(!isConfirmed()||window.V2R_EDIT_MODE)return;
   toggleLock(true);
   const host=$("#v2rEntryResult")||$("#profile"); if(!host||$("#v2rEditGate"))return;
   const b=document.createElement("div");b.id="v2rEditGate";b.className="entry-actions";
   b.innerHTML='<button type="button" id="v2rRequestEdit" class="secondary">修改投保內容</button>';host.appendChild(b);
   $("#v2rRequestEdit").onclick=()=>{
     if(!confirm("您已完成投保資料確認。修改行程、目的地、投保人數或保障內容，可能影響商品資格與保費，系統將重新進行商品與投保資格確認。已填寫的個人資料會保留。\n\n確定要修改嗎？"))return;
     window.V2R_EDIT_MODE=true;toggleLock(false);b.remove();
   };
 }
 const nav=window.v2rResumeToCheckpoint;
 window.v2rResumeToCheckpoint=function(d){const r=nav(d);if(String(d?.journey?.checkpoint||"").toUpperCase()==="PERSON_CONFIRMED")setTimeout(installGate,120);return r};
 setTimeout(installGate,300);
})();

// ===== V2.0.4R.2.2 Canonical Application Hydration + Full Pre-3 Lock =====
(function(){
 function jid(){return window.V2R_ACTIVE_JOURNEY||window.v2rActiveJourney||window.v2rEntry?.unpaid?.journey_id}
 function put(sel,v){const e=$(sel);if(e&&v!=null&&String(v)!=="")e.value=String(v).slice(0,e.type==="date"?10:999)}
 async function hydrateFromDB(){
   const id=jid(); if(!id)return;
   try{
     const r=await fetch('/api/v2r/journey/'+encodeURIComponent(id)+'/application-data');
     const d=await r.json(); if(!r.ok||!d.ok)return;
     const ps=d.persons||[]; window.v2rPersons=ps;
     ps.forEach((p,k)=>{
       const i=k+1;
       put("#insuredName"+i,p.name); put("#insuredId"+i,p.id_no); put("#insuredDob"+i,p.dob);
     });
     const self=ps.find(p=>p.relation==="本人")||ps[0]||{};
     put("#applicantName",self.applicant_name||self.name);
     put("#applicantId",self.applicant_id_no||self.id_no);
     put("#applicantDob",self.applicant_dob||self.dob);
     put("#applicantPhone",self.applicant_phone||self.mobile);
     put("#applicantEmail",self.applicant_email||self.email);
     put("#applicantAddress",self.applicant_address);
   }catch(e){}
 }
 // Run only after the legacy handler has rendered the dynamic insured cards.
 document.addEventListener("click",e=>{
   if(e.target?.id==="applyNow"){
     setTimeout(hydrateFromDB,20); setTimeout(hydrateFromDB,180);
   }
 },false);
 window.v2rHydrateApplicationPersons=hydrateFromDB;

 function cp(){return String(window.v2rEntry?.unpaid?.checkpoint||window.V2R_DB_SNAPSHOT?.journey?.checkpoint||"").toUpperCase()}
 function fullLock(lock){
   // Entire business content before checkpoint 3: trip, people/DOB, coverage plan and product/quote.
   document.querySelectorAll(
     '#profile input,#profile select,#profile button,'+
     '#planResult input,#planResult select,#planResult button,'+
     '#productResult input,#productResult select,#productResult button,'+
     '#quoteResult input,#quoteResult select,#quoteResult button,'+
     '#dobPanel input,#dobPanel select,#dobPanel button,#concerns input'
   ).forEach(el=>{
     if(el.id==="v2rRequestEdit")return;
     el.disabled=lock;
   });
 }
 function gate(){
   if(cp()!=="PERSON_CONFIRMED"||window.V2R_EDIT_MODE)return;
   fullLock(true);
   const host=$("#v2rEntryResult")||$("#profile"); if(!host)return;
   let box=$("#v2rEditGate");
   if(!box){box=document.createElement("div");box.id="v2rEditGate";box.className="entry-actions";box.innerHTML='<button type="button" id="v2rRequestEdit" class="secondary">修改投保內容</button>';host.appendChild(box)}
   $("#v2rRequestEdit").disabled=false;
   $("#v2rRequestEdit").onclick=()=>{
     if(!confirm("您已完成投保資料確認。修改行程、保障方案或商品，可能影響商品資格與保費，系統將重新進行必要確認。已取得的個人資料會保留。\n\n確定要修改嗎？"))return;
     window.V2R_EDIT_MODE=true; fullLock(false); box.remove();
   };
 }
 const old=window.v2rResumeToCheckpoint;
 window.v2rResumeToCheckpoint=function(d){const x=old(d);if(String(d?.journey?.checkpoint||"").toUpperCase()==="PERSON_CONFIRMED")setTimeout(gate,180);return x};
 setTimeout(gate,350);
})();

// ===== V2.0.4R.3 Checkpoint-3 Freeze / Downstream Continue / DB Underwriting =====
(function(){
 const activeJid=()=>window.V2R_ACTIVE_JOURNEY||window.v2rActiveJourney||window.v2rEntry?.unpaid?.journey_id;

 // Freeze means ONLY business content already confirmed before checkpoint 3.
 // Underwriting / declarations / payment remain enabled so "繼續投保" can move forward.
 function freezePre3(lock){
   const roots=["#profile","#planResult","#productResult","#quoteResult","#dobPanel","#aiApplyMethod","#applyPanel"];
   roots.forEach(sel=>{
     const root=$(sel); if(!root)return;
     root.querySelectorAll("input,select,textarea,button").forEach(el=>{
       // Edit Gate is never frozen. Downstream panels are outside these roots.
       if(el.id==="v2rRequestEdit")return;
       el.disabled=lock;
     });
   });
   document.querySelectorAll("#concerns input").forEach(el=>el.disabled=lock);
 }
 window.v2rFreezePre3=freezePre3;

 async function dbUWContext(){
   const jid=activeJid(); if(!jid)return null;
   const r=await fetch('/api/v2r/journey/'+encodeURIComponent(jid)+'/underwriting-context');
   const d=await r.json();
   if(!r.ok||!d.ok){showFormError(d.error||"無法取得目前投保商品。");return null}
   return d;
 }
 async function renderUWFromDB(){
   const d=await dbUWContext(); if(!d)return;
   const q=d.quote||{}, ps=d.persons||[];
   window.__v2rUWProductCode=q.product_code||"";
   $("#underwritingPanel")?.remove();
   const box=document.createElement("section");box.id="underwritingPanel";box.className="card uw-panel";
   box.innerHTML=`<div class="uw-head"><small>原案件｜資料已確認</small>
   <h2>投保資料已確認，接續告知／聲明與核保</h2><p>③以前內容已鎖定；您可以直接繼續核保與繳費。</p></div>
   <div class="uw-summary"><div><b>商品</b><span>${q.insurer_name||"－"}｜${q.product_name||q.product_code||"－"}</span></div>
   <div><b>旅客</b><span>${ps.length} 人</span></div><div><b>保費</b><span>Demo NT$ ${Number(q.total_premium||0).toLocaleString()}</span></div></div>
   <div class="known-data"><b>已確認的被保險人</b><div class="known-chips">${ps.map(p=>`<span>${p.name||p.relation||"旅客"}｜${p.dob||"－"}</span>`).join("")}</div></div>
   <div class="uw-checks"><label><input type="checkbox" id="uwTruth"> 我確認本次提供的投保資料正確完整。</label>
   <label><input type="checkbox" id="uwTerms"> 我已閱讀並同意本 Prototype 的投保聲明與資料使用說明。</label>
   <label><input type="checkbox" id="uwDisclosure"> 本次投保沒有其他需要主動補充、可能影響承保的重要事項。</label></div>
   <div class="uw-note">正式上線時，此區會依正式商品載入告知事項、核保問題、法定同意內容及電子簽署紀錄。</div>
   <div class="uw-actions"><button type="button" id="runUW" class="apply-now">確認並進行核保檢核</button></div><div id="uwResult"></div>`;
   const anchor=$("#applyPanel")||$("#quoteResult")||$("#planResult");
   anchor.insertAdjacentElement("afterend",box);
   $("#runUW").onclick=runUWDB;
   freezePre3(true);
   box.scrollIntoView({behavior:"smooth",block:"start"});
 }
 async function runUWDB(){
   if(!$("#uwTruth")?.checked||!$("#uwTerms")?.checked||!$("#uwDisclosure")?.checked){showFormError("請先完成三項投保確認。");return}
   const jid=activeJid(); if(!jid)return;
   const r=await fetch('/api/v2r/journey/'+encodeURIComponent(jid)+'/underwriting/check',{
     method:"POST",headers:{"Content-Type":"application/json"},
     body:JSON.stringify({product_code:window.__v2rUWProductCode||""})
   });
   const d=await r.json();
   if(!r.ok||!d.ok){showFormError(d.error||"核保檢核失敗。");return}
   if(window.v2rEntry?.unpaid)window.v2rEntry.unpaid.checkpoint="UNDERWRITING_CONFIRMED";
   $("#uwResult").innerHTML=`<div class="uw-pass"><b>✓ Prototype 核保檢核通過</b><p>目前商品與 DB Quote 已核對一致，可以進入繳費階段。</p><small>此結果僅為 Demo 流程，不代表任何保險公司的正式承保決定。</small></div><div class="uw-actions"><button type="button" id="uwToPayment" class="apply-now">下一步：繳費</button></div>`;
   $("#uwToPayment").onclick=goPaymentFromUW;
 }
 window.v2rRenderUWFromDB=renderUWFromDB;

 // After the explicit PERSON_CONFIRMED transaction, discard any stale UW panel and rebuild from DB.
 const oldConfirm=window.v2rConfirmApplicationAndOpenUW;
 window.v2rConfirmApplicationAndOpenUW=async function(){
   await oldConfirm();
   const jid=activeJid(); if(!jid)return;
   try{
     const r=await fetch('/api/v2r/journey/'+encodeURIComponent(jid)+'/state'),d=await r.json();
     if(d.ok&&d.state?.checkpoint==="PERSON_CONFIRMED") await renderUWFromDB();
   }catch(e){}
 };

 // Resume at checkpoint 3: freeze only pre-3 content; downstream stays live and is rebuilt from DB.
 const oldNav=window.v2rResumeToCheckpoint;
 window.v2rResumeToCheckpoint=function(d){
   const cp=String(d?.journey?.checkpoint||"").toUpperCase();
   if(cp==="PERSON_CONFIRMED"||cp==="UNDERWRITING_CONFIRMED"){
     const x=oldNav(d);
     setTimeout(()=>{freezePre3(true);renderUWFromDB()},60);
     return x;
   }
   return oldNav(d);
 };

 // Edit Gate: explicit edit unlocks pre-3 content. Old underwriting UI/result becomes invalid immediately.
 document.addEventListener("click",e=>{
   if(e.target?.id!=="v2rRequestEdit")return;
   setTimeout(()=>{
     if(window.V2R_EDIT_MODE){
       freezePre3(false);
       $("#underwritingPanel")?.remove(); $("#demoPaymentPanel")?.remove();
       window.__v2rUWProductCode="";
     }
   },0);
 },true);

 // Ensure applicant address is rehydrated after dynamic application form creation.
 document.addEventListener("click",e=>{
   if(e.target?.id==="applyNow" && typeof window.v2rHydrateApplicationPersons==="function"){
     setTimeout(()=>window.v2rHydrateApplicationPersons(),250);
   }
 },false);
})();

// ===== V2.0.4R.3.1 Explicit Edit Transaction =====
(function(){
 const jid=()=>window.V2R_ACTIVE_JOURNEY||window.v2rActiveJourney||window.v2rEntry?.unpaid?.journey_id;
 function unlock(){
  ["#start","#end","#startHour","#endHour","#country","#city","#countryOther","#cityOther","#tripDays","#adultCount","#childCount","#seniorCount"].forEach(x=>{const e=$(x);if(e)e.disabled=false});
  document.querySelectorAll('#profile input,#profile select,#profile textarea,#profile button,#dobPanel input,#dobPanel select,#dobPanel button,#concerns input,#planResult input,#planResult select,#planResult button,#productResult input,#productResult select,#productResult button,#quoteResult input,#quoteResult select,#quoteResult button,#applyPanel input,#applyPanel select,#applyPanel textarea,#applyPanel button').forEach(e=>e.disabled=false);
 }
 async function begin(){
  const id=jid();if(!id)return;
  if(!confirm("您已完成投保資料確認。修改行程、保障方案或商品，可能影響商品資格與保費，系統將重新進行必要確認。已取得的個人資料會保留。\n\n確定要修改嗎？"))return;
  const r=await fetch('/api/v2r/journey/'+encodeURIComponent(id)+'/edit-start',{method:"POST"}),d=await r.json();
  if(!r.ok||!d.ok){showFormError(d.error||"無法進入修改模式。");return}
  window.V2R_EDIT_MODE=true;if(window.v2rEntry?.unpaid)window.v2rEntry.unpaid.checkpoint=d.checkpoint;
  $("#underwritingPanel")?.remove();$("#demoPaymentPanel")?.remove();window.__v2rUWProductCode="";
  unlock();$("#v2rEditGate")?.remove();setTimeout(unlock,60);setTimeout(unlock,250);
 }
 document.addEventListener("click",e=>{const b=e.target?.closest?.("button");if(!b||!String(b.textContent||"").includes("修改投保內容"))return;e.preventDefault();e.stopImmediatePropagation();begin()},true);
 const old=window.v2rConfirmApplicationAndOpenUW;
 window.v2rConfirmApplicationAndOpenUW=async function(){
  await old();const id=jid();if(!id)return;
  try{const r=await fetch('/api/v2r/journey/'+encodeURIComponent(id)+'/state'),d=await r.json();
   if(d.ok&&d.state?.checkpoint==="PERSON_CONFIRMED"){window.V2R_EDIT_MODE=false;if(window.v2rEntry?.unpaid)window.v2rEntry.unpaid.checkpoint="PERSON_CONFIRMED";if(window.v2rFreezePre3)window.v2rFreezePre3(true)}
  }catch(e){}
 };
})();

// ===== V2.0.5R Checkpoint-3 Transaction Consolidation =====
(function(){
 const jid=()=>window.V2R_ACTIVE_JOURNEY||window.v2rActiveJourney||window.v2rEntry?.unpaid?.journey_id;
 function collectPeople(){
   const out=[];
   document.querySelectorAll('[id^="insuredName"]').forEach((nameEl,k)=>{
     const i=k+1;
     out.push({
       name:nameEl.value.trim(), id_no:$("#insuredId"+i)?.value?.trim()||"", dob:$("#insuredDob"+i)?.value||"",
       relation:$("#insuredRelation"+i)?.value||((i===1)?"本人":""),
       mobile:(i===1?($("#applicantPhone")?.value?.trim()||""):""),
       email:(i===1?($("#applicantEmail")?.value?.trim()||""):""),
       applicant_name:(i===1?($("#applicantName")?.value?.trim()||""):""),
       applicant_id_no:(i===1?($("#applicantId")?.value?.trim()||""):""),
       applicant_dob:(i===1?($("#applicantDob")?.value||""):""),
       applicant_phone:(i===1?($("#applicantPhone")?.value?.trim()||""):""),
       applicant_email:(i===1?($("#applicantEmail")?.value?.trim()||""):""),
       applicant_address:(i===1?($("#applicantAddress")?.value?.trim()||""):"")
     });
   });
   return out;
 }
 async function commit3(){
   const id=jid(); if(!id)return;
   const people=collectPeople();
   if(!people.length){showFormError("尚未取得被保險人資料。");return}
   const productCode=window.currentQuote?.product_code||window.currentQuote?.productCode||window.selectedPlan?.product_code||window.selectedPlan?.productCode||"";
   const btn=$("#toUnderwriting"); if(btn){btn.disabled=true;btn.textContent="正在確認資料…"}
   try{
     const r=await fetch('/api/v2r/journey/'+encodeURIComponent(id)+'/confirm-transaction',{
       method:"POST",headers:{"Content-Type":"application/json"},
       body:JSON.stringify({product_code:productCode,persons:people})
     });
     const d=await r.json();
     if(!r.ok||!d.ok){showFormError(d.error||"資料確認失敗。");return}
     window.V2R_EDIT_MODE=false;
     if(window.v2rEntry?.unpaid)window.v2rEntry.unpaid.checkpoint="PERSON_CONFIRMED";
     // DB response becomes the only quote authority for downstream rendering.
     window.currentQuote=Object.assign({},window.currentQuote||{},d.quote||{});
     $("#underwritingPanel")?.remove();
     if(window.v2rFreezePre3)window.v2rFreezePre3(true);
     if(window.v2rRenderUWFromDB)await window.v2rRenderUWFromDB();
   }finally{
     if(btn){btn.disabled=false;btn.textContent="資料確認"}
   }
 }
 // The former two-step button now has one responsibility and one label.
 function consolidateButton(){
   const b=$("#toUnderwriting"); if(!b)return;
   b.textContent="資料確認";
   if(b.dataset.v215Bound==="1") return;
   b.dataset.v215Bound="1";
   b.onclick=function(e){e.preventDefault();e.stopPropagation();v2rConfirmApplicationAndOpenUW();};
 }
 const mo=new MutationObserver(()=>consolidateButton());mo.observe(document.body,{childList:true,subtree:true});
 setTimeout(consolidateButton,200);

 // Remove any redundant legacy "投保資料完成，進入確認／核保" control if it is not #toUnderwriting.
 function removeRedundant(){
   document.querySelectorAll("button").forEach(b=>{
     if(b.id!=="toUnderwriting" && String(b.textContent||"").includes("投保資料完成") && String(b.textContent||"").includes("核保")) b.remove();
   });
 }
 const mo2=new MutationObserver(removeRedundant);mo2.observe(document.body,{childList:true,subtree:true});setTimeout(removeRedundant,250);
})();

// ===== V2.0.5R.1 state repair =====
(function(){
 const jid=()=>window.V2R_ACTIVE_JOURNEY||window.v2rActiveJourney||window.v2rEntry?.unpaid?.journey_id;
 // In edit mode, current DOB/count wins over stale DB when application cards are rendered.
 const oldH=window.v2rHydrateApplicationPersons;
 window.v2rHydrateApplicationPersons=async function(){
  const ds=[...document.querySelectorAll('#dobPanel input[type="date"],.traveler-dob')];
  if(window.V2R_EDIT_MODE&&ds.length){
   let ps=[];try{const id=jid();if(id){const r=await fetch('/api/v2r/journey/'+encodeURIComponent(id)+'/application-data'),d=await r.json();if(d.ok)ps=d.persons||[]}}catch(e){}
   ds.forEach((d,k)=>{const i=k+1,p=ps[k]||{};if($("#insuredName"+i)&&!$("#insuredName"+i).value)$("#insuredName"+i).value=p.name||"";if($("#insuredId"+i)&&!$("#insuredId"+i).value)$("#insuredId"+i).value=p.id_no||"";if($("#insuredDob"+i))$("#insuredDob"+i).value=d.value||p.dob||""});
   return;
  } if(oldH)return oldH();
 };
 // One checkpoint-3 commit button only.
 function clean(){document.querySelectorAll("button").forEach(b=>{if(String(b.textContent||"").replace(/\s/g,"")==="資料已確認")b.remove()})}
 new MutationObserver(clean).observe(document.body,{childList:true,subtree:true});setTimeout(clean,100);
 // Resume checkpoint 3 must re-freeze after legacy render completes.
 async function freeze(){
  const id=jid();if(!id)return;try{const r=await fetch('/api/v2r/journey/'+encodeURIComponent(id)+'/state'),d=await r.json();
  if(d.ok&&["PERSON_CONFIRMED","UNDERWRITING_CONFIRMED"].includes(d.state?.checkpoint)){window.V2R_EDIT_MODE=false;[100,450,1000].forEach(ms=>setTimeout(()=>window.v2rFreezePre3?.(true),ms))}}catch(e){}
 }
 document.addEventListener("click",e=>{const b=e.target?.closest?.("button");if(b&&String(b.textContent||"").includes("繼續投保"))setTimeout(freeze,200)},true);
 // Fresh journey does not erase access to unfinished journeys.
 async function switcher(){
  try{const r=await fetch('/api/v2r/customer/current'),d=await r.json(),items=d.journeys||d.items||d.unpaid_journeys||[];if(!Array.isArray(items)||!items.length||$("#v2rJourneySwitcher"))return;
  const host=$("#v2rEntryResult")||document.querySelector("aside")||document.body,box=document.createElement("div");box.id="v2rJourneySwitcher";box.className="entry-card";box.innerHTML='<b>我的投保案件</b><div id="v2rJourneyLinks" class="entry-actions"></div>';host.prepend(box);
  items.filter(x=>x.status!=="CANCELLED"&&x.payment_status!=="PAID").forEach(x=>{const id=x.journey_id||x.id;if(!id)return;const b=document.createElement("button");b.type="button";b.className="secondary";b.textContent="回到 "+(x.destination_city||x.city||x.product_name||id);b.onclick=()=>{localStorage.setItem("v2r_active_journey",id);location.reload()};$("#v2rJourneyLinks").appendChild(b)})
  }catch(e){}
 }
 document.addEventListener("click",e=>{const b=e.target?.closest?.("button");if(b&&String(b.textContent||"").includes("新增旅程"))setTimeout(switcher,500)},true);setTimeout(switcher,500);
})();

// ===== V2.1.2 投保查詢／單一清單／內容／繳費 =====
(function(){
 const q=s=>document.querySelector(s);
 const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 function killLegacy(){["#v2rEntryPanel","#v2rJourneySwitcher","#resumeJourneyPanel"].forEach(x=>q(x)?.remove());document.querySelectorAll("button").forEach(b=>{if((b.textContent||"").includes("新增旅程"))b.remove()})}
 new MutationObserver(killLegacy).observe(document.body,{childList:true,subtree:true});
 function modal(html,wide=true){q("#v21Modal")?.remove();let m=document.createElement("div");m.id="v21Modal";m.className="v212-overlay";m.innerHTML=`<div class="v212-modal ${wide?"wide":""}">${html}</div>`;document.body.appendChild(m);return m}
 const close=()=>q("#v21Modal")?.remove();
 function travel(t){return `${esc(t.start_date||t.departure_date||"－")} ～ ${esc(t.end_date||t.return_date||"－")}`}
 function place(t){return [t.destination_country||t.country,t.destination_city||t.city].filter(Boolean).map(esc).join(" / ")||"－"}
 function product(x){return [x.insurer_name,x.product_name].filter(Boolean).map(esc).join(" ")||"尚未選定"}
 function coverageRows(c,normalized){
   if((normalized||[]).length) return normalized.map(x=>`<tr><td>${esc(x.name)}</td><td>${esc(x.value)}</td></tr>`).join("");
   const names={accident:"意外傷害",medical:"海外醫療",rescue:"緊急救援",accident_amount:"意外傷害",medical_amount:"海外醫療",rescue_amount:"緊急救援"};
   let rows=[],seen=new Set();
   Object.entries(names).forEach(([k,n])=>{if(c[k]&&!seen.has(n)){rows.push(`<tr><td>${n}</td><td>${esc(c[k])}</td></tr>`);seen.add(n)}});
   ["core","extras","concerns"].forEach(k=>(c[k]||[]).forEach(n=>{if(n&&!seen.has(n)){rows.push(`<tr><td>${esc(n)}</td><td>✓</td></tr>`);seen.add(n)}}));
   return rows.length?rows.join(""):'<tr><td colspan="2">尚無保障資料</td></tr>';
 }
 function peopleRows(ps){return ps.length?ps.map((p,i)=>{let x=p.payload||{};return `<tr><td>${i+1}</td><td>${esc(p.name||x.name||"－")}</td><td>${esc(p.id_no||x.id_no||"－")}</td><td>${esc(p.dob||x.dob||"－")}</td><td>${esc(p.relation||x.relation||"－")}</td></tr>`}).join(""):'<tr><td colspan="5">尚無人員資料</td></tr>'}
 function detailHtml(x){
  let t=x.travel||{},c=x.coverage||{},a=x.applicant||{},title=x.policy_no?"保單細部內容":"投保細部內容";
  return `<div id="v212Printable"><h2>${title}</h2>
  <div class="v212-summary"><div><b>${x.policy_no?"保單號":"投保號"}</b><span>${esc(x.policy_no||x.application_no)}</span></div><div><b>投保狀態</b><span>${esc(x.status_label)}</span></div>
  <div><b>要保人</b><span>${esc(a.name||"－")}</span></div><div><b>手機</b><span>${esc(a.mobile||a.phone||"－")}</span></div>
  <div><b>行程</b><span>${esc((t.start_date||"－")+" "+(t.start_time||""))} ～ ${esc((t.end_date||"－")+" "+(t.end_time||""))}${x.insurance_days?`（保險天數${x.insurance_days}天）`:""}</span></div><div><b>目的地</b><span>${place(t)}</span></div>
  <div><b>投保商品</b><span>${product(x)}</span></div><div><b>總保費</b><span>${x.total_premium?"NT$ "+Number(x.total_premium).toLocaleString():"－"}</span></div></div>
  <h3>保障內容</h3><table class="v212-detail-table"><thead><tr><th>保障項目</th><th>內容／保額</th></tr></thead><tbody>${coverageRows(c,x.coverage_rows)}</tbody></table>
  <h3>被保險人資料</h3><table class="v212-detail-table"><thead><tr><th>#</th><th>姓名</th><th>身分證字號</th><th>出生日期</th><th>關係</th></tr></thead><tbody>${peopleRows(x.persons||[])}</tbody></table></div>`;
 }
 function printDetail(){
  let body=q("#v212Printable")?.outerHTML||"";let w=window.open("","_blank","width=900,height=800");
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>投保內容</title><style>body{font-family:-apple-system,BlinkMacSystemFont,"Noto Sans TC",sans-serif;padding:32px;color:#17324d}h2{border-bottom:2px solid #17324d;padding-bottom:10px}h3{margin-top:24px}.v212-summary{display:grid;grid-template-columns:1fr 1fr;gap:10px}.v212-summary div{padding:9px;border-bottom:1px solid #ddd}.v212-summary b{display:block;font-size:12px;color:#667}.v212-summary span{display:block;margin-top:4px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccd5df;padding:8px;text-align:left}th{background:#f3f6f9}</style></head><body>${body}</body></html>`);
  w.document.close();w.focus();setTimeout(()=>w.print(),250);
 }
 async function detail(id){
  let r=await fetch("/api/v21/application/"+encodeURIComponent(id)),d=await r.json();if(!d.ok){alert(d.error||"查詢失敗");return}
  modal(`${detailHtml(d.detail)}<div class="v212-footer"><button id="v212Download" class="secondary">下載</button><button id="v212Close">結束</button></div>`);
  q("#v212Download").onclick=printDetail;q("#v212Close").onclick=close;
 }
 function paymentModal(x){
  let a=x.applicant||{};
  modal(`<h2>繼續投保｜繳費</h2><div class="v212-pay-summary"><div><b>要保人</b><span>${esc(a.name||"－")}</span></div><div><b>投保商品</b><span>${product(x)}</span></div><div><b>應付保費</b><span>${x.total_premium?"Demo NT$ "+Number(x.total_premium).toLocaleString():"－"}</span></div></div>
  <div class="demo-warning">Prototype 測試：請勿輸入真實信用卡資料。</div>
  <div class="v212-card"><label>持卡人姓名<input id="v212CardName" placeholder="測試姓名"></label><label>信用卡號<input id="v212CardNo" placeholder="Demo：4242 4242 4242 4242"></label><label>有效期限<input id="v212Exp" placeholder="MM/YY"></label><label>安全碼<input id="v212Cvv" placeholder="CVV"></label></div>
  <div class="v212-footer"><button id="v212Pay">Demo 付款</button><button id="v212PayClose" class="secondary">結束</button></div>`,false);
  q("#v212PayClose").onclick=close;
  q("#v212Pay").onclick=async()=>{
    let body={holder:q("#v212CardName").value,card_no:q("#v212CardNo").value,expiry:q("#v212Exp").value,cvv:q("#v212Cvv").value};
    let r=await fetch("/api/v21/application/"+encodeURIComponent(x.journey_id)+"/pay-demo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}),d=await r.json();
    if(!d.ok){alert(d.error||"付款失敗");return}
    modal('<h2>Demo 繳費完成</h2><p>繳費已完成。是否要現在出單？</p><div class="v212-footer"><button id="v212Done" class="secondary">暫時不要</button><button id="v212IssueNow">要，確定出單</button></div>',false);
    q("#v212Done").onclick=close;
    q("#v212IssueNow").onclick=async()=>{
      let btn=q("#v212IssueNow"); btn.disabled=true; btn.textContent="出單中…";
      let rr=await fetch("/api/v220/application/"+encodeURIComponent(x.journey_id)+"/issue-policy",{method:"POST"}),z=await rr.json();
      if(!rr.ok||!z.ok){alert(z.error||"出單失敗");btn.disabled=false;btn.textContent="要，確定出單";return}
      modal(`<h2>🎉 投保完成</h2><div class="v212-pay-summary"><div><b>保單號碼</b><span>${esc(z.policy_no||"－")}</span></div><div><b>投保商品</b><span>${esc(((z.insurer_name||"")+" "+(z.product_name||"")).trim()||"－")}</span></div><div><b>投保狀態</b><span>已出單</span></div></div>
      <div class="demo-warning"><b>電子保單寄送說明</b><br>電子保單將寄送至要保人投保時登錄的 Email。<br><small>Prototype：尚未實際寄送 Email。</small></div>
      <div class="v212-footer"><button id="v212IssuedClose" class="secondary">結束</button><button id="v212IssuedTravel">進入旅程服務</button></div>`,false);
      q("#v212IssuedClose").onclick=close;
      q("#v212IssuedTravel").onclick=()=>{close();window.v222OpenTravelMode({journey_id:x.journey_id,policy_no:z.policy_no,insurer_name:z.insurer_name,product_name:z.product_name});};
    };
  };
 }
 async function cont(id){
  let r=await fetch("/api/v21/application/"+encodeURIComponent(id)+"/continue",{method:"POST"}),d=await r.json();
  if(!d.ok){alert(d.error||"無法繼續投保");return}
  if(d.action==="PAYMENT"){paymentModal(d.case);return}
  if(d.action==="ISSUED" || d.action==="POLICY_CREATED"){
    const x=d.case||d.item||{};
    window.v222OpenTravelMode({journey_id:x.journey_id,policy_no:x.policy_no||x.number_label||"",insurer_name:x.insurer_name||"",product_name:x.product_name||""});return;
  }
  if(d.action==="PAID"){
    const x=d.case||d.item||{};
    modal('<h2>Demo 繳費完成</h2><p>此案件已完成繳費。是否要現在出單？</p><div class="v212-footer"><button id="v212PaidLater" class="secondary">暫時不要</button><button id="v212PaidIssue">要，確定出單</button></div>',false);
    q("#v212PaidLater").onclick=close;
    q("#v212PaidIssue").onclick=async()=>{
      let btn=q("#v212PaidIssue");btn.disabled=true;btn.textContent="出單中…";
      let rr=await fetch("/api/v220/application/"+encodeURIComponent(x.journey_id)+"/issue-policy",{method:"POST"}),z=await rr.json();
      if(!rr.ok||!z.ok){alert(z.error||"出單失敗");btn.disabled=false;btn.textContent="要，確定出單";return}
      modal(`<h2>🎉 投保完成</h2><div class="v212-pay-summary"><div><b>保單號碼</b><span>${esc(z.policy_no||"－")}</span></div><div><b>投保商品</b><span>${esc(((z.insurer_name||"")+" "+(z.product_name||"")).trim()||"－")}</span></div><div><b>投保狀態</b><span>已出單</span></div></div>
      <div class="demo-warning"><b>電子保單寄送說明</b><br>電子保單將寄送至要保人投保時登錄的 Email。<br><small>Prototype：尚未實際寄送 Email。</small></div>
      <div class="v212-footer"><button id="v212PaidIssuedClose" class="secondary">結束</button><button id="v212PaidIssuedTravel">進入旅程服務</button></div>`,false);
      q("#v212PaidIssuedClose").onclick=close;
      q("#v212PaidIssuedTravel").onclick=()=>{close();window.v222OpenTravelMode({journey_id:x.journey_id,policy_no:z.policy_no,insurer_name:z.insurer_name,product_name:z.product_name});};
    };
    return;
  }
  if(d.action==="RESTART"){close();alert("此案件將從行程規劃重新開始。");return}
 }
 async function del(id,mobile,issued){
  if(issued){alert("保單已出單，如需取消或變更請洽客服。");return}
  if(!confirm("確定刪除此筆尚未完成的投保資料？"))return;
  let r=await fetch("/api/v21/application/"+encodeURIComponent(id)+"/delete",{method:"POST"}),d=await r.json();if(!d.ok){alert(d.error||"刪除失敗");return}query(mobile);
 }
 async function query(mobile){
  mobile=(mobile||"").trim();if(!mobile){alert("請輸入手機號碼");return}
  let r=await fetch("/api/v21/applications?mobile="+encodeURIComponent(mobile)),d=await r.json();if(!d.ok){alert(d.error||"查詢失敗");return}
  list(d.items||[],mobile);
 }
 function list(items,mobile){
  modal(`<div class="v212-title"><h2>投保清單</h2><button id="v212ListClose" class="secondary">結束</button></div><p>手機號碼：${esc(mobile)}</p>
  <div class="v212-table-wrap"><table class="v212-list"><thead><tr><th>保單號／投保號</th><th>要保人</th><th>行程</th><th>目的地</th><th>人數</th><th>投保商品</th><th>總保費</th><th>投保內容</th><th>投保狀態</th><th>執行</th></tr></thead><tbody id="v212Rows"></tbody></table></div>`);
  q("#v212ListClose").onclick=close;let host=q("#v212Rows");
  if(!items.length){host.innerHTML='<tr><td colspan="10">查無投保資料。</td></tr>';return}
  items.forEach(x=>{let closed=x.status_label==="已結案",issued=x.status_label==="已出單",tr=document.createElement("tr");
   tr.innerHTML=`<td>${esc(x.number_label)}</td><td>${esc(x.applicant_name||"－")}</td><td>${esc((x.travel?.start_date||x.start_date||"－")+" "+(x.travel?.start_time||""))} ～ ${esc((x.travel?.end_date||x.end_date||"－")+" "+(x.travel?.end_time||""))}${x.insurance_days?`（保險天數${x.insurance_days}天）`:""}</td><td>${esc(x.destination||"－")}</td><td>${x.person_count}人</td><td>${product(x)}</td><td>${x.total_premium?"NT$ "+Number(x.total_premium).toLocaleString():"－"}</td><td><button class="v212Detail secondary">查詢</button></td><td>${esc(x.status_label)}</td><td class="v212-actions">${closed?'':((issued?'<button class="v212Travel">旅程服務</button>':'<button class="v212Continue">繼續投保</button>')+'<button class="v212Delete secondary">刪除</button>')}</td>`;
   tr.querySelector(".v212Detail").onclick=()=>detail(x.journey_id);
   let travelBtn=tr.querySelector(".v212Travel");
   if(travelBtn) travelBtn.onclick=()=>window.v222OpenTravelMode({journey_id:x.journey_id,policy_no:x.policy_no||x.number_label||"",insurer_name:x.insurer_name||"",product_name:x.product_name||""});let delBtn=tr.querySelector(".v212Delete");if(delBtn)delBtn.onclick=()=>del(x.journey_id,mobile,issued);let b=tr.querySelector(".v212Continue");if(b)b.onclick=()=>cont(x.journey_id);host.appendChild(tr);
  });
 }
 function install(){
  killLegacy();q("#v21HomeActions")?.remove();let header=document.querySelector("header");if(!header)return;
  let box=document.createElement("div");box.id="v21HomeActions";box.className="v21-home-actions";box.innerHTML='<button id="v212Inquiry">投保查詢</button><button id="v212Exit" class="secondary">結束</button>';header.appendChild(box);
  q("#v212Inquiry").onclick=()=>{modal('<h2>投保查詢</h2><label>手機號碼</label><input id="v212Mobile" placeholder="請輸入手機號碼"><div class="v212-footer"><button id="v212Query">查詢</button><button id="v212QueryClose" class="secondary">結束</button></div>',false);q("#v212Query").onclick=()=>query(q("#v212Mobile").value);q("#v212QueryClose").onclick=close};
  q("#v212Exit").onclick=()=>{localStorage.removeItem("v2r_active_journey");location.reload()};
 }
 window.addEventListener("DOMContentLoaded",()=>setTimeout(install,100));setTimeout(install,500);
})();


// ===== V2.1.5 simplified application UI =====
(function(){
 function clean(){document.querySelectorAll("button,a").forEach(function(el){if((el.textContent||"").replace(/\s+/g,"")==="返回保障規劃")el.remove();});}
 clean(); new MutationObserver(clean).observe(document.body,{childList:true,subtree:true});
})();

window.v222OpenTravelMode=async function(x={}){
 document.getElementById("v222TravelMode")?.remove();
 const jid=x.journey_id||"";
 const o=document.createElement("div");o.id="v222TravelMode";
 o.style.cssText="position:fixed;inset:0;z-index:2147483647;background:rgba(15,35,50,.55);display:flex;align-items:center;justify-content:center;padding:24px";
 const d=document.createElement("div");d.style.cssText="width:min(820px,calc(100vw - 48px));max-height:calc(100vh - 48px);overflow:auto;background:white;border-radius:18px;padding:28px;color:#183247;box-sizing:border-box";
 o.appendChild(d);document.body.appendChild(o);
 const esc2=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
 async function load(){
  d.innerHTML='<p>AI 旅程服務載入中…</p>';
  let r=await fetch("/api/v230/travel/"+encodeURIComponent(jid)),z=await r.json();
  if(!r.ok||!z.ok){d.innerHTML='<h2>AI 旅程服務</h2><p>'+esc2(z.error||"載入失敗")+'</p><button id="tmClose">結束</button>';d.querySelector("#tmClose").onclick=()=>o.remove();return}
  let s=z.data,t=s.travel||{},cov=s.coverage||{}, cases=s.service_cases||[];
  let dest=t.destination||[t.country,t.city].filter(Boolean).join("／")||"－";
  let period=[t.start_date,t.start_time].filter(Boolean).join(" ")+" ～ "+[t.end_date,t.end_time].filter(Boolean).join(" ");
  let open=cases.filter(c=>c.status==="OPEN");
  let status=s.closed?"已結案":(s.trip_ended?"旅程已結束":"旅程服務中");
  d.innerHTML=`<div style="display:flex;justify-content:space-between;gap:12px"><div><h2 style="margin:0">✈️ AI 旅程服務</h2><p style="margin:6px 0">出發前、旅途中、回國後一路協助。</p></div><button id="tmClose" class="secondary">結束</button></div>
  <div style="padding:14px;background:#f4f7fa;border-radius:12px"><b>保單：</b>${esc2(s.policy_no||x.policy_no||"－")}　<b>狀態：</b>${status}<br><b>商品：</b>${esc2(((s.quote.insurer_name||x.insurer_name||"")+" "+(s.quote.product_name||x.product_name||"")).trim()||"－")}<br><b>行程：</b>${esc2(dest)}｜${esc2(period||"－")}</div>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:18px">
   <button class="tmSvc" data-t="coverage">🛡️ <b>我的保障</b><br><small>保障、保額與重要提醒</small></button>
   <button class="tmSvc" data-t="flight">🛫 <b>班機／行程</b><br><small>延誤事件與證明文件</small></button>
   <button class="tmSvc" data-t="emergency">🆘 <b>海外緊急協助</b><br><small>生病、事故處理指引</small></button>
   <button class="tmSvc" data-t="claim">📄 <b>理賠協助</b><br><small>建立案件、整理應備文件</small></button>
  </div>
  <div id="tmPanel" style="margin-top:18px;padding:16px;border:1px solid #d9e4ec;border-radius:12px"><b>AI：</b>目前有 ${open.length} 件未完成服務案件。請選擇需要的協助。</div>
  <div style="margin-top:16px;padding:14px;background:#f8fafb;border-radius:12px"><b>服務案件</b><div id="tmCases">${cases.length?cases.map(c=>`<div style="padding:8px 0;border-bottom:1px solid #e6edf2">${c.service_type==="CLAIM"?"理賠":c.service_type==="EMERGENCY"?"緊急協助":"班機事件"}｜${c.status==="OPEN"?"處理中":"已完成"} ${(!s.closed&&c.status==="OPEN")?`<button class="tmDone secondary" data-id="${c.service_id}">標示完成</button>`:""}</div>`).join(""):"<p>目前沒有服務案件。</p>"}</div></div>
  <div style="margin-top:18px;padding:14px;border:1px solid #d9e4ec;border-radius:12px"><b>旅程結案</b><p style="margin:6px 0">${s.closed?"本旅程已結案，保單與服務紀錄仍保留於歷史查詢。":s.can_close?"旅程已結束，且沒有未完成服務案件，可以結案。":esc2(s.close_reason||"旅程進行中。")}</p>${s.can_close?'<button id="tmCloseJourney">確認結案</button>':""}</div>`;
  d.querySelector("#tmClose").onclick=async()=>{
    if(s.closed){o.remove();return}
    if(s.can_close){
      if(!confirm("旅程已結束，且所有服務案件均已完成。是否確認結案？"))return;
      let rr=await fetch("/api/v230/travel/"+encodeURIComponent(jid)+"/close",{method:"POST"}),zz=await rr.json();
      if(!rr.ok||!zz.ok){alert(zz.error||"結案失敗");return}
      o.remove();return;
    }
    o.remove();
  };
  const panel=d.querySelector("#tmPanel");
  d.querySelectorAll(".tmSvc").forEach(b=>b.onclick=async()=>{
   if(s.closed){
    const labels={coverage:"🛡️ 我的保障",flight:"🛫 班機／行程",emergency:"🆘 海外緊急協助",claim:"📄 理賠協助"};
    panel.innerHTML='<b>'+esc2(labels[b.dataset.t]||"旅程服務")+'</b><p>本旅程已結案，僅供歷史資料查詢；不可再建立、變更或完成服務案件。</p>';
    return;
   }
   if(b.dataset.t==="coverage"){
    let rows=[]; [["意外傷害",cov.accident||cov.accident_amount],["海外醫療",cov.medical||cov.medical_amount],["緊急救援",cov.rescue||cov.rescue_amount]].forEach(v=>{if(v[1])rows.push(v[0]+"："+v[1])});
    let extras=[...(cov.core||[]),...(cov.extras||[]),...(cov.concerns||[])]; extras=[...new Set(extras)];
    panel.innerHTML="<b>🛡️ 我的保障</b><p>"+esc2(rows.concat(extras).join("｜")||"請以正式保單條款與保障明細為準。")+"</p><small>AI僅整理已投保資料；實際承保範圍、除外責任與理賠認定以保單條款為準。</small>";
   }
   if(b.dataset.t==="flight"){
    panel.innerHTML='<b>🛫 班機／行程</b><p>若發生班機延誤，請先保留航空公司延誤／取消證明、登機證或電子機票，以及必要支出單據。</p><button id="tmFlightCase">建立班機事件</button><br><small>Prototype 尚未串接即時航班 API，不會自行判定延誤。</small>';
    panel.querySelector("#tmFlightCase").onclick=()=>createCase("FLIGHT","班機延誤／行程事件");
   }
   if(b.dataset.t==="emergency"){
    panel.innerHTML='<b>🆘 海外緊急協助</b><p>若有人身安全或急重症風險，請優先聯絡當地緊急救援／醫療機構；之後保存診斷證明、醫療費用收據與相關紀錄。</p><button id="tmEmergencyCase">建立緊急協助案件</button><br><small>Prototype 不取代當地緊急電話、醫師或保險公司正式海外急難救助專線。</small>';
    panel.querySelector("#tmEmergencyCase").onclick=()=>createCase("EMERGENCY","海外醫療／事故協助");
   }
   if(b.dataset.t==="claim"){
    panel.innerHTML='<b>📄 理賠協助</b><p>AI會先建立理賠待辦。一般應先準備事故／延誤證明、保單資料、身分資料，以及與事故類型相關的正本或電子單據；實際文件仍依保險公司要求。</p><button id="tmClaimCase">建立理賠案件</button>';
    panel.querySelector("#tmClaimCase").onclick=()=>createCase("CLAIM","旅程理賠申請");
   }
  });
  async function createCase(type,note){
    if(s.closed){alert("本旅程已結案，不能再建立服務案件。");return}
    let rr=await fetch("/api/v230/travel/"+encodeURIComponent(jid)+"/service-case",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({service_type:type,note})}),zz=await rr.json();
    if(!rr.ok||!zz.ok){alert(zz.error||"建立失敗");return} await load();
  }
  d.querySelectorAll(".tmDone").forEach(b=>b.onclick=async()=>{
    let rr=await fetch("/api/v230/travel/"+encodeURIComponent(jid)+"/service-case/"+encodeURIComponent(b.dataset.id)+"/complete",{method:"POST"}),zz=await rr.json();
    if(!rr.ok||!zz.ok){alert(zz.error||"更新失敗");return} await load();
  });
  d.querySelector("#tmCloseJourney")?.addEventListener("click",async()=>{
    if(!confirm("確認本旅程沒有未完成的事故、理賠或服務需求，並將案件結案？"))return;
    let rr=await fetch("/api/v230/travel/"+encodeURIComponent(jid)+"/close",{method:"POST"}),zz=await rr.json();
    if(!rr.ok||!zz.ok){alert(zz.error||"結案失敗");return} await load();
  });
 }
 await load();
};

