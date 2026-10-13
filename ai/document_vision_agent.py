import os,json,re,tempfile,pathlib,base64,mimetypes
from openai import OpenAI
PROMPT="""你是旅遊保險文件理解 Agent。直接閱讀文件，不依賴固定版型，不可猜測。
重要規則：
1. 看得到才填；看不清或文件沒有就填 null，絕對不要補 08:00、00:00 等預設時間。
2. 保留所有旅客姓名。若無生日/年齡，不可自行判斷大人、小孩、長輩，category 填 null。
3. 保留所有可辨識航段 segments，不要只壓縮成去回程。
4. 每個重要欄位加 status：confirmed / needs_confirmation / unavailable。
5. 日期缺少年份時，不得自行補任何年份；start/end 必須為 null，原始日期文字保留在 segments.date。
6. 單一航段的 arrival_time 是同一航段抵達時間，絕對不是 return/end。沒有真正回程航段時 end=null。
7. uncertain_fields 若指出年份/日期不確定，對應 start/end 必須為 null。
只回傳 JSON：
{
 "document_type":"",
 "destination":{"value":null,"status":"needs_confirmation"},
 "airline":{"value":null,"status":"needs_confirmation"},
 "start":{"value":null,"status":"needs_confirmation"},
 "end":{"value":null,"status":"needs_confirmation"},
 "passengers":[{"name":null,"category":null,"dob":null,"status":"needs_confirmation"}],
 "segments":[{"from":null,"to":null,"flight":null,"date":null,"departure_time":null,"arrival_time":null,"status":"needs_confirmation"}],
 "itinerary":[],
 "confidence":"high|medium|low",
 "uncertain_fields":[]
}
"""
def parse(s):
 return json.loads(re.sub(r"^```(?:json)?\\s*|\\s*```$","",s.strip()))
def recognize_document(filename,raw):
 if not os.getenv("OPENAI_API_KEY"): raise RuntimeError("尚未設定 OPENAI_API_KEY")
 c=OpenAI(); ext=pathlib.Path(filename).suffix.lower()
 if ext in {".png",".jpg",".jpeg",".webp",".gif"}:
  mime=mimetypes.guess_type(filename)[0] or "image/png"
  data=base64.b64encode(raw).decode("ascii")
  r=c.responses.create(model=os.getenv("OPENAI_VISION_MODEL","gpt-5.6-luna"),input=[{"role":"user","content":[{"type":"input_text","text":PROMPT},{"type":"input_image","image_url":"data:"+mime+";base64,"+data}]}])
  return parse(r.output_text)
 with tempfile.NamedTemporaryFile(suffix=ext or ".pdf",delete=False) as f:
  f.write(raw); path=f.name
 try:
  with open(path,"rb") as fh: up=c.files.create(file=fh,purpose="user_data")
  r=c.responses.create(model=os.getenv("OPENAI_VISION_MODEL","gpt-5.6-luna"),input=[{"role":"user","content":[{"type":"input_file","file_id":up.id},{"type":"input_text","text":PROMPT}]}])
  return parse(r.output_text)
 finally:
  try: os.unlink(path)
  except: pass
