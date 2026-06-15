# Better TV5MONDE TCF

A small static website that makes TV5MONDE TCF listening practice easier to study from.

Published site: https://romanfbot.github.io/better-tv5monde-tcf/

## Why this is better than the original TV5MONDE practice flow

- **Transcripts:** every listening question includes an automatically generated French transcript next to the audio, so you can review what you heard after answering.
- **Immediate answer review:** the correct answer is shown right after you choose an option, instead of only after finishing the full test.
- **Question-by-question practice:** you can jump between tests and individual questions without restarting a full timed flow.
- **Original materials preserved:** audio, images, answer options, and source links still come from TV5MONDE.

## What is included

- `docs/` — buildless static site for GitHub Pages.
- `docs/data/tcf-lots.json` — extracted TV5MONDE TCF lot data: questions, audio URLs, answer choices, correct answers, and transcripts.
- `docs/EXTRACTION.md` — repeatable extraction workflow for future swarm/parallel agents.
- `scripts/process_tv5_lots.py` — extracts a TV5MONDE lot with `agent-browser`, downloads audio, and transcribes it through OpenRouter.
- `scripts/merge_tv5_lots.py` — merges processed per-lot JSON files into the static-site dataset.
- `scripts/transcribe_openrouter.py` — standalone transcription script using the OpenRouter STT endpoint.
- `data/tv5monde-<LOT_ID>/` — raw extraction data, OpenRouter responses, transcript text files, and per-lot `lot.json` files.

## Current dataset

The deployed site includes 17 TV5MONDE `Compréhension orale` training tests: display tests 1–17 map to these lot IDs:

```text
1: 58
2: 57
3: 56
4: 45
5: 52
6: 53
7: 47
8: 42
9: 43
10: 44
11: 50
12: 55
13: 60
14: 66
15: 68
16: 69
17: 70
```

Each test has 15 listening questions. Audio files are extracted from TV5MONDE per-question pages, and transcripts are generated with:

```text
nvidia/parakeet-tdt-0.6b-v3
```

## Local development

```bash
cd docs
python3 -m http.server 8080
# open http://localhost:8080
```

## Processing more TV5MONDE lots

The script expects `OPENROUTER_API_KEY` in the environment or in `~/.hermes/.env`.

```bash
python3 scripts/process_tv5_lots.py 71:18 72:19
# then add the new lot IDs to ORDER in scripts/merge_tv5_lots.py
python3 scripts/merge_tv5_lots.py
```

`process_tv5_lots.py` accepts `LOT_ID:DISPLAY_NUMBER` pairs and creates:

- `data/tv5monde-<LOT_ID>/extracted.json` — extracted TV5MONDE metadata;
- `data/tv5monde-<LOT_ID>/qNN-parakeet.json` — full OpenRouter JSON responses;
- `data/tv5monde-<LOT_ID>/qNN-parakeet.json.txt` — transcript text only;
- `data/tv5monde-<LOT_ID>/lot.json` — merged per-lot data.

## Source

TV5MONDE TCF practice tests: https://apprendre.tv5monde.com/fr/tcf
