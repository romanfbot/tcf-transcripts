import base64, json, os, sys, requests, pathlib

def load_env(path):
    if not path.exists(): return
    for line in path.read_text().splitlines():
        line=line.strip()
        if not line or line.startswith('#') or '=' not in line: continue
        k,v=line.split('=',1)
        k=k.strip(); v=v.strip().strip('"').strip("'")
        os.environ.setdefault(k,v)

load_env(pathlib.Path.home()/'.hermes/.env')
api_key=os.environ.get('OPENROUTER_API_KEY')
if not api_key:
    raise SystemExit('OPENROUTER_API_KEY not found in environment or ~/.hermes/.env')
path=pathlib.Path(sys.argv[1])
out=pathlib.Path(sys.argv[2])
audio_b64=base64.b64encode(path.read_bytes()).decode('ascii')
payload={
  'model':'openai/whisper-large-v3',
  'input_audio': {'data': audio_b64, 'format': 'mp3'},
  'language': 'fr',
  'temperature': 0
}
headers={'Authorization':f'Bearer {api_key}','Content-Type':'application/json','HTTP-Referer':'https://github.com/romanfbot/tcf-transcripts','X-Title':'TCF Transcripts'}
r=requests.post('https://openrouter.ai/api/v1/audio/transcriptions',headers=headers,json=payload,timeout=600)
print('status', r.status_code)
print('generation', r.headers.get('X-Generation-Id'))
if not r.ok:
    print(r.text[:2000])
    r.raise_for_status()
data=r.json()
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(data,ensure_ascii=False,indent=2))
text=data.get('text','')
(pathlib.Path(str(out)+'.txt')).write_text(text,encoding='utf-8')
print('chars', len(text))
print(text[:1000])
