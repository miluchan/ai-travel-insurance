import re
from datetime import date,datetime
def empty_profile():
 return {"country":None,"city":None,"destination":"尚未提供","start_date":None,"end_date":None,"days":None,"people":None,"adults":None,"children":None,"seniors":None,"birthdays":[],"budget":None,"budget_range":None,"flight_no":None,"origin":None,"origin_code":None,"arrival":None,"arrival_code":None,"concerns":[],"coverage_intent":None,"missing":[]}
def fmt(y,m,d):
 try:return date(int(y),int(m),int(d)).strftime("%Y/%m/%d")
 except:return None
def tripdates(t):
 m=re.search(r'(?:(20\d{2})[/-])?(\d{1,2})[/-](\d{1,2})\s*(?:到|至|~|～|－|—)\s*(?:(20\d{2})[/-])?(\d{1,2})[/-](\d{1,2})',t)
 if not m:return None,None
 y1,mo1,d1,y2,mo2,d2=m.groups(); y1=y1 or str(date.today().year); y2=y2 or y1
 return fmt(y1,mo1,d1),fmt(y2,mo2,d2)
def birthdays(t):
 out=[]
 for m in re.finditer(r'(我的生日|本人|太太|妻子|先生|丈夫|配偶)?\s*((?:19|20)\d{2})[/-](\d{1,2})[/-](\d{1,2})',t):
  lab=m.group(1) or f"旅客{len(out)+1}"; lab={"我的生日":"本人","妻子":"太太","丈夫":"先生"}.get(lab,lab)
  out.append({"label":lab,"date":fmt(m.group(2),m.group(3),m.group(4))})
 return out
def destination(t):
 u=t.upper(); country=city=None
 jp=["日本","東京","大阪","京都","北海道","沖繩","名古屋","福岡","成田","羽田","NRT","HND"]
 if any(x.upper() in u for x in jp):country="日本"
 for x in ["東京","大阪","京都","北海道","沖繩","名古屋","福岡"]:
  if x in t:city=x;break
 if not city and any(x in u for x in ["NRT","HND"]) or "成田" in t or "羽田" in t:city="東京"
 return country,city

def people_groups(t):
 def get(labels):
  for label in labels:
   m=re.search(r'(\d+)\s*(?:位|個)?\s*'+label,t)
   if m:return int(m.group(1))
  return None
 return get(["大人","成人"]),get(["小孩","兒童"]),get(["長輩","老人","高齡"])
def people(t):
 a,c,s=people_groups(t)
 if any(x is not None for x in [a,c,s]):return (a or 0)+(c or 0)+(s or 0)
 m=re.search(r'(\d+)\s*(?:個人|人|位)',t)
 if m:return int(m.group(1))
 if any(x in t for x in ["我和太太","我跟太太","我和先生","我跟先生","我們夫妻"]):return 2
 if "一家四口" in t:return 4
def concerns(t):
 # Canonical names MUST match the checkbox values in index.html.
 # More specific phrases are checked first so "行李遺失" never becomes "旅行文件損失".
 r=[
  ("意外傷害",["意外事故","意外傷害","意外"]),
  ("海外醫療",["海外生病","生病","海外醫療","醫療","看醫生","住院","突發疾病"]),
  ("緊急救援",["海外緊急救援","緊急救援","海外救援"]),
  ("行李損失",["行李遺失","行李損失","行李損壞","行李不見"]),
  ("班機延誤",["班機延誤","航班延誤"]),
  ("行李延誤",["行李延誤"]),
  ("旅程取消",["旅程取消","取消行程","旅程更改"]),
  ("手機遭竊",["手機遭竊","手機被偷"]),
  ("食品中毒",["食品中毒","食物中毒"]),
  ("旅行文件損失",["旅行文件遺失","護照遺失","證件遺失"]),
  ("個人責任",["個人責任"])
 ]
 return [name for name,keys in r if any(k in t for k in keys)]
def budget(t):
 m=re.search(r'(?:預算|大約|約|控制在)?\s*(?:NT\$|NTD|\$)?\s*([\d,]+)\s*(?:元|塊)',t,re.I)
 return int(m.group(1).replace(",","")) if m else None
def flight(t):
 m=re.search(r'\b([A-Z]{2}\s?\d{2,4})\b',t.upper()); return m.group(1).replace(" ","") if m else None
def airports(t):
 u=t.upper(); arr=[]
 for name,code in [("桃園","TPE"),("TPE","TPE"),("成田","NRT"),("NRT","NRT"),("羽田","HND"),("HND","HND")]:
  if (name.isascii() and name in u) or (not name.isascii() and name in t):
   if code not in [x[1] for x in arr]:arr.append((name if not name.isascii() else code,code))
 return arr[:2]
def refresh(p):
 p["destination"]="／".join(x for x in [p.get("country"),p.get("city")] if x) or "尚未提供"
 if p.get("start_date") and p.get("end_date"):
  a=datetime.strptime(p["start_date"],"%Y/%m/%d").date(); b=datetime.strptime(p["end_date"],"%Y/%m/%d").date(); p["days"]=(b-a).days+1
 miss=[]
 if not p.get("country"):miss.append("旅行目的地")
 if not p.get("start_date") or not p.get("end_date"):miss.append("出發日／回國日")
 if not p.get("people"):miss.append("旅遊人數")
 if not p.get("budget") and not p.get("budget_range"):miss.append("預算")
 p["missing"]=miss
def reply(p):
 m=p["missing"]
 if "旅行目的地" in m:return "這次準備去哪個國家或城市旅行？"
 if "出發日／回國日" in m:return "請告訴我出發日與回國日，例如 10/5～10/10。"
 if "旅遊人數" in m:return "這次共有幾位旅客？"
 if "預算" in m:return "收到。接下來請選擇每人的保險預算：300元以下、300～500元、500元以上，或「不確定，請AI建議」。"
 return "旅行資料已相當完整。下一階段可依這份 Travel Profile 建立保障組合。"
def update_profile(old,t):
 p=empty_profile();p.update(old or {})
 # V1.8.2: natural-language coverage direction
 if any(k in t for k in ["預算較低","控制預算","省一點","300元左右"]):
  p["coverage_intent"]="low"; p["budget_range"]="300元以下"
  p["concerns"]=["意外傷害","海外醫療","緊急救援","行李損失"]
 elif any(k in t for k in ["完整保障","保障完整","高保障","保障多一點"]):
  p["coverage_intent"]="full"; p["budget_range"]="500元以上"
  p["concerns"]=["意外傷害","海外醫療","緊急救援","行李損失","班機延誤","行李延誤","旅程取消","手機遭竊","食品中毒","旅行文件損失","個人責任"]
 elif any(k in t for k in ["基本保障","一般保障"]):
  p["coverage_intent"]="basic"; p["budget_range"]="300～500元"
  p["concerns"]=["意外傷害","海外醫療","緊急救援","行李損失","班機延誤","行李延誤"]
 c,ci=destination(t)
 if c:p["country"]=c
 if ci:p["city"]=ci
 a,b=tripdates(t)
 if a:p["start_date"],p["end_date"]=a,b
 n=people(t)
 if n:
  p["people"]=n
  a,c,s=people_groups(t)
  if any(x is not None for x in [a,c,s]):p["adults"],p["children"],p["seniors"]=a or 0,c or 0,s or 0
  else:p["adults"],p["children"],p["seniors"]=n,0,0
 bs=birthdays(t)
 for x in bs:
  p["birthdays"]=[z for z in p["birthdays"] if z["label"]!=x["label"]]
  p["birthdays"].append(x)
 if not p.get("people") and len(p["birthdays"])>1:p["people"]=len(p["birthdays"])
 x=budget(t)
 if x:
  p["budget"]=x
  p["budget_range"]="300元以下" if x<300 else ("300～500元" if x<=500 else "500元以上")
 x=flight(t)
 if x:p["flight_no"]=x
 aps=airports(t)
 if len(aps)>0:p["origin"],p["origin_code"]=aps[0]
 if len(aps)>1:p["arrival"],p["arrival_code"]=aps[1]
 elif aps and aps[0][1] in ("NRT","HND"):p["arrival"],p["arrival_code"]=aps[0]
 if not p.get("coverage_intent"):
  for x in concerns(t):
   if x not in p["concerns"]:p["concerns"].append(x)
 refresh(p)
 if p.get("coverage_intent") in {"low","basic","full"} and not any(x in p["missing"] for x in ["旅行目的地","出發日／回國日","旅遊人數"]):
  return p,"收到。將依您的需求幫您規劃保障，確定無誤後請按「AI 幫我規劃保障」按鈕。"
 return p,reply(p)
