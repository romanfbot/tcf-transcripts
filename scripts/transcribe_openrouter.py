import argparse, base64, json, os, sys, requests, pathlib

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
parser=argparse.ArgumentParser()
parser.add_argument('audio_path')
parser.add_argument('output_path')
parser.add_argument('--model', default='openai/whisper-large-v3')
parser.add_argument('--language', default='fr')
args=parser.parse_args()
path=pathlib.Path(args.audio_path)
out=pathlib.Path(args.output_path)
audio_b64=base64.b64encode(path.read_bytes()).decode('ascii')
payload={
  'model': args.model,
  'input_audio': {'data': audio_b64, 'format': 'mp3'},
  'language': args.language,
  'temperature': 0
}
headers={'Authorization':f'Bearer {api_key}','Content-Type':'application/json','HTTP-Referer':'https://github.com/romanfbot/better-tv5monde-tcf','X-Title':'Better TV5MONDE TCF'}
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
