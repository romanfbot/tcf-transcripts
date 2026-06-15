#!/usr/bin/env python3
"""Extract TV5MONDE TCF CO lots and transcribe their per-question audio via OpenRouter.

This script intentionally uses agent-browser for extraction because TV5MONDE's frame
endpoints may return 403 to plain requests, while browser-context fetches work and
also expose the `tcf_questions` answer-key cookie.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path
from typing import Any

import requests

ROOT = Path(__file__).resolve().parents[1]
OPENROUTER_URL = "https://openrouter.ai/api/v1/audio/transcriptions"
MODEL = "nvidia/parakeet-tdt-0.6b-v3"
BASE = "https://apprendre.tv5monde.com"


def load_env(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def run(cmd: list[str], *, timeout: int = 120) -> str:
    proc = subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)
    if proc.returncode != 0:
        raise RuntimeError(
            f"Command failed ({proc.returncode}): {' '.join(cmd)}\nSTDOUT:\n{proc.stdout}\nSTDERR:\n{proc.stderr}"
        )
    return proc.stdout


def agent_eval(session: str, js: str, *, timeout: int = 180) -> Any:
    stdout = run(["agent-browser", "--session", session, "eval", js, "--json"], timeout=timeout)
    wrapper = json.loads(stdout)
    if not wrapper.get("success"):
        raise RuntimeError(f"agent-browser eval failed: {wrapper}")
    return wrapper["data"]["result"]


def extract_lot(lot_id: int, *, force: bool = False) -> dict[str, Any]:
    out_path = ROOT / "data" / f"tv5monde-{lot_id}" / "extracted.json"
    if out_path.exists() and not force:
        return json.loads(out_path.read_text())

    session = f"tcf-lot-{lot_id}-{os.getpid()}"
    url = f"{BASE}/fr/tcf/test-dentrainement-au-tcf?tcf_lot_id={lot_id}&competence=CO#tcf_header"
    print(f"[lot {lot_id}] opening {url}", flush=True)
    run(["agent-browser", "--session", session, "open", url], timeout=180)
    run(["agent-browser", "--session", session, "wait", "2500"], timeout=30)

    js = f"""
(async () => {{
  const lotId = {lot_id};
  const parseCookie = (name) => {{
    const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]+)'));
    return m ? JSON.parse(decodeURIComponent(m[1])) : {{}};
  }};
  const correctMap = parseCookie('tcf_questions');
  const abs = (u) => u ? new URL(u.replaceAll('\\\\/', '/'), location.origin).href : null;
  const nums = Object.keys(correctMap).map(Number).sort((a, b) => a - b);
  const questions = await Promise.all(nums.map(async (n) => {{
    const res = await fetch(`/fr/tcf/entrainement-frame?question=${{n}}&tcf_lot_id=${{lotId}}&competence=CO`, {{ credentials: 'include' }});
    const html = await res.text();
    const d = new DOMParser().parseFromString(html, 'text/html');
    const correctAnswer = correctMap[String(n)]?.or || null;
    const mp3 = html.match(/https:\\\\?\\/\\\\?\\/[^\"']+?\\.mp3/);
    const codeOf = (a) => a.querySelector('.tcf-response-code')?.textContent.trim() || '';
    return {{
      number: n,
      questionId: correctMap[String(n)]?.id || null,
      skill: d.querySelector('.tcf-skill')?.textContent.trim().replace(/\s+/g, ' ') || '',
      instruction: d.querySelector('.tcf-consigne')?.textContent.trim().replace(/\s+/g, ' ') || '',
      prompt: [...d.querySelectorAll('.tcf-question-wrapper')]
        .map(e => e.textContent.trim().replace(/\s+/g, ' '))
        .join(' ')
        .replace(/Vous n'avez pas répondu à cette question\./g, '')
        .trim(),
      audioUrl: mp3 ? abs(mp3[0]) : null,
      imageUrl: abs(d.querySelector('.tcf-media img, img.img-responsive')?.getAttribute('src') || ''),
      correctAnswer,
      answers: [...d.querySelectorAll('.tcf-choix-item')].map(a => ({{
        code: codeOf(a),
        text: a.querySelector('.tcf-response-text')?.textContent.trim().replace(/\s+/g, ' ') || '',
        correct: codeOf(a) === correctAnswer,
      }})),
    }};
  }}));
  return {{
    lotId,
    sourceUrl: location.href,
    extractedAt: new Date().toISOString(),
    questions,
  }};
}})()
"""
    result = agent_eval(session, js, timeout=240)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    run(["agent-browser", "--session", session, "close"], timeout=30)
    print(f"[lot {lot_id}] extracted {len(result['questions'])} questions", flush=True)
    return result


def download_audio(url: str, path: Path) -> None:
    if path.exists() and path.stat().st_size > 0:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    with requests.get(url, stream=True, timeout=120) as response:
        response.raise_for_status()
        with path.open("wb") as handle:
            for chunk in response.iter_content(1024 * 64):
                if chunk:
                    handle.write(chunk)


def transcribe(audio_path: Path, out_path: Path, *, force: bool = False) -> str:
    txt_path = Path(str(out_path) + ".txt")
    if txt_path.exists() and txt_path.read_text(encoding="utf-8").strip() and not force:
        return txt_path.read_text(encoding="utf-8").strip()

    load_env(Path.home() / ".hermes/.env")
    api_key = os.environ.get("OPENROUTER_API_KEY")
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY not found in environment or ~/.hermes/.env")

    audio_b64 = base64.b64encode(audio_path.read_bytes()).decode("ascii")
    payload = {
        "model": MODEL,
        "input_audio": {"data": audio_b64, "format": "mp3"},
        "language": "fr",
        "temperature": 0,
    }
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/romanfbot/better-tv5monde-tcf",
        "X-Title": "Better TV5MONDE TCF",
    }
    response = requests.post(OPENROUTER_URL, headers=headers, json=payload, timeout=600)
    if not response.ok:
        raise RuntimeError(f"OpenRouter STT failed for {audio_path}: {response.status_code} {response.text[:1000]}")
    data = response.json()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    text = data.get("text", "").strip()
    txt_path.write_text(text, encoding="utf-8")
    return text


def process_lot(lot_id: int, display_number: int, *, force_extract: bool = False, force_transcribe: bool = False) -> dict[str, Any]:
    extracted = extract_lot(lot_id, force=force_extract)
    lot_dir = ROOT / "data" / f"tv5monde-{lot_id}"
    audio_dir = ROOT / "audio" / f"tv5monde-{lot_id}"

    questions = []
    for q in extracted["questions"]:
        question = dict(q)
        audio_url = question.get("audioUrl")
        if audio_url:
            filename = audio_url.rsplit("/", 1)[-1]
            audio_path = audio_dir / filename
            raw_path = lot_dir / f"q{int(question['number']):02d}-parakeet.json"
            print(f"[lot {lot_id}] q{question['number']:02d} downloading/transcribing", flush=True)
            download_audio(audio_url, audio_path)
            text = transcribe(audio_path, raw_path, force=force_transcribe)
            question["transcription"] = {
                "model": MODEL,
                "language": "fr",
                "text": text,
                "rawFile": str(raw_path.relative_to(ROOT)),
            }
        questions.append(question)

    payload = {
        "id": f"tv5monde-tcf-{lot_id}",
        "lotId": lot_id,
        "displayNumber": display_number,
        "title": f"TV5MONDE TCF training test {display_number}",
        "sourceUrl": f"{BASE}/fr/tcf/test-dentrainement-au-tcf?tcf_lot_id={lot_id}&competence=CO#tcf_header",
        "scrapeMethod": "See docs/EXTRACTION.md",
        "transcriptionModel": MODEL,
        "questions": questions,
    }
    lot_out = lot_dir / "lot.json"
    lot_out.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"[lot {lot_id}] wrote {lot_out}", flush=True)
    return payload


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("lots", nargs="+", help="LOT_ID:DISPLAY_NUMBER pairs, e.g. 57:2")
    parser.add_argument("--force-extract", action="store_true")
    parser.add_argument("--force-transcribe", action="store_true")
    args = parser.parse_args()

    processed = []
    for spec in args.lots:
        lot_s, display_s = spec.split(":", 1)
        processed.append(process_lot(int(lot_s), int(display_s), force_extract=args.force_extract, force_transcribe=args.force_transcribe))

    print(json.dumps({"processed": [lot["lotId"] for lot in processed]}, ensure_ascii=False))


if __name__ == "__main__":
    main()
