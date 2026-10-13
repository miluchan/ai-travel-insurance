CORE_COVERAGES=["意外傷害","海外醫療","緊急救援","行李損失","班機延誤","行李延誤"]
LOW_CORE=["意外傷害","海外醫療","緊急救援","行李損失"]
EXTRAS={"旅程取消":6,"手機遭竊":2,"食品中毒":2,"旅行文件損失":2,"個人責任":2,"其他":1}

SCENARIOS={
 "low":{"name":"預算較低","reason":"您希望控制預算，AI先保留四項主要核心保障，暫不納入班機延誤與行李延誤，再把主要保額調整到較精省的區間。","tiers":{
   "economy":{"label":"精省方案","accident":300,"medical":30,"rescue":100,"tag":"優先控制預算"},
   "balanced":{"label":"AI建議方案","accident":400,"medical":40,"rescue":125,"tag":"低預算中的均衡選擇"},
   "enhanced":{"label":"高保障方案","accident":500,"medical":50,"rescue":150,"tag":"在低預算方向中提高主要保障"}}},
 "basic":{"name":"基本保障","reason":"目前需求以六項核心保障為主，AI採用中間型保障配置，保留後續微調空間。","tiers":{
   "economy":{"label":"精省方案","accident":500,"medical":50,"rescue":100,"tag":"控制預算，保留六項核心保障"},
   "balanced":{"label":"AI建議方案","accident":600,"medical":60,"rescue":150,"tag":"主要保障與預算較均衡"},
   "enhanced":{"label":"高保障方案","accident":700,"medical":80,"rescue":200,"tag":"提高前三項主要保障額度"}}},
 "full":{"name":"完整保障","reason":"您的預算較寬裕或加選較多關注保障，AI提高主要保障額度，並保留較完整的附加保障空間。","tiers":{
   "economy":{"label":"精省方案","accident":600,"medical":60,"rescue":150,"tag":"完整保障中的入門方向"},
   "balanced":{"label":"AI建議方案","accident":800,"medical":80,"rescue":200,"tag":"完整保障的均衡配置"},
   "enhanced":{"label":"高保障方案","accident":1000,"medical":100,"rescue":250,"tag":"提高主要保障與完整度"}}}}

# V1.8.3.2 Demo Rate Engine: UI scenario/tier never participates in pricing.
# 27 explicit main-coverage rate nodes (9 x 3), Demo only; values are per person/day.
MAIN_RATES={
 "accident":{200:6,300:9,400:12,500:15,600:18,700:21,800:24,900:27,1000:30},
 "medical":{20:4,30:6,40:8,50:10,60:12,70:14,80:16,90:18,100:20},
 "rescue":{50:1.5,75:2,100:2.5,125:3,150:3.5,175:4,200:4.5,225:5,250:5.5},
}
# Every non-main coverage has one independent Demo rate (per person/day).
OTHER_RATES={
 "行李損失":5,"班機延誤":4,"行李延誤":3,
 "旅程取消":6,"手機遭竊":2,"食品中毒":2,"旅行文件損失":2,"個人責任":2,"其他":1,
}

def scenario_for(profile):
 budget=(profile.get("budget_range") or "").replace(",",""); concerns=profile.get("concerns") or []; extras=[c for c in concerns if c not in CORE_COVERAGES]; intent=(profile.get("coverage_intent") or "").lower()
 if intent=="low" or "300元以下" in budget:return "low"
 if intent=="full" or "500元以上" in budget or len(extras)>=3:return "full"
 return "basic"

def _num(v,default):
 try:return int(v)
 except:return default

def _rate(table,value):
 value=int(value)
 if value in table:return table[value]
 keys=sorted(table)
 # Defensive fallback for a value between nodes: linear interpolation. UI normally sends exact nodes.
 if value<=keys[0]:return table[keys[0]]
 if value>=keys[-1]:return table[keys[-1]]
 for a,b in zip(keys,keys[1:]):
  if a<=value<=b:return table[a]+(table[b]-table[a])*(value-a)/(b-a)

def quote(profile,tier="balanced",accident=None,medical=None,rescue=None,scenario=None):
 scenario=scenario or scenario_for(profile); sc=SCENARIOS[scenario]; t=sc["tiers"].get(tier,sc["tiers"]["balanced"])
 accident=_num(accident,t["accident"]); medical=_num(medical,t["medical"]); rescue=_num(rescue,t["rescue"])
 days=max(1,int(profile.get("days") or 1)); people=max(1,int(profile.get("people") or 1)); concerns=profile.get("concerns") or []
 # Price = 3 selected main amounts + each actually included other coverage. No scenario/tier/base surcharge.
 daily=_rate(MAIN_RATES["accident"],accident)+_rate(MAIN_RATES["medical"],medical)+_rate(MAIN_RATES["rescue"],rescue)
 daily+=sum(OTHER_RATES.get(c,0) for c in concerns)
 per_person=round(daily*days); total=per_person*people
 extras=[c for c in concerns if c not in CORE_COVERAGES]
 # V1.8.3.3: the planning display follows the actual Profile selections, not the scenario preset.
 core=[c for c in CORE_COVERAGES if c in concerns]
 return {"tier":tier,"label":t["label"],"tag":t["tag"],"accident":accident,"medical":medical,"rescue":rescue,"days":days,"people":people,"per_person":per_person,"total":total,"extras":extras,"core":core,"demo":True,"official_ready":False,"scenario":scenario,"scenario_name":sc["name"],"scenario_reason":sc["reason"]}

def tier_options(profile,scenario=None):
 scenario=scenario or scenario_for(profile)
 return [quote(profile,k,scenario=scenario) for k in ["economy","balanced","enhanced"]]
