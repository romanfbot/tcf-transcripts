# TCF transcripts prototype

Небольшой статический сайт с транскриптами аудио к тренировочным заданиям TCF от TV5MONDE.

## Что сейчас внутри

- `site/` — buildless static site для GitHub Pages.
- `site/data/transcripts.json` — данные для UI: тесты, задания, транскрипты, ссылки на источники.
- `scripts/transcribe_openrouter.py` — скрипт транскрибации через OpenRouter STT endpoint и модель `openai/whisper-large-v3`.
- `data/tcf1-openrouter.json` — сырой ответ OpenRouter для TCF entraînement n°1.

## Локальный запуск

```bash
cd site
python3 -m http.server 8080
# open http://localhost:8080
```

## Транскрибация нового аудио

Скрипт ожидает `OPENROUTER_API_KEY` в окружении или в `~/.hermes/.env`.

```bash
python3 scripts/transcribe_openrouter.py audio/tcf2-podcast.mp3 data/tcf2-openrouter.json
```

Скрипт создаёт два файла:

- `data/tcf2-openrouter.json` — полный JSON-ответ OpenRouter;
- `data/tcf2-openrouter.json.txt` — только текст транскрипта.

После этого нужно добавить новый тест в `site/data/transcripts.json` и при необходимости вычитать автоматическое разбиение на задания.

## Источник

TV5MONDE: https://apprendre.tv5monde.com/fr/article/les-livrets-dentrainement-au-tcf-r-avec-tv5monde
