from openai import OpenAI
import mimetypes
import base64
import json
import os, re, sqlite3, uuid
from ai.document_vision_agent import recognize_document
from flask import Flask,render_template,request,jsonify,session

from io import BytesIO
from datetime import datetime, date
from openpyxl import load_workbook
from ai.travel_agent import update_profile,empty_profile
from ai.rate_engine import quote, tier_options, scenario_for
from datetime import datetime
app=Flask(__name__);app.secret_key="v12-local"
@app.get("/")
def index():return render_template("index.html")

# ===== V1.9.12 Application Journey / Checkpoint =====
JOURNEY_DB=os.path.join(os.path.dirname(__file__),"data","journey.db")
os.makedirs(os.path.dirname(JOURNEY_DB),exist_ok=True)
def _jdb():
    c=sqlite3.connect(JOURNEY_DB);c.row_factory=sqlite3.Row
    c.execute("""CREATE TABLE IF NOT EXISTS application_journey(
      journey_id TEXT PRIMARY KEY,status TEXT NOT NULL,checkpoint TEXT NOT NULL,
      payload TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)""")
    return c
def _journey_row(r):
    if not r:return None
    x=dict(r);x["payload"]=json.loads(x["payload"] or "{}");return x

@app.get("/api/journey/latest")
def journey_latest():
    c=_jdb();r=c.execute("SELECT * FROM application_journey WHERE status NOT IN ('CANCELLED','PURGED') ORDER BY updated_at DESC LIMIT 1").fetchone();c.close()
    return jsonify(ok=True,journey=_journey_row(r))

@app.post("/api/journey/save")
def journey_save():
    d=request.get_json(silent=True) or {};jid=d.get("journey_id") or session.get("journey_id") or ("J-"+uuid.uuid4().hex[:10].upper())
    checkpoint=d.get("checkpoint") or "DRAFT";status=d.get("status") or "ACTIVE";payload=d.get("payload") or {}
    now=datetime.now().isoformat(timespec="seconds");c=_jdb();old=c.execute("SELECT payload,created_at FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
    merged=json.loads(old["payload"]) if old else {};merged.update(payload)
    c.execute("""INSERT OR REPLACE INTO application_journey(journey_id,status,checkpoint,payload,created_at,updated_at)
      VALUES(?,?,?,?,?,?)""",(jid,status,checkpoint,json.dumps(merged,ensure_ascii=False),old["created_at"] if old else now,now));c.commit();c.close();session["journey_id"]=jid
    return jsonify(ok=True,journey_id=jid,checkpoint=checkpoint,status=status)

@app.post("/api/journey/cancel")
def journey_cancel():
    d=request.get_json(silent=True) or {};jid=d.get("journey_id") or session.get("journey_id")
    if not jid:return jsonify(ok=False,error="找不到投保案件"),404
    c=_jdb();r=c.execute("SELECT checkpoint FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
    if not r:c.close();return jsonify(ok=False,error="找不到投保案件"),404
    if r["checkpoint"] in ("PAYMENT_COMPLETED","POLICY_CREATED"):
        c.close();return jsonify(ok=False,error="此案件已完成付款，請聯絡公司客服人員協助取消或變更。"),409
    c.execute("UPDATE application_journey SET status='CANCELLED',updated_at=? WHERE journey_id=?",(datetime.now().isoformat(timespec="seconds"),jid));c.commit();c.close()
    return jsonify(ok=True)

@app.post("/api/journey/invalidate")
def journey_invalidate():
    d=request.get_json(silent=True) or {};jid=d.get("journey_id") or session.get("journey_id")
    if not jid:return jsonify(ok=False,error="找不到投保案件"),404
    c=_jdb();r=c.execute("SELECT checkpoint FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
    if not r:c.close();return jsonify(ok=False,error="找不到投保案件"),404
    if r["checkpoint"] in ("PAYMENT_COMPLETED","POLICY_CREATED"):
        c.close();return jsonify(ok=False,error="已付款案件不可直接修改，請聯絡公司客服人員。"),409
    c.execute("UPDATE application_journey SET checkpoint='DRAFT',status='QUOTE_INVALIDATED',updated_at=? WHERE journey_id=?",(datetime.now().isoformat(timespec="seconds"),jid));c.commit();c.close()
    return jsonify(ok=True)

@app.post("/api/analyze")
def analyze():
 d=request.get_json(silent=True) or {};m=(d.get("message") or "").strip()
 if not m:return jsonify(ok=False,error="請輸入旅行需求"),400
 p,r=update_profile(session.get("profile") or empty_profile(),m);session["profile"]=p
 return jsonify(ok=True,profile=p,reply=r)
@app.post("/api/profile")
def profile():
 d=request.get_json(silent=True) or {};p=session.get("profile") or empty_profile();f=d.get("profile") or {}
 for k in ["start_date","end_date","country","city","adults","children","seniors","budget_range","concerns","coverage_intent"]:
  if k in f:p[k]=f[k]
 p["people"]=int(p.get("adults") or 0)+int(p.get("children") or 0)+int(p.get("seniors") or 0)
 p["destination"]="／".join(x for x in [p.get("country"),p.get("city")] if x) or "尚未提供"
 error=None
 try:
  if p.get("start_date") and p.get("end_date"):
   a=datetime.strptime(p["start_date"],"%Y/%m/%d");b=datetime.strptime(p["end_date"],"%Y/%m/%d")
   if b<a:
    p["end_date"]=None;p["days"]=None;error="回程日不可早於啟程日，請重新選擇回程日。"
   else:p["days"]=(b-a).days+1
 except:
  p["days"]=None;error="日期格式不正確，請重新選擇。"
 session["profile"]=p;return jsonify(ok=True,profile=p,error=error)

@app.post("/api/plan")
def plan():
 p=session.get("profile") or empty_profile()
 required=[]
 if not p.get("country"): required.append("目的地")
 if not p.get("start_date") or not p.get("end_date"): required.append("旅行日期")
 if not p.get("people"): required.append("投保人數")
 if required:return jsonify(ok=False,error="請先完成："+"、".join(required)),400
 d=request.get_json(silent=True) or {}
 tier=d.get("tier") or session.get("plan_tier") or "balanced"
 if tier not in {"economy","balanced","enhanced"}: tier="balanced"
 session["plan_tier"]=tier
 scenario=scenario_for(p)
 plan=quote(p,tier,d.get("accident"),d.get("medical"),d.get("rescue"),scenario=scenario)
 return jsonify(ok=True,plan=plan,options=tier_options(p,scenario),profile=p)


# ---------------- V1.9.3 Product Selection -> Quote Engine ----------------
DEMO_PRODUCTS = [
 {"id":"FUBON-A","company":"富邦產險","name":"A 小資旅遊","direction":"economy","ages":"15～未滿80歲",
  "features":["旅平險","海外醫療","旅遊不便保障"],"service":"公開商品資料 Demo；正式內容依官方投保系統"},
 {"id":"TMNEWA-A","company":"新安東京海上","name":"A 旅平險","direction":"economy","ages":"依正式網投規則",
  "features":["意外傷害","傷害醫療","個人責任"],"service":"保障結構較精簡"},
 {"id":"TAIAN-A","company":"泰安產險","name":"海外套餐 A","direction":"economy","ages":"分成人／15～18／未滿15歲",
  "features":["旅平險","緊急救援"],"service":"已有公開年齡層參考資料"},
 {"id":"CATHAY-T5","company":"國泰產險","name":"T5 安心型","direction":"balanced","ages":"依正式投保系統",
  "features":["班機延誤","行李延誤","行李損失","旅程取消"],"service":"定額型旅遊不便保障"},
 {"id":"TMNEWA-C","company":"新安東京海上","name":"C 完整型","direction":"balanced","ages":"依正式網投規則",
  "features":["意外傷害","海外突發疾病","班機延誤","旅遊不便"],"service":"含限額型不便保障"},
 {"id":"TFMI-SAFE","company":"臺灣產物","name":"安心遊","direction":"balanced","ages":"依正式投保系統",
  "features":["旅平險","海外突發疾病","班機延誤","旅程取消"],"service":"可再銜接旅遊服務能力"},
 {"id":"TAIAN-C","company":"泰安產險","name":"海外套餐 C","direction":"enhanced","ages":"分成人／15～18／未滿15歲",
  "features":["旅平險","傷害醫療","海外突發疾病","班機延誤","行李","緊急救援"],"service":"已有公開年齡層差異資料"},
 {"id":"MSIG-DIAMOND","company":"明台產險","name":"頭等晶鑽版","direction":"enhanced","ages":"依正式投保系統",
  "features":["意外","醫療","班機延誤","緊急醫療運送"],"service":"可延伸24H海外緊急救援／理賠服務"},
 {"id":"TFMI-GLOBAL","company":"臺灣產物","name":"環球遊","direction":"enhanced","ages":"依正式投保系統",
  "features":["高額旅平險","傷害醫療","海外突發疾病","旅程取消","個人責任"],"service":"高保障方向 Demo"}
]

def _age_on(dob_text, ref_text):
    from datetime import date, datetime
    try:
        dob=datetime.strptime(dob_text,"%Y-%m-%d").date()
        ref=datetime.strptime((ref_text or "")[:10],"%Y-%m-%d").date()
        return ref.year-dob.year-((ref.month,ref.day)<(dob.month,dob.day))
    except Exception:
        return None

def _travelers(p):
    # V1.9.3.1: DOB is collected before Product Engine.
    # If names are not known yet, AI uses neutral labels; legal identity remains later.
    saved=session.get("traveler_dobs") or []
    a=int(p.get("adults") or 0); c=int(p.get("children") or 0); s=int(p.get("seniors") or 0)
    total=max(int(p.get("people") or 0), a+c+s, len(saved))
    labels=[]
    labels += [f"大人{i+1}" for i in range(a)]
    labels += [f"小孩{i+1}" for i in range(c)]
    labels += [f"長輩{i+1}" for i in range(s)]
    while len(labels)<total: labels.append(f"旅客{len(labels)+1}")
    out=[]
    for i in range(total):
        dob=saved[i] if i < len(saved) else ""
        age=_age_on(dob,p.get("start_date"))
        out.append({"label":labels[i],"dob":dob,"age":age})
    return out

def _precheck(product, p):
    travelers=_travelers(p)
    blocked=[]; pending=[]
    for t in travelers:
        age=t["age"]
        if age is None:
            pending.append(f'{t["label"]}尚缺生日')
            continue
        if product["id"]=="FUBON-A" and not (15 <= age < 80):
            blocked.append(f'{t["label"]}（{age}歲）不符合公開年齡15～未滿80歲')
        elif product["id"]=="FUBON-D" and not (18 <= age < 70):
            blocked.append(f'{t["label"]}（{age}歲）不符合公開年齡18～未滿70歲')
    if product["id"] in {"TAIAN-A","TAIAN-C"} and not blocked:
        pending.append("正式保額／費率仍須依各旅客年齡層套官方規則")
    if product["id"] not in {"FUBON-A","FUBON-D","TAIAN-A","TAIAN-C"} and not blocked:
        pending.append("公開資料尚不足以完成正式年齡資格判定，需官方完整規則")
    status="BLOCKED" if blocked else ("NEED_OFFICIAL_RULE" if pending else "ELIGIBLE")
    return status, blocked, pending, travelers

@app.post("/api/traveler-dobs")
def traveler_dobs():
    d=request.get_json(silent=True) or {}
    dobs=d.get("dobs") or []
    p=session.get("profile") or empty_profile()
    # V1.9.3.1.1: the browser may have changed adults/children/seniors
    # immediately before this request, while session.profile still has the old total.
    # DOB count is therefore validated against the current submitted traveler labels,
    # not a stale session total. Profile sync follows before Product Engine.
    expected = int(p.get("adults") or 0) + int(p.get("children") or 0) + int(p.get("seniors") or 0)
    if expected and len(dobs) != expected:
        # Accept the current DOB list as source-of-truth for this transition instead
        # of blocking the customer with an internal synchronization error.
        p["people"] = len(dobs)
        session["profile"] = p
    if any(not x for x in dobs):
        return jsonify(ok=False,error="請先補齊每位旅客生日"),400
    session["traveler_dobs"]=dobs
    return jsonify(ok=True,travelers=_travelers(p))

@app.post("/api/product-match")
def product_match():
    p=session.get("profile") or empty_profile()
    d=request.get_json(silent=True) or {}
    desired=d.get("desired") or {}
    tier=d.get("tier") or session.get("plan_tier") or "balanced"
    concerns=set(p.get("concerns") or [])
    budget=p.get("budget_range") or ""
    # Scenario controls the shortlist, but not formal saleability or price.
    if "300元以下" in budget: tier="economy"
    elif "500元以上" in budget: tier="enhanced"
    candidates=[x for x in DEMO_PRODUCTS if x["direction"]==tier]
    results=[]
    for x in candidates:
        st,blocked,pending,travelers=_precheck(x,p)
        overlap=sum(1 for f in x["features"] if any(k in f for k in ["班機延誤","行李","海外","醫療","救援"]) and
                    any(c in " ".join(x["features"]) for c in concerns))
        if st=="BLOCKED":
            continue
        requested=set(p.get("concerns") or [])
        feature_text="、".join(x["features"])
        extra=[]
        # Customer-facing "海外醫療／海外生病醫療" already represents
        # 傷害醫療 + 生病醫療（含海外突發疾病概念）.
        # Do not mislabel 海外突發疾病 as an extra coverage.
        medical_need = any(v in requested for v in ["海外醫療","海外生病/醫療","海外生病醫療"])
        for label in ["旅程取消","行李損失","個人責任","班機延誤","行李延誤","緊急救援"]:
            if label in feature_text and label not in requested:
                extra.append(label)
        if "海外突發疾病" in feature_text and not medical_need:
            extra.append("海外突發疾病")
        results.append({**x,"precheck":st,"blocked":blocked,"pending":pending,
                        "desired":desired,"extra_coverages":extra,
                        "travelers":travelers,
                        "match_note":"15宮格是需求；本卡顯示商品與需求的差異。",
                        "rate_status":"WAIT_OFFICIAL_RATE"})
    session["product_candidates"]=results
    return jsonify(ok=True,products=results,profile=p,tier=tier)

@app.post("/api/product-select")
def product_select():
    d=request.get_json(silent=True) or {}
    pid=d.get("product_id")
    desired=d.get("desired") or {}
    p=session.get("profile") or empty_profile()
    product=next((x for x in DEMO_PRODUCTS if x["id"]==pid),None)
    if not product:return jsonify(ok=False,error="找不到商品"),404
    st,blocked,pending,travelers=_precheck(product,p)
    if blocked:
        return jsonify(ok=False,error="此商品目前不適用全部旅客，請重新選擇商品"),400

    # V1.9.4.1 Demo Quote:
    # Reuse the stable V1.8.3.3 demo rate engine only to test the purchase flow.
    # This is NOT an insurer/product official premium and is never called a formal quote.
    demo=quote(
        p,
        session.get("plan_tier") or "balanced",
        desired.get("accident"),desired.get("medical"),desired.get("rescue"),
        scenario=scenario_for(p)
    )
    per_person=demo["per_person"]
    person_rows=[]
    for t in travelers:
        person_rows.append({
            "group":t["label"],"dob":t["dob"],"age":t["age"],
            "status":"可進入 Demo 投保流程",
            "demo_premium":per_person
        })
    q={
      "quote_id":"DEMO-"+pid,
      "product":product,
      "people":len(person_rows),
      "desired":desired,
      "eligibility_status":st,
      "person_rows":person_rows,
      "demo_per_person":per_person,
      "demo_total":per_person*len(person_rows),
      "quote_status":"DEMO_QUOTE_READY",
      "can_apply_demo":True,
      "official_ready":False,
      "rate_notice":"Demo 試算保費｜非正式報價。僅用於測試商品選定 → Quote → 投保流程；正式版必須改接官方 Rate Engine／費率表。"
    }
    session["selected_product"]=pid
    session["quote_snapshot"]=q
    return jsonify(ok=True,quote=q)



ID_VISION_PROMPT = """你是保險投保證件文件理解 Agent。請直接閱讀使用者提供的證件影像。
安全規則：
1. 只能抄錄影像中清楚可見的資料，不可猜測、補字、推算或從檔名推斷。
2. 本 Prototype 只擷取：姓名、身分證字號/證件號碼、出生日期。
3. 若欄位不存在、遮罩、模糊或不確定，value 必須是 null。
4. 出生日期盡量標準化為 YYYY-MM-DD；若無法確定完整年月日，value=null，raw_text 保留看見的原文。
5. 每欄回傳 confidence 0~1。只有非常清楚時才給 >=0.90。
6. 不要回傳地址、照片、生物特徵或其他不需要的敏感資料。
7. 只回傳 JSON，不要 Markdown：
{
  "document_type":"identity_document|passport|unknown",
  "name":{"value":null,"raw_text":null,"confidence":0.0},
  "id_no":{"value":null,"raw_text":null,"confidence":0.0},
  "dob":{"value":null,"raw_text":null,"confidence":0.0},
  "notes":[]
}
"""

def _json_from_model(text):
    s=(text or "").strip()
    s=re.sub(r"^```(?:json)?\s*|\s*```$","",s)
    return json.loads(s)

def _trust_field(field, threshold=0.90):
    field=field if isinstance(field,dict) else {}
    value=field.get("value")
    try: conf=float(field.get("confidence") or 0)
    except: conf=0.0
    # Trust Gate is deterministic: AI proposes evidence; code decides acceptance.
    if value and conf >= threshold:
        status="accepted"
    elif value:
        status="needs_confirmation"
    else:
        status="needs_confirmation"
    return {
      "value":value or None,
      "raw_text":field.get("raw_text") or value or None,
      "confidence":round(conf,2),
      "status":status
    }

@app.post("/api/id-document-upload")
def id_document_upload():
    f=request.files.get("file")
    if not f or not f.filename:
        return jsonify(ok=False,error="請先選擇證件圖片。"),400
    ext=(f.filename.rsplit(".",1)[-1].lower() if "." in f.filename else "")
    if ext not in {"png","jpg","jpeg","webp"}:
        return jsonify(ok=False,error="目前先支援 PNG、JPG、JPEG、WEBP 證件圖片。"),400
    raw=f.read()
    if not raw:
        return jsonify(ok=False,error="證件圖片是空的。"),400
    if not os.getenv("OPENAI_API_KEY"):
        return jsonify(ok=False,error="尚未設定 OPENAI_API_KEY。請先在 Terminal 設定後重新啟動程式。"),400
    try:
        mime=mimetypes.guess_type(f.filename)[0] or "image/jpeg"
        data=base64.b64encode(raw).decode("ascii")
        client=OpenAI()
        resp=client.responses.create(
          model=os.getenv("OPENAI_VISION_MODEL","gpt-5.6-luna"),
          input=[{"role":"user","content":[
            {"type":"input_text","text":ID_VISION_PROMPT},
            {"type":"input_image","image_url":"data:"+mime+";base64,"+data}
          ]}]
        )
        result=_json_from_model(resp.output_text)
    except Exception as e:
        return jsonify(ok=False,error="AI Vision 證件辨識失敗："+str(e)),500

    evidence={
      "document_type":result.get("document_type") or "unknown",
      "name":_trust_field(result.get("name")),
      "id_no":_trust_field(result.get("id_no")),
      "dob":_trust_field(result.get("dob")),
      "notes":result.get("notes") if isinstance(result.get("notes"),list) else []
    }
    accepted=sum(1 for k in ("name","id_no","dob") if evidence[k]["status"]=="accepted")
    evidence["trust_gate_status"]="accepted" if accepted==3 else "needs_confirmation"
    evidence["accepted_count"]=accepted
    evidence["note"]="AI 已完成證件辨識；只有高信心欄位會自動帶入，其餘資料請您確認。"
    return jsonify(ok=True,evidence=evidence,filename=f.filename)

@app.post("/api/roster-upload")
def roster_upload():
    f=request.files.get("file")
    if not f or not f.filename:
        return jsonify(ok=False,error="請先選擇 Excel 旅客名單。"),400
    if not f.filename.lower().endswith(".xlsx"):
        return jsonify(ok=False,error="目前 Prototype 先支援 .xlsx 檔案。"),400
    try:
        wb=load_workbook(BytesIO(f.read()),read_only=True,data_only=True)
        ws=wb[wb.sheetnames[0]]
        rows=list(ws.iter_rows(values_only=True))
    except Exception:
        return jsonify(ok=False,error="Excel 檔案無法讀取，請確認格式是否正確。"),400
    if not rows:
        return jsonify(ok=False,error="旅客名單是空的。"),400

    def norm(v):
        return str(v).strip() if v is not None else ""
    aliases={
      "name":["姓名","旅客姓名","被保險人姓名","name"],
      "id_no":["身分證字號","身分證","證號","id","id_no"],
      "dob":["生日","出生日期","birth_date","dob"],
      "relation":["與要保人關係","關係","relation"],
      "phone":["手機","手機號碼","電話","phone"],
      "email":["email","e-mail","電子郵件"]
    }
    headers=[norm(x).lower() for x in rows[0]]
    col={}
    for key,names in aliases.items():
        for i,h in enumerate(headers):
            if h in [n.lower() for n in names]:
                col[key]=i;break
    if "name" not in col or "dob" not in col:
        return jsonify(ok=False,error="Excel 至少需要「姓名」與「生日」欄位。"),400

    def val(row,key):
        i=col.get(key)
        if i is None or i>=len(row): return ""
        v=row[i]
        if isinstance(v,(datetime,date)): return v.strftime("%Y-%m-%d")
        return norm(v)
    people=[]
    for n,row in enumerate(rows[1:],start=2):
        if not any(x not in (None,"") for x in row): continue
        item={k:val(row,k) for k in aliases}
        item["row"]=n
        item["missing"]=[label for key,label in [("name","姓名"),("id_no","身分證字號"),("dob","生日")] if not item.get(key)]
        people.append(item)
    if not people:
        return jsonify(ok=False,error="沒有讀到任何旅客資料。"),400

    profile=session.get("profile") or empty_profile()
    expected=max(int(profile.get("people") or 0),
                 int(profile.get("adults") or 0)+int(profile.get("children") or 0)+int(profile.get("seniors") or 0))
    saved_dobs=session.get("traveler_dobs") or []
    warnings=[]
    if expected and len(people)!=expected:
        warnings.append(f"名單有 {len(people)} 人，但目前行程設定為 {expected} 人，請確認。")
    dob_diff=[]
    for i,p in enumerate(people):
        if i<len(saved_dobs) and saved_dobs[i] and p["dob"] and saved_dobs[i]!=p["dob"]:
            dob_diff.append(i+1)
    if dob_diff:
        warnings.append("第 "+ "、".join(map(str,dob_diff)) +" 位旅客生日與前一步資料不同，請確認後再套用。")
    return jsonify(ok=True,people=people,count=len(people),expected=expected,warnings=warnings)

@app.post("/api/reset")
def reset():session.clear();return jsonify(ok=True)

@app.post("/api/document-agent")
def document_agent():
    f=request.files.get("file")
    if not f:return jsonify({"ok":False,"message":"未收到檔案"}),400
    try:
        d=recognize_document(f.filename or "document.pdf",f.read())

        # V1.7.11 Trust Gate: AI extraction is evidence, not automatically trusted profile data.
        uncertain=" ".join(str(x).lower() for x in (d.get("uncertain_fields") or []))
        segs=d.get("segments") or []
        year_uncertain=("year" in uncertain) or ("年份" in uncertain)
        if year_uncertain:
            if isinstance(d.get("start"),dict): d["start"]["value"]=None; d["start"]["status"]="needs_confirmation"
            else: d["start"]=None
            if isinstance(d.get("end"),dict): d["end"]["value"]=None; d["end"]["status"]="needs_confirmation"
            else: d["end"]=None
        # A single flight segment never creates a return/end date.
        if len(segs)==1:
            if isinstance(d.get("end"),dict): d["end"]["value"]=None; d["end"]["status"]="unavailable"
            else: d["end"]=None

        def val(x):
            return x.get("value") if isinstance(x,dict) else x
        d["destination_status"]=(d.get("destination") or {}).get("status") if isinstance(d.get("destination"),dict) else "confirmed"
        d["airline_status"]=(d.get("airline") or {}).get("status") if isinstance(d.get("airline"),dict) else "confirmed"
        d["start_status"]=(d.get("start") or {}).get("status") if isinstance(d.get("start"),dict) else "confirmed"
        d["end_status"]=(d.get("end") or {}).get("status") if isinstance(d.get("end"),dict) else "confirmed"
        d["destination"]=val(d.get("destination"))
        d["airline"]=val(d.get("airline"))
        d["start"]=val(d.get("start"))
        d["end"]=val(d.get("end"))
        seg=d.get("segments") or []
        d["origin"]=seg[0].get("from") if seg else None
        d["arrival"]=seg[-1].get("to") if seg else None
        d["outbound_flight"]=seg[0].get("flight") if seg else None
        d["return_flight"]=seg[-1].get("flight") if len(seg)>1 else None
        d["adults"]=sum(x.get("category")=="大人" for x in d.get("passengers",[]))
        d["children"]=sum(x.get("category")=="小孩" for x in d.get("passengers",[]))
        d["seniors"]=sum(x.get("category")=="長輩" for x in d.get("passengers",[]))
        return jsonify({"ok":True,"mode":"real_ai_vision","data":d,
          "message":"原始文件已直接交給 AI Vision，未先做 OCR，也沒有預設答案。"})
    except Exception as e:return jsonify({"ok":False,"message":"AI 文件辨識失敗："+str(e)}),500


FLIGHT_VISION_PROMPT="""閱讀機票、登機證或航班行程圖片。只抄錄清楚可見資料，不猜測或補值；缺漏用 null。航班資料只供 Flight Profile/Travel Mode，絕不可改寫保險期間。只回傳 JSON：
{"document_type":"ticket|boarding_pass|itinerary|unknown","passengers":[{"name":null,"confidence":0.0}],"segments":[{"airline":null,"flight_no":null,"departure_airport":null,"arrival_airport":null,"departure_date":null,"departure_time":null,"arrival_date":null,"arrival_time":null,"confidence":0.0}],"notes":[]}"""

@app.post("/api/travel-ticket-vision")
def travel_ticket_vision():
    f=request.files.get("file")
    if not f or not f.filename:return jsonify(ok=False,error="請先選擇機票圖片。"),400
    ext=f.filename.rsplit(".",1)[-1].lower() if "." in f.filename else ""
    if ext not in {"png","jpg","jpeg","webp"}:return jsonify(ok=False,error="V1.9.7 先支援 PNG、JPG、JPEG、WEBP。"),400
    raw=f.read()
    if not os.getenv("OPENAI_API_KEY"):return jsonify(ok=False,error="尚未設定 OPENAI_API_KEY。"),400
    try:
        mime=mimetypes.guess_type(f.filename)[0] or "image/jpeg"; data=base64.b64encode(raw).decode("ascii")
        resp=OpenAI().responses.create(model=os.getenv("OPENAI_VISION_MODEL","gpt-5.6-luna"),input=[{"role":"user","content":[{"type":"input_text","text":FLIGHT_VISION_PROMPT},{"type":"input_image","image_url":"data:"+mime+";base64,"+data}]}])
        x=_json_from_model(resp.output_text)
    except Exception as e:return jsonify(ok=False,error="AI Vision 航班辨識失敗："+str(e)),500
    seg=[]
    for s in x.get("segments") or []:
        try:c=round(float(s.get("confidence") or 0),2)
        except:c=0
        seg.append({**{k:s.get(k) for k in ["airline","flight_no","departure_airport","arrival_airport","departure_date","departure_time","arrival_date","arrival_time"]},"confidence":c,"status":"accepted" if c>=.9 else "needs_confirmation"})
    return jsonify(ok=True,flight_profile={"document_type":x.get("document_type") or "unknown","passengers":x.get("passengers") or [],"segments":seg,"notes":x.get("notes") or [],"insurance_period_unchanged":True})


MEDICAL_VISION_PROMPT="""閱讀診斷書或醫療費用收據圖片。只抄錄清楚資料，不猜測，不判斷理賠或醫療必要性。缺漏用 null。只回 JSON：{"document_type":"diagnosis|medical_receipt|unknown","provider":null,"patient_name":null,"visit_date":null,"diagnosis_text":null,"currency":null,"total_amount":null,"confidence":0.0,"notes":[]}"""
@app.post("/api/medical-document-vision")
def medical_document_vision():
    f=request.files.get("file")
    if not f or not f.filename:return jsonify(ok=False,error="請先選擇醫療文件圖片。"),400
    ext=f.filename.rsplit(".",1)[-1].lower() if "." in f.filename else ""
    if ext not in {"png","jpg","jpeg","webp"}:return jsonify(ok=False,error="V1.9.9 先支援 PNG、JPG、JPEG、WEBP。"),400
    if not os.getenv("OPENAI_API_KEY"):return jsonify(ok=False,error="尚未設定 OPENAI_API_KEY。"),400
    try:
        raw=f.read();mime=mimetypes.guess_type(f.filename)[0] or "image/jpeg";data=base64.b64encode(raw).decode("ascii")
        resp=OpenAI().responses.create(model=os.getenv("OPENAI_VISION_MODEL","gpt-5.6-luna"),input=[{"role":"user","content":[{"type":"input_text","text":MEDICAL_VISION_PROMPT},{"type":"input_image","image_url":"data:"+mime+";base64,"+data}]}]);x=_json_from_model(resp.output_text);c=round(float(x.get("confidence") or 0),2)
        return jsonify(ok=True,evidence={**{k:x.get(k) for k in ["document_type","provider","patient_name","visit_date","diagnosis_text","currency","total_amount"]},"confidence":c,"status":"accepted" if c>=.9 else "needs_confirmation"})
    except Exception as e:return jsonify(ok=False,error="AI Vision 醫療文件辨識失敗："+str(e)),500

# ===== V2.0.0R Database-first foundation =====
V2R_DB=os.path.join(os.path.dirname(__file__),"data","v2r_insurance.db")
def v2r_db():
 os.makedirs(os.path.dirname(V2R_DB),exist_ok=True); c=sqlite3.connect(V2R_DB);c.row_factory=sqlite3.Row;c.execute("PRAGMA foreign_keys=ON")
 c.executescript("""
 CREATE TABLE IF NOT EXISTS customer(customer_id TEXT PRIMARY KEY,display_name TEXT,created_at TEXT);
 CREATE TABLE IF NOT EXISTS application_journey(journey_id TEXT PRIMARY KEY,customer_id TEXT,status TEXT,checkpoint TEXT,payment_status TEXT DEFAULT 'UNPAID',created_at TEXT,updated_at TEXT);
 CREATE TABLE IF NOT EXISTS travel_profile(journey_id TEXT PRIMARY KEY,payload TEXT,updated_at TEXT);
 CREATE TABLE IF NOT EXISTS person_profile(person_id TEXT PRIMARY KEY,journey_id TEXT,seq INTEGER,name TEXT,id_no TEXT,dob TEXT,relation TEXT,mobile TEXT,email TEXT,payload TEXT,updated_at TEXT);
 CREATE TABLE IF NOT EXISTS coverage_need(journey_id TEXT PRIMARY KEY,payload TEXT,updated_at TEXT);
 CREATE TABLE IF NOT EXISTS quote(quote_id TEXT PRIMARY KEY,journey_id TEXT,status TEXT,product_code TEXT,product_name TEXT,insurer_name TEXT,total_premium REAL,payload TEXT,updated_at TEXT);
 CREATE TABLE IF NOT EXISTS underwriting(journey_id TEXT PRIMARY KEY,status TEXT,payload TEXT,updated_at TEXT);
 CREATE TABLE IF NOT EXISTS payment(payment_id TEXT PRIMARY KEY,journey_id TEXT,status TEXT,amount REAL,paid_at TEXT,payload TEXT,updated_at TEXT);
 CREATE TABLE IF NOT EXISTS policy(policy_id TEXT PRIMARY KEY,journey_id TEXT UNIQUE,policy_no TEXT,status TEXT,payload TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE IF NOT EXISTS journey_snapshot(journey_id TEXT PRIMARY KEY,payload TEXT,updated_at TEXT);
 """)
 now=datetime.now().isoformat(timespec="seconds");c.execute("INSERT OR IGNORE INTO customer VALUES(?,?,?)",("DEMO-CUSTOMER","Demo Customer",now));c.commit();return c

@app.get("/api/v2r/health")
def v2r_health():
 c=v2r_db();t=[r[0] for r in c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")];c.close()
 return jsonify(ok=True,version="V2.0.0R",tables=t)

@app.post("/api/v2r/journey")
def v2r_create():
 now=datetime.now().isoformat(timespec="seconds");jid="J-"+uuid.uuid4().hex[:10].upper();c=v2r_db()
 c.execute("INSERT INTO application_journey VALUES(?,?,?,?,?,?,?)",(jid,"DEMO-CUSTOMER","ACTIVE","DRAFT","UNPAID",now,now));c.execute("INSERT INTO journey_snapshot VALUES(?,?,?)",(jid,"{}",now));c.commit();c.close()
 return jsonify(ok=True,journey_id=jid)

@app.post("/api/v2r/journey/<jid>/save")
def v2r_save(jid):
 d=request.get_json(silent=True) or {};now=datetime.now().isoformat(timespec="seconds");c=v2r_db();j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
 if not j:c.close();return jsonify(ok=False,error="找不到案件"),404
 if j["payment_status"]=="PAID":c.close();return jsonify(ok=False,error="已繳款案件不可直接修改，請聯絡客服"),409
 cp=d.get("checkpoint",j["checkpoint"]);c.execute("UPDATE application_journey SET checkpoint=?,updated_at=? WHERE journey_id=?",(cp,now,jid))
 snap=d.get("snapshot",{});c.execute("INSERT OR REPLACE INTO journey_snapshot VALUES(?,?,?)",(jid,json.dumps(snap,ensure_ascii=False),now))
 for table,key in [("travel_profile","travel_profile"),("coverage_need","coverage_need")]:
  if key in d:c.execute(f"INSERT OR REPLACE INTO {table} VALUES(?,?,?)",(jid,json.dumps(d[key],ensure_ascii=False),now))
 if "persons" in d:
  c.execute("DELETE FROM person_profile WHERE journey_id=?",(jid,))
  for i,p in enumerate(d["persons"] or [],1):c.execute("INSERT INTO person_profile VALUES(?,?,?,?,?,?,?,?,?,?,?)",(f"{jid}-P{i}",jid,i,p.get("name"),p.get("id_no"),p.get("dob"),p.get("relation"),p.get("mobile"),p.get("email"),json.dumps(p,ensure_ascii=False),now))
 if "quote" in d:
  q=d["quote"] or {};c.execute("DELETE FROM quote WHERE journey_id=?",(jid,));c.execute("INSERT INTO quote VALUES(?,?,?,?,?,?,?,?,?)",(f"Q-{jid}",jid,q.get("status","ACTIVE"),q.get("product_code"),q.get("product_name"),q.get("insurer_name"),q.get("total_premium"),json.dumps(q,ensure_ascii=False),now))
 if "underwriting" in d:
  u=d["underwriting"] or {};c.execute("INSERT OR REPLACE INTO underwriting VALUES(?,?,?,?)",(jid,u.get("status","PENDING"),json.dumps(u,ensure_ascii=False),now))
 c.commit();c.close();return jsonify(ok=True,journey_id=jid,checkpoint=cp)

@app.get("/api/v2r/journey/<jid>")
def v2r_get(jid):
 c=v2r_db();j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
 if not j:c.close();return jsonify(ok=False,error="找不到案件"),404
 def one(t):
  r=c.execute(f"SELECT * FROM {t} WHERE journey_id=?",(jid,)).fetchone()
  if not r:return None
  x=dict(r)
  if "payload" in x:
   try:x["payload"]=json.loads(x["payload"])
   except:pass
  return x
 people=[dict(r) for r in c.execute("SELECT * FROM person_profile WHERE journey_id=? ORDER BY seq",(jid,))]
 out={"journey":dict(j),"travel_profile":one("travel_profile"),"persons":people,"coverage_need":one("coverage_need"),"quote":one("quote"),"underwriting":one("underwriting"),"payment":one("payment"),"policy":one("policy"),"snapshot":one("journey_snapshot")}
 c.close();return jsonify(ok=True,data=out)

@app.get("/api/v2r/customer/current")
def v2r_customer():
 c=v2r_db();rows=[dict(r) for r in c.execute("SELECT * FROM application_journey WHERE customer_id='DEMO-CUSTOMER' ORDER BY updated_at DESC")];c.close()
 return jsonify(ok=True,customer_id="DEMO-CUSTOMER",journeys=rows)


# ===== V2.0.1R: identity entry decision =====
def v2r_json_payload(row):
    if not row: return None
    x=dict(row)
    if "payload" in x:
        try: x["payload"]=json.loads(x["payload"] or "{}")
        except Exception: pass
    return x

def v2r_days(profile):
    """Insurance days = ceil(exact elapsed time / 24h)."""
    try:
        import math
        sd,ed=profile.get("start_date"),profile.get("end_date")
        st,et=str(profile.get("start_time") or "").strip(),str(profile.get("end_time") or "").strip()
        if sd and ed and st and et:
            if len(st)==2: st += ":00"
            if len(et)==2: et += ":00"
            x=datetime.fromisoformat(f"{sd}T{st}"); y=datetime.fromisoformat(f"{ed}T{et}")
            if y>x: return max(1,math.ceil((y-x).total_seconds()/86400))
        if sd and ed:
            x=datetime.strptime(sd,"%Y-%m-%d").date(); y=datetime.strptime(ed,"%Y-%m-%d").date()
            return max(1,(y-x).days+1)
    except Exception: pass
    return profile.get("travel_days")

def v2r_checkpoint_label(cp):
    cp=(cp or "DRAFT").upper()
    return {
        "DRAFT":"商品未選定",
        "PRODUCT_NOT_SELECTED":"商品未選定",
        "PRODUCT_SELECTED":"商品已選定",
        "PERSON_CONFIRMED":"投保資料已確認",
        "UNDERWRITING_CONFIRMED":"核保已確認",
        "PAYMENT_COMPLETED":"付款已完成",
        "POLICY_CREATED":"保單已成立",
        "CLOSED":"已結案",
    }.get(cp, cp)

@app.get("/api/v2r/entry")
def v2r_entry():
    c=v2r_db(); cid="DEMO-CUSTOMER"
    unpaid=c.execute("""SELECT * FROM application_journey WHERE customer_id=? AND payment_status!='PAID' AND status='ACTIVE' ORDER BY updated_at DESC LIMIT 1""",(cid,)).fetchone()
    paid=c.execute("""SELECT * FROM application_journey WHERE customer_id=? AND payment_status='PAID' ORDER BY updated_at DESC""",(cid,)).fetchall()
    def summary(j):
        jid=j["journey_id"]
        tp=v2r_json_payload(c.execute("SELECT * FROM travel_profile WHERE journey_id=?",(jid,)).fetchone())
        q=v2r_json_payload(c.execute("SELECT * FROM quote WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone())
        pol=v2r_json_payload(c.execute("SELECT * FROM policy WHERE journey_id=?",(jid,)).fetchone())
        profile=(tp or {}).get("payload") or {}; quote=(q or {}).get("payload") or {}
        return {"journey_id":jid,"status":j["status"],"checkpoint":j["checkpoint"],"payment_status":j["payment_status"],
          "travel_profile":profile,"calendar_days":v2r_days(profile),"quote":quote,"policy":pol}
    out={"customer_id":cid,"mode":"UNPAID" if unpaid else ("PAID_ONLY" if paid else "EMPTY"),
         "unpaid":summary(unpaid) if unpaid else None,"paid":[summary(x) for x in paid]}
    c.close();return jsonify(ok=True,data=out)

@app.post("/api/v2r/journey/new")
def v2r_new_journey():
    now=datetime.now().isoformat(timespec="seconds");jid="J-"+uuid.uuid4().hex[:10].upper();c=v2r_db()
    c.execute("INSERT INTO application_journey VALUES(?,?,?,?,?,?,?)",(jid,"DEMO-CUSTOMER","ACTIVE","DRAFT","UNPAID",now,now))
    c.execute("INSERT INTO journey_snapshot VALUES(?,?,?)",(jid,"{}",now));c.commit();c.close()
    return jsonify(ok=True,journey_id=jid,mode="NEW")

@app.get("/api/v2r/journey/<jid>/application-data")
def v2r_application_data(jid):
    """Canonical application form data: DB columns + payload, one normalized person per seq."""
    c=v2r_db()
    j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
    if not j:
        c.close(); return jsonify(ok=False,error="找不到案件"),404
    people=[]
    for row in c.execute("SELECT * FROM person_profile WHERE journey_id=? ORDER BY seq",(jid,)):
        x=dict(row)
        try: p=json.loads(x.get("payload") or "{}")
        except: p={}
        # DB columns are canonical for insured identity; payload carries applicant-only extras.
        person={
          "seq":x.get("seq"), "name":x.get("name") or p.get("name") or "",
          "id_no":x.get("id_no") or p.get("id_no") or "",
          "dob":x.get("dob") or p.get("dob") or "",
          "relation":x.get("relation") or p.get("relation") or "",
          "mobile":x.get("mobile") or p.get("mobile") or "",
          "email":x.get("email") or p.get("email") or "",
          "applicant_name":p.get("applicant_name") or "",
          "applicant_id_no":p.get("applicant_id_no") or "",
          "applicant_dob":p.get("applicant_dob") or "",
          "applicant_phone":p.get("applicant_phone") or "",
          "applicant_email":p.get("applicant_email") or "",
          "applicant_address":p.get("applicant_address") or p.get("address") or ""
        }
        people.append(person)
    c.close()
    return jsonify(ok=True,journey_id=jid,checkpoint=j["checkpoint"],persons=people)


@app.get("/api/v2r/journey/<jid>/underwriting-context")
def v2r_underwriting_context(jid):
    """Checkpoint-3+ downstream context. Quote is always rebuilt from DB."""
    c=v2r_db()
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        q=c.execute("SELECT * FROM quote WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
        if not j: return jsonify(ok=False,error="找不到案件"),404
        if not q: return jsonify(ok=False,error="找不到已選商品，請重新選擇商品"),409
        try: qp=json.loads(q["payload"] or "{}")
        except: qp={}
        people=[]
        for r in c.execute("SELECT * FROM person_profile WHERE journey_id=? ORDER BY seq",(jid,)):
            people.append({"seq":r["seq"],"name":r["name"],"id_no":r["id_no"],"dob":r["dob"],"relation":r["relation"]})
        return jsonify(ok=True,checkpoint=j["checkpoint"],quote={
          "quote_id":qp.get("quote_id") or q["quote_id"],
          "product_code":q["product_code"],"product_name":q["product_name"],
          "insurer_name":q["insurer_name"],"total_premium":q["total_premium"]
        },persons=people)
    finally:
        c.close()

@app.post("/api/v2r/journey/<jid>/underwriting/check")
def v2r_underwriting_check(jid):
    """Underwriting may run only against the currently committed DB quote."""
    d=request.get_json(silent=True) or {}
    shown=str(d.get("product_code") or "")
    c=v2r_db()
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        q=c.execute("SELECT * FROM quote WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
        if not j or not q: return jsonify(ok=False,error="案件或商品資料不存在"),409
        if j["checkpoint"] not in ("PERSON_CONFIRMED","UNDERWRITING_CONFIRMED"):
            return jsonify(ok=False,error="投保資料尚未完成確認，不能進行核保"),409
        if shown and shown != str(q["product_code"] or ""):
            return jsonify(ok=False,error="商品資料已變更，核保畫面與目前商品不一致，請重新進入確認流程"),409
        now=datetime.now().isoformat(timespec="seconds")
        payload={"status":"DEMO_PASSED","product_code":q["product_code"],"quote_id":q["quote_id"]}
        c.execute("INSERT OR REPLACE INTO underwriting VALUES(?,?,?,?)",
                  (jid,"DEMO_PASSED",json.dumps(payload,ensure_ascii=False),now))
        c.execute("UPDATE application_journey SET checkpoint='UNDERWRITING_CONFIRMED',updated_at=? WHERE journey_id=?",(now,jid))
        c.commit()
        return jsonify(ok=True,checkpoint="UNDERWRITING_CONFIRMED",product_code=q["product_code"])
    finally:
        c.close()


@app.post("/api/v2r/journey/<jid>/edit-start")
def v2r_edit_start(jid):
    c=v2r_db()
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        q=c.execute("SELECT * FROM quote WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
        if not j: return jsonify(ok=False,error="找不到案件"),404
        now=datetime.now().isoformat(timespec="seconds")
        cp="PRODUCT_SELECTED" if q else "DRAFT"
        c.execute("UPDATE application_journey SET checkpoint=?,updated_at=? WHERE journey_id=?",(cp,now,jid))
        c.execute("DELETE FROM underwriting WHERE journey_id=?",(jid,))
        c.execute("DELETE FROM payment WHERE journey_id=?",(jid,))
        c.commit()
        return jsonify(ok=True,checkpoint=cp)
    finally: c.close()


@app.post("/api/v2r/journey/<jid>/confirm-transaction")
def v2r_confirm_transaction(jid):
    """Atomic checkpoint-3 commit: current Quote + Person Profile must agree before PERSON_CONFIRMED."""
    d=request.get_json(silent=True) or {}
    people=d.get("persons") or []
    shown_product=str(d.get("product_code") or "")
    c=v2r_db()
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        q=c.execute("SELECT * FROM quote WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
        if not j: return jsonify(ok=False,code="JOURNEY_NOT_FOUND",error="找不到投保案件。"),404
        if not q: return jsonify(ok=False,code="QUOTE_NOT_FOUND",error="尚未選定投保商品，請返回保障規劃重新選擇商品。"),409
        if shown_product and shown_product != str(q["product_code"] or ""):
            return jsonify(ok=False,error="目前商品與資料庫 Quote 不一致，請重新選擇商品後再確認"),409
        if not people: return jsonify(ok=False,code="PERSON_MISSING",error="尚未取得被保險人資料。"),409
        for i,p in enumerate(people,1):
            missing=[]
            if not str(p.get("name") or "").strip(): missing.append("姓名")
            if not str(p.get("id_no") or "").strip(): missing.append("身分證字號")
            if not str(p.get("dob") or "").strip(): missing.append("出生日期")
            if missing:
                return jsonify(ok=False,code="PERSON_INCOMPLETE",error=f"被保險人{i}尚缺："+"、".join(missing)),409
        now=datetime.now().isoformat(timespec="seconds")
        # Person Profile is part of the same transaction.
        c.execute("DELETE FROM person_profile WHERE journey_id=?",(jid,))
        for i,p in enumerate(people,1):
            payload=dict(p)
            c.execute("""INSERT INTO person_profile
              (journey_id,seq,name,id_no,dob,relation,mobile,email,payload,updated_at)
              VALUES(?,?,?,?,?,?,?,?,?,?)""",
              (jid,i,p.get("name",""),p.get("id_no",""),p.get("dob",""),p.get("relation",""),
               p.get("mobile",""),p.get("email",""),json.dumps(payload,ensure_ascii=False),now))
        c.execute("DELETE FROM underwriting WHERE journey_id=?",(jid,))
        c.execute("DELETE FROM payment WHERE journey_id=?",(jid,))
        c.execute("UPDATE application_journey SET checkpoint='PERSON_CONFIRMED',updated_at=? WHERE journey_id=?",(now,jid))
        c.commit()
        return jsonify(ok=True,checkpoint="PERSON_CONFIRMED",quote={
          "quote_id":q["quote_id"],"product_code":q["product_code"],"product_name":q["product_name"],
          "insurer_name":q["insurer_name"],"total_premium":q["total_premium"]
        })
    except Exception:
        c.rollback(); raise
    finally: c.close()


def v21_payload(row):
    if not row: return {}
    try:
        raw=row["payload"]
        return json.loads(raw) if raw else {}
    except Exception:
        return {}

def v218_status_label(checkpoint, payment_status, policy_no):
    if checkpoint == "CLOSED": return "已結案"
    if policy_no: return "已出單"
    if checkpoint == "PAYMENT_COMPLETED" or payment_status == "PAID": return "已繳費"
    if checkpoint in ("UNDERWRITING_CONFIRMED","PERSON_CONFIRMED"): return "已要保"
    if checkpoint == "PRODUCT_SELECTED": return "已選定商品"
    return "尚未規劃"

def v2110_insurance_days(tp):
    """Formal prototype rule: ceil(elapsed seconds / 24h)."""
    try:
        sd,ed=tp.get("start_date"),tp.get("end_date")
        st,et=tp.get("start_time"),tp.get("end_time")
        if not all([sd,ed,st,et]): return None
        a=datetime.fromisoformat(f"{sd}T{st}")
        b=datetime.fromisoformat(f"{ed}T{et}")
        seconds=(b-a).total_seconds()
        if seconds <= 0: return None
        return max(1, math.ceil(seconds/86400))
    except Exception:
        return None

def v2110_coverage_rows(cp):
    """Normalize the V2.1.7 coverage_need payload for history/detail display."""
    rows=[]
    def add(name,value):
        if value not in (None,"",[],{}):
            rows.append({"name":name,"value":str(value)})
    add("意外傷害", cp.get("accident") or cp.get("accident_amount"))
    add("海外醫療", cp.get("medical") or cp.get("medical_amount"))
    add("緊急救援", cp.get("rescue") or cp.get("rescue_amount"))
    seen={r["name"] for r in rows}
    for key in ("core","extras","concerns"):
        vals=cp.get(key) or []
        if isinstance(vals,str): vals=[vals]
        for name in vals:
            if name and name not in seen:
                rows.append({"name":str(name),"value":"✓"})
                seen.add(str(name))
    return rows

def v218_case(c,j):
    jid=j["journey_id"]
    tr=c.execute("SELECT * FROM travel_profile WHERE journey_id=?",(jid,)).fetchone()
    cv=c.execute("SELECT * FROM coverage_need WHERE journey_id=?",(jid,)).fetchone()
    q=c.execute("SELECT * FROM quote WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
    ps=c.execute("SELECT * FROM person_profile WHERE journey_id=? ORDER BY seq",(jid,)).fetchall()
    uw=c.execute("SELECT * FROM underwriting WHERE journey_id=?",(jid,)).fetchone()
    pay=c.execute("SELECT * FROM payment WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
    pol=c.execute("SELECT * FROM policy WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
    tp,cp,qp=v21_payload(tr),v21_payload(cv),v21_payload(q)
    persons=[]
    for p in ps:
        pp=v21_payload(p)
        persons.append({
          "seq":p["seq"],"name":p["name"] or pp.get("name",""),
          "id_no":p["id_no"] or pp.get("id_no",""),"dob":p["dob"] or pp.get("dob",""),
          "relation":p["relation"] or pp.get("relation",""),"mobile":p["mobile"] or pp.get("mobile",""),
          "email":p["email"] or pp.get("email",""),"address":pp.get("address","")
        })
    applicant=persons[0] if persons else {}
    raw=tp.get("raw_form") or {}
    if not applicant.get("name"): applicant["name"]=raw.get("applicantName","")
    if not applicant.get("mobile"): applicant["mobile"]=raw.get("applicantPhone","")
    policy_no=pol["policy_no"] if pol else ""
    status=v218_status_label(j["checkpoint"],j["payment_status"],policy_no)
    sd=tp.get("start_date",""); ed=tp.get("end_date","")
    st=tp.get("start_time",""); et=tp.get("end_time","")
    trip=(f"{sd} {st} ～ {ed} {et}").strip(" ～")
    destination=tp.get("destination") or "／".join(x for x in [tp.get("country"),tp.get("city")] if x)
    return {
      "journey_id":jid,"number":policy_no or jid,"policy_no":policy_no,
      "checkpoint":j["checkpoint"],"payment_status":j["payment_status"],"status":status,
      "applicant":applicant,"applicant_name":applicant.get("name",""),
      "applicant_phone":applicant.get("mobile",""),
      "trip":trip,"destination":destination,"people":tp.get("people") or len(persons) or "",
      "insurance_days":v2110_insurance_days(tp),"coverage_rows":v2110_coverage_rows(cp),
      "travel":tp,"coverage":cp,"quote":qp,"persons":persons,
      "product_code":q["product_code"] if q else "",
      "product_name":q["product_name"] if q else "",
      "insurer_name":q["insurer_name"] if q else "",
      "total_premium":q["total_premium"] if q else None,
      "underwriting_status":uw["status"] if uw else "",
      "payment":dict(pay) if pay else None,
      # V2.1.9 single Case DTO aliases used by the history UI
      "application_no":jid,"number_label":policy_no or jid,"status_label":status,
      "start_date":sd,"end_date":ed,"person_count":len(persons),
    }

@app.get("/api/v21/applications")
def v21_applications():
    # History inquiry is DB-only. Do not consult browser/session/snapshot state.
    mobile=(request.args.get("mobile") or "").strip()
    c=v2r_db()
    try:
        rows=c.execute("""SELECT * FROM application_journey
                          WHERE status!='CANCELLED'
                          ORDER BY created_at DESC""").fetchall()
        cases=[v218_case(c,j) for j in rows]
        if mobile:
            cases=[x for x in cases if x.get("applicant_phone")==mobile]
        return jsonify(ok=True,items=cases)
    finally:c.close()

@app.get("/api/v21/application/<jid>")
def v21_application(jid):
    c=v2r_db()
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j:return jsonify(ok=False,error="找不到投保案件。"),404
        return jsonify(ok=True,detail=v218_case(c,j),item=v218_case(c,j))
    finally:c.close()

@app.post("/api/v21/application/<jid>/delete")
def v21_delete(jid):
    c=v2r_db()
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j:return jsonify(ok=False,error="找不到投保案件。"),404
        pol=c.execute("SELECT 1 FROM policy WHERE journey_id=? LIMIT 1",(jid,)).fetchone()
        if pol:return jsonify(ok=False,error="保單已出單，如需取消或變更請洽客服。"),409
        c.execute("UPDATE application_journey SET status='CANCELLED',updated_at=? WHERE journey_id=?",
                  (datetime.now().isoformat(timespec="seconds"),jid)); c.commit()
        return jsonify(ok=True)
    finally:c.close()

@app.post("/api/v21/application/<jid>/continue")
def v21_continue(jid):
    c=v2r_db()
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j:return jsonify(ok=False,error="找不到投保案件。"),404
        pol=c.execute("SELECT 1 FROM policy WHERE journey_id=? LIMIT 1",(jid,)).fetchone()
        if pol:return jsonify(ok=True,action="ISSUED",case=v218_case(c,j),item=v218_case(c,j))
        if str(j["payment_status"] or "").upper()=="PAID" or j["checkpoint"]=="PAYMENT_COMPLETED":
            return jsonify(ok=True,action="PAID",case=v218_case(c,j),item=v218_case(c,j))
        if j["checkpoint"] in ("PERSON_CONFIRMED","UNDERWRITING_CONFIRMED"):
            return jsonify(ok=True,action="PAYMENT",case=v218_case(c,j),item=v218_case(c,j))
        # Checkpoint 2: deliberately DO NOT restore. Cancel old unfinished case and restart clean.
        if j["checkpoint"]=="PRODUCT_SELECTED":
            c.execute("UPDATE application_journey SET status='CANCELLED',updated_at=? WHERE journey_id=?",
                      (datetime.now().isoformat(timespec="seconds"),jid)); c.commit()
            return jsonify(ok=True,action="REPLAN")
        return jsonify(ok=True,action="REPLAN")
    finally:c.close()

@app.post("/api/v21/application/<jid>/pay-demo")
def v21_pay_demo(jid):
    d=request.get_json(silent=True) or {}
    if not all((d.get("card_no"),d.get("expiry"),d.get("cvv"),d.get("holder"))):
        return jsonify(ok=False,error="請完整填寫 Demo 繳費資料。"),400
    c=v2r_db()
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j:return jsonify(ok=False,error="找不到投保案件。"),404
        q=c.execute("SELECT * FROM quote WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
        if not q:return jsonify(ok=False,error="找不到商品報價資料。"),400
        now=datetime.now().isoformat(timespec="seconds")
        pid="PAY-"+uuid.uuid4().hex[:10].upper()
        payload={"demo":True,"holder":d.get("holder"),"last4":str(d.get("card_no"))[-4:]}
        c.execute("INSERT INTO payment VALUES(?,?,?,?,?,?,?)",
                  (pid,jid,"PAID",q["total_premium"],now,json.dumps(payload,ensure_ascii=False),now))
        c.execute("""UPDATE application_journey SET checkpoint='PAYMENT_COMPLETED',
                     payment_status='PAID',updated_at=? WHERE journey_id=?""",(now,jid))
        c.commit()
        return jsonify(ok=True,status="已繳費")
    finally:c.close()


@app.post("/api/v217/checkpoint2")
def v217_checkpoint2():
    """Checkpoint 2 first DB write: create Journey + Travel + Coverage + Quote atomically."""
    d=request.get_json(silent=True) or {}
    profile=d.get("profile") or {}
    raw=d.get("raw_form") or {}
    coverage=d.get("coverage") or {}
    q=d.get("quote") or {}
    p=q.get("product") or {}
    applicant_mobile=str(d.get("applicant_mobile") or raw.get("applicantPhone") or "").strip()
    if not applicant_mobile:
        return jsonify(ok=False,code="APPLICANT_MOBILE_REQUIRED",error="請填寫要保人手機號碼。"),400
    # Keep checkpoint-2 schema unchanged: mobile is lookup metadata inside Travel raw_form.
    raw["applicantPhone"]=applicant_mobile

    sd=profile.get("start_date") or raw.get("start") or ""
    ed=profile.get("end_date") or raw.get("end") or ""
    sh=profile.get("start_time")
    eh=profile.get("end_time")
    if sh in (None,""): sh=raw.get("startHour") or ""
    if eh in (None,""): eh=raw.get("endHour") or ""

    def norm_hour(v):
        v=str(v or "").strip()
        if not v:return ""
        return v if ":" in v else v.zfill(2)+":00"

    st,et=norm_hour(sh),norm_hour(eh)
    if not all((sd,st,ed,et)):
        return jsonify(ok=False,code="TRAVEL_PERIOD_INCOMPLETE",
                       error="請完整填寫啟程日期、啟程時間、回程日期、回程時間。"),400
    try:
        start_dt=datetime.fromisoformat(str(sd).replace("/","-")+"T"+st)
        end_dt=datetime.fromisoformat(str(ed).replace("/","-")+"T"+et)
    except Exception:
        return jsonify(ok=False,error="行程日期或時間格式不正確。"),400
    if end_dt<=start_dt:
        return jsonify(ok=False,error="回程日期時間必須晚於啟程日期時間。"),400

    product_code=p.get("id") or q.get("product_code")
    if not product_code:
        return jsonify(ok=False,error="尚未選定投保商品。"),400

    now=datetime.now().isoformat(timespec="seconds")
    jid="J-"+uuid.uuid4().hex[:10].upper()
    c=v2r_db()
    try:
        c.execute("BEGIN IMMEDIATE")
        c.execute("INSERT INTO application_journey VALUES(?,?,?,?,?,?,?)",
                  (jid,"DEMO-CUSTOMER","ACTIVE","PRODUCT_SELECTED","UNPAID",now,now))

        travel=dict(profile)
        travel.update({"start_date":sd,"start_time":st,"end_date":ed,"end_time":et,"raw_form":raw})
        c.execute("INSERT INTO travel_profile VALUES(?,?,?)",
                  (jid,json.dumps(travel,ensure_ascii=False),now))
        c.execute("INSERT INTO coverage_need VALUES(?,?,?)",
                  (jid,json.dumps(coverage,ensure_ascii=False),now))

        qp={
            "status":"ACTIVE",
            "product_code":product_code,
            "product_name":p.get("name") or q.get("product_name"),
            "insurer_name":p.get("company") or q.get("insurer_name"),
            "total_premium":q.get("demo_total",q.get("total_premium")),
            "person_rows":q.get("person_rows") or [],
            "desired":q.get("desired") or coverage,
            "product":p,
            "quote_id":q.get("quote_id")
        }
        c.execute("INSERT INTO quote VALUES(?,?,?,?,?,?,?,?,?)",
                  (f"Q-{jid}",jid,"ACTIVE",qp["product_code"],qp["product_name"],
                   qp["insurer_name"],qp["total_premium"],json.dumps(qp,ensure_ascii=False),now))
        c.execute("INSERT OR REPLACE INTO journey_snapshot VALUES(?,?,?)",
                  (jid,json.dumps({"checkpoint":"PRODUCT_SELECTED"},ensure_ascii=False),now))
        c.commit()
        return jsonify(ok=True,journey_id=jid,checkpoint="PRODUCT_SELECTED",quote=qp)
    except Exception as e:
        c.rollback()
        return jsonify(ok=False,error="斷點2寫入失敗："+str(e)),500
    finally:
        c.close()



@app.post("/api/v220/application/<jid>/issue-policy")
def v220_issue_policy(jid):
    """V2.2.1 paid -> confirmed issuance. Idempotent and schema-safe."""
    c=v2r_db()
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j: return jsonify(ok=False,error="找不到投保案件。"),404
        existing=c.execute("SELECT * FROM policy WHERE journey_id=? LIMIT 1",(jid,)).fetchone()
        if existing:
            return jsonify(ok=True,already_created=True,policy_no=existing["policy_no"],status="已出單")
        if not (str(j["payment_status"] or "").upper()=="PAID" or j["checkpoint"]=="PAYMENT_COMPLETED"):
            return jsonify(ok=False,error="尚未完成繳費，不能出單。"),409
        q=c.execute("SELECT * FROM quote WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
        if not q: return jsonify(ok=False,error="找不到商品報價資料，不能出單。"),409
        now=datetime.now().isoformat(timespec="seconds")
        pno="P"+datetime.now().strftime("%Y%m%d")+uuid.uuid4().hex[:6].upper()
        cols=[r["name"] for r in c.execute("PRAGMA table_info(policy)").fetchall()]
        data={"policy_no":pno,"journey_id":jid,"status":"ISSUED","policy_status":"ISSUED",
              "issued_at":now,"created_at":now,"updated_at":now,"delivery_status":"DEMO_READY"}
        use=[k for k in data if k in cols]
        if "policy_no" not in use or "journey_id" not in use:
            return jsonify(ok=False,error="Policy 資料表必要欄位不完整。"),500
        c.execute("BEGIN IMMEDIATE")
        c.execute("INSERT INTO policy ("+",".join(use)+") VALUES ("+",".join("?" for _ in use)+")",
                  [data[k] for k in use])
        c.execute("UPDATE application_journey SET checkpoint='POLICY_CREATED',updated_at=? WHERE journey_id=?",(now,jid))
        c.commit()
        return jsonify(ok=True,policy_no=pno,status="已出單",
                       insurer_name=q["insurer_name"],product_name=q["product_name"],
                       total_premium=q["total_premium"])
    except Exception as e:
        c.rollback(); return jsonify(ok=False,error="出單失敗："+str(e)),500
    finally: c.close()

# Flask startup must remain after every route declaration.

@app.get("/api/v2r/journey/<jid>/resume")
def v2r_resume(jid):
    c=v2r_db()
    j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
    if not j:
        c.close(); return jsonify(ok=False,error="找不到案件"),404
    def payload(table):
        r=c.execute(f"SELECT payload FROM {table} WHERE journey_id=?",(jid,)).fetchone()
        if not r or not r["payload"]: return {}
        try: return json.loads(r["payload"])
        except: return {}
    persons=[]
    for r in c.execute("SELECT payload FROM person_profile WHERE journey_id=? ORDER BY seq",(jid,)):
        try: persons.append(json.loads(r["payload"]))
        except: persons.append({})
    data={
      "journey":dict(j),
      "travel_profile":payload("travel_profile"),
      "persons":persons,
      "coverage_need":payload("coverage_need"),
      "quote":payload("quote"),
      "underwriting":payload("underwriting")
    }
    c.close()
    return jsonify(ok=True,data=data,resume_target=j["checkpoint"])


# ===== V2.0.3R Change Impact Engine =====
def v2r_change_impact(changed_fields):
    fields=set(changed_fields or [])
    identity={"name","id_no"}
    contact={"mobile","email"}
    pricing={"dob","traveler_count","persons","start_date","end_date","start_time","end_time",
             "destination_country","coverage_need","coverage_amount","product"}
    hit_pricing=bool(fields & pricing)
    hit_identity=bool(fields & identity)
    if hit_pricing:
        return {"quote":"INVALIDATED","eligibility":"RECALCULATE","underwriting":"RECHECK",
                "checkpoint":"PRODUCT_SELECTED","reason":"PRICING_OR_ELIGIBILITY_CHANGED"}
    if "destination_city" in fields:
        return {"quote":"REVIEW","eligibility":"REVIEW","underwriting":"REVIEW",
                "checkpoint":None,"reason":"CITY_CHANGE_RULE_DEPENDENT"}
    if hit_identity:
        return {"quote":"KEEP","eligibility":"RECHECK","underwriting":"RECHECK",
                "checkpoint":None,"reason":"IDENTITY_CHANGED"}
    if fields and fields <= contact:
        return {"quote":"KEEP","eligibility":"KEEP","underwriting":"KEEP",
                "checkpoint":None,"reason":"CONTACT_ONLY"}
    return {"quote":"REVIEW","eligibility":"REVIEW","underwriting":"REVIEW",
            "checkpoint":None,"reason":"OTHER_CHANGE"}

@app.post("/api/v2r/journey/<jid>/change")
def v2r_change(jid):
    d=request.get_json(silent=True) or {}
    changed=d.get("changed_fields") or []
    patch=d.get("patch") or {}
    c=v2r_db(); j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
    if not j:
        c.close(); return jsonify(ok=False,error="找不到案件"),404
    if j["payment_status"]=="PAID":
        c.close(); return jsonify(ok=False,error="已繳款案件不可直接修改，請聯絡客服"),409
    impact=v2r_change_impact(changed)
    now=datetime.now().isoformat(timespec="seconds")

    # Patch travel profile without destroying unrelated known data.
    if "travel_profile" in patch:
        r=c.execute("SELECT payload FROM travel_profile WHERE journey_id=?",(jid,)).fetchone()
        old=json.loads(r["payload"]) if r and r["payload"] else {}
        old.update(patch["travel_profile"] or {})
        c.execute("INSERT OR REPLACE INTO travel_profile VALUES(?,?,?)",(jid,json.dumps(old,ensure_ascii=False),now))

    # Patch coverage need without clearing unrelated choices.
    if "coverage_need" in patch:
        r=c.execute("SELECT payload FROM coverage_need WHERE journey_id=?",(jid,)).fetchone()
        old=json.loads(r["payload"]) if r and r["payload"] else {}
        old.update(patch["coverage_need"] or {})
        c.execute("INSERT OR REPLACE INTO coverage_need VALUES(?,?,?)",(jid,json.dumps(old,ensure_ascii=False),now))

    # Quote is invalidated, never deleted, when pricing/eligibility inputs changed.
    if impact["quote"]=="INVALIDATED":
        rows=c.execute("SELECT quote_id,payload FROM quote WHERE journey_id=?",(jid,)).fetchall()
        for q in rows:
            try: qp=json.loads(q["payload"] or "{}")
            except: qp={}
            qp["status"]="INVALIDATED"; qp["invalidated_reason"]=impact["reason"]; qp["invalidated_at"]=now
            c.execute("UPDATE quote SET status='INVALIDATED',payload=?,updated_at=? WHERE quote_id=?",
                      (json.dumps(qp,ensure_ascii=False),now,q["quote_id"]))
    # Underwriting result becomes stale when recheck is required.
    if impact["underwriting"]=="RECHECK":
        r=c.execute("SELECT payload FROM underwriting WHERE journey_id=?",(jid,)).fetchone()
        if r:
            try: up=json.loads(r["payload"] or "{}")
            except: up={}
            up["status"]="NEEDS_RECHECK"; up["reason"]=impact["reason"]; up["invalidated_at"]=now
            c.execute("UPDATE underwriting SET status='NEEDS_RECHECK',payload=?,updated_at=? WHERE journey_id=?",
                      (json.dumps(up,ensure_ascii=False),now,jid))
    cp=impact["checkpoint"] or j["checkpoint"]
    c.execute("UPDATE application_journey SET checkpoint=?,updated_at=? WHERE journey_id=?",(cp,now,jid))
    c.commit(); c.close()
    return jsonify(ok=True,journey_id=jid,changed_fields=changed,impact=impact)


@app.post("/api/v2r/journey/<jid>/confirm-persons")
def v2r_confirm_persons(jid):
    d=request.get_json(silent=True) or {}
    persons=d.get("persons") or []
    q=d.get("quote") or {}
    if not persons:
        return jsonify(ok=False,error="沒有可確認的被保險人資料"),400
    required=("name","id_no","dob")
    for i,p in enumerate(persons,1):
        missing=[k for k in required if not str(p.get(k) or "").strip()]
        if missing:
            return jsonify(ok=False,error=f"第{i}位被保險人資料未完整"),400
    now=datetime.now().isoformat(timespec="seconds")
    c=v2r_db()
    try:
        c.execute("BEGIN IMMEDIATE")
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j:
            c.rollback(); return jsonify(ok=False,error="找不到案件"),404
        if j["payment_status"]=="PAID":
            c.rollback(); return jsonify(ok=False,error="已繳款案件不可直接修改，請聯絡客服"),409

        # Replace Person Profile only after the complete set passed validation.
        c.execute("DELETE FROM person_profile WHERE journey_id=?",(jid,))
        for i,p in enumerate(persons,1):
            c.execute("INSERT INTO person_profile VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                (f"{jid}-P{i}",jid,i,p.get("name"),p.get("id_no"),p.get("dob"),
                 p.get("relation"),p.get("mobile"),p.get("email"),
                 json.dumps(p,ensure_ascii=False),now))

        # Product/Quote is committed when the customer selects it.
        # Never overwrite it here with stale browser state.
        qr=c.execute("SELECT * FROM quote WHERE journey_id=?",(jid,)).fetchone()
        if not qr:
            c.rollback(); return jsonify(ok=False,error="尚未儲存已選商品，請重新選擇商品"),409

        # Checkpoint moves only after Person + latest Quote were committed successfully.
        c.execute("UPDATE application_journey SET checkpoint='PERSON_CONFIRMED',updated_at=? WHERE journey_id=?",(now,jid))
        c.commit()
        return jsonify(ok=True,journey_id=jid,checkpoint="PERSON_CONFIRMED")
    except Exception as e:
        c.rollback()
        return jsonify(ok=False,error="投保資料確認寫入失敗："+str(e)),500
    finally:
        c.close()


@app.post("/api/v2r/journey/<jid>/quote/select")
def v2r_quote_select(jid):
    q=(request.get_json(silent=True) or {}).get("quote") or {}
    p=q.get("product") or {}
    if not (p.get("id") or q.get("product_code")): return jsonify(ok=False,error="缺少商品資料"),400
    now=datetime.now().isoformat(timespec="seconds"); c=v2r_db()
    try:
        c.execute("BEGIN IMMEDIATE")
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j: c.rollback(); return jsonify(ok=False,error="找不到案件"),404
        payload={"status":"ACTIVE","product_code":p.get("id") or q.get("product_code"),
          "product_name":p.get("name") or q.get("product_name"),"insurer_name":p.get("company") or q.get("insurer_name"),
          "total_premium":q.get("demo_total",q.get("total_premium")),"person_rows":q.get("person_rows") or [],
          "desired":q.get("desired") or {},"product":p,"quote_id":q.get("quote_id")}
        c.execute("DELETE FROM quote WHERE journey_id=?",(jid,))
        c.execute("INSERT INTO quote VALUES(?,?,?,?,?,?,?,?,?)",(f"Q-{jid}",jid,"ACTIVE",payload["product_code"],
          payload["product_name"],payload["insurer_name"],payload["total_premium"],json.dumps(payload,ensure_ascii=False),now))
        c.execute("UPDATE application_journey SET checkpoint='PRODUCT_SELECTED',updated_at=? WHERE journey_id=?",(now,jid))
        c.commit(); return jsonify(ok=True,quote=payload,checkpoint="PRODUCT_SELECTED")
    except Exception as e:
        c.rollback(); return jsonify(ok=False,error=str(e)),500
    finally: c.close()


@app.get("/api/v2r/journey/<jid>/state")
def v2r_journey_state(jid):
    c=v2r_db()
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j: return jsonify(ok=False,error="找不到案件"),404
        q=c.execute("SELECT * FROM quote WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
        return jsonify(ok=True,state={
            "journey_id":jid,
            "status":j["status"],
            "checkpoint":j["checkpoint"],
            "checkpoint_label":v2r_checkpoint_label(j["checkpoint"]),
            "payment_status":j["payment_status"],
            "quote":dict(q) if q else None
        })
    finally: c.close()


# ===== V2.3.0.5 Travel Service / lifecycle =====
def v230_init(c):
    c.execute("""CREATE TABLE IF NOT EXISTS travel_service_case(
      service_id TEXT PRIMARY KEY, journey_id TEXT NOT NULL, service_type TEXT NOT NULL,
      status TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)""")
    c.commit()

def v230_payload(row):
    if not row: return {}
    try: return json.loads(row["payload"] or "{}")
    except Exception: return {}

@app.get("/api/v230/travel/<jid>")
def v230_travel(jid):
    c=v2r_db(); v230_init(c)
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j: return jsonify(ok=False,error="找不到案件"),404
        tr=c.execute("SELECT * FROM travel_profile WHERE journey_id=?",(jid,)).fetchone()
        cv=c.execute("SELECT * FROM coverage_need WHERE journey_id=?",(jid,)).fetchone()
        q=c.execute("SELECT * FROM quote WHERE journey_id=? ORDER BY updated_at DESC LIMIT 1",(jid,)).fetchone()
        p=c.execute("SELECT * FROM policy WHERE journey_id=? ORDER BY created_at DESC LIMIT 1",(jid,)).fetchone()
        tp=v230_payload(tr); cp=v230_payload(cv); qp=v230_payload(q); pp=v230_payload(p)
        # Stored rows wrap some values inside payload.
        if isinstance(tp.get("payload"),dict): tp=tp["payload"]
        if isinstance(cp.get("payload"),dict): cp=cp["payload"]
        end_date=tp.get("end_date") or (tp.get("raw_form") or {}).get("end_date")
        today=datetime.now().date()
        ended=False
        try: ended=bool(end_date and datetime.fromisoformat(str(end_date).replace("/","-")).date() < today)
        except Exception: pass
        cases=[dict(x) for x in c.execute("SELECT * FROM travel_service_case WHERE journey_id=? ORDER BY created_at DESC",(jid,))]
        open_cases=[x for x in cases if x["status"]=="OPEN"]
        closed=(j["checkpoint"]=="CLOSED" or j["status"]=="CLOSED")
        return jsonify(ok=True,data={
          "journey_id":jid,"checkpoint":j["checkpoint"],"closed":closed,"trip_ended":ended,
          "can_close":bool(ended and not open_cases and not closed),
          "close_reason":("旅程尚未結束" if not ended else ("仍有未完成的理賠／服務案件" if open_cases else "")),
          "travel":tp,"coverage":cp,
          "quote":{"insurer_name":q["insurer_name"] if q else "","product_name":q["product_name"] if q else "",
                   "total_premium":q["total_premium"] if q else None},
          "policy_no":p["policy_no"] if p else "",
          "service_cases":cases
        })
    finally:c.close()

@app.post("/api/v230/travel/<jid>/service-case")
def v230_service_case(jid):
    d=request.get_json(silent=True) or {}; typ=str(d.get("service_type") or "").strip()
    if typ not in ("CLAIM","EMERGENCY","FLIGHT"): return jsonify(ok=False,error="服務類型不正確"),400
    now=datetime.now().isoformat(timespec="seconds"); c=v2r_db(); v230_init(c)
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j:return jsonify(ok=False,error="找不到案件"),404
        if j["checkpoint"]=="CLOSED":return jsonify(ok=False,error="案件已結案"),409
        sid="S-"+uuid.uuid4().hex[:10].upper()
        c.execute("INSERT INTO travel_service_case VALUES(?,?,?,?,?,?,?)",
          (sid,jid,typ,"OPEN",str(d.get("note") or ""),now,now));c.commit()
        return jsonify(ok=True,service_id=sid,status="OPEN")
    finally:c.close()

@app.post("/api/v230/travel/<jid>/service-case/<sid>/complete")
def v230_complete_case(jid,sid):
    now=datetime.now().isoformat(timespec="seconds"); c=v2r_db(); v230_init(c)
    try:
        r=c.execute("SELECT * FROM travel_service_case WHERE journey_id=? AND service_id=?",(jid,sid)).fetchone()
        if not r:return jsonify(ok=False,error="找不到服務案件"),404
        c.execute("UPDATE travel_service_case SET status='COMPLETED',updated_at=? WHERE journey_id=? AND service_id=?",(now,jid,sid))
        c.commit()
        return jsonify(ok=True,closed=False)
    finally:c.close()

@app.post("/api/v230/travel/<jid>/close")
def v230_close(jid):
    now=datetime.now().isoformat(timespec="seconds"); c=v2r_db(); v230_init(c)
    try:
        j=c.execute("SELECT * FROM application_journey WHERE journey_id=?",(jid,)).fetchone()
        if not j:return jsonify(ok=False,error="找不到案件"),404
        tr=c.execute("SELECT * FROM travel_profile WHERE journey_id=?",(jid,)).fetchone()
        tp=v230_payload(tr)
        if isinstance(tp.get("payload"),dict):tp=tp["payload"]
        end_date=tp.get("end_date") or (tp.get("raw_form") or {}).get("end_date")
        try: ended=bool(end_date and datetime.fromisoformat(str(end_date).replace("/","-")).date() < datetime.now().date())
        except Exception: ended=False
        if not ended:return jsonify(ok=False,error="旅程尚未結束，不能結案。"),409
        n=c.execute("SELECT COUNT(*) FROM travel_service_case WHERE journey_id=? AND status='OPEN'",(jid,)).fetchone()[0]
        if n:return jsonify(ok=False,error="仍有未完成的理賠／服務案件，不能結案。"),409
        c.execute("UPDATE application_journey SET status='CLOSED',checkpoint='CLOSED',updated_at=? WHERE journey_id=?",(now,jid))
        c.commit();return jsonify(ok=True,checkpoint="CLOSED",status="CLOSED")
    finally:c.close()

if __name__=="__main__":
    app.run(host="127.0.0.1",port=5000,debug=True)
