GenAI Presentation Agent

Quickstart

1) Create virtual environment (optional)

```bash
python -m venv myenv
myenv\\Scripts\\activate
```

2) Install dependencies

```bash
pip install -r requirements.txt
```

3) Run backend

```bash
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000
```

4) Open `frontend/index.html` in a browser. Set `window.BACKEND_BASE` if needed.

Features

- Upload `.pptx` and parse slides (title/content)
- Generate narration text and TTS audio (gTTS)
- Simple Q&A per slide with memory logging (SQLite)
- Controls: next/prev/repeat, tone & language selectors
- Summary endpoint

Sample PDF

```bash
# Install deps if not already
pip install -r requirements.txt

# Run the server
uvicorn backend.main:app --reload --host 127.0.0.1 --port 8000

# Open the generated PDF in your browser
start http://127.0.0.1:8000/sample-pdf
```

The `/sample-pdf` endpoint streams a 2-page PDF rendered with ReportLab, demonstrating server-side PDF generation suitable for exporting summaries or Q&A logs.

Notes

- For offline TTS, replace gTTS implementation in `backend/services/tts.py` with `pyttsx3`.
- To integrate OpenAI or Ollama, extend `backend/services/ai.py` to call the model.


